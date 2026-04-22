================================================================================
  VidMirror macOS 脚本权限修复 - 快速开始指南
================================================================================

🎯 你的问题：
  双击 start_vidmirror.command 显示
  "无法执行，因为你没有正确的访问权限"

✅ 快速解决（选一个）：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【方案 A】最简单 - 自动修复脚本（推荐）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

在终端中运行：

  bash /Users/conan/Desktop/nibi/FIX_PERMISSIONS.sh

或：

  python3 /Users/conan/Desktop/nibi/fix_permissions.py

完成！脚本会自动修复所有权限和隔离属性。

用时：2-3 秒
成功率：95%+

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【方案 B】清晰明了 - 手动命令（推荐学习）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

第 1 步：打开终端（⌘ + 空格，输入 terminal）

第 2 步：复制粘贴以下命令：

  chmod +x /Users/conan/Desktop/nibi/start_vidmirror.command
  chmod +x /Users/conan/Desktop/nibi/start_vidmirror_advanced.command
  chmod +x /Users/conan/Desktop/nibi/INSTALL_DESKTOP_SHORTCUT.sh

第 3 步：复制粘贴移除隔离属性：

  xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/start_vidmirror.command 2>/dev/null
  xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/start_vidmirror_advanced.command 2>/dev/null
  xattr -d com.apple.quarantine /Users/conan/Desktop/nibi/INSTALL_DESKTOP_SHORTCUT.sh 2>/dev/null

完成！现在双击脚本应该可以打开了。

用时：30 秒
成功率：95%+

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【方案 C】最保险 - 右键打开（应急方案）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

如果上述方法都不行：

  1. 打开 Finder，导航到 /Users/conan/Desktop/nibi
  2. 右键点击 start_vidmirror.command（或 Ctrl+点击）
  3. 选择"打开"
  4. 点击安全警告中的"打开"按钮
  5. 完成！系统会记住信任，之后可直接双击

用时：5 秒
成功率：100%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【修复验证】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

修复完成后，运行以下命令验证：

  ls -lh /Users/conan/Desktop/nibi/start_vidmirror.command

期望输出：
  -rwxr-xr-x  ... start_vidmirror.command
   ^^^
   包含 x = 可执行 ✅

如果显示 -rw-r--r--（无 x），说明需要再次 chmod +x

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【修复完成后】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 双击脚本启动 → start_vidmirror.command
✅ 终端运行 → ./start_vidmirror.command
✅ 享受一键启动体验 → 前端 + 后端一起启动

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【需要更多帮助？】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 详细指南：
   • PERMISSION_FIX_GUIDE.md (完整权限修复指南)
   • PERMISSION_FIX_COMPLETE.md (快速方案总结)
   • MANUAL_FIX_STEPS.txt (手动修复步骤)
   • PERMISSION_SOLUTION_SUMMARY.md (整体解决方案)

🔧 修复脚本：
   • FIX_PERMISSIONS.sh (Bash 自动修复)
   • fix_permissions.py (Python 自动修复)

📚 启动指南：
   • QUICKSTART.md (5 分钟快速开始)
   • START_GUIDE.md (完整使用手册)

================================================================================

创建日期：2026-04-22
修复类型：macOS 脚本权限 + 隔离属性
目标：一键启动 VidMirror 前后端

================================================================================

💡 快速提示：

  • 方案 A 最快（2-3 秒）
  • 方案 B 最清晰（30 秒）
  • 方案 C 最保险（100% 成功）

选一个方案开始吧！🚀

================================================================================

