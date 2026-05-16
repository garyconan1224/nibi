"""
聊天回合执行器：维护 in-memory 的 turn 状态（pending → streaming → done / error），
将 LLM 输出分片成 delta 推到环形缓冲，SSE 路由从中读取。

设计要点：
- 用户消息在 POST 阶段就持久化进 chat_store；assistant 消息在 turn 完成后整体落盘。
- LLM 调用本身目前是非流式（shared.sf_client.chat_completion）。这里把完整回复按固定大小切片，
  模拟逐 token 输出，前端 UX 与真实流式一致，后续可平滑替换为真正的 SSE/HTTP 流。
- 出错（无 API Key / 网络异常）走 status=error，前端通过 SSE 的 error 事件感知。
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Callable, Optional

from shared.chat_store import ChatMessage, ChatStore, get_default_store

LLMCaller = Callable[[list[dict], str | None], str]


@dataclass
class ChatTurn:
    turn_id: str
    workspace_id: str
    chat_id: str
    status: str = "pending"  # pending | streaming | done | error
    deltas: list[str] = field(default_factory=list)
    error: Optional[str] = None
    model: Optional[str] = None
    assistant_message_id: Optional[str] = None
    created_at: float = field(default_factory=time.time)


class ChatRunner:
    def __init__(
        self,
        store: ChatStore | None = None,
        llm_caller: LLMCaller | None = None,
        chunk_size: int = 24,
        chunk_delay_s: float = 0.04,
    ) -> None:
        self._store = store or get_default_store()
        self._llm_caller = llm_caller or _default_llm_caller
        self._chunk_size = chunk_size
        self._chunk_delay_s = chunk_delay_s
        self._turns: dict[str, ChatTurn] = {}
        self._lock = threading.Lock()

    def start_turn(
        self,
        workspace_id: str,
        chat_id: str | None,
        prompt: str,
        model: str | None = None,
    ) -> ChatTurn:
        prompt = (prompt or "").strip()
        if not prompt:
            raise ValueError("prompt 不能为空")
        cid = (chat_id or "").strip() or uuid.uuid4().hex
        turn = ChatTurn(
            turn_id=uuid.uuid4().hex,
            workspace_id=workspace_id,
            chat_id=cid,
            model=model,
        )

        # 用户消息先落盘
        user_msg = ChatMessage(chat_id=cid, role="user", content=prompt, model=model)
        self._store.append(workspace_id, user_msg)

        with self._lock:
            self._turns[turn.turn_id] = turn

        history = [
            {"role": m.role, "content": m.content}
            for m in self._store.list(workspace_id, chat_id=cid)
        ]
        threading.Thread(
            target=self._run,
            args=(turn, history),
            name=f"chat-turn-{turn.turn_id[:8]}",
            daemon=True,
        ).start()
        return turn

    def get(self, turn_id: str) -> ChatTurn | None:
        with self._lock:
            return self._turns.get(turn_id)

    def _run(self, turn: ChatTurn, history: list[dict]) -> None:
        turn.status = "streaming"
        try:
            full = self._llm_caller(history, turn.model)
        except Exception as err:
            turn.error = f"{type(err).__name__}: {err}"
            turn.status = "error"
            return

        for i in range(0, len(full), self._chunk_size):
            chunk = full[i : i + self._chunk_size]
            with self._lock:
                turn.deltas.append(chunk)
            if self._chunk_delay_s > 0:
                time.sleep(self._chunk_delay_s)

        assistant_msg = ChatMessage(
            chat_id=turn.chat_id,
            role="assistant",
            content=full,
            model=turn.model,
        )
        self._store.append(turn.workspace_id, assistant_msg)
        turn.assistant_message_id = assistant_msg.message_id
        turn.status = "done"


def _default_llm_caller(messages: list[dict], model: str | None) -> str:
    from shared.api_key_resolver import resolve_api_key
    from shared.runtime_llm_config import get_openai_chat_model
    from shared.sf_client import chat_completion

    api_key = resolve_api_key("")
    if not api_key:
        raise RuntimeError("缺少 LLM API Key（请在设置页或 .env 配置）")
    mdl = model or get_openai_chat_model()
    return chat_completion(api_key, mdl, messages)
