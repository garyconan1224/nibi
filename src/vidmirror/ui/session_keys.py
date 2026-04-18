"""Centralized Streamlit session_state key constants."""

# Settings page
SET_SETTINGS_LOADED_KEY = "set_settings_loaded"

# Download page
DOWNLOAD_TASKS_BY_PROJECT_KEY = "download_tasks_by_project"
# Backend task ids (pipeline) tracked per project for UI list
DOWNLOAD_BACKEND_TASK_IDS_KEY = "download_backend_task_ids_by_project"

# Analysis page
ANALYZE_STATE_BY_PROJECT_KEY = "analyze_state_by_project"
ANALYZE_RUNNING_BY_PROJECT_KEY = "analyze_running_by_project"
ANALYZE_BACKEND_TASK_BY_PROJECT_KEY = "analyze_backend_task_by_project"

# Creator page
CREATOR_KNOWLEDGE_KEY = "creator_knowledge"
CREATOR_SAVED_PROJECT_ID_KEY = "creator_saved_project_id"
CREATOR_PROJECT_CREATED_AT_KEY = "creator_project_created_at"
CREATOR_WEB_ENRICHMENT_MD_KEY = "creator_web_enrichment_md"
CREATOR_WEB_ENRICHMENT_IMAGES_KEY = "creator_web_enrichment_images"
CREATOR_VISION_REPORT_KEY = "creator_vision_report"
CREATOR_WEB_CONTEXT_USED_KEY = "creator_web_context_used"
CREATOR_PLAN_A_KEY = "creator_plan_a"
CREATOR_PLAN_B_KEY = "creator_plan_b"
CREATOR_PLAN_C_KEY = "creator_plan_c"
CREATOR_PROJECT_NAME_KEY = "creator_project_name"
CREATOR_STORYBOARD_TASK_BY_PROJECT_KEY = "creator_storyboard_task_by_project"

# Phase 2 单页应用式工作台（app.py 驱动的全局状态）
VIEW_KEY = "view"
CURRENT_PROJECT_ID_KEY = "current_project_id"
TASKS_CACHE_KEY = "tasks_cache"
SELECTED_TASK_ID_KEY = "selected_task_id"

# 设置页菜单
SETTINGS_MENU_KEY = "settings_menu"  # 当前选中的设置菜单项
