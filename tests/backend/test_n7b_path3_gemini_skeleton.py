"""N7b 路径 3 — Gemini 视频直接分析骨架测试。

覆盖：
  GeminiVideoClient 缺 GEMINI_API_KEY 时构造 raise RuntimeError
  _run_video_model_path 正确调用 client 并映射返回结构
  _gemini_segments_to_transcript 正确映射 segments → VideoResultTranscriptLine[]
  _get_video_model_prompt 按 intent 返回不同 prompt
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from shared.gemini_client import DEFAULT_VIDEO_MODEL, GeminiVideoClient, GeminiVideoResponse


# ── GeminiVideoClient 构造测试 ─────────────────────────────────────────


class TestGeminiVideoClientInit:
    """缺 key 时构造即 raise。"""

    def test_raises_when_env_key_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
            GeminiVideoClient()

    def test_raises_when_empty_string_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GEMINI_API_KEY", "   ")
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
            GeminiVideoClient()

    def test_accepts_explicit_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        client = GeminiVideoClient(api_key="test-key-123")
        assert client.api_key == "test-key-123"
        assert client.model == DEFAULT_VIDEO_MODEL

    def test_accepts_env_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GEMINI_API_KEY", "env-key-456")
        client = GeminiVideoClient()
        assert client.api_key == "env-key-456"

    def test_custom_model(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("GEMINI_API_KEY", "key")
        client = GeminiVideoClient(model="gemini-2.5-pro")
        assert client.model == "gemini-2.5-pro"


# ── _gemini_segments_to_transcript 测试 ────────────────────────────────


class TestGeminiSegmentsToTranscript:
    """segments → VideoResultTranscriptLine[] 映射。"""

    def test_maps_segments_to_transcript_lines(self) -> None:
        from backend.app.services.pipeline_tasks import _gemini_segments_to_transcript

        segments = [
            {"start": 0.0, "end": 10.5, "text": "Hello world"},
            {"start": 10.5, "end": 25.0, "text": "Second segment"},
        ]
        result = _gemini_segments_to_transcript(segments)
        assert len(result) == 2
        assert result[0]["t_sec"] == 0.0
        assert result[0]["t_str"] == "00:00"
        assert result[0]["text"] == "Hello world"
        assert result[1]["t_sec"] == 10.5
        assert result[1]["t_str"] == "00:10"
        assert result[1]["text"] == "Second segment"

    def test_skips_empty_text(self) -> None:
        from backend.app.services.pipeline_tasks import _gemini_segments_to_transcript

        segments = [
            {"start": 0.0, "end": 5.0, "text": "valid"},
            {"start": 5.0, "end": 10.0, "text": ""},
            {"start": 10.0, "end": 15.0, "text": None},
        ]
        result = _gemini_segments_to_transcript(segments)
        assert len(result) == 1
        assert result[0]["text"] == "valid"

    def test_empty_segments(self) -> None:
        from backend.app.services.pipeline_tasks import _gemini_segments_to_transcript

        assert _gemini_segments_to_transcript([]) == []


# ── _get_video_model_prompt 测试 ───────────────────────────────────────


class TestGetVideoModelPrompt:
    """按 intent 返回不同 prompt。"""

    def test_learning_prompt(self) -> None:
        from backend.app.services.pipeline_tasks import _get_video_model_prompt

        prompt = _get_video_model_prompt("learning")
        assert "课堂" in prompt or "讲座" in prompt
        assert "知识点" in prompt
        assert "JSON" in prompt

    def test_replica_prompt(self) -> None:
        from backend.app.services.pipeline_tasks import _get_video_model_prompt

        prompt = _get_video_model_prompt("replica")
        assert "拆片" in prompt or "翻拍" in prompt
        assert "镜头" in prompt

    def test_default_prompt(self) -> None:
        from backend.app.services.pipeline_tasks import _get_video_model_prompt

        prompt = _get_video_model_prompt("unknown")
        assert "JSON" in prompt
        assert "summary" in prompt
        assert "segments" in prompt


# ── _run_video_model_path 集成测试 ─────────────────────────────────────


class TestRunVideoModelPath:
    """mock client 验证完整流程。"""

    @pytest.fixture()
    def mock_runner(self) -> MagicMock:
        runner = MagicMock()
        runner.append_log = MagicMock()
        runner.set_progress = MagicMock()
        return runner

    @pytest.fixture()
    def sample_video(self, tmp_path: Path) -> Path:
        v = tmp_path / "test_video.mp4"
        v.write_bytes(b"fake video data")
        return v

    def test_calls_client_and_returns_mapped_result(
        self,
        mock_runner: MagicMock,
        sample_video: Path,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("GEMINI_API_KEY", "test-key")

        fake_response = GeminiVideoResponse(
            summary="这是一个测试视频摘要",
            segments=[
                {"start": 0.0, "end": 15.0, "text": "第一段内容"},
                {"start": 15.0, "end": 30.0, "text": "第二段内容"},
            ],
            raw_response={"summary": "raw", "segments": []},
        )

        with patch.object(GeminiVideoClient, "analyze_video", return_value=fake_response) as mock_analyze:
            from backend.app.services.pipeline_tasks import _run_video_model_path

            result = _run_video_model_path(
                videos=[sample_video],
                payload={"video_intent": "learning"},
                task_id="test-task-001",
                project_json_dir=tmp_path / "json",
                runner=mock_runner,
            )

            mock_analyze.assert_called_once()
            call_kwargs = mock_analyze.call_args
            assert call_kwargs.kwargs["video_path"] == sample_video
            assert call_kwargs.kwargs["intent"] == "learning"

        assert result["summary_path"] == "video_model"
        assert result["summary"] == "这是一个测试视频摘要"
        assert result["intent"] == "learning"
        assert len(result["transcript"]) == 2
        assert result["transcript"][0]["t_sec"] == 0.0
        assert result["transcript"][0]["text"] == "第一段内容"
        assert result["transcript"][1]["t_sec"] == 15.0
        assert "第一段内容" in result["transcript_text"]
        assert "第二段内容" in result["transcript_text"]
        assert len(result["transcript_segments"]) == 2

    def test_raises_when_no_key(
        self,
        mock_runner: MagicMock,
        sample_video: Path,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)

        from backend.app.services.pipeline_tasks import _run_video_model_path

        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            _run_video_model_path(
                videos=[sample_video],
                payload={},
                task_id="test-task-002",
                project_json_dir=tmp_path / "json",
                runner=mock_runner,
            )

    def test_uses_model_override(
        self,
        mock_runner: MagicMock,
        sample_video: Path,
        tmp_path: Path,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("GEMINI_API_KEY", "test-key")

        fake_response = GeminiVideoResponse(summary="ok", segments=[], raw_response={})

        with patch.object(GeminiVideoClient, "analyze_video", return_value=fake_response):
            from backend.app.services.pipeline_tasks import _run_video_model_path

            result = _run_video_model_path(
                videos=[sample_video],
                payload={"video_model": "gemini-2.5-pro"},
                task_id="test-task-003",
                project_json_dir=tmp_path / "json",
                runner=mock_runner,
            )

        assert result["summary_path"] == "video_model"
        # 验证日志中包含 override model 名称
        log_calls = [str(c) for c in mock_runner.append_log.call_args_list]
        assert any("gemini-2.5-pro" in c for c in log_calls)
