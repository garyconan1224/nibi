"""
页面1：视频下载器（项目隔离 + 后端任务驱动）。

下载任务由 FastAPI `POST /pipeline/tasks` 执行，日志可通过 SSE `/pipeline/tasks/{id}/events` 查看。
"""

from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import streamlit as st
from src.video_pipeline_studio.ui.session_keys import (
    DOWNLOAD_BACKEND_TASK_IDS_KEY,
    DOWNLOAD_TASKS_BY_PROJECT_KEY,
)

from shared.backend_client import (
    backend_health,
    cancel_pipeline_task,
    create_pipeline_task,
    delete_pipeline_task,
    get_pipeline_task,
    purge_pipeline_tasks,
)
from shared.backend_launcher import start_backend_once
from shared.config import get_backend_base_url, get_project_videos_dir
from shared.project_context import ensure_current_project, set_current_project
from shared.project_store import list_projects, make_project_id
from shared.video_download_ytdlp import cookie_base_dirs


def _is_valid_http_url(url: str) -> bool:
    u = (url or "").strip().lower()
    return u.startswith("http://") or u.startswith("https://")


def _init_state() -> None:
    if "dl_tasks_by_project" in st.session_state and DOWNLOAD_TASKS_BY_PROJECT_KEY not in st.session_state:
        st.session_state[DOWNLOAD_TASKS_BY_PROJECT_KEY] = st.session_state.pop("dl_tasks_by_project")
    if DOWNLOAD_TASKS_BY_PROJECT_KEY not in st.session_state:
        st.session_state[DOWNLOAD_TASKS_BY_PROJECT_KEY] = {}
    if DOWNLOAD_BACKEND_TASK_IDS_KEY not in st.session_state:
        st.session_state[DOWNLOAD_BACKEND_TASK_IDS_KEY] = {}


def _get_backend_ids(project_id: str) -> list[str]:
    raw = st.session_state.get(DOWNLOAD_BACKEND_TASK_IDS_KEY) or {}
    if not isinstance(raw, dict):
        return []
    ids = raw.get(project_id)
    if not isinstance(ids, list):
        return []
    ordered = [str(x) for x in ids if str(x).strip()]
    return list(dict.fromkeys(ordered))


def _append_backend_id(project_id: str, task_id: str) -> None:
    st.session_state.setdefault(DOWNLOAD_BACKEND_TASK_IDS_KEY, {})
    cur = st.session_state[DOWNLOAD_BACKEND_TASK_IDS_KEY].setdefault(project_id, [])
    if isinstance(cur, list) and task_id not in cur:
        cur.append(task_id)


def _canonical_url_for_group(url: str) -> str:
    """同一视频不同 query 顺序/大小写应归为同一下载分组。"""
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        p = urlparse(raw)
        scheme = (p.scheme or "https").lower()
        netloc = (p.netloc or "").lower()
        path = (p.path or "").rstrip("/")
        if not path:
            path = "/"
        pairs = parse_qsl(p.query, keep_blank_values=True)
        pairs.sort(key=lambda kv: kv[0])
        q = urlencode(pairs)
        return urlunparse((scheme, netloc, path, "", q, ""))
    except Exception:
        return raw.strip().lower()


def _bilibili_bv_group_key(url: str) -> str | None:
    """B 站同一稿件用 BV 归一，避免 www/m 站、query、尾斜杠导致拆成两组 UI。"""
    raw = (url or "").strip()
    if not raw or "bilibili.com" not in raw.lower():
        return None
    try:
        p = urlparse(raw)
        qs = dict(parse_qsl(p.query, keep_blank_values=True))
        bvid = str(qs.get("bvid") or "").strip()
        if bvid.upper().startswith("BV"):
            return f"bilibili:{bvid.upper()}"
        m = re.search(r"(BV[a-zA-Z0-9]+)", p.path or "", re.I)
        if m:
            return f"bilibili:{m.group(1).upper()}"
        m2 = re.search(r"(BV[a-zA-Z0-9]+)", raw, re.I)
        if m2:
            return f"bilibili:{m2.group(1).upper()}"
    except Exception:
        return None
    return None


def _download_group_key(task: dict[str, Any], task_id: str) -> str:
    payload = task.get("payload") or {}
    raw = str(payload.get("url") or "").strip()
    bv_key = _bilibili_bv_group_key(raw)
    if bv_key:
        return bv_key
    cu = _canonical_url_for_group(raw)
    return cu if cu else f"__notaskurl__{task_id}"


def _dedupe_session_ids_keep_latest_per_url(
    project_id: str,
    task_ids: list[str],
    *,
    base_url: str,
) -> list[str]:
    """按 URL 归组后，每个 URL 在会话列表中只保留 updated_at 最新的一条 task_id。"""
    rows: list[tuple[str, dict[str, Any]]] = []
    for tid in task_ids:
        try:
            t = get_pipeline_task(tid, base_url=base_url)
            rows.append((tid, t))
        except Exception:
            rows.append((tid, {}))

    groups: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for tid, task in rows:
        groups.setdefault(_download_group_key(task, tid), []).append((tid, task))

    def _ts(row: tuple[str, dict[str, Any]]) -> str:
        return str(row[1].get("updated_at") or row[1].get("created_at") or "")

    kept: list[str] = []
    for _gk, grows in groups.items():
        grows.sort(key=_ts, reverse=True)
        kept.append(grows[0][0])
    return kept


_init_state()
st.set_page_config(page_title="视频下载 — 视频流水线", page_icon="⬇️", layout="wide")
project = ensure_current_project()

st.title("⬇️ 视频下载器")
st.caption("任务由后端执行（任务驱动）。请先启动：`uvicorn backend.app.main:app --port 8010`。")

base_url = get_backend_base_url()
alive = backend_health(base_url)
st.sidebar.markdown(f"**后端地址** `{base_url}`")
st.sidebar.markdown("**健康检查**：" + ("✅ 可达" if alive else "❌ 不可达"))

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

current_label_default = next(
    (lbl for lbl, (pid, _name) in project_map.items() if pid == project.project_id),
    project_labels[0],
)
selected_label = st.selectbox("切换项目", options=project_labels, index=project_labels.index(current_label_default))
col_switch, col_new = st.columns([1, 1])
with col_switch:
    if st.button("切换为所选项目", use_container_width=True):
        pid, pname = project_map[selected_label]
        set_current_project(pid, pname)
        st.success(f"已切换到项目：{pname}")
        st.rerun()
with col_new:
    new_project_name = st.text_input("新建项目名", value="", placeholder="例如：618 手机投放")
    if st.button("新建并切换", use_container_width=True):
        project_name_value = (new_project_name or "").strip() or "未命名项目"
        new_project_id = make_project_id(project_name_value)
        set_current_project(new_project_id, project_name_value)
        st.success(f"已创建项目：{project_name_value}")
        st.rerun()

project = ensure_current_project()
project_video_dir = get_project_videos_dir(project.project_id)
project_video_dir.mkdir(parents=True, exist_ok=True)
cookie_dirs = cookie_base_dirs()
Path(cookie_dirs[0]).mkdir(parents=True, exist_ok=True)
cookie_base_hint = " / ".join(f"`{d}`" for d in cookie_dirs)

st.info(f"当前项目：`{project.project_name}` (`{project.project_id}`)")
st.metric("下载目录", str(project_video_dir))

with st.form("download_form"):
    st.subheader("添加下载任务")
    url = st.text_input("视频链接", placeholder="粘贴 YouTube 或 B站视频链接…")
    browser_proxy_col, token_col = st.columns(2)
    with browser_proxy_col:
        browser = st.selectbox("浏览器", ["chrome", "safari", "edge", "firefox"])
        proxy = st.text_input("代理（可选）", value="", placeholder="如 127.0.0.1:7890；不需要可留空")
    with token_col:
        po_token = st.text_input("PO Token（可选）", placeholder="YouTube 风控时使用")
        visitor_data = st.text_input("Visitor Data（可选）", placeholder="从 v1/player 载荷复制")
    submitted = st.form_submit_button("开始下载", type="primary", use_container_width=True)

st.caption(
    "B 站若提示「Unable to download webpage / HTTP 412」等：① 执行 `pip install -U yt-dlp` 升级到最新；"
    f"② 将浏览器导出的 `bilibili_cookies.txt` 放到以下任一目录：{cookie_base_hint}；"
    "③ 海外访问可填写代理，后端会在直连失败后再尝试走代理。"
)

def _has_active_task_for_url(submit_url: str, project_id: str, *, base_url: str) -> str | None:
    """检查当前项目是否已有同 URL 的 running/queued 任务，返回已有 task_id 或 None。"""
    submit_key = _download_group_key({"payload": {"url": submit_url}}, "")
    for tid in _get_backend_ids(project_id):
        try:
            t = get_pipeline_task(tid, base_url=base_url)
            if str(t.get("status") or "") not in ("queued", "running"):
                continue
            existing_key = _download_group_key(t, tid)
            if existing_key == submit_key:
                return tid
        except Exception:
            continue
    return None


if submitted:
    if not alive:
        st.error("后端不可用，请先在终端启动 FastAPI（见侧栏地址）。")
    elif not url.strip():
        st.error("请输入视频链接")
    elif not _is_valid_http_url(url.strip()):
        st.error("链接格式不正确，请粘贴完整 http/https 链接")
    else:
        # 防重复提交：检查是否已有同 URL 的活跃任务
        existing_tid = _has_active_task_for_url(url.strip(), project.project_id, base_url=base_url)
        if existing_tid:
            st.warning(f"该链接已有正在执行的下载任务 `{existing_tid}`，无需重复提交。")
        else:
            try:
                payload: dict[str, Any] = {
                    "url": url.strip(),
                    "browser": browser,
                    "proxy": proxy.strip(),
                    "po_token": po_token.strip(),
                    "visitor_data": visitor_data.strip(),
                    "format_selector": "best",
                    "cookie_base_dirs": cookie_dirs,
                }
                resp = create_pipeline_task(project.project_id, "download", payload, base_url=base_url)
                tid = str(resp.get("task_id") or "")
                if tid:
                    _append_backend_id(project.project_id, tid)
                st.success(f"已提交后端任务 `{tid}`，视频将保存到 `{project_video_dir}`")
                st.caption("实时日志：`GET /pipeline/tasks/{task_id}/events`（SSE）")
            except Exception as err:  # noqa: BLE001
                st.error(f"提交失败：{err}")

if not alive:
    if st.button("手动一键启动后端", use_container_width=True):
        with st.spinner("正在尝试启动后端..."):
            result = start_backend_once(base_url)
        if result.ok:
            st.success(result.message)
            st.rerun()
        else:
            st.error(result.message)

st.divider()
st.subheader("下载任务列表（后端任务）")
backend_ids = _get_backend_ids(project.project_id)

# ── 自动去重：每次页面加载时，如果后端可达且列表 >1，静默去重 ──
if alive and len(backend_ids) > 1:
    deduped = _dedupe_session_ids_keep_latest_per_url(
        project.project_id, backend_ids, base_url=base_url
    )
    if len(deduped) < len(backend_ids):
        st.session_state.setdefault(DOWNLOAD_BACKEND_TASK_IDS_KEY, {})
        st.session_state[DOWNLOAD_BACKEND_TASK_IDS_KEY][project.project_id] = deduped
        backend_ids = deduped

prune_col, dedupe_col, purge_col = st.columns(3)
with prune_col:
    if st.button("从列表移除已结束任务", key="dl_prune_finished", disabled=not backend_ids):
        kept: list[str] = []
        for tid in backend_ids:
            try:
                t = get_pipeline_task(tid, base_url=base_url)
                stt = str(t.get("status") or "")
                if stt in ("succeeded", "failed", "cancelled"):
                    continue
                kept.append(tid)
            except Exception:
                kept.append(tid)
        st.session_state.setdefault(DOWNLOAD_BACKEND_TASK_IDS_KEY, {})
        st.session_state[DOWNLOAD_BACKEND_TASK_IDS_KEY][project.project_id] = kept
        st.success("已移除已结束任务记录（后端记录仍保留）。")
        st.rerun()
with purge_col:
    if st.button(
        "清理后端冗余失败记录",
        key="dl_purge_failed",
        disabled=not alive,
        help="从后端持久化存储中删除因已知 bug（如 append_log）导致的失败任务记录",
    ):
        try:
            resp = purge_pipeline_tasks(project_id=project.project_id, base_url=base_url)
            n = resp.get("purged", 0)
            if n:
                st.success(f"已清理 {n} 条冗余失败记录。")
            else:
                st.info("未发现需清理的冗余记录。")
        except Exception as err:  # noqa: BLE001
            st.error(f"清理失败：{err}")
        st.rerun()
with dedupe_col:
    if st.button(
        "去重：每 URL 仅保留最新一条",
        key="dl_dedupe_urls",
        disabled=not backend_ids or not alive,
        help="按任务状态拉取后重写本地列表，同一链接只保留最近更新的 task_id",
    ):
        if not alive:
            st.error("后端不可用时无法去重。")
        else:
            new_ids = _dedupe_session_ids_keep_latest_per_url(project.project_id, backend_ids, base_url=base_url)
            st.session_state.setdefault(DOWNLOAD_BACKEND_TASK_IDS_KEY, {})
            st.session_state[DOWNLOAD_BACKEND_TASK_IDS_KEY][project.project_id] = new_ids
            st.success(f"已去重，保留 {len(new_ids)} 条任务 ID。")
            st.rerun()

if not backend_ids:
    st.info("当前项目暂无后端下载任务。提交后任务 ID 会出现在此列表。")
else:
    any_running = False
    task_rows: list[tuple[str, dict[str, Any]]] = []
    for task_id in backend_ids:
        try:
            task = get_pipeline_task(task_id, base_url=base_url)
            task_rows.append((task_id, task))
        except Exception as err:  # noqa: BLE001
            with st.container(border=True):
                st.markdown(f"**{task_id}**")
                st.warning(f"无法拉取任务状态：{err}")
            continue

    groups: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for tid, task in task_rows:
        gk = _download_group_key(task, tid)
        groups.setdefault(gk, []).append((tid, task))

    def _sort_key(row: tuple[str, dict[str, Any]]) -> str:
        return str(row[1].get("updated_at") or row[1].get("created_at") or "")

    for _gk, rows in groups.items():
        rows.sort(key=_sort_key, reverse=True)
        primary_id, primary = rows[0]
        rest = rows[1:]

        status = str(primary.get("status") or "")
        payload = primary.get("payload") or {}
        url_disp = str(payload.get("url") or primary_id)
        prog = float(primary.get("progress") or 0.0)
        err = str(primary.get("error") or "")
        result = primary.get("result") or {}

        if status in ("queued", "running"):
            any_running = True
        for _tid, tsk in rest:
            if str(tsk.get("status") or "") in ("queued", "running"):
                any_running = True

        with st.container(border=True):
            c1, c2 = st.columns([4, 1])
            with c1:
                st.markdown(f"**{url_disp}**")
                if len(rows) > 1:
                    st.caption(f"同链接共 {len(rows)} 条任务，主卡片为最近更新 · task_id: `{primary_id}` · {status}")
                else:
                    st.caption(f"task_id: `{primary_id}` · {status}")
                if rest:
                    with st.expander("同链接历史任务"):
                        for hid, ht in rest:
                            hst = str(ht.get("status") or "")
                            st.text(f"{hid} · {hst} · 更新于 {ht.get('updated_at', '')}")
                if primary.get("log"):
                    with st.expander("任务日志"):
                        for entry in primary.get("log") or []:
                            if isinstance(entry, dict):
                                st.text(f"{entry.get('ts', '')} [{entry.get('level', '')}] {entry.get('message', '')}")
                if status == "succeeded" and isinstance(result, dict):
                    st.success(f"完成：{result.get('file_name') or 'ok'}")
                elif status == "failed" and err:
                    st.error(err[:500])
            with c2:
                if st.button(
                    "取消",
                    key=f"cancel_dl_{primary_id}_{abs(hash(_gk))}",
                    disabled=status not in ("queued", "running"),
                ):
                    try:
                        cancel_pipeline_task(primary_id, base_url=base_url)
                        st.success("已请求取消")
                    except Exception as e:  # noqa: BLE001
                        st.error(str(e))
                    st.rerun()
            if status in ("queued", "running"):
                st.progress(min(1.0, max(0.0, prog)), text=f"{status} · {prog * 100:.0f}%")

    if any_running:
        time.sleep(0.45)
        st.rerun()

st.divider()
video_files = [
    f
    for f in project_video_dir.iterdir()
    if f.is_file() and f.suffix.lower() in {".mp4", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".webm"}
]
st.subheader(f"当前项目视频（{len(video_files)} 个）")
if video_files:
    for video_file in sorted(video_files):
        st.markdown(f"- `{video_file.name}` ({video_file.stat().st_size / 1024 / 1024:.1f} MB)")
else:
    st.info("当前项目还没有视频文件。")
