"""关于页面：版本信息与帮助链接。"""

from __future__ import annotations

import streamlit as st


def render_about_settings() -> None:
    """渲染版本信息与帮助链接。"""
    st.subheader("关于 Nibi")
    st.markdown(
        """
        **Nibi** 是一个面向内容创作者的视频分析与分镜生成工作台。

        | 项目 | 信息 |
        |------|------|
        | 分支 | `refactor/phase-2-ui` |
        | 配置文件 | `.local/settings.json` |
        | 数据目录 | `data/` |

        ---
        **帮助文档**
        - [添加 Provider 指南](docs/ADD_PROVIDER.md)
        - [启用本地模型](docs/ENABLE_LOCAL.md)
        - [Phase 2 架构说明](docs/PHASE2_RESTRUCTURE.md)
        """
    )

