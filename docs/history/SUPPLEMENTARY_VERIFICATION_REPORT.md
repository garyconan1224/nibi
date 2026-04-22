# 补充验证报告 - AnalyzeView/StoryboardPanel 字段对齐

**日期**: 2026-04-22  
**主题**: 分析 analyze/storyboard 任务的 result 结构与前端骨架的适配情况

---

## 🔴 核心问题

### AnalyzeView 期望字段缺失

**前端期望**: `result.summary`, `result.keyframes`  
**当前问题**: 这两个字段完全缺失 ❌

**解决方案**: 修改 `handle_analyze_task()` 或 `handle_note_task()`，在返回前解析 JSON 并提升字段到 result 顶层。

---

## 📋 待修复清单

**优先级**: P1（功能缺口）

### 修改建议

**文件**: `backend/app/services/pipeline_tasks.py`  
**函数**: `handle_analyze_task()` 和/或 `handle_note_task()`  
**修改点**: analyze 步骤完成后，补充以下逻辑：

```python
# 在 json_paths = sorted(...) 之前或之后
if json_basenames:
    json_file = Path(json_output_dir) / json_basenames[0]
    if json_file.exists():
        import json
        try:
            with open(json_file) as f:
                json_data = json.load(f)
            result_dict["summary"] = json_data.get("global_visual_summary", "")
            result_dict["keyframes"] = json_data.get("frames", [])
        except Exception:
            pass  # 降级处理，缺失这两个字段
```

---

## 📊 字段映射表

| 组件 | 期望字段 | 后端产出位置 | 状态 |
|------|---------|------------|------|
| AnalyzeView | summary | JSON 文件: `global_visual_summary` | ❌ 缺失 |
| AnalyzeView | keyframes | JSON 文件: `frames[]` | ❌ 缺失 |
| StoryboardPanel | plan_a | result.plan_a | ✅ 齐全 |
| StoryboardPanel | plan_b | result.plan_b | ✅ 齐全 |
| StoryboardPanel | plan_c | result.plan_c | ✅ 齐全 |

---

## ✅ StoryboardPanel 容错设计

```typescript
const plan = storyboard[p] ?? storyboard[`plan_${p}`]
```

StoryboardPanel 已能兼容 `A`/`B`/`C` 或 `plan_A`/`plan_B`/`plan_C` 两种键名，无需修复。

---

## 🎯 后续行动

1. 修改 `pipeline_tasks.py` 提升 `summary` / `keyframes` 字段
2. 测试完整 steps=['download','transcribe','analyze','note']
3. 验证 AnalyzeView 展示
4. 将此项标记为 **P1 完成**

**优先级**: P1（功能缺口），应在 P0-2 验证后优先修复

