# VidMirror（nibi）系统改造规划文档 v1.0

> 阅读对象：项目作者本人（代码小白可读）
> 文档目标：把现有项目按 `system_design_for_claude_design_v1.md` 的设计目标改造完成
> 参考资料：上传的 `vidmirror.zip` 已解压到项目内 `design_reference/` 目录

---

## 阅读这份文档前的两个前提

**前提 1：你的项目现在已经"五脏俱全"，不是从零开始。**
backend 有 FastAPI、任务中心、转录、RAG；frontend 有 React 19 + Vite 6 + 一套 UI 组件、设置页、任务面板。
所以这次不是"重做"，而是"扩展 + 改造对齐设计文档"。

**前提 2：参考前端 `design_reference/` 是设计稿原型，不是生产代码。**
它是一份能跑的 HTML demo（`VidMirror.html` 双击就能打开看），目的是告诉你"长这样、交互这样"，
不是直接拿来替换你现在的 `frontend/`。我们要做的是**把它的页面结构和样式逐步搬进 frontend/src/pages/**。

---

## 第 0 章：术语对照表（避免混淆）

| 文档里的词 | 你项目里现在叫什么 | 对应文件 |
|---|---|---|
| 任务（Task） | pipeline task | `backend/app/services/pipeline_tasks.py` |
| 项目（Project） | project | `shared/project_store.py` |
| 视觉模型 / 文本模型 / 视频模型 | provider profile | `shared/settings_store.py` ProviderProfile |
| 截帧 + 提示词生成 | storyboard generator | `shared/storyboard_generator.py` |
| 转录（Whisper） | transcript service | `backend/app/services/transcript_service.py` |
| 任务级 LLM 对话 | RAG QA | `backend/app/services/rag_qa_service.py` |

> **重要认知**：设计文档里的"任务"概念，比你现有 `pipeline_tasks` 大一圈。
> 现在的 task 更像"一次具体执行"（下载/分析/分镜），设计文档里的"任务"是
> "一个工作空间，里面装多个素材，每个素材又有自己的执行任务"。
> 所以**未来要做的是：在 project 之上或之内，加一层"工作空间"概念**，
> 或者干脆把 project 升级成"任务/工作空间"。下面会展开讲。

---

## 第一部分：现状全景

### 1.1 后端已有能力（backend/app/）

```
routes/
  pipeline.py         — 任务 CRUD、SSE/WebSocket 实时进度  ✅ 已有
  providers.py        — AI 模型供应商管理                  ✅ 已有
  transcript.py       — 字幕转录                          ✅ 已有
  rag.py              — 任务级 LLM 问答                   ✅ 已有
  notes.py            — 笔记/AI 导演工作台                ✅ 已有
  download_config.py  — 下载偏好（cookies/代理）          ✅ 已有
  transcriber_config.py — 转录器配置                       ✅ 已有
  admin.py            — 管理接口                           ✅ 已有

services/
  task_runner.py / task_store.py — 任务执行引擎 + 持久化   ✅
  pipeline_tasks.py    — pipeline 任务处理器              ✅
  asr_groq.py / asr_fast_whisper.py — 两套转录后端        ✅
  subtitle_fetcher.py  — 自带字幕提取                      ✅
  transcript_service.py — 字幕统一编排                    ✅
  rag_qa_service.py     — 跨素材问答                       ✅

shared/
  storyboard_generator.py — 截帧 + 提示词                  ✅ 接近设计文档"画面提示词生成"
  video_analyzer.py        — 视频分析                       ✅
  video_download_ytdlp.py  — yt-dlp 下载封装                ✅
  knowledge_base.py        — 知识库                         ✅
  providers/               — 模型适配                       ✅
```

### 1.2 前端已有页面（frontend/src/pages/）

```
Index.tsx
HomePage/
  Home.tsx
  TaskDashboard.tsx
  TaskItem.tsx
  TasksDrawer.tsx
  AnalyzeView.tsx
  ProcessingStepper.tsx
  StoryboardPanel.tsx
  MarkmapComponent.tsx / MarkdownViewer.tsx
  NoteForm.tsx
  TaskLogViewer.tsx
SettingPage/
  index.tsx
  ModelManagementPage.tsx
  ProvidersManagementPage.tsx
  DownloadSettingsPage.tsx
  TranscriberPage.tsx
  NetworkSettingsPage.tsx
  ScreenshotPage.tsx
  AboutPage.tsx
  DeployMonitorPage.tsx
```

UI 组件库已经齐全（`components/ui/` 下大约 20 多个基础组件 + shadcn 风格）。

---

## 第二部分：差距分析（Gap Analysis）

把设计文档第 14 章的"页面清单与优先级"和你现状对照一遍：

### Phase 1（MVP）

| 设计文档要求 | 现状 | 差距 / 要做的事 |
|---|---|---|
| **任务列表页**（首页，新建/打开任务） | 部分有（TaskDashboard） | 需要把"任务"从单次执行升级为"工作空间"，TaskDashboard 改成卡片网格风格 |
| **任务详情页**（左侧素材列表 + 右侧 LLM 对话） | 部分有（Home.tsx） | 需要新增"素材列表"概念、右侧固定 LLM 对话栏 |
| **前置配置面板**（背景信息 + 模型选择 + 任务勾选） | ❌ 没有完整面板 | 新建 `PreflightConfigPanel`，参考 `design_reference/components/workbench.jsx` |
| **视频结果页**（播放器 + 三轨时间轴） | 部分有（StoryboardPanel） | 缺三轨时间轴（镜头/字幕/提示词），参考 `video_detail.jsx` |
| **图片结果页**（左图右信息） | ❌ 没有 | 新建，参考 `image_detail.jsx` |
| **全流程进度条** | 有（ProcessingStepper） | 样式按 `processing.jsx` 调整即可 |
| **系统设置 → 模型管理** | ✅ 已有 | 检查是否覆盖"视觉/文本/视频"三类标签 |
| **复刻工作包导出** | ❌ 没有 | 新建后端打包接口 + 前端按钮 |

### Phase 2（核心功能）

| 设计文档要求 | 现状 | 差距 |
|---|---|---|
| 音频结果页（波形 + 字幕 + 音乐分析） | 部分有（转录功能） | 缺波形组件、缺音乐分析功能；参考 `audio_detail.jsx` |
| 文字结果页（原文 + 分析对照） | ❌ 没有 | 新建，参考 `text_detail.jsx` |
| 参考帧收藏夹 / 复刻清单 | ❌ 没有 | 后端加收藏表 + 前端列表页 |
| 任务级 LLM 对话侧栏 | 后端有 RAG，前端弱 | 加固定侧栏组件，参考 `task_chat.jsx` |
| 提示词版本记录 | ❌ 没有 | 后端加版本表，前端加版本对比 UI |

### Phase 3（增强）

| 设计文档要求 | 现状 | 差距 |
|---|---|---|
| 提示词标签库（7 维度） | 部分（storyboard 已有打标签） | 需要标签 CRUD 接口 + 跨任务检索 |
| 创作者风格报告 | ❌ 没有 | 新功能 |
| 生成结果对比原作 | ❌ 没有 | 新功能 |
| 批量队列全局面板 | 部分（有 task list） | 改成 `queue_panel.jsx` 风格 |

### Phase 4（深度）

多图对比、多文对比、跨任务检索、性能自适应 —— 全部新建。

---

## 第三部分：核心改造策略（一句话总结）

**"后端逐步扩接口，前端逐页对齐参考稿，旧 Streamlit 按 README 的弃用计划于 v0.4 移除"**

具体三条原则：

1. **不动现有可工作的能力**：转录、下载、provider、pipeline 已能跑的东西不要动它们的核心。只在外面加一层适配。
2. **新概念用新表/新模型**：比如"工作空间"、"收藏夹"、"标签库"，都建新的数据模型，不要去硬改老的 `Task`。
3. **前端逐页 copy 参考稿**：`design_reference/components/*.jsx` 是 "原生 React + 内联样式" 的简化版。
   你的项目用 TypeScript + 单独 CSS 模块，所以**不能直接拷贝代码**，但可以：
   - 拷贝**结构**（JSX 树）
   - 拷贝**样式 class 名 + styles.css 的设计 tokens**
   - 拷贝**交互逻辑**（state、回调）
   再用你的 TypeScript 改写。

---

## 第四部分：分阶段执行计划

### 阶段 A（基础设施，约 1-2 周）

**目标**：搭好"工作空间 + 素材"的数据模型，让所有后续功能有地方挂。

#### A.1 后端：新增"工作空间"数据模型

新建文件：`backend/app/models/workspace.py`

```python
# 大致长这样（伪代码，给你看意思）
class Workspace:
    workspace_id: str       # uuid
    name: str               # "参考素材 - 某创作者风格"
    project_id: str         # 关联到现有 project
    created_at: datetime
    status: str             # active / completed
    items: list[WorkspaceItem]   # 素材列表

class WorkspaceItem:
    item_id: str
    workspace_id: str
    type: str               # video / audio / image / text
    source: str             # url / local
    source_value: str       # 实际 URL 或文件路径
    status: str             # pending / processing / done / failed
    results: dict           # 各类分析结果汇总
    related_task_ids: list[str]  # 关联到执行的 pipeline tasks
```

**为什么要新建而不是改 project？**
- project 现在已经被多个地方引用，改它风险大
- 一个 project 可以装多个 workspace（先不做，但留好扩展性）
- workspace 这层就是设计文档里说的"任务"概念

新建路由：`backend/app/routes/workspaces.py`
- `POST /workspaces` 创建工作空间
- `GET /workspaces` 列表
- `GET /workspaces/{id}` 详情
- `POST /workspaces/{id}/items` 添加素材
- `DELETE /workspaces/{id}/items/{item_id}`

存储：先用 JSON 文件存（跟现有 task_store 一样的套路），不上数据库。
路径：`data/workspaces/<workspace_id>.json`

#### A.2 后端：前置配置接口

新建路由：`backend/app/routes/preflight.py`

```python
# 接收前置配置面板提交的内容，返回一个"批次 ID"，后续所有 pipeline task 都带这个批次 ID
class PreflightConfig:
    workspace_id: str
    background: dict        # 内容类型/参与人员/主题/专有名词/分析目的
    models: dict            # vision / text / video 三个 provider_id
    tasks: dict             # 勾选了哪些分析项，每项的子参数
```

#### A.3 前端：路由 + 工作空间列表

修改 `frontend/src/router.tsx`：新增三条路由
- `/workspaces` 工作空间列表（首页改成它）
- `/workspaces/:id` 工作空间详情
- `/workspaces/:id/preflight` 前置配置（也可以做成模态框）

新建 `frontend/src/pages/WorkspacePage/WorkspaceList.tsx`：
参考 `design_reference/components/taskboard.jsx`（733 行，是参考稿里最完整的页面）

**新手提示**：参考稿里的组件命名很乱（taskboard、workbench、materials 都涉及"任务"概念），
其实对应关系是：
- `workbench.jsx` = 设计文档"任务详情页 + 添加内容"
- `taskboard.jsx` = 设计文档"任务列表页"  
- `materials.jsx` = 设计文档"素材列表"
- `overview.jsx` = 12 屏概览（一屏看到所有页面，调试用）

---

### 阶段 B（视频分支完善，约 2 周）

**目标**：让视频从下载 → 截帧 → 提示词 → 三轨时间轴展示完整跑通。

#### B.1 后端：截帧模式扩展

修改 `shared/storyboard_generator.py`：增加两种模式
- 模式 A：按秒截帧（已有），增加"过滤相似帧"（基于 perceptual hash）
- 模式 B：AI 镜头分析（新功能，需引入镜头切换检测，可用 PySceneDetect 库）

新增 dependency 在 `requirements.txt`：
```
scenedetect>=0.6.0
imagehash>=4.3.0
```

#### B.2 后端：三种总结路径

新建 `backend/app/services/video_summary_service.py`：
- 路径 1：字幕直接总结（最简单，直接调 LLM）
- 路径 2：音视频合并总结（已有 storyboard 拼字幕即可）
- 路径 3：视频模型直接分析（调 Gemini/GPT-4o 视频理解）

#### B.3 前端：视频结果页 + 三轨时间轴

新建 `frontend/src/pages/VideoDetailPage.tsx`，参考 `design_reference/components/video_detail.jsx`。

**核心组件**：三轨时间轴
- 轨道 1：镜头缩略图横向滚动条
- 轨道 2：字幕文本带高亮
- 轨道 3：提示词区间色块

**实现技术建议**：
- 用一个 `<canvas>` 或 `<svg>` 自己画 + React 状态控制
- 或者用现有库：`wavesurfer.js`（虽然它主要用于音频，但波形概念类似可参考）
- 同步播放器：使用 HTML5 `<video>` 元素，监听 `timeupdate` 事件

---

### 阶段 C（音频/图片/文字分支，约 2 周）

按设计文档第 6/7/8 章实现。每个分支后端 + 前端结果页 + 接前置配置。

参考 `design_reference/components/`：
- `audio_detail.jsx` — 音频结果页
- `image_detail.jsx` — 图片结果页
- `text_detail.jsx` — 文字结果页

**音频分支额外要做**：
- VAD 人声检测（用 `silero-vad` 或 `webrtcvad`）
- 说话人分离（用 `pyannote.audio`）
- 音乐分析（特征提取可用 `librosa`，提示词调 LLM）

**图片分支额外要做**：
- EXIF 提取（用 `Pillow` 或 `exifread`）
- OCR（用 `paddleocr` 中文友好，或 `tesseract`）

**文字分支额外要做**：
- PDF / DOCX 解析（用 `pypdf` + `python-docx`）
- 网页正文抓取（已有 `shared/web_enrich.py`，扩展即可）

---

### 阶段 D（复刻专项功能，约 2-3 周）

#### D.1 收藏夹（Favorites）

新建表：`Favorite`
- favorite_id / workspace_id / source_item_id / source_type / thumbnail / prompts / notes / created_at

后端路由：`POST/GET/DELETE /favorites`

前端：参考 `design_reference/components/storyboard.jsx` 的复刻清单 UI

#### D.2 标签库

`Storyboard` 已经在生成时打了 7 维度标签，现在要做：
- 后端：聚合接口 `GET /tags?workspace_id=&dimension=`
- 前端：标签库页面（按维度筛选 + 跨任务检索）

#### D.3 风格报告

新建后端服务 `style_report_service.py`：
- 输入：workspace_id
- 输出：词云数据 + 色调统计 + 镜头统计 + LLM 生成的复刻建议
- 用 LLM 一次性聚合所有素材的分析结果

前端用 `recharts` 或 `d3` 画图（这俩你的 React 工程已经能用）。

#### D.4 一键导出复刻工作包

新建后端服务 `workspace_export_service.py`：
- 把工作空间所有素材的结果按设计文档第 9.6 节结构打包成 zip
- 复用 `shared/export_utils.py` 已有的导出能力
- 用 Python `zipfile` 库打包

前端：在工作空间详情页加 `[导出工作包]` 按钮，调接口下载 zip。

---

### 阶段 E（增强 + 收尾，约 1-2 周）

- 批量队列全局面板（参考 `queue_panel.jsx`）
- 多图/多文对比
- 性能自适应设置
- Streamlit 老前端按 `docs/DEPRECATION.md` 移除（v0.4）

---

## 第五部分：第一周可以立刻开干的"小目标"

如果你想立刻动手，按这个顺序最稳：

### Day 1-2：把参考前端跑起来看一眼
```bash
# 双击打开，或：
open /Users/conan/Desktop/nibi/design_reference/VidMirror.html
```
熟悉 12 屏概览（点 sidebar 最后一个 IcGrid 图标），把每个页面长啥样心里有数。

### Day 3-4：动 router.tsx，加新路由占位
```tsx
// frontend/src/router.tsx
{
  path: '/workspaces',
  element: <WorkspaceList />,
},
{
  path: '/workspaces/:id',
  element: <WorkspaceDetail />,
}
```
两个页面先用空壳，能跳转就行。

### Day 5-6：建工作空间数据模型
后端先把 `workspaces.py` 路由 + JSON 存储跑起来，能 POST 创建、能 GET 列表。
前端 `WorkspaceList` 调接口、显示卡片网格。

### Day 7：复盘
对照本文档第四部分，看哪些先做、哪些缓做，重新调整路线。

---

## 第六部分：常见疑问 FAQ

**Q1：参考前端 `design_reference/components/*.jsx` 我能直接拷贝粘贴吗？**

不能直接粘贴，但可以"翻译"。区别在：
- 参考稿是普通 React，你项目是 TypeScript（要加类型）
- 参考稿用全局 CSS class，你项目用 shadcn/Tailwind（要换 className 写法）
- 参考稿数据是写死的 mock，你项目要换成 API 调用

**翻译方法**：开两个窗口对照，把参考稿的 JSX 结构和样式逻辑搬到你的 .tsx 文件里。

**Q2：后端要不要换数据库？现在用 JSON 文件存够吗？**

第一阶段够用，每个 workspace 一个 JSON 文件，JSON 嵌套保存 items。
**触发换数据库的信号**：单个 JSON 文件超过 5MB，或开始出现并发写入冲突时，
再换 SQLite（最简单）或 Postgres。

**Q3：旧的 Streamlit 前端（pages/0~3）现在能删吗？**

按 README 的弃用计划是 **v0.4 删除**，现在是 v0.3 兼容期。
**建议**：等新工作空间跑通且能覆盖 Streamlit 现有的所有功能后再删。
保留期间在 README 写明"新功能不再加到 Streamlit"。

**Q4：模型管理已经有了，要改吗？**

要小改：检查现有 ProviderProfile 是否区分"视觉模型 / 文本模型 / 视频模型"三类。
如果没有，加一个 `model_type` 字段。前置配置面板里要按这三类下拉选择。

**Q5：上传的 zip 里面有 v3 final 设计文档，跟 v1 有什么区别？**

v3（1114 行）比 v1（1237 行）更精简但结构更清晰，把"系统总览"提到最前面，
任务系统讲得更细。**建议把 v3 也读一遍**，路径在
`/Users/conan/Desktop/nibi/design_reference/uploads/system_design_v3_final.md`。
两份文档的内容是同源的，但 v3 的章节组织对开发更友好。

---

## 第七部分：交付物清单（这次我给你的东西）

1. ✅ 本文档：`MIGRATION_PLAN.md`（你正在读的）
2. ✅ 参考前端原型：`design_reference/`（含 HTML demo + 16 个 React 组件 + CSS + 3 份设计文档）
3. ⏳ 下一步建议：你看完这份后告诉我先动哪一块，我可以帮你写第一批代码（比如先把 `WorkspaceList` 页面写出来，或者先把后端 `workspaces` 路由搭起来）

---

## 附：项目结构改造后的目标样子

```
backend/app/
  routes/
    workspaces.py       ⭐ 新增
    preflight.py        ⭐ 新增
    favorites.py        ⭐ 新增
    tags.py             ⭐ 新增
    workspace_export.py ⭐ 新增
    [其余保留]
  services/
    video_summary_service.py    ⭐ 新增
    audio_analysis_service.py   ⭐ 新增（VAD + 说话人分离 + 音乐分析）
    image_analysis_service.py   ⭐ 新增
    text_analysis_service.py    ⭐ 新增
    style_report_service.py     ⭐ 新增
    workspace_export_service.py ⭐ 新增
    [其余保留]
  models/
    workspace.py        ⭐ 新增
    favorite.py         ⭐ 新增
    [其余保留]

frontend/src/
  pages/
    WorkspacePage/
      WorkspaceList.tsx        ⭐
      WorkspaceDetail.tsx      ⭐
      PreflightConfigPanel.tsx ⭐
    DetailPages/
      VideoDetailPage.tsx      ⭐
      AudioDetailPage.tsx      ⭐
      ImageDetailPage.tsx      ⭐
      TextDetailPage.tsx       ⭐
    ReplicatePage/
      FavoritesPage.tsx        ⭐
      TagLibraryPage.tsx       ⭐
      StyleReportPage.tsx      ⭐
    [SettingPage 保留并扩展三类模型选择]
  components/
    timeline/
      ThreeTrackTimeline.tsx   ⭐
      WaveformPlayer.tsx       ⭐
    [ui/ 保留]

shared/
  storyboard_generator.py      改造（加镜头检测）
  music_analyzer.py            ⭐ 新增
  ocr_engine.py                ⭐ 新增
  exif_reader.py               ⭐ 新增
  text_extractor.py            ⭐ 新增（PDF/DOCX/网页）
```

---

*文档结束 · 如有任何一节看不懂，告诉我哪里，我用更简单的话再讲一遍。*
