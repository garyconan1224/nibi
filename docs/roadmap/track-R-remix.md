# Track R：复刻（Remix / AI 导演 [C]）

> 来源：原 `docs/ROADMAP.md` §8（拆分于 2026-05-26）。
> 流程图依据：`docs/flows/remix.md`（源图：`场景复刻.png`） + `docs/design/components/director.jsx`

---

## R1 Storyboard shot 网格升级

**索引**：当前 StoryboardPage（markdown 直展）→ 设计稿 storyboard.jsx 的 sb-grid + sb-shot
**模型**：Opus（后端 schema 升级 + 前端复杂状态）
**分支**：`feat/r1-storyboard-shots`
**子任务**：
- R1.1 后端 storyboard_generator 输出结构化 JSON（per shot：编号 / 时长 / 视觉 / 字幕 / 参考帧 id）
- R1.2 StoryboardPage 用结构化数据渲染 shot 网格
- R1.3 兼容旧 markdown 数据（fallback markdown 直展）

---

## R2 生成预览 / .fcpxml 导出

**索引**：设计稿 storyboard.jsx 的「生成预览」「导出 .fcpxml」按钮
**模型**：Opus（外部 API + 文件格式）
**分支**：`feat/r2-storyboard-export`
**子任务**：
- R2.1 .fcpxml 导出（Final Cut XML 格式，可参考开源库）
- R2.2 生成预览（用 ffmpeg 把分镜拼成低分辨率预览视频）
- R2.3 拍板：要不要接图像生成（Midjourney / Flux）补缺失参考帧

---

## R3 Style 报告（= H2.5）

**索引**：设计稿 director.jsx + N9 联想能力扩展
**模型**：Opus
**分支**：`feat/r3-style-report`
**子任务**：
- R3.1 单素材风格 DNA：色调 / 构图 / 节奏 / 调性
- R3.2 多素材聚类 → 风格趋势报告
- R3.3 Taskboard Style Report Tab 启用

---

## R4 A/B Compare（视频版 + AI 导演）

**索引**：设计稿 cmp-* 类（IP.8.1 已通图/文对比，视频/音频缺）
**模型**：Sonnet
**分支**：`feat/r4-video-compare`
**子任务**：
- R4.1 后端 video_compare / audio_compare endpoint
- R4.2 Compare Tab 支持视频/音频类型

---

## R5 AI 导演对话面板（设计稿 s12）

**索引**：设计稿 director.jsx 完整
**模型**：Opus
**分支**：`feat/r5-director-panel`
**子任务**：
- R5.1 完整对话页（不依附 Taskboard）
- R5.2 上下文：可同时挂多个工作空间 + 多素材
- R5.3 一键生成分镜 / 切片 / 翻译 / 重写
