"""9 种内容总结模板。每个模板由 (system_prompt, user_prompt_template, output_format) 三部分组成。"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SummaryTemplate:
    id: str
    label: str
    desc: str
    use_case: str
    system_prompt: str
    user_prompt: str
    output_format: str


TEMPLATES: dict[str, SummaryTemplate] = {
    "concise": SummaryTemplate(
        id="concise",
        label="简洁摘要",
        desc="100-200 字一段",
        use_case="快速浏览",
        system_prompt="你是一个简洁的内容摘要专家。请用 100-200 字概括核心内容，突出最重要的信息。",
        user_prompt="请为以下转写文本生成简洁摘要：\n\n{transcript}",
        output_format="markdown",
    ),
    "detailed": SummaryTemplate(
        id="detailed",
        label="详细要点",
        desc="多级 bullet + 关键词",
        use_case="深度学习",
        system_prompt="你是一个专业的内容分析师。请提取多层级要点，用 bullet 列表呈现，并在末尾列出关键词。",
        user_prompt="请为以下转写文本生成详细的要点总结：\n\n{transcript}",
        output_format="markdown",
    ),
    "quotes": SummaryTemplate(
        id="quotes",
        label="金句提取",
        desc="5-10 条独立金句卡片",
        use_case="短视频/社媒",
        system_prompt="你是一个金句提炼专家。请从内容中提取 5-10 条最有价值的金句，每条独立成段，适合社交媒体分享。",
        user_prompt="请从以下转写文本中提取金句：\n\n{transcript}",
        output_format="markdown",
    ),
    "meeting": SummaryTemplate(
        id="meeting",
        label="会议纪要",
        desc="议题/决议/待办/参会人 4 段式",
        use_case="工作录音",
        system_prompt="你是一个专业的会议记录员。请按「议题」「决议」「待办事项」「参会人」四段式整理会议内容。",
        user_prompt="请为以下会议转写文本生成会议纪要：\n\n{transcript}",
        output_format="markdown",
    ),
    "xhs": SummaryTemplate(
        id="xhs",
        label="小红书风格",
        desc="标题党+emoji+分段+话题 tag",
        use_case="转笔记",
        system_prompt="你是一个小红书爆款文案专家。请用吸引眼球的标题、emoji 点缀、短段落分隔、话题标签的方式改写内容。",
        user_prompt="请将以下转写文本改写为小红书风格笔记：\n\n{transcript}",
        output_format="markdown",
    ),
    "longform": SummaryTemplate(
        id="longform",
        label="公众号长文",
        desc="引言/正文(H2分节)/结尾",
        use_case="内容创作",
        system_prompt="你是一个公众号内容创作者。请用「引言-正文-结尾」结构改写，正文用 H2 小标题分节，每节 200-300 字。",
        user_prompt="请将以下转写文本改写为公众号长文：\n\n{transcript}",
        output_format="markdown",
    ),
    "lecture": SummaryTemplate(
        id="lecture",
        label="教学笔记",
        desc="知识点/例子/重点/延伸阅读",
        use_case="课程录音",
        system_prompt="你是一个教学笔记整理专家。请按「核心知识点」「典型例子」「重点强调」「延伸阅读」四部分整理课程内容。",
        user_prompt="请为以下课程转写文本生成教学笔记：\n\n{transcript}",
        output_format="markdown",
    ),
    "interview": SummaryTemplate(
        id="interview",
        label="访谈整理",
        desc="Q&A 对话 + 嘉宾观点摘录",
        use_case="播客/采访",
        system_prompt="你是一个访谈整理专家。请提取 Q&A 对话结构，并在末尾整理嘉宾核心观点摘录。",
        user_prompt="请为以下访谈转写文本生成结构化整理：\n\n{transcript}",
        output_format="markdown",
    ),
    "shownotes": SummaryTemplate(
        id="shownotes",
        label="播客 shownotes",
        desc="时间戳章节 + 嘉宾介绍 + 推荐链接",
        use_case="自媒体",
        system_prompt="你是一个播客 shownotes 撰写专家。请生成时间戳章节索引、嘉宾简介、以及节目中提到的推荐资源链接。",
        user_prompt="请为以下播客转写文本生成 shownotes：\n\n{transcript}",
        output_format="markdown",
    ),
}


def get_template(template_id: str) -> SummaryTemplate:
    """获取指定 ID 的模板，未知 ID 回退到 concise。"""
    return TEMPLATES.get(template_id, TEMPLATES["concise"])


def list_template_ids() -> list[str]:
    """返回所有可用模板 ID。"""
    return list(TEMPLATES.keys())
