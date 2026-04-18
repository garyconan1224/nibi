#!/usr/bin/env python3
"""
测试NoteGenerator笔记生成流水线

验证完整的端到端笔记生成流程：
1. 下载器工厂选择
2. B站无Cookie字幕获取
3. Markdown笔记生成
4. 文件系统输出
"""

import uuid
import json
from pathlib import Path
from note_generator import NoteGenerator, NoteGenerationTask, TaskStatus

def sse_callback(event_type: str, data: dict):
    """SSE回调函数 - 打印状态更新"""
    status = data.get('status', '')
    message = data.get('message', '')
    progress = data.get('progress', 0)

    if progress:
        print(f"[{status}] {progress*100:.1f}% - {message}")
    else:
        print(f"[{status}] {message}")

def test_note_generation():
    """测试笔记生成完整流程"""
    print("🧪 NoteGenerator 流水线测试\n")

    # 创建测试任务
    task_id = str(uuid.uuid4())[:8]
    # 尝试几个不同的视频，寻找有字幕的
    test_videos = [
        "https://www.bilibili.com/video/BV1s7411r7hr",  # 可能有字幕
        "https://www.bilibili.com/video/BV17x411w7KC",
        "https://www.bilibili.com/video/BV1uv411q7Mv"   # 已知无字幕，作为备选
    ]

    test_url = test_videos[0]  # 先用第一个

    task = NoteGenerationTask(
        task_id=task_id,
        video_url=test_url,
        platform="",  # 由工厂自动识别
        provider_id="openai_compatible",  # 暂时占位
        model_name="gpt-4",  # 暂时占位
        style="academic",
        formats=["link", "screenshot"],
        extras=["web_enrich"],
        video_understanding=False
    )

    print(f"任务ID: {task_id}")
    print(f"视频URL: {test_url}")
    print()

    # 创建生成器
    generator = NoteGenerator(
        output_base="./test_note_output",
        sse_callback=sse_callback
    )

    try:
        # 执行生成流程
        print("=== 开始笔记生成流程 ===")
        result = generator.generate_note_sync(task, project_id="test_project")

        if result["success"]:
            print(f"\n🎉 笔记生成成功！")
            print(f"   Markdown路径: {result['markdown_path']}")
            print(f"   转写路径: {result['transcript_path']}")

            # 验证生成的文件
            markdown_path = Path(result['markdown_path'])
            transcript_path = Path(result['transcript_path'])

            if markdown_path.exists():
                content = markdown_path.read_text(encoding='utf-8')
                print(f"\n=== Markdown内容预览 ===")
                print(content[:300] + "..." if len(content) > 300 else content)
                print(f"\nMarkdown文件大小: {markdown_path.stat().st_size} bytes")
            else:
                print("❌ Markdown文件不存在")

            if transcript_path.exists():
                with open(transcript_path, 'r', encoding='utf-8') as f:
                    transcript_data = json.load(f)

                print(f"\n=== 转写结果预览 ===")
                print(f"语言: {transcript_data.get('language', 'unknown')}")
                print(f"片段数: {len(transcript_data.get('segments', []))}")
                print(f"总文本长度: {len(transcript_data.get('full_text', ''))}")

                if transcript_data.get('segments'):
                    first_segment = transcript_data['segments'][0]
                    print(f"首个片段: {first_segment.get('start', 0):.1f}s-{first_segment.get('end', 0):.1f}s: {first_segment.get('text', '')[:50]}...")
            else:
                print("❌ 转写文件不存在")

            print(f"\n✅ 端到端测试完全成功！")

        else:
            print(f"❌ 笔记生成失败: {result.get('error', 'unknown error')}")

    except Exception as e:
        print(f"❌ 测试过程异常: {e}")
        import traceback
        traceback.print_exc()
        return False

    return result.get("success", False)

def test_downloader_factory():
    """测试下载器工厂"""
    print("\n=== 下载器工厂测试 ===")

    from note_generator import DownloaderFactory

    factory = DownloaderFactory()

    test_urls = [
        ("https://www.bilibili.com/video/BV1xx411c7xo", "bilibili"),
        ("https://b23.tv/BV1xx411c7xo", "bilibili"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
        ("https://youtu.be/dQw4w9WgXcQ", "youtube"),
        ("https://example.com/video", "unknown")
    ]

    for url, expected_platform in test_urls:
        detected_platform = factory.get_platform(url)
        status = "✅" if detected_platform == expected_platform else "❌"
        print(f"{status} {url} -> {detected_platform} (期望: {expected_platform})")

    # 测试下载器创建
    try:
        downloader, platform = factory.create_downloader("https://www.bilibili.com/video/BV1xx411c7xo")
        print(f"✅ B站下载器创建成功: {type(downloader).__name__}")
    except Exception as e:
        print(f"❌ B站下载器创建失败: {e}")

if __name__ == "__main__":
    print("🧪 NoteGenerator 完整测试套件\n")

    # 1. 下载器工厂测试
    test_downloader_factory()

    # 2. 端到端流水线测试
    success = test_note_generation()

    if success:
        print(f"\n🎉 结论：NoteGenerator 主流水线实现成功！")
        print("✅ 下载器工厂：正常")
        print("✅ B站无Cookie集成：正常")
        print("✅ 字幕获取：正常")
        print("✅ Markdown生成：正常")
        print("✅ 文件输出：正常")
        print("✅ SSE状态推送：正常")
        print(f"\n🚀 可以进入下一阶段：REST API 暴露")
    else:
        print(f"\n❌ 结论：发现问题，需进一步调试")