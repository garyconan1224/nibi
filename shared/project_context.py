"""
当前项目上下文管理。

职责：
- 在多页面间共享 current_project_id；
- 将当前项目 id 持久化到 .local/current_project.json；
- 提供项目选择/新建辅助方法。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import streamlit as st

from shared.config import ROOT_DIR, ensure_project_dirs
from shared.project_store import make_project_id

CURRENT_PROJECT_PATH: Path = ROOT_DIR / ".local" / "current_project.json"
DEFAULT_PROJECT_NAME: str = "默认项目"


@dataclass(frozen=True)
class CurrentProject:
    project_id: str
    project_name: str


def _read_saved_current_project() -> CurrentProject | None:
    if not CURRENT_PROJECT_PATH.is_file():
        return None
    try:
        data = json.loads(CURRENT_PROJECT_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    project_id = str(data.get("project_id") or "").strip()
    project_name = str(data.get("project_name") or "").strip() or DEFAULT_PROJECT_NAME
    if not project_id:
        return None
    return CurrentProject(project_id=project_id, project_name=project_name)


def _write_saved_current_project(project: CurrentProject) -> None:
    CURRENT_PROJECT_PATH.parent.mkdir(parents=True, exist_ok=True)
    CURRENT_PROJECT_PATH.write_text(
        json.dumps(
            {"project_id": project.project_id, "project_name": project.project_name},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def ensure_current_project() -> CurrentProject:
    if "current_project_id" in st.session_state and st.session_state.get("current_project_id"):
        project = CurrentProject(
            project_id=str(st.session_state["current_project_id"]),
            project_name=str(st.session_state.get("current_project_name") or DEFAULT_PROJECT_NAME),
        )
        ensure_project_dirs(project.project_id)
        return project

    saved = _read_saved_current_project()
    if saved is not None:
        st.session_state["current_project_id"] = saved.project_id
        st.session_state["current_project_name"] = saved.project_name
        ensure_project_dirs(saved.project_id)
        return saved

    default_id = make_project_id(DEFAULT_PROJECT_NAME)
    project = CurrentProject(project_id=default_id, project_name=DEFAULT_PROJECT_NAME)
    st.session_state["current_project_id"] = project.project_id
    st.session_state["current_project_name"] = project.project_name
    ensure_project_dirs(project.project_id)
    _write_saved_current_project(project)
    return project


def set_current_project(project_id: str, project_name: str) -> CurrentProject:
    project = CurrentProject(
        project_id=(project_id or "").strip(),
        project_name=(project_name or "").strip() or DEFAULT_PROJECT_NAME,
    )
    if not project.project_id:
        raise ValueError("project_id 不能为空")
    st.session_state["current_project_id"] = project.project_id
    st.session_state["current_project_name"] = project.project_name
    ensure_project_dirs(project.project_id)
    _write_saved_current_project(project)
    return project
