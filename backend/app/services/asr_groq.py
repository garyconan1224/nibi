from __future__ import annotations

"""Groq ASR client (OpenAI-compatible transcription endpoint)."""

import json
import tempfile
from pathlib import Path

import requests


def transcribe_with_groq(audio_bytes: bytes, *, api_key: str, model: str = "whisper-large-v3") -> str:
    if not api_key.strip():
        raise ValueError("GROQ_API_KEY is required")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)
    try:
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {api_key.strip()}"}
        with tmp_path.open("rb") as f:
            files = {"file": (tmp_path.name, f, "audio/mpeg")}
            data = {"model": model}
            resp = requests.post(url, headers=headers, files=files, data=data, timeout=120)
        if resp.status_code >= 400:
            try:
                detail = resp.json()
            except json.JSONDecodeError:
                detail = resp.text
            raise RuntimeError(f"Groq ASR failed: HTTP {resp.status_code} {detail}")
        payload = resp.json()
        return str(payload.get("text") or "").strip()
    finally:
        tmp_path.unlink(missing_ok=True)
