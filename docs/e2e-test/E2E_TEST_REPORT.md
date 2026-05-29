# 音视频全链路 E2E 测试报告

## 测试环境

- **日期**：2026-05-29
- **执行模型**：mimo v2.5pro
- **验证模型**：mimo v2.5（待执行）
- **测试视频**：`https://www.bilibili.com/video/BV1u44y1L7Vj`（31 秒 B 站视频 "21年省体的夜"）
- **后端端口**：8000
- **前端端口**：5177
- **CORS 配置**：VITE_PORT=5177（测试前修复）

## 测试结果总览

| 链路 | 状态 | 问题数 | 耗时 |
|------|------|--------|------|
| 视频（只看画面） | ✅ 完成 | 2（P1×1 + P2×1 + P3×3 涉及） | ~12 分钟 |
| 音频 | ✅ 完成 | 1（P1×1） | ~3 分钟 |
| 音视频联合 | ✅ 完成 | 0 | ~3 分钟 |

**分级口径（2026-05-29 用户确认）**：P1 = 数据串扰（共 2 个，问题 1 + 问题 7）；P2 = 1 个（问题 3）；P3 = 4 个（问题 2/4/5/6）。问题 2「播放器 00:00」从 P1 降级为 P3，原因见下方根因分析。

---

## 🔬 P1 数据串扰根因分析（2026-05-29 Opus 4.7 用 codegraph 定位）

**根因 100% 锁定**：两个 P1 串扰**不是任务间数据污染**，而是后端 endpoint 的 demo fixture **兜底逻辑过于宽松**。所谓"大疆 Pocket 4 / 6:42 / 影视飓风"完全等于 `backend/app/services/{video,audio}_result_demo.py` 的固定字符串（也是 `docs/design/components/results.jsx` 的设计稿 mock 数据）。

### P1-问题1（视频 SRT 串扰）

- 后端 `/subtitles` 端口在 transcript 为空时**自己又走了一遍 demo fixture 兜底**
- visual_only 路径下，`_video_result_has_real_data`（`workspaces.py:1517`）对 visual_only **只看 frames**（line 1538）→ frames 非空就判 has_real=True → video_result 返回 `transcript: []` 给前端
- 用户在前端点 SRT 导出 → 调 `/subtitles` 端口 → 那个端口拿不到 transcript → 走自己的 demo 兜底 → 返回 demo SRT 字符串

### P1-问题7（音频结果页 DEMO）

- `get_audio_result`（`workspaces.py:2061`）判断真数据用：`has_real = isinstance(results, dict) and results.get("transcript")`
- whisper / faster-whisper 新格式把转写写到 `results.transcript_segments`，**没写 `results.transcript`**（看 `AudioResult` interface 这两个字段都存在）
- `has_real = False` → fall through 到 `build_demo_audio_result` → 返回「大疆 Pocket 4」demo 字符串

### P3-问题2（视频播放器 00:00）从 P1 降级原因

- visual_only 路径**设计上不下载/不分析音频流、不跑 probe duration**，所以 `duration_sec=0`、播放器源 URL 缺失是符合用户意图的副作用
- 真正缺的是 **UI 应该在 visual_only 模式下隐藏播放器或显示"仅画面分析模式"**
- 不属于"核心功能不可用"，归类 P3 体验优化

### 修复优先级

| 优先级 | 修复点 | 文件 | 工时 |
|---|---|---|---|
| 🔴 P1 必修 | `/subtitles` 端口删 demo 兜底，无 transcript 直接 404 / 空文件 | `backend/app/routes/workspaces.py`（找 subtitles 路由） | 1-2h |
| 🔴 P1 必修 | `get_audio_result` 的 `has_real` 判断认 `transcript_segments` | `backend/app/routes/workspaces.py:2061` | 0.5h |
| 🟡 P1 加固 | 前端 visual_only 模式下禁用 SRT 导出按钮 | `frontend/src/pages/result/VideoResultPage.tsx` | 0.5h |
| 🟢 P3 优化 | visual_only 路径下 UI 隐藏播放器 + 文案"仅画面模式" | 同上 | 0.5h |

**预防性建议**：考虑彻底移除 `_demo_fixture` 兜底（或加全局开关 `ENABLE_DEMO_FIXTURE=false`），改为返回空 result + 前端显示"任务未完成或无数据"。开源准备前 [D] 阶段必做。

---

## 详细问题列表

### P0（阻断）

无

### P1（重要）

#### 问题 1：SRT 字幕内容与视频不匹配（数据串扰）

- **截图**：`screenshots/1.12-srt-exported.png` + `subtitles.srt`
- **节点**：VideoResultPage → 字幕导出 → .srt
- **描述**：导出的 SRT 字幕内容为"大家好，今天我们来看大疆 Pocket 4"，时长 3 分钟+，与测试视频"21年省体的夜"（31 秒）完全不匹配
- **预期**：字幕内容应来自当前视频的 ASR 转写
- **实际**：字幕数据疑似来自之前的分析任务（BV1W6Gb6QEu8 "Claude Code Skills"）
- **严重程度**：P1 — 数据串扰导致用户获取错误结果
- **备注**：音视频联合链路的 SRT 导出内容正确，无此问题

#### 问题 7：音频结果页显示 DEMO 数据（数据串扰）

- **截图**：`screenshots/2.7-audio-detail.png`
- **节点**：AudioResultPage → transcript tab
- **描述**：音频结果页显示的内容为"大疆 Pocket 4"（6 分 42 秒），与测试视频"21年省体的夜"（31 秒）完全不匹配
- **预期**：音频转录内容应来自当前视频的 ASR 转写
- **实际**：音频结果页疑似加载了 DEMO 数据或之前的分析任务结果
- **严重程度**：P1 — 数据串扰导致用户获取错误结果

### P2（一般）

#### 问题 3：ResultsOverview React key 警告

- **截图**：`screenshots/1.8-results-overview.png`
- **节点**：ResultsOverview 组件
- **描述**：控制台报错 "Each child in a list should have a unique 'key' prop"
- **预期**：无 React 警告
- **实际**：ResultsOverview 渲染列表时缺少唯一 key
- **严重程度**：P2 — 不影响功能但影响代码质量

### P3（建议）

#### 问题 2：视频播放器时长显示 00:00（visual_only 模式预期行为，但 UI 应改进）

- **截图**：`screenshots/1.9-video-detail.png`
- **节点**：VideoResultPage → 视频播放器
- **描述**：visual_only 模式下视频播放器显示 "00:00 / 00:00"
- **根因**（2026-05-29 Opus 4.7 定位）：visual_only 路径不下载音频流、不跑 probe，duration_sec=0 是设计副作用
- **修复建议**：UI 在 visual_only 模式下隐藏播放器，改显"仅画面分析模式"提示
- **严重程度**：P3 — 体验优化（已从 P1 降级）
- **备注**：音视频联合链路播放器正常显示 00:31

#### 问题 4：Composer URL 输入需要 React 原生事件

- **截图**：`screenshots/1.1-url-entered.png`
- **节点**：Composer → URL 输入框
- **描述**：通过 `evaluate` 设置 input.value + dispatchEvent 无法触发 React controlled input 的 onChange，需要使用 nativeInputValueSetter 才能正确触发状态更新
- **预期**：标准 DOM 事件应能触发 React 状态更新
- **实际**：需要 React 内部 setter hack
- **严重程度**：P3 — 影响自动化测试便利性，不影响用户手动操作

#### 问题 5：VLM 分析进度更新缓慢

- **截图**：`screenshots/1.6-processing-vlm-21pct.png`
- **节点**：ProcessingPage → FRAMES 阶段
- **描述**：VLM 视觉分析阶段进度从 10% 到 100% 耗时约 10 分钟（31 秒视频），进度更新间隔较长
- **预期**：短视频分析应在 2-3 分钟内完成
- **实际**：逐帧调用 VLM 模型导致耗时较长
- **严重程度**：P3 — 性能优化建议

#### 问题 6：B 站 yt-dlp 下载 412 错误后重试成功

- **截图**：`screenshots/1.5-processing-download-error.png`
- **节点**：ProcessingPage → DOWNLOAD 阶段
- **描述**：yt-dlp 首次下载 B 站视频遇到 HTTP 412 错误（反爬），但自动重试后成功
- **预期**：下载一次成功
- **实际**：需要多次重试不同策略才成功
- **严重程度**：P3 — 功能正常但用户体验可优化

## 各链路测试详情

### 链路 1：视频（只看画面）

**状态**：✅ 完成

| 步骤 | 页面 | 结果 | 备注 |
|------|------|------|------|
| 1.1 | Composer | ✅ | URL 输入、平台嗅探（Bilibili 标签）正常 |
| 1.2 | AddMaterialModal | ✅ | 类型选择、Feature 列表、模型下拉正常 |
| 1.3 | ProcessingPage | ✅ | StepProgress 7 步、LIVE 标识、进度百分比正常 |
| 1.4 | ResultsOverview | ✅ | 总览页加载，但有 React key 警告 |
| 1.5 | VideoResultPage | ⚠️ | 播放器显示 00:00/00:00（P1） |
| 1.6 | VideoResultPage 字幕 | ❌ | SRT 内容与视频不匹配（P1 数据串扰） |

### 链路 2：音频（只听音频）

**状态**：✅ 完成

| 步骤 | 页面 | 结果 | 备注 |
|------|------|------|------|
| 2.1 | Composer | ✅ | URL 输入正常 |
| 2.2 | AddMaterialModal | ✅ | 选择"只听音频"、Feature 列表正常 |
| 2.3 | MusicModeConfirmModal | ✅ | VAD 检测到人声，弹窗正常显示并自动跳过 |
| 2.4 | ProcessingPage | ✅ | FETCH → VAD → TRANSCRIBE 状态流转正常 |
| 2.5 | ResultsOverview | ✅ | 音频总览页加载 |
| 2.6 | AudioResultPage | ⚠️ | 转录内容显示 DEMO 数据（P1 数据串扰） |

**发现**：MusicModeConfirmModal 弹窗功能正常，VAD 检测到人声后自动跳过音乐模式确认。

### 链路 3：音视频联合（av_combined）

**状态**：✅ 完成

| 步骤 | 页面 | 结果 | 备注 |
|------|------|------|------|
| 3.1 | AddMaterialModal | ✅ | 选择"音视频综合"、Provider 选择 SiliconFlow 正常 |
| 3.2 | ProcessingPage | ✅ | 7 步全部完成（download → probe → asr → frames → vlm → sum → store） |
| 3.3 | ResultsOverview | ✅ | 内容摘要准确匹配视频 |
| 3.4 | AVSynthesisResultPage | ✅ | 综合笔记、时间轴、转录预览均正确 |
| 3.5 | VideoResultPage | ✅ | 播放器显示正确时长 00:31 |
| 3.6 | 字幕导出 | ✅ | SRT 内容正确，无数据串扰 |

**关键发现**：
- 音视频联合链路的数据完整性最佳，无串扰问题
- 播放器时长显示正确（00:31），与视频链路的 00:00 形成对比
- ASR 转写准确（4 段/51 字符），内容为歌曲歌词
- VLM 视觉分析准确描述了视频场景（摩托车、宠物、夜景）
- 综合笔记质量高，结合了音频和视频分析结果

## 对比分析

| 功能 | 视频链路 | 音频链路 | 音视频联合 |
|------|----------|----------|------------|
| 数据正确性 | ❌ 串扰 | ❌ 串扰 | ✅ 正确 |
| 播放器时长 | ❌ 00:00 | N/A | ✅ 00:31 |
| SRT 导出 | ❌ 内容错误 | N/A | ✅ 内容正确 |
| 内容标签 | ✅ 正确 | N/A | ✅ 正确 |
| 进度显示 | ✅ 正常 | ✅ 正常 | ✅ 正常 |

**结论**：音视频联合链路是三条链路中数据完整性最好的，建议优先使用。视频链路和音频链路存在数据串扰问题，需要排查数据源选择逻辑。

## 已截图索引

| 截图文件 | 节点 | 说明 |
|----------|------|------|
| `1.1-homepage.png` | 首页 | Composer + Preflight 配置面板 |
| `1.1-url-entered.png` | 首页 | URL 输入后，"添加素材"按钮启用 |
| `1.1-url-sniffed.png` | 首页 | URL 嗅探完成 |
| `1.2-add-material-modal.png` | AddMaterialModal | 弹窗初始状态 |
| `1.2-visual-only-selected.png` | AddMaterialModal | 选择"只看画面"后 |
| `1.4-processing-initial.png` | ProcessingPage | 任务初始状态 |
| `1.5-processing-download-error.png` | ProcessingPage | 下载 412 错误 |
| `1.6-processing-progress.png` | ProcessingPage | 截帧中 10% |
| `1.6-processing-vlm-21pct.png` | ProcessingPage | VLM 分析 21% |
| `1.7-processing-complete.png` | ProcessingPage | 任务完成 100% |
| `1.8-results-overview.png` | ResultsOverview | 结果总览页 |
| `1.9-video-detail.png` | VideoResultPage | 视频详情页 |
| `1.10-summary-tab.png` | VideoResultPage | 总结 tab（空） |
| `1.11-subtitle-panel.png` | VideoResultPage | 字幕导出下拉 |
| `1.12-srt-exported.png` | VideoResultPage | SRT 导出后（内容错误） |
| `2.4-music-mode-confirm.png` | MusicModeConfirmModal | 音乐模式确认弹窗 |
| `2.5-audio-complete.png` | ProcessingPage | 音频任务完成 |
| `2.6-audio-overview.png` | ResultsOverview | 音频结果总览 |
| `2.7-audio-detail.png` | AudioResultPage | 音频详情页（DEMO 数据） |
| `3.1-av-modal-config.png` | AddMaterialModal | 音视频综合配置 |
| `3.2-processing-initial.png` | ProcessingPage | AV 任务初始状态 |
| `3.3-processing-analyze-complete.png` | ProcessingPage | AV 分析完成 |
| `3.4-av-overview.png` | ResultsOverview | AV 结果总览 |
| `3.5-processing-complete.png` | ProcessingPage | AV 任务全部完成 |
| `3.6-av-overview.png` | ResultsOverview | AV 综合笔记 |
| `3.7-av-overview-bottom.png` | ResultsOverview | AV 总览页底部 |
| `3.8-av-video-detail.png` | VideoResultPage | AV 视频详情页 |
| `3.9-av-subtitle-dropdown.png` | VideoResultPage | AV 字幕导出下拉 |
| `3.10-av-srt-correct.png` | VideoResultPage | AV SRT 导出（内容正确） |

## 待测试项

- [ ] 各结果页的复制/收藏功能
- [ ] 快捷键测试（Space/方向键/C/F/1-2-3）
- [ ] 导出工作包功能
- [ ] LLM 对话功能
- [ ] 分镜脚本生成功能

## 截图目录

所有截图保存在：`/Users/conan/Desktop/nibi/docs/e2e-test/screenshots/`
