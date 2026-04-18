"""
NoteGenerator 笔记生成主流水线

复刻BiliNote的核心逻辑，整合nibi现有能力：
1. 下载器选择（优先无Cookie方案）
2. 字幕优先策略（避免音频下载+ASR）
3. GPT分片处理（长视频转写文本）
4. Markdown格式化（截图标记+跳转链接）
5. 结果持久化（SQLite + 文件系统）
6. SSE状态推送（实时进度反馈）
"""

import json
import logging
import re
import time
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict

# 直接导入同目录的临时下载器
try:
    from bilibili_nocookie_temp import BilibiliNoCookieDownloader, VideoMeta, TranscriptResult, DownloadQuality
except ImportError as e:
    print(f"导入错误: {e}")
    # 如果导入失败，使用占位符类
    class BilibiliNoCookieDownloader:
        pass
    class VideoMeta:
        pass
    class TranscriptResult:
        pass
    class DownloadQuality:
        fast = "fast"

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """任务状态枚举（对应BiliNote）"""
    PARSING = "PARSING"           # 解析URL
    DOWNLOADING = "DOWNLOADING"   # 下载媒体
    TRANSCRIBING = "TRANSCRIBING" # 转写字幕
    SUMMARIZING = "SUMMARIZING"   # GPT总结
    SAVING = "SAVING"            # 保存结果
    SUCCESS = "SUCCESS"          # 完成
    ERROR = "ERROR"              # 失败


@dataclass
class NoteGenerationTask:
    """笔记生成任务"""
    task_id: str
    video_url: str
    platform: str
    provider_id: str
    model_name: str

    # 生成选项
    style: str = "academic"           # academic/casual/highlights
    formats: List[str] = None        # ["link", "screenshot"]
    extras: List[str] = None         # ["web_enrich"]
    video_understanding: bool = False # 是否使用视频理解
    video_interval: int = 10         # 截图间隔（秒）

    # 任务状态
    status: TaskStatus = TaskStatus.PARSING
    progress: float = 0.0
    error_message: str = ""

    # 结果路径
    output_dir: str = ""
    audio_path: str = ""
    transcript_path: str = ""
    markdown_path: str = ""

    # 元信息
    video_meta: Optional[Any] = None  # VideoMeta类型，但用Any避免导入问题
    transcript_result: Optional[Any] = None  # TranscriptResult类型

    def __post_init__(self):
        if self.formats is None:
            self.formats = []
        if self.extras is None:
            self.extras = []


class DownloaderFactory:
    """下载器工厂 - 根据URL自动选择合适的下载器"""

    def __init__(self):
        self.downloaders = {}
        self._register_downloaders()

    def _register_downloaders(self):
        """注册所有可用的下载器"""
        # 注册B站无Cookie下载器
        self.downloaders['bilibili'] = BilibiliNoCookieDownloader

        # TODO: 注册其他下载器
        # self.downloaders['youtube'] = YoutubeNoCookieDownloader
        # self.downloaders['yt-dlp'] = YtDlpDownloader

    def get_platform(self, video_url: str) -> str:
        """根据URL识别平台"""
        url_lower = video_url.lower()

        if any(domain in url_lower for domain in ['bilibili.com', 'b23.tv']):
            return 'bilibili'
        elif any(domain in url_lower for domain in ['youtube.com', 'youtu.be']):
            return 'youtube'
        else:
            return 'unknown'

    def create_downloader(self, video_url: str) -> tuple[Any, str]:
        """创建合适的下载器实例"""
        platform = self.get_platform(video_url)

        if platform in self.downloaders:
            downloader_class = self.downloaders[platform]
            return downloader_class(), platform
        else:
            # 默认回退到yt-dlp（如果已实现）
            raise NotImplementedError(f"暂不支持平台: {platform}")


class NoteGenerator:
    """笔记生成器主类"""

    def __init__(self,
                 output_base: str = "./data/projects",
                 sse_callback: Optional[Callable[[str, Dict], None]] = None):
        """
        Args:
            output_base: 输出基础目录
            sse_callback: SSE状态推送回调函数
        """
        self.output_base = Path(output_base)
        self.downloader_factory = DownloaderFactory()
        self.sse_callback = sse_callback

        # TODO: 初始化其他组件
        # self.transcriber_factory = TranscriberFactory()
        # self.gpt_factory = GPTFactory()

    def _emit_status(self, task_id: str, status: TaskStatus,
                     progress: float = None, message: str = "",
                     data: Dict = None):
        """发送SSE状态更新"""
        if self.sse_callback:
            event_data = {
                "task_id": task_id,
                "status": status.value,
                "message": message,
                **(data or {})
            }
            if progress is not None:
                event_data["progress"] = progress

            self.sse_callback("task_status", event_data)

    def _setup_output_directory(self, task: NoteGenerationTask, project_id: str = "default"):
        """设置输出目录结构"""
        project_dir = self.output_base / project_id
        task_dir = project_dir / "note_results" / task.task_id

        # 创建目录结构
        task_dir.mkdir(parents=True, exist_ok=True)
        (task_dir / "screenshots").mkdir(exist_ok=True)

        task.output_dir = str(task_dir)

        # 设置文件路径
        safe_title = re.sub(r'[^\w\-_\.]', '_', task.video_meta.title)[:50] if task.video_meta else "unknown"
        base_name = f"{safe_title}_{task.task_id}"

        task.audio_path = str(task_dir / f"{base_name}.mp4")
        task.transcript_path = str(task_dir / f"{base_name}_transcript.json")
        task.markdown_path = str(task_dir / f"{base_name}_markdown.md")

    async def generate_note(self, task: NoteGenerationTask,
                          project_id: str = "default") -> Dict[str, Any]:
        """
        异步生成笔记主流程

        Returns:
            生成结果字典
        """
        try:
            # 1. 解析URL阶段
            self._emit_status(task.task_id, TaskStatus.PARSING, 0.1, "正在解析视频URL...")

            downloader, platform = self.downloader_factory.create_downloader(task.video_url)
            task.platform = platform

            # 获取视频元信息
            task.video_meta = downloader.get_meta(task.video_url)
            self._setup_output_directory(task, project_id)

            logger.info(f"视频解析成功: {task.video_meta.title} ({platform})")

            # 2. 下载阶段（字幕优先）
            self._emit_status(task.task_id, TaskStatus.DOWNLOADING, 0.2, "正在获取字幕...")

            # 优先尝试获取平台字幕
            task.transcript_result = downloader.download_subtitles(task.video_url, task.output_dir)

            if task.transcript_result:
                logger.info(f"字幕获取成功，共{len(task.transcript_result.segments)}个片段，跳过音频下载")
                self._emit_status(task.task_id, TaskStatus.DOWNLOADING, 0.5, "字幕获取成功，跳过音频下载")
                # 有字幕时直接跳到总结阶段
                self._emit_status(task.task_id, TaskStatus.SUMMARIZING, 0.8, "开始基于字幕生成笔记...")
            else:
                # 无字幕时才下载音频
                logger.info("无字幕，开始下载音频...")
                self._emit_status(task.task_id, TaskStatus.DOWNLOADING, 0.3, "正在下载音频...")

                audio_result = downloader.download(task.video_url, task.output_dir,
                                                 DownloadQuality.fast, need_video=False)
                task.audio_path = audio_result.file_path

                # 3. 转写阶段
                self._emit_status(task.task_id, TaskStatus.TRANSCRIBING, 0.6, "正在进行语音转写...")

                # TODO: 调用ASR服务
                # task.transcript_result = await self._transcribe_audio(task.audio_path)

                # 暂时创建虚拟转写结果进行测试
                task.transcript_result = type('TranscriptResult', (), {
                    'language': 'zh',
                    'full_text': '这是一个测试转写结果，实际应该从ASR服务获取。',
                    'segments': []
                })()

                self._emit_status(task.task_id, TaskStatus.SUMMARIZING, 0.8, "正在生成笔记...")

            # 保存转写结果
            with open(task.transcript_path, 'w', encoding='utf-8') as f:
                transcript_data = {
                    "language": getattr(task.transcript_result, 'language', 'unknown'),
                    "full_text": getattr(task.transcript_result, 'full_text', ''),
                    "segments": [
                        {
                            "start": seg.start,
                            "end": seg.end,
                            "text": seg.text
                        } for seg in getattr(task.transcript_result, 'segments', [])
                    ]
                }
                json.dump(transcript_data, f, ensure_ascii=False, indent=2)

            # 4. 总结阶段
            self._emit_status(task.task_id, TaskStatus.SUMMARIZING, 0.8, "正在生成笔记...")

            # TODO: 调用GPT分片处理
            # markdown_content = await self._generate_markdown(task)
            title = getattr(task.video_meta, 'title', 'Unknown Title')
            author = getattr(task.video_meta, 'author', 'Unknown Author')
            duration = getattr(task.video_meta, 'duration', 0)
            full_text = getattr(task.transcript_result, 'full_text', '')

            markdown_content = f"""# {title}

**作者**: {author}
**时长**: {duration}秒
**平台**: {task.platform}

## 内容摘要

{full_text[:500]}...

> 注：完整GPT处理功能开发中

## 原文转写

{full_text}
"""

            # 保存Markdown
            with open(task.markdown_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

            # 5. 完成
            task.status = TaskStatus.SUCCESS
            task.progress = 1.0

            self._emit_status(task.task_id, TaskStatus.SUCCESS, 1.0, "笔记生成完成！", {
                "markdown_path": task.markdown_path,
                "transcript_path": task.transcript_path
            })

            return {
                "success": True,
                "task_id": task.task_id,
                "markdown_path": task.markdown_path,
                "transcript_path": task.transcript_path,
                "video_meta": {
                    "title": title,
                    "author": author,
                    "duration": duration,
                    "platform": task.platform
                }
            }

        except Exception as e:
            task.status = TaskStatus.ERROR
            task.error_message = str(e)

            self._emit_status(task.task_id, TaskStatus.ERROR, None, f"生成失败: {e}")

            logger.error(f"笔记生成失败 (task_id={task.task_id}): {e}")

            return {
                "success": False,
                "task_id": task.task_id,
                "error": str(e)
            }

    def generate_note_sync(self, task: NoteGenerationTask,
                          project_id: str = "default") -> Dict[str, Any]:
        """同步版本的笔记生成（用于测试）"""
        # 将异步方法转为同步执行
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(self.generate_note(task, project_id))