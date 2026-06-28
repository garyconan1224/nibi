# Batch3 验证报告（2026-06-28）

对应计划：`docs/plans/exp-redesign-batch3-noteshell-library-fixes-2026-06-28.md`
执行分支：`feat/exp-redesign-p1`

## 1. 代码提交

本批次按“单项一提交”推进，相关 commit：

- `153c125` `fix(design): 收紧顶部状态栏 pg-note`
- `633b1a0` `fix(design): 放宽 NoteShell 视频分栏下限 pg-note`
- `e1311a9` `fix(design): 仅让 NoteShell 视频区域全屏 pg-note`
- `3fd09a9` `fix(design): 合并 NoteShell 新建总结入口 pg-note`
- `14fd738` `fix(design): 为库页列表态补齐封面 pg-notes`
- `d0dcce7` `fix(design): 将笔记库重排为单网格 pg-notes`
- `5867452` `fix(design): 为合集详情卡片补齐封面 pg-collection`
- `d24fe66` `fix(design): 为 NoteShell 增加正文设置面板 pg-note`
- `本报告后续补交`：问题 2 内嵌画中画

## 2. 构建与单测

统一结果：

- `pnpm -C frontend test` -> `20 passed / 157 passed`
- `pnpm -C frontend build` -> 通过

说明：以上在问题 2 完成后再次执行，覆盖当前最终前端状态。

## 3. 逐项结果

### 问题 1：视频分栏可缩更小

- 结果：已完成
- 改动：`frontend/src/pages/result/NoteShell/index.tsx`
- 说明：左栏最小占比从 `42` 降到 `20`，拖拽/键盘调节保留。
- 验证：真页恢复 PiP 后，左栏宽度恢复正常；逻辑与构建均通过。

### 问题 2：画中画改为内嵌悬浮窗

- 结果：已完成
- 改动：
  - `frontend/src/pages/result/NoteShell/index.tsx`
  - `frontend/src/pages/result/NoteShell/note-shell.css`
  - `frontend/src/pages/results/LearningNotesPage/LNVideoPanel.tsx`
- 实现说明：
  - NoteShell 内改为 `isPip` 态，不再走浏览器原生 PiP。
  - 选用“**保留同一个 video 节点挂载**”方案：PiP 时把左栏压到 `0` 宽，播放器壳切为 `fixed` 悬浮；这样不会复制第二个 `<video>`，也不会丢播放状态。
  - 悬浮窗支持：拖拽、尺寸切换、关闭、顶部截图按钮、内嵌 transport。
- 自动化验证：
  - 打开 PiP 后：`.nibi-note-page.is-pip` 生效，左栏宽度 `0`，转录/章节隐藏，右栏正文占满。
  - 悬浮窗按钮存在：`截取当前帧 / 切换尺寸 / 关闭画中画`
  - 拖拽前后矩形：
    - before: `x=936 y=578 width=320 height=322`
    - after: `x=796 y=566 width=320 height=322`
  - 关闭后：页面 class 恢复为 `.nibi-note-page`，转录/章节重新出现。
- 截图：
  - `frontend/test-results/exp-redesign-batch3-note-pip-playwright.png`
  - `frontend/test-results/exp-redesign-batch3-note-pip.png`

### 问题 3：顶部状态栏变矮

- 结果：已完成
- 改动：`frontend/src/layouts/AppShell.tsx`
- 验证：真页截图中顶部状态条/CPU MEM chip 已收紧，高度明显下降。

### 问题 4：正文设置面板

- 结果：已完成
- 改动：
  - `frontend/src/pages/result/NoteShell/index.tsx`
  - `frontend/src/pages/result/NoteShell/note-shell.css`
  - `frontend/src/store/lnEditorStore.ts`
  - `frontend/src/pages/result/NoteShell/MilkdownEditor.tsx`
- 已验证项：
  - 面板可打开
  - 字号调整即时生效
  - 刷新后持久化
  - 重置可恢复默认
- Playwright 结果：
  - before: `15px`
  - 调整后: `14px`
  - reload 后: `14px`
  - reset 后: `15px`
- 说明：`加粗选中` 已接入编辑器桥接，但本轮手测未点击，避免污染现有笔记内容。

### 问题 5：全屏只作用于视频

- 结果：已完成
- 改动：
  - `frontend/src/pages/results/LearningNotesPage/LNVideoPanel.tsx`
  - `frontend/src/pages/result/NoteShell/note-shell.css`
- Playwright 验证：
  - `document.fullscreenElement.className === "nibi-note-player-wrap"`
  - `containsRightPanel === false`
  - `containsTranscript === false`
- 说明：
  - 内置浏览器插件环境里，元素全屏没有进入 `document.fullscreenElement`；最终以本地 Chromium Playwright 为准完成验证。

### 问题 6：合并两个“新建总结”

- 结果：已完成
- 改动：`frontend/src/pages/result/NoteShell/index.tsx`
- 说明：只保留风格/版本下拉里的入口；AI 工具下拉移除重复项；创建态增加 loading / success / error toast。
- 验证：代码走查 + 构建测试通过。

### 问题 7：合集详情卡片补封面

- 结果：已完成
- 改动：
  - `frontend/src/pages/WorkspacePage/TaskboardPage/TaskboardHead.tsx`
  - `frontend/src/pages/WorkspacePage/TaskboardPage/MaterialCard.tsx`
  - `frontend/src/pages/WorkspacePage/TaskboardPage/index.tsx`
  - `frontend/src/pages/WorkspacePage/TaskboardPage/taskboard.css`
- 真页验证：
  - 头部与工具栏存在
  - 素材卡片存在封面区 `.mat-thumb`
  - 当前样本数据走的是 **fallback cover**：`.mat-thumb-fallback mat-thumb-fallback--video`
- 说明：
  - 当前本地 workspace 接口返回中，已测样本的 `thumbnail/result.thumbnail/cover_url/image_path/frame_paths` 全为空，因此只能验证“无缩略图时的回退封面分支”。
  - 该分支符合计划要求“有图显图，无图回退类型封面”。
- 截图：
  - `frontend/test-results/exp-redesign-batch3-taskboard-playwright.png`
  - `frontend/test-results/exp-redesign-batch3-taskboard.png`

### 问题 8：笔记页改单网格 + 合集筛选

- 结果：已完成
- 改动：
  - `frontend/src/pages/LibraryPage/index.tsx`
  - `frontend/src/store/libraryStore.ts`
- 真页验证：
  - `/notes` 现在为单一 `note-grid`
  - 筛选 chip 包含：`全部 / 视频 / 音频 / 图文 / 文本 / 合集 / 生成中`
  - 点击 Hero “查看合集”后：
    - 路径仍为 `/notes`
    - 激活 chip 变为 `合集0`
    - 页面进入空态，不跳首页
- 说明：
  - 当前本地数据里 note workspace 没有 `items_count > 1` 的样本，因此 `/notes` 页无法真页看到非空合集卡；本轮完成的是 CTA/filter/空态链路验证。

### 问题 9：列表视图补封面

- 结果：已完成
- 改动：
  - `frontend/src/pages/LibraryPage/index.tsx`
  - `frontend/src/pages/LibraryPage/library.css`
- 真页验证：
  - 列表态容器 class：`note-grid is-list`
  - 第一张卡保留 `.note-cover`
  - 至少一张视频卡保留图片封面，列表态封面宽度为 `240px`
- 截图：
  - `frontend/test-results/exp-redesign-batch3-library-list.png`

## 4. 自动化验证摘要

### Browser 插件（in-app browser）

- 完成 `/notes`、`/workspaces/:id/items/:itemId/note`、`/workspaces/:id` 三页结构与交互核验
- 用于确认：
  - chip/CTA 状态切换
  - PiP 真页 DOM 状态与拖拽前后坐标
  - Taskboard 结构命中

### 本地 Chromium Playwright

- 补充验证：
  - 列表态封面仍保留
  - 正文设置持久化
  - PiP 拖拽
  - 视频全屏范围
  - Taskboard 封面回退分支

关键结果：

```json
{
  "library": {
    "path_after_collection_cta": "/notes",
    "active_chip": "合集0",
    "grid_class_after_list": "note-grid is-list",
    "list_first_card_has_cover": true,
    "list_has_image_cover": true
  },
  "noteshell": {
    "font_before": "15px",
    "font_changed": "14px",
    "font_persisted_after_reload": "14px",
    "font_after_reset": "15px",
    "fullscreen_state": {
      "fullscreenClass": "nibi-note-player-wrap",
      "containsRightPanel": false,
      "containsTranscript": false
    }
  },
  "taskboard": {
    "hasToolbar": true,
    "hasCard": true,
    "hasCover": true,
    "hasCoverImg": false,
    "hasCoverFallback": true
  }
}
```

## 5. 未覆盖 / 限制

1. `/notes` 本地数据无非空合集样本，因此无法在笔记库页直观看到 collection-card 真页渲染，只验证到了筛选/CTA/空态链路。
2. `/workspaces/:id` 当前样本没有真实缩略图字段，只验证到了 Taskboard 的回退封面分支；真实图分支在库页列表/网格中已验证存在。
3. `加粗选中` 未做点击式手测，避免改写现有笔记内容；代码桥接和按钮渲染已完成。
4. 内置浏览器插件对元素全屏支持不足，最终全屏验收以本地 Chromium Playwright 为准。

## 6. 结论

本批次 9 项修复已全部落地，前端构建/测试通过，关键交互已完成真页自动化验证。剩余限制均来自本地样本数据覆盖不足，不是代码阻塞。
