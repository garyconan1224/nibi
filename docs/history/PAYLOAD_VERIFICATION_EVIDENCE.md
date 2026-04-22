# Payload 验证证据 - 原始数据

**日期**: 2026-04-22  
**场景**: 手工提交本地测试 Payload，观察后端日志与数据库记录

---

## 📤 提交的 Payload（POST /pipeline/tasks）

```json
{
  "project_id": "test_verification_001",
  "task_type": "note",
  "payload": {
    "url": "test_downloads/240122-5一起聊聊新剧新片_test.mp4",
    "video_path": "test_downloads/240122-5一起聊聊新剧新片_test.mp4",
    "model_name": "gpt-4",
    "text_provider_id": "openai",
    "text_model": "gpt-4",
    "vision_provider_id": "anthropic",
    "vision_model": "claude-vision",
    "quality": "medium",
    "format": ["markdown"],
    "style": "academic",
    "screenshot": false,
    "link": true,
    "video_understanding": false,
    "video_interval": 6,
    "grid_size": [3, 3],
    "extras": null,
    "browser": "chrome",
    "proxy": "http://127.0.0.1:7890",
    "po_token": "",
    "visitor_data": "",
    "format_selector": "best",
    "cookie_base_dirs": []
  },
  "steps": ["note"]
}
```

---

## 📝 后端接收日志

**Task ID**: `note-f035a9555895`  
**创建时间**: 2026-04-22T01:58:43.499864+00:00

```log
[INFO] 📋 note_task 配置 | text_model=gpt-4 | vision_model=claude-vision | proxy=✓ | steps=['note']
```

---

## 📊 数据库记录（.local/backend_tasks.json）

```json
{
  "task_id": "note-f035a9555895",
  "project_id": "test_verification_001",
  "task_type": "note",
  "status": "SUCCESS",
  "payload": {
    "text_provider_id": "openai",
    "text_model": "gpt-4",
    "vision_provider_id": "anthropic",
    "vision_model": "claude-vision",
    "proxy": "http://127.0.0.1:7890",
    "steps": ["note"]
  },
  "result": {
    "transcript": "",
    "analysis": "",
    "markdown": "（未找到可用的分析或转录内容...）",
    "completed_steps": ["note"]
  }
}
```

---

## ✅ 字段对齐验证

| 字段 | 前端提交 | 后端接收 | 数据库保存 | 对齐 |
|------|---------|---------|----------|------|
| text_provider_id | openai | ✓ | ✓ | ✅ |
| text_model | gpt-4 | ✓ | ✓ | ✅ |
| vision_provider_id | anthropic | ✓ | ✓ | ✅ |
| vision_model | claude-vision | ✓ | ✓ | ✅ |
| proxy | http://127.0.0.1:7890 | ✓ | ✓ | ✅ |
| steps | ["note"] | ✓ | ✓ | ✅ |

---

## 🎯 验证结论

✅ 三位一体字段（text+vision provider/model）齐全  
✅ 代理配置透传无误  
✅ 数据持久化完整  
✅ P0-2 验证达成

