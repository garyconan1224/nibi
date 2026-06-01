---
phase: 真实跑测 · 多角度端到端验证（R24 并发 + F2 模块4-7 结果页 + F1 路径1/字幕清洗）
status: ready
owner: opus（规划+对账）/ xiaomi-mimo-2.5pro（执行）
parent: |
  合并三件都需「跑真实任务」的验证，一次 QA 会话搞定，省重复真实跑：
  - R24 VLM 多帧并发（commit 227cc7c）：真实 SiliconFlow API 下的提速 + 取消生效
  - F2 第三轮 E2E：docs/e2e-test/BUGS.md 末尾结论——无已完成 item，模块 4-7 结果页从没测过
  - F1 路径1 字幕直接总结 + 字幕清洗（F1.6）：真实产出确认
cost_warning: 真实 VLM/ASR 调用按量计费 + 耗时。每类用短/小素材；视频用约 10-20 帧的短视频，禁止跑满 106 帧。无真实 SiliconFlow key 就停下问用户。
note: |
  2026-06-01 对账事实（已读码/已测确认）：
  - F1 路径1（_run_subtitle_summary）+ 字幕清洗（pipeline_tasks.py:642 F1.6）已实现；路径3（Gemini）骨架就绪
    但卡装 google-genai + 配 GEMINI_API_KEY（§4 红线），用户决定暂跳过，本任务不测路径3。
  - F2 八模块 Preflight 全过、Bug#1/#2 已由 0269913 处理（前端空态+路由）；真正缺口=没有已完成 item。
  - R24 代码层已验证：72 pytest 全绿 + sleep 基准（并发 3→2.8× / 6→5.5× / 8→7.3×）。本任务在真实 API 下端到端确认。
---

## 0. 对账结论（mimo 必读 · 别再猜）

**已在代码层验证、本任务只需真实 API 复核**：
- R24 并发：`shared/video_analyzer.py:process_video` 用 `ThreadPoolExecutor(max_workers=worker_count)`，并发数 = 性能档位 `vlm_concurrency`（low=3/medium=6/high=8，`shared/settings_store.py`），取消已下沉 worker（227cc7c）。
- F1 路径1：`pipeline_tasks.py:571 _run_subtitle_summary`（summary_path=subtitle）；字幕清洗：`pipeline_tasks.py:642`（F1.6，日志打 `🧹 字幕清洗完成`）。

**只有跑真实完整任务才能验、本任务要确认的**：
1. **R24**：真实 VLM 下并发真的并行（多帧调用时间重叠）、切档位改并发数（低档慢/高档快）、取消即停（取消后「🎬 截帧进度」秒级停增）。
2. **F2 模块 4-7 结果页**：要有「已完成」item 才能渲染——音频结果页(4)/学习笔记(5)/文字(6)/图片(7) 真实数据下是否正常（非空态、非 demo）。
3. **F1**：路径1 字幕直接总结产出对、字幕清洗日志出现且字符数下降。
4. **回归**：Bug#1（学习笔记 `/ln`）/ Bug#2（旧 `…/items/…/result` 路由）不再白屏/404。

**性能档位接口**：`backend/app/routes/performance_tier.py`（设置页「性能档位」可切）。
**E2E 既有产物**：`docs/e2e-test/BUGS.md` + `E2E_TEST_REPORT.md`（前两轮，本轮接第三轮）。

## 1. mimo 启动提示词（直接复制）

```
真实跑测·多角度验证：在真实 SiliconFlow API 下，跑几条真实任务，一次性验证 R24 并发提速 + F2 模块4-7结果页 + F1 路径1/字幕清洗。
背景必读: docs/plans/realrun-verify-mimo-prompt.md §0
⚠️成本: 真实 VLM/ASR 调用花钱+耗时。每类用短/小素材，视频约10-20帧，禁跑满106帧。先确认 .env/settings 有真实 SiliconFlow key，没有就停下问用户。路径3(Gemini)未解阻，本轮不测。

【任务0: 起服务 + key + 对账】
  ./dev.sh                      # 起前后端
  确认后端健康、前端可开、SiliconFlow key 真实可用。
  rg -n "vlm_concurrency|worker_count|_run_subtitle_summary|字幕清洗" shared/video_analyzer.py shared/settings_store.py backend/app/services/pipeline_tasks.py  # 核对改动/路径在位

【任务1（主·视频）: R24 并发 + 视频/学习笔记结果页】
  - 准备一条短视频(本地或短URL，截帧约10-20帧)。
  - 性能档=低(并发3)跑视频复合笔记(含analyze截帧)，记 wall time + 看日志VLM帧调用是否时间重叠(并发证据)。
  - 清产物，性能档=高(并发8)同视频重跑，记 wall time → 应明显更快。
  - 再起一次，跑到一半点「取消」→ 确认「🎬截帧进度 X/Y」几秒内停增、任务转已取消(R24红线)。
  - 任务完成后：开视频结果页(分镜/帧/提示词) + 学习笔记页(模块5)，确认真实数据正常渲染(非空态)。

【任务2（音频）: 模块4结果页 + 字幕清洗】
  - 跑一条短音频任务(转录/说话人/可选音乐分析)。
  - 完成后开音频结果页(模块4)：转录文本/说话人/总结是否正常。
  - 看日志是否出现「🧹 字幕清洗完成 | raw→clean 字符」(F1.6)。

【任务3（字幕路径）: F1 路径1】
  - 跑一条 summary_path=subtitle 的视频任务(路径1 字幕直接总结)。
  - 确认产出的是「基于字幕的总结」、字幕清洗生效。

【任务4（文字+图片）: 模块6/7结果页】
  - 跑一条短文本任务 + 一张图片任务(便宜，无/少VLM)。
  - 完成后分别开文字结果页(模块6)/图片结果页(模块7)，确认真实数据正常。

【任务5: 回归 Bug#1/#2】
  - 学习笔记页: /ln 不再白屏/console 404(有数据则显示，无则友好空态)。
  - 访问旧 `…/workspaces/{ws}/items/{item}/result`: 正确重定向、不再404。

【记录+收尾】
  - 把各档耗时/并发证据/取消行为/各结果页是否OK/字幕清洗日志/回归结果，写进本文件 §2，或回报 opus/用户。
  - 纯验证: 不改业务代码。发现真实 bug → 记进 docs/e2e-test/BUGS.md 并另开修复任务，别在这里顺手改。
  - ./dev.sh stop; 清掉验证用临时 workspace，别留垃圾。

【红线】
  - 成本: 只用短/小素材、禁跑满106帧、没真实key就停下问。
  - 路径3(Gemini)未解阻，本轮不碰。
  - 纯验证不改码；发现 bug 记 BUGS.md + 另开任务。
  - 不留测试 workspace/产物垃圾；本任务无代码产物，结论写进本 md 才 docs commit。
```

## 2. 进度 / 结论记录（mimo 跑完填）

- [ ] 任务0 服务/key/改动在位
- [ ] 任务1 R24：低档 ____s / 高档 ____s（____帧）→ 提速 ____×；取消 ____s 内停增；视频结果页 ____ / 学习笔记页 ____
- [ ] 任务2 音频结果页(模块4) ____；字幕清洗日志 ____
- [ ] 任务3 路径1 字幕直接总结产出 ____
- [ ] 任务4 文字结果页(6) ____ / 图片结果页(7) ____
- [ ] 任务5 回归：学习笔记 /ln ____ / 旧 result 路由 ____
- [ ] 总结论：R24 并发提速 + F2 结果页 + F1 路径1/字幕，真实环境是否全部符合预期（是/否 + 备注 + 新 bug 列表）
