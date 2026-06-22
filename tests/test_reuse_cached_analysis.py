"""_reuse_cached_analysis：复用 VLM 缓存 + 重新截帧逻辑测试。"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture()
def cached_env(tmp_path: Path):
    """创建临时环境：json_data/ 有缓存 json，videos/ 有视频。"""
    json_dir = tmp_path / "json_data"
    json_dir.mkdir()
    videos_dir = tmp_path / "videos"
    videos_dir.mkdir()
    video_path = videos_dir / "测试视频_test.mp4"
    video_path.write_bytes(b"\x00" * 100)  # 占位

    cached_json = {
        "video_title": "测试视频",
        "product_name": "TestProduct",
        "global_visual_summary": "这是一个测试视频的全局总结。",
        "frames": [
            {
                "timestamp": "00:00:10",
                "content_zh": "帧1内容",
                "description_zh": "帧1描述",
                "image_prompt_en": "frame 1 prompt",
            },
            {
                "timestamp": "00:01:30",
                "content_zh": "帧2内容",
                "description_zh": "帧2描述",
                "image_prompt_en": "frame 2 prompt",
            },
        ],
    }
    safe_name = "测试视频_test"
    jp = json_dir / (safe_name + "_视觉数据.json")
    jp.write_text(json.dumps(cached_json, ensure_ascii=False), encoding="utf-8")

    return {
        "video_path": video_path,
        "json_dir": json_dir,
        "videos_dir": videos_dir,
        "safe_name": safe_name,
    }


class TestReuseCachedAnalysis:
    """_reuse_cached_analysis 的核心逻辑。"""

    def test_reuse_creates_frames_and_markdown(self, cached_env: dict) -> None:
        """复用模式：读 json 描述 → 截帧 → 写 _图文分镜.md + _视觉数据.json。"""
        from shared.video_analyzer import _reuse_cached_analysis

        video_path = cached_env["video_path"]
        json_dir = cached_env["json_dir"]

        # Mock cv2
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.return_value = 30.0  # fps
        mock_frame = MagicMock()  # fake numpy array
        mock_cap.read.return_value = (True, mock_frame)

        with patch("shared.video_analyzer.cv2") as mock_cv2:
            mock_cv2.VideoCapture.return_value = mock_cap
            mock_cv2.CAP_PROP_FPS = 5
            mock_cv2.CAP_PROP_POS_FRAMES = 1
            mock_cv2.imwrite.return_value = True

            result = _reuse_cached_analysis(video_path, target_json_dir=json_dir)

        assert result is True

        # 验证输出目录结构
        output_dir = video_path.parent / (cached_env["safe_name"] + "_分析报告")
        assert output_dir.exists()
        frames_dir = output_dir / "frames"
        assert frames_dir.exists()

        # 验证 _图文分镜.md 存在
        md_file = output_dir / (cached_env["safe_name"] + "_图文分镜.md")
        assert md_file.exists()
        md_content = md_file.read_text(encoding="utf-8")
        assert "帧1描述" in md_content
        assert "帧2描述" in md_content

        # 验证 _视觉数据.json 存在
        json_file = output_dir / (cached_env["safe_name"] + "_视觉数据.json")
        assert json_file.exists()
        with open(json_file, encoding="utf-8") as f:
            data = json.load(f)
        assert len(data["frames"]) == 2
        assert data["frames"][0]["timestamp"] == "00:00:10"

    def test_reuse_does_not_call_vlm(self, cached_env: dict) -> None:
        """复用模式不调用 VLM API。"""
        from shared.video_analyzer import _reuse_cached_analysis

        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.return_value = 30.0
        mock_cap.read.return_value = (True, MagicMock())

        with patch("shared.video_analyzer.cv2") as mock_cv2:
            mock_cv2.VideoCapture.return_value = mock_cap
            mock_cv2.CAP_PROP_FPS = 5
            mock_cv2.CAP_PROP_POS_FRAMES = 1
            mock_cv2.imwrite.return_value = True

            # 检查不会调用 sf_client 的 VLM 函数
            with patch("shared.video_analyzer.analyze_video_frame") as mock_vlm:
                _reuse_cached_analysis(
                    cached_env["video_path"],
                    target_json_dir=cached_env["json_dir"],
                )
                mock_vlm.assert_not_called()

    def test_returns_false_when_json_missing(self, tmp_path: Path) -> None:
        """json 不存在时返回 False。"""
        from shared.video_analyzer import _reuse_cached_analysis

        video_path = tmp_path / "videos" / "test.mp4"
        video_path.parent.mkdir(parents=True)
        video_path.write_bytes(b"\x00")
        result = _reuse_cached_analysis(video_path, target_json_dir=tmp_path / "no_json")
        assert result is False

    def test_returns_false_when_video_cannot_open(self, cached_env: dict) -> None:
        """视频无法打开时返回 False。"""
        from shared.video_analyzer import _reuse_cached_analysis

        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = False

        with patch("shared.video_analyzer.cv2") as mock_cv2:
            mock_cv2.VideoCapture.return_value = mock_cap
            result = _reuse_cached_analysis(
                cached_env["video_path"],
                target_json_dir=cached_env["json_dir"],
            )
        assert result is False
