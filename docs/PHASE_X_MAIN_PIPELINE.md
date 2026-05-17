# Phase X · 主干打通计划（竖切版）

> **状态**：起草于 2026-05-17（Opus 4.7 会话），来源是 2C.2 浏览器验收时发现的「demo 结果页能开，但真实分析根本没通」问题。
> **核心原则**：竖切，不要横切。一种类型一条路从「添加→分析→真结果可见」打到底，再做下一种。
> **当前主线 worktree**：`/Users/conan/Desktop/nibi`（main 分支），简单阶段直接 main、复杂阶段开 `feat/phasex-<编号>-<短名>`。

---

## 0. 这份 plan 是怎么来的

过去把 4 个结果页（text / image / audio / video）都先做出来用了 **demo fixture** 兜底；但底下的 pipeline 实际只有 video 的 download 能跑，其它都没有真实分析。结果是：

- 浏览器打开 `image_result` 永远是同一张瑞士山照片
- 浏览器打开 `text_result`、`video result` 走 fixture，看不到自己加的内容
- 点「开始」之后 item.status 永远卡在 `processing`，因为**任务跑完没人回写 item**

**根因一句话**：pipeline task_store 和 workspace_store 之间没有「桥」，任务完成的事实传不回 item。

---

## 1. 主干现状盘点（开工前先 cat 这张表）

| 类型 | 触发 `/start` | pipeline handler | 状态回写 item | 产物回写 item.results | 结果页有真数据 |
|------|--------------|-----------------|--------------|---------------------|--------------|
| TEXT | ✅（2026-05-17 补） | ✅ text_task | ❌ | ❌（绕过 item 读磁盘） | 🟡 半通 |
| IMAGE | ❌ 501 | ❌ 没写 | ❌ | ❌ | ❌（demo 兜底） |
| VIDEO | ✅ download | ✅ download，⚠️ 不自动 analyze | ❌ | ❌ | ❌（demo 兜底） |
| AUDIO | ❌ 501 | ❌ | ❌ | ❌ | ❌（demo 兜底） |

> AUDIO 这一栏暂缓，等 1F 之后再说。本 plan 只覆盖 TEXT / IMAGE / VIDEO。

---

## 2. 测试用工作空间（新疆项目测试）

后端持久化在 `data/workspaces/bec1ebab-2933-43a8-93ab-4a688bb6a71f.json`。新会话不要重新建，直接复用：

```
workspace_id: bec1ebab-2933-43a8-93ab-4a688bb6a71f
project_id  : xinjiang_test
name        : 新疆项目测试

items:
  text  4c40b782-9800-4bce-b5c6-7a595579ff67  https://en.wikipedia.org/wiki/Xinjiang
  image 6166c812-0237-4300-bc6d-2c03626fefdc  upload.wikimedia.org/.../China_Xinjiang.svg.png
  video a7601507-b1ad-471a-932b-53f0dd85696e  https://www.bilibili.com/video/BV1GJ411x7h7
```

前端访问：`http://localhost:5175/workspaces/bec1ebab-2933-43a8-93ab-4a688bb6a71f`

---

## 3. 6 个阶段（按推荐执行顺序）

### **X.1** · 状态回写「桥」（拉模式）— ⭐ 必做基础

**目标**：GET `/workspaces/{id}` 时，根据每个 item 的 `related_task_ids` 实时查 task_store，把 task 状态翻译成 item.status，并把磁盘产物路径挂到 `item.results`。

**改动**：
- `backend/app/routes/workspaces.py` 加一个 `_sync_item_with_tasks(item, tasks)` 函数（约 40 行）
- 在 `GET /workspaces/{id}` 和 `GET /workspaces` 返回前调用一次
- task.status 映射：`SUCCESS → done`、`FAILED → failed`、`RUNNING/PENDING → processing`

**验收**：
- 调用 `/workspaces/bec1ebab.../` 时 text item 显示 `status=done`、`results.markdown_path` 非空
- 前端工作空间详情页 chip 从「处理中」变成「已完成」
- 不修改 task_runner、不动 workspace 持久化结构

**模型**：**Opus 4.7**（CLAUDE.md 档 1：状态机一致性 + 跨 store）
**worktree**：建议新开 `feat/phasex-1-task-item-bridge`，不在 main 直接改
**commit 信息**：`feat(phasex): X.1 task→item 状态桥（拉模式）`

---

### **X.2** · TEXT 竖切验收

**目标**：浏览器走完整流程，确认主干第一段真的通了。

**步骤**（不写代码，只跑命令 + 截图）：
1. `./start.sh` 起服务
2. 浏览器打开新疆工作空间
3. 看 TEXT 那条 chip 是「已完成」
4. 点击进入 text_result 页面，看到「新疆 - Wikipedia」的真摘要
5. PromptVersionStack 显示版本（如果有）

**模型**：**小米 2.5 Pro（终端，免费优先）** —— 跑 curl + playwright 截图就够
**commit 信息**：`test(phasex): X.2 TEXT 主干 e2e 验收通过`

---

### **X.3** · SSE 进度接入工作空间详情页

**目标**：用户能看到任务在跑（百分比、当前步骤），不再是「处理中」假死。

**改动**：
- 后端 SSE 端点已有：`GET /pipeline/tasks/{task_id}/events`
- 前端 `frontend/src/pages/WorkspaceDetail.tsx`（或对应组件）对每个 `status=processing` 的 item 开一条 SSE
- 在 chip 旁边显示「当前步骤」+ 「百分比」

**验收**：
- 触发 text item 时，浏览器能看到日志逐行滚动（拉取素材… → 解析文档… → 生成摘要…）

**模型**：**Sonnet 4.6**（CLAUDE.md 档 2：React + 已有 SSE，不烧脑）
**commit 信息**：`feat(phasex): X.3 工作空间详情页接入任务 SSE`

---

### **X.4** · IMAGE 整条 pipeline 新建

**目标**：图片真分析（不再返回瑞士山）。

**改动**：
1. 新增 `backend/app/services/image_task.py`（参考 `text_task.py` 的结构）
   - 拉图片到本地
   - 调一次 vision 模型（默认从 settings 拿 SiliconFlow 的 vision model）
   - 产出 `{description, prompts: {mj, sd, json}, tags, ocr_text, exif}`
   - 归档到 `data/projects/{project_id}/image/{task_id}.json`
2. `backend/app/routes/pipeline.py` 把 `image` 接到 task_type dispatch
3. `backend/app/routes/workspaces.py` 的 `_bridge_to_pipeline_payload` 加 image 分支（去掉 501）
4. `image_result` 端点优先读 `item.results`（X.1 已经把磁盘产物挂上来了，自动生效）

**验收**：
- 添加一张新图 → 30 秒内 image_result 返回真分析（不是 demo fixture）
- 复用 X.3 的 SSE 看进度

**模型**：**Sonnet 4.6**（参考 `text_task.py` 模式同构写一份）
**worktree**：`feat/phasex-4-image-pipeline`
**commit 信息**：`feat(phasex): X.4 image pipeline handler 全链路`

---

### **X.5** · VIDEO 任务链衔接

**目标**：download 完自动接 analyze；analyze 产物（frames + transcript）回写 item.results，结果页看到真三轨。

**改动**：
1. `backend/app/services/task_runner.py` 给 download task 加 SUCCESS callback：
   - 读 download 产物路径（`data/videos/{basename}.mp4`）
   - enqueue 一个 analyze task，payload 带 `video_basenames`
   - 把新 task_id 追加到 item.related_task_ids
2. analyze task 完成时把 frames/transcript 路径暴露（X.1 的桥自动挂回 item.results）
3. `result` 端点优先读 `item.results.frames` + `item.results.transcript`

**验收**：
- 添加 B 站短视频 → 等几分钟 → result 页面看到真三轨（不是 DJI Pocket 4 demo）

**模型**：**Opus 4.7**（CLAUDE.md 档 1：任务链 + callback + 状态机）
**worktree**：`feat/phasex-5-video-task-chain`
**commit 信息**：`feat(phasex): X.5 video download→analyze 任务链 + 产物回写`

---

### **X.6** · UI bug 三件套（任何时候插队都行）

| 子项 | 描述 | 模型 |
|------|------|------|
| X.6a | 重新配置打开后表单回显空白（应该用 `item.preflight` 回填） | Sonnet 4.6 |
| X.6b | 模型下拉列表不能滚动（缺 `max-h-80 overflow-y-auto`） | 小米 2.5 Pro |
| X.6c | （并入 X.3） | — |

**commit 信息**：`fix(phasex): X.6a preflight 表单回显 item.preflight` 等

---

### **X.7** · e2e 回归

**目标**：playwright 跑三种 item 完整流程，截图归档。

**改动**：在 `tests/` 下新增 playwright 脚本（或扩展 `tests/e2e_qa.py`）。

**模型**：**小米 2.5 Pro（终端，免费）**

---

## 4. 已发现的旁支问题（不在主干，但要记）

1. **任务存储路径漂移**：之前后端被启动在某个 worktree 下时，`backend_tasks.json` 写到了 `worktrees/phase2c2-text-prompt-version/.local/`，导致重启后报 ENOENT。已通过 `./start.sh` 重新拉起修复。**教训**：永远从 `/Users/conan/Desktop/nibi` 主目录起服务。
2. **YouTube 部分视频 yt-dlp 拉不到格式**：`jNQXAC9IVRw`（zoo 视频）报 "No video formats found"。测试时优先用 B 站短视频。
3. **demo_2c2 工作空间残留**：旧 worktree 留下的，可忽略，做完 X.1 后可以单独清理。

---

## 5. 模型分配总表（省 token 关键）

| 阶段 | 推荐模型 | 是否必须该档 |
|------|---------|--------------|
| X.1 状态桥 | **Opus 4.7** | ✅ 必须（状态机） |
| X.2 TEXT 验收 | 小米 2.5 Pro（免费） | 跑命令 |
| X.3 SSE 进度 | Sonnet 4.6 | 可降到小米但要小心 React 改造 |
| X.4 IMAGE pipeline | Sonnet 4.6 | 不要用 Opus，模式已有 |
| X.5 VIDEO 任务链 | **Opus 4.7** | ✅ 必须（任务链） |
| X.6a 配置回显 | Sonnet 4.6 | — |
| X.6b 下拉滚动 | 小米 2.5 Pro（免费） | 一行 CSS |
| X.7 e2e 回归 | 小米 2.5 Pro（免费） | 跑命令 |

**铁律**：X.1 和 X.5 是 Opus，其余尽量下放。如果某个步骤超 5 文件或卡住超 3 次，**升档 Opus** 再说。

---

## 6. 新会话快速恢复上下文（5 分钟版）

新开会话/换模型时按这个顺序读：

```bash
# 1. 看现在做到哪一步（最近的 commit）
git log --oneline -10 | grep -i phasex

# 2. 看当前分支
git branch --show-current

# 3. 看本 plan 当前状态
cat docs/PHASE_X_MAIN_PIPELINE.md | head -80

# 4. 跑一下测试工作空间，确认服务在
curl -s http://localhost:8000/workspaces/bec1ebab-2933-43a8-93ab-4a688bb6a71f \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print([(i['type'],i['status']) for i in d['items']])"
```

如果 curl 报 "workspace not found"：服务起在了错误的 worktree。`pkill -f uvicorn` 然后从主目录 `./start.sh` 重启。

---

## 7. 现在的下一步（fresh session 第一句话）

> "我要做 Phase X.1，状态回写桥。先 cat docs/PHASE_X_MAIN_PIPELINE.md 第 3 节 X.1 那段，然后开 feat/phasex-1-task-item-bridge 分支动手。"

完成 X.1 后立即 commit 并 merge 到 main，本 plan 第 1 节那张表把 TEXT 行的「状态回写 item」打 ✅。

---

**Plan 维护人**：本 plan 每完成一个 X.n，回头把第 1 节状态表更新，并在对应章节末尾追加 "completed: 2026-MM-DD by <model>" 标记。
