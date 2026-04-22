# Phase B 交接文档 — UI 组件开发

## 📍 当前进度
- ✅ B.0.1: 分支 `feat/phase-b-task-center` 已创建
- ✅ B.0.2: `frontend/src/types/task.ts` 完成（52 行，定义了 TaskStatus, TaskRecord, 辅助函数）
- ✅ B.1.1: `frontend/src/store/taskStore.ts` 完成（Zustand store，含 addTask, updateTask, getTask 等）
- ✅ B.1.2: `frontend/src/hooks/usePipelineTasks.ts` 完成（轮询 Hook，每 3s 拉 `/pipeline/tasks`）
- 📍 即将开始: B.2.1 ~ B.2.4 四个 UI 组件

## 🔧 后端 API 参考

### GET /pipeline/tasks
```
请求: GET /pipeline/tasks?project_id=xxx (可选)
响应: List[TaskRecord]
字段说明:
  - task_id: str
  - status: 'PENDING'|'PARSING'|'DOWNLOADING'|'TRANSCRIBING'|'ANALYZING'|'SUMMARIZING'|'SUCCESS'|'FAILED'|'CANCELLED'
  - progress: 0.0 ~ 1.0
  - log: [{ts, level, message}, ...]
  - result: {key: value}
```

### GET /pipeline/tasks/{task_id}/events (SSE)
```
事件流格式:
  data: {"type": "log", "entry": {ts, level, message}}
  data: {"type": "task", "task": {task_id, status, progress, ...}}
```

## 📋 下一步任务（B.2.1 ~ B.2.4）

### B.2.1: ProcessingStepper.tsx
五阶段步骤条，展示 PARSING → DOWNLOADING → TRANSCRIBING → ANALYZING → SUMMARIZING
- 输入: `status: string`（当前任务状态）、`progress: number`（0~1）
- 使用 `lucide-react` 图标（Zap, Download, Subtitles, Eye, BookMarked）
- 样式: Tailwind，灰色/蓝色活跃阶段

### B.2.2: TaskItem.tsx
单任务卡片（从 TaskRecord）
- 显示：task_id、task_type、status 标签、progress 条
- 交互：点击展开日志列表（TaskLogEntry[] 可折叠）
- 样式：Card + Border，响应式

### B.2.3: TaskDashboard.tsx
任务列表面板，替换 HomeLayout 中栏的占位符
- 使用 `usePipelineTasks()` Hook 自动轮询
- 映射 tasks 为 TaskItem 列表
- 顶部：项目过滤、刷新按钮
- 样式：ScrollArea，任务按 updated_at 倒序

### B.2.4: TaskLogViewer.tsx
实时日志查看器（嵌入 TaskItem 或独立组件）
- 使用 EventSource（原生 SSE）连接 `/pipeline/tasks/{task_id}/events`
- 流式渲染日志行，自动滚动到底部
- 支持日志等级着色（info/warning/error）
- 样式：MonospaceFont，黑底代码块

## 📁 文件位置
```
frontend/src/
├── types/task.ts                      ✅ 已创建
├── store/taskStore.ts                 ✅ 已创建
├── hooks/usePipelineTasks.ts           ✅ 已创建
├── pages/HomePage/
│   ├── ProcessingStepper.tsx          ⏳ 待开发
│   ├── TaskItem.tsx                   ⏳ 待开发
│   ├── TaskDashboard.tsx              ⏳ 待开发
│   └── TaskLogViewer.tsx              ⏳ 待开发
└── layouts/HomeLayout.tsx              ⏳ 待集成
```

## 🎯 模型选择
- **B.2.1 ~ B.2.4**: Sonnet 4.6（四个组件联动紧密，同一 Thread）
- **B.3 集成**: Sonnet 4.6（新 Thread）
- **B.4 验证**: Haiku 4.5（新 Thread，只是 tsc + lint）

## 💾 Git 状态
```bash
分支: feat/phase-b-task-center
最新 commit: 2d31387 "feat(phase-b): 定义任务类型、Zustand store、轮询 Hook"
```

## 🚀 启动下一对话的命令

```bash
# 在新对话中，选择模型 Sonnet 4.6，粘贴这个 prompt：

---
【Phase B UI 组件开发】

我在做 VidMirror 的 Phase B（任务中心与流程可视化）。
已完成基础设施（types/task.ts, store, hooks），现在开发 UI 组件。

参考交接文档：frontend/src/types/task.ts 中的 TaskStatus 枚举、TaskRecord interface。
后端 API：GET /pipeline/tasks（轮询）、GET /pipeline/tasks/{task_id}/events（SSE 日志流）。

待开发（按顺序）：
1. ProcessingStepper.tsx - 五阶段步骤条（PARSING→DOWNLOADING→TRANSCRIBING→ANALYZING→SUMMARIZING）
2. TaskItem.tsx - 单任务卡片，显示状态、进度、可折叠日志
3. TaskDashboard.tsx - 任务列表面板，用 usePipelineTasks() 自动轮询
4. TaskLogViewer.tsx - 实时日志查看（EventSource SSE）

要求：
- 使用 lucide-react 图标
- Tailwind 样式
- TypeScript 严格模式
- 与后端 TaskRecord interface 保持一致

请一次性写出这四个组件的完整代码（包括 export）。
```

---

好的，现在已准备好切换到新对话！

