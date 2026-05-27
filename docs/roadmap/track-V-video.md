# Track V：视频（Video）

> 来源：原 `docs/ROADMAP.md` §4（拆分于 2026-05-26）。
> 流程图依据：`docs/flows/video.md`（源图：`视频.png`）——3 路径 + 字幕清洗 + 视频类型模板 + 输出格式选择

---

## V1 视频路径选择 UI + 路径 1/3 后端

**索引**：`docs/flows/video.md` + `system_design_v3_final.md` §视频 + 现有 `handle_analyze_task`
**模型**：UI ⭐ deepseek v4-pro；路径 1 Sonnet；路径 3 Opus
**分支**：`feat/ip9-flow-gaps`（UI 已合并入 main）
**子任务**：
- [x] V1.1 Preflight 加路径单选 + 视频类型模板 select（= F1.3）— `e618d1a`
- [x] V1.2 后端路径 1：字幕直接总结（= F1.4）— `f17c04a` `aac4578` `9e8667e` `92fbdb9` `bf995d7`
- [ ] V1.3 后端路径 3：Gemini 1.5 Pro 视频输入集成（= F1.5）

**关键决策（待用户拍板）**：
- 路径 3 模型：Gemini 1.5 Pro（用户已决） / GPT-4o / Qwen-VL 后续扩
- Gemini API key 来源：用户 .env / Provider 配置页
- 视频类型模板提示词放哪：硬编码？文件？数据库？

---

## V2 字幕清洗 + 输出格式选择

**索引**：`docs/flows/video.md` 中独立的"字幕清洗"节点 + "选择输出格式"节点
**模型**：Sonnet
**分支**：`feat/v2-subtitle-polish`
**子任务**：
- [x] V2.1 `shared/transcript_cleaner.py`（规则去填充词 + LLM 润色）（= F1.6）
- [x] V2.2 输出格式 UI（摘要 / 要点 / 金句 / 段落改写）单选
- [x] V2.3 输出格式 → 后端不同提示词模板

---

## V3 视频类型模板库

**索引**：`docs/flows/video.md`「教程/Vlog/访谈/影视点评/产品评测」分类
**模型**：Sonnet（写模板，需对内容理解）
**分支**：`feat/v3-video-templates`
**子任务**：
- [x] V3.1 后端模板库（6+ 类型）：每个类型 system prompt + 输出 schema（隐式完成，已在 pipeline_tasks.py:54）
- [x] V3.2 设置页 → 模板编辑（用户可自定义）
- [x] V3.3 默认模板由 LLM 检测内容自动选（`c040c70`）

---

## V4 视频结果页升级

**索引**：`docs/design/components/video_detail.jsx`（419 行）+ 现状 `VideoResultPage.tsx`
**模型**：Sonnet
**分支**：`feat/v4-video-detail`
**子任务**：
- V4.1 三轨时间轴交互升级（点击跳帧 / 拖拽 / 缩放）
- V4.2 帧画面 + 提示词 + 字幕三方联动
- V4.3 关键金句标注 / 收藏
