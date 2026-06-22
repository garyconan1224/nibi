# 手测计划：本地视频 E2E 复测（验证 Bug #2 + Bug #3 修复）

> 目的：在 `d93dbcc`（Bug #3 修复）之上，**用真实 UI 手动确认**本地视频上传能端到端生成笔记。
> 背景：Bug #2（本地 /start 只触发 analyze 不触发 note）已修；Bug #3（本地 note 下载找不到 workspace 根目录的上传文件）已修；但修复后**从没在真实流程里跑通过一次**，本计划补这个收口。
> 执行人：用户手测　|　日期：2026-06-21

---

## 0. 前置准备

- [ ] 用项目根 `./dev.sh` 重启前后端（**不要**手动单独起 uvicorn，否则容易跑到旧代码）
- [ ] 确认后端是新代码：`git log --oneline -1` 应是 `d93dbcc`；后端终端里 uvicorn 启动时间是「刚刚」、命令含 `--reload`
- [ ] 素材就位：`data/videos/三代封神！那四代呢？大疆Pocket 4首发体验.mp4`（已在）
- [ ] 打开浏览器开发者工具 → **Network 面板**（关键：靠它确认请求命中哪个端点）

---

## 1. 用例 B：本地视频 + 带图

**操作步骤**
- [ ] 工作台 → 添加素材 → 选「本地视频」，上传那个 mp4
- [ ] 在预检弹窗（Preflight）**勾选图片分析任务**（要出分镜图）
- [ ] 开始处理 → 观察处理页 5 步进度
- [ ] 等处理完成，自动进入结果页

**验收（每条都要满足）**
- [ ] Network 里：上传后启动处理命中的是 `/workspaces/{id}/items` + `/start`，**不是** `/generate-note`　← Bug #2 关键
- [ ] 处理任务里 `analyze` **和** `note` 都跑了（不是只有 analyze）　← Bug #2
- [ ] 全程**不报**「本地视频未找到」　← Bug #3
- [ ] 进度条正常推进（不是卡在 0%）
- [ ] 结果页：**笔记正文非空**、有实际内容
- [ ] 结果页：**transcript / 字幕非空**
- [ ] 结果页：能看到**分镜图**

---

## 2. 用例 D：本地视频 + 不带图

**操作步骤**
- [ ] 同上传同一个 mp4，但预检弹窗**不勾图片**
- [ ] 开始处理 → 等完成进入结果页

**验收**
- [ ] 同样命中 `/start`、`analyze`+`note` 都跑、不报「未找到」、进度条正常
- [ ] 结果页：**纯文字笔记，正文非空**
- [ ] 结果页：无分镜图（或图片模块显示空态，属正常）

---

## 3. 需要重点关注的点（这次复测的核心价值）

| 关注点 | 为什么重要 | 怎么看 |
|---|---|---|
| ① 命中 `/start` 而非 `/generate-note` | Bug #2 修的是 `/start` 路径；若真实 UI 走 `/generate-note` 等于没修到真实入口 | Network 面板看请求 URL |
| ② `note` 任务真触发 | 之前本地视频只触发 `analyze`，生不出笔记 | 处理页步骤 / 任务列表 |
| ③ 不报「本地视频未找到」 | Bug #3：上传文件落在 workspace 根目录，下载步要能在那里找到 | 处理过程 + 后端终端日志 |
| ④ 笔记正文 + transcript 非空 | 这是最终产物，之前两者都是空 | 结果页 |
| ⑤ 进度条不卡 0% | 之前是 API workaround 导致，正常 UI 应正常 | 处理页 |

**避坑提示**：如果上传后点某个按钮报 `400: URL host cannot be empty`，说明误走了 `/generate-note`（网络链接专用端点，Bug #1，本次不修）——退回去找正确的「开始处理」入口即可。

**耐心提示**：本地视频要做截帧 + VLM + 语音转写，处理可能要几分钟，属正常。

---

## 4. 问题记录 & 截图落地位置

**问题文字**：写在本文件第 5 节「结论」区，每条失败记下——
- 失败现象 + Network 里失败请求的 URL / 状态码 / 响应
- 后端终端日志的报错行
- 卡在 5 步的哪一步

**截图**：存到 `frontend/test-results/e2e/2026-06-21/`（已存在、已有同类截图）
- ⚠️ 该目录被 gitignore（`frontend/.gitignore` 第 25 行）→ 截图**只在本地、不进 git**；要给小米/Codex 看就单独发图
- 命名沿用现有风格：B 带图 → `B-local-with-image-<阶段>.png`（如 `-network` 抓端点 / `-result` 结果页）；D 不带图 → `D-local-no-image-<阶段>.png`
- 目录里已有上次失败的 `B-local-with-image-error.png`，**别覆盖**（保留失败证据），这次通过的图用别的后缀

---

## 5. 结论（手测后填）

- 用例 B：⬜ 通过 / ⬜ 失败（原因：______）
- 用例 D：⬜ 通过 / ⬜ 失败（原因：______）
- 通过后续动作：更新 `docs/test-reports/e2e-2026-06-21.md` 总览表 B/D，并更新 `docs/AI_HANDOFF.md` 顶部指针收口本地视频。
整体要跟“/Users/conan/Desktop/nibi/docs/design/bilinote-video-note-flow-review.html

同时参考截图资产目录：

/Users/conan/Desktop/nibi/docs/design/assets/bilinote-video-note/
”比对和参考
 1.PixPin_2026-06-22_09-34-59.png 这个图片显示右侧会有“开始解析前”，下面的
2.PixPin_2026-06-22_09-37-44.png选择合集的是，与下面的最近任务重叠，考虑两者如何布局调整，可以做到互相不干扰。
3.PixPin_2026-06-22_09-38-53.png 添加链接没有显示封面
4.添加链接应该先选笔记，才有底下各类分类笔记，我还要复刻等等其他功能跟笔记同级的，你先给做做按钮占用位置
5.PixPin_2026-06-22_09-40-59.png笔记风格过多，这里应该只有常用的“精简，详细，教程，等等”常用的几个，并不是都放，这个可以跟我讨论放哪些，也可以参考 bilinote
6.PixPin_2026-06-22_09-43-30.png 3 输出存在是做什么，我似乎没有这个需求，可以删除吗 
7.PixPin_2026-06-22_09-48-19.png http://localhost:5177/processing/note-ec57180a57c6 这个任务我选择截图，中间所见所得没有图片。另外考虑删掉MD 格式，与所见所得冲突，如果删除这里所见所得也不需要名称了。另外调研下这个文本编辑需要怎么安装编辑器。
8.PixPin_2026-06-22_09-51-20.png 这些总结还是太多，考虑融合精简。PixPin_2026-06-22_09-52-04.png 需要跟设置里面的视频模板联动，新增的话同步更新，默认设置里面提示词也可以修改，也可以重置回去，还可以有几个版本保存。
9.PixPin_2026-06-22_09-54-30.png 总结这里可以选择是否插图，ai 分析图片前面解析出来的提示词，进行合理的插入。
10.PixPin_2026-06-22_09-57-14.png PixPin_2026-06-22_09-57-29.png  右边我生成两个总结，顶部还有两个 V0，这两个版本似乎功能冲突，然后命名都不清晰，思考如何解决。
11.导出中有个原文对照，直接导出 str，在 bilinote 网页版本，这个是跟源内容对照的。思考这里应该怎么做。
12.PixPin_2026-06-22_10-25-38.png ai 工具这里的功能似乎我都有，原文对照和重新生成就是源 md 和 ai总结，看看是如何对照和总结，可以优化我的逻辑，看看放在哪里合适。
13.最右上角有“noteshell”这是做什么没有功能是不是要删了
14.PixPin_2026-06-22_10-27-59.png 这里标题反复重复，这里能否放一写原视频的详情页还有标签等等，标签这个以前做过，你找找
15.左侧的按钮看看能放什么内容，然后再看昨天规划的计划，还有什么没做完参考/Users/conan/Desktop/nibi/docs/design/bilinote-video-note-flow-review.html

16.另外 b 站和 youtube 等网站有的是有字幕的，直接拿取字幕是最快速的方式，看看如何跟现在的流程去做调整。
17.点击上传本地视频，没有在预检弹，直接跳转到任务中了，PixPin_2026-06-22_10-34-59.png ，然后就立马报错。f12 显示“[usePipelineTasks] 拉取的任务数据: (50) [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}]0: {task_id: 'note-5dfdbe364531', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}cancel_requested: falsecreated_at: "2026-06-22T02:36:34.892335+00:00"error: "transcribe 失败: tuple index out of range"log: []payload: {url: '/Users/conan/Desktop/nibi/data/workspaces/b2c9f49a…53796/看视频别再疯狂截图了_这个开源神器一键生成笔记_重点都给你标好了_Web3村长.mp4', source_type: 'local', video_basenames: Array(1), workspace_id: 'b2c9f49a-6853-4335-b132-7a8556b53796'}progress: 0.3project_id: "default_project"result: {note_kind: 'video'}retry_of: ""status: "FAILED"task_id: "note-5dfdbe364531"task_type: "note"updated_at: "2026-06-22T02:36:42.669292+00:00"[[Prototype]]: Object1: {task_id: 'note-6b0c641aad0d', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}2: {task_id: 'note-ec57180a57c6', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}3: {task_id: 'note-374f1711b6e2', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}4: {task_id: 'analyze-c47c247817a9', project_id: 'default_project', task_type: 'analyze', payload: {…}, status: 'SUCCESS', …}5: {task_id: 'note-01e987fe32f8', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}6: {task_id: 'analyze-5507852475ac', project_id: 'default_project', task_type: 'analyze', payload: {…}, status: 'SUCCESS', …}7: {task_id: 'note-6ce00e2c96aa', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}8: {task_id: 'note-ca7a454901af', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}9: {task_id: 'note-62d4388d783f', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}10: {task_id: 'note-6069dfea8844', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}11: {task_id: 'note-85c9f0630cc1', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}12: {task_id: 'audio-confirm-409', project_id: 'proj', task_type: 'audio', payload: {…}, status: 'SUCCESS', …}13: {task_id: 'audio-confirm-200', project_id: 'proj', task_type: 'audio', payload: {…}, status: 'FAILED', …}14: {task_id: 'note-dc6cda969dbb', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}15: {task_id: 'note-3a9669389ee5', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}16: {task_id: 'note-7b357c96af7c', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}17: {task_id: 'note-a0f934edd079', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}18: {task_id: 'note-c75eb9c61d68', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}19: {task_id: 'note-9f102e47edf5', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}20: {task_id: 'note-6258c46616f3', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}21: {task_id: 'note-6c1bd602be5f', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}22: {task_id: 'note-e9ddbd91cec0', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}23: {task_id: 'note-0e07a77c34cc', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}24: {task_id: 'note-3b67b189d74f', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}25: {task_id: 'note-451c2bb6a3e3', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}26: {task_id: 'note-461bf16f737e', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}27: {task_id: 'note-b1efb9dae5fb', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}28: {task_id: 'note-8fd47d844e03', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}29: {task_id: 'note-9a92be5c427f', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}30: {task_id: 'note-70f8d0e5f563', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}31: {task_id: 'note-81556686e9c4', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}32: {task_id: 'note-4889773a54fe', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}33: {task_id: 'note-19a1f040c9f8', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}34: {task_id: 'note-accad6f551a4', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}35: {task_id: 'note-556dd08e1f1c', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}36: {task_id: 'note-c99fe2227411', project_id: '4554aa57-6a05-4901-a8b5-6107fd945d5a', task_type: 'note', payload: {…}, status: 'SUCCESS', …}37: {task_id: 'note-6ef689687a69', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}38: {task_id: 'note-dde42896d24b', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}39: {task_id: 'note-adfbd79b13d6', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}40: {task_id: 'note-4e45c21fd20b', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}41: {task_id: 'note-6d5ff2700503', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}42: {task_id: 'note-0860ec21dbe6', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'FAILED', …}43: {task_id: 'note-0a9dd9b77be5', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'CANCELLED', …}44: {task_id: 'note-398675ad1f18', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'CANCELLED', …}45: {task_id: 'note-550b1e4845b3', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}46: {task_id: 'note-8d0230944d43', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'CANCELLED', …}47: {task_id: 'note-1e54499f6c7b', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}48: {task_id: 'note-27c7536b7b45', project_id: 'default_project', task_type: 'note', payload: {…}, status: 'SUCCESS', …}49: cancel_requested: falsecreated_at: "2026-06-10T09:49:09.090404+00:00"error: ""log: []payload: {url: 'https://www.bilibili.com/video/BV15r766EEg8', workspace_id: '46b80e54-6673-44db-8bff-bdaf0e5acc5e', preflight: {…}}progress: 1project_id: "default_project"result: {video_title: 'Github冷门项目推荐：可以随时修改AI生成的各种HTML文件', video_thumbnail_url: 'http://i0.hdslb.com/bfs/archive/c7198d818c952b8454756f1a2e0414569a2f5f10.jpg', video_duration: 77.136, video_uploader: '和老曹一起玩AI'}retry_of: ""status: "SUCCESS"task_id: "note-2f8e5e829220"task_type: "note"updated_at: "2026-06-10T09:51:45.046362+00:00"[[Prototype]]: Objectconstructor: ƒ Object()hasOwnProperty: ƒ hasOwnProperty()isPrototypeOf: ƒ isPrototypeOf()propertyIsEnumerable: ƒ propertyIsEnumerable()toLocaleString: ƒ toLocaleString()toString: ƒ toString()valueOf: ƒ valueOf()__defineGetter__: ƒ __defineGetter__()__defineSetter__: ƒ __defineSetter__()__lookupGetter__: ƒ __lookupGetter__()__lookupSetter__: ƒ __lookupSetter__()__proto__: (...)get __proto__: ƒ __proto__()set __proto__: ƒ __proto__()length: 50[[Prototype]]: Array(0)at: ƒ at()concat: ƒ concat()constructor: ƒ Array()copyWithin: ƒ copyWithin()length: 2name: "copyWithin"arguments: (...)caller: (...)[[Prototype]]: ƒ ()[[Scopes]]: Scopes[0]entries: ƒ entries()every: ƒ every()fill: ƒ fill()filter: ƒ filter()find: ƒ find()findIndex: ƒ findIndex()findLast: ƒ findLast()findLastIndex: ƒ findLastIndex()flat: ƒ flat()flatMap: ƒ flatMap()forEach: ƒ forEach()includes: ƒ includes()indexOf: ƒ indexOf()join: ƒ join()keys: ƒ keys()lastIndexOf: ƒ lastIndexOf()length: 0map: ƒ map()pop: ƒ pop()push: ƒ push()reduce: ƒ reduce()reduceRight: ƒ reduceRight()reverse: ƒ reverse()shift: ƒ shift()slice: ƒ slice()some: ƒ some()sort: ƒ sort()splice: ƒ splice()toLocaleString: ƒ toLocaleString()toReversed: ƒ toReversed()toSorted: ƒ toSorted()toSpliced: ƒ toSpliced()toString: ƒ toString()unshift: ƒ unshift()values: ƒ values()with: ƒ with()Symbol(Symbol.iterator): ƒ values()Symbol(Symbol.unscopables): {at: true, copyWithin: true, entries: true, fill: true, find: true, …}[[Prototype]]: Object
usePipelineTasks.ts:63 [usePipelineTasks] 拉取的任务数据: (50) [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…},”
18.PixPin_2026-06-22_11-00-43.png 本地视频任务中这里没有图还有视频名称等信息。
19.PixPin_2026-06-22_11-00-43.png任务中如果是插图，还有各种不同的进度，本地应该是拆分音频，转录，分析，生成笔记，插图，完成，你看这样对吗，如果是在线视频就增加排队，下载等