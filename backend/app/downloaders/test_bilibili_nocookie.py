#!/usr/bin/env python3
"""
测试B站无Cookie下载器

运行方式：
cd /Users/conan/Desktop/nibi
python backend/app/downloaders/test_bilibili_nocookie.py
"""

#!/usr/bin/env python3
import sys
import os

# 添加当前文件所在目录到路径，直接导入同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 直接导入同目录的模块
from bilibili_nocookie import BilibiliNoCookieDownloader, extract_bvid_from_url

def test_extract_bvid():
    """测试BVID提取"""
    print("=== 测试BVID提取 ===")

    test_urls = [
        "https://www.bilibili.com/video/BV1xx411c7mu",
        "https://www.bilibili.com/video/BV1xx411c7mu/",
        "https://b23.tv/BV1xx411c7mu",
        "BV1xx411c7mu"
    ]

    for url in test_urls:
        bvid = extract_bvid_from_url(url)
        print(f"URL: {url} -> BVID: {bvid}")
    print()

def test_get_meta():
    """测试获取视频元信息"""
    print("=== 测试获取视频元信息 ===")

    # 使用一个知名的B站视频（确保存在）
    test_url = "https://www.bilibili.com/video/BV1xx411c7mu"  # 可以替换为任意存在的BVID

    try:
        downloader = BilibiliNoCookieDownloader()
        meta = downloader.get_meta(test_url)

        print(f"标题: {meta.title}")
        print(f"作者: {meta.author}")
        print(f"时长: {meta.duration}秒")
        print(f"播放量: {meta.view_count}")
        print(f"上传日期: {meta.upload_date}")
        print(f"标签: {meta.tags[:3]}...")  # 只显示前3个标签
        print(f"视频ID: {meta.video_id}")
        print("✅ 元信息获取成功")
    except Exception as e:
        print(f"❌ 元信息获取失败: {e}")
    print()

def test_download_subtitles():
    """测试字幕下载"""
    print("=== 测试字幕下载 ===")

    # 使用一个有字幕的视频进行测试
    test_url = "https://www.bilibili.com/video/BV1xx411c7mu"

    try:
        downloader = BilibiliNoCookieDownloader()
        transcript = downloader.download_subtitles(test_url)

        if transcript:
            print(f"语言: {transcript.language}")
            print(f"片段数: {len(transcript.segments)}")
            print(f"总文本长度: {len(transcript.full_text)}")
            print("前3个片段:")
            for i, seg in enumerate(transcript.segments[:3]):
                print(f"  {i+1}. {seg.start:.1f}s-{seg.end:.1f}s: {seg.text}")
            print("✅ 字幕获取成功")
        else:
            print("⚠️ 该视频无字幕")
    except Exception as e:
        print(f"❌ 字幕获取失败: {e}")
    print()

if __name__ == "__main__":
    print("🧪 B站无Cookie下载器测试开始\n")

    test_extract_bvid()
    test_get_meta()
    test_download_subtitles()

    print("🧪 测试完成")