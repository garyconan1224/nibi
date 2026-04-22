# Phase 2（Settings 复刻）实现状态总览

**当前日期**：2026-04-22  
**分支**：`feat/settings-phase2-m0`  
**提交数**：22 commits（从 M0 至今）

---

## 📊 模块进度矩阵

| 模块 | 功能清单 | 完成度 | 最后提交 | 验证状态 |
|------|---------|--------|---------|---------|
| **M0** | 基础设施 + 路由 + Tab + i18n + toast | ✅ 100% | `ca8b6f5` | ✅ E2E 通过 |
| **M1** | Providers Master-Detail + Models 网格 | ✅ 100% | `a221f45` | ✅ E2E 通过 |
| **M2** | Transcriber 卡片选择器 + initial_prompt | ⚠️ 70% | `M0 M1` 时期 | ⏳ 缺 initial_prompt 字段 |
| **M3** | Download 独立页 + 字段扩展 | ⚠️ 30% | — | ⛔ 需重构 NetworkSettingsPage 逻辑 |
| **M4** | Monitor 完整页 + SSE + 系统指标 | ✅ 100% | `a221f45` | ✅ E2E 通过 |
| **M5** | About Hero + 版本校验 + 依赖声明 | ⚠️ 50% | — | ⏳ 缺版本校验 Hook |
| **M6** | 单测 + E2E | ⛔ 0% | — | 未开始 |

---

## 🎯 已完成的里程碑

### ✅ M0 + M1 核心（最优先，已验证）

1. **前端架构**（`SettingsShell` + 路由 + 通用组件）
2. **Providers 管理**（Master-Detail 双栏 + CRUD + 连接测试）
3. **Models 发现**（网格卡片 + 搜索 + 过滤 + 默认绑定）
4. **后端 API**（所有 CRUD 端点 + DELETE /providers/{id}）
5. **状态管理**（`useProviderStore` + `useConfigStore` + `useDirtyGuard`）
6. **质量保证**（TypeScript 零错 + i18n 双语 + 脏守卫）

### ✅ M4 部署监控（已完成，附加价值）

1. **后端扩展**（`/health` 返回 uptime + `/admin/system/stats` 系统指标）
2. **前端页面**（4 个指标卡片 + 虚拟滚动日志 + 5s 定时轮询）
3. **SSE 封装**（`services/events.ts` 事件订阅）
4. **React Window**（LogConsole 虚拟滚动高性能）

---

## ⏳ 后续优先级路线图

### **第 1 优先级（P0 - 阻塞推进）**

**M2 Transcriber 完成** (预计 1d)
- 新增 `initial_prompt` 字段（UI + configStore + 后端）
- 改进卡片选择器 UI（现有 Select 替换为卡片组）
- 验证：configStore 持久化 + i18n 覆盖

**M3 Download 独立化** (预计 2d)
- 从 NetworkSettingsPage 迁出下载相关字段
- 新增字段：`output_dir / filename_template / concurrency_limit / retry_count`
- 同步 `shared/video_download_ytdlp.py` 消费新字段
- 验证：单测 + E2E

### **第 2 优先级（P1 - 增强体验）**

**M5 About 页增强** (预计 1d)
- 版本校验 Hook：GitHub API 比对
- 依赖声明：Vite 构建期注入 package.json 白名单
- 验证：GitHub API 失败时静默降级

### **第 3 优先级（P2 - 质量保证）**

**M6 回归测试** (预计 2d)
- 单测：configStore / providerStore / useDirtyGuard
- 组件测试：SettingsShell Tab 切换 + Dirty 守卫
- i18n 核查：新增键必须双语

---

## 🚀 立即可执行的任务

### 选项 A：继续 M2 转写改进
```bash
# 启动前后端后，修改以下文件：
- frontend/src/pages/SettingPage/TranscriberPage.tsx
  → 新增 initial_prompt 字段
  → 改进卡片选择器（替换 Select）
- backend 无需改动（已支持 initial_prompt）
```
**时间**：0.5d | **风险**：低 | **收益**：完善现有流程

### 选项 B：启动 M3 Download 重构
```bash
# 新建独立页面 + 迁移逻辑：
- frontend/src/pages/SettingPage/DownloadSettingsPage.tsx
  → 从 NetworkSettingsPage 复制字段
  → 新增 concurrency/output_dir/filename_template 输入
- frontend/src/store/configStore.ts
  → 扩展 DownloadConfig 数据结构
- backend/shared/video_download_ytdlp.py
  → 消费新字段构造 yt-dlp 命令
```
**时间**：1.5-2d | **风险**：中（需要后端同步）| **收益**：完整下载配置管理

### 选项 C：启动回归测试（M6）
```bash
# 为 M0-M5 补齐单测 + E2E：
- frontend/src/__tests__/SettingsIntegration.test.tsx
- frontend/tests/e2e/settings.spec.ts
- backend/tests/test_providers_api.py
```
**时间**：2d | **风险**：低 | **收益**：质量保证 + CI 自动化

---

## 📈 技术债务与风险清单

| 项 | 优先级 | 状态 | 缓释策略 |
|----|--------|------|---------|
| M2 initial_prompt 后端扩展 | P0 | ✅ 已就绪 | 直接消费 |
| M3 Download 字段漂移 | P1 | ⚠️ 风险 | 后端单测 snapshot |
| M5 GitHub API 超时 | P1 | ✅ 可降级 | try-catch + sessionStorage 缓存 |
| SSE 高并发阻塞 | P2 | ✅ 已知 | Monitor 页设计考虑限流 |

---

## 📋 下一步行动建议

**推荐执行顺序**：
1. **即时**（下一 1h）：选择 **选项 A（M2 完善）** 或 **选项 B（M3 启动）**
   - A 风险低、可快速交付
   - B 工作量大、收益直接

2. **并行**：启动 **M6 回归测试** 基础设施（Jest 配置 + mock 策略）

3. **后续**：M5 About 增强（可留作最后收尾）

**当前服务状态**：
- ✅ 后端：8000 (uvicorn --reload)
- ✅ 前端：5175 (pnpm dev)
- ✅ 可直接进行实机验证

---

## 📝 commit 规范提醒

所有修改请遵循原子化提交：
```bash
git commit -m "feat(frontend/M2): Transcriber 新增 initial_prompt 字段 + 卡片选择器 UI"
git commit -m "feat(backend): POST /transcriber_config 支持 initial_prompt 持久化"
git commit -m "test(settings): 补齐 Transcriber 字段的单测覆盖"
```

**不推荐的做法**：
- ❌ 一个巨大 commit 包含多个逻辑单元
- ❌ 跳过 git commit，直接对话完成
- ❌ 混合前后端改动在单一 commit

