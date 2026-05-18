from __future__ import annotations

"""Workspace（工作空间）领域模型。

设计文档第 2 章「任务系统」：一个 workspace = 一个独立工作空间，
内含多个素材（视频/音频/图片/文字），共享一个数据库与 LLM 上下文。

与现有 backend.app.models.tasks.TaskRecord 的关系：
- TaskRecord 表示「一次具体执行」（下载、分析、转录），保持不变；
- WorkspaceItem.related_task_ids 把 TaskRecord 反向关联回素材；
- 一个 Workspace 内的多个素材可触发多次 TaskRecord，互不冲突。
"""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, FrozenSet, List, Optional


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class WorkspaceStatus(str, Enum):
    """工作空间状态。"""

    ACTIVE = "active"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ItemType(str, Enum):
    """素材类型——对应设计文档四大分支。"""

    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"
    TEXT = "text"


class ItemStatus(str, Enum):
    """素材处理状态。"""

    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


# 终结态集合（用于删除/查询过滤）。
TERMINAL_ITEM_STATUS: FrozenSet[str] = frozenset(
    {ItemStatus.DONE.value, ItemStatus.FAILED.value}
)


@dataclass
class PreflightConfig:
    """前置配置（设计文档第 4 章）。

    分三大区：
      1) background — 已抽到 WorkspaceBackground 单独管理，可在 item 维度覆盖
      2) models     — 视觉/文本/视频三类模型选择（值为 provider_id）
      3) tasks      — 本次要执行的分析项及其子参数（按 item.type 不同结构不同）

    所有字段都可选。未填字段在调用 LLM/pipeline 时跳过对应步骤。
    """

    background_overrides: Dict[str, Any] = field(default_factory=dict)
    models: Dict[str, str] = field(default_factory=dict)  # {vision: id, text: id, video: id}
    tasks: Dict[str, Any] = field(default_factory=dict)   # 与 item.type 关联的勾选 + 子参数

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PreflightConfig":
        if not isinstance(data, dict):
            return cls()
        return cls(
            background_overrides=dict(data.get("background_overrides") or {}),
            models=dict(data.get("models") or {}),
            tasks=dict(data.get("tasks") or {}),
        )


@dataclass
class PromptVersion:
    """提示词版本栈中的单个版本。"""

    version: int
    content: str
    created_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PromptVersion":
        return cls(
            version=int(data.get("version") or 1),
            content=str(data.get("content") or ""),
            created_at=str(data.get("created_at") or _now_iso()),
        )


@dataclass
class WorkspaceItem:
    """工作空间内单个素材。"""

    item_id: str
    type: str  # ItemType 字面量
    source: str  # "url" | "local"
    source_value: str  # URL 或本地路径
    name: str = ""  # 显示名（默认从 source 推导）
    status: str = ItemStatus.PENDING.value
    preflight: PreflightConfig = field(default_factory=PreflightConfig)
    results: Dict[str, Any] = field(default_factory=dict)
    related_task_ids: List[str] = field(default_factory=list)
    tags: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        # asdict 会把 preflight 自动展开成 dict，无需额外处理
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkspaceItem":
        return cls(
            item_id=str(data.get("item_id") or ""),
            type=str(data.get("type") or ItemType.VIDEO.value),
            source=str(data.get("source") or "local"),
            source_value=str(data.get("source_value") or ""),
            name=str(data.get("name") or ""),
            status=str(data.get("status") or ItemStatus.PENDING.value),
            preflight=PreflightConfig.from_dict(data.get("preflight") or {}),
            results=dict(data.get("results") or {}),
            related_task_ids=list(data.get("related_task_ids") or []),
            tags=dict(data.get("tags") or {}),
            created_at=str(data.get("created_at") or _now_iso()),
            updated_at=str(data.get("updated_at") or _now_iso()),
        )


@dataclass
class WorkspaceBackground:
    """前置配置「背景信息」（设计文档 4.2）。

    所有字段可选；未填字段在 LLM 注入时会被跳过。
    """

    content_type: str = ""  # 课程 / 会议 / 宣传片 / Vlog ...
    participants: List[str] = field(default_factory=list)
    topic: str = ""  # 主题背景
    glossary: List[str] = field(default_factory=list)  # 专有名词
    purpose: str = ""  # 复刻参考 / 竞品分析 / 内容学习 ...

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkspaceBackground":
        if not isinstance(data, dict):
            return cls()
        return cls(
            content_type=str(data.get("content_type") or ""),
            participants=list(data.get("participants") or []),
            topic=str(data.get("topic") or ""),
            glossary=list(data.get("glossary") or []),
            purpose=str(data.get("purpose") or ""),
        )


@dataclass
class WorkspaceRecord:
    """工作空间记录。"""

    workspace_id: str
    name: str
    project_id: str = ""  # 关联到现有 project；为空表示全局
    status: str = WorkspaceStatus.ACTIVE.value
    background: WorkspaceBackground = field(default_factory=WorkspaceBackground)
    items: List[WorkspaceItem] = field(default_factory=list)
    favorites: List[str] = field(default_factory=list)  # item_id 列表，复刻清单
    prompt_versions: Dict[str, List[PromptVersion]] = field(default_factory=dict)
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "workspace_id": self.workspace_id,
            "name": self.name,
            "project_id": self.project_id,
            "status": self.status,
            "background": self.background.to_dict(),
            "items": [it.to_dict() for it in self.items],
            "favorites": list(self.favorites),
            "prompt_versions": {
                k: [pv.to_dict() for pv in v]
                for k, v in self.prompt_versions.items()
            },
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkspaceRecord":
        items_raw = data.get("items") or []
        items: List[WorkspaceItem] = []
        for it in items_raw:
            if isinstance(it, dict):
                items.append(WorkspaceItem.from_dict(it))
        raw_pv = data.get("prompt_versions") or {}
        prompt_versions: Dict[str, List[PromptVersion]] = {}
        if isinstance(raw_pv, dict):
            for k, v in raw_pv.items():
                if isinstance(v, list):
                    prompt_versions[str(k)] = [
                        PromptVersion.from_dict(pv) for pv in v if isinstance(pv, dict)
                    ]
        return cls(
            workspace_id=str(data.get("workspace_id") or ""),
            name=str(data.get("name") or ""),
            project_id=str(data.get("project_id") or ""),
            status=str(data.get("status") or WorkspaceStatus.ACTIVE.value),
            background=WorkspaceBackground.from_dict(data.get("background") or {}),
            items=items,
            favorites=list(data.get("favorites") or []),
            prompt_versions=prompt_versions,
            created_at=str(data.get("created_at") or _now_iso()),
            updated_at=str(data.get("updated_at") or _now_iso()),
        )
