# PR-3 规划与设计文档

## 🎯 目标

Settings 页面全模块 i18n 化：5 个组件 × 100+ keys × 双语完全对齐

## 📊 组件分析与硬编码文本统计

### 1. ModelManagementPage.tsx (229 行)

**功能**: 查看各提供商支持的模型列表

**硬编码文本** (15+ keys):
- 页面标题: `模型管理` / `查看各提供商支持的模型列表`
- 刷新按钮: `刷新`
- 加载状态: `加载中…` / `正在从提供商接口获取模型列表…`
- 错误消息: `加载提供商失败` / `刷新失败` / `获取模型列表失败` / `该提供商暂无可用模型`
- 空状态: `暂无提供商，请先在「提供商管理」中添加配置`
- 状态标签: `已启用` / `已禁用`
- 工具提示: `刷新模型列表`

### 2. TranscriberPage.tsx (44 行)

**功能**: 音频转写设置页（骨架）

**硬编码文本** (4 keys):
- 页面标题: `音频转写`
- 页面描述: `配置语音识别引擎及默认参数（ASR Provider）`
- 卡片标题: `转写引擎`
- 卡片描述: `支持 fast-whisper / groq-whisper / bcut / kuaishou`
- 占位符: `该页面为占位骨架，具体表单项将在后续版本中补齐。`

### 3. ScreenshotPage.tsx (44 行)

**功能**: 视频截图设置页（骨架）

**硬编码文本** (4 keys):
- 页面标题: `视频截图`
- 页面描述: `配置抽帧、拼图与视觉理解的默认参数`
- 卡片标题: `截图与抽帧`
- 卡片描述: `控制关键帧提取、网格拼图尺寸及视觉理解触发条件`
- 占位符: `该页面为占位骨架，具体表单项将在后续版本中补齐。`

### 4. NetworkSettingsPage.tsx (151 行)

**功能**: 网络设置（代理、Token、Cookie）

**硬编码文本** (30+ keys):
- 页面标题: `网络设置` / `配置外网访问与媒体下载相关的全局参数`
- 代理部分:
  - 卡片标题: `网络代理服务器` / `访问海外平台时的网络代理；留空表示直连`
  - Label: `代理地址`
  - Placeholder: `示例：http://127.0.0.1:7890 或 socks5://127.0.0.1:1080`
  - 提示: `支持 http:// 或 socks5:// 协议，仅在媒体抓取阶段生效`
  - 保存按钮: `保存代理`
  - Toast: `网络代理已保存`
- 下载增强部分:
  - 卡片标题: `下载增强` / `用于突破风控与限流；可选，留空即使用默认策略`
  - Label: `PO Token` / `Visitor Data` / `Cookie 文件目录`
  - Placeholder: `YouTube PO Token（可选）` / `YouTube Visitor Data（可选）` / `每行一个绝对路径...`
  - 提示: `留空将使用内置默认目录；目录下可放置 cookies.txt 或 bilibili_cookies.txt`
  - 保存按钮: `保存下载增强`
  - Toast: `下载增强配置已保存`

### 5. AboutPage.tsx (38 行)

**功能**: 应用信息和版本

**硬编码文本** (8 keys):
- 页面标题: `关于` / `应用信息和版本`
- 卡片标题: `VidMirror`
- 卡片描述: `一个强大的视频处理工具`
- 字段标签: `版本号` / `项目名称`
- 字段值: `v0.5.0` / `VidMirror`
- 描述: `VidMirror 是一个功能丰富的视频处理应用，支持多个 AI 提供商集成。`

### 6. ProvidersManagementPage.tsx (498 行) — PR-1 已部分完成

**状态**: PR-1 创建了 providers namespace，但仅覆盖部分 keys

**需补充的文本** (20+ keys):
- 页面标题/描述（已在 providers.json）
- 列表操作: `已启用` / `已禁用`
- 编辑表单: Label、Placeholder、验证消息
- 测试连接: 成功/失败提示
- 新增提供商: 对话框、表单验证

## 🏗️ Namespace 架构设计

### 新增: `settings` namespace 扩展

当前 `settings.json` (7 keys):
```json
{
  "layout": {
    "backHome": "返回首页",
    "language": "语言"
  }
}
```

扩展至 100+ keys，分为 6 个层级：

```
settings:
├─ about (8 keys)         // AboutPage
├─ model (15+ keys)       // ModelManagementPage
├─ network (30+ keys)     // NetworkSettingsPage
├─ screenshot (4 keys)    // ScreenshotPage
├─ transcriber (4 keys)   // TranscriberPage
└─ layout (7 keys)        // 现有
```

## 📋 实施步骤

### PR-3-1: ModelManagementPage i18n 化

1. 分析 229 行组件，提取 15+ keys
2. 添加到 settings.json (model 层)
3. 更新 ModelManagementPage.tsx 调用 `t('settings:model.*')`
4. 验证：npm run build ✓

### PR-3-2: TranscriberPage + ScreenshotPage

1. 各 44 行组件，共 8 keys
2. 添加到 settings.json (transcriber/screenshot 层)
3. 更新两个组件的 `useTranslation` 和 i18n 调用
4. 验证：npm run build ✓

### PR-3-3: NetworkSettingsPage i18n 化

1. 分析 151 行组件，提取 30+ keys
2. 添加到 settings.json (network 层)
3. 关键转换点：Toast message、Form labels、Placeholder
4. 验证：npm run build ✓

### PR-3-4: AboutPage i18n 化

1. 分析 38 行组件，提取 8 keys
2. 添加到 settings.json (about 层)
3. 转换静态文本为 i18n 调用
4. 验证：npm run build ✓

### PR-3-5: ProvidersManagementPage 补充

1. 检查 PR-1 遗漏的 keys (~20+)
2. 补充到 providers.json
3. 更新组件缺失的 i18n 调用
4. 重新运行 npm test 确保不破坏现有功能

## ✅ 验证清单

- [ ] 所有 5 个组件完全转换
- [ ] settings namespace 新增 90+ keys
- [ ] providers namespace 补充 20+ keys
- [ ] zh-CN ↔ en-US 完全对齐
- [ ] npm run build 成功
- [ ] npm test 8/8 通过
- [ ] i18next-parser --fail-on-update 通过
- [ ] Zero Breaking Changes

## 📊 预期工作量

| 阶段 | 耗时 | 难度 |
|------|------|------|
| PR-3-1 | 20-25 min | ⭐⭐⭐ (最复杂) |
| PR-3-2 | 10-15 min | ⭐ (最简单) |
| PR-3-3 | 20-25 min | ⭐⭐ |
| PR-3-4 | 10-15 min | ⭐ |
| PR-3-5 | 15-20 min | ⭐⭐ |
| 验证与提交 | 20-30 min | ⭐ |

**总耗时**: ~2-3 人日 = 3-4 小时

---

**创建时间**: 2026-04-22  
**Status**: 📋 规划完成，准备开始 PR-3-1

