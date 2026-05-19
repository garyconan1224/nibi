# 已完成工作记录

> **本文件作用**：变更日志风格，记录每个已完成 Phase / 子任务的**详细内容**——不只是 commit hash，包含影响范围、关键改动、为什么这么做。**便于后续修改时查阅"为什么当时这么写"**。
>
> **维护规则**：每完成一个子任务，在本文件**追加**一段（不删旧记录），格式见下方"记录模板"。
>
> Last updated: 2026-05-18 (Phase 3C 完成)

---

## 记录模板（复制后填写）

```markdown
## Phase XX – <子任务编号> <标题>

**完成日期**：YYYY-MM-DD
**模型 / 工具**：Opus 4.7 / 小米 2.5 Pro / ...
**分支**：feat/xxx
**Commit**：abc1234 / def5678 / ...

### 影响范围
- 后端 / 前端 / 文档 / 配置 / ...

### 关键改动
- 改了什么文件，做了什么
- 新增了什么接口 / 组件 / 数据结构

### 为什么这么做
- 当时面对的问题
- 考虑过的备选方案 + 为什么没选
- 隐藏假设 / 已知限制

### 留给后续的影响
- 后续修改这块时要注意什么
- 哪些依赖了它（grep 提示）
```

---

# 历史记录（倒序，最新在上）

---

## Phase N8 – 音频分支：VAD + pyannote 说话人 + librosa 音乐分析

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n8-audio-branch（worktree `/Users/conan/Desktop/nibi-n8`）
**Commit**：dc14841 + N8.6 文档

### 影响范围
- 依赖：silero-vad / librosa / pyannote.audio（含 torch + torchaudio）
- 后端：新增 shared/audio_analyzer.py（~330 行）+ pipeline_tasks::handle_audio_task 大改 + workspaces 路由 bridge 透传
- 测试：新增 9 个 pytest（+1 个 opt-in 真模型 skip）

### 用户决策
- VAD：silero-vad
- pyannote 说话人分离：做（首次需 HF_TOKEN + 同意模型协议）
- 音乐分析：BPM + 调性 + Suno/Udio 提示词全做

### 关键改动
- 新增 `shared/audio_analyzer.py`：
  - 数据类：VadResult / DiarizationResult / MusicAnalysis
  - run_vad / run_diarization / analyze_music / generate_music_prompt / export_srt / export_txt / assign_speakers_to_segments
  - 所有重模型 lazy import + 缺包 graceful skip
- `handle_audio_task` 扩展：
  - 1.5 VAD：转写前跑；无人声 + 无音乐分析 → 日志告警 + 跳过 ASR
  - ASR 接 whisper_lang 透传给云端 /audio/transcriptions
  - 3.5 说话人分离：HF_TOKEN 缺则跳过；否则跑 pyannote 把 speaker 回写到 transcript_segments
  - 3.6 音乐分析：librosa 特征 + LLM 拼 Suno/Udio 提示词
  - 3.7 字幕导出：.srt + .txt 落盘
  - result JSON 加 vad / diarization / music / subtitle_paths 字段
- `_bridge_to_pipeline_payload`：透传 asr / speaker_diarization / music_analysis / subtitle_file 子参数

### 为什么这么做
- **范围收缩到 N8b**：SPEC §5 含"无人声切音乐弹窗"/"说话人标签人工修正 UI"/"多段音乐 6 维度切分"，都涉及前端交互，本期只做后端管线
- **lazy import + 缺包 graceful skip**：任何重模型装不上都不应让 audio 流程崩；让 CI 没装重模型的环境也能跑测试
- **VAD 缺包按"有人声"continue**：保守假设，不主动阻塞 ASR
- **HF_TOKEN 三层环境变量都查**：社区命名不统一（HF_TOKEN / HUGGINGFACE_TOKEN / HUGGING_FACE_HUB_TOKEN 都接）
- **silero VAD 真模型测试默认 skip**：torch jit 模型加载污染 asyncio loop，让 starlette TestClient 测试 crash。`RUN_AUDIO_MODEL_TESTS=1` 才跑

### 留给后续的影响
- **HF_TOKEN 配置流程要文档化**：应在设置页加「HuggingFace Token」字段写入 settings_store
- **音乐分析 LLM 没复用 chat_runner**：直接调 `provider.chat`，未来要接 chat 历史需要抽象化
- **transcript_segments 形状跨供应商不一致**：OpenAI / SiliconFlow 各家略不同；export_srt 已对缺字段做 try/except 兜底，但极端情况字幕可能为空
- **N9/N10 可复用模式**：generate_music_prompt 的"LLM 调用器注入 + 容错 JSON 解析"可复制到 image 联想 / text 改写流程

---

## Phase N7 – 视频分支：AI 镜头分析（PySceneDetect 集成）

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n7-video-branch（worktree `/Users/conan/Desktop/nibi-n7`）
**Commit**：7457d02

### 影响范围
- 依赖：requirements.txt 追加 scenedetect>=0.6.4
- 后端：shared/video_analyzer.py 大改 + backend pipeline_tasks/workspaces.py 透传子参数
- 测试：新增 9 个 pytest（CaptureParams 边界 + 合成视频烟雾）

### 范围收缩决策（重要）
原 N7 计划包含 3 项：AI 镜头 / 路径 1（字幕直接）/ 路径 3（视频模型直接）。
**实际只做了 AI 镜头**，路径 1 & 3 拆出独立 N7b。原因：
- 路径 1 需要 item 维度的字幕抽取——当前 item pipeline 无此步骤，要做需先做 N8 音频管线的 Whisper 集成
- 路径 3 需要视频大模型 API 客户端（Gemini 1.5 Pro / Qwen-VL-Max-Video 等）——新供应商集成，需用户决定接哪家
- 强行塞进 N7 会让估时膨胀到 15-20h+ 且引入多个待决问题

### 关键改动
- 新增 `shared/video_analyzer.py::extract_frames_by_scenes(video_path, frames_per_shot=3)`：
  - PySceneDetect ContentDetector 检测镜头切换点
  - 每镜头 2 帧（首+尾）或 3 帧（首+中+尾，默认）
  - 直接 `cap.set(POS_FRAMES, f) + cap.read()` 定位 target frame，不需要全程顺序读
  - 无切换点（极短视频 / 单镜头）fallback 到首帧
- 新增 `CaptureParams` dataclass + `from_dict` 工厂：
  - 兼容 N5 之前的老 boolean 形状（true → 全默认）
  - 兼容缺字段（mode 非法 → scene；frames_per_shot 非 2/3 → 3）
  - 字符串数字 / 负值自动 clamp
- `extract_frames` 增加 `max_frames` 参数（之前没有上限）
- `process_video` / `run_batch_analysis` 增 `capture_params: CaptureParams | None`：
  - None → 旧 interval 行为（向后兼容老调用方，比如 legacy streamlit 入口）
  - mode=scene → extract_frames_by_scenes
  - mode=interval → extract_frames（含 max_frames）
- `_bridge_to_pipeline_payload`：把 `item.preflight.tasks.frame_prompts` dict 透传到 payload
- `handle_analyze_task`：从 payload 读 frame_prompts → CaptureParams.from_dict → 传给 run_batch_analysis，并在 log 里打印实际配置

### 为什么这么做
- **从 N5 一路打通到管线**：N5 立了 UI + 持久化数据，N7 把这些数据真正送到截帧引擎，闭环
- **CaptureParams 而不是 \*\*kwargs**：参数 4 个，又要从 dict 反序列化，dataclass 更清楚 + 测试好写
- **直接 seek vs 顺序读**：scene 检测后我们已经知道目标 frame index，没必要遍历整个视频读完丢弃 99% 的帧
- **None capture_params = 老行为**：legacy streamlit 入口、CLI 脚本可能直接调 run_batch_analysis 不带新参数；保兼容

### 留给后续的影响
- **N7b**（路径 1 & 3）：需要 item 字幕抽取（依赖 N8）+ 视频大模型 API 集成（新供应商决策）
- **N8 音频**：会引入 Whisper item-level 抽取——做完后 N7b 路径 1 就能动了
- **PySceneDetect 长视频性能**：300+ MB 视频检测 30-60 秒，本 phase 没做异步进度上报，照任务运行中状态即可。如果用户反馈卡顿，加 scene detect 阶段的 set_progress
- **frame_prompts.format / lang 字段**：N5 引入但 N7 未消费——这是「提示词输出」步骤的事，归 N7b/N9 范围

---

## Phase N6 – 任务级 LLM 对话上下文素材多选 chip + RAG 兜底

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n6-task-chat（worktree `/Users/conan/Desktop/nibi-n6`）
**Commit**：ae7ed8b (N6.1) / 435e8cb (N6.2~N6.3) / 935d933 (N6.4~N6.6)

### 影响范围
- 后端：新增 chat context 服务 + chat 路由扩展 + ChatRunner system_prompt 注入
- 前端：新增 TaskChatPanel + chat service 类型扩展 + WorkspaceDetail AI 对话 tab
- 测试：新增 5 个 pytest（chat_context 单元测试）

### 关键改动
- 新增 `backend/app/services/chat_context.py::build_item_context`：按 workspace + item_ids 拼 system prompt，覆盖 task 背景 + 每个 item 的 name/type/tags/results。char-based 阈值 12000 触发截断
- `POST /workspaces/{id}/chat` 请求体加 `item_ids: list[str]`，返回值加 `context_truncated` / `used_item_ids`
- `ChatRunner.start_turn` 加 `system_prompt` 参数：注入到 LLM history 第 0 位但**不落盘**（避免污染对话历史，允许下一轮换素材）
- 新增 `frontend/src/components/workspace/TaskChatPanel.tsx`：素材 chip 多选条 + 全选 + 截断徽章
- WorkspaceDetail AI 对话 tab 从占位 EmptyState 切到 TaskChatPanel
- **保留**：浮动 ChatSidebar 不动，作为「无上下文」快捷入口

### 为什么这么做
- **char 阈值 vs 真 embedding RAG**：现有 `rag_qa_service` 基于 cross-workspace 索引（`project_json_dir`），与 task-level item 上下文不匹配。做真 task-level RAG 需新索引基础设施——超出 N6 6-8h 估时。char 截断在 v1 已覆盖 SPEC §1.5 的「token 兜底」要求。真 embedding RAG 等 N9/N10 跨素材聚合真有需求时再上
- **system_prompt 不落盘**：每轮根据当前勾选重新生成，避免老 prompt 滞留污染后续对话；用户切素材也能即时反映
- **保留浮动 ChatSidebar**：SPEC 没要求砍——它仍是右侧"任意问"快捷入口
- **`results` 字段提取**：跨素材类型 results 形状差异大，用 `_pick_str` 多 key fallback（`summary` / `video_summary` / `asr_summary` 等）+ type 兜底

### 留给后续的影响
- **N7~N10 后端分支**：写新 results 字段时若想让 chat 看到，需在 `chat_context._format_results` 里加 key（或保持向后兼容的命名：`summary` / `transcript` / `ocr_text` / `description` / `frame_prompts`）
- **真 RAG 接入路径**：未来若做 task-level embedding RAG，应在 `build_item_context` 内加「if 截断 → embedding 检索 query 相关 chunks 替换被截 items」，前端无需改动
- **`item_ids` 校验**：路由层未校验 id 属于该 workspace，只在 `build_item_context` 里跳过未命中——理论上存在「跨 workspace 注入」风险，后续考虑路由层加严格校验

---

## Phase N5 – Preflight 抽屉细化（按素材类型展开所有子参数）

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：feat/phase-n5-preflight（worktree `/Users/conan/Desktop/nibi-n5`）
**Commit**：02e8d7d (N5.1) / 644fae1 (N5.2~N5.5)

### 影响范围
- 前端（纯前端，不动后端）
- 文件：
  - 新增 `frontend/src/lib/preflightTasks.ts`
  - 新增 `frontend/src/components/workspace/PreflightTaskDetails.tsx`
  - 改 `frontend/src/components/workspace/PreflightConfigPanel.tsx`

### 关键改动
- **数据形状升级**：`PreflightConfig.tasks` 从 `{id: boolean}` 升到 `{id: {enabled, ...params}}`。后端类型 `Record<string, unknown>` 天然兼容，无需迁移。
- **三个核心工具**（`preflightTasks.ts`）：
  - `getTaskParams(tasks, type, id)`：读取任意旧/新形状，按 type+id 补齐默认字段
  - `setTaskParams(tasks, id, params)`：不可变更新
  - `normalizeTasksShape(tasks, type)`：把整个 tasks 升级到新形状（打开抽屉 + 保存时各调一次）
  - `getTopLevelTasks(type)`：替代 PreflightConfigPanel 内联的 `getTaskOptionsByType`，新增图片「多图对比」/文字「多文对比」一级项
- **子参数 UI**（`PreflightTaskDetails.tsx`）：按 (type, taskId) 派发
  - 视频 `frame_prompts`：截帧模式 / 间隔秒数 / 最大帧数 / 镜头取帧数 / 格式 / 语言
  - 视频 `video_summary`：3 条路径 + 总结深度
  - 音频 `asr`：Whisper 语言（8 种）
  - 视频/音频 `music_analysis`：Suno / Udio 格式开关
  - 图片 `frame_prompts`：MJ/SD/JSON
  - 图片/文字 `association`：4 维联想方向多选
  - 文字 `summary`：摘要长度 / `rewrite`：4 种风格 / `translate`：7 种目标语
- **PreflightConfigPanel 第三区**：从单层 Checkbox 列表 → 「一级开关 + 子参数面板」嵌套结构；勾选 enabled 才展开子参数

### 为什么这么做
- SPEC §3.4 明确要求 Preflight 抽屉「展开所有子参数」，与添加素材模态（粗粒度）和设置页（默认值）分层
- **嵌套对象** vs **扁平 `id_field` 命名**：选嵌套——后端 schema 不用动、前端 TaskDetails 子组件直接接收完整 params、读写一致
- **不动后端**：N5 只立 UI + 持久化；子参数实际生效要等 N7~N10 各分支接入

### 留给后续的影响
- **N7~N10 后端**：消费 `preflight.tasks[*].xxx` 时按新形状读，注意 `tasks[id]` 可能是老 boolean（来自 N5 前的存量数据），调用 `bool(task) if isinstance(task, bool) else task.get('enabled')`
- **AddMaterialModal**：仍写老 boolean 形状（粗粒度），打开抽屉时由 `normalizeTasksShape` 自动升级——不需要同步改
- **关联标识**：图片「多图对比」/ 文字「多文对比」一级项已加，但只是 UI 占位，实际跨素材对比逻辑在 N9/N10 实现

---

## Phase 3C – 标签库 7 维度（自动打标 + 手动校正 + 按标签筛选）

**完成日期**：2026-05-18
**模型 / 工具**：Opus 4.7（桌面）+ 小米 2.5 Pro（终端，免费）混合
**分支**：`feat/phase3c-tag-library` → merge 到 main（`2fd8fd3`，--no-ff）
**Commit**：`4a04c1d` / `606b9f7` / `d93d001` / `aea7f55` / `52222e5` / `c1f5b6d` / `5d9b3ba` / `2fd8fd3`（共 8 个，含 merge）
**模型分工**：
- 小米：3C.1（config + 字段）、3C.3（CRUD 端点）、3C.6（item 页 tags 面板）—— 模板性任务
- Opus：3C.2（LLM prompt + 严格 JSON 解析）、3C.4（task 钩子 + 异步线程）、3C.5（chip 栏 + URL 双向同步）—— 设计含思考的任务

### 影响范围
- 后端 service：`tag_generator.py`（LLM 打标 + JSON 解析 + 校验）
- 后端 model：`WorkspaceItem.tags: Dict[str, Any]` 字段（持久化进 workspace.json）
- 后端 config：`shared/config.py::TAG_DIMENSIONS`（6 系统维度 + custom_tags 候选值表）
- 后端 routes：`workspaces.py` 加 3 个 tags 端点 + `_autotag_items_for_task` 钩子
- 前端 types：`SystemTagDimension` / `ItemTags`
- 前端 constants：`tagDimensions.ts` 镜像后端 config（手工同步）
- 前端 components：`TagFilterBar.tsx`（chip 多选）、`ItemTagsPanel.tsx`（展示 + 重新生成）
- 前端 hooks：`useTagFilter.ts`（URL search params 双向同步 + 内存过滤）
- 前端 pages：WorkspaceList 顶部挂筛选栏；4 个 result 页挂 ItemTagsPanel
- 测试：4 个新测试文件，共 12 个新用例，全 backend 101 passed

### 关键改动

**Tag 数据形状（设计契约）**
```python
WorkspaceItem.tags = {
    "content_type": "教程",           # 6 个系统维度，单选 enum
    "subject_domain": "科技",
    "difficulty": "入门",
    "duration_band": "短",
    "information_density": "高",
    "emotion_tone": "中性",
    "custom_tags": ["前端", "React"],  # 自由文本数组
    "_generated_at": "ISO8601",       # 元数据
    "_generated_model": "Qwen/..."
}
```

**LLM 打标 service（3C.2）**：调当前默认 chat provider，prompt 严格要求返回 JSON；解析层支持 markdown 代码块包裹；校验层对系统维度做 `value in choices` 检查，非法值丢弃不抛；任何异常返回 `{}` + log warning（不阻塞主流程）。

**自动打标钩子（3C.4）**：`register_success_callback("analyze"|"text"|"audio"|"image", ...)`，在 daemon Thread 里跑 `generate_tags`，避免阻塞 task worker。跳过已有 tags 的 item，避免重复消耗 LLM 配额。

**URL 双向同步（3C.5）**：`?tags.content_type=教程,访谈&tags.difficulty=入门&tags.custom=React` 格式；`useSearchParams` + `replace: true` 不污染浏览器历史；同维度 OR / 跨维度 AND 语义；custom_tags 走 contains。

**前端筛选（3C.5）**：筛选纯内存做，不走后端接口（性能足够，列表小）。筛选规则：保留至少一个 item 命中筛选的 workspace，工作空间卡片展示该空间下匹配的 items。

### 为什么这么做

- **7 维度选择**：plan 默认 6 个系统维度 + 1 个自由 custom_tags，平衡覆盖度与 LLM 推理稳定性。维度名 / 候选值放在 config，以后改值不改代码
- **存 item.tags 字段而不是独立文件**：减少 IO 套路；tags 本身就是 item 的衍生属性，跟随 workspace.json 走最自然
- **自动跳 + 手动补打**：自动跳保证「分析完即用」；手动按钮兜底失败场景（首次 LLM 调用可能因 prompt 工程问题失败）；不做后台批量是为了避免一次性触发限流
- **筛选纯前端**：列表数据量小（< 100 workspaces），无需后端 query；URL 同步让筛选状态可分享 / 可刷新
- **前端 hardcode 维度配置**：与 shared/config.py 同步两边的代价 < 加一个 GET /tags/config 端点 + 客户端缓存的复杂度
- **chip + dropdown 用原生 div + 外部点击监听**：项目无 Popover 组件，加一个 radix-ui/popover 会引入新依赖；自己实现一个最小可用版 OK

### 留给后续的影响

- **配置同步双写风险**：`shared/config.py::TAG_DIMENSIONS` 和 `frontend/src/constants/tagDimensions.ts` 必须保持一致，加维度时记得改两处。未来想消除可加 GET /tags/config 端点
- **未做手动编辑 UI**：当前 ItemTagsPanel 只展示 + 重新生成，没有给用户「点 badge 直接改值」的入口；后端 PUT /tags 端点已就绪，前端补 UI 即可
- **prompt 工程稳定性**：当前 prompt 在 SiliconFlow 默认模型上测过 OK，换模型时可能需要重测；模型选择不在 settings 里独立配置，跟随 default chat profile
- **未提供「跳过自动打标」开关**：如果用户不想每次分析都触发 LLM 调用，需要在 settings 里加开关 + 钩子里读 settings；目前是硬编码自动跳
- **筛选语义**：跨维度 AND 可能让结果过少；当前空态有清除按钮兜底，UI 上够用。如果用户觉得 AND 太严，可改成 OR（一行代码改动）
- **custom_tags 在 LLM 生成时数量限制为 10**：避免模型失控塞太多；如果觉得限制太死可调 `tag_generator._validate_and_normalize`

### 验证

- 后端：`pytest tests/backend -q` 101 passed（含 12 个新用例）
- 前端：`pnpm tsc --noEmit` 通过
- 端到端：未做（用户已确认搜索链路通过，3C 钩子需要触发新的分析才能验证，留给后续手动跑）

---

## Phase 3B – 知识库 UI（跨工作空间 RAG 检索）

**完成日期**：2026-05-18
**模型 / 工具**：Opus 4.7（桌面 Claude Code）
**分支**：`feat/phase3b-knowledge-search`（待 merge 到 main）
**Commit**：`c606ba4` / `24089ed` / `adf5fb3` / `92b25a6` / `8388c71`（共 5 个）

### 影响范围
- 后端：新增 2 个 service（`workspace_knowledge.py` / `workspace_search_service.py`）+ 1 个 router（`search.py`）；扩 `workspaces.py` 加 `/search` 子路由；`main.py` 注册新 router
- 前端：新增 `services/search.ts` + `pages/SearchPage/SearchPage.tsx` + `pages/WorkspacePage/WorkspaceSearchBar.tsx`；改 `router.tsx`、`layouts/AppShell.tsx`、`pages/WorkspacePage/WorkspaceDetail.tsx`
- 测试：`tests/backend/test_workspace_knowledge.py` / `test_workspaces_search.py` / `test_global_search.py`，共 7 个新用例
- 缓存目录：`data/.local/embeddings/<workspace_id>.{faiss,meta.json}`

### 关键改动
- **数据桥（3B.1）**：把每个 `WorkspaceItem.results` 序列化为临时 JSON 文件，复用 `shared/knowledge_base.load_folder_as_knowledge(only_paths=...)` 喂给 FAISS，不改核心算法
- **缓存层（3B.1）**：以 items 内容 sha256 hash 作为缓存键；命中则反序列化 `VideoChunk` + `faiss.read_index`；不命中重建并写盘；`invalidate_workspace_index()` 用于 item 增删时主动失效
- **单空间检索（3B.2）**：`POST /workspaces/{wid}/search`，复用 `retrieve_with_sources` + `rag_qa_service` 的 LLM 调用模式
- **跨空间检索（3B.3）**：`POST /search`，`ThreadPoolExecutor(max_workers=4)` 并发各 workspace 取候选 → 合并入池 → `rerank_documents` 二次精排取 top_k（量纲统一）→ 综合回答；reranker 失败降级按原 score 排
- **前端检索页（3B.4）**：`/search` 路由 + 范围下拉（全部 / 单工作空间）+ ReactMarkdown 答案区 + 源卡片（含 score / 类型 badge / jump_url）；AppShell 侧栏 🔍 图标接到此页
- **内嵌检索条（3B.5）**：`WorkspaceDetail` 左主区顶部挂 `WorkspaceSearchBar`（窄版），结果内联可折叠
- **SearchSource 字段约定**（plan §Q4）：`workspace_id` / `workspace_name` / `item_id` / `item_type` / `item_title` / `chunk_excerpt` (≤200 字) / `score` / `jump_url`

### 为什么这么做
- **不改 `shared/knowledge_base.py` 核心**：里面 511 行算法是 Streamlit 旧入口 + RAG 旧接口共用的，改动影响面太大；现有 `only_paths` 参数已够用
- **临时 JSON 文件方案**：避免给 knowledge_base 增加「从 dict 列表加载」入口，绕开数据结构演化风险；缓存命中后不再需要这些临时文件
- **items_hash 缓存策略**：相比按 `updated_at` 失效更稳——用户手改 results 也能触发重建；空间换时间，hash 计算成本 ≪ embedding API 调用
- **rerank 跨空间合并 vs score 归一化**：reranker 二次精排比 min-max 规范化更可靠（不同空间向量分布差异大，min-max 容易失真）
- **前端不传 api_key**：后端 fallback 到 `settings.openai_api_key`，前端不沾敏感字段（plan §Q3）

### 留给后续的影响
- **缓存失效未自动接入 item CRUD**：目前 `invalidate_workspace_index` 仅暴露 API，未在 `workspaces.py` 的 add_item / remove_item / update_item 钩子里调用。下次 item 变更时 hash 自然失效会触发重建，但有一次 stale window。如果未来希望立刻生效，需要在 add/remove/update item 后调一次（注意 add_prompt_version 不影响 results 不用调）
- **embeddings 占位字段**：`LongKnowledge.embeddings` 在缓存命中时填 `np.zeros((ntotal, dim))`——目前下游只用 `index` 做 ANN 搜索 + `chunks` 文本不会读这个数组，安全；如果将来改用 `embeddings` 字段，需要持久化真实向量
- **未做并发限流**：跨空间检索一次 API 调用 = workspace 数 × embedding 调用，3+ 个空间触发 SiliconFlow 限流时需要降并发或加退避
- **i18n**：3B 全程用硬编码中文文案（与现有 AppShell / WorkspaceList 风格一致），未抽 i18n key；后续若做英文版需要补 locale
- **测试覆盖**：所有外部 API（create_embeddings / rerank_documents / LLM）都 mock；真实端到端验证需要跑 `./start.sh` + 至少 2 个含 results 的 workspace

---

## Phase 3A – 视频工作台清理 + LICENSE

**完成日期**：2026-05-17
**模型 / 工具**：小米 2.5 Pro（终端 Claude Code）
**分支**：main
**Commit**：`9bb0e42` / `0840702` / `1df97bb` / `368010b` / `a1cb6f9` / `948c115`（共 6 个）

### 影响范围
- 前端：删除整个 `frontend/src/pages/HomePage/` 目录、`frontend/src/layouts/{HomeLayout,WorkbenchShell}.tsx`、`frontend/src/__tests__/NoteForm.test.tsx`、4 个 locale JSON 里 HomePage 相关文案
- 路由：`router.tsx` 删 `/home`，默认跳转改 `/workspaces`
- 后端：`backend/app/main.py` 卸载 `notes.py` 路由（旧 BiliNote 兼容接口，前端零引用）
- UI：`AppShell.tsx` 移除侧栏"工作台"导航项 + logo 跳转改 `/workspaces` + 删未使用的 `Home` 图标 import
- 仓库根目录：新增 `LICENSE`（MIT，作者 conan，年份 2026）

### 关键改动
- 净减 3499 行代码（22 个文件删除 + 3 个文件修改）
- 路由 fallback：访问 `/home` → 404Page
- BiliNote 兼容路由（`/api/*`）整体下线

### 为什么这么做
- 项目曾有两套并存入口：旧 `/home`（BiliNote 单页作业台）和新 `/workspaces`（v1.1 设计契约的主线）
- 新主线已完全覆盖旧入口能力（视频也能进工作空间）
- 后续 Phase 3B（知识库 UI）和 3C（标签库）需要在统一数据模型上建索引，必须先清理双轨数据
- 备选方案：保留旧入口仅隐藏 nav——拒绝，因为代码长期负担

### 留给后续的影响
- **WorkbenchShell** 已删除。如果后续有页面需要类似"顶栏 Header + 主区"的 wrapper，应直接用 `AppShell` 或新建轻量 Layout
- **`/api/*` 路由**已下线。如果未来要做"外部工具调本项目能力"（Phase 9 的 API 模式），需要新设计 RESTful 路由
- **`Home` 图标 import** 已从 `AppShell.tsx` 移除。如果新增侧栏项需要 home 形状图标，从 lucide-react 重新 import
- grep 提示：`grep -rn "/home" frontend/src/` 应零命中（已验证）

---

## Phase 2D – SQLite 切换评估

**完成日期**：2026-05-17
**模型 / 工具**：小米 2.5 Pro
**分支**：main
**Commit**：`a946fa2`

### 影响范围
- 仅文档：新增 `docs/archive/phase-2d-sqlite-evaluation.md`（122 行）
- 无代码改动

### 关键改动
- 实测各 store 体量：task_store 3.4 MB / settings 5.9 KB / chat 1.9 KB / workspace 2.7 KB
- 基准测试：task_store 全量读取 13.6 ms，序列化 30 ms
- 逐项评估 spec v2 §54 行的 4 个 SQLite 触发条件
- 给出复审条件：task_store > 10MB / 首屏 > 300ms / 跨任务联合查询 / 多进程部署 / 事务需求

### 为什么这么做
- spec v2 §3 表里 2D 是 Phase 2 收尾的"仅评估，不一定迁移"动作
- 当前用 JSON store 工作良好（首屏 13.6ms 远低于 500ms 阈值）
- 备选：直接迁 SQLite——拒绝，过度工程

### 留给后续的影响
- Phase 5（存储/性能升级）启动条件已明确写入本评估报告 §6
- 如果未来要做多进程部署（gunicorn workers > 1），**必须**先切 SQLite（JSON store 无并发写保护）

---

## Phase 2 – 内容能力扩展（2A / 2B / 2C.1 / 2C.2 总览）

**完成日期**：2026-05-15 至 2026-05-17
**模型 / 工具**：Opus 4.7（2A / 2C.1）+ Sonnet 4.6（2B / 2C.2）

### 关键交付
- **2A**：LLM 对话侧栏（workspace-aware 流式 SSE，接 SiliconFlow chat_completion_stream）+ 收藏夹管理页（含 5 个端点 pytest）
- **2B**：音频结果页（精简版 VideoResultPage，去三轨保留 transcript + ReactMarkdown 渲染 summary）
- **2C.1**：文本输入层（pypdf / python-docx / readability-lxml 三件套，pipeline 注册 text 任务，workspaces 上传扩展 PDF/DOCX/HTML）
- **2C.2**：文本结果页 + 提示词版本栈（PromptVersionStack 组件复用到 image/video/text 三页）

### 留给后续的影响
- 4 种结果页（video/image/audio/text）的产物路径不统一（在各自的 `_materialize` 端点里），**Phase 3B.1 数据桥**需要逐种类型 grep 确认产物位置
- 提示词版本栈数据存在 `workspace.items[].prompt_versions[]` 字段——Phase 3C 标签库可能复用相同字段位置

---

## Phase X – 主干竖切（TEXT / IMAGE / VIDEO / AUDIO）

**完成日期**：2026-05 上旬
**模型 / 工具**：Opus 4.7
**分支**：feat/phasex-*

### 关键交付
- 起源：2C.2 浏览器验收时发现"demo 结果页能开，但真实分析根本没通"
- X.1 状态桥：item ↔ task 状态联动
- X.3 工作空间详情页接入任务 SSE 进度
- X.4 image pipeline handler 全链路
- X.5 video download→analyze 任务链 + 产物回写
- X.7 video_result 把 analyze json_outputs 转成 frames
- X.A AUDIO 管线全链路

### 留给后续的影响
- 工作空间 item 的状态机已稳定（pending → running → done / failed），Phase 3B 检索时应只索引 `status: done` 的 item
- 主 worktree 启动服务的"路径漂移"问题：之前后端在某个 worktree 下被启动时，`backend_tasks.json` 写到了那个 worktree 的 `.local/`——**永远从 `/Users/conan/Desktop/nibi` 主目录起服务**

---

## Phase 1 – MVP 主干（1A → 1J）

**完成日期**：2026-04 至 2026-05 上旬
**模型 / 工具**：组合（Opus / Sonnet / 小米 / Haiku 分档使用）
**Tag**：未打（用户决定 tag = 开源时刻，延后到所有功能差不多时统一打）

### 关键交付
- 1A 任务列表 API 补字段
- 1B 任务列表前端
- 1C 设置 → 模型管理（providers / models 双层）
- 1D 任务详情骨架 + 输入层（含本地文件上传）
- 1E 前置配置面板
- 1F Pipeline + SSE 进度条
- 1G 视频结果页 + 三轨时间轴（5h，最复杂阶段之一）
- 1H 图片结果页
- 1I 工作包 zip 导出
- 1J 老代码清理 + Phase 1 收口

### 留给后续的影响
- 三轨时间轴（TripleTrack）的关键帧渲染依赖 `/static` 静态文件挂载，路径来自 `_materialize` 的 `keyframe image_path`
- 工作空间 export zip 支持 4 种类型（video/image/audio/text），新增类型时需扩展 export 逻辑

---

## Phase 0 – 设计令牌 + AppShell

**完成日期**：2026-03
**模型 / 工具**：小米 2.5 Pro / Sonnet

### 关键交付
- VidMirror 设计令牌翻译成 Tailwind 4 + CSS 变量
- 全局 AppShell（侧栏 + topbar）
- 暗色模式 token 准备（但未全量调通，Phase 3E 收尾）

### 留给后续的影响
- 侧栏导航项数组在 `frontend/src/layouts/AppShell.tsx` `NAV_ITEMS`——新增页面需要在此加项
- 设计令牌的真相源仍是 `vidmirror-handoff/project/styles.css`，改色或字体应回去比对

---

## Phase N1 – 任务系统差异（trashed/analyzed/上层 project_id）

**完成日期**：2026-05-19
**模型 / 工具**：Opus 4.7
**分支**：`feat/phase-n1-task-system`（worktree `/Users/conan/Desktop/nibi-n1`）
**Commits**：6436504 / ebf9a48 / 5ff638c / a294448 / 89a5795 / ff77385 / c078617

### 影响范围
- 后端：`backend/app/models/workspace.py`、`backend/app/routes/workspaces.py`、`backend/app/services/workspace_store.py`
- 前端：`frontend/src/types/workspace.ts`、`frontend/src/services/workspaces.ts`、`frontend/src/router.tsx`、`frontend/src/layouts/SettingsShell.tsx`、新增 `frontend/src/pages/SettingPage/TrashPage.tsx`、删除 `components/ProjectSwitcher.tsx` 与 `store/projectStore.ts`
- 测试：新增 `tests/backend/test_workspaces_trash.py`（4 用例），修复 `test_workspace_knowledge.py` / `test_workspaces_api.py`

### 关键改动
- **WorkspaceStatus**：`COMPLETED("completed")` 重命名为 `ANALYZED("analyzed")`，`from_dict` 兼容老 `"completed"` 数据
- **新增 trashed: bool 字段**：独立标志位，恢复时不动 status，原状态天然保留
- **软删除路由**：DELETE 改为 `trashed=True`；新增 `POST /workspaces/{id}/restore`、`DELETE /workspaces/{id}/permanent`、`DELETE /workspaces/trash`
- **列表过滤**：`GET /workspaces` 新增 `trashed_only` / `include_trashed` query 参数，默认排除 trashed
- **删 WorkspaceRecord.project_id 字段**（仅上层）：前端 ProjectSwitcher 一并删除（孤儿组件，无引用点）
- **保留 TaskRecord.project_id 与磁盘布局**：拆为独立 N1b phase（详见下面"为什么这么做"）
- **前端垃圾桶页**：`/settings/trash` 路由，列表 + 恢复 + 彻底删除 + 清空，window.confirm 二次确认

### 为什么这么做
- **trashed 用独立字段而非 status 枚举**：spec §1.4 要求"恢复到原状态"。如果用 status="trashed" 覆盖原 status，恢复时需要额外的 `status_before_trash` 字段；用独立 bool 更干净。
- **拆出 N1b（磁盘布局）**：开工后才发现 `shared/config.py::get_project_videos_dir(project_id)` 等 ~15 处把 project_id 当磁盘目录键，pipeline_tasks.py 全分支都用。彻底重构需 6-10h + 老数据搬家，远超 N1 4-6h 估时。用户决议"只拆能看到的那一层"——前端项目下拉框删除、上层字段删除；磁盘 `data/projects/<id>/...` 保留待 N1b。
- **DELETE /trash 路由先于 /{workspace_id}**：FastAPI 路径按声明顺序匹配，否则 `trash` 会被当成 workspace_id 吞掉。

### 留给后续的影响
- 数据兼容：老 workspace JSON 里 `project_id` 字段被 `from_dict` 静默忽略；老 `status="completed"` 自动升级为 `"analyzed"`
- 创建 workspace 后调 pipeline 任务，磁盘文件统一进 `data/projects/default_project/`——N1b 时再迁
- 设置页「垃圾桶」入口当前用字面量 `"垃圾桶"`，N3 设置页重组时补 `layout.menu.trash` i18n key
- N1b 待启动：磁盘布局 → `data/workspaces/<workspace_id>/<item_id>/`，附老数据搬家脚本
