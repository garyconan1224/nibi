# BiliNote 对标改造 · 设计笔记与反馈历史（防忘）

> 用途：长会话 / compact 后恢复设计上下文。记录 BiliNote 网页版对标要点 + 用户历次设计决议 + 进度。
> 配套：用户在对话中发了 BiliNote 网页 4 图（结果页 / 新建弹窗 / 处理页 / 已完成笔记）+ Nibi 现状若干图。原型 HTML 在 `docs/design/bilinote-video-note-flow-review.html`，早期截图在 `docs/design/assets/bilinote-video-note/`。

## 一、BiliNote 网页版对标要点（用户给的 4 图，2026-06-20）

整体：BiliNote 是「**工作台**」统一页面 —— 左侧全局栏 + 中间笔记列表 + 右侧主内容区，所有视频笔记流程（新建 / 处理 / 结果）都在这个布局里切换，**不跳独立页**。

1. **结果页**：顶栏（v2 版本下拉 + 收藏 + 删除 + 模型 chip + 风格 chip + 时间 / 复制·导出·导出 Obsidian·推送 Notion·AI 工具·重新生成）+ 视频 banner（封面 + 标题 + B站 + 原视频）+ 正文（目录链接 / 原片 @时间戳）+ 右侧正文目录（带原片 @时间）
2. **新建笔记弹窗**：单视频 / 视频合集 tab；视频源（在线链接 / 本地 + URL + 「已识别 B站」+ 富视频卡：封面 + 标题 + BILIBILI + 链接有效）；生成参数（AI 模型 / 笔记风格 / 输出格式 / 补充说明 / 区分发言人开关）；输出与归类（存入合集）
3. **处理页**：toast「提交成功」+ 视频卡 + 大标题「正在生成笔记 · 预计还需 Xs」+ **水平 5 步 stepper**（排队-下载-转录-生成-完成，圆点 + 横连接线 + 时间）+ 提示 + 等待小贴士 + 任务 ID。整体**居中大气**。
4. **已完成笔记**：同结果页，正文渲染（标题 + 原片 @时间戳 + 段落列表）

## 二、用户设计决议（关键，按时间）

- **复刻 = 占位按钮**，当前所有实际功能都做「笔记」（视频笔记 / 图文笔记）。笔记页 = NoteShell(`/note`)，内部 `isVideoNote`/`isImageNote` 两分支。复刻页 = VideoResultPage/ImageResultPage(`/video_detail`，占位，**不碰**)。
- **VN1 偏差教训**：VN1 新建了照搬 BiliNote 卡片网格的 CollectionsPage，用户不满 → 已回退，合集入口指回原 LibraryPage(`/library`，昨天工作空间样子)，CollectionsPage 已删（commit `225fb9d`）。**原则：对标布局 / 流程，但配色 / 样式用 Nibi 自己的，不照搬。**
- **基线** = 今天下午改之前 = commit `2e9d540`（2026-06-18，昨天的笔记版本）。
- **`/library` 是对的合集样子；`/note` 是对的笔记版。**
- **处理页**：垂直 timeline → 用户嫌「过于垂直」→ 改**水平 stepper**（对标 BiliNote 图3）。**系统资源不要**；**任务用悬浮**（FloatingTaskQueue 昨天样式），不放「高级详情」。
- **大胆**：用户明确「调用 skill 可以更大胆」（之前我太保守，缩手缩脚）。
- **添加链接弹窗**：用户不满，要大胆改（对标 BiliNote 图2）。
- **架构探讨（待定）**：BiliNote 全在工作台，但 Nibi 有复刻 / 图文 / 音频等多内容，处理 / 结果落在哪要和用户定。

## 三、当前进度（截至 2026-06-20）

**已 commit（main）**：
- VN1 合集(`38041d5`,`9fd86c2`) → 后回退入口(`225fb9d`)
- VN2 新建弹窗三段式+视频卡(`68ca0cd`,`aee22cd`)
- VN3 处理页 5 步+映射(`7778f32`,`f051e8a`)
- VN4.1 顶栏版本下拉(`902da70`,`e7dbf73`) / VN4.2 导出菜单(`75bfadb`) / VN4.3 AI 工具菜单(`e1030e3`)
- 规划文档(`175caae`) / summary presentation(`9434b30`)

**2026-06-20 已 commit（main）**：
- `7523a2b` 处理页水平 stepper + **处理↔结果原地融合**（B'：note 完成在任务页 `/processing/:taskId` 内直接渲染 NoteShell、不跳页；NoteShell 支持外部传 ws/item）
- `d360a70` 首页最近任务卡真实化（真封面 cover_thumbnail + 点击进任务页 + 真标题 video_title/真类型）
- `9986675` 弹窗「合集」文案对齐 + `.m-section` 分组卡片化（起步）

**架构已定**：Q1=b（笔记线保持「点击进页」分页，不做常驻列表+主区）/ Q2=a（处理↔结果原地，已实现 = B'）。

**第 3 步「整体视觉升级」已完成（2026-06-20）**：
- ① 弹窗视觉：`403e30e`（token 化起步）+ `16524a0`（② 段卡片全部内联→token class、修 4 个坏 token surface-2/green-600/border/ink-1、删冗余「存入合集」行、识别封面补 referrerPolicy）
- ② 全局按钮 + 动画：`b312297`（.btn* focus-visible 环 + active 按压 + 显式过渡）
- ③ 首页：`ecedac5`（Hero/RecentTasks token 化）+ `9a857bd`（缩小 hero 让 Composer 上移到中上位 + .composer hover 提升）

**用户反馈连带修的（2026-06-20，本会话）**：
- **C 识别视频无封面** `6c7f2e2`：sniff 对 B站等已知平台只 O(1) 判类型不返回 thumbnail → 无封面时调现成 `GET /link-preview`（B站走 BilibiliNoCookieDownloader、小红书专解析、通用 og:image）补封面，协议相对 URL 补 https。**实测 5177 已显示封面**。
- **D 最近任务无封面、点进才有** `813acff`：根因 usePipelineTasks 以 `include_result=false` 拉列表 → 后端 `to_dict` 清空 result → 往期终态任务无封面；修 = 后端 `list_tasks` 注入 result 展示字段白名单（封面/标题/类型，排除总结 md 等重量级）+ 前端 RecentTasks 补音频封面派生。**实测重启后 7/8 卡有封面**（剩 1 个是 result 全空的旧测试任务）。新增后端回归测试 `test_pipeline_list_result`。
- **E 命名统一为「合集」** `41779ef`：workspace 实体「知识库」→「合集」（Composer 14 处 + WorkspaceList 11 处）；侧边栏/Library/弹窗本就用「合集」，已对齐。

**仍开放的小决策（下次确认）**：
- **命名 A/B 未最终拍板**：当前 = 工作空间叫「合集」、问答/检索功能仍叫「知识库」（`KnowledgeQATab`/`TaskChatPanel`/`SearchPage`/`TabsNav` 4 文件未动）。用户提过「知识库会不会更好理解」（知识库 + 知识库问答 是一套故事）。若改 B = 撤销 `41779ef` + 把侧边栏/Library/弹窗的「合集」也改回「知识库」全局统一。

**下一步候选（视觉对标线，按 BiliNote 4 要点剩余 + 体验）**：
1. **结果页 NoteShell 视觉细化对标**（BiliNote 图1/图4：视频 banner、正文目录 @时间戳、顶栏 chip 行）——VN4.x 已做版本下拉/导出/AI 工具菜单，剩视觉打磨。
2. **命名 A/B 最终拍板**（见上）。
3. 切回功能线见 `docs/AI_HANDOFF.md`「下一步候选」（音频/图片/文本结果页从占位走向可用，范围大需先调查）。
- 视觉用 Nibi 自己的 token，对标布局/流程但不照搬 BiliNote 配色。
