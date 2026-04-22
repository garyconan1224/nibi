#!/bin/bash
# VidMirror 脚本权限和隔离属性修复工具
# 用法：bash FIX_PERMISSIONS.sh 或 ./FIX_PERMISSIONS.sh

set -euo pipefail

PROJECT_DIR="/Users/conan/Desktop/nibi"
cd "$PROJECT_DIR" 2>/dev/null || {
    echo "❌ 错误：无法进入项目目录 $PROJECT_DIR"
    exit 1
}

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🔧 VidMirror 脚本权限和隔离属性修复工具                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 要修复的文件列表
declare -a FILES=(
    "start_vidmirror.command"
    "start_vidmirror_advanced.command"
    "INSTALL_DESKTOP_SHORTCUT.sh"
)

# 修复函数
fix_file() {
    local file=$1
    local filepath="$PROJECT_DIR/$file"
    
    if [[ ! -f "$filepath" ]]; then
        echo "❌ 文件不存在: $file"
        return 1
    fi
    
    echo "📝 处理: $file"
    
    # 1. 赋予执行权限
    chmod +x "$filepath"
    echo "  ✓ 赋予执行权限 (chmod +x)"
    
    # 2. 移除隔离属性
    quarantine_attr="com.apple.quarantine"
    if xattr -l "$filepath" 2>/dev/null | grep -q "$quarantine_attr"; then
        xattr -d "$quarantine_attr" "$filepath" 2>/dev/null || true
        echo "  ✓ 移除隔离属性 (com.apple.quarantine)"
    else
        echo "  ℹ️  文件不含隔离属性 (已清洁)"
    fi
    
    # 3. 验证权限
    if [[ -x "$filepath" ]]; then
        echo "  ✅ 权限修复成功！"
    else
        echo "  ⚠️  权限修复可能未生效"
    fi
    echo ""
}

# 执行修复
echo "=== 🔨 开始修复所有脚本 ==="
echo ""

for file in "${FILES[@]}"; do
    fix_file "$file"
done

# 最后验证
echo "=== ✨ 最终验证 ==="
echo ""
for file in "${FILES[@]}"; do
    filepath="$PROJECT_DIR/$file"
    if [[ -x "$filepath" ]]; then
        perms=$(ls -lh "$filepath" | awk '{print $1}')
        echo "✅ $file ($perms)"
    else
        echo "❌ $file (缺少执行权限)"
    fi
done

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║              🎉 修复完成！                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 现在你可以："
echo "  1. 直接双击脚本运行"
echo "  2. 或在终端运行: ./start_vidmirror.command"
echo ""
echo "⚠️  如果双击仍然提示权限错误，请按以下步骤："
echo "  • 右键点击文件 → 选择\"打开\""
echo "  • 在安全提示中点击\"打开\"按钮"
echo "  • 系统会记住信任，之后可直接双击"
echo ""
echo "💡 如需帮助，请查看："
echo "  • QUICKSTART.md (快速指南)"
echo "  • START_GUIDE.md (完整手册)"
echo ""

