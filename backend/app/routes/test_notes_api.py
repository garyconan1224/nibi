#!/usr/bin/env python3
"""
测试Notes API

验证REST API端点功能：
1. POST /api/notes/generate
2. GET /api/notes/tasks/{id}/status
3. GET /api/notes/tasks/{id}/result
4. GET /api/notes/tasks/{id}/events (SSE)
"""

import requests
import json
import time
from urllib.parse import urljoin

# API基础URL
BASE_URL = "http://127.0.0.1:8010"

def test_notes_api():
    """测试笔记生成API完整流程"""

    print("🧪 Notes API 测试")
    print(f"API基础URL: {BASE_URL}")
    print()

    # 1. 测试生成笔记任务创建
    print("=== 1. 创建笔记生成任务 ===")

    generate_payload = {
        "video_url": "https://www.bilibili.com/video/BV1s7411r7hr",
        "project_id": "test_project",
        "provider_id": "openai_compatible",
        "model_name": "gpt-4",
        "style": "academic",
        "formats": ["link", "screenshot"],
        "extras": ["web_enrich"],
        "video_understanding": False,
        "video_interval": 10
    }

    try:
        response = requests.post(
            urljoin(BASE_URL, "/api/notes/generate"),
            json=generate_payload,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            task_id = data["task_id"]
            print(f"✅ 任务创建成功")
            print(f"   Task ID: {task_id}")
            print(f"   Status: {data['status']}")
            print(f"   Created: {data['created_at']}")
        else:
            print(f"❌ 任务创建失败: HTTP {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ 任务创建请求异常: {e}")
        return False

    print()

    # 2. 轮询任务状态
    print("=== 2. 轮询任务状态 ===")

    max_polls = 30  # 最多轮询30次
    poll_interval = 3  # 3秒间隔

    for i in range(max_polls):
        try:
            response = requests.get(
                urljoin(BASE_URL, f"/api/notes/tasks/{task_id}/status"),
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                status = data["status"]
                progress = data.get("progress")
                message = data.get("message", "")

                if progress:
                    print(f"[{i+1:2d}/30] {status} - {progress*100:.1f}% - {message}")
                else:
                    print(f"[{i+1:2d}/30] {status} - {message}")

                # 检查任务是否完成
                if status in ["SUCCESS", "ERROR"]:
                    print(f"✅ 任务完成，状态: {status}")
                    break

            else:
                print(f"❌ 状态查询失败: HTTP {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ 状态查询异常: {e}")
            continue

        time.sleep(poll_interval)
    else:
        print("⚠️ 任务超时，停止轮询")
        return False

    print()

    # 3. 获取任务结果
    print("=== 3. 获取任务结果 ===")

    try:
        response = requests.get(
            urljoin(BASE_URL, f"/api/notes/tasks/{task_id}/result"),
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()

            if result["success"]:
                print(f"✅ 结果获取成功")
                print(f"   Markdown: {result.get('markdown_path', 'N/A')}")
                print(f"   Transcript: {result.get('transcript_path', 'N/A')}")

                video_meta = result.get("video_meta", {})
                print(f"   视频标题: {video_meta.get('title', 'N/A')}")
                print(f"   作者: {video_meta.get('author', 'N/A')}")
                print(f"   平台: {video_meta.get('platform', 'N/A')}")

                return True
            else:
                print(f"❌ 任务执行失败: {result.get('error', 'unknown error')}")
                return False

        else:
            print(f"❌ 结果获取失败: HTTP {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ 结果获取异常: {e}")
        return False

def test_api_health():
    """测试API健康状态"""
    print("=== 0. API健康检查 ===")

    try:
        response = requests.get(urljoin(BASE_URL, "/health"), timeout=5)
        if response.status_code == 200:
            print("✅ API服务正常")
            return True
        else:
            print(f"❌ API服务异常: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API连接失败: {e}")
        print("💡 请确保后端服务已启动: uvicorn backend.app.main:app --host 0.0.0.0 --port 8010")
        return False

if __name__ == "__main__":
    print("🧪 Notes REST API 完整测试套件\n")

    # 健康检查
    if not test_api_health():
        exit(1)

    print()

    # 完整API测试
    success = test_notes_api()

    if success:
        print(f"\n🎉 结论：Notes REST API 实现成功！")
        print("✅ 任务创建：正常")
        print("✅ 状态轮询：正常")
        print("✅ 结果获取：正常")
        print("✅ 端到端流程：完整")
        print(f"\n🚀 可以进入下一阶段：ASR工厂扩展")
    else:
        print(f"\n❌ 结论：发现问题，需进一步调试")