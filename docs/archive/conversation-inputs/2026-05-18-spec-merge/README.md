# 2026-05-18 合并 spec 会话 — 输入资料

> 这是 2026-05-18 那次"产出 `docs/SPEC.md` 合并 spec"会话的原始输入资料快照。
> 当时用户给的 prompt：
>
> > "@system_design_for_claude_design_v1 (1).md @system_design_v3_final.md 在增加这个，
> > 我之前想做的流程图，另外说明一下 zip 有些地方我也想修改的，代码也需要完善，
> > 好的基于这个和前面你的分析，看看我该怎么做……"

如果以后要重新走一次"融合需求 → 产出 spec"流程（比如给别的 AI 看历史决议来源），整套资料在这。

---

## 文件清单

### Markdown 文档（2 份）

| 文件 | 来源 | 当前归档位置 |
|---|---|---|
| `system_design_v3_final.md` | 用户上传的 v3 设计文档（1115 行） | `docs/archive/spec-v3.md` |
| `system_design_for_claude_design_v1.md` | 用户上传的 v1 设计文档 | `docs/archive/design-spec-v1.md` |

> 本目录里的是**原始命名副本**，方便用户/其他 AI 直接拿去用；权威归档版本在 `docs/archive/` 下。

### 流程图截图与文本镜像

那次对话用户贴了流程图截图；当前目录已保留源 PNG，`docs/flows/` 已建立 Claude Code 终端优先读取的 Markdown 文本镜像：

| # | 内容 | 源 PNG | 文本镜像 |
|---|---|---|---|
| 1 | 多媒体内容分析系统完整最终流程图（总图） | `流程全.png` | [`../../flows/overview.md`](../../flows/overview.md) |
| 2 | 视频分支详细流程图（含三条总结路径） | `视频.png` | [`../../flows/video.md`](../../flows/video.md) |
| 3 | 音频分支详细流程图（含 VAD 双路 / 音乐分析） | `音频.png` | [`../../flows/audio.md`](../../flows/audio.md) |
| 4 | 图片分支流程图（输入 -> 基本信息 -> 任务勾选） | `图片.png` | [`../../flows/image.md`](../../flows/image.md) |
| 5 | 文字分支流程图（三种输入 / 并行任务） | `文字.png` | [`../../flows/text.md`](../../flows/text.md) |
| 6 | 复刻路径 / AI 导演方向 | `场景复刻.png` | [`../../flows/remix.md`](../../flows/remix.md) |

读取建议：Claude Code 终端先读文本镜像，只有要核对视觉布局、颜色层级或文本镜像过期时再读取源 PNG。

---

## 最终产出（基于这些输入做的）

- [`docs/SPEC.md`](../../SPEC.md) — 8 模块合并 spec（1100+ 行）
- [`docs/EXECUTION_PLAN.md`](../../EXECUTION_PLAN.md) — N1~N11 phase 路线
- [`docs/WORKFLOW.md`](../../WORKFLOW.md) — 主工作流

如果以后产品方向调整需要回看原始决议来源，从本目录的两份 md + 源 PNG + `docs/flows/*.md` 入手最完整。
