# Phase B 详细执行计划

## 核心目标
实现"任务中心"UI 模块，展示后端 pipeline 的异步任务状态，包括五阶段处理流程可视化与实时日志查看。

## 技术选型
| 决策 | 选项 | 理由 |
|---|---|---|
| **图标库** | lucide-react (已安装) | ✅ 无需新增依赖 |
| **状态管理** | Zustand | ✅ 最小化（vs Redux） |
| **轮询方案** | 3s 定时 + SSE 双轨 | ✅ 列表用轮询，日志用 SSE 实时推 |
| **动画** | Tailwind transitions | ✅ 无需 framer-motion |

## 任务分解（10 项）

### Phase B.0: 基础准备（已完成）
- [x] B.0.1 创建 feat/phase-b-task-center 分支
- [x] B.0.2 types/task.ts（54 行）：TaskStatus enum, TaskRecord interface, 助手函数
- [x] B.1.1 store/taskStore.ts（60 行）：Zustand store（task CRUD、当前任务选择）
- [x] B.1.2 hooks/usePipelineTasks.ts（71 行）：3s 轮询 + cleanup

### Phase B.2: UI 组件（下一对话，Sonnet 4.6）
- [ ] B.2.1 ProcessingStepper.tsx（~80 行）
  - 五阶段步骤条
  - Props: status (string), progress (0-1)
  - 图标：Zap→Download→Subtitles→Eye→BookMarked
  - 交互：highlight 当前阶段
  
- [ ] B.2.2 TaskItem.tsx（~120 行）
  - 单任务卡片组件
  - Props: task (TaskRecord), onSelect? () => void
  - 显示：task_id、task_type、status badge、progress bar
  - 折叠/展开日志列表
  
- [ ] B.2.3 TaskDashboard.tsx（~100 行）
  - 任务列表面板（中栏替代品）
  - 自动轮询（usePipelineTasks）
  - 任务列表排序（最新优先）
  - 顶部：project filter（可选）、refresh 按钮
  
- [ ] B.2.4 TaskLogViewer.tsx（~110 行）
  - 实时日志查看
  - SSE EventSource 连接
  - Props: taskId (string)
  - 日志条目着色（info=灰、warning=黄、error=红）
  - 自动滚动底部

### Phase B.3: 集成（新对话，Sonnet 4.6）
- [ ] B.3 集成 ProcessingStepper + TaskLogViewer 到 HomeLayout 右栏
  - 替换右栏占位符为 ProcessingStepper + TaskLogViewer
  - 当前任务来自 useTaskStore().getCurrentTask()
  - 点击 TaskDashboard 任务卡片时，同步更新右栏显示

### Phase B.4: 验证（新对话，Haiku 4.5）
- [ ] B.4 编译检查 + ESLint + commit

## 模型与对话划分

| 对话编号 | 任务 | 模型 | 策略 |
|---|---|---|---|
| **当前** | B.0 + B.1 基础设施 | Haiku 4.5 | ✅ 完成 |
| **#2** | B.2.1～B.2.4 UI 组件 | Sonnet 4.6 | 四个组件共享 context，同一 Thread |
| **#3** | B.3 集成 HomeLayout | Sonnet 4.6 | 新 Thread（@引用 B.2 输出的组件文件） |
| **#4** | B.4 验证 | Haiku 4.5 | 新 Thread（tsc + eslint + 提交）|

## 省 Token 策略

按照 **token-thrift-refactor.skill** 的七条宪法：

1. ✅ **Rule 1（不做）**：types/task.ts 中的辅助函数（getStatusColor 等）本可手写，但为了重用，AI 一次性生成可接受（51 行）
2. ✅ **Rule 2（默认便宜）**：Haiku 4.5 用于基础设施 → 完成
3. ✅ **Rule 3（新 Thread）**：每个重大对话开新 Thread，避免上下文膨胀
4. ✅ **Rule 4（最小提示）**：交接文档直接给出 @file 路径而非粘贴代码
5. ⏳ **Rule 5（高风险两阶段）**：B.3 集成时若跨文件改动多于 5 个，考虑先 plan 后 approve 再 exec
6. ✅ **Rule 6（发现不符）**：后端返回的 TaskListResponse 结构若有变化，SSE 日志推送若有差异，及时暂停重新调研
7. ✅ **Rule 7（Git 安全）**：每个任务一个小 commit，可随时 reset

## 后端 API 约定

### 任务列表轮询
```
GET /pipeline/tasks?project_id=optional_filter
Response: List[{
  task_id: "download-xxxx",
  project_id: "proj-123",
  task_type: "download",
  status: "DOWNLOADING",
  progress: 0.45,
  log: [{ts: "2025-04-19T12:34:56", level: "info", message: "..."}],
  result: {},
  error: "",
  ...
}]
```

### 日志 SSE 流
```
GET /pipeline/tasks/{task_id}/events
Response: text/event-stream
Data: {"type": "log", "entry": {...}}
Data: {"type": "task", "task": {...}}
```

## 验收标准（B.4）
- [ ] `npx tsc --noEmit` 无错误
- [ ] `npx eslint frontend/src/pages/HomePage frontend/src/layouts/HomeLayout.tsx` 无错误
- [ ] 所有新 export 已在 components 或 pages 目录的 index.ts 中导出（如需）
- [ ] git log 显示 4 个 B 系列 commit

## 预期工时
- B.0~B.1（已完成）：~20 min（Haiku）
- B.2.1~B.2.4：~45 min（Sonnet，包括调试）
- B.3：~30 min（Sonnet）
- B.4：~10 min（Haiku）
- **总计**：~105 min ≈ 1.5 小时

## 风险点与回滚
| 风险 | 监控指标 | 回滚方案 |
|---|---|---|
| TaskLogViewer SSE 连接失败 | EventSource onerror 日志 | 使用轮询 fallback（轮询 GET /pipeline/tasks/{id}） |
| TaskDashboard 轮询导致高频渲染 | React DevTools Profiler | 用 useMemo、useCallback 优化（或扩大轮询间隔） |
| HomeLayout 集成后布局乱掉 | 视觉检查 / 响应式测试 | 恢复中栏/右栏大小配置（resize-panels defaultSize） |
| TypeScript 编译失败 | tsc 输出 | 逐行修复类型标注，不要强制 any |

## 下一步（当前对话）
你的选择：
- [ ] **立即开新对话**（推荐）：关闭此对话，选 Sonnet 4.6，粘贴 PHASE_B_HANDOFF.md 中的 prompt
- [ ] **继续本对话**：我可以直接写 B.2.1~B.2.4，但会浪费 Haiku token（不符合宪法）

建议：**开新对话 + Sonnet 4.6**

