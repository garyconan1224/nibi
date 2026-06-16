"""R18: 总结模板系统测试。"""

from backend.app.services.summary_templates import TEMPLATES, get_template, list_template_ids


def test_all_template_ids_loadable():
    """15 个模板 id 都能加载（R3.1 新增 standard）。"""
    expected_ids = [
        "concise", "detailed", "quotes", "meeting",
        "xhs", "longform", "lecture", "interview", "shownotes",
        "oral", "steps", "outline", "qa", "actions", "standard",
    ]
    assert list_template_ids() == expected_ids
    for tid in expected_ids:
        tpl = get_template(tid)
        assert tpl.id == tid
        assert tpl.label
        assert tpl.system_prompt
        assert tpl.user_prompt


def test_unknown_id_fallback_concise():
    """未知 id 回退到 concise。"""
    tpl = get_template("nonexistent_template")
    assert tpl.id == "concise"
    assert tpl.label == "精简摘要"


def test_template_user_prompt_has_transcript_placeholder():
    """每个模板的 user_prompt 都包含 {transcript} 占位符。"""
    for tid in list_template_ids():
        tpl = get_template(tid)
        assert "{transcript}" in tpl.user_prompt, f"{tid} 缺少 {{transcript}} 占位符"
