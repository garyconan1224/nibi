# AI Handoff

Last updated: 2026-05-20（H 系列 + IP 全部完工，UI ↔ 后端 100% 接通）

---

## 启动必读

每次新会话先对账，不要直接相信本文件：

```bash
git status --short --branch
git log --oneline -10
git branch --show-current
```

然后按顺序读：

1. `AGENTS.md`
2. `docs/WORKFLOW.md`
3. `docs/SPEC.md`
4. `docs/EXECUTION_PLAN.md`
5. **`docs/ROADMAP.md`**（2026-05-21 新增——长期升级路线图，6 条 track 全景视图）
6. `docs/design/`（如需视觉对照）
7. 本文件「下一步」段

---

## 2026-05-20 一日完成清单

**H 系列设计稿 1:1 复刻**（merge 入 main）：
- H1 Workbench 工作台首页（5 子任务）
- H2 Taskboard 任务中心 9 Tab（4 子任务）
- H3 Processing 处理中（含 SSE 接线）
- H4 Results 4 子结果页（视/音/图/文 CSS 改造）
- H5 Storyboard 分镜页（D2 方案 A markdown 直展，shot 网格留 [C]）

**Integration Pass（IP.1~IP.8）**——把"死按钮死参数"全部接通：
- IP.1 Composer 高级参数透传到 Preflight
- IP.2 Composer 上传按钮接 AddMaterialModal
- IP.3 TaskboardHead 编辑背景接 BackgroundEditor
- IP.4 TagsTab 加编辑能力
- IP.5 Storyboard 触发入口（MaterialCard 菜单）
- IP.6 Composer 工作空间选择真传后端
- IP.7 **PreflightDrawer 真接 workspace 流程 + LLM 自动建空间**（修阻塞 bug）
- IP.8 Connection Audit：Compare Tab / 顶栏 system stats / 提示词风格 select / 资料库入口 / 快速抽字幕 / N4 复核

**清理与修复**：
- 后端 bug：TaskRunner.append_log 缺失（download 任务从此能跑）
- IP.8.6-fix：N4 默认勾选 4 处对齐设计稿
- H2.6：删除旧 WorkspaceDetail.tsx + WorkspaceSearchBar.tsx（-680 行）

**当前 main**：`ff2cab0 Merge cleanup: IP.8.6-fix + H2.6`

---

## 2026-05-21 调整方向

用户决议：**不去 [C] / [D]**，先把现有功能跟流程图 5 张对齐打磨。新长期路线图 `docs/ROADMAP.md` 6 条 track 已落盘。当前活跃任务：

- 分支 `feat/ip9-flow-gaps`（已开 + plan `docs/plans/phase-ip9-flow-gaps.md`）
- Tier A（UI 层）3 子任务 ⭐ 小米：IP.9.1 总览页 / IP.9.2 音频 6 任务 / IP.9.3 视频 3 路径
- Tier B（后端层）等 Tier A 验收后再做：路径 1 字幕直接总结（Sonnet）/ 路径 3 Gemini 集成（Opus）/ 字幕清洗（Sonnet）

具体执行索引去 `docs/ROADMAP.md` §3~§8 看对应 track，再去 plan md 看子任务步骤。

---

## 下一步（按 ROI 排序，明天接力会话直接选）

### 🥇 端到端冒烟测试（30min，用户自己跑）

IP.7 修了所有 URL 任务跑不通的阻塞 bug，但**没有真正粘 B 站 URL 端到端跑过一次**。建议明天第一件事：

1. `./start.sh` 启动
2. 打开 `/` → 不选工作空间 → 粘真实短 B 站 URL（< 5 分钟）
3. 调画质 720p / 抽帧 A / fps 2
4. 「开始解析」→ Preflight 确认 → 提交
5. 看 toast「已自动创建工作空间「XXX」」
6. 跳 Processing → 看 yt-dlp 下载日志
7. download 完成 → 自动 analyze → 完成跳 Result
8. 回 Taskboard 试：Compare Tab / Tags 增删 / 快速抽字幕 / 「生成分镜」
9. 顶栏看 CPU/MEM 实时跳

卡壳处 = IP.9 的输入。

### 🥈 路线选择（冒烟后定）

**路线 A：[C] AI 导演**（4-7 天，Opus 体力活）
- 需先补设计稿（system_design v1.1 这块语焉不详）
- 拍板生成模型 API 选型（Midjourney / Flux / SD / Sora）
- 内容：Style 报告 + Storyboard shot 网格升级 + 生成预览 + .fcpxml 导出 + A/B Compare 视频版

**路线 B：[D] 开源准备**（2-3 天）
- 加密 / CI / push 策略解除 / 仓库整理
- 让项目能被外人 clone 跑起来
- 是 v1.0.0 发布的前置

### 🥉 独立小活（任意穿插）

- **N7b** 视频总结路径 1/3（8-12h，需先决策字幕来源 + 视频大模型选型）
- **N8b** 音频前端交互（6-8h，无人声切音乐弹窗 / 说话人修正 / 6 维度切分）

---

## 决策与约定速查

- **Push 策略**：暂缓所有 `git push origin`，等做到 `[D]` 阶段统一推。本地 main 越来越领先 origin/main 是预期状态
- **Phase merge 默认**：完工默认 merge 进 main，开新 phase 默认上一个已 merge
- **Tag 策略**：不按 SemVer 自动打，等"功能都差不多"统一打（那时就是开源时刻）
- **模型分配**：
  - 简单/模板/git/CSS → ⭐ 终端小米（免费优先）
  - 中等多文件 React → Sonnet 4.6
  - 跨 5+ 文件 / 状态机 / 加密 → Opus 4.7
- **设计稿源**：`docs/design/components/*.jsx` + `styles.css` + `VidMirror.html`（Taskboard CSS 大部分在 HTML 不在 styles.css）

---

## 已知风险 / TODO

- N7b / N8b 仍延后，独立可做
- StoryboardPage 当前是 markdown 直展，shot-by-shot 网格留给 [C]
- 「导出 .fcpxml」/「生成预览」按钮显式禁用 + PHASE C pill
- 视频对比（image_compare / text_compare 已通，但视频/音频对比后端无接口）
- 设计稿「12 屏概览」/ AI 导演侧栏 仍禁用，等 [C]
