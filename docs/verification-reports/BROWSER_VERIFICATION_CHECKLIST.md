# 🌐 浏览器验证清单

**页面**: http://localhost:5174/settings/providers

---

## 📋 视觉验证清单

### ✅ 页面加载

打开页面后，你应该看到:
- [ ] 页面标题: "提供商管理"
- [ ] 副标题: "配置和管理 AI 提供商"
- [ ] 顶部右侧: "新增提供商" 蓝色按钮

### ✅ 提供商列表显示

列表应显示 4 个提供商卡片:
- [ ] **openai-default** (OpenAI Compatible Default)
  - 类型: openai_compatible
  - 状态: 启用 ✓
  
- [ ] **anthropic-default** (Anthropic Default)
  - 类型: anthropic
  - 状态: 启用 ✓
  
- [ ] **openai_compatible-test-provider** (Test Provider)
  - 类型: openai_compatible
  - 状态: 启用 ✓
  
- [ ] **openai_compatible-test-provider-1** (Test Provider)
  - 类型: openai_compatible
  - 状态: 启用 ✓

---

## 🔧 交互功能验证

### 1️⃣ 展开编辑 (以 openai-default 为例)

**操作**:
1. 点击 openai-default 卡片右侧的 **下箭头** 按钮

**预期效果**:
- [ ] 卡片展开，显示编辑表单
- [ ] 箭头变为上箭头 ▲
- [ ] 显示以下字段:
  - [ ] 提供商名称: "OpenAI Compatible (Default)"
  - [ ] API Key 输入框 (已有值，显示为 ••••••)
  - [ ] Base URL: "https://api.siliconflow.cn/v1/test"
  - [ ] 启用开关: ✓ ON
  - [ ] 保存按钮 (灰色/可用)
  - [ ] 测试连接按钮

**网络请求**:
- 打开浏览器 DevTools (F12)
- 切换到 Network 标签
- 应看到 `GET http://127.0.0.1:8000/providers/openai-default` 请求
- 状态码: 200 OK

### 2️⃣ 测试连接

**操作**:
1. 确保提供商已展开
2. 点击 **测试连接** 按钮

**预期效果**:
- [ ] 按钮变灰并显示加载旋转图标
- [ ] 2-5 秒后显示结果
- [ ] 显示成功提示: ✅ "连接成功" 或信息: "ok: chat_models=86"
- [ ] 如果显示失败，错误信息应清晰

**网络请求**:
- 应看到 `POST http://127.0.0.1:8000/providers/test` 请求
- 请求体: `{"provider_id":"openai-default"}`
- 状态码: 200 OK
- 响应: `{"status":"ok","message":"ok: chat_models=86"}`

### 3️⃣ 编辑和保存

**操作**:
1. 在展开的编辑表单中修改 Base URL
   - 例如: 添加 `/v2` 后缀
2. 点击 **保存** 按钮

**预期效果**:
- [ ] 保存按钮显示加载状态
- [ ] 1-2 秒后显示成功提示
- [ ] 出现 Toast 消息: "保存成功"
- [ ] 编辑表单自动收起
- [ ] 列表显示更新后的数据

**网络请求**:
- 应看到 `PUT http://127.0.0.1:8000/providers/openai-default` 请求
- 状态码: 200 OK

### 4️⃣ 新增提供商 Dialog

**操作**:
1. 点击顶部 **新增提供商** 按钮（蓝色，含 + 图标）

**预期效果**:
- [ ] Dialog 弹出框出现
- [ ] Dialog 标题: "新增提供商"
- [ ] 包含输入字段:
  - [ ] 名称 (文本输入，必填)
  - [ ] 类型 (下拉选择: openai_compatible / anthropic)
  - [ ] API Key (文本输入)
  - [ ] Base URL (文本输入)
- [ ] Dialog 底部按钮:
  - [ ] 取消按钮
  - [ ] 创建按钮

### 5️⃣ 创建新提供商

**操作**:
1. 在 Dialog 中填充表单:
   - 名称: "My Custom Provider"
   - 类型: "openai_compatible"
   - API Key: "sk-my-custom-key"
   - Base URL: "https://api.custom.com"
2. 点击 **创建** 按钮

**预期效果**:
- [ ] 创建按钮显示加载状态
- [ ] 2-3 秒后 Dialog 关闭
- [ ] 显示 Toast 消息: "提供商 'My Custom Provider' 已创建"
- [ ] 列表自动刷新
- [ ] 新提供商出现在列表末尾
- [ ] 新 ID 格式: `openai_compatible-my-custom-provider`

**网络请求**:
- 应看到 `POST http://127.0.0.1:8000/providers` 请求
- 状态码: 200 OK

---

## 🎯 验证完成检查

全部打✓:
- [ ] 页面加载无错误
- [ ] 4 个提供商显示正确
- [ ] 可以展开编辑表单
- [ ] 可以进行保存操作
- [ ] 测试连接返回成功
- [ ] 新增 Dialog 可以打开
- [ ] 可以创建新提供商
- [ ] 没有红色错误或警告
- [ ] 浏览器控制台无 JavaScript 错误

---

## 🐛 故障排查

**问题**: 页面显示空白或加载中

**排查步骤**:
1. 检查浏览器控制台 (F12 → Console)
2. 查看是否有红色错误信息
3. 检查 Network 标签，看 GET /providers 请求是否成功
4. 刷新页面 (Cmd+R 或 Ctrl+R)

**问题**: 提供商列表为空

**排查**:
1. 后端是否运行: curl http://127.0.0.1:8000/health
2. 是否有 CORS 错误: 查看浏览器控制台
3. API 返回内容: curl http://127.0.0.1:8000/providers

**问题**: 保存或测试连接失败

**排查**:
1. 查看浏览器 Network 标签中的响应
2. 查看后端日志 (Terminal 134)
3. 确认 API Key 有效性
4. 确认 Base URL 格式正确

---

## 📸 预期外观

```
┌─────────────────────────────────────────┐
│     提供商管理                  [+ 新增] │
│     配置和管理 AI 提供商               │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ OpenAI Compatible Default    ▼   │  │
│  │ openai_compatible | ✓ 启用        │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ Anthropic Default            ▼   │  │
│  │ anthropic | ✓ 启用               │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ Test Provider (x2)           ▼   │  │
│  │ openai_compatible | ✓ 启用        │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

---

✅ **验证完成后，所有功能都应正常工作**

