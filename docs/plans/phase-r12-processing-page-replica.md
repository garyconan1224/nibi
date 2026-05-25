---
name: phase-r12-processing-page-replica
status: in_progress
branch: feat/phase-r12-processing-page-replica
baseline_commit: 7ec9914
owner: claude opus 4.7
created_date: 2026-05-25
---

# Phase R12 — ProcessingPage 1:1 复刻设计稿

## 目标

把 `frontend/src/pages/result/ProcessingPage/index.tsx` 与设计稿
`docs/design/components/processing.jsx` 对齐。当前差距：
标题/封面/统计元数据/step 内联日志/右侧 3 张卡（缺 2 张）。

## 范围（6 项，#6 预览帧延后到 N7b）

| # | 内容 | 文件 | commit |
|---|---|---|---|
| R12.1 | 后端 yt-dlp 抽取 title/duration/uploader 写进 task.payload+result | shared/video_download_ytdlp.py + task_runner.py | R12.1 |
| R12.2 | 前端 Hero 区读真实标题 + 封面 + 完整 stats 行 | ProcessingPage/index.tsx + processing.css | R12.2 |
| R12.3 | StepProgress 改 step-stream：每步 desc + 内联 logs(warn/err/ok 三色) + 进度条 | StepProgress.tsx + processing.css | R12.3 |
| R12.4 | 后端 /system/stats 端点：psutil CPU/RAM + nvidia-smi GPU/VRAM | 新建 backend/app/routes/system.py | R12.4 |
| R12.5 | 右侧 SystemResourceCard 卡：四宫格 + 并行槽位条 | 新建 SystemResourceCard.tsx + 拉取 /system/stats | R12.5 |
| R12.6 | 右侧 TasksCard 卡：活跃任务列表，点击切换 | 新建 TasksCard.tsx，复用 useTaskStore | R12.6 |

## 延后

- **#6 预览帧卡** — 依赖 N7b 视频后端 vlm 阶段回写 current_frame，留到 N7b 实现时一起做。

## 决议（用户已拍板）

- 按顺序依次做完 6 项
- 任务卡（侧栏）+ 浮动队列**两个都保留**（侧栏=处理页内导航，浮动=跨页提醒）
- 系统资源要**真实数据**（不 mock）
- 不 push 远端，做完 6 commit 等用户授权 merge

## 验收

1. 粘 B 站短视频 URL → /processing/<id>：标题显示视频真实标题、封面图显示视频缩略图
2. stats 行显示真实时长/帧数/句数（无数据时省略对应项）
3. step-stream 7 步顺序对，每步有 desc，logs 按 ok/warn/err 三色显示
4. 右侧栏 3 张卡可见：系统资源（GPU/RAM 数字真实变化）、任务（点击跳别的任务）、(预览帧暂缺)
5. `pnpm lint && pnpm build && pnpm test --run` 通过
6. `.venv/bin/python -m pytest tests/backend -q` 通过

## 禁止事项

- ❌ 不动 R8 PreflightDrawer / R10 FloatingTaskQueue / AddMaterialModal
- ❌ 不写 hardcoded hex/px/border，全走 var(--*) token
- ❌ 不引入新依赖（psutil 项目里检查下有没有；nvidia-smi 走 subprocess）
- ❌ 不 push 远端
