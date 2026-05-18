---
phase: 3C
title: 标签库 7 维度（自动打标 + 手动校正 + 按标签筛选）
status: done
estimate_hours: 4-5
actual_hours: ~3.5
model: Opus 4.7 + 小米 2.5 Pro（混合）
branch: feat/phase3c-tag-library
worktree: 否（主目录直接做，与 3B 同模式）
depends_on: [3B]
subtasks: [3C.1, 3C.2, 3C.3, 3C.4, 3C.5, 3C.6]
commits:
  - 4a04c1d feat(phase3c): 3C.1 WorkspaceItem.tags 字段 + 7 维度 config（小米）
  - 606b9f7 feat(phase3c): 3C.2 LLM 自动打标 service + 测试（Opus）
  - d93d001 docs(phase3c): 展开 3C 详细执行计划（6 子任务 + 设计契约）
  - aea7f55 feat(phase3c): 3C.3 tags CRUD + 重新生成端点 + 测试（小米）
  - 52222e5 feat(phase3c): 3C.4 分析任务 SUCCESS 后自动打标钩子（Opus）
  - c1f5b6d feat(phase3c): 3C.5 WorkspaceList 顶部 tag chip 筛选栏 + URL 同步（Opus）
  - 5d9b3ba feat(phase3c): 3C.6 item 结果页 tags 展示 + 重新生成（小米）
  - 2fd8fd3 Merge Phase 3C
completed_date: 2026-05-18
---

## 范围概述

v1.1 设计契约提到的「标签库 7 维度」功能。每个工作空间素材通过 LLM 自动打 6 个系统维度的标签 + 1 个用户自定义维度；用户可手动校正；标签作为筛选维度供 WorkspaceList 使用。

完成 3C 后，**信息架构定型**——这是 Claude Design 介入做完整 UI 翻新的最佳时机。

## 用户决议（2026-05-18 已对齐）

- **Q1 7 维度**：保留 plan 默认 6 个系统维度 + 1 个用户自定义；维度名 / 候选值写在 `shared/config.py` 的 `TAG_DIMENSIONS` 常量里，以后改值不改代码
- **Q2 存储**：`WorkspaceItem.tags: Dict[str, Any]` 新增字段（跟随 `workspace.json` 持久化，不新建文件）
- **Q3 触发**：分析任务完成后**自动跳**调 LLM 打标 + 手动「重新打标」按钮兜底
- **Q4 UI**：`WorkspaceList` 顶部 chip 栏多选筛选

## 设计契约（动手前的硬约定，不要再问）

### Tag 数据形状

```ts
// WorkspaceItem.tags
{
  content_type: "教程",           // 单选 enum
  subject_domain: "科技",          // 单选 enum
  difficulty: "入门",              // 单选 enum
  duration_band: "短",             // 单选 enum
  information_density: "高",       // 单选 enum
  emotion_tone: "中性",            // 单选 enum
  custom_tags: ["前端", "React"],  // 多值字符串数组
  _generated_at?: "ISO8601",       // LLM 生成时戳，手动改后清空
  _generated_model?: "Qwen/..."    // 用了哪个模型
}
```

未打标的 item 该字段为空 dict `{}`。

### 7 维度常量

写在 `shared/config.py`：

```python
TAG_DIMENSIONS = {
    "content_type": {
        "label": "内容类型",
        "choices": ["教程", "访谈", "解说", "纪实", "Vlog", "新闻", "评测", "其它"],
    },
    "subject_domain": {
        "label": "主题领域",
        "choices": ["科技", "人文", "财经", "教育", "娱乐", "生活", "体育", "其它"],
    },
    "difficulty": {
        "label": "难度等级",
        "choices": ["入门", "进阶", "专家"],
    },
    "duration_band": {
        "label": "时长档位",
        "choices": ["短", "中", "长"],  # 短<5min / 中5-30min / 长>30min
    },
    "information_density": {
        "label": "信息密度",
        "choices": ["高", "中", "低"],
    },
    "emotion_tone": {
        "label": "情绪基调",
        "choices": ["中性", "激励", "批判", "幽默", "严肃", "悲情"],
    },
    "custom_tags": {
        "label": "自定义标签",
        "choices": None,  # 自由文本数组
    },
}
```

### LLM 打标接口

`backend/app/services/tag_generator.py::generate_tags(item, workspace)`：
- 输入：WorkspaceItem（必须 results 非空，或能从 task_store 拿到结果，复用 `_resolve_item_results`）
- 输出：dict 形状如上
- 实现：调当前默认 chat provider，prompt 要求返回严格 JSON，温度 0.1
- prompt 模板内嵌 7 维度定义；要求模型只返回 JSON 块

### 触发流程

修改 `backend/app/services/task_runner.py`（或 task hook）：
analyze / text / audio / image 任务 SUCCESS 后，找对应的 item，调 `generate_tags` 写回 item.tags。失败不阻塞主流程（log warning）。

### 筛选语义

WorkspaceList 顶部 chip 栏：每个系统维度一个下拉 chip，多选时**同维度内 OR**、**跨维度 AND**；custom_tags 走「contains 任一」逻辑。筛选**纯前端**做，不走后端接口。

## 子任务（每个一个 commit）

### 3C.1 后端：tags 数据模型 + config（~30min）

- `shared/config.py` 加 `TAG_DIMENSIONS` 常量
- `backend/app/models/workspace.py` 给 `WorkspaceItem` 加 `tags: Dict[str, Any] = field(default_factory=dict)` + `from_dict/to_dict` 兼容
- `tests/backend/test_workspace_tags_model.py`：1 happy（tags 字段往返序列化）+ 1 错误（缺字段时默认空 dict）

**commit**：`feat(phase3c): 3C.1 WorkspaceItem.tags 字段 + 7 维度 config`

### 3C.2 后端：LLM 打标 service（~45min）

- 新增 `backend/app/services/tag_generator.py::generate_tags(item, workspace, *, api_key=None, model=None)`
- 复用 `workspace_knowledge._resolve_item_results` 拿 item 实际产物文本
- prompt 严格 JSON 输出，含 fallback：模型返回非法 JSON 时返回 `{}` + log warning（不抛）
- `tests/backend/test_tag_generator.py`：1 happy（mock provider.chat 返回合法 JSON，断言 6 维度齐全）+ 1 错误（返回非法 JSON → 空 dict）

**commit**：`feat(phase3c): 3C.2 LLM 自动打标 service + 测试`

### 3C.3 后端：tags CRUD 端点（~45min）

- `GET /workspaces/{wid}/items/{iid}/tags` 返回当前 tags
- `PUT /workspaces/{wid}/items/{iid}/tags` 用户手动校正（body 是完整 tags dict，做维度合法性校验）
- `POST /workspaces/{wid}/items/{iid}/tags/regenerate` 重新触发 LLM 打标
- `tests/backend/test_tags_api.py`：3 个 happy（GET / PUT / regenerate）+ 1 错误（PUT 非法维度 → 422）

**commit**：`feat(phase3c): 3C.3 tags CRUD + 重新生成端点 + 测试`

### 3C.4 后端：分析任务 SUCCESS 后自动打标（~30min）

- 在 `task_runner.py` 找到 task SUCCESS 的钩子（参考 `_on_download_success` 套路）
- 任务类型在 `{analyze, text, audio, image}` 且对应 item 当前 `tags` 为空时，异步触发 `generate_tags`
- 失败 log warning 不阻塞
- `tests/backend/test_auto_tag_hook.py`：1 happy（mock generate_tags，断言被调用）+ 1 错误（generate_tags 抛异常 → item.tags 保持原状）

**commit**：`feat(phase3c): 3C.4 分析任务 SUCCESS 后自动打标钩子`

### 3C.5 前端：WorkspaceList 顶部 chip 筛选栏（~1h）

- `types/workspace.ts` 加 tags 字段类型 + 从后端 fetch tag dimensions 配置（或前端硬编码同样一份）
- 新增 `components/workspace/TagFilterBar.tsx`：每个维度一个 dropdown chip，多选；默认收起
- `WorkspaceList.tsx` 顶部挂 TagFilterBar + 在内存中按选中 tags 过滤 workspaces.items
- 筛选状态用 url query string 持久化（`?tags.content_type=教程,访谈&tags.difficulty=入门`），刷新不丢
- tsc --noEmit + 手动跑通

**commit**：`feat(phase3c): 3C.5 WorkspaceList 顶部 tag chip 筛选栏`

### 3C.6 前端：item 详情显示 + 重新生成按钮（~45min）

- 在 4 个 result 页面（VideoResultPage / ImageResultPage / AudioResultPage / TextResultPage）顶部加 tags 展示区
- 每个维度一个 badge，点击 badge 可编辑（弹小气泡选 enum 或编辑 custom_tags）
- 「重新生成标签」按钮调 POST regenerate 端点，loading + toast 成功提示

**commit**：`feat(phase3c): 3C.6 item 结果页 tags 展示 + 编辑 + 重新生成`

## 验收

每个 commit 后跑：
- `pytest tests/backend -q`
- `cd frontend && pnpm tsc --noEmit`

全部完成端到端：
- `./start.sh`
- 在「新疆项目测试」工作空间打开任一已分析素材，点「重新生成标签」→ 应自动填充 6 维度
- 回到 WorkspaceList，顶部 chip 栏勾选某维度 → 列表应实时过滤
- 手动改 chip → 刷新页面 → url query 保留筛选状态

## 风险（遇到立刻停下问用户）

1. LLM 返回 JSON 不稳定（结构错乱 / 返回多个 JSON 块）→ 加 retry + fallback 空 dict
2. 分析钩子时机不对（task_runner 的 success callback 顺序不明确）→ 先 grep `_on_download_success` 套路
3. tags 字段写回时与正在跑的 task 并发冲突 → store 已有 lock，问题不大
4. custom_tags 在 chip 筛选时怎么呈现（dropdown？输入框？）→ 实在不确定时先做「contains 文本框」最小可用版

## 不要做的事

- ❌ 不要改 `shared/knowledge_base.py` 或 3B 检索链路
- ❌ 不要为 tags 单建数据库 / 单建 tags.json 文件（确认走 item.tags 字段）
- ❌ 不要在 LLM 调用里嵌套调用 LLM（保持单次 chat）
- ❌ 不要给 tags 字段单独做版本栈（不像 prompt 需要历史，用户手动改直接覆盖即可）
- ❌ 不要在筛选 UI 里做后端搜索（前端内存过滤）

## 完成后

回到主目录后更新：
1. `docs/PROJECT_EXECUTION_PLAN.md`：勾上 3C 6 个子任务
2. `docs/COMPLETED_WORK.md`：追加完成记录
3. 本文件 frontmatter：`status: done` + 填 `commits` / `completed_date` / `actual_hours`
