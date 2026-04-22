# M0 + M1 端到端集成测试报告

**日期**：2026-04-22 17:25 UTC  
**测试环境**：
- 后端：FastAPI 8000 (uvicorn --reload)
- 前端：Vite 5175 (pnpm dev)
- 浏览器：Chrome/Safari

---

## 1. 后端 API 验证

### ✅ Provider 完整生命周期

| 端点 | 方法 | 状态 | 验证 |
|------|------|------|------|
| `/providers` | GET | ✅ | 返回 3+ providers 列表 |
| `/providers` | POST | ✅ | 新增 provider，返回 `{id, name, kind, ...}` |
| `/providers/{id}` | GET | ✅ | 返回完整 detail（含 api_key 状态标识） |
| `/providers/{id}` | PUT | ✅ | 修改 name/base_url/enabled，api_key 空串=不修改 |
| `/providers/{id}/models` | GET | ✅ | 返回 models 列表（懒加载） |
| `/providers/test` | POST | ✅ | 连接测试，返回 `{success: bool, message: str}` |
| `/providers/{id}` | DELETE | ✅ | 幂等删除，返回 `{code: 0}` |

### ✅ 系统监控 API（M4）

| 端点 | 状态 | 返回 |
|------|------|------|
| `/health` | ✅ | `{status, version, uptime_sec}` |
| `/admin/system/stats` | ✅ | `{cpu, memory, disk, timestamp}` |

---

## 2. 前端页面结构验证

### ✅ `/settings/providers` (Master-Detail)

**页面结构**：
- 左侧列表：ProviderList（含 DirtyDot、启用徽章、选中态）
- 右侧详情：ProviderDetailPanel（表单 + 保存 + 连接测试）
- 全局错误 Banner（可关闭）

**交互验证**：
- ✅ 列表选中：点击切换，详情懒加载 `/providers/{id}`
- ✅ 草稿管理：修改字段 → DirtyDot 出现 → SaveBar 激活
- ✅ 保存流程：PUT → 更新缓存 + 列表 + 清空 api_key 输入
- ✅ 连接测试：POST /providers/test → 行内 ✓/✗ + toast
- ✅ 新增对话框：POST → 刷新列表 → 自动选中新项
- ✅ 删除二次确认：AlertDialog → DELETE → 移除列表 + 清空缓存

**脏守卫验证**：
- ✅ `useDirtyGuard`：离页前有未保存草稿 → window.confirm
- ✅ SaveBar：显示脏数据字段数 + 保存/重置按钮
- ✅ 选中切换：脏态下 confirm 防止丢失编辑

### ✅ `/settings/models` (网格卡片)

**页面结构**：
- 顶部搜索 + capability 过滤芯片（all/chat/vision）
- ModelProviderGroup：Provider 折叠卡片 + 模型网格
- 网格布局：`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`

**交互验证**：
- ✅ 搜索实时过滤：Provider name + Model id/name
- ✅ Capability 过滤：仅显示含对应能力的 Provider
- ✅ 懒加载：Provider 展开时加载 `/providers/{id}/models`
- ✅ 默认模型标记：⭐ 徽章标识 text/vision 默认项
- ✅ 快捷切换：卡片上"设为默认"按钮 → 写入 configStore
- ✅ 刷新：单 Provider refresh 按钮（不重复请求已加载）

---

## 3. 状态管理验证

### ✅ `useProviderStore`（persist）

| 操作 | 验证 |
|------|------|
| `fetchProviders` | HTTP GET /providers → setProviders |
| `updateProvider` | HTTP PUT → providerStore 同步 |
| `removeProvider` | HTTP DELETE → 移除 store 中的项 |
| 持久化 | localStorage key: `provider-storage` ✅ |

### ✅ `useConfigStore`（persist）

| 字段 | 验证 |
|------|------|
| `textProviderId / textModelId` | Models 页点击"设为默认" → 更新 + localStorage 同步 |
| `visionProviderId / videoModelId` | 同上（视觉模型） |

### ✅ `useSettingsShellStore`（SaveBar）

- ✅ 子页面 → setSaveBar：dirtyCount / saving / onSave / onReset
- ✅ SaveBar 按钮联动：loading 态 + disabled 态
- ✅ 离页清理：resetSaveBar()

---

## 4. i18n 覆盖验证

### ✅ 翻译键完整性

**文件**：`locales/{zh-CN,en-US}/settings.json`

| 模块 | 键名 | zh-CN | en-US |
|------|------|-------|-------|
| providers | `providers.list.title` | ✅ | ✅ |
| providers | `create.title` | ✅ | ✅ |
| providers | `delete.confirm` | ✅ | ✅ |
| models | `model.title` | ✅ | ✅ |
| models | `model.filter.chat` | ✅ | ✅ |
| common | `save.success` | ✅ | ✅ |

---

## 5. TypeScript 类型安全

- ✅ `tsc --noEmit`：零编译错误
- ✅ `ProvidersManagementPage`：EditDraft / ProviderDetail 类型完整
- ✅ `ModelManagementPage`：ModelProviderGroupItem / CapabilityFilter 类型完整
- ✅ React 19 + Hook 规范（useEffect deps 完整）

---

## 6. 已知问题与注意

- ✅ 不存在：所有测试项均 PASS
- ⚠️ 建议：M3 开发前，Download 配置页骨架已就位，可直接扩展字段

---

## 7. 总结

**M0 + M1 端到端完整性**：✅ **100% 就绪**

关键流程无缺陷：Provider CRUD → Model 发现 → 默认绑定 → 持久化 → i18n 完整。

后续可安全推进 M2（Transcriber initial_prompt）、M3（Download 字段扩展）。

