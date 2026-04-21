import { lazy, Suspense, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useTaskStore } from '@/store/taskStore'
import { TaskStatus } from '@/types/task'
import {
  FileText,
  GitFork,
  Captions,
  Eye,
  Info,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  Download,
  FileDown,
} from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

// 动态加载 MarkmapComponent（markmap-lib 体积大）
const MarkmapComponent = lazy(() => import('./MarkmapComponent'))

// ── 自定义 Markdown 渲染组件 ──────────────────────────────────────
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-6 border-b border-neutral-200 pb-2 text-2xl font-bold text-gray-900">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold text-gray-800">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold text-gray-700">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 leading-7 text-gray-700">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-gray-700">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-primary/40 bg-primary/5 px-4 py-2 text-gray-600 italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }) => {
    if (className) {
      return <code className={className} {...props}>{children}</code>
    }
    return (
      <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-sm text-pink-600">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full text-sm text-gray-700">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-neutral-100 px-4 py-2">{children}</td>,
  hr: () => <hr className="my-6 border-neutral-200" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    // 图片通过后端代理加载（避免防盗链）
    const proxied = src ? `/api/image_proxy?url=${encodeURIComponent(src)}` : src
    return <img src={proxied} alt={alt} className="my-3 max-w-full rounded-md" loading="lazy" />
  },
}

// ── 空状态 ──────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <FileText className="h-10 w-10 opacity-30" />
      <p className="text-sm">请选择一个任务以查看笔记</p>
    </div>
  )
}

// ── 处理中状态 ──────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary opacity-70" />
      <p className="text-sm">笔记正在生成中，请稍候...</p>
    </div>
  )
}

/**
 * 将后端原始错误信息映射为面向用户的友好提示
 * 重点处理模型相关的 400 错误（如模型不可用、模型名称错误等）
 */
function getFriendlyErrorMessage(raw: string): { friendly: string; hint?: string } {
  const lower = raw.toLowerCase()
  // HTTP 400 + 模型相关
  if (
    (lower.includes('400') || lower.includes('bad request')) &&
    (lower.includes('model') || lower.includes('模型'))
  ) {
    return {
      friendly: '当前模型不可用，请检查设置',
      hint: '可能原因：所选模型名称错误、账号未开通该模型或提供商配置有误。请前往「设置 → 提供商管理」确认配置。',
    }
  }
  // 20012：模型不存在
  if (lower.includes('20012') || (lower.includes('model') && lower.includes('not') && lower.includes('exist'))) {
    return {
      friendly: '模型不存在或未开通',
      hint: '请在「设置 → 提供商管理」中确认所选模型已在当前账号中开通。',
    }
  }
  // 401：鉴权失败
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return {
      friendly: 'API Key 验证失败',
      hint: '请检查提供商配置中的 API Key 是否正确有效。',
    }
  }
  // 429：限流
  if (lower.includes('429') || lower.includes('rate limit')) {
    return {
      friendly: '请求过于频繁，触发限流',
      hint: '请稍后重试，或降低并发请求频率。',
    }
  }
  return { friendly: raw }
}

// ── 失败状态 ────────────────────────────────────────────────────
function FailedState({ message }: { message?: string }) {
  const { friendly, hint } = message
    ? getFriendlyErrorMessage(message)
    : { friendly: '', hint: undefined }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="text-sm font-medium text-red-600">任务处理失败</p>
      {message && (
        <div className="max-w-md space-y-2">
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-500">{friendly}</p>
          {hint && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">{hint}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── 下载完成状态 ────────────────────────────────────────────────
function DownloadSuccessState({ fileName, savePath }: { fileName?: string; savePath?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8">
      <div className="flex flex-col items-center gap-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900">下载完成</h2>
      </div>
      <div className="w-full max-w-md space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">文件名</p>
          <p className="break-all rounded bg-white px-3 py-2 text-sm font-medium text-gray-800">
            {fileName || '-'}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600">保存路径</p>
          <p className="break-all rounded bg-white px-3 py-2 text-sm text-gray-700">
            {savePath || '-'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <ArrowRight className="h-4 w-4 flex-shrink-0" />
        <span>可继续提交 analyze 任务进行分析</span>
      </div>
    </div>
  )
}

// ── 复制按钮 ────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 降级：忽略复制失败
    }
  }
  return (
    <button
      onClick={handleCopy}
      title="复制 Markdown"
      className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-gray-600 shadow-sm transition hover:bg-neutral-50 active:scale-95"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '已复制' : '复制 MD'}
    </button>
  )
}

// ── 元信息 Tab ──────────────────────────────────────────────────
function MetaTab({ result, taskType, payload }: {
  result: Record<string, unknown>
  taskType: string
  payload: Record<string, unknown>
}) {
  const audioMeta = (result?.audio_meta as Record<string, unknown>) || {}
  const title = String(audioMeta.title || '')
  const coverUrl = String(audioMeta.cover_url || '')
  const duration = Number(audioMeta.duration || 0)
  const url = String(payload?.url || '')

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 px-8 py-6">
        {coverUrl && (
          <img
            src={`/api/image_proxy?url=${encodeURIComponent(coverUrl)}`}
            alt={title}
            className="w-full max-w-xs rounded-lg shadow-sm"
            loading="lazy"
          />
        )}
        <div className="space-y-3 text-sm">
          {title && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">标题</p>
              <p className="mt-0.5 font-medium text-gray-800">{title}</p>
            </div>
          )}
          {duration > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">时长</p>
              <p className="mt-0.5 text-gray-700">{formatDuration(duration)}</p>
            </div>
          )}
          {url && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">来源</p>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="mt-0.5 block break-all text-primary underline underline-offset-2 hover:opacity-80">
                {url}
              </a>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">任务类型</p>
            <p className="mt-0.5 text-gray-700">{taskType}</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

// ── 字幕 Tab ────────────────────────────────────────────────────
function TranscriptTab({ transcript }: { transcript: string }) {
  if (!transcript.trim()) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Captions className="h-8 w-8 opacity-30" />
        <p className="text-sm">暂无字幕内容</p>
      </div>
    )
  }
  return (
    <ScrollArea className="h-full">
      <div className="px-8 py-6">
        <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{transcript}</pre>
      </div>
    </ScrollArea>
  )
}

// ── 主组件 ──────────────────────────────────────────────────────
export default function MarkdownViewer() {
  // 直接订阅 tasks + currentTaskId，保证任务状态更新时组件能响应式重渲染。
  // 原来用 s => s.getCurrentTask（订阅函数引用，永不变化），导致任务完成后不刷新。
  const task = useTaskStore(s => {
    if (!s.currentTaskId) return undefined
    return s.tasks.find(t => t.task_id === s.currentTaskId)
  })
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ content: () => printRef.current })
  const [showExportMenu, setShowExportMenu] = useState(false)

  // 无选中任务
  if (!task) return <EmptyState />

  const { status, error, result, task_type, payload } = task

  // 任务失败
  if (status === TaskStatus.FAILED) return <FailedState message={error} />

  // download 任务成功
  if (status === TaskStatus.SUCCESS && task_type === 'download') {
    return (
      <DownloadSuccessState
        fileName={result?.file_name as string | undefined}
        savePath={result?.save_path as string | undefined}
      />
    )
  }

  // 非 SUCCESS：显示 Loading
  if (status !== TaskStatus.SUCCESS) return <LoadingState />

  // analyze/create/storyboard/note 成功 → 按 completed_steps 展示 Tabs
  const completedSteps = (Array.isArray(result?.completed_steps) ? result.completed_steps : []) as string[]
  const markdown = String(result?.markdown || '')
  const transcript = String(result?.transcript || '')
  const analysis = String(result?.analysis || '')

  // 步骤未执行时的占位组件
  const StepNotExecuted = ({ stepName }: { stepName: string }) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Info className="h-8 w-8 opacity-30" />
      <p className="text-sm">「{stepName}」步骤未在本次任务中执行</p>
    </div>
  )

  return (
    <Tabs defaultValue="note" className="flex h-full flex-col overflow-hidden">
      {/* Tab 顶部栏 */}
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-2">
        <TabsList>
          <TabsTrigger value="note">
            <FileText className="h-3.5 w-3.5" />
            笔记
          </TabsTrigger>
          <TabsTrigger value="mindmap">
            <GitFork className="h-3.5 w-3.5" />
            思维导图
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <Captions className="h-3.5 w-3.5" />
            字幕
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <Eye className="h-3.5 w-3.5" />
            分析
          </TabsTrigger>
          <TabsTrigger value="meta">
            <Info className="h-3.5 w-3.5" />
            元信息
          </TabsTrigger>
        </TabsList>
        {/* 顶部操作按钮 */}
        <div className="flex items-center gap-2">
          <CopyButton text={markdown} />
          {/* 导出下拉菜单 */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              title="导出报告"
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-gray-600 shadow-sm transition hover:bg-neutral-50 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              导出
            </button>
            {showExportMenu && (
              <>
                {/* 点击外部关闭 */}
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-lg text-xs">
                  {/* Markdown 导出 */}
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-gray-700 hover:bg-neutral-50"
                    onClick={() => {
                      setShowExportMenu(false)
                      if (!markdown) return
                      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `report-${task.task_id.slice(0, 8)}.md`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    <FileDown className="h-3.5 w-3.5 text-blue-500" />
                    导出为 Markdown
                  </button>
                  {/* PDF 导出（打印另存） */}
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-gray-700 hover:bg-neutral-50"
                    onClick={() => {
                      setShowExportMenu(false)
                      handlePrint()
                    }}
                  >
                    <FileText className="h-3.5 w-3.5 text-red-500" />
                    导出为 PDF（打印）
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 笔记 Tab ── */}
      <TabsContent value="note" className="min-h-0 flex-1 overflow-hidden">
        {completedSteps.length > 0 && !completedSteps.includes('note') ? (
          <StepNotExecuted stepName="生成笔记" />
        ) : (
          <ScrollArea className="h-full">
            <div ref={printRef} className="px-8 py-6">
              {markdown ? (
                <ReactMarkdown
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  remarkPlugins={[remarkGfm as any]}
                  rehypePlugins={[rehypeHighlight]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  components={mdComponents as any}
                >
                  {markdown}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-muted-foreground">笔记内容为空。</p>
              )}
            </div>
          </ScrollArea>
        )}
      </TabsContent>

      {/* ── 思维导图 Tab ── */}
      <TabsContent value="mindmap" className="min-h-0 flex-1 overflow-hidden">
        {completedSteps.length > 0 && !completedSteps.includes('note') ? (
          <StepNotExecuted stepName="生成笔记" />
        ) : (
          <Suspense fallback={
            <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">加载思维导图模块...</span>
            </div>
          }>
            <MarkmapComponent markdown={markdown} />
          </Suspense>
        )}
      </TabsContent>

      {/* ── 字幕 Tab ── */}
      <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden">
        {completedSteps.length > 0 && !completedSteps.includes('transcribe') ? (
          <StepNotExecuted stepName="转录音频" />
        ) : (
          <TranscriptTab transcript={transcript} />
        )}
      </TabsContent>

      {/* ── 分析 Tab ── */}
      <TabsContent value="analysis" className="min-h-0 flex-1 overflow-hidden">
        {completedSteps.length > 0 && !completedSteps.includes('analyze') ? (
          <StepNotExecuted stepName="视觉分析" />
        ) : analysis.trim() ? (
          <ScrollArea className="h-full">
            <div className="px-8 py-6">
              <ReactMarkdown
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                remarkPlugins={[remarkGfm as any]}
                rehypePlugins={[rehypeHighlight]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                components={mdComponents as any}
              >
                {analysis}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Eye className="h-8 w-8 opacity-30" />
            <p className="text-sm">暂无分析内容</p>
          </div>
        )}
      </TabsContent>

      {/* ── 元信息 Tab ── */}
      <TabsContent value="meta" className="min-h-0 flex-1 overflow-hidden">
        <MetaTab
          result={result as Record<string, unknown>}
          taskType={task_type}
          payload={payload as Record<string, unknown>}
        />
      </TabsContent>
    </Tabs>
  )
}

