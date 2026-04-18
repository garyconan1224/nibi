"""Phase 2.3.a — 创作视图（从 pages/3_AI导演编剧工作台.py 正文搬运）。

- 已去除：st.set_page_config、页面级项目切换器（subheader "当前项目" + selectbox + 切换/新建按钮）
- 已去除：st.sidebar.caption（后端地址提示）
- 保留：全部辅助函数（_init_session / _build_project_payload / _log_pipeline_event 等）
- 签名：render_create_view(project_id: str) -> None
"""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import streamlit as st

from shared.backend_client import backend_health, create_pipeline_task, get_pipeline_task
from shared.backend_launcher import start_backend_once
from shared.config import (
    TEXT_BACKEND_ANTHROPIC,
    TEXT_BACKEND_OPENAI_COMPAT,
    get_backend_base_url,
    get_project_json_dir,
    get_project_runtime_dir,
)
from shared.export_utils import build_export_markdown
from shared.knowledge_base import load_folder_as_knowledge
from shared.project_context import ensure_current_project
from shared.project_store import list_projects, load_project, save_project
from shared.runtime_llm_config import (
    get_anthropic_api_key,
    get_anthropic_model_for_storyboard,
    get_embedding_model_for_rag,
    get_openai_chat_model,
    get_openai_compat_api_key,
    get_vision_model_for_storyboard,
)
from shared.settings_store import load_settings
from shared.web_enrich import enrich_product
from src.vidmirror.ui.session_keys import (
    CREATOR_KNOWLEDGE_KEY,
    CREATOR_PLAN_A_KEY,
    CREATOR_PLAN_B_KEY,
    CREATOR_PLAN_C_KEY,
    CREATOR_PROJECT_CREATED_AT_KEY,
    CREATOR_PROJECT_NAME_KEY,
    CREATOR_SAVED_PROJECT_ID_KEY,
    CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY,
    CREATOR_VISION_REPORT_KEY,
    CREATOR_WEB_CONTEXT_USED_KEY,
    CREATOR_WEB_ENRICHMENT_IMAGES_KEY,
    CREATOR_WEB_ENRICHMENT_MD_KEY,
)


def _init_session() -> None:
    migration_pairs = (
        ("knowledge", CREATOR_KNOWLEDGE_KEY),
        ("project_id", CREATOR_SAVED_PROJECT_ID_KEY),
        ("project_created_at", CREATOR_PROJECT_CREATED_AT_KEY),
        ("web_enrichment_md", CREATOR_WEB_ENRICHMENT_MD_KEY),
        ("web_enrichment_images", CREATOR_WEB_ENRICHMENT_IMAGES_KEY),
        ("vision_report", CREATOR_VISION_REPORT_KEY),
        ("web_context_used", CREATOR_WEB_CONTEXT_USED_KEY),
        ("plan_a", CREATOR_PLAN_A_KEY),
        ("plan_b", CREATOR_PLAN_B_KEY),
        ("plan_c", CREATOR_PLAN_C_KEY),
        ("project_name_input", CREATOR_PROJECT_NAME_KEY),
    )
    for old_key, new_key in migration_pairs:
        if old_key in st.session_state and new_key not in st.session_state:
            st.session_state[new_key] = st.session_state.pop(old_key)

    if CREATOR_KNOWLEDGE_KEY not in st.session_state:
        st.session_state[CREATOR_KNOWLEDGE_KEY] = None
    if CREATOR_SAVED_PROJECT_ID_KEY not in st.session_state:
        st.session_state[CREATOR_SAVED_PROJECT_ID_KEY] = ""
    if CREATOR_PROJECT_CREATED_AT_KEY not in st.session_state:
        st.session_state[CREATOR_PROJECT_CREATED_AT_KEY] = ""
    if CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY not in st.session_state:
        st.session_state[CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY] = {}


def _get_storyboard_task_id(project_id: str) -> str:
    raw = st.session_state.get(CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY) or {}
    if not isinstance(raw, dict):
        return ""
    return str(raw.get(project_id) or "").strip()


def _set_storyboard_task_id(project_id: str, task_id: str) -> None:
    st.session_state.setdefault(CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY, {})
    st.session_state[CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY][project_id] = task_id


def _clear_storyboard_task_id(project_id: str) -> None:
    raw = st.session_state.get(CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY)
    if isinstance(raw, dict) and project_id in raw:
        del raw[project_id]


def _now_local_str() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")


def _log_pipeline_event(run_log_path: Path, step: str, status: str, elapsed_ms: int, details: dict[str, Any] | None = None) -> None:
    rec = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "step": step,
        "status": status,
        "elapsed_ms": elapsed_ms,
        "details": details or {},
    }
    run_log_path.parent.mkdir(parents=True, exist_ok=True)
    with run_log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _build_project_payload(
    *,
    project_name: str,
    product_name: str,
    core_features: str,
    data_dir: str,
    embedding_model: str,
    text_model: str,
    vision_model: str,
    text_backend: str,
    anthropic_model: str,
) -> dict[str, Any]:
    return {
        "project_name": project_name.strip() or "未命名项目",
        "product_name": product_name.strip(),
        "core_features": core_features.strip(),
        "created_at": st.session_state.get(CREATOR_PROJECT_CREATED_AT_KEY) or datetime.now(timezone.utc).isoformat(),
        "generated_at": _now_local_str(),
        "data_dir": data_dir,
        "web_enrichment_md": st.session_state.get(CREATOR_WEB_ENRICHMENT_MD_KEY) or "",
        "vision_report": st.session_state.get(CREATOR_VISION_REPORT_KEY) or "",
        "web_context_used": st.session_state.get(CREATOR_WEB_CONTEXT_USED_KEY) or "",
        "models": {
            "embedding_model": embedding_model,
            "text_model": text_model,
            "vision_model": vision_model,
            "text_backend": text_backend,
            "anthropic_model": anthropic_model,
        },
        "plans": {
            "plan_a": st.session_state.get(CREATOR_PLAN_A_KEY) or "",
            "plan_b": st.session_state.get(CREATOR_PLAN_B_KEY) or "",
            "plan_c": st.session_state.get(CREATOR_PLAN_C_KEY) or "",
        },
    }


def render_create_view(project_id: str) -> None:
    """创作视图：从 pages/3_AI导演编剧工作台.py 搬运而来，去除 set_page_config / 项目切换器 / sidebar 提示。"""
    _ = project_id  # 保留参数位；内部以 ensure_current_project() 为准，与原页面行为一致
    _init_session()
    project = ensure_current_project()
    settings = load_settings()

    st.title("🎬 AI 导演编剧工作台")
    st.caption("知识库、分镜生成与运行日志均绑定到当前项目目录。")

    project = ensure_current_project()
    project_json_dir = get_project_json_dir(project.project_id)
    project_runtime_dir = get_project_runtime_dir(project.project_id)
    project_json_dir.mkdir(parents=True, exist_ok=True)
    project_runtime_dir.mkdir(parents=True, exist_ok=True)
    run_log_path = project_runtime_dir / "runtime.log"

    base_url = get_backend_base_url()
    alive = backend_health(base_url)
    sb_tid = _get_storyboard_task_id(project.project_id)
    if sb_tid and not alive:
        st.warning("后端不可达，无法刷新分镜任务；请启动 FastAPI 后刷新页面。")
        if st.button("手动一键启动后端", key="creator_start_backend_task_poll", use_container_width=True):
            with st.spinner("正在尝试启动后端..."):
                launch_result = start_backend_once(base_url)
            if launch_result.ok:
                st.success(launch_result.message)
                st.rerun()
            else:
                st.error(launch_result.message)
    elif sb_tid and alive:
        try:
            sb_task: dict[str, Any] = get_pipeline_task(sb_tid, base_url=base_url)
        except Exception as err:  # noqa: BLE001
            st.error(f"拉取分镜任务失败：{err}")
            _clear_storyboard_task_id(project.project_id)
        else:
            st.subheader("后端分镜任务")
            sb_status = str(sb_task.get("status") or "")
            sb_prog = float(sb_task.get("progress") or 0.0)
            st.progress(min(1.0, max(0.0, sb_prog)), text=f"{sb_status} · {int(sb_prog * 100)}%")
            sb_logs = sb_task.get("log") or []
            if sb_logs:
                with st.expander("任务日志", expanded=True):
                    for entry in sb_logs:
                        if isinstance(entry, dict):
                            st.text(str(entry.get("message") or ""))
            if sb_status == "succeeded":
                result = sb_task.get("result") or {}
                st.session_state[CREATOR_PLAN_A_KEY] = result.get("plan_a") or ""
                st.session_state[CREATOR_PLAN_B_KEY] = result.get("plan_b") or ""
                st.session_state[CREATOR_PLAN_C_KEY] = result.get("plan_c") or ""
                st.session_state[CREATOR_VISION_REPORT_KEY] = result.get("vision_report") or ""
                st.session_state[CREATOR_WEB_CONTEXT_USED_KEY] = result.get("web_context_used") or ""
                st.success("分镜生成完成")
                _log_pipeline_event(run_log_path, "storyboard_backend", "ok", 0, {"task_id": sb_tid})
                _clear_storyboard_task_id(project.project_id)
            elif sb_status in ("failed", "cancelled"):
                st.error(str(sb_task.get("error") or sb_status))
                _clear_storyboard_task_id(project.project_id)
            else:
                time.sleep(0.45)
                st.rerun()

    st.info(
        f"当前项目：`{project.project_name}` (`{project.project_id}`)\n\n"
        f"知识库目录：`{project_json_dir}`\n\n日志目录：`{run_log_path}`\n\n"
        f"后端：`{base_url}` — {'✅ 可达' if alive else '❌ 不可达'} · 分镜由 `POST /pipeline/tasks`（storyboard）执行"
    )

    api_key = get_openai_compat_api_key(settings)
    anthropic_key = get_anthropic_api_key(settings)
    text_backend = (settings.text_backend or TEXT_BACKEND_OPENAI_COMPAT).strip()
    embedding_model = get_embedding_model_for_rag(settings)
    vision_model = get_vision_model_for_storyboard(settings)
    if text_backend == TEXT_BACKEND_OPENAI_COMPAT:
        text_model = get_openai_chat_model(settings)
        anthropic_model = ""
    else:
        anthropic_model = get_anthropic_model_for_storyboard(settings)
        text_model = anthropic_model

    project_name = st.session_state.get(CREATOR_PROJECT_NAME_KEY) or project.project_name
    project_input_col, generation_control_col = st.columns([1, 1])

    with project_input_col:
        st.subheader("项目信息")
        project_name = st.text_input("项目名称", key=CREATOR_PROJECT_NAME_KEY, value=project.project_name)
        product_name = st.text_input("产品名称", key="creator_product_name", placeholder="例如：极光 X1 Pro")
        core_features = st.text_area("核心卖点", key="creator_core_features", placeholder="例如：2亿像素, 钛合金中框")
        uploads = st.file_uploader("参考图（可选）", type=["png", "jpg", "jpeg", "webp"], accept_multiple_files=True)

        st.subheader("联网补全（可选）")
        web_hint = st.text_input("检索关键词", key="creator_web_hint", placeholder="例如：国行售价 评测")
        if st.button("🔎 联网检索并缓存", use_container_width=True):
            if not product_name.strip():
                st.warning("请先填写产品名称")
            else:
                try:
                    enrichment_result = enrich_product(product_name.strip(), web_hint.strip())
                    st.session_state[CREATOR_WEB_ENRICHMENT_MD_KEY] = enrichment_result.markdown
                    st.session_state[CREATOR_WEB_ENRICHMENT_IMAGES_KEY] = enrichment_result.images
                    st.success(f"已缓存联网资料，图片 {len(enrichment_result.images)} 张")
                except Exception as err:  # noqa: BLE001
                    st.error(f"联网检索失败：{err}")

    with generation_control_col:
        st.subheader("知识库")
        st.caption(
            f"嵌入模型（系统设置）：`{embedding_model}`。"
            + (" 已解析到 OpenAI 兼容密钥。" if api_key else " 请在「系统设置」配置含嵌入能力的 Provider。")
        )
        kb_meta = list_projects()
        kb_project_labels: dict[str, str] = {}
        for m in kb_meta:
            kb_project_labels[f"{m.project_name} | {m.project_id}"] = m.project_id
        if not kb_project_labels:
            kb_project_labels[f"{project.project_name} | {project.project_id}"] = project.project_id
        default_kb_label = next(
            (lbl for lbl, pid in kb_project_labels.items() if pid == project.project_id),
            next(iter(kb_project_labels.keys())),
        )
        _kb_labels = list(kb_project_labels.keys())
        _kb_idx = _kb_labels.index(default_kb_label) if default_kb_label in _kb_labels else 0
        kb_label = st.selectbox(
            "知识库所在项目（可关联其它项目的分析 JSON）",
            options=_kb_labels,
            index=_kb_idx,
            key="creator_kb_project_label",
        )
        kb_project_id = kb_project_labels[kb_label]
        kb_dir = get_project_json_dir(kb_project_id)
        kb_dir.mkdir(parents=True, exist_ok=True)
        kb_only_analysis = st.checkbox(
            "仅列出视频分析结果（文件名以「_视觉数据.json」结尾）",
            value=True,
            key="creator_kb_only_vision_json",
        )
        if kb_dir.exists():
            all_json = sorted(p.name for p in kb_dir.glob("*.json"))
            if kb_only_analysis:
                json_name_options = [n for n in all_json if n.endswith("_视觉数据.json")]
            else:
                json_name_options = all_json
        else:
            json_name_options = []
        kb_json_pick = st.multiselect(
            "指定作为 RAG 上下文的 JSON（留空则使用上列全部；适用于只选部分分析结果）",
            options=json_name_options,
            default=[],
            key="creator_kb_json_basenames",
        )
        if st.button("加载知识库", type="primary", use_container_width=True):
            if not api_key:
                st.error("缺少 OpenAI 兼容 API Key（向量化需要），请在系统设置中配置 Provider。")
            else:
                try:
                    only = [(kb_dir / n).resolve() for n in kb_json_pick] if kb_json_pick else None
                    kb = load_folder_as_knowledge(
                        api_key.strip(),
                        str(kb_dir.resolve()),
                        embedding_model=embedding_model,
                        only_paths=only,
                    )
                    st.session_state[CREATOR_KNOWLEDGE_KEY] = kb
                    st.success(f"知识库加载完成：{kb.mode}，总字符 {kb.total_chars:,}")
                except Exception as err:  # noqa: BLE001
                    st.error(f"加载失败：{err}")

        st.subheader("生成与保存")
        if st.button("💾 保存项目快照", use_container_width=True):
            payload = _build_project_payload(
                project_name=project_name,
                product_name=product_name,
                core_features=core_features,
                data_dir=str(project_json_dir),
                embedding_model=embedding_model,
                text_model=text_model,
                vision_model=vision_model,
                text_backend=text_backend,
                anthropic_model=anthropic_model,
            )
            pid = save_project(payload=payload, project_name=project_name, project_id=st.session_state.get(CREATOR_SAVED_PROJECT_ID_KEY) or None)
            st.session_state[CREATOR_SAVED_PROJECT_ID_KEY] = pid
            st.success(f"已保存：{pid}")

        metas = list_projects()
        if metas:
            options = {f"{meta.project_name} | {meta.updated_at}": meta.project_id for meta in metas}
            chosen = st.selectbox("加载历史项目", list(options.keys()))
            if st.button("📂 加载选中项目", use_container_width=True):
                project_doc = load_project(options[chosen])
                payload = project_doc.get("payload") or {}
                st.session_state["creator_product_name"] = payload.get("product_name") or ""
                st.session_state["creator_core_features"] = payload.get("core_features") or ""
                st.session_state[CREATOR_WEB_ENRICHMENT_MD_KEY] = payload.get("web_enrichment_md") or ""
                plans = payload.get("plans") or {}
                st.session_state[CREATOR_PLAN_A_KEY] = plans.get("plan_a") or ""
                st.session_state[CREATOR_PLAN_B_KEY] = plans.get("plan_b") or ""
                st.session_state[CREATOR_PLAN_C_KEY] = plans.get("plan_c") or ""
                st.success("已加载")
                st.rerun()

        busy_story = bool(_get_storyboard_task_id(project.project_id)) and alive
        gen = st.button(
            "🎬 自动生成分镜脚本（后端任务）",
            type="primary",
            use_container_width=True,
            disabled=busy_story,
        )

    if gen:
        if not alive:
            st.error("后端不可用，请启动：`uvicorn backend.app.main:app --host 127.0.0.1 --port 8010`")
            if st.button("手动一键启动后端", key="creator_start_backend_on_submit", use_container_width=True):
                with st.spinner("正在尝试启动后端..."):
                    launch_result = start_backend_once(base_url)
                if launch_result.ok:
                    st.success(launch_result.message)
                    st.rerun()
                else:
                    st.error(launch_result.message)
        elif st.session_state.get(CREATOR_KNOWLEDGE_KEY) is None:
            st.warning("请先加载知识库")
        elif not api_key.strip():
            st.warning("缺少 OpenAI 兼容 API Key（嵌入与视觉分析需要），请在「系统设置」配置。")
        elif text_backend == TEXT_BACKEND_ANTHROPIC and not anthropic_key.strip():
            st.warning("当前为 Anthropic 文本后端，请配置 Anthropic Provider 或环境变量中的 Anthropic API Key。")
        elif not product_name.strip():
            st.warning("请填写产品名称")
        else:
            upload_dir = project_runtime_dir / "uploads"
            upload_dir.mkdir(parents=True, exist_ok=True)
            image_paths: list[str] = []
            if uploads:
                for uf in uploads:
                    dest = upload_dir / f"{uuid.uuid4().hex}_{uf.name}"
                    dest.write_bytes(uf.getvalue())
                    image_paths.append(str(dest))
            text_m = text_model.strip() if text_backend == TEXT_BACKEND_OPENAI_COMPAT else (anthropic_model or "").strip()
            anth_m = anthropic_model.strip() if text_backend == TEXT_BACKEND_ANTHROPIC else ""
            payload = {
                "product_name": product_name.strip(),
                "core_features": core_features.strip(),
                "web_enrichment_md": (st.session_state.get(CREATOR_WEB_ENRICHMENT_MD_KEY) or ""),
                "api_key": api_key.strip(),
                "anthropic_key": anthropic_key.strip(),
                "vision_model": vision_model.strip(),
                "text_model": text_m,
                "embedding_model": embedding_model.strip(),
                "text_backend": text_backend,
                "anthropic_model": anth_m,
                "image_paths": image_paths,
                "rag_knowledge_project_id": kb_project_id,
                "rag_json_basenames": list(kb_json_pick),
            }
            try:
                resp = create_pipeline_task(project.project_id, "storyboard", payload, base_url=base_url)
                tid = str(resp.get("task_id") or "")
                if tid:
                    _set_storyboard_task_id(project.project_id, tid)
                st.success(f"已提交后端分镜任务 `{tid}`")
                st.rerun()
            except Exception as err:  # noqa: BLE001
                st.error(f"提交失败：{err}")
    if CREATOR_PLAN_A_KEY in st.session_state:
        st.divider()
        st.subheader("分镜输出")
        plan_tab_a, plan_tab_b, plan_tab_c = st.tabs(["方案 A", "方案 B", "方案 C"])
        with plan_tab_a:
            st.markdown(st.session_state.get(CREATOR_PLAN_A_KEY) or "_空_")
        with plan_tab_b:
            st.markdown(st.session_state.get(CREATOR_PLAN_B_KEY) or "_空_")
        with plan_tab_c:
            st.markdown(st.session_state.get(CREATOR_PLAN_C_KEY) or "_空_")

        export_payload = _build_project_payload(
            project_name=project_name,
            product_name=product_name,
            core_features=core_features,
            data_dir=str(project_json_dir),
            embedding_model=embedding_model,
            text_model=text_model,
            vision_model=vision_model,
            text_backend=text_backend,
            anthropic_model=anthropic_model,
        )
        export_full_col, export_single_col = st.columns([1, 1])
        with export_full_col:
            st.download_button(
                "导出完整 Markdown",
                data=build_export_markdown(export_payload, include_all_plans=True),
                file_name=f"{project_name or 'project'}_full.md",
                mime="text/markdown",
                use_container_width=True,
            )
        with export_single_col:
            selected_plan = st.selectbox("单方案导出", ["A", "B", "C"], key="creator_export_plan")
            single_payload = dict(export_payload)
            single_payload["selected_plan"] = selected_plan
            st.download_button(
                f"导出方案 {selected_plan}",
                data=build_export_markdown(single_payload, include_all_plans=False),
                file_name=f"{project_name or 'project'}_plan_{selected_plan}.md",
                mime="text/markdown",
                use_container_width=True,
            )


