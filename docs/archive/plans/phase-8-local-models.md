---
phase: 8
title: 本地模型 / 私有化（Ollama / LM Studio / 完全离线）
status: archived
estimate_hours: 6
model: Opus 4.7（涉及多供应商架构）
branch: feat/phase8-local-models
worktree: 是
depends_on: [7]
---

> ⚠️ **已归档**：本计划已被 `docs/SPEC.md` 取代，不再参与执行。保留作历史参考。

## 范围概述

让项目支持完全本地运行：chat / embedding / rerank / ASR 全部走本地模型，可断网使用。目标用户：注重数据隐私 / 网络受限 / 想省 API 费用的用户。

## TODO

**进入此阶段时再展开操作步骤。** 候选工作：
1. **Provider 抽象**：现有 `src/vidmirror/core/providers/` 已经有抽象层，扩展支持 Ollama / LM Studio / vLLM
2. **本地 embedding**：sentence-transformers / bge-m3 本地版替代 SiliconFlow embeddings
3. **本地 rerank**：bge-reranker 本地版
4. **ASR 调优**：fast-whisper 已支持，做本地推理性能优化 + 模型自动下载提示
5. **本地视觉模型**：Qwen2-VL / InternVL 本地版替代 GPT-4V 类
6. **设置页加"运行模式"切换**：云端 / 本地 / 混合
