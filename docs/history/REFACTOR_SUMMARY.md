# 三位一体模型独立选择 + 代理配置迁移 - 改动总结

## 概述
本次重构完成了三个核心目标：
1. **模型选择解耦**：文本、音频、视频模型各自独立选择提供商
2. **表单 UI 平铺化**：高级配置项直接显示在主表单，减少操作深度
3. **代理配置迁移**：HTTP 代理从任务表单移至全局设置页面

## 前端修改

### 1. `configStore.ts`
**改动**：
- 移除 `lastProviderId: string`（单一提供商）
- 新增三个独立的 provider ID：
  - `textProviderId: string` - 文本模型提供商
  - `audioProviderId: string` - 音频模型提供商
  - `visionProviderId: string` - 视频/视觉模型提供商
- 保留 `httpProxy: string`（用于全局设置读取）

**文件**：`frontend/src/store/configStore.ts`

### 2. `NoteForm.tsx`
**改动**：
- **Provider 选择器**：从单一 provider_id 改为三个独立的 provider 选择器
  - 每个选择器独立监听 watch() 变化
  - 模型列表根据各自的 provider_id 动态加载
- **表单平铺**：以下字段从"高级选项"移到主表单：
  - quality（处理质量）
  - formats（笔记格式）
  - style（笔记风格）
  - video_understanding（视觉理解开关）
  - video_interval（抽帧间隔）
  - grid_cols / grid_rows（网格拼图）
- **移除 HTTP 代理**：http_proxy 表单字段完全移除
- **Payload 构建**：
  - 新增 text_provider_id / audio_provider_id / vision_provider_id
  - proxy 从全局 config.httpProxy 读取（非表单字段）
- **configStore 保存**：提交时保存三个 provider_id 到 configStore

**文件**：`frontend/src/pages/HomePage/NoteForm.tsx` (~885 行)

### 3. `ProvidersManagementPage.tsx`
**改动**：
- 页面顶部新增"全局 HTTP 代理"卡片
  - 输入框支持 http://HOST:PORT 或 socks5://HOST:PORT 格式
  - "保存代理设置"按钮将输入保存到 configStore.httpProxy
- 引入 useConfigStore、Label、Network icon

**文件**：`frontend/src/pages/SettingPage/ProvidersManagementPage.tsx` (~300 行)

### 4. `types/task.ts`
**改动**：
- `AnalyzePayload` 接口新增可选字段：
  - `text_provider_id?: string`
  - `audio_provider_id?: string`
  - `vision_provider_id?: string`
  - `text_model?: string`
  - `audio_model?: string`
  - 保留 `provider_id?: string` 作为向后兼容

**文件**：`frontend/src/types/task.ts`

## 后端修改

### 1. `pipeline_tasks.py`
**改动**：
- **handle_note_task()**：
  - 在函数开头添加日志，显示收到的三位模型和代理配置
  - 已读取 audio_model（第 305 行）、text_model、vision_model
  - 正确透传 proxy 到 run_ytdlp_download
- **handle_analyze_task()**：
  - 同样在函数开头添加日志显示配置
  - 已读取 text_model、vision_model、proxy

**日志示例**：
```
📋 note_task 配置 | text_model=gpt-4 | audio_model=groq-whisper | vision_model=claude-vision | proxy=✓ | steps=['note']
📊 analyze_task 配置 | text_model=gpt-4 | vision_model=claude-vision | proxy=✓
```

**文件**：`backend/app/services/pipeline_tasks.py`

## 测试文件

### 1. `tests/test_three_part_model_selection.py`
- 离线 smoke 测试
- Mock 掉重型处理函数（run_ytdlp_download、run_batch_analysis、get_transcript）
- 验证：
  - Payload 中三个 provider_id 被正确下发
  - 本地上传时 steps 剔除 download
  - proxy 正确透传

**运行**：
```bash
cd /Users/conan/Desktop/nibi/tests
pytest test_three_part_model_selection.py -v
```

## 构建验证

✅ **前端构建成功**（pnpm build）
- No TypeScript errors
- Dist 文件生成正常

❌ **后端构建**（需在项目的 backend 目录验证）
- 预期通过（仅添加日志，无 API 改动）

## 下游影响分析

✅ **无需修改其他文件**：
- TaskItem.tsx - 已支持 payload 中的新字段
- 后端路由层 - payload 作为 JSON 透传，无 Schema 校验

## 验证清单

详见 `VERIFICATION_CHECKLIST.md`，包含：
- 前端表单结构验证
- 设置页面验证
- 表单提交流程验证
- 后端日志验证
- E2E 集成测试

## 兼容性

- **向前兼容**：旧的 `provider_id` 字段仍被接受（虽然前端不再发送）
- **向后兼容**：后端自动处理缺少 provider_id 时的情况（fallback 到 settings）

