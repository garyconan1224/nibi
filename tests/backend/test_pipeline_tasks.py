"""handle_note_task 单元测试：覆盖三种步骤编排场景。

场景 A：仅下载
场景 B：下载 + 转录
场景 C：全选（下载 + 转录 + 分析 + 笔记汇总）
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Dict
from unittest.mock import MagicMock, patch

import pytest

from backend.app.models.tasks import TERMINAL_STATUS_VALUES, TaskRecord, TaskStatus
from backend.app.services.task_runner import TaskRunner
from backend.app.services.task_store import TaskStore


# ── 公共辅助 ──────────────────────────────────────────────────────────────

def _make_runner(tmp_path: Path, steps: list[str]) -> tuple[TaskRunner, TaskRecord]:
    """创建 TaskStore + TaskRunner，注册 handle_note_task，提交任务并返回。"""
    from backend.app.services.pipeline_tasks import handle_note_task

    store = TaskStore(path=tmp_path / "tasks.json")
    runner = TaskRunner(store, max_workers=1)
    runner.register("note", handle_note_task)

    payload = {
        "url": "https://www.youtube.com/watch?v=test_video",
        "steps": steps,
    }
    rec = runner.create_task("proj-test", "note", payload)
    return runner, rec


def _wait_for_terminal(store: TaskStore, task_id: str, timeout: float = 5.0) -> TaskRecord:
    """等待任务进入终结态，超时则直接返回。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        rec = store.get(task_id)
        if rec is not None and rec.status in TERMINAL_STATUS_VALUES:
            return rec
        time.sleep(0.05)
    return store.get(task_id)  # type: ignore[return-value]


# ── Mock 工厂 ──────────────────────────────────────────────────────────────

def _mock_download_ok(save_path: str):
    """返回成功的 yt-dlp 下载结果 mock。"""
    m = MagicMock(return_value={"ok": True, "save_path": save_path})
    return m


def _mock_analysis_state(finished: bool = True):
    """返回一个已完成的 AnalysisState mock。"""
    state = MagicMock()
    state.finished = finished
    state.snapshot.return_value = [{"percent": 100}]
    return state


def _mock_settings(api_key: str = ""):
    """返回 handle_note_task 当前所需的 settings 形状。"""
    transcriber = MagicMock(
        whisper_model_size="base",
        device="cpu",
        language="",
        initial_prompt="",
    )
    return MagicMock(
        openai_api_key=api_key,
        vision_model="gpt-4o",
        text_model="gpt-4o",
        transcriber=transcriber,
    )


# ── 场景 A：仅下载 ─────────────────────────────────────────────────────────

class TestScenarioA:
    """steps = ['download'] — 仅执行下载步骤。"""

    def test_download_only_succeeds(self, tmp_path: Path) -> None:
        fake_video = tmp_path / "videos" / "test.mp4"
        fake_video.parent.mkdir(parents=True, exist_ok=True)
        fake_video.touch()

        with (
            patch("backend.app.services.pipeline_tasks.run_ytdlp_download",
                  return_value={"ok": True, "save_path": str(fake_video)}),
            patch("backend.app.services.pipeline_tasks.get_project_videos_dir",
                  return_value=fake_video.parent),
            patch("backend.app.services.pipeline_tasks.get_project_json_dir",
                  return_value=tmp_path / "json"),
            patch("backend.app.services.pipeline_tasks.load_settings",
                  return_value=MagicMock(openai_api_key="", vision_model="gpt-4o", text_model="gpt-4o")),
        ):
            runner, rec = _make_runner(tmp_path, steps=["download"])
            done = _wait_for_terminal(runner.store, rec.task_id)

        assert done.status == TaskStatus.SUCCESS.value, done.error
        result: Dict[str, Any] = done.result
        assert "download" in result["completed_steps"]
        assert "transcribe" not in result["completed_steps"]
        assert result["video_file"] == str(fake_video)

    def test_download_only_failed_raises(self, tmp_path: Path) -> None:
        with (
            patch("backend.app.services.pipeline_tasks.run_ytdlp_download",
                  return_value={"ok": False, "error": "network error"}),
            patch("backend.app.services.pipeline_tasks.get_project_videos_dir",
                  return_value=tmp_path / "videos"),
            patch("backend.app.services.pipeline_tasks.get_project_json_dir",
                  return_value=tmp_path / "json"),
            patch("backend.app.services.pipeline_tasks.load_settings",
                  return_value=MagicMock(openai_api_key="", vision_model="gpt-4o", text_model="gpt-4o")),
        ):
            runner, rec = _make_runner(tmp_path, steps=["download"])
            done = _wait_for_terminal(runner.store, rec.task_id)

        assert done.status == TaskStatus.FAILED.value
        assert "下载失败" in done.error


# ── 场景 B：下载 + 转录 ────────────────────────────────────────────────────

class TestScenarioB:
    """steps = ['download', 'transcribe'] — 下载后执行转录。"""

    def test_download_and_transcribe_succeeds(self, tmp_path: Path) -> None:
        fake_video = tmp_path / "videos" / "test.mp4"
        fake_video.parent.mkdir(parents=True, exist_ok=True)
        fake_video.touch()

        with (
            patch("backend.app.services.pipeline_tasks.run_ytdlp_download",
                  return_value={"ok": True, "save_path": str(fake_video)}),
            patch("backend.app.services.pipeline_tasks.get_project_videos_dir",
                  return_value=fake_video.parent),
            patch("backend.app.services.pipeline_tasks.get_project_json_dir",
                  return_value=tmp_path / "json"),
            patch("backend.app.services.pipeline_tasks.load_settings",
                  return_value=_mock_settings()),
            patch("backend.app.services.asr_fast_whisper.is_fast_whisper_available",
                  return_value=True),
            patch("backend.app.services.asr_fast_whisper.transcribe_file_with_fast_whisper",
                  return_value="这是转录文本"),
        ):
            runner, rec = _make_runner(tmp_path, steps=["download", "transcribe"])
            done = _wait_for_terminal(runner.store, rec.task_id)

        assert done.status == TaskStatus.SUCCESS.value, done.error
        result: Dict[str, Any] = done.result
        assert "download" in result["completed_steps"]
        assert "transcribe" in result["completed_steps"]
        assert "analyze" not in result["completed_steps"]
        assert result["transcript"] == "这是转录文本"
        assert result["video_file"] == str(fake_video)


# ── 场景 C：全量流程 ───────────────────────────────────────────────────────

class TestScenarioC:
    """steps = ['download', 'transcribe', 'analyze', 'note'] — 完整四步流程。"""

    def test_full_pipeline_succeeds(self, tmp_path: Path) -> None:
        fake_video = tmp_path / "videos" / "test.mp4"
        fake_video.parent.mkdir(parents=True, exist_ok=True)
        fake_video.touch()

        # 模拟 analyze 步骤产出的 markdown 文件
        analysis_md_dir = tmp_path / "videos" / "test_分析报告"
        analysis_md_dir.mkdir(parents=True, exist_ok=True)
        analysis_md_file = analysis_md_dir / "test_图文分镜.md"
        analysis_md_file.write_text("## 分析内容\n\n帧1: 产品展示", encoding="utf-8")

        mock_state = _mock_analysis_state(finished=True)

        with (
            patch("backend.app.services.pipeline_tasks.run_ytdlp_download",
                  return_value={"ok": True, "save_path": str(fake_video)}),
            patch("backend.app.services.pipeline_tasks.get_project_videos_dir",
                  return_value=fake_video.parent),
            patch("backend.app.services.pipeline_tasks.get_project_json_dir",
                  return_value=tmp_path / "json"),
            patch("backend.app.services.pipeline_tasks.load_settings",
                  return_value=_mock_settings("sk-test")),
            patch("backend.app.services.asr_fast_whisper.is_fast_whisper_available",
                  return_value=True),
            patch("backend.app.services.asr_fast_whisper.transcribe_file_with_fast_whisper",
                  return_value="转录文本内容"),
            patch("backend.app.services.pipeline_tasks.find_videos",
                  return_value=[fake_video]),
            patch("backend.app.services.pipeline_tasks.run_batch_analysis",
                  return_value=mock_state),
            patch("backend.app.services.pipeline_tasks.get_safe_name",
                  return_value="test"),
            patch("backend.app.services.pipeline_tasks.get_output_dir",
                  return_value=analysis_md_dir),
        ):
            runner, rec = _make_runner(tmp_path, steps=["download", "transcribe", "analyze", "note"])
            done = _wait_for_terminal(runner.store, rec.task_id)

        assert done.status == TaskStatus.SUCCESS.value, done.error
        result: Dict[str, Any] = done.result
        all_steps = result["completed_steps"]
        assert all_steps == ["download", "transcribe", "analyze", "note"]
        assert "## 分析内容" in result["analysis"]
        # note 步骤优先使用 analysis_text（而非 transcript）
        assert "## 分析内容" in result["markdown"]
        assert result["transcript"] == "转录文本内容"

    def test_full_pipeline_markdown_fallback_to_transcript(self, tmp_path: Path) -> None:
        """当 analyze 步骤没有产出 md 文件时，note 步骤应降级使用 transcript。"""
        fake_video = tmp_path / "videos" / "test.mp4"
        fake_video.parent.mkdir(parents=True, exist_ok=True)
        fake_video.touch()

        # 分析目录存在但无 md 文件（模拟分析为空产出）
        empty_md_dir = tmp_path / "videos" / "test_分析报告"
        empty_md_dir.mkdir(parents=True, exist_ok=True)

        mock_state = _mock_analysis_state(finished=True)

        with (
            patch("backend.app.services.pipeline_tasks.run_ytdlp_download",
                  return_value={"ok": True, "save_path": str(fake_video)}),
            patch("backend.app.services.pipeline_tasks.get_project_videos_dir",
                  return_value=fake_video.parent),
            patch("backend.app.services.pipeline_tasks.get_project_json_dir",
                  return_value=tmp_path / "json"),
            patch("backend.app.services.pipeline_tasks.load_settings",
                  return_value=_mock_settings("sk-test")),
            patch("backend.app.services.asr_fast_whisper.is_fast_whisper_available",
                  return_value=True),
            patch("backend.app.services.asr_fast_whisper.transcribe_file_with_fast_whisper",
                  return_value="降级转录内容"),
            patch("backend.app.services.pipeline_tasks.find_videos",
                  return_value=[fake_video]),
            patch("backend.app.services.pipeline_tasks.run_batch_analysis",
                  return_value=mock_state),
            patch("backend.app.services.pipeline_tasks.get_safe_name",
                  return_value="test"),
            patch("backend.app.services.pipeline_tasks.get_output_dir",
                  return_value=empty_md_dir),
        ):
            runner, rec = _make_runner(tmp_path, steps=["download", "transcribe", "analyze", "note"])
            done = _wait_for_terminal(runner.store, rec.task_id)

        assert done.status == TaskStatus.SUCCESS.value, done.error
        result: Dict[str, Any] = done.result
        # analysis 为空时，markdown 应使用 transcript 内容
        assert result["analysis"] == ""
        assert result["markdown"] == "降级转录内容"


# ── Phase 1F：验证 PROBE / STORE 框架级阶段被触发 ────────────────────────────

class TestPhase1FStageTransitions:
    """Phase 1F 完成标准：除用户勾选的 steps 外，pipeline 必须额外推进
    PROBE（download 之后）和 STORE（最终 SUCCESS 之前）两个框架级阶段，
    对齐 v1.1 §11 全流程进度可视化要求。
    """

    def test_probe_and_store_phases_emit_log_messages(self, tmp_path: Path) -> None:
        """download-only 场景下，任务日志应包含 PROBE 与 STORE 阶段的进度消息。

        PROBE 进度消息："探测媒体元数据..."
        STORE 进度消息："归档任务结果..."
        """
        fake_video = tmp_path / "videos" / "test.mp4"
        fake_video.parent.mkdir(parents=True, exist_ok=True)
        fake_video.touch()

        with (
            patch("backend.app.services.pipeline_tasks.run_ytdlp_download",
                  return_value={"ok": True, "save_path": str(fake_video)}),
            patch("backend.app.services.pipeline_tasks.get_project_videos_dir",
                  return_value=fake_video.parent),
            patch("backend.app.services.pipeline_tasks.get_project_json_dir",
                  return_value=tmp_path / "json"),
            patch("backend.app.services.pipeline_tasks.load_settings",
                  return_value=MagicMock(openai_api_key="", vision_model="gpt-4o", text_model="gpt-4o")),
        ):
            runner, rec = _make_runner(tmp_path, steps=["download"])
            done = _wait_for_terminal(runner.store, rec.task_id)

        assert done.status == TaskStatus.SUCCESS.value, done.error
        # TaskLogEntry 是 dataclass，含 ts/level/message 属性
        log_messages = " | ".join(entry.message for entry in (done.log or []))
        assert "探测媒体元数据" in log_messages, (
            f"PROBE 阶段消息缺失，日志：{log_messages}"
        )
        assert "归档任务结果" in log_messages, (
            f"STORE 阶段消息缺失，日志：{log_messages}"
        )
