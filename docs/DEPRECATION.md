# VidMirror 废弃通知（DEPRECATION NOTICE）

本文件记录仓库内进入弃用阶段的模块、时间线与迁移指引。

---

## 1) Streamlit 旧前端

**涉及路径**：
- `app.py`（Streamlit 入口）
- `pages/`（Streamlit 多页面：`0_系统设置.py` / `1_视频下载.py` / `2_视频分析.py` / `3_AI导演编剧工作台.py`）
- `src/vidmirror/ui/views/*`（Streamlit 视图层）

**当前状态**：兼容保留，与 React 19 / Vite 6 前端并行维护。

### 时间线

| 版本 | 阶段 | 行为 |
|---|---|---|
| v0.2.x（当前） | 🟢 兼容期 | React 与 Streamlit 并行可用，功能对齐以 React 为准 |
| **v0.3** | 🟡 最后一个兼容版本 | Streamlit 启动时打印一次性 deprecation warning；不再接收新特性，仅修关键缺陷 |
| **v0.4** | 🔴 移除 | 删除 `app.py` / `pages/` / `src/vidmirror/ui/views/*`；`启动工作台.command` 改为仅拉起 FastAPI + React |

### 迁移指引（面向现有用户）

1. **安装前端依赖**：
   ```bash
   cd frontend && pnpm install
   ```
2. **启动方式**（三终端 → 两终端）：
   ```bash
   # 终端 1（后端）：
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
   # 终端 2（React 前端）：
   cd frontend && pnpm dev
   ```
3. **功能对照**：
   | Streamlit 页面 | React 入口 |
   |---|---|
   | `pages/0_系统设置.py` | `/settings/providers` · `/settings/models` · `/settings/network` 等 |
   | `pages/1_视频下载.py` | `/home`（NoteForm → pipeline 下载任务） |
   | `pages/2_视频分析.py` | `/home`（待补 `AnalyzeView`，追踪 P2-10） |
   | `pages/3_AI导演编剧工作台.py` | `/home`（待补 `StoryboardPanel`，追踪 P2-10） |
4. **数据兼容**：两套前端共用 `data/projects/` 与 `.local/` 运行时数据目录，无需迁移。

### 已知缺口（v0.4 移除前必须补齐）

- P2-10 · 前端差量组件：`ProjectSwitcher` / `AnalyzeView` / `StoryboardPanel`（见 `docs/OUTSTANDING_TASKS.md`）
- 设置页 5 项全部就绪（已完成）

如上述缺口未关闭，v0.4 发布应延期而非强行移除 Streamlit。

---

## 2) 环境变量别名

- `BACKEND_URL` → 推荐 `VIDMIRROR_BACKEND_URL`
  - 兼容保留至 **v0.3**，v0.4 起不再读取，见 `README.md`。

---

## 3) 历史报告文档

根目录 13 份 Phase-B / Refactor / Verification 报告已于 P3-14 归档至 `docs/history/`，保留历史追溯。这些文件不视为当前设计文档，仅作参考。

---

## 维护指引

- 新增 deprecation 时：追加一节到本文件，并在 `README.md` 顶部加一行引用。
- 删除已弃用代码时：同步删除本文件对应条目（或移至"已完成"小节），并在 `docs/OUTSTANDING_TASKS.md` 记录。

