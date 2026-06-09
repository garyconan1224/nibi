"""summary_generator + workspace_store summary helpers 测试。"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from backend.app.models.workspace import ItemSummary, WorkspaceItem, WorkspaceRecord
from backend.app.services.summary_generator import build_prompt, generate_summary
from backend.app.services.workspace_store import WorkspaceStore


# ── 辅助 ────────────────────────────────────────────────────────


def _make_item(**overrides: object) -> WorkspaceItem:
    base = dict(
        item_id="item-1",
        type="video",
        source="local",
        source_value="/tmp/test.mp4",
        name="测试视频",
        status="done",
        results={"transcript": "这是转写文本内容。"},
    )
    base.update(overrides)
    return WorkspaceItem.from_dict(base)


def _make_store_with_item(item: WorkspaceItem | None = None) -> WorkspaceStore:
    """创建临时 WorkspaceStore 并写入一个 workspace + item。"""
    import tempfile, pathlib
    tmp = tempfile.mkdtemp()
    store = WorkspaceStore(root=pathlib.Path(tmp))
    rec = WorkspaceRecord(workspace_id="ws-1", name="测试工作空间")
    rec.items.append(item or _make_item())
    store.create(rec)
    return store


# ── build_prompt ────────────────────────────────────────────────


class TestBuildPrompt:
    def test_basic_prompt(self) -> None:
        item = _make_item()
        sys_p, usr_p = build_prompt(item, "concise")
        assert "简洁" in sys_p or "摘要" in sys_p
        assert "这是转写文本内容" in usr_p

    def test_background_prepended(self) -> None:
        item = _make_item()
        _, usr_p = build_prompt(item, "concise", background="这是背景信息")
        assert usr_p.startswith("【背景信息】")
        assert "这是背景信息" in usr_p
        assert "这是转写文本内容" in usr_p

    def test_empty_background_not_prepended(self) -> None:
        item = _make_item()
        _, usr_p = build_prompt(item, "concise", background="")
        assert not usr_p.startswith("【背景信息】")

    def test_fallback_to_summary_when_no_transcript(self) -> None:
        item = _make_item(results={"summary": "老总结内容"})
        _, usr_p = build_prompt(item, "concise")
        assert "老总结内容" in usr_p

    def test_all_template_ids(self) -> None:
        """9 个模板 id 都能构造 prompt 不报错。"""
        from backend.app.services.summary_templates import list_template_ids
        item = _make_item()
        for tid in list_template_ids():
            sys_p, usr_p = build_prompt(item, tid)
            assert sys_p  # 非空
            assert usr_p  # 非空


# ── generate_summary（mock LLM）────────────────────────────────


class TestGenerateSummary:
    @patch("backend.app.services.summary_generator._call_llm")
    def test_returns_item_summary(self, mock_llm: MagicMock) -> None:
        mock_llm.return_value = ("# 摘要\n\n这是生成的摘要", "openai/gpt-4o")
        item = _make_item()
        result = generate_summary(item, "concise", background="背景")

        assert isinstance(result, ItemSummary)
        assert result.template == "concise"
        assert result.content_md == "# 摘要\n\n这是生成的摘要"
        assert result.model_used == "openai/gpt-4o"
        assert result.background_for_summary == "背景"
        assert result.summary_id  # uuid 非空
        assert result.version == 0  # 默认 0，调用方负责覆盖

    @patch("backend.app.services.summary_generator._call_llm")
    def test_llm_called_with_correct_prompts(self, mock_llm: MagicMock) -> None:
        mock_llm.return_value = ("output", "model")
        item = _make_item()
        generate_summary(item, "detailed")

        call_args = mock_llm.call_args
        sys_p, usr_p = call_args[0]
        assert "要点" in sys_p or "分析师" in sys_p
        assert "转写文本" in usr_p


# ── workspace_store summary helpers ─────────────────────────────


class TestWorkspaceStoreSummaryHelpers:
    def test_get_item(self) -> None:
        store = _make_store_with_item()
        item = store.get_item("ws-1", "item-1")
        assert item.item_id == "item-1"

    def test_get_item_not_found(self) -> None:
        store = _make_store_with_item()
        with pytest.raises(KeyError, match="item not found"):
            store.get_item("ws-1", "nonexistent")

    def test_next_version_for_template_first(self) -> None:
        store = _make_store_with_item()
        ver = store.next_version_for_template("ws-1", "item-1", "concise")
        assert ver == 0  # 首版 = v0

    def test_next_version_for_template_increment(self) -> None:
        store = _make_store_with_item()
        s1 = ItemSummary(summary_id="s1", template="concise", version=0)
        store.add_item_summary("ws-1", "item-1", s1)
        ver = store.next_version_for_template("ws-1", "item-1", "concise")
        assert ver == 1

    def test_next_version_different_templates_independent(self) -> None:
        store = _make_store_with_item()
        s1 = ItemSummary(summary_id="s1", template="concise", version=0)
        store.add_item_summary("ws-1", "item-1", s1)
        ver = store.next_version_for_template("ws-1", "item-1", "detailed")
        assert ver == 0  # 不同 template 独立计数，首版 = v0

    def test_add_item_summary(self) -> None:
        store = _make_store_with_item()
        s = ItemSummary(summary_id="s1", template="concise", version=1, content_md="内容")
        result = store.add_item_summary("ws-1", "item-1", s)
        assert result.summary_id == "s1"

        # 验证落盘后能读到
        item = store.get_item("ws-1", "item-1")
        assert len(item.summaries) == 1
        assert item.summaries[0].content_md == "内容"

    def test_delete_item_summary(self) -> None:
        store = _make_store_with_item()
        s1 = ItemSummary(summary_id="s1", template="concise", version=1)
        s2 = ItemSummary(summary_id="s2", template="concise", version=2)
        store.add_item_summary("ws-1", "item-1", s1)
        store.add_item_summary("ws-1", "item-1", s2)

        assert store.delete_item_summary("ws-1", "item-1", "s1") is True
        item = store.get_item("ws-1", "item-1")
        assert len(item.summaries) == 1
        assert item.summaries[0].summary_id == "s2"

    def test_delete_item_summary_not_found(self) -> None:
        store = _make_store_with_item()
        assert store.delete_item_summary("ws-1", "item-1", "nonexistent") is False


# ── _collect_frames（R3.4 嵌图链路）─────────────────────────────


class TestCollectFrames:
    """_collect_frames：带描述帧/无描述帧/空/串台 的取数逻辑。"""

    def test_frames_with_description(self) -> None:
        """results["frames"] 带 description → 直接返回。"""
        from backend.app.services.summary_generator import _collect_frames

        item = _make_item(results={
            "frames": [
                {"sec": 10, "description": "代码编辑器界面", "image_path": "/static/a.jpg"},
                {"sec": 30, "description": "终端输出结果", "image_path": "/static/b.jpg"},
            ],
        })
        out = _collect_frames(item)
        assert len(out) == 2
        assert out[0]["desc"] == "代码编辑器界面"
        assert out[0]["sec"] == 10.0
        assert out[0]["image_path"] == "/static/a.jpg"

    def test_frames_without_description_skipped(self) -> None:
        """results["frames"] 无 description 字段 → 走 fallback，无 json_outputs 时返回空。"""
        from backend.app.services.summary_generator import _collect_frames

        item = _make_item(results={
            "frames": [
                {"sec": 10, "image_path": "/static/a.jpg"},  # 缺 description
            ],
        })
        out = _collect_frames(item)
        assert out == []

    def test_empty_frames(self) -> None:
        """results 无 frames 且无 json_outputs → 返回空。"""
        from backend.app.services.summary_generator import _collect_frames

        item = _make_item(results={"transcript": "文本"})
        out = _collect_frames(item)
        assert out == []

    def test_frames_with_empty_description_skipped(self) -> None:
        """description 为空字符串的帧被跳过。"""
        from backend.app.services.summary_generator import _collect_frames

        item = _make_item(results={
            "frames": [
                {"sec": 10, "description": "", "image_path": "/static/a.jpg"},
                {"sec": 30, "description": "有效描述", "image_path": "/static/b.jpg"},
            ],
        })
        out = _collect_frames(item)
        assert len(out) == 1
        assert out[0]["desc"] == "有效描述"


# ── _postprocess_frames（R3.4 嵌图链路）────────────────────────


class TestPostprocessFrames:
    """_postprocess_frames：[[图N]]→![]() 替换 + 越界删除。"""

    def test_replace_valid_tags(self) -> None:
        """[[图0]] 和 [[图1]] 被替换为 markdown 图片。"""
        from backend.app.services.summary_generator import _postprocess_frames

        frames = [
            {"idx": 0, "sec": 10, "desc": "界面截图", "image_path": "/static/ws/videos/frames/f0.jpg"},
            {"idx": 1, "sec": 30, "desc": "输出结果", "image_path": "/static/ws/videos/frames/f1.jpg"},
        ]
        md = "前面内容\n\n[[图0]]\n\n中间内容\n\n[[图1]]\n\n后面内容"
        result = _postprocess_frames(md, frames)
        assert "![界面截图]" in result
        assert "![输出结果]" in result
        assert "[[图" not in result

    def test_out_of_bound_tag_removed(self) -> None:
        """越界的 [[图99]] 被删除，不报错。"""
        from backend.app.services.summary_generator import _postprocess_frames

        frames = [{"idx": 0, "sec": 10, "desc": "a", "image_path": "/static/x.jpg"}]
        md = "内容[[图0]]和[[图99]]"
        result = _postprocess_frames(md, frames)
        assert "[[图99]]" not in result
        assert "![a]" in result

    def test_no_frames_removes_all_tags(self) -> None:
        """frames 为空列表时，所有 [[图N]] 被清除。"""
        from backend.app.services.summary_generator import _postprocess_frames

        md = "内容[[图0]]和[[图1]]还有[[图2]]"
        result = _postprocess_frames(md, [])
        assert "[[图" not in result
        assert "内容" in result

    def test_no_tags_unchanged(self) -> None:
        """无 [[图N]] 标记时原样返回。"""
        from backend.app.services.summary_generator import _postprocess_frames

        md = "# 标题\n\n正文内容"
        result = _postprocess_frames(md, [{"idx": 0, "sec": 0, "desc": "a", "image_path": "/static/x.jpg"}])
        assert result == md
