from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# 排除 tests/manual 目录下的手动验证脚本（不被 pytest 自动收集）
collect_ignore_glob = ["**/manual/*"]
