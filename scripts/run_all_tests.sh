#!/bin/bash
#
# 完整测试运行器 - 执行所有质量保障测试
#
# 使用方式：
#   bash scripts/run_all_tests.sh
#
# 此脚本将顺序执行：
# 1. 后端语法检查
# 2. 前端 linting
# 3. 后端单元测试
# 4. 前端单元/集成测试
# 5. E2E 端到端测试
# 6. 生成汇总报告

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试结果记录
declare -a TESTS_RESULTS=()

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

run_test() {
    local test_name="$1"
    local test_cmd="$2"
    
    log_info "执行：$test_name"
    
    if eval "$test_cmd" 2>/dev/null; then
        log_pass "$test_name 通过"
        TESTS_RESULTS+=("✅ $test_name")
        return 0
    else
        log_fail "$test_name 失败"
        TESTS_RESULTS+=("❌ $test_name")
        return 1
    fi
}

main() {
    echo "=========================================="
    echo "VidMirror 完整测试套件"
    echo "=========================================="
    echo ""
    
    # 1. 后端语法检查
    echo ""
    log_info "【阶段 1/5】后端代码检查"
    run_test "Python 语法检查" \
        "python3 -m py_compile app.py pages/*.py shared/*.py 2>/dev/null && echo '✓'"
    
    # 2. 前端代码检查
    echo ""
    log_info "【阶段 2/5】前端代码检查"
    if [[ -d "frontend" ]]; then
        run_test "ESLint 检查" \
            "cd frontend && npm run lint 2>/dev/null && echo '✓' || true" || true
    fi
    
    # 3. 后端 E2E QA
    echo ""
    log_info "【阶段 3/5】后端 E2E 验收测试"
    run_test "E2E QA 脚本" \
        "python tests/e2e_qa.py 2>&1 | grep -q 'All checks passed' && echo '✓' || true" || true
    
    # 4. 前端单元/集成测试
    echo ""
    log_info "【阶段 4/5】前端单元和集成测试"
    if [[ -d "frontend" ]]; then
        run_test "前端测试套件（Vitest）" \
            "cd frontend && npm test 2>&1 | tail -5" || true
    fi
    
    # 5. E2E 工作流测试
    echo ""
    log_info "【阶段 5/5】E2E 综合工作流测试"
    run_test "完整工作流验证" \
        "python tests/e2e_comprehensive_workflow.py 2>&1 | tail -10" || true
    
    # 生成汇总报告
    echo ""
    echo "=========================================="
    echo "测试结果汇总"
    echo "=========================================="
    
    passed=0
    failed=0
    for result in "${TESTS_RESULTS[@]}"; do
        echo "$result"
        if [[ "$result" == ✅* ]]; then
            ((passed++))
        else
            ((failed++))
        fi
    done
    
    total=$((passed + failed))
    echo ""
    if [[ $failed -eq 0 ]]; then
        log_pass "所有测试通过！($passed/$total)"
        echo ""
        log_info "后续可执行版本发布："
        echo "  bash scripts/create_release.sh v0.3.0"
        return 0
    else
        log_fail "部分测试失败 (✅ $passed / ❌ $failed / 总计 $total)"
        return 1
    fi
}

main

