# Outstanding Tasks

> ⚠️ 本文件是「下一步该做什么」的快照。**写入前必须先 `git log --oneline -20` 对账**，避免把已完成阶段当作待办。

Last updated: 2026-05-19（N8 完成，进入 N9）

---

## P0 — 当前 main 基线

- 最新合并：N8 音频分支（silero-vad / pyannote / librosa Suno-Udio）已入 main。
- N1~N8 全部完成，阶段 [B] N1~N11 落地差异进行中。
- 详细进度见 `docs/EXECUTION_PLAN.md`。

## P0 — 下一步

**N9 图片分支补全**（详见 `docs/AI_HANDOFF.md` 的 N9 开工交接段）。

- 估时：6-8h
- 优先级：P2
- 推荐模型：Sonnet 4.6
- 分支：`feat/phase-n9-image`
- 具体范围：PaddleOCR / 4 联想方向 / 多图对比

## P1 — N9 之后

按 `docs/EXECUTION_PLAN.md` 的 N1~N11 路线依次推进：
- N10 文字分支补全（6-8h）
- N11 砍掉的 UI 清理（1-2h）
- N1b 磁盘布局重构（2-3h）

## 长期遗留技术债

- Streamlit 旧入口冻结，除非用户明确要求维护。
- 持续把文档对齐到 FastAPI + React/Vite 主线。
- Push 策略：所有 push 暂缓到 [D] 开源准备阶段。
