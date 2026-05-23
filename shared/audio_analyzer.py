"""音频分析工具集（N8，SPEC §5）。

提供给 `handle_audio_task` 的可独立测试的纯函数 / 数据类：
- VAD：silero-vad 检测人声片段
- 说话人分离：pyannote.audio（缺包 / 缺 HF_TOKEN 时 graceful skip）
- 音乐分析：librosa BPM / 调性 / 能量曲线
- 音乐提示词：LLM 根据特征生成 Suno/Udio 通用格式
- 字幕导出：transcript_segments → .srt / .txt

所有重模型都 lazy import，让导入本模块不会触发 torch 启动。
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── 数据类 ────────────────────────────────────────────────────


@dataclass
class VadSegment:
    start: float  # 秒
    end: float


@dataclass
class VadResult:
    has_speech: bool
    segments: List[VadSegment] = field(default_factory=list)
    total_speech_duration: float = 0.0
    total_duration: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "has_speech": self.has_speech,
            "segments": [{"start": s.start, "end": s.end} for s in self.segments],
            "total_speech_duration": round(self.total_speech_duration, 2),
            "total_duration": round(self.total_duration, 2),
        }


@dataclass
class SpeakerSegment:
    start: float
    end: float
    speaker: str  # e.g. "SPEAKER_00"


@dataclass
class DiarizationResult:
    num_speakers: int
    segments: List[SpeakerSegment] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "num_speakers": self.num_speakers,
            "segments": [
                {"start": s.start, "end": s.end, "speaker": s.speaker}
                for s in self.segments
            ],
        }


@dataclass
class MusicAnalysis:
    duration: float
    bpm: float
    key: str  # e.g. "C major"
    energy_mean: float  # RMS 均值
    spectral_centroid_mean: float  # 大致音色亮度
    music_prompt: str = ""
    similar_references: List[str] = field(default_factory=list)
    scenarios: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "duration": round(self.duration, 2),
            "bpm": round(self.bpm, 1),
            "key": self.key,
            "energy_mean": round(self.energy_mean, 4),
            "spectral_centroid_mean": round(self.spectral_centroid_mean, 1),
            "music_prompt": self.music_prompt,
            "similar_references": list(self.similar_references),
            "scenarios": list(self.scenarios),
        }


# ── VAD ───────────────────────────────────────────────────────


def run_vad(audio_path: Path, sampling_rate: int = 16000) -> VadResult:
    """silero-vad 跑人声活动检测。

    没装 silero-vad 时返回 has_speech=True（保守假设，不阻塞 ASR）。
    """
    try:
        from silero_vad import get_speech_timestamps, load_silero_vad, read_audio
    except ImportError:
        logger.warning("silero-vad 未安装，跳过 VAD 检测，按有人声继续")
        return VadResult(has_speech=True, total_duration=0.0)

    try:
        model = load_silero_vad()
        wav = read_audio(str(audio_path), sampling_rate=sampling_rate)
        total = float(len(wav)) / sampling_rate
        ts = get_speech_timestamps(wav, model, sampling_rate=sampling_rate)
    except Exception as err:
        logger.warning(f"silero-vad 调用失败：{err}；按有人声继续")
        return VadResult(has_speech=True, total_duration=0.0)

    segments = [
        VadSegment(start=t["start"] / sampling_rate, end=t["end"] / sampling_rate)
        for t in ts
    ]
    speech_dur = sum(s.end - s.start for s in segments)
    return VadResult(
        has_speech=bool(segments),
        segments=segments,
        total_speech_duration=speech_dur,
        total_duration=total,
    )


# ── 说话人分离 ────────────────────────────────────────────────


def run_diarization(audio_path: Path) -> Optional[DiarizationResult]:
    """pyannote.audio 说话人分离。

    任何一个条件不满足都返回 None（不抛错）：
    - pyannote.audio 没装
    - HF_TOKEN / HUGGINGFACE_TOKEN 环境变量没设
    - 模型加载/推理失败（一般是没同意模型协议）
    """
    token = (
        os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGINGFACE_TOKEN")
        or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    )
    if not token:
        logger.warning(
            "未检测到 HF_TOKEN 环境变量，跳过说话人分离。"
            "请去 https://huggingface.co/pyannote/speaker-diarization-3.1 同意协议后 export HF_TOKEN=..."
        )
        return None

    try:
        from pyannote.audio import Pipeline  # type: ignore
    except ImportError:
        logger.warning("pyannote.audio 未安装，跳过说话人分离")
        return None

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=token,
        )
        diarization = pipeline(str(audio_path))
    except Exception as err:
        logger.warning(
            f"pyannote 加载/推理失败：{err}；跳过说话人分离。"
            "常见原因：未同意模型协议 / 网络问题 / 显存不足"
        )
        return None

    segments: List[SpeakerSegment] = []
    speakers = set()
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append(
            SpeakerSegment(start=float(turn.start), end=float(turn.end), speaker=str(speaker))
        )
        speakers.add(str(speaker))
    return DiarizationResult(num_speakers=len(speakers), segments=segments)


# ── 音乐分析 ──────────────────────────────────────────────────


_KEY_PROFILES = [
    # Krumhansl-Schmuckler key 估计的简化版（major / minor）
    "C major", "C# major", "D major", "D# major", "E major", "F major",
    "F# major", "G major", "G# major", "A major", "A# major", "B major",
    "C minor", "C# minor", "D minor", "D# minor", "E minor", "F minor",
    "F# minor", "G minor", "G# minor", "A minor", "A# minor", "B minor",
]


def analyze_music(audio_path: Path) -> Optional[MusicAnalysis]:
    """librosa 跑基础音乐特征。

    没装 librosa 时返回 None。
    """
    try:
        import librosa  # type: ignore
        import numpy as np
    except ImportError:
        logger.warning("librosa 未安装，跳过音乐分析")
        return None

    try:
        y, sr = librosa.load(str(audio_path), sr=None, mono=True)
        duration = float(librosa.get_duration(y=y, sr=sr))
        tempo_raw, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(np.atleast_1d(tempo_raw)[0])
        rms = float(np.mean(librosa.feature.rms(y=y)))
        centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        # 调性估计：chroma + 简单匹配
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = chroma.mean(axis=1)
        key_idx = int(np.argmax(chroma_mean))
        # major / minor 简化判定：相对小调位置（key - 3）能量是否更高
        minor_idx = (key_idx - 3) % 12
        is_minor = chroma_mean[minor_idx] > chroma_mean[key_idx] * 0.95
        key_name = _KEY_PROFILES[key_idx + (12 if is_minor else 0)]
    except Exception as err:
        logger.warning(f"librosa 音乐分析失败：{err}")
        return None

    return MusicAnalysis(
        duration=duration,
        bpm=tempo,
        key=key_name,
        energy_mean=rms,
        spectral_centroid_mean=centroid,
    )


# ── LLM 生成音乐提示词 ────────────────────────────────────────


def generate_music_prompt(
    features: MusicAnalysis,
    llm_caller: Any,  # 形如 (system, user) -> str
) -> MusicAnalysis:
    """让 LLM 根据 librosa 特征生成 Suno/Udio 通用提示词 + 相似曲风 + 适用场景。

    llm_caller 必须是可调用对象 (system: str, user: str) -> str；调用方决定怎么接 SDK。
    """
    system = (
        "You are a music director who writes Suno/Udio-compatible music generation prompts. "
        "Given basic acoustic features, infer style/mood and produce: (1) one-line music prompt "
        "in English (genre, instruments, mood, bpm, key), (2) 2-3 similar reference artists, "
        "(3) 2-3 typical usage scenarios in Chinese."
    )
    user = (
        f"Features:\n"
        f"- duration: {features.duration:.1f}s\n"
        f"- bpm: {features.bpm:.1f}\n"
        f"- key: {features.key}\n"
        f"- energy(RMS mean): {features.energy_mean:.4f}\n"
        f"- spectral_centroid(brightness): {features.spectral_centroid_mean:.1f}\n\n"
        f"Output JSON only with keys: music_prompt, similar_references (list), scenarios (list)."
    )
    try:
        raw = llm_caller(system, user)
        parsed = _parse_music_prompt_json(raw)
        if parsed:
            features.music_prompt = str(parsed.get("music_prompt") or "")
            features.similar_references = list(parsed.get("similar_references") or [])
            features.scenarios = list(parsed.get("scenarios") or [])
    except Exception as err:
        logger.warning(f"音乐提示词 LLM 调用失败：{err}")
    return features


def _parse_music_prompt_json(text: str) -> Optional[Dict[str, Any]]:
    """容错 JSON 解析：抓第一个 {...} 块。"""
    import json
    import re

    text = (text or "").strip()
    if not text:
        return None
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


# ── 字幕导出 ──────────────────────────────────────────────────


def export_srt(
    segments: List[Dict[str, Any]],
    speaker_map: Optional[Dict[Tuple[float, float], str]] = None,
) -> str:
    """transcript_segments → .srt 字符串。

    每个 segment 必须含 start / end / text；可选 speaker。speaker_map 用 (start,end) 元组覆盖。
    """
    lines: List[str] = []
    for i, seg in enumerate(segments, start=1):
        try:
            start = float(seg.get("start") or 0.0)
            end = float(seg.get("end") or start)
        except (TypeError, ValueError):
            continue
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        speaker = None
        if speaker_map is not None:
            speaker = speaker_map.get((start, end))
        if speaker is None:
            speaker = seg.get("speaker")
        line_text = f"[{speaker}] {text}" if speaker else text
        lines.append(str(i))
        lines.append(f"{_fmt_srt_time(start)} --> {_fmt_srt_time(end)}")
        lines.append(line_text)
        lines.append("")
    return "\n".join(lines)


def export_txt(
    segments: List[Dict[str, Any]],
    with_speaker: bool = False,
) -> str:
    lines: List[str] = []
    for seg in segments:
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        if with_speaker and seg.get("speaker"):
            lines.append(f"[{seg['speaker']}] {text}")
        else:
            lines.append(text)
    return "\n".join(lines)


def export_vtt(
    segments: List[Dict[str, Any]],
    speaker_map: Optional[Dict[Tuple[float, float], str]] = None,
) -> str:
    """transcript_segments → WebVTT 字符串。"""
    lines: List[str] = ["WEBVTT", ""]
    for seg in segments:
        try:
            start = float(seg.get("start") or 0.0)
            end = float(seg.get("end") or start)
        except (TypeError, ValueError):
            continue
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        speaker = None
        if speaker_map is not None:
            speaker = speaker_map.get((start, end))
        if speaker is None:
            speaker = seg.get("speaker")
        line_text = f"<v {speaker}>{text}</v>" if speaker else text
        lines.append(f"{_fmt_vtt_time(start)} --> {_fmt_vtt_time(end)}")
        lines.append(line_text)
        lines.append("")
    return "\n".join(lines)


def export_ass(
    segments: List[Dict[str, Any]],
    title: str = "Nibi Export",
    speaker_map: Optional[Dict[Tuple[float, float], str]] = None,
) -> str:
    """transcript_segments → ASS (Advanced SubStation Alpha) 字符串。"""
    header = _ASS_HEADER.format(title=title)
    lines: List[str] = [header]
    for seg in segments:
        try:
            start = float(seg.get("start") or 0.0)
            end = float(seg.get("end") or start)
        except (TypeError, ValueError):
            continue
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        speaker = None
        if speaker_map is not None:
            speaker = speaker_map.get((start, end))
        if speaker is None:
            speaker = seg.get("speaker")
        line_text = f"{speaker}: {text}" if speaker else text
        lines.append(f"Dialogue: 0,{_fmt_ass_time(start)},{_fmt_ass_time(end)},Default,,0,0,0,,{line_text}")
    return "\n".join(lines)


_ASS_HEADER = """[Script Info]
Title: {title}
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 384
PlayResY: 288

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""


def _fmt_srt_time(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    ms = int(round((sec - int(sec)) * 1000))
    s_total = int(sec)
    h = s_total // 3600
    m = (s_total % 3600) // 60
    s = s_total % 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _fmt_vtt_time(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    ms = int(round((sec - int(sec)) * 1000))
    s_total = int(sec)
    h = s_total // 3600
    m = (s_total % 3600) // 60
    s = s_total % 60
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _fmt_ass_time(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    cs = int(round((sec - int(sec)) * 100))
    s_total = int(sec)
    h = s_total // 3600
    m = (s_total % 3600) // 60
    s = s_total % 60
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


# ── 把说话人 segments 映射到 transcript segments ──────────────


def assign_speakers_to_segments(
    transcript_segments: List[Dict[str, Any]],
    diarization: DiarizationResult,
) -> List[Dict[str, Any]]:
    """给每条 transcript_segment 标 speaker（按最大时间重叠）。

    返回新 list（不修改原 segments）。
    """
    enriched: List[Dict[str, Any]] = []
    for seg in transcript_segments:
        try:
            s = float(seg.get("start") or 0.0)
            e = float(seg.get("end") or s)
        except (TypeError, ValueError):
            enriched.append(dict(seg))
            continue
        best: Tuple[float, str] = (0.0, "")
        for sp in diarization.segments:
            overlap = max(0.0, min(e, sp.end) - max(s, sp.start))
            if overlap > best[0]:
                best = (overlap, sp.speaker)
        out = dict(seg)
        if best[1]:
            out["speaker"] = best[1]
        enriched.append(out)
    return enriched
