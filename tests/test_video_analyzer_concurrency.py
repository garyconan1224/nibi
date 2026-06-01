"""VLM 多帧并发调用 + 协作取消的单元测试。

覆盖 perf(video) 改动的核心契约：
1. 性能档位 → VLM 并发数映射（low=3 / medium=6 / high=8）。
2. cancel_event 置位时 worker 直接短路，不再发起 VLM 调用。
3. 并发返回乱序时，最终帧结果完整且按时间戳归位（不丢帧/不乱序）。
4. 中途取消后停止处理后续帧、跳过全局总结，且 process_video 返回 None。

全程 mock 掉 cv2 / 截帧 / VLM / 落盘，不触发任何真实视频或网络调用。
"""

from __future__ import annotations

import random
import threading
import time
from pathlib import Path
from typing import Any, Callable

import pytest

import shared.video_analyzer as va
from shared.settings_store import PerformanceConfig
from shared.video_analyzer import AnalysisState, CaptureParams, VideoProgress


# ── 1. 性能档位 → 并发数映射 ──────────────────────────────────


@pytest.mark.parametrize("tier,expected", [("low", 3), ("medium", 6), ("high", 8)])
def test_tier_vlm_concurrency_mapping(tier: str, expected: int) -> None:
    assert PerformanceConfig(tier=tier).vlm_concurrency == expected


# ── 2. worker 级取消短路 ──────────────────────────────────────


def test_frame_task_skips_vlm_when_cancelled(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """cancel_event 已置位时，_analyze_frame_task 返回 None 且不调用 VLM。"""
    calls: list[int] = []
    monkeypatch.setattr(va, "frame_to_base64", lambda img: "b64")
    monkeypatch.setattr(va, "save_frame_to_disk", lambda img, fp: None)
    monkeypatch.setattr(
        va,
        "analyze_video_frame",
        lambda *a, **k: (calls.append(1), {"description_zh": "d", "image_prompt_en": "p"})[1],
    )

    ev = threading.Event()
    ev.set()
    out = va._analyze_frame_task(5, "img", "key", "model", "prod", "safe", tmp_path, ev)
    assert out is None
    assert calls == []  # 取消后未发起任何 VLM 调用

    # 对照：未取消时正常返回 frame_data 并调用 VLM
    out2 = va._analyze_frame_task(5, "img", "key", "model", "prod", "safe", tmp_path, None)
    assert out2 is not None and out2["timestamp"]
    assert calls == [1]


# ── 3 / 4 共用：把 process_video 的重副作用 mock 成可控桩 ─────


def _patch_process_video(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    n_frames: int,
    vlm_fn: Callable[..., dict[str, Any]],
) -> dict[str, Any]:
    """打桩 process_video 的外部依赖，返回一个收集 save_results(frames=...) 的容器。"""
    captured: dict[str, Any] = {}

    frames_in = [(sec, f"img{sec}") for sec in range(n_frames)]
    monkeypatch.setattr(va, "extract_frames", lambda *a, **k: iter(frames_in))
    monkeypatch.setattr(va, "frame_to_base64", lambda img: "b64")
    monkeypatch.setattr(va, "save_frame_to_disk", lambda img, fp: None)
    monkeypatch.setattr(va, "load_checkpoint", lambda d: [])
    monkeypatch.setattr(va, "append_checkpoint", lambda d, fd: None)
    monkeypatch.setattr(va, "clear_checkpoint", lambda d: None)
    monkeypatch.setattr(va, "get_safe_name", lambda vp: "safe")
    monkeypatch.setattr(va, "get_output_dir", lambda vp: tmp_path)
    monkeypatch.setattr(va, "analyze_video_frame", vlm_fn)

    def _fake_summary(*a: Any, **k: Any) -> str:
        captured["summary_called"] = True
        return "summary"

    monkeypatch.setattr(va, "generate_video_summary", _fake_summary)

    def _fake_save(out: Path, sn: str, ot: str, pn: str, summary: str, frames: list) -> None:
        captured["frames"] = list(frames)

    monkeypatch.setattr(va, "save_results", _fake_save)

    class _FakeCap:
        def isOpened(self) -> bool:
            return True

        def get(self, prop: int) -> float:
            return 30.0

        def release(self) -> None:
            pass

    monkeypatch.setattr(va.cv2, "VideoCapture", lambda p: _FakeCap())
    return captured


def _interval_params(n_frames: int) -> CaptureParams:
    return CaptureParams(mode="interval", interval_sec=1, max_frames=n_frames, frames_per_shot=3)


def test_process_video_concurrent_frames_complete_and_ordered(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """并发(8 路)下随机乱序返回，最终帧应全部到齐且按时间戳升序归位。"""
    n = 20

    def _vlm(api_key: str, model: str, img_b64: str, product: str) -> dict[str, Any]:
        time.sleep(random.uniform(0, 0.01))  # 制造乱序完成
        return {"description_zh": "d", "image_prompt_en": "p"}

    captured = _patch_process_video(monkeypatch, tmp_path, n, _vlm)
    state = AnalysisState(videos=[VideoProgress(video_name="v.mp4")])

    out = va.process_video(
        "key", Path("v.mp4"), 0, 1, state,
        auto_sync_json=False,
        capture_params=_interval_params(n),
        concurrency=8,
    )

    assert out is not None
    frames = captured["frames"]
    timestamps = [f["timestamp"] for f in frames]
    expected = [va.format_timestamp(sec) for sec in range(n)]
    assert len(frames) == n, "并发后丢帧"
    assert set(timestamps) == set(expected), "帧集合不完整"
    assert timestamps == sorted(timestamps), "帧未按时间戳归位（乱序）"


def test_process_video_cancel_stops_followup_vlm_and_summary(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """首帧触发取消后：后续帧不再调 VLM、跳过总结、process_video 返回 None。"""
    n = 30
    ev = threading.Event()
    calls = {"vlm": 0}
    lock = threading.Lock()

    def _vlm(api_key: str, model: str, img_b64: str, product: str) -> dict[str, Any]:
        with lock:
            calls["vlm"] += 1
        ev.set()  # 第一帧一进来就请求取消
        return {"description_zh": "d", "image_prompt_en": "p"}

    captured = _patch_process_video(monkeypatch, tmp_path, n, _vlm)
    state = AnalysisState(videos=[VideoProgress(video_name="v.mp4")])

    out = va.process_video(
        "key", Path("v.mp4"), 0, 1, state,
        auto_sync_json=False,
        capture_params=_interval_params(n),
        concurrency=3,
        cancel_event=ev,
    )

    assert out is None, "取消后应返回 None"
    assert captured.get("summary_called") is not True, "取消后不应再生成全局总结"
    assert 1 <= calls["vlm"] < n, f"取消应阻止大部分 VLM 调用，实际调用 {calls['vlm']}/{n}"


def test_process_video_cancel_before_start_makes_no_vlm_call(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """开跑前 cancel_event 已置位：一次 VLM 都不调，直接收口返回 None。"""
    n = 12
    calls = {"vlm": 0}

    def _vlm(*a: Any, **k: Any) -> dict[str, Any]:
        calls["vlm"] += 1
        return {"description_zh": "d", "image_prompt_en": "p"}

    captured = _patch_process_video(monkeypatch, tmp_path, n, _vlm)
    ev = threading.Event()
    ev.set()
    state = AnalysisState(videos=[VideoProgress(video_name="v.mp4")])

    out = va.process_video(
        "key", Path("v.mp4"), 0, 1, state,
        auto_sync_json=False,
        capture_params=_interval_params(n),
        concurrency=4,
        cancel_event=ev,
    )

    assert out is None
    assert calls["vlm"] == 0
    assert captured.get("summary_called") is not True
