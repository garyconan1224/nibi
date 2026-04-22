"""
本地检查脚本：验证 analyze 步骤代码完整性（无需后端启动）。
"""
import sys
from pathlib import Path

# 将项目根目录加入 sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

def check_imports():
    """检查核心模块能否导入"""
    try:
        from shared.video_analyzer import VideoAnalyzer
        from backend.app.services.pipeline_tasks import handle_analyze_task
        print("✓ 核心模块导入成功")
        return True
    except ImportError as e:
        print(f"✗ 导入失败: {e}")
        return False

def check_video_analyzer():
    """检查 VideoAnalyzer 类定义"""
    try:
        from shared.video_analyzer import VideoAnalyzer
        assert hasattr(VideoAnalyzer, 'analyze'), "缺少 analyze 方法"
        print("✓ VideoAnalyzer.analyze 方法存在")
        return True
    except (ImportError, AssertionError) as e:
        print(f"✗ VideoAnalyzer 检查失败: {e}")
        return False

def check_pipeline_handler():
    """检查 handle_analyze_task 函数"""
    try:
        from backend.app.services.pipeline_tasks import handle_analyze_task
        import inspect
        sig = inspect.signature(handle_analyze_task)
        params = list(sig.parameters.keys())
        assert 'project_id' in params, "缺少 project_id 参数"
        assert 'payload' in params, "缺少 payload 参数"
        print("✓ handle_analyze_task 函数签名正确")
        return True
    except (ImportError, AssertionError) as e:
        print(f"✗ handle_analyze_task 检查失败: {e}")
        return False

def main():
    print("=" * 50)
    print("analyze 步骤完整性检查")
    print("=" * 50)
    
    checks = [
        check_imports,
        check_video_analyzer,
        check_pipeline_handler,
    ]
    
    results = [check() for check in checks]
    
    print("=" * 50)
    if all(results):
        print(f"✅ 所有检查通过 ({sum(results)}/{len(results)})")
        return 0
    else:
        print(f"❌ 部分检查失败 ({sum(results)}/{len(results)})")
        return 1

if __name__ == "__main__":
    sys.exit(main())

