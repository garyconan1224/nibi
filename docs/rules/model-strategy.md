# 模型选择策略（四档决策树）

> 本文件由 `CLAUDE.md` §7 索引指向。**用户决定用哪档模型时查阅，AI 仅在被问到时引用。**

---

## 背景

用户同时使用：

- **桌面 Claude Code**（按额度计费的 Opus / Sonnet / Haiku）
- **Claude Code + ccswitch 接 DeepSeek**（DS，按量计费但比 Claude 便宜）

**ccswitch 是透明中转代理**：在 Claude Code 里选 Sonnet/Opus 角色 → ccswitch 自动路由到 `deepseek-v4-pro`；选 Haiku 角色 → 路由到 `deepseek-v4-flash`。

**按以下顺序判断，命中即停**：

---

## 档 1 — Opus 4.7（桌面，付费）：复杂阶段 + 升级触发

**任一命中即用**：

- Phase 1D / 1F / 1G（跨后端+前端+状态机的复杂阶段）
- 跨文件改动 ≥ 5
- schema 迁移 + 老数据兼容
- 加密 / 鉴权 / API key
- SSE / WebSocket / 状态机一致性
- 三轨时间轴 / RAG 检索逻辑设计
- AI 自己说"不太确定哪个方案对"

---

## 档 2 — Sonnet 4.6（桌面，付费）：中等复杂多文件

- 多文件 CRUD（3–5 个文件）
- 组件级前端开发（新建 React 组件 + 接 API）
- 需要严谨业务理解但不烧脑的任务
- Phase 1B / 1C / 1E 的前端部分

---

## 档 3 — deepseek v4-pro（Claude Code + ccswitch，⭐便宜优先）：简单任务默认

**这一档是日常默认**。在 Claude Code 里选 Sonnet 或 Opus 角色，ccswitch 自动路由到 `deepseek-v4-pro`。**能用就用，不要因为"DS 可能不够强"而升到桌面 Sonnet 浪费 Claude 付费额度**。

**适用场景**：

- git 操作（add / commit / merge / branch / push / 清理 worktree）
- 跑终端命令验证（pytest happy path、pnpm build、curl 测接口、启动 dev server）
- 文档改写（README / docs/*.md / 注释润色 / CLAUDE.md 维护）
- 模板代码（pytest happy path、CRUD 路由骨架、Pydantic schema）
- CSS token 翻译、Tailwind 配置调整
- 重复性改写（i18n key 抽取、批量 import 修改）
- 单文件简单查询 / 解释代码
- 查文档（fastapi / vite / tailwind 用法）

**DS 的工具能力**：Bash / Read / Write / Edit / Grep / Glob 全套都能用，可独立完成 git 提交、跑测试、改文件。

**deepseek v4-pro 不擅长 → 升档 1 Opus**：

- 跨 5+ 文件架构
- 复杂状态机推理
- 加密鉴权细节
- RAG / SSE 一致性

---

## 档 4 — deepseek v4-flash / Haiku 4.5：极简兜底

- 单行修改 / typo
- 短得不值得用 pro 的任务（< 2 分钟）
- 优先 **deepseek v4-flash**（Claude Code 里选 Haiku 角色，ccswitch 中转到 `deepseek-v4-flash`，比桌面 Haiku 更便宜）；DS 不可用时再用桌面 Haiku 4.5

> ⚠️ **不要让 v4-flash 当日常默认**：它对应原 Haiku 档，能力弱，多文件 CRUD / 组件级前端会翻车。日常默认必须 v4-pro。

---

## Phase 启动速查

开工前对照 `docs/EXECUTION_PLAN.md` + 本文件四档决策：

- **当前阶段：N11 后收口决策点**。`[A]` 现状同步与 `[B]` N1~N11 落地差异已完成。
- **可选下一步**：`.git` 历史瘦身（需用户明确授权）/ `N1b` / `N7b` / `N8b` / `[C] AI 导演` / `[D] 开源准备`。
- **[C] AI 导演**：需先补完整 director 设计，再进入实现。
- **简单阶段**（N1 / N2 / N3 / N11 等纯前后端 CRUD）：⭐ deepseek v4-pro（Claude Code + ccswitch，便宜）/ Sonnet 4.6，**不开 worktree**。
- **复杂阶段**（N5 Preflight 抽屉子参数细化 / N6 任务级 LLM 对话 + RAG / N7 视频镜头分析）：**Opus 4.7 + 新 worktree**（`feat/phase<N>-<短名>` 分支）。

### 决策速查表

| 任务特征 | 推荐模型 |
|---|---|
| 复杂 / SSE / 状态机 / 加密 | Opus 4.7 |
| 中等多文件 CRUD | Sonnet 4.6 |
| git / 测试 / 文档 / 模板 | deepseek v4-pro（ccswitch）|
| 单行 typo | deepseek v4-flash（ccswitch）/ Haiku |
