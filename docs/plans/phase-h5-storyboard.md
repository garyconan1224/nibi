---
phase: H5
title: Storyboard 分镜页面 1:1 复刻 + 后端能力评估
status: ready
branch: feat/homepage-h5-storyboard
created: 2026-05-20
priority: P3
estimate_hours: 6-10
depends_on: H4 已合并
---

# H5 Storyboard 分镜页面

> 设计稿源：`docs/design/components/storyboard.jsx`（186 行）
> ⚠️ **后端能力薄**：Pipeline 第 6 步「分镜 Storyboard」当前默认关，N7 未集成 storyboard 输出

## 风险点

1. 后端 `storyboard_generator.py` 存在但**未必能直接对接**——需要先评估输出格式
2. 设计稿里的"生成卡片"按钮如果要接生成模型 API（Midjourney/Flux/SD），属于 `[C] AI 导演` 范畴
3. H5 可能只能做"展示已有 storyboard 数据"，**生成功能押后**

## 子任务

### H5.1 后端能力 spike + 决策
**模型**：**Opus 4.7**（架构决策 + 后端代码评估）
**预计**：2-3h
**操作**：
1. 读 `shared/storyboard_generator.py` 看输出 schema
2. 跑一次现有 storyboard 任务（如有），看产物长啥样
3. 对照设计稿字段：分镜号 / 时长 / 提示词（视觉+文本）/ 参考帧 / 风格参数
4. **决议**写进本文件 D1/D2/D3：
   - D1：H5 只做展示 vs 也做生成？
   - D2：后端 storyboard 数据是否需要重新设计 schema？
   - D3：生成按钮接谁的 API？（押后到 [C] vs 现在用 Qwen-VL 凑合）

### H5.2 StoryboardPage 骨架（视觉 1:1）
**模型**：**Opus 4.7**（跨前后端，需要状态机推理）
**预计**：4-7h
**前置**：H5.1 决议完成
**抓取源**：`docs/design/components/storyboard.jsx` + VidMirror.html `.sb-` `.shot-card` 类
**产出**：
1. `frontend/src/pages/StoryboardPage/index.tsx`
2. 接侧边栏：`/storyboard` 路由从禁用变可用（AppShell 改 disabled: false）
3. 数据加载：从 workspace items 中筛 storyboard 任务的产物

### H5.3 生成按钮（条件可选）
**模型**：**Opus 4.7**
**预计**：可选，2-3h
**前置**：H5.1 D3 决议 = "现在接"
**否则**：留禁用 + tooltip "Phase [C]"

---

## 完工标准

- 用户能从侧边栏「分镜」进入 StoryboardPage
- 显示当前 workspace 已生成的所有分镜任务
- 视觉 1:1 对照设计稿
- 生成按钮若决议押后则禁用 + tooltip
- 后端 `pytest tests/backend -q` 全绿

## 与 [C] AI 导演的关系

- H5 是 [C] 的"前菜"——把展示层先做出来
- 生成模型 API 接入留给 [C]
- 完成 H5 后 [C] 阶段主要做：生成模型 API + 收藏帧的提示词版本 UI + A/B 对比 + 风格 DNA 报告
