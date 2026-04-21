# 三位一体模型独立选择 + 代理配置迁移 验证清单

## 阶段 1：前端表单结构验证

### 1.1 NoteForm 布局
- [ ] 打开 HomePage，进入笔记创建表单
- [ ] 验证显示了三个独立的"提供商 + 模型"选择器对：
  - [ ] 文本模型（提供商 + 模型）
  - [ ] 音频模型（提供商 + 模型）
  - [ ] 视频模型（提供商 + 模型）
- [ ] 验证各选择器可以独立选择不同的提供商

### 1.2 表单布局平铺化
- [ ] 主表单中直接显示：
  - [ ] 处理质量（radio button）
  - [ ] 笔记格式（checkbox 多选）
  - [ ] 笔记风格（radio button）
  - [ ] 视觉理解开关
  - [ ] 抽帧间隔输入框
  - [ ] 网格拼图输入框
- [ ] 不需要点击"高级选项"即可看到上述字段

### 1.3 代理配置位置
- [ ] NoteForm 中不存在 HTTP 代理输入框 ✅
- [ ] 代理配置在 Settings → Providers 页面中 ✅

## 阶段 2：设置页面验证

### 2.1 代理设置卡片
- [ ] 打开 SettingPage → Providers 标签
- [ ] 页面顶部显示"全局 HTTP 代理"卡片
- [ ] 可输入代理地址（如 `http://127.0.0.1:7890`）
- [ ] 点击"保存代理设置"后，本地存储中 configStore 更新
- [ ] 刷新页面后，代理设置仍然保存

### 2.2 高级选项收起
- [ ] 高级选项中只有：
  - [ ] 执行步骤（checkbox）
  - [ ] 插入截图（switch）
  - [ ] 保留原始链接（switch）
  - [ ] 额外说明（textarea）

## 阶段 3：表单提交流程验证

### 3.1 configStore 持久化
- [ ] 在表单中选择：
  - text_provider_id = "openai", text_model = "gpt-4"
  - audio_provider_id = "groq", audio_model = "groq-whisper"
  - video_provider_id = "anthropic", video_model = "claude-vision"
- [ ] 提交表单后，打开浏览器 DevTools
- [ ] 在 Application → Storage → Local Storage → config-storage 中验证：
  - [ ] `textProviderId: "openai"`
  - [ ] `audioProviderId: "groq"`
  - [ ] `visionProviderId: "anthropic"`

### 3.2 Payload 结构
- [ ] 打开 Network 标签，提交表单
- [ ] 找到 POST `/pipeline/tasks` 请求
- [ ] 检查 payload 中包含：
  - [ ] `text_provider_id: "openai"`
  - [ ] `audio_provider_id: "groq"`
  - [ ] `vision_provider_id: "anthropic"`
  - [ ] `proxy: "http://127.0.0.1:7890"` (从全局设置读取)
  - [ ] 不包含 `provider_id`（旧单一提供商字段）

## 阶段 4：后端日志验证

### 4.1 本地上传场景 (Steps 剔除 download)
- [ ] 上传本地 MP4 文件（已存在于项目目录）
- [ ] 创建笔记任务，仅勾选 steps: ["note"]
- [ ] 查看任务日志，应该看到：
  ```
  📋 note_task 配置 | text_model=gpt-4 | audio_model=groq-whisper | vision_model=claude-vision | proxy=✓ | steps=['note']
  ```
- [ ] 验证日志中 download step 被跳过

### 4.2 YouTube 下载场景
- [ ] 输入 YouTube 链接（需要网络 + 可选代理）
- [ ] 创建笔记任务，所有 steps 都勾选
- [ ] 查看任务日志，应该看到：
  - [ ] note_task 配置日志（含三位模型）
  - [ ] 下载速度显示 MB/s 单位（或 KiB/s）
  - [ ] 所有三个模型都在后续的 analyze/transcribe 步骤中被使用

## 阶段 5：端到端集成测试

### 5.1 本地 MP4 文件
```bash
cd /Users/conan/Desktop/nibi/frontend
pnpm test  # 运行前端 vitest

cd /Users/conan/Desktop/nibi/tests
pytest test_three_part_model_selection.py -v
```

### 5.2 手动 E2E（可选，需 API keys）
- [ ] 选择三个不同提供商的模型
- [ ] 配置全局代理（可选）
- [ ] 上传或输入 YouTube 链接
- [ ] 完整执行 download → transcribe → analyze → note 流程
- [ ] 验证最终笔记内容正确生成

## 成功标志 ✅

所有以上步骤无误时，三位一体模型独立选择 + 代理配置迁移完成：
- ✅ 前端允许为三个模型各选不同提供商
- ✅ configStore 分别存储三个 provider_id
- ✅ Payload 正确下发 text_provider_id / audio_provider_id / vision_provider_id
- ✅ HTTP 代理从全局设置读取，不在任务表单中
- ✅ 后端日志清晰显示所有模型配置
- ✅ 下载速度单位正确（MB/s）

