# Flow Text Mirrors

本目录是 `docs/conversation-inputs/2026-05-18-spec-merge/*.png` 的 AI 可读文本镜像，用来减少 Claude Code 终端直接读取大图造成的 token 消耗。

## 读取策略

1. 默认先读本目录对应 Markdown。
2. 只有 Markdown 缺失、hash 过期、文字镜像与需求冲突，或任务需要判断版式/颜色/视觉层级时，才读取源 PNG。
3. 读源 PNG 前先说明要验证的具体视觉点，尽量裁剪到相关区域。
4. Markdown 是结构化需求入口；源 PNG 仍是原始视觉事实。

## 索引

| Track | Text mirror | Source image | 用途 |
|---|---|---|---|
| Flow | `overview.md` | `../conversation-inputs/2026-05-18-spec-merge/流程全.png` | 总任务系统、输入层、四大分支、复刻与结果交互 |
| Video | `video.md` | `../conversation-inputs/2026-05-18-spec-merge/视频.png` | 视频 3 条总结路径、字幕清洗、类型模板 |
| Audio | `audio.md` | `../conversation-inputs/2026-05-18-spec-merge/音频.png` | 音频 6 个任务勾选、人声/音乐双路、字幕导出 |
| Image | `image.md` | `../conversation-inputs/2026-05-18-spec-merge/图片.png` | 图片信息、OCR、提示词、联想、多图对比 |
| Text | `text.md` | `../conversation-inputs/2026-05-18-spec-merge/文字.png` | 文字 3 种输入、长文分段、4 类并行任务 |
| Remix | `remix.md` | `../conversation-inputs/2026-05-18-spec-merge/场景复刻.png` | 任务级复刻、结果交互、全流程进度 |

## 更新规则

源图变化时，同步更新对应 Markdown 的 `source_sha256`、`image_size` 和流程内容。若只改工程实现、不改需求图，不需要改本目录。
