"""模板 CRUD（V3.2 + T3 文字模板扩展）。

/video-templates 保留向后兼容；/templates 为统一入口（支持 ?category= 过滤）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.app.services.pipeline_tasks import (
    _BUILTIN_TEMPLATE_PROMPTS,
    list_video_templates,
)
from shared.template_store import (
    VideoTemplate,
    create_template,
    delete_template,
    duplicate_template,
    load_templates,
    load_templates_by_category,
    save_templates,
    update_template,
)

router = APIRouter(prefix="/templates", tags=["templates"])

# 向后兼容：旧 /video-templates 路径
legacy_router = APIRouter(prefix="/video-templates", tags=["video-templates"])

BUILTIN_IDS: set[str] = {
    "builtin-教程", "builtin-Vlog", "builtin-访谈",
    "builtin-影视点评", "builtin-产品评测", "builtin-其它",
}

# ── 文字内置模板（T3.1）───────────────────────────────────
_TEXT_BUILTIN_PROMPTS: Dict[str, str] = {
    "摘要提炼": (
        "请对以下文本进行摘要提炼：\n"
        "1. 一句话核心摘要（30字以内）\n"
        "2. 3-5 个关键要点（bullet list）\n"
        "3. 如果有值得收藏的金句，单独列出"
    ),
    "深度解读": (
        "请对以下文本进行深度解读：\n"
        "1. 核心论点与隐含假设\n"
        "2. 论证逻辑链（前提→推导→结论）\n"
        "3. 与相关领域知识的关联\n"
        "4. 值得进一步思考的问题"
    ),
    "观点提炼": (
        "请提炼以下文本中的观点：\n"
        "1. 作者的主要立场\n"
        "2. 支撑论据列表\n"
        "3. 潜在的反对意见\n"
        "4. 观点的创新性评估"
    ),
    "行动建议": (
        "请基于以下文本给出行动建议：\n"
        "1. 可立即执行的行动项（具体步骤）\n"
        "2. 中期跟进事项\n"
        "3. 需要进一步调研的问题\n"
        "4. 风险提示"
    ),
    "改写润色": (
        "请对以下文本进行改写润色：\n"
        "1. 保持核心意思不变\n"
        "2. 优化语言表达（更清晰、更流畅）\n"
        "3. 调整结构（如需要）\n"
        "4. 输出改写后的完整文本"
    ),
}

_TEXT_BUILTIN_IDS: set[str] = {f"text-builtin-{name}" for name in _TEXT_BUILTIN_PROMPTS}


class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    prompt: str = Field(..., min_length=1, max_length=5000)
    category: str = Field(default="video", pattern="^(video|text)$")


class TemplateUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    prompt: str = Field(..., min_length=1, max_length=5000)


class DuplicateRequest(BaseModel):
    source_prompt: str = Field(..., min_length=1, max_length=5000)


def _strip_required(value: str, field_name: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise HTTPException(status_code=422, detail=f"{field_name}不能为空")
    return stripped


def _template_to_response(t: VideoTemplate) -> Dict[str, Any]:
    return {
        "template_id": t.template_id,
        "name": t.name,
        "prompt": t.prompt,
        "is_builtin": t.is_builtin,
        "category": t.category,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def _build_builtin_response(
    name: str, prompt: str, category: str = "video", builtin_id: str | None = None,
) -> Dict[str, Any]:
    return {
        "template_id": builtin_id or f"builtin-{name}",
        "name": name,
        "prompt": prompt,
        "is_builtin": True,
        "category": category,
        "created_at": "",
        "updated_at": "",
    }


@router.get("")
def get_all_templates(category: Optional[str] = Query(None, pattern="^(video|text)$")) -> List[Dict[str, Any]]:
    """返回模板列表。可选 ?category=video|text 过滤。"""
    if category == "text":
        builtins = [
            _build_builtin_response(name, prompt, "text", f"text-builtin-{name}")
            for name, prompt in _TEXT_BUILTIN_PROMPTS.items()
        ]
        customs = [_template_to_response(t) for t in load_templates_by_category("text")]
        return builtins + customs
    if category == "video":
        builtins = [
            _build_builtin_response(name, prompt, "video")
            for name, prompt in _BUILTIN_TEMPLATE_PROMPTS.items()
        ]
        customs = [_template_to_response(t) for t in load_templates_by_category("video")]
        return builtins + customs
    # 无 filter：返回全部（向后兼容）
    video_builtins = [
        _build_builtin_response(name, prompt, "video")
        for name, prompt in _BUILTIN_TEMPLATE_PROMPTS.items()
    ]
    text_builtins = [
        _build_builtin_response(name, prompt, "text", f"text-builtin-{name}")
        for name, prompt in _TEXT_BUILTIN_PROMPTS.items()
    ]
    customs = [_template_to_response(t) for t in load_templates()]
    return video_builtins + text_builtins + customs


# ── 向后兼容：旧 /video-templates 端点 ──────────────────────
@legacy_router.get("")
def legacy_get_all_templates() -> List[Dict[str, Any]]:
    """旧路径兼容：返回视频模板（向后不破坏已有消费者）。"""
    return get_all_templates(category="video")


ALL_BUILTIN_IDS = BUILTIN_IDS | _TEXT_BUILTIN_IDS
_ALL_BUILTIN_NAMES = set(_BUILTIN_TEMPLATE_PROMPTS.keys()) | set(_TEXT_BUILTIN_PROMPTS.keys())


@router.post("", status_code=201)
def create_new_template(body: TemplateCreateRequest) -> Dict[str, Any]:
    name = _strip_required(body.name, "模板名称")
    prompt = _strip_required(body.prompt, "模板 prompt")
    category = body.category

    # 不允许与内置或已有自定义模板同名（全局，不分 category）
    all_names = {t.name for t in load_templates()} | _ALL_BUILTIN_NAMES
    if name in all_names:
        raise HTTPException(status_code=409, detail=f"模板名称「{name}」已存在")

    t = create_template(name, prompt, category)
    return _template_to_response(t)


@router.put("/{template_id}")
def edit_template(template_id: str, body: TemplateUpdateRequest) -> Dict[str, Any]:
    if template_id in ALL_BUILTIN_IDS:
        raise HTTPException(status_code=403, detail="内置模板不可编辑")

    name = _strip_required(body.name, "模板名称")
    prompt = _strip_required(body.prompt, "模板 prompt")

    # 不允许改名成内置模板名
    if name in _ALL_BUILTIN_NAMES:
        raise HTTPException(status_code=409, detail=f"「{name}」是内置模板名，不可占用")

    # 不允许与其他自定义模板重名（排除自身）
    existing = load_templates()
    for other in existing:
        if other.template_id != template_id and other.name == name:
            raise HTTPException(status_code=409, detail=f"模板名称「{name}」已存在")

    t = update_template(template_id, name, prompt)
    if t is None:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_id}")
    return _template_to_response(t)


@router.delete("/{template_id}", status_code=204)
def remove_template(template_id: str) -> None:
    if template_id in ALL_BUILTIN_IDS:
        raise HTTPException(status_code=403, detail="内置模板不可删除")

    ok = delete_template(template_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_id}")


@router.post("/{template_id}/duplicate", status_code=201)
def copy_template(template_id: str, body: DuplicateRequest) -> Dict[str, Any]:
    """复制模板（内置或自定义均可），产出可编辑副本。"""
    source_prompt = _strip_required(body.source_prompt, "模板 prompt")

    # 内置模板复制（视频 or 文字）
    if template_id in ALL_BUILTIN_IDS:
        import uuid
        from datetime import datetime, timezone

        if template_id in _TEXT_BUILTIN_IDS:
            builtin_name = template_id.replace("text-builtin-", "")
            cat = "text"
        else:
            builtin_name = template_id.replace("builtin-", "")
            cat = "video"

        existing_names = {t.name for t in load_templates()}
        base = f"{builtin_name}（副本）"
        copy_name = base
        n = 1
        while copy_name in existing_names:
            copy_name = f"{base} {n}"
            n += 1

        now = datetime.now(timezone.utc).isoformat()
        t = VideoTemplate(
            template_id=uuid.uuid4().hex[:12],
            name=copy_name,
            prompt=source_prompt,
            is_builtin=False,
            category=cat,
            created_at=now,
            updated_at=now,
        )
        templates = load_templates()
        templates.append(t)
        save_templates(templates)
        return _template_to_response(t)

    t = duplicate_template(template_id, source_prompt)
    if t is None:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_id}")
    return _template_to_response(t)


# ── 向后兼容：旧 /video-templates POST/PUT/DELETE/duplicate ──
@legacy_router.post("", status_code=201)
def legacy_create(body: TemplateCreateRequest) -> Dict[str, Any]:
    return create_new_template(body)


@legacy_router.put("/{template_id}")
def legacy_edit(template_id: str, body: TemplateUpdateRequest) -> Dict[str, Any]:
    return edit_template(template_id, body)


@legacy_router.delete("/{template_id}", status_code=204)
def legacy_remove(template_id: str) -> None:
    remove_template(template_id)


@legacy_router.post("/{template_id}/duplicate", status_code=201)
def legacy_duplicate(template_id: str, body: DuplicateRequest) -> Dict[str, Any]:
    return copy_template(template_id, body)
