---
phase: R18
title: PreflightDrawer 细调抽屉 · 总结模板 9 种 + 字幕精修 + 截帧细调
status: ready
owner: deepseek v4-pro
estimated_hours: 5
depends_on:
  - R17（chip 重构必须先合）
related_spec:
  - docs/spec/03-preflight-config.md
  - docs/spec/04-pipeline-tasks.md
---

## 背景

R17 把添加素材弹窗的主 chip 砍到极简后，原来直接出现在 chip 上的能力（说话人音色 / 字幕导出 / 总结深度）都要降级到细调抽屉。同时本期落地用户提的几个增强：

1. 总结模板 9 种（替代现有「简洁 / 详细 / 带画面引用」3 档）
2. 字幕导出加「专有名词修正（LLM 注入）/ 时间轴开关」
3. 截帧细调挪进「画面分析」子项

后端这边主要是新加 prompt 模板文件 + 透传新参数。不改任何 pipeline 步骤结构。

## 修改清单

### 1. 后端：总结模板系统

#### 1a. 新建 `backend/app/services/summary_templates.py`

```python
"""9 种内容总结模板。每个模板由 (system_prompt, user_prompt_template, output_format) 三部分组成。"""

from dataclasses import dataclass

@dataclass
class SummaryTemplate:
    id: str
    label: str            # 中文标签
    desc: str             # tooltip 描述（前端用）
    use_case: str         # 使用场景一句话
    system_prompt: str
    user_prompt: str      # 含 {transcript} {background} 占位符
    output_format: str    # markdown / json / bullet

TEMPLATES: dict[str, SummaryTemplate] = {
    "concise":  SummaryTemplate("concise",  "简洁摘要", "100-200 字一段", "快速浏览", ...),
    "detailed": SummaryTemplate("detailed", "详细要点", "多级 bullet + 关键词", "深度学习", ...),
    "quotes":   SummaryTemplate("quotes",   "金句提取", "5-10 条独立金句卡片", "短视频/社媒", ...),
    "meeting":  SummaryTemplate("meeting",  "会议纪要", "议题/决议/待办/参会人 4 段式", "工作录音", ...),
    "xhs":      SummaryTemplate("xhs",      "小红书风格", "标题党+emoji+分段+话题 tag", "转笔记", ...),
    "longform": SummaryTemplate("longform", "公众号长文", "引言/正文(H2分节)/结尾", "内容创作", ...),
    "lecture":  SummaryTemplate("lecture",  "教学笔记", "知识点/例子/重点/延伸阅读", "课程录音", ...),
    "interview":SummaryTemplate("interview","访谈整理", "Q&A 对话 + 嘉宾观点摘录", "播客/采访", ...),
    "shownotes":SummaryTemplate("shownotes","播客 shownotes", "时间戳章节 + 嘉宾介绍 + 推荐链接", "自媒体", ...),
}
```

> 每个模板的 prompt 全文 DS 写一遍。可以参考开源项目 wdkns 的对应模板（[bilibili-render-pdf](https://github.com/...) 有 lecture / interview 范式），但**重写不抄**。
> `output_format` 字段供 R19 综合笔记拼装时区分（markdown 模板可直接拼，json 模板要先解析）。

#### 1b. 在 `pipeline_tasks.py` summary 步骤里读模板

现有约 [pipeline_tasks.py:725](backend/app/services/pipeline_tasks.py:725) `run_summary` 函数：把硬编码的 prompt 替换成读 `payload.get("summary_template")` 对应的 `TEMPLATES[id]`。默认值 `concise` 兼容老调用。

不识别的 template id → 回退到 `concise` + 日志 warn。

### 2. 后端：字幕专有名词修正

#### 2a. `pipeline_tasks.py` srt_export 步骤加 LLM 后处理

约 [pipeline_tasks.py:758](backend/app/services/pipeline_tasks.py:758) `srt_export` 分支内：

```python
proper_nouns = payload.get("proper_nouns", "").strip()
if proper_nouns and api_key:
    # 把转写后的 segments 整体喂给 LLM 做术语修正
    corrected = await llm_call(
        system="你是字幕校对员。下面是用户提供的专有名词清单（可能含人名/术语/品牌），"
               "请在转写文本中找出读音相近但拼写错误的位置，替换为清单里的正确写法。"
               "只改专有名词，不改其他文字。输出 JSON：[{idx, original, corrected}]。",
        user=f"专有名词清单：{proper_nouns}\n\n转写片段：{json.dumps(segments)}",
    )
    apply_corrections(segments, corrected)
```

> 注意：批量调一次 LLM，不要 per-segment 调（成本爆炸）。
> 字幕段总字数 > 10000 时分块（每块 8000 字），合并修正结果。

#### 2b. srt_export 加 `include_timestamps` 开关

```python
include_ts = payload.get("include_timestamps", True)
if include_ts:
    write_srt(segments, out_path.with_suffix(".srt"))   # 标准 srt
else:
    write_plain_text(segments, out_path.with_suffix(".txt"))  # 纯文本，无时间戳
```

### 3. 前端：PreflightDrawer 子项重构

文件：`frontend/src/pages/WorkbenchPage/preflightTasks.ts` + `PreflightDrawer.tsx`

#### 3a. 「人声转写+总结」任务的细调子项（preflightTasks.ts buildInitialTasks）

```ts
transcribe_summary: {
  on: true,
  children: [
    { id: 'speaker_diarize',   label: '区分说话人音色', type: 'switch', default: false,
      hint: '声纹聚类 → 给每个 segment 加 [说话人 A/B] 标签' },
    { id: 'subtitle_export',   label: '导出字幕文件',   type: 'switch', default: false },
    { id: 'include_timestamps', label: '含时间轴',     type: 'switch', default: true,
      whenParent: 'subtitle_export', whenValue: true,
      hint: '勾上导出 .srt（可二压视频）；不勾导出 .txt 纯文本' },
    { id: 'proper_nouns',      label: '专有名词修正', type: 'textarea', default: '',
      placeholder: '人名 / 术语 / 品牌（逗号或换行分隔）',
      hint: '在转写完成后调用 LLM 找读音相近但拼错的词，替换为清单中正确写法' },
    { id: 'summary_template',  label: '总结模板',     type: 'radio',
      options: [
        { value: 'concise',   label: '简洁摘要',      tooltip: '100-200 字一段，适合快速浏览' },
        { value: 'detailed',  label: '详细要点',      tooltip: '多级 bullet + 关键词，适合深度学习' },
        { value: 'quotes',    label: '金句提取',      tooltip: '5-10 条独立金句卡片，适合短视频/社媒' },
        { value: 'meeting',   label: '会议纪要',      tooltip: '议题/决议/待办/参会人 4 段式' },
        { value: 'xhs',       label: '小红书风格',    tooltip: '标题党+emoji+分段+话题 tag' },
        { value: 'longform',  label: '公众号长文',    tooltip: '引言/正文(H2分节)/结尾' },
        { value: 'lecture',   label: '教学笔记',      tooltip: '知识点/例子/重点/延伸阅读' },
        { value: 'interview', label: '访谈整理',      tooltip: 'Q&A 对话 + 嘉宾观点摘录' },
        { value: 'shownotes', label: '播客 shownotes',tooltip: '时间戳章节 + 嘉宾介绍 + 推荐链接' },
      ],
      default: 'concise' },
  ],
}
```

> Radio 子项加 `tooltip` 字段，前端渲染时 hover label 显示提示。9 个选项垂直列 + 折叠（默认折叠，显示当前选中项）。

#### 3b. 「画面分析」任务的细调子项

把现有 [preflightTasks.ts:58~62](frontend/src/pages/WorkbenchPage/preflightTasks.ts:58) 的截帧细调挪进 `visual_analysis` 任务下：

```ts
visual_analysis: {
  on: true,
  children: [
    { id: 'frame_mode',    label: '截帧模式', type: 'radio',
      options: ['按秒截帧', 'AI 镜头分析'], default: 'AI 镜头分析' },
    { id: 'sec_per_frame', label: '按秒间隔', type: 'number', default: 2, unit: '秒/帧',
      whenParent: 'frame_mode', whenValue: '按秒截帧' },
    { id: 'max_frames',    label: '最大帧数', type: 'number', default: 120, unit: '帧',
      whenParent: 'frame_mode', whenValue: '按秒截帧' },
    { id: 'shot_frames',   label: '镜头取帧', type: 'radio',
      options: ['2 帧 · 首+尾', '3 帧 · 首+中+尾'], default: '3 帧 · 首+中+尾',
      whenParent: 'frame_mode', whenValue: 'AI 镜头分析' },
    { id: 'vlm_output',    label: 'VLM 输出格式', type: 'radio',
      options: ['场景描述', 'MidJourney 提示词', 'StableDiffusion 提示词', 'JSON 结构化'],
      default: '场景描述' },
  ],
}
```

#### 3c. PreflightDrawer.tsx 渲染新子项类型

新增 type 处理：
- `textarea`: `<textarea>` 多行输入
- radio 的 options 支持 `string | {value, label, tooltip}` 两种格式（向后兼容）
- `placeholder` 字段支持

### 4. 测试

#### 4a. 前端：`preflightTasks.test.ts` 新增 3 case
- 总结模板默认 concise
- 字幕导出关时 include_timestamps / proper_nouns 不渲染
- 截帧模式切到「AI 镜头分析」时 shot_frames 出现 / sec_per_frame 隐藏

#### 4b. 后端：`tests/services/test_summary_templates.py` 新增 3 case
- 9 个模板 id 都能加载
- 未知 id 回退 concise
- proper_nouns 非空 + 有 api_key → 调用 llm 修正（mock）

### 5. 不要改

- 主 chip 结构（R17 已定）
- pipeline 步骤顺序
- av_combined 流程（R19 做）

## 验收标准

1. PreflightDrawer 展开「人声转写+总结」能看到 5 个子项（音色 / 字幕开关 / 含时间轴 / 专有名词 / 总结模板）
2. 总结模板 9 个选项可见、hover 显示 tooltip
3. 字幕开关关闭时下方 3 项（含时间轴 / 专有名词输入 / 文件名）隐藏
4. 截帧模式切换 `按秒截帧 ↔ AI 镜头分析` 子项联动隐藏正确
5. 后端模板系统：跑 `pytest tests/services/test_summary_templates.py` 全绿
6. 选 lecture 模板 + 跑端到端音频转写任务，输出能看到「知识点 / 例子」结构
7. 填入「李白, 道德经」专有名词 + 转写一段含「礼拜，道得经」的音频，输出应已修正
8. `npm run test` 全绿；`npm run build` 无 TS 错
9. `pytest backend/tests` 全绿

## 完工后

- ① `docs/EXECUTION_PLAN.md` R18 打勾
- ② 本文件 frontmatter 改 done + 填 commits / completed_date / actual_hours
- ③ `docs/COMPLETED_WORK.md` 追加
- ④ commit message：`feat(R18): preflight drawer with 9 summary templates + subtitle refine + frame mode`
