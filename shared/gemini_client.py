"""Gemini 视频直接分析客户端骨架。

延迟导入 google-genai SDK，缺 SDK 或 API key 时给出明确错误。
本期只做骨架：不真调 API、不装 google-genai（mock 单测覆盖）。
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List

DEFAULT_VIDEO_MODEL = "gemini-2.5-flash"


@dataclass
class GeminiVideoResponse:
    """Gemini 视频分析的结构化返回。"""

    summary: str
    segments: List[Dict[str, Any]]
    raw_response: Dict[str, Any] = field(default_factory=dict)


class GeminiVideoClient:
    """Gemini 视频分析客户端。

    使用 google-genai SDK 的 File API 上传视频 → generate_content → 删除文件。
    缺 GEMINI_API_KEY 时构造即 raise RuntimeError。
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str = DEFAULT_VIDEO_MODEL,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
        if not self.api_key:
            raise RuntimeError(
                "GEMINI_API_KEY 未配置，video_model 路径暂不可用，请在 .env 添加后重试"
            )
        self.model = model

    def analyze_video(
        self,
        video_path: Path,
        intent: str,
        prompt_template: str,
    ) -> GeminiVideoResponse:
        """上传视频到 Gemini File API，获取结构化分析结果。

        Args:
            video_path: 本地视频文件路径
            intent: 视频意图（learning / replica / 默认）
            prompt_template: 已组装好的 prompt 文本

        Returns:
            GeminiVideoResponse 含 summary / segments / raw_response
        """
        # 延迟 import：骨架阶段不强制安装 google-genai
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.api_key)
        uploaded_file = client.files.upload(file=str(video_path))
        try:
            resp = client.models.generate_content(
                model=self.model,
                contents=[uploaded_file, prompt_template],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema={
                        "type": "object",
                        "properties": {
                            "summary": {"type": "string"},
                            "segments": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "start": {"type": "number"},
                                        "end": {"type": "number"},
                                        "text": {"type": "string"},
                                    },
                                    "required": ["start", "end", "text"],
                                },
                            },
                        },
                        "required": ["summary", "segments"],
                    },
                ),
            )
            data = json.loads(resp.text)
            return GeminiVideoResponse(
                summary=data.get("summary", ""),
                segments=data.get("segments", []),
                raw_response=data if isinstance(data, dict) else {},
            )
        finally:
            client.files.delete(name=uploaded_file.name)
