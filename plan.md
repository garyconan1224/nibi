# 多媒体内容分析系统 — AI 协作开发计划 v1

> 配合 `system_design_for_claude_design_v1.md` 使用。
> 本文件用于约束 AI 编程工具的工作边界。
> 每开始一个新会话，AI 第一件事就是先读本文件确认当前在哪个阶段。

---

## 总体节奏

- 完整 MVP 拆为 **11 个子阶段（1A → 1K）**，加上 Phase 0 基建。
- 每个子阶段对应一个 git 分支，完成后 merge 到 main 并打 tag。
- 建议先把 Phase 0 + 1A + 1B 完整跑通，建立信心和工作流肌肉记忆，再批量推进后面。

每个子任务前的 `[ ]` 完成后改成 `[x]` ，并简单写一行心得（碰到了什么坑、学了什么）。这是给未来的你看的笔记。

---

## Phase 0：项目基建（必做，约 1-2 小时）

**目标**：项目骨架可运行，git 安全网建立。

- [ ] 0.1 git 初始化 + baseline tag（`v0.0.0-baseline`）
- [ ] 0.2 后端 FastAPI 骨架（main.py + 健康检查 `GET /health`）
- [ ] 0.3 前端 React + TS 骨架（Vite，能打开"Hello"页面）
- [ ] 0.4 SQLite + SQLAlchemy 配置（先跑通连接，模型放后面）
- [ ] 0.5 `.env` 配置模块（pydantic-settings）
- [ ] 0.6 全局错误处理 + 日志（loguru）
- [ ] 0.7 CORS 配置，前后端能互通

**完成标志**：浏览器打开 `http://localhost:5173` 看到 hello，前端能调 `GET /health` 拿到 ok 响应。
**打 tag**：`v0.1.0-phase0`

---

## Phase 1A：任务系统 — 后端（约 2 小时）

**目标**：Task 的 CRUD 跑通，pytest 全绿。

- [ ] 1A.1 Task 数据模型（id, name, created_at, status，关联 items）
- [ ] 1A.2 Pydantic schemas（TaskCreate, TaskRead, TaskUpdate）
- [ ] 1A.3 `POST /tasks` 创建任务
- [ ] 1A.4 `GET /tasks` 任务列表
- [ ] 1A.5 `GET /tasks/{id}` 任务详情
- [ ] 1A.6 `PATCH /tasks/{id}` 重命名
- [ ] 1A.7 `DELETE /tasks/{id}` 删除任务
- [ ] 1A.8 pytest 覆盖以上 5 个端点（每个测一个 happy path + 一个错误路径）

**完成标志**：用 Thunder Client 或 curl 测过 5 个端点，`pytest` 全绿。
**打 tag**：`v0.2.0-phase1a`

---

## Phase 1B：任务系统 — 前端（约 2 小时）

**目标**：能在浏览器里建任务、看任务、删任务。

- [ ] 1B.1 路由和整体布局（App.tsx + Layout 组件）
- [ ] 1B.2 任务列表页（网格卡片，对应设计文档 2.3）
- [ ] 1B.3 新建任务模态框（输入名字 → 调后端 → 跳转详情）
- [ ] 1B.4 任务详情页骨架（先只展示任务名 + 占位区域）
- [ ] 1B.5 删除/重命名交互（带二次确认）

**完成标志**：浏览器里完整走通"建任务 → 进入详情 → 改名 → 删除"流程。
**打 tag**：`v0.3.0-phase1b`

---

## Phase 1C：模型管理（约 1.5 小时）⭐ 高风险

⭐ 涉及 API Key 加密存储，**必须二阶段执行**（先让 AI 给方案，你确认后再动手）。

- [ ] 1C.1 ApiModel 数据模型（name, api_key 加密存储, base_url, model_type）
- [ ] 1C.2 CRUD API 端点
- [ ] 1C.3 加密：cryptography Fernet，加密密钥从 `.env` 读
- [ ] 1C.4 设置页 → 模型管理 UI（对应设计文档 4.3）
- [ ] 1C.5 "测试连通性"按钮（发个最小请求验证 key 有效）

**打 tag**：`v0.4.0-phase1c`

---

## Phase 1D：输入层 — 本地文件（约 2 小时）

- [ ] 1D.1 Item 模型 + 多对一关联到 Task
- [ ] 1D.2 `POST /tasks/{id}/items` 接收文件
- [ ] 1D.3 magic bytes 识别文件类型（python-magic 库）
- [ ] 1D.4 前端拖拽上传（react-dropzone）
- [ ] 1D.5 上传进度条

**打 tag**：`v0.5.0-phase1d`

---

## Phase 1E：输入层 — 网络链接（约 2 小时）

- [ ] 1E.1 yt-dlp 集成（subprocess 异步调用）
- [ ] 1E.2 下载进度推送：Server-Sent Events
- [ ] 1E.3 前端 URL 输入 + 进度展示
- [ ] 1E.4 异常处理（版权 / 地区 / 超时，对应设计文档 3.1）

**打 tag**：`v0.6.0-phase1e`

---

## Phase 1F：前置配置面板（约 1.5 小时）

- [ ] 1F.1 Config 数据模型（背景信息 + 选中模型 ID + 任务勾选 JSON）
- [ ] 1F.2 配置面板 UI（对应设计文档第 4 节的三区结构）
- [ ] 1F.3 提交后写入 item.config 字段

**打 tag**：`v0.7.0-phase1f`

---

## Phase 1G：视频分析核心（约 3-4 小时）⭐ 最高风险

⭐ **必须二阶段执行**。涉及外部进程（ffmpeg）+ 多次 API 调用 + 异步编排，是整个 MVP 最难的一块。

- [ ] 1G.1 ffmpeg 截帧封装（先只做"按秒截帧"模式，AI 镜头分析推到 Phase 2）
- [ ] 1G.2 视觉模型适配器（BaseVisionModel 抽象 + OpenAI 兼容实现）
- [ ] 1G.3 帧分析任务编排（每帧重试 3 次，失败标记后跳过）
- [ ] 1G.4 LLM 精炼（汇总帧描述 → 输出 Midjourney/SD 提示词）
- [ ] 1G.5 异步任务系统（先用 FastAPI BackgroundTasks，量大再上 Celery）
- [ ] 1G.6 进度推送（SSE 把当前步骤推给前端）

**打 tag**：`v0.8.0-phase1g`

---

## Phase 1H：视频结果页（约 2 小时）

- [ ] 1H.1 视频播放器组件（先用原生 `<video>`）
- [ ] 1H.2 三轨时间轴（提示词 / 字幕 / 音乐分段，对应设计文档 5.3）
- [ ] 1H.3 同步联动：播放进度 ↔ 时间轴 ↔ 右侧提示词面板
- [ ] 1H.4 复制提示词 / 收藏帧 按钮

**打 tag**：`v0.9.0-phase1h`

---

## Phase 1I：图片分析 + 结果页（约 2 小时）

子任务略，参考设计文档第 7 节，结构与 1G+1H 类似但简单很多。
**打 tag**：`v0.10.0-phase1i`

---

## Phase 1J：进度可视化（约 1.5 小时）

对应设计文档第 11 节，把前面散在各处的进度统一成一个 UI 组件。
**打 tag**：`v0.11.0-phase1j`

---

## Phase 1K：复刻工作包导出（约 1.5 小时）

对应设计文档 9.6，把数据库里的素材、提示词、字幕打包成一个 .zip 文件。
**打 tag**：`v1.0.0-mvp` 🎉

完成 1K 即 **MVP 上线，可以给朋友试用了**。

---

## Phase 2-4：后续

参考 `system_design_for_claude_design_v1.md` 第 14 节的 Phase 2-4 优先级表。每个 Phase 开始前再补充本文件的子任务清单，**不要一开始就把后续全部写出来**——你做完 MVP 后对优先级的判断会比现在准。

---

## 模型分配建议（按子任务复杂度）

| 模型档位 | 用在哪些任务 |
|---------|------------|
| **Haiku（最便宜）** | UI 文案修改、CSS 微调、写 mock 数据、写测试 fixture |
| **Sonnet（默认）** | 上面列的 1A-1K 绝大部分子任务 |
| **Opus（仅在以下情况升级）** | 1C.3 加密设计、1G.2 视觉模型适配器抽象、Phase 3 的复刻清单跨任务对比、Phase 3 的风格报告 |

**默认开 Sonnet 就好。** 别一上来就 Opus 跑 5 行 CRUD——那是烧钱不办事。

---

## 标注约定

- ⭐ = 高风险任务，需要二阶段执行（plan → 你确认 → execute）
- 🔁 = 已完成但留待优化的任务
- ❓ = 卡住了，需要研究后再做的任务
