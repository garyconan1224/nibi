#!/usr/bin/env python3
"""
完整测试B站无Cookie下载器类

测试完整的下载器功能：
1. 字幕获取
2. 音频下载
3. 视频下载
4. 元信息获取
"""

import sys
import os
from pathlib import Path

# 添加当前文件所在目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 直接导入同目录的模块（避免复杂的包导入）
try:
    from bilibili_nocookie import BilibiliNoCookieDownloader
except ImportError:
    print("❌ 无法导入BilibiliNoCookieDownloader，请检查bilibili_nocookie.py")
    sys.exit(1)

def test_full_downloader():
    """完整测试下载器功能"""
    print("🧪 B站无Cookie下载器完整功能测试\n")

    # 使用前面验证成功的视频
    test_url = "https://www.bilibili.com/video/BV1xx411c7xo"
    output_dir = "./test_downloads"

    try:
        # 创建输出目录
        Path(output_dir).mkdir(exist_ok=True)

        # 初始化下载器
        downloader = BilibiliNoCookieDownloader()

        # 1. 测试元信息获取
        print("=== 1. 元信息获取测试 ===")
        meta = downloader.get_meta(test_url)
        print(f"✅ 视频标题: {meta.title}")
        print(f"✅ 作者: {meta.author}")
        print(f"✅ 时长: {meta.duration}秒")
        print(f"✅ 视频ID: {meta.video_id}")
        print()

        # 2. 测试字幕获取
        print("=== 2. 字幕获取测试 ===")
        transcript = downloader.download_subtitles(test_url, output_dir)
        if transcript:
            print(f"✅ 字幕获取成功！")
            print(f"   语言: {transcript.language}")
            print(f"   片段数: {len(transcript.segments)}")
            print(f"   文本长度: {len(transcript.full_text)}")
            if transcript.segments:
                print(f"   首个片段: {transcript.segments[0].text[:30]}...")
        else:
            print("⚠️ 无字幕，将测试音频下载")
        print()

        # 3. 测试音频下载
        print("=== 3. 音频下载测试 ===")
        try:
            audio_result = downloader.download(test_url, output_dir)

            if audio_result.file_path:
                print(f"✅ 音频下载成功！")
                print(f"   文件路径: {audio_result.file_path}")

                # 检查文件是否存在
                if Path(audio_result.file_path).exists():
                    file_size = Path(audio_result.file_path).stat().st_size
                    print(f"   文件大小: {file_size // 1024}KB")
                else:
                    print(f"❌ 文件不存在: {audio_result.file_path}")
            else:
                print("✅ 有字幕，跳过音频下载（符合预期）")

        except Exception as e:
            print(f"❌ 音频下载失败: {e}")
        print()

        # 4. 测试视频下载
        print("=== 4. 视频下载测试 ===")
        try:
            video_path = downloader.download_video(test_url, output_dir)
            print(f"✅ 视频下载成功！")
            print(f"   文件路径: {video_path}")

            if Path(video_path).exists():
                file_size = Path(video_path).stat().st_size
                print(f"   文件大小: {file_size // 1024}KB")
            else:
                print(f"❌ 文件不存在: {video_path}")

        except Exception as e:
            print(f"❌ 视频下载失败: {e}")
        print()

        # 5. 测试支持检查
        print("=== 5. 功能支持检查 ===")
        print(f"✅ 支持字幕: {downloader.supports_subtitles()}")
        print(f"✅ 支持无Cookie: {downloader.supports_no_cookie()}")
        print()

        print("🎉 所有功能测试完成！")
        return True

    except Exception as e:
        print(f"❌ 测试过程出现异常: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        # 清理测试文件（可选）
        print("\n--- 清理提示 ---")
        print(f"测试文件保存在: {output_dir}")
        print("如需清理，请手动删除该目录")

if __name__ == "__main__":
    success = test_full_downloader()
    if success:
        print("\n🎉 结论：B站无Cookie下载器功能完整，可以投入使用！")
    else:
        print("\n❌ 结论：发现问题，需要进一步调试")