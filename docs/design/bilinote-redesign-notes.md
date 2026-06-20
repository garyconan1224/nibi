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

**未 commit（工作树，待用户看顺眼再提交）**：
- 处理页精致化 → 水平 stepper：`StepProgress.tsx` / `processing.css` / `ProcessingPage`（5 步区居中 + 自动跳转）/ `FloatingTaskQueue`（处理页隐藏 —— 本轮要改回悬浮）

**待办**：
- [进行中] 处理页：删系统资源、任务恢复悬浮
- 添加链接弹窗大胆改（对标图2）
- 架构探讨（BiliNote 工作台 vs Nibi 多内容）
- 整体布局比例（该大该小）
