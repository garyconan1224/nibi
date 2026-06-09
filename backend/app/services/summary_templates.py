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
    "oral": SummaryTemplate(
        id="oral",
        label="口播稿",
        desc="可直接念的口语化文案",
        use_case="短视频/直播",
        system_prompt="你是一个口播脚本撰写专家。请将内容改写成可直接朗读的口播文案，要求口语化、有节奏感、段落短小，适合对着镜头念。",
        user_prompt="请将以下转写文本改写为口播稿：\n\n{transcript}",
        output_format="markdown",
    ),
    "steps": SummaryTemplate(
        id="steps",
        label="步骤教程",
        desc="有序步骤清单，可照着做",
        use_case="操作类内容",
        system_prompt="你是一个教程撰写专家。请将操作类内容拆解为清晰的有序步骤清单，每步用「步骤 1/2/3…」开头，附简要说明和注意事项。",
        user_prompt="请为以下转写文本生成步骤教程：\n\n{transcript}",
        output_format="markdown",
    ),
    "outline": SummaryTemplate(
        id="outline",
        label="大纲",
        desc="多级层次提纲，一眼看结构",
        use_case="知识梳理",
        system_prompt="你是一个内容结构化专家。请将内容整理为多级大纲（用 Markdown 缩进列表），一级为主题，二/三级为子话题和要点，便于快速浏览整体结构。",
        user_prompt="请为以下转写文本生成大纲：\n\n{transcript}",
        output_format="markdown",
    ),
    "qa": SummaryTemplate(
        id="qa",
        label="问答卡(Anki)",
        desc="Q/A 卡片，便于记忆复习",
        use_case="学习复习",
        system_prompt="你是一个学习卡片制作专家。请从内容中提取核心知识点，以 Q&A 问答卡片形式输出，每张卡片格式为「Q: …」「A: …」，共 8-15 张，适合 Anki 复习。",
        user_prompt="请为以下转写文本生成问答卡：\n\n{transcript}",
        output_format="markdown",
    ),
    "actions": SummaryTemplate(
        id="actions",
        label="行动清单",
        desc="可执行的待办/行动项",
        use_case="会议/规划",
        system_prompt="你是一个行动项提取专家。请从内容中提取所有可执行的待办事项和行动项，每条用 checkbox 格式（`- [ ]`）输出，附简要说明和（如有）负责人/截止时间。",
        user_prompt="请从以下转写文本中提取行动清单：\n\n{transcript}",
        output_format="markdown",
    ),
    "standard": SummaryTemplate(
        id="standard",
        label="标准总结",
        desc="自适应教学笔记：短内容精简、长内容完整结构",
        use_case="深度学习",
        system_prompt=(
            "你是一名优秀的讲解型笔记作者。把下面这段视频转写重写成一篇好读的中文学习笔记，\n"
            "按教学逻辑重组，不照抄字幕顺序。\n\n"
            "【三步法：画像→预算→输出】\n\n"
            "第一步·先给内容画像（在心里判断，不输出）：\n"
            "- 类型：产品介绍 / 教程操作 / 讲座原理 / 新闻资讯 / 观点评测 / vlog随笔 / 其它\n"
            "- 信息密度：干货密集 / 中等 / 稀疏口播\n"
            "- 规模：参考用户提供的「转写字数」和「视频时长」\n"
            "- 可展开性：有步骤/原理/对比/数据 → 值得展开；单一主题/重复 → 不展开\n\n"
            "第二步·按画像定「结构预算」（控节数，不控字数）：\n"
            "- 稀疏/简单/短（如 ≤1 分钟的产品介绍、工具演示）：1–2 节、要点式、\n"
            "  不分小节、不硬套教学框、宁可三五句讲完。\n"
            "- 中等：2–4 节、关键处展开机制/例子。\n"
            "- 密集/复杂/长（教程/讲座/多主题）：完整教学结构、多节、深度展开、嵌图。\n\n"
            "第三步·按预算输出。篇幅必须与信息量匹配，简单内容绝不为凑结构扩写；\n"
            "总结要让读者比看原视频更省时。\n\n"
            "【完整结构（仅用于中等及以上内容）】\n"
            "1. markdown，## 分节、### 分小节。\n"
            "2. 开头「背景/动机」：解决什么问题、为什么值得看。\n"
            "3. 每个主题按「动机→核心→机制→例子→小结」展开（简单主题可省略其中几步）。\n"
            "4. 关键信号用引用块（按需，没有就不放，一节可多个）：\n"
            "   > 💡 **要点** ／ > 📎 **背景** ／ > ⚠️ **注意**\n"
            "5. 公式/代码先讲意图再给出。\n"
            "6. 内容多的章节可加「**本章小结**」；短内容不需要。\n"
            "7. 结尾「## 总结与延伸」：核心要点 + 可行动 takeaway（简单内容一两句即可）。\n"
            "8. 跳过寒暄/广告/一键三连。"
        ),
        user_prompt="请为以下转写文本生成学习笔记：\n\n{transcript}",
        output_format="markdown",
    ),
}


def get_template(template_id: str) -> SummaryTemplate:
    """获取指定 ID 的模板，未知 ID 回退到 concise。"""
    return TEMPLATES.get(template_id, TEMPLATES["concise"])


def list_template_ids() -> list[str]:
    """返回所有可用模板 ID。"""
    return list(TEMPLATES.keys())
