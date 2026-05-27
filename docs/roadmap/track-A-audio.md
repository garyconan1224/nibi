# Track A：音频（Audio）

> 来源：原 `docs/ROADMAP.md` §5（拆分于 2026-05-26）。
> 流程图依据：`docs/flows/audio.md`（源图：`音频.png`）——6 任务勾选 + 人声/音乐双路 + 字幕修正

---

## A1 音频前端 6 任务勾选（= F1.2 = IP.9.2）

**索引**：`docs/flows/audio.md` + `pipeline_tasks.py::handle_audio_task`
**模型**：⭐ deepseek v4-pro
**分支**：`feat/ip9-flow-gaps`（已合并入 main）
**子任务**：
- [x] A1.1 Preflight audio 分支补 6 个 checkbox — `cb27dd5`
- [x] A1.2 AudioResultPage 按勾选展示对应区块 — `cb27dd5`
- [x] A1.3 后端 bridge 透传所有 6 个字段（部分 N8 未做的留 TODO）— `d9d3836`

---

## A2 说话人编辑修正 UI（N8b 核心）✅

**索引**：`docs/flows/audio.md` 中"说话人识别"节点 + N8b plan
**模型**：Sonnet（多说话人轨交互复杂）
**分支**：`feat/a2-speaker-edit`（直接打 main）
**完成**：2026-05-23，commit `b559d19`
**子任务**：
- [x] A2.1 音频结果页加说话人轨道 + 标签编辑 — `b559d19`
- [x] A2.2 后端补 PATCH speaker label endpoint — `b559d19`
- [x] A2.3 编辑后产物（speaker mapping）持久化 — `b559d19`

---

## A3 无人声切音乐模式（N8b 第 2 部分）✅

**索引**：`docs/flows/audio.md` 中"无人声 -> 音乐分析"分支
**模型**：⭐ deepseek v4-pro
**分支**：main（直接做）
**完成**：2026-05-23，commit `(pending)`
**子任务**：
- [x] A3.1 VAD 完毕后检测「无人声占比 > 80%」→ 弹模态「切到音乐模式吗」
- [x] A3.2 用户确认后跳过 ASR 直接走音乐分析
- [x] A3.3 多段音乐 6 维度切分 UI
- 注：LLM 逐段 enrich（风格/情绪/乐器/氛围）留作 A3.3b 后续；本次仅 librosa 声学分段

---

## A4 字幕导出 + .srt/.ass/.vtt 格式 ✅

**索引**：`docs/flows/audio.md` 中"字幕导出"分支
**模型**：⭐ deepseek v4-pro
**分支**：`feat/a4-subtitle-export`
**子任务**：
- [x] A4.1 后端字幕生成支持多格式（`2559164`）
- [x] A4.2 前端导出按钮（在 AudioResultPage / VideoResultPage）（`acfb00b`）
- [x] A4 收口修复：overlay 优先读取、display transcript 归一化、demo fixture fallback、测试补齐（`e830889` `9d061dc` `0f4e98f` `476a354`）
