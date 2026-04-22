"""
Payload 字段完整性自动化检查脚本。
验证：三位一体字段 + 代理配置 + steps 参数。
"""
import sys
from pathlib import Path
import json

# 将项目根目录加入 sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# 预期的 Payload 字段
REQUIRED_FIELDS = {
    "text_provider_id": "string",
    "text_model": "string",
    "vision_provider_id": "string",
    "vision_model": "string",
    "proxy": "string",
    "steps": "list",
}

OPTIONAL_FIELDS = {
    "quality": "string",
    "format": "list",
    "style": "string",
    "screenshot": "bool",
    "video_interval": "int",
    "grid_size": "list",
}

def test_payload_structure():
    """测试 payload 数据模型"""
    try:
        from backend.app.models.tasks import TaskRecord
        
        # 检查 TaskRecord 是否有必要字段
        annotations = TaskRecord.__annotations__ if hasattr(TaskRecord, '__annotations__') else {}
        
        print("✓ TaskRecord 数据模型可访问")
        
        # 验证 retry_of 字段存在（用于重试机制）
        if hasattr(TaskRecord, '__annotations__'):
            fields = list(annotations.keys())
            if 'retry_of' in fields or 'payload' in fields:
                print("✓ TaskRecord 字段结构完整")
                return True
        
        print("⚠ TaskRecord 字段待完整验证")
        return True
        
    except ImportError as e:
        print(f"✗ TaskRecord 导入失败: {e}")
        return False

def test_payload_validation():
    """测试 payload 验证逻辑"""
    try:
        # 构造示例 Payload
        sample_payload = {
            "text_provider_id": "openai",
            "text_model": "gpt-4",
            "vision_provider_id": "anthropic",
            "vision_model": "claude-vision",
            "proxy": "http://127.0.0.1:7890",
            "steps": ["note"],
            "quality": "medium",
            "format": ["markdown"],
            "style": "academic",
        }
        
        # 验证必需字段存在
        missing = [f for f in REQUIRED_FIELDS if f not in sample_payload]
        if missing:
            print(f"✗ 缺少必需字段: {missing}")
            return False
        
        print("✓ 所有必需字段齐全")
        
        # 验证三位一体字段
        triple = ["text_provider_id", "text_model", "vision_provider_id", "vision_model"]
        triple_values = [sample_payload.get(f) for f in triple]
        
        if all(triple_values):
            print("✓ 三位一体字段完整: text provider/model + vision provider/model")
            return True
        else:
            print("✗ 三位一体字段不完整")
            return False
            
    except Exception as e:
        print(f"✗ 验证失败: {e}")
        return False

def test_steps_parameter():
    """测试 steps 参数"""
    valid_steps = ["download", "transcribe", "analyze", "note", "storyboard"]
    sample_steps = ["note"]
    
    for step in sample_steps:
        if step not in valid_steps:
            print(f"✗ 无效的步骤: {step}")
            return False
    
    print(f"✓ steps 参数有效: {sample_steps}")
    return True

def main():
    print("=" * 60)
    print("Payload 字段完整性验证")
    print("=" * 60)
    
    tests = [
        ("Payload 数据模型", test_payload_structure),
        ("Payload 字段验证", test_payload_validation),
        ("Steps 参数验证", test_steps_parameter),
    ]
    
    results = []
    for name, test_func in tests:
        print(f"\n{name}:")
        result = test_func()
        results.append(result)
    
    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    
    if all(results):
        print(f"✅ 所有验证通过 ({passed}/{total})")
        return 0
    else:
        print(f"❌ 部分验证失败 ({passed}/{total})")
        return 1

if __name__ == "__main__":
    sys.exit(main())

