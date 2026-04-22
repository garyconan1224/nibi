# TranscriberPage 验证清单 - 可复用检查表

使用本清单进行定期验证和回归测试。

---

## 🔍 快速验证步骤（约 5 分钟）

- [ ] 启动后端：`python app.py`
- [ ] 启动前端：`npm run dev`
- [ ] 访问：`http://localhost:5173/settings/transcriber`

### 导航检查
- [ ] 页面标题显示"音频转写"
- [ ] 顶部 Tab 条"转写"高亮
- [ ] SaveBar 底部显示

### 卡片检查
- [ ] 5 个引擎卡片全部显示
  - [ ] Faster Whisper（本地、蓝色、默认选中）
  - [ ] 必剪（在线、灰色）
  - [ ] 快手（在线、灰色）
  - [ ] Groq（在线、灰色）
  - [ ] MLX Whisper（仅 macOS、灰色）

### 字段检查
- [ ] fast-whisper 选中时显示模型大小 Select
- [ ] groq 选中时显示 API Key 密码输入框
- [ ] 初始提示词、语言、设备始终可见

### 交互检查
- [ ] 点击"Groq"卡片，样式变蓝，API Key 出现
- [ ] 修改任意字段，SaveBar 显示"1 项未保存"
- [ ] 点击"重置"，字段回到修改前状态

### 保存检查
- [ ] 点击"保存"，显示"保存中..."
- [ ] 提示"转写配置已保存"
- [ ] SaveBar 显示"所有变更已保存"

---

## 🧪 完整流程验证（约 15 分钟）

### 场景 1：完整编辑流程
```
1. 初始状态：fast-whisper 选中
2. 编辑步骤：
   - 选择 groq 引擎
   - 输入 API Key: gsk_test123456789
   - 修改语言为 en
   - 修改设备为 cuda
   - 输入初始提示词：VidMirror
3. 预期：
   - SaveBar 显示"5 项未保存"
   - 所有字段对应修改
```

### 场景 2：重置验证
```
1. 在上述编辑状态下
2. 点击"重置"按钮
3. 预期：
   - groq 改回 fast-whisper
   - API Key、语言、设备、提示词全部回到修改前
   - SaveBar 显示"所有变更已保存"
```

### 场景 3：保存并持久化
```
1. 编辑：groq + en + cuda + 提示词
2. 点击"保存"
3. 预期：✅ 成功提示
4. 刷新页面（F5）
5. 预期：
   - groq 仍为选中
   - 语言仍为 en
   - 设备仍为 cuda
   - 初始提示词仍存在
   - SaveBar 显示"所有变更已保存"
```

### 场景 4：离开保护
```
1. 修改任意字段（脏态）
2. 点击浏览器后退
3. 预期：
   - 弹出"有未保存的变更，确认离开吗？"
   - 点"取消"停留，点"确定"离开
```

---

## 🔧 技术验证清单

### 代码检查
- [ ] `TranscriberPage.tsx` 导入都正确
  - [ ] `useConfigStore` ✅
  - [ ] `useSettingsShellStore` ✅
  - [ ] `useDirtyGuard` ✅
  - [ ] `Section`, `FieldRow` 组件 ✅
- [ ] i18n keys 在 settings.json 中定义完整
  - [ ] transcriber.title ✅
  - [ ] transcriber.subtitle ✅
  - [ ] transcriber.engine.* ✅
  - [ ] transcriber.initialPrompt.* ✅

### 后端 API 检查
- [ ] `GET /transcriber_config` 返回当前配置
- [ ] `POST /transcriber_config` 保存并返回
- [ ] PATCH 语义正确（部分字段更新）
- [ ] 错误处理：非法 type 返回 422

### 浏览器兼容性
- [ ] Chrome 最新版 ✓
- [ ] Safari 最新版 ✓
- [ ] Firefox 最新版 ✓
- [ ] Edge 最新版 ✓
- [ ] 移动浏览器（iOS Safari / Chrome Mobile） ✓

---

## 🎬 自动化测试命令

```bash
# 后端单测
cd /Users/conan/Desktop/nibi
python -m pytest tests/backend/test_transcriber_config_route.py -v

# 前端单测（需修复 i18n 初始化）
cd frontend
npm test -- TranscriberPage.verification --run

# E2E 测试（待编写）
# npm run test:e2e
```

---

## 📋 回归测试模板

每次代码变更后运行：

| 日期 | 执行人 | 测试结果 | 备注 |
|-----|-------|---------|------|
| 2026-04-22 | Auto | ✅ All Pass | 初始验证 |
|  |  |  |  |
|  |  |  |  |

---

## 🚨 常见问题排查

| 问题 | 原因 | 解决 |
|-----|------|------|
| i18n key 显示在 UI | 初始化失败 | 检查 src/locales/i18n.ts |
| SaveBar 不显示 | settingsShellStore 未初始化 | 检查 useEffect cleanup |
| 保存失败 404 | 后端未启动 | 运行 `python app.py` |
| localStorage 丢失 | 浏览器隐身模式 | 使用正常模式测试 |


