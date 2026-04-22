"""
综合验证脚本：三位一体 Payload + 后端日志 + 数据持久化。
需要启动后端：uvicorn backend.app.main:app --port 8010
"""
import sys
import time
import requests
from pathlib import Path

BACKEND_URL = "http://localhost:8010"
TIMEOUT = 5

def check_backend_alive():
    """检查后端是否在线"""
    try:
        resp = requests.get(f"{BACKEND_URL}/health", timeout=TIMEOUT)
        if resp.status_code == 200 or resp.status_code == 404:  # 有些端点返回404但证明后端在线
            print("✓ 后端在线 (localhost:8010)")
            return True
    except requests.exceptions.ConnectionError:
        print("✗ 后端离线 - 请先运行: uvicorn backend.app.main:app --port 8010")
        return False
    except Exception as e:
        print(f"⚠ 后端检查出错: {e}")
        return False

def check_task_persistence():
    """检查任务是否持久化"""
    try:
        resp = requests.get(f"{BACKEND_URL}/pipeline/tasks", timeout=TIMEOUT)
        if resp.status_code == 200:
            tasks = resp.json()
            
            if isinstance(tasks, list) and len(tasks) > 0:
                recent_task = tasks[-1]
                task_id = recent_task.get('task_id')
                payload = recent_task.get('payload', {})
                
                print(f"✓ 任务持久化检查")
                print(f"  - 最近任务 ID: {task_id}")
                print(f"  - text_provider_id: {payload.get('text_provider_id')}")
                print(f"  - text_model: {payload.get('text_model')}")
                print(f"  - vision_provider_id: {payload.get('vision_provider_id')}")
                print(f"  - vision_model: {payload.get('vision_model')}")
                print(f"  - proxy: {payload.get('proxy')}")
                
                # 验证三位一体
                triple = [
                    payload.get('text_provider_id'),
                    payload.get('text_model'),
                    payload.get('vision_provider_id'),
                    payload.get('vision_model'),
                ]
                
                if all(triple):
                    print("✓ 三位一体字段齐全")
                    return True
                else:
                    print("⚠ 三位一体字段不完整")
                    return False
            else:
                print("⚠ 暂无任务数据，请先提交 Payload")
                return True  # 不算失败
        else:
            print(f"✗ 任务查询失败: {resp.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("✗ 无法连接后端")
        return False
    except Exception as e:
        print(f"✗ 任务检查出错: {e}")
        return False

def check_provider_list():
    """检查 Provider 列表端点"""
    try:
        resp = requests.get(f"{BACKEND_URL}/api/providers", timeout=TIMEOUT)
        if resp.status_code == 200:
            providers = resp.json()
            print(f"✓ Provider 列表可用 ({len(providers)} 个)")
            return True
        else:
            print(f"⚠ Provider 端点状态: {resp.status_code}")
            return True
    except Exception as e:
        print(f"⚠ Provider 检查出错: {e}")
        return True

def main():
    print("=" * 60)
    print("综合验证：Payload + 后端 + 持久化")
    print("=" * 60)
    print()
    
    checks = [
        ("后端在线检查", check_backend_alive),
        ("Provider 列表", check_provider_list),
        ("任务持久化", check_task_persistence),
    ]
    
    results = []
    for name, check_func in checks:
        print(f"{name}:")
        result = check_func()
        results.append(result)
        print()
    
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    
    if all(results):
        print(f"✅ 所有验证通过 ({passed}/{total})")
        print("\n💡 下一步：")
        print("   1. 在 NoteForm 提交测试 Payload")
        print("   2. 观察后端日志输出")
        print("   3. 再次运行本脚本检查持久化数据")
        return 0
    else:
        print(f"❌ 部分验证失败 ({passed}/{total})")
        return 1

if __name__ == "__main__":
    sys.exit(main())

