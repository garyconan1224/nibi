# AnalyzeView / StoryboardPanel 骨架字段对齐分析

**日期**: 2026-04-22  
**目的**: 验证后端 result 结构与前端骨架字段的匹配度

---

## 📋 问题发现

### 1. **AnalyzeView 期望的字段**

```typescript
const summary = result.summary        // 期望字段：摘要
const keyframes = result.keyframes    // 期望字段：关键帧
```

### 2. **后端 analyze 步骤的实际产出**

```python
# handle_analyze_task() 返回结构
return {
    "json_paths": [...],              # 视觉数据 JSON 文件列表
    "json_basenames": [...],          # 文件名列表
    "live_preview": {                 # 实时预览
        "snapshots": [...],           # 分析进度快照
        "recent_frames": [...]        # 最近帧数据
    }
}
```

### 3. **video_analyzer.py 中 JSON 文件内容**

```json
{
  "video_title": "视频标题",
  "product_name": "产品名称",
  "global_visual_summary": "全局视觉摘要",    // 对应 AnalyzeView.summary
  "frames": [
    {
      "timestamp": "00:00:06",
      "description_zh": "场景描述",
      "image_prompt_en": "图像 Prompt"
    }
  ]                                            // 对应 AnalyzeView.keyframes
}
```

### 4. **Storyboard 任务的 result 产出**

```python
# run_storyboard_generation() 返回结构
return {
    "plan_a": "分镜脚本方案A文本",
    "plan_b": "分镜脚本方案B文本",
    "plan_c": "分镜脚本方案C文本",
    "vision_report": "视觉分析报告",
    "web_context_used": "网页检索结果片段",
    "artifact_path": "缓存文件路径"
}
```

---

## 🔴 **字段对齐问题总结**

| 任务类型 | 前端期望 | 当前后端 result | 实际位置 | 对齐状态 |
|---------|---------|-----------------|---------|---------|
| **analyze** | `summary` | ❌ 无 | JSON 文件: `global_visual_summary` | ❌ 不匹配 |
| **analyze** | `keyframes` | ❌ 无 | JSON 文件: `frames[]` | ❌ 不匹配 |
| **analyze** | `analysis` | ✅ 有 | result.analysis | ✅ 匹配 |
| **analyze** | `markdown` | ✅ 有 | result.markdown | ✅ 匹配 |
| **storyboard** | `A` / `plan_A` | ✅ 有 | result.plan_a | ✅ 匹配 |
| **storyboard** | `B` / `plan_B` | ✅ 有 | result.plan_b | ✅ 匹配 |
| **storyboard** | `C` / `plan_C` | ✅ 有 | result.plan_c | ✅ 匹配 |

## ✅ 建议解决方案

### **方案 A: 后端提升 result（推荐）**

在 `handle_analyze_task()` 或 `handle_note_task()` 中，解析 JSON 文件并提升字段：

```python
json_file = Path(json_output_dir) / json_basenames[0]
json_data = json.load(open(json_file))
result["summary"] = json_data.get("global_visual_summary", "")
result["keyframes"] = json_data.get("frames", [])
```

**优点**: 前端无需改动，直接可用  
**缺点**: 增加后端处理逻辑

---

## 🎯 当前状态判定

- P0-2 (三位一体 Payload): ✅ **完成**
- AnalyzeView 骨架对齐: ❌ **关键问题**: `summary`/`keyframes` 缺失
- StoryboardPanel 骨架对齐: ✅ **正常**: `plan_a/b/c` 已匹配

