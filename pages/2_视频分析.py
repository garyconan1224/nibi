"""
页面2：视频分析（项目隔离 + 后端任务驱动）。

分析由 FastAPI `POST /pipeline/tasks`（task_type=analyze）执行。
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import streamlit as st
from src.vidmirror.ui.session_keys import ANALYZE_BACKEND_TASK_BY_PROJECT_KEY

ANALYSIS_EXPAND_FIRST_JSON_KEY = "_analysis_expand_first_json_basename"

from shared.backend_client import backend_health, cancel_pipeline_task, create_pipeline_task, get_pipeline_task
from shared.backend_launcher import start_backend_once
from shared.config import get_backend_base_url, get_project_json_dir, get_project_videos_dir
from shared.project_context import ensure_current_project, set_current_project
from shared.project_store import list_projects, make_project_id
from shared.runtime_llm_config import (
    get_openai_compat_api_key,
    get_text_model_for_analyzer,
    get_vision_model_for_analyzer,
)
from shared.settings_store import load_settings
from shared.video_analyzer import assign_safe_names, find_videos


def _analysis_result_paths(result: Any, project_json_dir: Path) -> list[Path]:
    """从任务 result 解析可读的 JSON 路径（优先 basename + 目录，避免绝对路径在客户端失效）。"""
    if not isinstance(result, dict):
        return []
    names = result.get("json_output_basenames")
    root = result.get("json_output_dir")
    if isinstance(names, list) and names and isinstance(root, str) and root.strip():
        base = Path(root.strip()).resolve()
        out: list[Path] = []
        for n in names:
            p = (base / str(n)).resolve()
            if p.is_file():
                out.append(p)
        if out:
            return sorted(out, key=lambda x: x.name)
    raw_list = result.get("json_outputs")
    if isinstance(raw_list, list):
        resolved: list[Path] = []
        for item in raw_list:
            p = Path(str(item)).expanduser()
            if p.is_file():
                resolved.append(p.resolve())
                continue
            name = Path(str(item)).name
            cand = (project_json_dir / name).resolve()
            if cand.is_file():
                resolved.append(cand)
        if resolved:
            return sorted(set(resolved), key=lambda x: x.name)
    if project_json_dir.is_dir():
        return sorted(project_json_dir.glob("*_视觉数据.json"))
    return []


def _render_visual_json_result(jf: Path) -> None:
    """读取 *_视觉数据.json 并结构化展示，提供下载按钮。"""
    with st.container(border=True):
        st.markdown(f"#### `{jf.name}`")
        try:
            raw = jf.read_text(encoding="utf-8", errors="replace")
            data = json.loads(raw)
        except (OSError, json.JSONDecodeError) as err:
            st.warning(f"无法读取或解析文件：{err}")
            return
        if not isinstance(data, dict):
            st.json(data)
            return
        title = str(data.get("video_title") or "")
        product = str(data.get("product_name") or "")
        summary = str(data.get("global_visual_summary") or "")
        c1, c2 = st.columns([2, 1])
        with c1:
            if title:
                st.markdown(f"**视频标题**：{title}")
            if product:
                st.markdown(f"**识别商品名**：{product}")
            if summary:
                st.markdown("**全局视觉总结**")
                st.markdown(summary[:8000] + ("…" if len(summary) > 8000 else ""))
        with c2:
            st.download_button(
                "下载 JSON",
                data=raw.encode("utf-8"),
                file_name=jf.name,
                mime="application/json",
                key=f"dl_json_{jf.name}_{id(jf)}",
                use_container_width=True,
            )
            stem = jf.stem
            md_name = stem.replace("_视觉数据", "") + "_图文分镜.md" if "_视觉数据" in stem else stem + "_图文分镜.md"
            md_sibling = jf.with_name(md_name)
            if md_sibling.is_file():
                st.download_button(
                    "下载 Markdown",
                    data=md_sibling.read_bytes(),
                    file_name=md_sibling.name,
                    mime="text/markdown",
                    key=f"dl_md_{jf.name}_{id(md_sibling)}",
                    use_container_width=True,
                )
        frames = data.get("frames")
        if isinstance(frames, list) and frames:
            rows: list[dict[str, Any]] = []
            for fr in frames:
                if not isinstance(fr, dict):
                    continue
                desc = str(fr.get("description_zh") or "")
                if len(desc) > 200:
                    desc = desc[:200] + "…"
                rows.append(
                    {
                        "时间戳": fr.get("timestamp", ""),
                        "画面描述": desc,
                        "生图 Prompt": (str(fr.get("image_prompt_en") or ""))[:120],
                    }
                )
            st.markdown("**关键帧表（摘要）**")
            st.dataframe(rows, use_container_width=True, hide_index=True)
        with st.expander("查看完整 JSON", expanded=False):
            st.json(data)


def _init_state() -> None:
    if ANALYZE_BACKEND_TASK_BY_PROJECT_KEY not in st.session_state:
        st.session_state[ANALYZE_BACKEND_TASK_BY_PROJECT_KEY] = {}


def _get_analyze_task_id(project_id: str) -> str:
    raw = st.session_state.get(ANALYZE_BACKEND_TASK_BY_PROJECT_KEY) or {}
    if not isinstance(raw, dict):
        return ""
    return str(raw.get(project_id) or "").strip()


def _set_analyze_task_id(project_id: str, task_id: str) -> None:
    st.session_state.setdefault(ANALYZE_BACKEND_TASK_BY_PROJECT_KEY, {})
    st.session_state[ANALYZE_BACKEND_TASK_BY_PROJECT_KEY][project_id] = task_id


def _clear_analyze_task_id(project_id: str) -> None:
    raw = st.session_state.get(ANALYZE_BACKEND_TASK_BY_PROJECT_KEY)
    if isinstance(raw, dict) and project_id in raw:
        del raw[project_id]


st.set_page_config(page_title="视频分析 — 视频流水线", page_icon="🎞️", layout="wide")
_init_state()
project = ensure_current_project()
settings = load_settings()
base_url = get_backend_base_url()
alive = backend_health(base_url)

st.title("🎞️ 视频画面深度分析")
st.caption("当前项目隔离；分析任务由后端执行。请先启动：`uvicorn backend.app.main:app --port 8010`。")

st.sidebar.caption(f"后端 `{base_url}` · {'可达' if alive else '不可达'}")

st.subheader("当前项目")
meta_projects = list_projects()
project_labels: list[str] = []
project_map: dict[str, tuple[str, str]] = {}
for project_meta in meta_projects:
    label = f"{project_meta.project_name} | {project_meta.project_id}"
    project_labels.append(label)
    project_map[label] = (project_meta.project_id, project_meta.project_name)

if not project_labels:
    project_labels = [f"{project.project_name} | {project.project_id}"]
    project_map[project_labels[0]] = (project.project_id, project.project_name)

default_label = next(
    (label for label, (pid, _name) in project_map.items() if pid == project.project_id),
    project_labels[0],
)
selected_project_label = st.selectbox("切换项目", options=project_labels, index=project_labels.index(default_label))
switch_col, create_col = st.columns([1, 1])
with switch_col:
    if st.button("切换为所选项目", use_container_width=True):
        project_id, project_name = project_map[selected_project_label]
        set_current_project(project_id, project_name)
        st.rerun()
with create_col:
    new_name = st.text_input("新建项目名", value="", placeholder="例如：新品开箱拆解")
    if st.button("新建并切换", use_container_width=True):
        project_name = (new_name or "").strip() or "未命名项目"
        project_id = make_project_id(project_name)
        set_current_project(project_id, project_name)
        st.rerun()

project = ensure_current_project()
project_videos_dir = get_project_videos_dir(project.project_id)
project_json_dir = get_project_json_dir(project.project_id)
project_videos_dir.mkdir(parents=True, exist_ok=True)
project_json_dir.mkdir(parents=True, exist_ok=True)

poll_tid = _get_analyze_task_id(project.project_id)
if poll_tid and not alive:
    st.warning("后端不可达，无法刷新分析任务状态；请启动 FastAPI 后刷新页面。")
elif poll_tid and alive:
    try:
        task: dict[str, Any] = get_pipeline_task(poll_tid, base_url=base_url)
    except Exception as err:  # noqa: BLE001
        st.error(f"拉取任务失败：{err}")
        _clear_analyze_task_id(project.project_id)
    else:
        st.subheader("后端分析任务")
        status = str(task.get("status") or "")
        prog = float(task.get("progress") or 0.0)
        st.progress(min(1.0, max(0.0, prog)), text=f"{status} · {int(prog * 100)}%")
        res = task.get("result") or {}
        live = res.get("live_preview") if isinstance(res, dict) else None
        if isinstance(live, dict) and status in ("queued", "running"):
            snaps = live.get("snapshots") or []
            if isinstance(snaps, list) and snaps:
                st.markdown("**各视频进度概览**")
                snap_cols = st.columns(min(len(snaps), 4))
                for i, s in enumerate(snaps[:4]):
                    if not isinstance(s, dict):
                        continue
                    with snap_cols[i % len(snap_cols)]:
                        nm = str(s.get("video_name") or "")[:20]
                        pct = float(s.get("percent") or 0)
                        stt = str(s.get("status") or "")
                        st.metric(f"{nm or '—'} · {stt}"[:48], f"{pct:.0f}%")
            recent = live.get("recent_frames") or []
            if isinstance(recent, list) and recent:
                st.markdown("**实时帧分析（JSON 片段）**")
                for fr in recent[-4:]:
                    if isinstance(fr, dict) and fr.get("frame_json"):
                        st.json(fr["frame_json"])
                st.markdown("**最近关键帧预览**")
                tail = [f for f in recent[-4:] if isinstance(f, dict)]
                for fr in tail:
                    p = str(fr.get("frame_image_path") or "")
                    if p and Path(p).is_file():
                        st.image(p, width=320)
            recent_ok = isinstance(recent, list) and recent
            snaps_ok = isinstance(snaps, list) and snaps
            if not recent_ok and not snaps_ok:
                st.info("正在准备抽帧与首帧分析，进度与各视频状态将随后显示。")
        if status == "succeeded":
            st.success("✅ 分析已完成！以下为结构化分析结果：")
            out_paths = _analysis_result_paths(task.get("result"), project_json_dir)
            if out_paths:
                st.markdown(f"**本次产出 {len(out_paths)} 个分析文件**")
                for jf in out_paths:
                    _render_visual_json_result(jf)
                st.session_state[ANALYSIS_EXPAND_FIRST_JSON_KEY] = out_paths[0].name
            else:
                st.warning("未在任务结果中解析到 JSON 路径，仍可在下方按目录扫描查看。")
            _clear_analyze_task_id(project.project_id)
        elif status in ("failed", "cancelled"):
            st.error(str(task.get("error") or status))
            _clear_analyze_task_id(project.project_id)
        else:
            st.caption("约每 0.45 秒自动刷新进度。")
            time.sleep(0.45)
            st.rerun()
        # 技术日志始终放在最后，已完成时默认折叠
        logs = task.get("log") or []
        if logs:
            log_expanded = status not in ("succeeded",)
            with st.expander("技术执行日志（排障用）", expanded=log_expanded):
                for entry in logs:
                    if isinstance(entry, dict):
                        st.text(f"{entry.get('message', '')}")

st.info(
    f"当前项目：`{project.project_name}` (`{project.project_id}`)\n\n"
    f"输入目录：`{project_videos_dir}`\n\n输出目录：`{project_json_dir}`"
)

api_key = get_openai_compat_api_key(settings)
vision_model = get_vision_model_for_analyzer(settings)
text_model = get_text_model_for_analyzer(settings)

videos_in_dir = find_videos(project_videos_dir) if project_videos_dir.exists() else []
assign_safe_names(videos_in_dir)

busy = bool(_get_analyze_task_id(project.project_id)) and alive

col_left, col_right = st.columns([1, 1])
with col_left:
    st.subheader("📁 待分析视频（当前项目）")
    if not videos_in_dir:
        st.info("当前项目没有视频。请先到「视频下载」页下载，或手动放入项目 videos 目录。")
        selected_videos: list = []
    else:
        selected_videos = []
        for video_path in videos_in_dir:
            checked = st.checkbox(
                f"{video_path.name} ({video_path.stat().st_size / 1024 / 1024:.1f} MB)",
                value=True,
                key=f"analyze_{project.project_id}_{video_path.name}",
            )
            if checked:
                selected_videos.append(video_path)
        st.caption(f"已选择 {len(selected_videos)} 个视频")

with col_right:
    st.subheader("🚀 分析控制")
    if not alive:
        st.warning("后端不可用，无法提交分析任务。")
        if st.button("手动一键启动后端", use_container_width=True):
            with st.spinner("正在尝试启动后端..."):
                launch_result = start_backend_once(base_url)
            if launch_result.ok:
                st.success(launch_result.message)
                st.rerun()
            else:
                st.error(launch_result.message)
    if not api_key:
        st.warning("请先在「系统设置」页配置至少一个启用的 OpenAI 兼容 Provider（含 API Key），或配置环境变量。")

    start_btn = st.button(
        "开始分析（后端任务）",
        type="primary",
        use_container_width=True,
        disabled=busy or not api_key or not videos_in_dir or not alive,
    )
    if start_btn and selected_videos:
        try:
            payload = {
                "api_key": api_key.strip(),
                "vision_model": vision_model.strip(),
                "text_model": text_model.strip(),
                "video_basenames": [v.name for v in selected_videos],
            }
            resp = create_pipeline_task(project.project_id, "analyze", payload, base_url=base_url)
            tid = str(resp.get("task_id") or "")
            if tid:
                _set_analyze_task_id(project.project_id, tid)
            st.success(f"已提交后端任务 `{tid}`")
            st.rerun()
        except Exception as err:  # noqa: BLE001
            st.error(f"提交失败：{err}")
    elif start_btn:
        st.warning("请先勾选至少一个视频。")

    cur_tid = _get_analyze_task_id(project.project_id)
    if cur_tid and alive:
        if st.button("取消当前分析任务", use_container_width=True):
            try:
                cancel_pipeline_task(cur_tid, base_url=base_url)
                _clear_analyze_task_id(project.project_id)
                st.success("已请求取消")
            except Exception as err:  # noqa: BLE001
                st.error(str(err))
            st.rerun()

st.divider()
st.subheader("📊 当前项目 JSON 结果")
json_files = sorted(project_json_dir.glob("*_视觉数据.json")) if project_json_dir.exists() else []
expand_first = str(st.session_state.pop(ANALYSIS_EXPAND_FIRST_JSON_KEY, "") or "")
if json_files:
    st.caption(
        f"数据目录（与后端 `json_output_dir` + 文件名一致）：`{project_json_dir.resolve()}`。"
        " 请展开各行预览；无需在浏览器中打开本地 file:// 链接。"
    )
    for jf in json_files:
        auto_open = expand_first == jf.name
        with st.expander(f"{jf.name} · {jf.stat().st_size / 1024:.1f} KB", expanded=auto_open):
            _render_visual_json_result(jf)
else:
    st.info("当前项目还没有 JSON 结果。")
