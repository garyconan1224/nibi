"""summary_generator + workspace_store summary helpers 测试。"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from backend.app.models.workspace import ItemSummary, WorkspaceItem, WorkspaceRecord
from backend.app.services.summary_generator import build_prompt, generate_summary
from backend.app.services.workspace_store import WorkspaceStore


# ── 辅助 ────────────────────────────────────────────────────────


def _make_item(**overrides: object) -> WorkspaceItem:
    base = dict(
        item_id="item-1",
        type="video",
        source="local",
        source_value="/tmp/test.mp4",
        name="测试视频",
        status="done",
        results={"transcript": "这是转写文本内容。"},
    )
    base.update(overrides)
    return WorkspaceItem.from_dict(base)


def _make_store_with_item(item: WorkspaceItem | None = None) -> WorkspaceStore:
    """创建临时 WorkspaceStore 并写入一个 workspace + item。"""
    import tempfile, pathlib
    tmp = tempfile.mkdtemp()
    store = WorkspaceStore(root=pathlib.Path(tmp))
    rec = WorkspaceRecord(workspace_id="ws-1", name="测试工作空间")
    rec.items.append(item or _make_item())
    store.create(rec)
    return store


# ── build_prompt ────────────────────────────────────────────────


class TestBuildPrompt:
    def test_basic_prompt(self) -> None:
        item = _make_item()
        sys_p, usr_p = build_prompt(item, "concise")
        assert "简洁" in sys_p or "摘要" in sys_p
        assert "这是转写文本内容" in usr_p

    def test_background_prepended(self) -> None:
        item = _make_item()
        _, usr_p = build_prompt(item, "concise", background="这是背景信息")
        assert usr_p.startswith("【背景信息】")
        assert "这是背景信息" in usr_p
        assert "这是转写文本内容" in usr_p

    def test_empty_background_not_prepended(self) -> None:
        item = _make_item()
        _, usr_p = build_prompt(item, "concise", background="")
        assert not usr_p.startswith("【背景信息】")

    def test_fallback_to_summary_when_no_transcript(self) -> None:
        item = _make_item(results={"summary": "老总结内容"})
        _, usr_p = build_prompt(item, "concise")
        assert "老总结内容" in usr_p

    def test_all_template_ids(self) -> None:
        """9 个模板 id 都能构造 prompt 不报错。"""
        from backend.app.services.summary_templates import list_template_ids
        item = _make_item()
        for tid in list_template_ids():
            sys_p, usr_p = build_prompt(item, tid)
            assert sys_p  # 非空
            assert usr_p  # 非空


# ── generate_summary（mock LLM）────────────────────────────────


class TestGenerateSummary:
    @patch("backend.app.services.summary_generator._call_llm")
    def test_returns_item_summary(self, mock_llm: MagicMock) -> None:
        mock_llm.return_value = ("# 摘要\n\n这是生成的摘要", "openai/gpt-4o")
        item = _make_item()
        result = generate_summary(item, "concise", background="背景")

        assert isinstance(result, ItemSummary)
        assert result.template == "concise"
        assert result.content_md == "# 摘要\n\n这是生成的摘要"
        assert result.model_used == "openai/gpt-4o"
        assert result.background_for_summary == "背景"
        assert result.summary_id  # uuid 非空
        assert result.version == 0  # 默认 0，调用方负责覆盖

    @patch("backend.app.services.summary_generator._call_llm")
    def test_llm_called_with_correct_prompts(self, mock_llm: MagicMock) -> None:
        mock_llm.return_value = ("output", "model")
        item = _make_item()
        generate_summary(item, "detailed")

        call_args = mock_llm.call_args
        sys_p, usr_p = call_args[0]
        assert "要点" in sys_p or "分析师" in sys_p
        assert "转写文本" in usr_p


# ── workspace_store summary helpers ─────────────────────────────


class TestWorkspaceStoreSummaryHelpers:
    def test_get_item(self) -> None:
        store = _make_store_with_item()
        item = store.get_item("ws-1", "item-1")
        assert item.item_id == "item-1"

    def test_get_item_not_found(self) -> None:
        store = _make_store_with_item()
        with pytest.raises(KeyError, match="item not found"):
            store.get_item("ws-1", "nonexistent")

    def test_next_version_for_template_first(self) -> None:
        store = _make_store_with_item()
        ver = store.next_version_for_template("ws-1", "item-1", "concise")
        assert ver == 0  # 首版 = v0

    def test_next_version_for_template_increment(self) -> None:
        store = _make_store_with_item()
        s1 = ItemSummary(summary_id="s1", template="concise", version=0)
        store.add_item_summary("ws-1", "item-1", s1)
        ver = store.next_version_for_template("ws-1", "item-1", "concise")
        assert ver == 1

    def test_next_version_different_templates_independent(self) -> None:
        store = _make_store_with_item()
        s1 = ItemSummary(summary_id="s1", template="concise", version=0)
        store.add_item_summary("ws-1", "item-1", s1)
        ver = store.next_version_for_template("ws-1", "item-1", "detailed")
        assert ver == 0  # 不同 template 独立计数，首版 = v0

    def test_add_item_summary(self) -> None:
        store = _make_store_with_item()
        s = ItemSummary(summary_id="s1", template="concise", version=1, content_md="内容")
        result = store.add_item_summary("ws-1", "item-1", s)
        assert result.summary_id == "s1"

        # 验证落盘后能读到
        item = store.get_item("ws-1", "item-1")
        assert len(item.summaries) == 1
        assert item.summaries[0].content_md == "内容"

    def test_delete_item_summary(self) -> None:
        store = _make_store_with_item()
        s1 = ItemSummary(summary_id="s1", template="concise", version=1)
        s2 = ItemSummary(summary_id="s2", template="concise", version=2)
        store.add_item_summary("ws-1", "item-1", s1)
        store.add_item_summary("ws-1", "item-1", s2)

        assert store.delete_item_summary("ws-1", "item-1", "s1") is True
        item = store.get_item("ws-1", "item-1")
        assert len(item.summaries) == 1
        assert item.summaries[0].summary_id == "s2"

    def test_delete_item_summary_not_found(self) -> None:
        store = _make_store_with_item()
        assert store.delete_item_summary("ws-1", "item-1", "nonexistent") is False
