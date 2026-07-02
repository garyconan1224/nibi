# 修复计划：首页残留已删任务 / 下载太慢 / 处理中资料库加载失败

> 日期：2026-07-02　分支：`feat/exp-redesign-p1`
> 作者：Claude（桌面/终端）　执行：小米　审查：Codex
> 用户已拍板：
> - 问题1 → 「删除时同步清缓存」（前端即时移除 + 后端根治，见下）
> - 问题2 → 三管齐下：先排查网络/代理 → 改用 DASH+分片并发 → 接入 aria2c 多线程（**已同意安装 aria2c**；不做登录 cookie）

三个任务相互独立，建议按 **任务1 → 任务3 → 任务2** 顺序做（先修数据一致性和加载失败这类确定性 bug，再调下载性能）。

---

## 任务 1：首页残留「已在笔记页删除」的任务

### 现象
笔记页 `/notes` 删除某任务后，首页 `/` 的「最近任务」仍显示它。

### 根因（已核实）
首页「最近任务」和笔记页是两套数据源：

1. 首页 `RecentTasks` 读的是前端 `taskStore`（zustand + localStorage persist），并由 `usePipelineTasks({ pollInterval: 5000 })` **每 5 秒轮询 `GET /pipeline/tasks`（全量任务）** 回填。
   - `frontend/src/pages/WorkbenchPage/RecentTasks.tsx:143-145`
   - `frontend/src/hooks/usePipelineTasks.ts`
2. 笔记页删除走后端：`deleteWorkspace`（合集，DELETE `/workspaces/{id}`）是**软删除**（`trashed=True`），`remove_item`（单条，DELETE `/workspaces/{id}/items/{item_id}`）删 item。
   - `frontend/src/pages/LibraryPage/index.tsx:362-415`
3. **关键**：软删/删 item **都不会删除 task_store 里的任务记录**，而 `GET /pipeline/tasks` 返回全量任务、不看 workspace 是否 trashed。
   - `backend/app/routes/pipeline.py:51-79`（`list_tasks` 无 trashed 过滤）
   - `backend/app/routes/workspaces.py:2382-2396`（`delete_workspace` 只 `trashed=True`）
   - `backend/app/routes/workspaces.py:2530`（`remove_item`）

结论：**纯前端 `removeTask` 会在 5 秒后被轮询重新加回**，所以必须同时改后端，让被删任务不再从 `/pipeline/tasks` 返回。

### 修复方案（三处，缺一不可）

**1-A 后端：`list_tasks` 过滤掉「已 trashed / 已不存在」工作空间的任务**
文件 `backend/app/routes/pipeline.py`，函数 `list_tasks`（约 51 行）。
- 在文件顶部引入 workspace 存储单例（与 `workspaces.py` 用同一个 `_store`；查看 `backend/app/routes/workspaces.py` 顶部 `_store = ...` 的来源，直接 import 那个单例，**不要新建 WorkspaceStore 实例**，否则内存缓存不一致）。
- 在 `all_recs = _store.list_all()` 之后、排序之前，构造一个「有效 project_id 集合」：
  - 取 workspace 存储里 `list_all(include_trashed=False)` 的所有 `workspace_id`（注意本项目 task 的 `project_id` == `workspace_id`）。
  - 过滤：`all_recs = [r for r in all_recs if r.project_id in valid_ids]`。
- 这样合集/笔记被软删（trashed）后，其任务立刻从首页轮询结果里消失。

**1-B 后端：`remove_item` 删单条 item 时，一并删除该 item 的 related_task_ids**
文件 `backend/app/routes/workspaces.py`，函数 `remove_item`（约 2530 行）。
- 删除 item 前先取到该 item 的 `related_task_ids`。
- item 删除成功后，遍历这些 id 调用 `_pipeline_runner.store.delete(tid)`（`task_store.delete` 已存在，见 `backend/app/services/task_store.py:147`）。
- 用 try/except 包住，单个删除失败不阻塞主流程。
- 注意：只有「合集里删单条」才需要这步（1-A 处理的是整个合集 trashed 的情况；单 item 删除时合集通常仍存在）。

**1-C 前端：删除成功后即时清本地 taskStore（体验，避免等 5 秒轮询）**
- 在 `frontend/src/store/taskStore.ts` 新增一个 action：`removeByProject(projectId: string)`，从 `tasks` 里过滤掉 `project_id === projectId` 的任务（`TaskRecord.project_id` 就是 workspace_id，见 `frontend/src/types/task.ts:27`）。
- 在 `frontend/src/pages/LibraryPage/index.tsx` 的 `handleDeleteOne` / `handleDeleteWorkspace` / `handleBatchDelete` 成功回调里：
  - 删合集：`useTaskStore.getState().removeByProject(wsId)`。
  - 删单条 item：`LibraryItem` 上有 `workspace_id`，同样调 `removeByProject(item.workspace_id)`（同合集其它未删 item 的任务会被 1-A/后端下次轮询自动补回，可接受；若要更精确可跳过 1-C 的单条场景，仅靠后端）。
- 目的仅是「立即消失」，最终一致性由 1-A/1-B 保证。

### 验收
1. 起后端（**确认是新进程**：`ps aux | grep uvicorn` 看启动时间晚于本次改动，命令含 `.venv` 和 `--reload`）。
2. 造数据：新建一个笔记任务跑完 → 首页「最近任务」能看到。
3. 到 `/notes` 删除它 → 首页**立即**消失（1-C 生效），且**等 10 秒**轮询后仍不出现（1-A/1-B 生效）。
4. 合集删除、批量删除各测一遍。
5. `curl -s 'http://localhost:8000/pipeline/tasks' | python -m json.tool | grep -c task_id` 前后对比，确认被删任务不再返回。

---

## 任务 3：批量处理中打开笔记页/复刻页/资料库 → 「加载资料库失败，请确认后端已启动」

### 现象
批量任务处理中（如截图下载 2%），打开 `/notes`、`/replicas`、`/library` 先显示「加载资料库…」，几秒后报「加载资料库失败，请确认后端已启动」。后端其实没挂。

### 根因（已核实）
1. 前端 http 客户端超时 **15 秒**：`frontend/src/services/client.ts`（`timeout: 15000`）；`fetchLibrary` 也显式传 15000：`frontend/src/services/library.ts:52`。
2. `GET /workspaces/library` 是重接口：对**每个视频 item** 都会 `open()+json.load()` 读磁盘上的视觉分析 JSON、并 glob 目录定位报告：
   - `backend/app/routes/workspaces.py:2050-2055`（列表里对 video 调 `_materialize_video_results_from_analyze`）
   - `backend/app/routes/workspaces.py:3129`（该函数内 `open()`/`json.load()`/`_locate_analyze_report_dir`）
   - 另外每个 item 还走 `_sync_item_with_tasks`（逐个 `task_store.get`）、`_item_thumbnail` 等。
3. 工作空间数量多（约 78 个），列表页本就慢；批量下载时磁盘 I/O 争抢，`/workspaces/library` 耗时超过 15 秒 → 前端超时 → 误报「后端没启动」。

> 注意：这不是「后端被阻塞」，任务跑在独立 ThreadPool、SSE 是 async，都不占用列表接口。纯粹是**接口太慢 + 前端超时太短**。

### 修复方案

**3-A（立即、低风险）：给资料库接口更长超时**
- `frontend/src/services/library.ts:49-53` 的 `fetchLibrary`：把传给 `http.get` 的 `timeout` 从 `15000` 提到 `60000`。
- 只改这一个调用，不动全局 `client.ts` 的默认 15s（其它接口保持不变）。
- 这一步能立刻消除误报的「加载失败」。

**3-B（推荐、性能治本，中等风险）：给列表接口减负**
`GET /workspaces/library` 是列表卡片视图，**不需要**把每个视频的帧数据从磁盘物化出来。
- 在 `backend/app/routes/workspaces.py` 的 `get_library`（约 2017 行）里，**列表场景不调用** `_materialize_video_results_from_analyze`。
  - 做法：给该函数（或抽一个内部开关）传 `materialize=False`；列表分支直接用 `results = overlay_results or item.results or {}`，跳过 `_materialize_...`。
- 受影响的卡片字段确认（读代码逐个核对，别猜）：
  - `thumbnail`/`cover_thumbnail`：视频封面通常已在 `item.results.cover_thumbnail`（下载阶段写入），不依赖物化 → 应无影响，**需实测确认封面还在**。
  - `frames_count`（`workspaces.py:2093`）：不物化时视频 `frames` 可能为空 → 计数变 0。这是卡片上的次要信息，可接受；若要保留，另起小任务在 analyze 完成时把 `frames_count` 持久化进 `item.results`，本次先不做。
  - `has_summary`/`has_transcript`/`primary_view`/`duration`：核对是否依赖物化后的 `results`；若依赖，保留对应的轻量读取，不要整块物化。
- **红线**：3-B 若发现会让「资料库卡片封面消失/类型判断错乱」，立即停下回报，不要硬改。可只交付 3-A。

### 验收
1. 后端新进程（同任务1 的确认方式）。
2. 起一个批量下载任务（保持处理中）。
3. 处理中反复打开 `/notes`、`/replicas`、`/library`，都应正常加载、**不再报「加载资料库失败」**。
4. 量化：`time curl -s 'http://localhost:8000/workspaces/library' -o /dev/null -w '%{time_total}\n'`
   - 3-A 后：处理中耗时可能仍较长但 < 60s，前端不再超时。
   - 3-B 后：应显著下降（记录前后数值写进测试报告）。
5. 打开一个视频合集详情页，确认封面、总结/字幕标记、时长仍正常（回归 3-B）。

---

## 任务 2：B 站批量下载太慢

### 现象
截图里下载速度从 31KiB/s 一路掉到几百 B/s、ETA 越来越长，2% 卡很久。

### 根因（部分已核实，部分需你实测）
- 当前默认 `format=best`、`concurrent_fragment_downloads=5`、**无外部下载器**：`shared/video_download_ytdlp.py`（`_build_attempts` 约 211 行、`base_opts` 约 228 行）。
- 日志里 `proxy=空`，且速度衰减到字节级，是典型的 **B 站服务端单连接限速**，不是纯代码 bug。
- B 站 DASH 是「单文件 + 支持 range」的形态，`concurrent_fragment_downloads` 对它帮助有限；**真正提速靠 aria2c 多连接（-x）**。

按你定的方向，分三步（**先做 2-A 实测，可能直接解决，就不必上 aria2c**）：

**2-A：先排查网络/代理（零依赖，先做）**
- 查当前下载代理设置：`curl -s http://localhost:8000/settings | python -m json.tool` 看 `download.http_proxy`（字段名见 `backend/app/services/pipeline_tasks.py:484` 的 `_s("http_proxy")`）；或看设置页「下载」`frontend/src/pages/SettingPage/DownloadSettingsPage`。
- 手动测速对照（在项目 `.venv` 里）：
  - 直连：`.venv/bin/yt-dlp -f "bv*+ba/b" -o '/tmp/t.%(ext)s' 'https://www.bilibili.com/video/BV1Av411N7mX' --newline`
  - 走代理（若你有）：加 `--proxy http://127.0.0.1:你的端口`
- 对比两者速度。若走代理明显变快 → 让用户在设置页填 `http_proxy` 即可，**任务2 到此结束**，把结论回报。
- 若直连本身就慢/衰减 → 进入 2-B/2-C。

**2-B：B 站改用 DASH 分离流 + 提高分片并发（纯配置，无新依赖）**
文件 `shared/video_download_ytdlp.py`。
- 确认 B 站分支已在跑 DASH：`_build_attempts` 里 B 站会 strip 掉 `format`，让 yt-dlp 用默认 `bv*+ba/b`（DASH）。核对实际下载的确是分离流合并（看日志 format id）。
- 把 B 站的 `concurrent_fragment_downloads` 默认从 5 提到 **16**（仅对分片式生效；单文件 DASH 靠 2-C）。改动点在 `base_opts["concurrent_fragment_downloads"]`（约 236 行），建议只针对 `_is_bilibili_url(url)` 提高，避免影响其它站点。

**2-C：接入 aria2c 外部下载器（需安装，用户已同意）**
- 安装（一次性）：`brew install aria2`，装完 `which aria2c` 确认。
- 文件 `shared/video_download_ytdlp.py`，`_build_attempts` 的 `base_opts`：**仅当** `shutil.which("aria2c")` 存在时，注入：
  ```python
  "external_downloader": "aria2c",
  "external_downloader_args": {
      "aria2c": ["-x", "16", "-s", "16", "-k", "1M"]
  },
  ```
  （`-x16` 每主机 16 连接、`-s16` 单任务 16 分段、`-k1M` 每段 1MB。）
- 用 `shutil.which` 守卫，**没装 aria2c 时不注入**，保持旧行为，避免报错。
- 注意与 `progress_hooks`：用了 external_downloader 后 yt-dlp 的进度回调粒度会变（可能不再逐帧回调百分比）。核对 `progress_callback`/`speed_callback`（`backend/app/services/pipeline_tasks.py:529-531`）在 aria2c 下是否还有值；若进度条不动，需在计划外单独评估，先保证「能更快下完」。

### 验收
1. 记录基线：用 2-A 的手动命令测一个 BV 号的平均速度/耗时。
2. 依次开启 2-B、2-C，各测同一个 BV 号，记录速度对比（写进 `docs/test-reports/`）。
3. 在真实 UI（`./dev.sh` 起服务）跑一个 B 站批量任务，确认：
   - 下载速度明显提升、ETA 收敛；
   - 处理中页面进度条仍在动（aria2c 下重点回归这条）；
   - 下载完成后能正常进入后续 pipeline。
4. **确认没装 aria2c 的机器上仍能正常下载**（守卫生效）。

---

## 给小米的红线
- 后端改动验证前，先确认跑的是**新进程**（`ps aux | grep uvicorn` 看启动时间 + 含 `.venv`/`--reload`），别对着旧进程测。
- 前端改完跑 `cd frontend && npm run build` 核对（不要只信 `tsc`）。
- `brew install aria2` 属新依赖，用户已同意；但**只装 aria2c 这一项**，不要顺手装别的。
- 任务3-B 若发现会破坏卡片封面/类型，立即停下回报，可只交付 3-A。
- 不改 `.env`、不动 DB schema、不 `git push`、不在脏树上跑「单 commit 过审」。
- 每个任务各自 commit，信息写清对应任务号，方便 Codex 分别审查。
- 三个任务都要求「自己跑数据验证 + 附证据」，不许只看代码猜。
