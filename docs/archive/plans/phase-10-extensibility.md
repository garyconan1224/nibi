---
phase: 10
title: 插件 / 扩展性（自定义分析模板 / 用户脚本 / 命令面板）
status: archived
estimate_hours: 8
model: Opus 4.7
branch: feat/phase10-extensibility
worktree: 是
depends_on: [9]
---

> ⚠️ **已归档**：本计划已被 `docs/SPEC.md` 取代，不再参与执行。保留作历史参考。

## 范围概述

让高级用户/开发者能扩展项目能力，不用 fork 仓库改源码。

## TODO

**进入此阶段时再展开操作步骤。** 候选功能：
1. **自定义分析模板**：用户在 UI 里写"提示词 + 输出 schema"模板，保存后能选用
2. **用户脚本（Python plugin）**：定义插件 API（`PluginContext` / hooks 钩点），用户写 .py 文件丢到 `plugins/` 目录自动加载
3. **命令面板**：Cmd+K 快速调起任意操作（新建任务 / 搜索 / 跳工作空间）
4. **快捷键体系**：全局 key binding 配置页
5. **第三方分析器对接**：开放分析器接口，让用户接入自己的视觉模型 / NLP pipeline
6. **MCP server**：把本项目能力暴露成 MCP server，让 Claude Desktop / Cursor 等工具直接调用
