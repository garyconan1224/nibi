# 手动验证脚本（Manual Verification Scripts）

本目录包含一次性、手动运行的验证脚本，用于离线检查核心功能，**不被 pytest 自动收集**。

## 脚本清单

### 1. `test_analyze_step_complete.py`
验证 analyze 步骤的完整流程（仅代码检查，无需后端启动）。

```bash
python tests/manual/test_analyze_step_complete.py
```

### 2. `test_comprehensive_verification.py`
综合验证：三位一体 Payload + 后端日志 + 数据持久化。

**需要**: 启动后端 `uvicorn backend.app.main:app --port 8010`

```bash
python tests/manual/test_comprehensive_verification.py
```

### 3. `test_payload_verification.py`
Payload 字段完整性检查（自动化验证脚本）。

```bash
python tests/manual/test_payload_verification.py
```

---

## 使用指南

1. **离线检查**（无需后端）:
   ```bash
   python tests/manual/test_analyze_step_complete.py
   ```

2. **联调验证**（需要后端在线）:
   - 启动后端: `uvicorn backend.app.main:app --reload --port 8010`
   - 在另一终端: `python tests/manual/test_comprehensive_verification.py`

3. **CI/CD 集成**:
   这些脚本**不会被 pytest 自动执行**，需显式调用。

---

## 历史文档

详细的验证报告保存在 `docs/history/`:
- `VERIFICATION_COMPLETE.md` - 验证完成确认
- `MANUAL_VERIFICATION_REPORT.md` - 详细运行记录
- `PAYLOAD_VERIFICATION_EVIDENCE.md` - 原始数据证据

