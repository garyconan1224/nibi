"""
VidMirror — AI 视频创作工作台
多页面 Streamlit 应用入口。

本地配置：复制 .env.example 为 .env 并填写密钥（勿提交 .env）。

工作流：
  「视频下载」  → 从 YouTube/B站下载到项目 `videos/`
  「视频分析」  → 逐帧分析，输出 JSON 到项目 `json_data/`
  「AI 导演编剧工作台」→ 基于知识库 RAG + 分镜脚本生成
"""

import streamlit as st

from shared.config import ensure_data_dirs

# 确保共享数据目录存在
ensure_data_dirs()

st.set_page_config(
    page_title="VidMirror — AI 视频创作工作台",
    page_icon="🎬",
    layout="wide",
)

st.title("🎬 VidMirror — AI 视频创作工作台")
st.markdown(
    """
    欢迎使用本工作台。功能形成完整的「下载 → 分析 → 创作」流水线。

    请从左侧导航进入各页面：

    | 页面 | 功能 |
    |------|------|
    | **系统设置** | 配置 Provider、API 密钥与默认模型、分镜文本后端 |
    | **视频下载** | 从 YouTube / B站下载视频到当前项目目录 |
    | **视频分析** | 对视频逐帧分析，生成 JSON 知识库 |
    | **AI 导演编剧工作台** | 基于知识库 RAG 与多模态参考，生成分镜脚本（方案 A/B/C） |

    ---

    ### 快速开始

    1. 打开 **系统设置**，配置至少一个启用的 Provider（含 API Key 与默认模型）
    2. 在 **视频下载** 中提交下载任务
    3. 在 **视频分析** 中勾选视频并开始分析
    4. 在 **AI 导演编剧工作台** 中选择知识库来源、加载知识库并生成分镜

    > **注意**：分析与分镜会调用大模型 API，请确保密钥有效且额度充足。
    """
)

st.info(
    "项目数据目录：`data/projects/<项目ID>/videos/`（视频）| `.../json_data/`（分析 JSON）| `projects/`（创作快照）",
    icon="📁",
)
