# Add Material Entry And Capture UI Test Report

日期：2026-06-29

## 结论

通过。已按最新口径调整为：添加素材弹框默认不选择合集，界面不显示「不属于任何合集」「默认收纳箱」「收纳箱（单独素材）」等占位文案；用户需要归入合集时，再在弹框内点击「选择合集」或「新建合集」。

## 实现范围

- 侧边栏「+ 新建」改为直接打开全局添加素材弹框，不再跳回首页。
- 首页 Composer 移除内联「归入合集」行，合集选择统一收口到添加素材弹框。
- 新增全局添加素材弹框状态与 Shell 级挂载，支持首页、侧边栏和本地上传共用同一个入口。
- 弹框「② 合集归属」默认保持空态，只显示「选择合集」「新建合集」动作；选择合集后才显示当前合集名称，并保留双击重命名能力。
- 将视频/复刻相关的「视觉模型」「取画面」从高级设置中前移为首屏可见配置；高级设置仅保留低频项。

## 用户修正

计划文档中曾写到默认显示「不属于任何合集」或「收纳箱（单独素材）」。本次按用户最新修正执行：默认不选合集，不显示这类文字。

## 关键文件

- `frontend/src/store/addMaterialStore.ts`
- `frontend/src/components/workspace/GlobalAddMaterialModal.tsx`
- `frontend/src/layouts/AppShell.tsx`
- `frontend/src/pages/WorkbenchPage/Composer.tsx`
- `frontend/src/components/workspace/AddMaterialModal.tsx`
- `frontend/src/styles/nibi-components.css`
- `frontend/src/pages/WorkbenchPage/workbench.css`
- `frontend/src/__tests__/AddMaterialModal.test.tsx`
- `frontend/src/__tests__/AddMaterialModal.local.test.tsx`

## Payload 对比

- `generateNote(...)` 提交路径保持原有参数结构，只调整 UI 入口和可见配置位置。
- 本地文件 `savePreflight(...)` 与 `startItemPipeline(...)` 调用链保持不变。
- 默认未选择合集时仍传空 `workspaceIds`，只有用户选择或新建合集后才写入目标合集。

## 验证

命令验证：

```bash
pnpm -C frontend build
CI=1 pnpm -C frontend exec vitest run src/__tests__/AddMaterialModal.test.tsx src/__tests__/AddMaterialModal.local.test.tsx --reporter=verbose
pnpm -C frontend test
python3 -m compileall backend/app
```

结果：

- `pnpm -C frontend build`：通过。
- `AddMaterialModal` 相关测试：2 个文件，16 个测试通过；保留既有 React `act(...)` 警告。
- `pnpm -C frontend test`：20 个文件，161 个测试通过。
- `python3 -m compileall backend/app`：通过。

截图验收：

- `frontend/test-results/add-material-entry-home-2026-06-29.png`：首页无内联「归入合集」。
- `frontend/test-results/add-material-entry-sidebar-modal-2026-06-29.png`：侧边栏新建打开弹框，默认合集区域为空态，无禁用占位文案。
- `frontend/test-results/add-material-entry-capture-replica-2026-06-29.png`：复刻模式首屏可见「视觉模型」「取画面」「智能」「手动」。

## 备注

当前 worktree 已存在多处其他未提交改动，本轮未执行提交，避免把无关文件混入计划要求的拆分 commit。
