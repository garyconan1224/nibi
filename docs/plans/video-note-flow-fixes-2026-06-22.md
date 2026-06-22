# 视频笔记流程 · 阻断 Bug 修复计划（2026-06-22）

> **来源**：用户手测 17 条反馈（`docs/test-reports/manual-local-video-2026-06-21.md` 第 85–109 行）
> **工作流**：Claude 调研 + 跟用户沟通确认 → 本文件落详细计划 → 小米读取执行 → Codex 审查。
> **状态图例**：✅ 已完成　🔧 返工中　⬜ 待调研

---

## 背景

本地视频上传端到端 + 添加素材入口体验。手测暴露：转写遇无音轨崩、本地上传配置入口形态不对（弹了右侧抽屉且狂闪）。

> Bug #2（路由 note）、Bug #3（找 workspace 文件）手测已确认生效。

---

## 阻断项 1：转写遇无音轨视频崩溃 ✅（小米已实现 `8ef4984`）

**现象**：无音轨视频 note 任务 FAILED，`transcribe 失败: tuple index out of range`，progress 0.3。
**根因**：转写轨直接把视频喂 faster-whisper（`asr_fast_whisper.py:430`），转写前未检测音轨；无音轨时库内部越界；except 还吞掉了 traceback。
**用户决定**：无音轨 → 跳过转写、仍出画面笔记 + 提示。
**已实现**：`8ef4984` fix(asr): 无音轨视频跳过转写 + traceback 完整记录。
**手测状态**：用户换带音轨文件（`note-ce542bf34389`）已成功生成笔记（转写未崩）；**无音轨那条建议补一次实跑确认**（用 `…Web3村长.mp4` 跑，确认跳过 + 出画面笔记 + 提示）。

---

## 阻断项 2：本地视频配置入口 🔧（方案 A 返工为「统一中间模态」）

**进展**：小米初版（`25907ed` + `b4e0d6e`）让本地上传弹 **PreflightDrawer（右侧抽屉）**。用户手测后要求返工——抽屉狂闪 + 形态不对。

**用户最终决策（2026-06-22 手测后）**：
1. **删除** PreflightDrawer（右侧抽屉，旧）+ 其测试 `PreflightDrawer.test.tsx`。删后狂闪应消失，未消失再修。
2. **本地 + 链接统一走同一个中间模态** AddMaterialModal（「添加素材」居中弹窗），两个入口体验一致。
3. 配置用 AddMaterialModal **现有项**（笔记类型 / 风格 / 配图 / 视觉模型）；PreflightDrawer 独有的「背景信息 + 逐项任务勾选」**先丢弃**（当前精简方向）。
4. 中间模态**视觉风格采用旧 PreflightDrawer 的设计语言**（按钮 / 字体 / 配色）——删 PreflightDrawer 前先把要复用的样式提取出来。

**⚠️ 关键技术依赖（必读）**：AddMaterialModal 现在通过 **`generateNote`** 端点提交（`AddMaterialModal.tsx:262`），而 `generateNote` 对本地路径会无条件校验 URL → 400（即旧 Bug #1）。所以让本地文件走 AddMaterialModal **必须解决提交路径**：
- **推荐路线**：AddMaterialModal 提交时**按来源分流**——链接维持 `generateNote`；**本地文件改走 `savePreflight + startItemPipeline`**（复用小米 `25907ed` 已在 `Composer.handleFileChange` 写过的 upload→savePreflight→start 逻辑，搬进 AddMaterialModal）。这样后端 `generateNote` 不必动、也绕开旧 Bug #1。

**实现要点**：
1. `Composer.tsx`：
   - `handleFileChange` 上传后改成 `setUploadOpen(true)`（开 AddMaterialModal），不再 `setPreflightOpen(true)`。
   - 删除 `preflightOpen` 状态、`onFineTune`、`<PreflightDrawer>` 渲染与 import。
2. `AddMaterialModal.tsx`：
   - 支持本地文件入口：无 `urlValue` / `sniffResult` 时展示文件名、配置项照常。
   - 提交分流（见上）：本地走 savePreflight + startItemPipeline + navigate；链接维持 generateNote。
   - 视觉改造：套用 PreflightDrawer 设计语言。
3. 删除 `PreflightDrawer.tsx` + `PreflightDrawer.test.tsx`。
4. 链接「微调」入口（原 onFineTune → PreflightDrawer）取消——确认其配置已被 AddMaterialModal 覆盖。

**涉及文件**：`Composer.tsx`、`components/workspace/AddMaterialModal.tsx`、删 `PreflightDrawer.tsx` / `PreflightDrawer.test.tsx`。

**验收**：
- 本地上传 + 链接添加弹出的是**同一个中间模态**，视觉为旧抽屉风格、无右侧抽屉、无狂闪。
- 本地视频经中间模态配置后能正常 start、生成笔记（**重点验证不撞 generateNote 400**）。
- 勾 / 不勾配图结果不同（配置真透传）。
- 取消不残留半截 item。
- 前端 `build` 通过；删 `PreflightDrawer.test.tsx` 后测试套件仍绿、无残留引用。

---

## ① 下一批：封面 · 图 · 信息缺失类（建议一起做）

- ⬜ **第 3 条**：添加链接不显示封面。
- ⬜ **第 7 条**：结果页「所见即所得」无图、源 md 无图，但有「图片内容理解」（`note-ce542bf34389` / `PixPin_2026-06-22_11-05-25`）。
- ⬜ **第 18 条**：处理中页面缺视频封面图 + 视频名称等信息（`PixPin_2026-06-22_11-00-43`）。【bug 性质，并入①】
- ⬜ **第 19 条**：处理中页面进度按实际阶段分步显示——本地：拆分音频→转录→分析→生成笔记→插图→完成；在线额外加：排队→下载。用户设想与实际 pipeline（`transcribe`/`analyze`/`note`）基本对应，**做前核实能否拆这么细再定**。【处理页 UI，需确认粒度】

---

## 后续 UI 批次（非本次阻断范围，记录正确理解）

**第 4 条（已澄清）**：添加素材后先选**功能板块**（平级）——「笔记」「复刻」或其他：
- 「笔记」→ 现在这套配置 → 笔记结果页。
- 「复刻」→ 复刻结果页（项目既有 **[C] 复刻 · AI 导演**）。
- 本次只需后续批次**先把平级功能按钮位置占好**。

---

## 给小米的执行须知

- **本次主任务 = 阻断项 2 返工**（阻断项 1 `8ef4984` 已做，仅需补无音轨实跑确认）。
- **自验**：
  - 前端 `build` 通过；删 PreflightDrawer 后无残留引用、测试套件绿。
  - 实跑：本地上传 + 链接添加都弹同一中间模态；本地视频配置后能生成笔记（重点验证不撞 generateNote 400）；无狂闪。
  - 真机验证前用 `./dev.sh` 重启，确认后端是新进程。
- **红线**：不 `git push`；不改 `.env` / DB schema；待调研项（第 3 / 7 条）和后续 UI 批次（第 4 条）不在本次范围，别擅自扩散；视觉迁移只搬样式，别改后端逻辑。
- **完成后**：回报自验结果（build + 实跑现象 + 截图），由 Claude 出 Codex 审查提示词。
