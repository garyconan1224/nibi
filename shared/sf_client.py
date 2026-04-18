"""
硅基流动统一 HTTP 客户端：Embedding、Rerank、Chat（含多模态）、视频帧分析。
整合自 AI 导演编剧工作台/siliconflow_client.py，并新增视频帧分析接口。
"""

from __future__ import annotations

import base64
import json
from typing import Any, Callable, Optional, Sequence

import requests
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from shared.config import embedding_char_limit_for_model, get_openai_compat_base_url


class SiliconFlowError(RuntimeError):
    """API 返回非预期状态或业务错误时抛出（通常不应重试）。"""


class SiliconFlowTransientError(RuntimeError):
    """限流或服务过载等可恢复错误，配合 tenacity 自动重试。"""


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


@retry(
    reraise=True,
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=45),
    retry=retry_if_exception_type(
        (
            requests.Timeout,
            requests.ConnectionError,
            SiliconFlowTransientError,
        )
    ),
)
def _post_json(
    api_key: str,
    path: str,
    payload: dict[str, Any],
    timeout: int = 120,
) -> dict[str, Any]:
    """统一 POST。网络类错误与 429/503/504 触发重试；401/400 等立即失败。"""
    url = f"{get_openai_compat_base_url().rstrip('/')}{path}"
    resp = requests.post(url, headers=_headers(api_key), json=payload, timeout=timeout)
    if resp.status_code in (429, 503, 504):
        raise SiliconFlowTransientError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except json.JSONDecodeError:
            detail = resp.text
        raise SiliconFlowError(f"HTTP {resp.status_code}: {detail}")
    return resp.json()


def _sanitize_embedding_text(text: str, max_chars: int) -> str:
    """去掉首尾空白，截断到安全长度；空串用占位符，避免 API 拒收。"""
    s = (text or "").strip()
    if not s:
        return "（空文档）"
    if len(s) > max_chars:
        return s[:max_chars] + "…"
    return s


def create_embeddings(
    api_key: str,
    model: str,
    inputs: Sequence[str],
    on_batch: Optional[Callable[[int, int], None]] = None,
) -> list[list[float]]:
    """
    调用 /v1/embeddings。单次最多 32 条，自动分批。
    每条按所选模型的字符上限截断。
    """
    cap = embedding_char_limit_for_model(model)
    sanitized = [_sanitize_embedding_text(t, cap) for t in inputs]
    if not sanitized:
        return []
    total_batches = (len(sanitized) + 31) // 32
    out: list[list[float]] = []
    batch: list[str] = []
    done_batches = 0
    for text in sanitized:
        batch.append(text)
        if len(batch) >= 32:
            out.extend(_embed_batch(api_key, model, batch))
            batch = []
            done_batches += 1
            if on_batch is not None:
                on_batch(done_batches, total_batches)
    if batch:
        out.extend(_embed_batch(api_key, model, batch))
        done_batches += 1
        if on_batch is not None:
            on_batch(done_batches, total_batches)
    return out


def _embed_batch(api_key: str, model: str, batch: list[str]) -> list[list[float]]:
    data = _post_json(
        api_key,
        "/embeddings",
        {"model": model, "input": batch},
        timeout=180,
    )
    items = data.get("data") or []
    items_sorted = sorted(items, key=lambda x: x.get("index", 0))
    return [row["embedding"] for row in items_sorted]


def rerank_documents(
    api_key: str,
    model: str,
    query: str,
    documents: Sequence[str],
    top_n: int,
) -> list[dict[str, Any]]:
    """调用 /v1/rerank，返回官方 results 列表（含 index 与 relevance_score）。"""
    if not documents:
        return []
    payload = {
        "model": model,
        "query": query,
        "documents": list(documents),
        "top_n": min(top_n, len(documents)),
        "return_documents": False,
    }
    data = _post_json(api_key, "/rerank", payload, timeout=120)
    return list(data.get("results") or [])


def chat_completion(
    api_key: str,
    model: str,
    messages: list[dict[str, Any]],
    temperature: float = 0.7,
    max_tokens: int = 8192,
) -> str:
    """OpenAI 兼容 /v1/chat/completions，返回 assistant 文本。"""
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    data = _post_json(api_key, "/chat/completions", payload, timeout=300)
    choices = data.get("choices") or []
    if not choices:
        raise SiliconFlowError(f"无 choices 字段: {data}")
    msg = choices[0].get("message") or {}
    content = msg.get("content")
    if not isinstance(content, str):
        raise SiliconFlowError(f"异常 message 结构: {msg}")
    return content


def build_vision_user_content(
    prompt_text: str,
    images: Sequence[tuple[bytes, str]],
) -> list[dict[str, Any]]:
    """
    构造多模态 user content：一段说明文字 + 多张 data URL 图片。
    images: (bytes, mime_type) 例如 image/jpeg
    """
    parts: list[dict[str, Any]] = [{"type": "text", "text": prompt_text}]
    for raw, mime in images:
        b64 = base64.standard_b64encode(raw).decode("ascii")
        url = f"data:{mime};base64,{b64}"
        parts.append({"type": "image_url", "image_url": {"url": url}})
    return parts


def analyze_product_images(
    api_key: str,
    model: str,
    images: Sequence[tuple[bytes, str]],
) -> str:
    """调用视觉大模型，输出材质、颜色、设计细节等中文报告。"""
    instruction = (
        "你是资深产品视觉分析师。请根据图片输出结构化中文报告，包含：\n"
        "1. 整体观感与设计风格\n"
        "2. 主色、辅色与材质质感\n"
        "3. 关键设计细节（镜头、纹理、LOGO、开孔、按键等）\n"
        "4. 适合在广告分镜中强调的 3~5 个视觉卖点\n"
        "要求：条理清晰，避免臆测不存在的信息；若看不清请写明「不确定」。"
    )
    content = build_vision_user_content(instruction, images)
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": "你擅长手机与消费电子产品的广告视觉拆解，输出用于导演与美术参考的专业描述。",
        },
        {"role": "user", "content": content},
    ]
    return chat_completion(api_key, model, messages, temperature=0.3, max_tokens=2048)


def analyze_video_frame(
    api_key: str,
    model: str,
    image_b64: str,
    video_title: str,
) -> dict[str, str]:
    """
    调用视觉大模型分析单帧图片（视频分析专用）。
    返回 {"description_zh": "...", "image_prompt_en": "..."}
    """
    prompt = (
        f"你是一位资深的视频导演和画面分析师。这张图片截取自名为《{video_title}》的视频。"
        "请深入分析这张图片，并在描述中使用该视频主题相关名称。\n\n"
        "必须严格按照以下 JSON 格式输出，不要有任何 markdown 代码块标记，不要有多余废话：\n"
        "{\n"
        '  "description_zh": "请从以下四个维度用中文展开详细描述，每个维度至少写2-3句话，总计不少于150字：'
        "1) 核心画面内容：主体是什么、外观细节、材质、颜色、设计特征等；"
        "2) 主体动作：是静态展示还是有动态元素、展示方式和姿态如何；"
        "3) 场景与环境：背景构成、氛围营造、有无其他元素、极简还是复杂；"
        '4) 镜头与视角：景别大小（特写/中景/全景）、拍摄角度、光影效果、构图特点。如果是纯黑或纯白无意义过渡帧，直接写「纯色过渡帧」即可。",\n'
        '  "image_prompt_en": "请写一段详细的、可用于 AI 文生图的英文提示词，要求分为以下四个段落，每段2-4句话：'
        "**Core Visual Content:** 详细描述画面中的主体及其视觉元素。"
        "**Subject Action:** 描述主体的动作或展示状态。"
        "**Scene and Environment:** 描述背景、场景设置和整体氛围。"
        '**Camera and Lens Perspective:** 描述拍摄角度、构图、景深、光影效果。如果是纯色过渡帧，则留空。"\n'
        "}"
    )
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "max_tokens": 2048,
        "temperature": 0.3,
    }
    data = _post_json(api_key, "/chat/completions", payload, timeout=120)
    choices = data.get("choices") or []
    if not choices:
        raise SiliconFlowError(f"无 choices 字段: {data}")
    raw = choices[0].get("message", {}).get("content", "").strip()

    import re
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            parsed = json.loads(match.group())
            if "description_zh" in parsed:
                return {
                    "description_zh": parsed.get("description_zh", ""),
                    "image_prompt_en": parsed.get("image_prompt_en", ""),
                }
        except json.JSONDecodeError:
            pass
    return {"description_zh": raw, "image_prompt_en": ""}


def generate_video_summary(
    api_key: str,
    model: str,
    video_title: str,
    frame_descriptions: str,
) -> str:
    """调用文本大模型，生成视频全局视觉总结。"""
    prompt = (
        f"我将提供视频《{video_title}》的逐帧画面描述流水账。请你作为专业导演，"
        "帮我写一份【全局视觉总结】（只关注画面，不涉及声音）。\n"
        "要求详细讲述：这个视频做了什么、怎么做的、展示了哪些核心内容、"
        "主要使用了哪些镜头语言（如特写、推拉摇移、转场方式），"
        f"是一个总结式的宏观讲述。字数在300-500字左右。\n\n以下是逐帧描述：\n\n{frame_descriptions}"
    )
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1024,
        "temperature": 0.5,
    }
    data = _post_json(api_key, "/chat/completions", payload, timeout=120)
    choices = data.get("choices") or []
    if not choices:
        raise SiliconFlowError(f"无 choices 字段: {data}")
    return choices[0].get("message", {}).get("content", "").strip()


def get_model_ids(api_key: str, sub_type: str) -> list[str]:
    """
    GET /v1/models?sub_type=chat|embedding|reranker
    返回当前 Key 在硅基流动可见的模型 id 列表。
    """
    k = (api_key or "").strip()
    if not k:
        return []
    url = f"{get_openai_compat_base_url().rstrip('/')}/models"
    resp = requests.get(
        url,
        headers=_headers(k),
        params={"sub_type": sub_type},
        timeout=45,
    )
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except json.JSONDecodeError:
            detail = resp.text
        raise SiliconFlowError(f"HTTP {resp.status_code}: {detail}")
    data = resp.json()
    out: list[str] = []
    for m in data.get("data") or []:
        if isinstance(m, dict) and m.get("id"):
            out.append(str(m["id"]))
    return sorted(set(out))


def explain_error(err: Exception) -> str:
    """将底层异常映射为面向用户的可读提示。"""
    msg = str(err)
    low = msg.lower()

    if "http 401" in low or "unauthorized" in low:
        return "鉴权失败（401）。请检查 API Key 是否正确、是否仍有效。"
    if "http 429" in low or "rate limit" in low:
        return "触发限流（429）。请稍后重试，或降低并发与请求频率。"
    if "http 503" in low or "http 504" in low:
        return "服务暂时不可用（503/504）。建议稍后重试。"
    if "20012" in low or ("model" in low and "not" in low and "exist" in low):
        return (
            "模型不可用（可能是 20012）。请在侧边栏重新同步模型列表，"
            "并选择当前账号已开通的模型。"
        )
    if "20015" in low:
        return "输入过长（20015）。请减少文本长度后重试。"
    if "20042" in low or "must less than 512 tokens" in low:
        return "嵌入输入超长（20042）。请改用长上下文嵌入模型，或缩短输入内容。"
    if isinstance(err, (requests.Timeout, requests.ConnectionError)):
        return "网络超时或连接失败。请检查网络后重试。"
    return f"{msg}。可尝试更换模型或稍后重试。"
