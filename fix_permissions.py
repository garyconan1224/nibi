#!/usr/bin/env python3
"""
VidMirror 脚本权限和隔离属性修复工具
用法：python3 fix_permissions.py 或 ./fix_permissions.py
"""

import os
import subprocess
import sys
from pathlib import Path

def print_header():
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║   🔧 VidMirror 脚本权限和隔离属性修复工具                 ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print("\n")

def fix_file(filepath):
    """修复单个文件的权限和隔离属性"""
    filename = filepath.name
    
    if not filepath.exists():
        print(f"❌ 文件不存在: {filename}")
        return False
    
    print(f"📝 处理: {filename}")
    
    # 1. 赋予执行权限
    try:
        filepath.chmod(0o755)
        print(f"  ✓ 赋予执行权限 (chmod +x)")
    except Exception as e:
        print(f"  ❌ 赋予执行权限失败: {e}")
        return False
    
    # 2. 移除隔离属性
    try:
        result = subprocess.run(
            ["xattr", "-l", str(filepath)],
            capture_output=True,
            text=True
        )
        if "com.apple.quarantine" in result.stdout:
            subprocess.run(
                ["xattr", "-d", "com.apple.quarantine", str(filepath)],
                capture_output=True
            )
            print(f"  ✓ 移除隔离属性 (com.apple.quarantine)")
        else:
            print(f"  ℹ️  文件不含隔离属性 (已清洁)")
    except Exception as e:
        print(f"  ⚠️  移除隔离属性时出错: {e}")
    
    # 3. 验证权限
    if os.access(filepath, os.X_OK):
        print(f"  ✅ 权限修复成功！")
        return True
    else:
        print(f"  ⚠️  权限修复可能未生效")
        return False

def main():
    project_dir = Path("/Users/conan/Desktop/nibi")
    
    if not project_dir.exists():
        print(f"❌ 项目目录不存在: {project_dir}")
        sys.exit(1)
    
    print_header()
    
    # 要修复的文件列表
    files_to_fix = [
        project_dir / "start_vidmirror.command",
        project_dir / "start_vidmirror_advanced.command",
        project_dir / "INSTALL_DESKTOP_SHORTCUT.sh",
    ]
    
    print("=== 🔨 开始修复所有脚本 ===\n")
    
    results = {}
    for filepath in files_to_fix:
        results[filepath.name] = fix_file(filepath)
        print()
    
    # 最后验证
    print("=== ✨ 最终验证 ===\n")
    all_success = True
    for filepath in files_to_fix:
        filename = filepath.name
        if filepath.exists() and os.access(filepath, os.X_OK):
            stat_info = filepath.stat()
            mode = oct(stat_info.st_mode)[-3:]
            print(f"✅ {filename} (权限: {mode})")
        else:
            print(f"❌ {filename} (缺少执行权限)")
            all_success = False
    
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║              🎉 修复完成！                               ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print()
    print("📝 现在你可以：")
    print("  1. 直接双击脚本运行")
    print("  2. 或在终端运行: ./start_vidmirror.command")
    print()
    print("⚠️  如果双击仍然提示权限错误，请按以下步骤：")
    print("  • 右键点击文件 → 选择\"打开\"")
    print("  • 在安全提示中点击\"打开\"按钮")
    print("  • 系统会记住信任，之后可直接双击")
    print()
    print("💡 如需帮助，请查看：")
    print("  • QUICKSTART.md (快速指南)")
    print("  • START_GUIDE.md (完整手册)")
    print()
    
    return 0 if all_success else 1

if __name__ == "__main__":
    sys.exit(main())

