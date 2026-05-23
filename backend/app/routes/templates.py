"""视频模板 CRUD（V3.2）。"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
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
    save_templates,
    update_template,
)

router = APIRouter(prefix="/video-templates", tags=["video-templates"])

BUILTIN_IDS: set[str] = {
    "builtin-教程", "builtin-Vlog", "builtin-访谈",
    "builtin-影视点评", "builtin-产品评测", "builtin-其它",
}


class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    prompt: str = Field(..., min_length=1, max_length=5000)


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
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def _build_builtin_response(name: str, prompt: str) -> Dict[str, Any]:
    return {
        "template_id": f"builtin-{name}",
        "name": name,
        "prompt": prompt,
        "is_builtin": True,
        "created_at": "",
        "updated_at": "",
    }


@router.get("")
def get_all_templates() -> List[Dict[str, Any]]:
    """返回全部模板（内置 6 类 + 用户自定义），自定义在后。"""
    builtins = [
        _build_builtin_response(name, prompt)
        for name, prompt in _BUILTIN_TEMPLATE_PROMPTS.items()
    ]
    customs = [_template_to_response(t) for t in load_templates()]
    return builtins + customs


@router.post("", status_code=201)
def create_new_template(body: TemplateCreateRequest) -> Dict[str, Any]:
    name = _strip_required(body.name, "模板名称")
    prompt = _strip_required(body.prompt, "模板 prompt")

    # 不允许与内置或已有自定义模板同名
    all_names = {t.name for t in load_templates()} | set(_BUILTIN_TEMPLATE_PROMPTS.keys())
    if name in all_names:
        raise HTTPException(status_code=409, detail=f"模板名称「{name}」已存在")

    t = create_template(name, prompt)
    return _template_to_response(t)


@router.put("/{template_id}")
def edit_template(template_id: str, body: TemplateUpdateRequest) -> Dict[str, Any]:
    if template_id in BUILTIN_IDS:
        raise HTTPException(status_code=403, detail="内置模板不可编辑")

    name = _strip_required(body.name, "模板名称")
    prompt = _strip_required(body.prompt, "模板 prompt")

    # 不允许改名成内置模板名
    if name in _BUILTIN_TEMPLATE_PROMPTS:
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
    if template_id in BUILTIN_IDS:
        raise HTTPException(status_code=403, detail="内置模板不可删除")

    ok = delete_template(template_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_id}")


@router.post("/{template_id}/duplicate", status_code=201)
def copy_template(template_id: str, body: DuplicateRequest) -> Dict[str, Any]:
    """复制模板（内置或自定义均可），产出可编辑副本。"""
    source_prompt = _strip_required(body.source_prompt, "模板 prompt")
    if template_id in BUILTIN_IDS:
        import uuid
        from datetime import datetime, timezone

        builtin_name = template_id.replace("builtin-", "")

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
