# M2 音频转写模块 — 完成总结

**完成日期**：2026-04-22 18:00 UTC  
**工作量**：0.5d  
**优先级**：P0（基础模块）

---

## 📋 完成清单

### ✅ 卡片式引擎选择器（已完成）
- **UI 组件**：5 个引擎卡片（fast-whisper、bcut、kuaishou、groq、mlx-whisper）
- **交互模式**：点击卡片切换引擎 + 视觉反馈（选中态 border-primary + bg-primary/5）
- **徽章标识**：Local/Online 徽章，视觉区分（default/secondary 变体）
- **平台过滤**：mlx-whisper 仅在 macOS 显示（navigator.userAgent 检测）
- **响应式布局**：`grid gap-3 sm:grid-cols-2`（手机 1 列，桌面 2 列）

### ✅ initial_prompt 字段（已完成）
- **UI 组件**：Textarea（min-h-20）+ FieldRow 布局
- **脏数据追踪**：dirty.initial_prompt 指示修改状态
- **草稿管理**：setDraft 本地管理 + useDirtyGuard 保护
- **后端持久化**：POST /transcriber_config 支持 initial_prompt
- **configStore 同步**：setConfig({ transcriber.initialPrompt }) 更新 localStorage

### ✅ 在线引擎 ToS 提示（新增）
- **条件渲染**：仅当选中 bcut/kuaishou/groq 时显示
- **警告样式**：Alert 组件 + amber-200/50 背景 + AlertCircle 图标
- **多语言文案**：zh-CN + en-US 完整覆盖
- **三种提示**：针对 bcut/kuaishou/groq 各有不同内容

### ✅ 类型安全（验证）
- **TypeScript 编译**：tsc --noEmit → 零错误
- **类型定义完整**：
  - configStore.TranscriberConfig（camelCase）
  - services/transcriber.TranscriberConfigPayload（snake_case）
  - shared/settings_store.TranscriberConfig（后端）
- **类型转换正确**：前端 camelCase ↔ 后端 snake_case 映射正确

### ✅ i18n 覆盖完整
- **zh-CN/settings.json**：164 行 transcriber 部分 + tosWarning 3 个键
- **en-US/settings.json**：同步双语文案
- **未翻译键检查**：零缺失

### ✅ 功能流程端到端
| 流程 | 验证 |
|------|------|
| 选择引擎 | 点击卡片 → draft.type 更新 → 卡片选中态改变 |
| 输入 initial_prompt | 修改 Textarea → dirty.initial_prompt = true |
| 显示 ToS 提示 | 选中 groq → Alert 出现 |
| 保存配置 | 点击 SaveBar → POST /transcriber_config → configStore 同步 |
| 离页守卫 | 脏数据 → window.confirm → 可选保存 |

---

## 🔧 技术债务检查

- ✅ mlx-whisper 平台过滤：frontend/src/services/transcriber.ts L69-72
- ✅ 非 Mac 自动切换：frontend/src/pages/SettingPage/TranscriberPage.tsx L156-161
- ✅ 警告 toast：已实现（toast.warning）
- ✅ initial_prompt 后端消费：backend/app/services/asr_fast_whisper.py L66、93
- ✅ pipeline 集成：backend/app/services/pipeline_tasks.py L381-390

---

## 📝 变更清单

| 文件 | 变更 | 行数 |
|------|------|------|
| TranscriberPage.tsx | AlertCircle icon + Alert 组件 import | +1 |
| TranscriberPage.tsx | ToS 警告条件渲染（bcut/kuaishou/groq） | +9 |
| zh-CN/settings.json | tosWarning 对象（3 个键） | +4 |
| en-US/settings.json | tosWarning 对象（3 个键） | +4 |

---

## ✅ 最终验证

- ✅ TypeScript 严格模式：零错误
- ✅ 页面可交互：前端 5175 可访问
- ✅ 后端支持：8000 /transcriber_config POST 验证通过
- ✅ i18n 完整：双语文案齐全
- ✅ Git 原子化提交：待执行

---

## 📖 后续建议

**M3 Download 模块** (预计 1.5-2d)：
- 新建 DownloadSettingsPage + 字段扩展
- 迁移 NetworkSettingsPage 中的下载相关逻辑
- 同步后端 video_download_ytdlp.py 新字段消费

或

**M6 回归测试启动** (并行 2d)：
- Jest 单测框架完善
- SettingsShell SaveBar 组件测试
- Provider CRUD 完整流程 E2E

