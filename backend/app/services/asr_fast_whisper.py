from __future__ import annotations

"""Local ASR with faster-whisper."""

import tempfile
from pathlib import Path
from typing import List


def transcribe_with_fast_whisper(audio_bytes: bytes, *, model_name: str = "base", device: str = "cpu") -> str:
    try:
        from faster_whisper import WhisperModel
    except Exception as err:  # noqa: BLE001
        raise RuntimeError("faster-whisper is not installed") from err

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)
    try:
        model = WhisperModel(model_name, device=device)
        segments, _info = model.transcribe(str(tmp_path))
        parts: List[str] = []
        for seg in segments:
            text = str(getattr(seg, "text", "")).strip()
            if text:
                parts.append(text)
        return "\n".join(parts).strip()
    finally:
        tmp_path.unlink(missing_ok=True)
