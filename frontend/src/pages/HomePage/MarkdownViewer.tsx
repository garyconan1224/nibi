import { FC } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTaskStore } from '@/store/taskStore'
import { TaskStatus } from '@/types/task'
import { FileText, Loader2, AlertCircle } from 'lucide-react'

// ── 自定义 Markdown 渲染组件（无需 @tailwindcss/typography）──
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-6 border-b border-neutral-200 pb-2 text-2xl font-bold text-gray-900">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold text-gray-800">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold text-gray-700">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 leading-7 text-gray-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-gray-700">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-gray-700">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-primary/40 bg-primary/5 px-4 py-2 text-gray-600 italic">
      {children}
    </blockquote>
  ),
  // 行内代码
  code: ({ children, className, ...props }) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      // 块级代码由 rehype-highlight 处理，透传 className
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
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
    <th className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-neutral-100 px-4 py-2">{children}</td>
  ),
  hr: () => <hr className="my-6 border-neutral-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  ),
}

// ── 空状态 ──
const EmptyState: FC = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
    <FileText className="h-10 w-10 opacity-30" />
    <p className="text-sm">请选择一个任务以查看笔记</p>
  </div>
)

// ── 处理中状态 ──
const LoadingState: FC = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-70" />
    <p className="text-sm">笔记正在生成中，请稍候...</p>
  </div>
)

// ── 失败状态 ──
const FailedState: FC<{ message?: string }> = ({ message }) => (
  <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
    <AlertCircle className="h-8 w-8 text-red-400" />
    <p className="text-sm font-medium text-red-600">任务处理失败</p>
    {message && (
      <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-500">{message}</p>
    )}
  </div>
)

// ── 主组件 ──
const MarkdownViewer: FC = () => {
  const getCurrentTask = useTaskStore(s => s.getCurrentTask)
  const task = getCurrentTask()

  // 无选中任务
  if (!task) return <EmptyState />

  const { status, error, result } = task

  // 任务失败
  if (status === TaskStatus.FAILED) return <FailedState message={error} />

  // 任务处于终结成功态
  if (status === TaskStatus.SUCCESS) {
    const markdown = result?.markdown as string | undefined
    return (
      <ScrollArea className="h-full">
        <div className="px-8 py-6">
          {markdown ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={mdComponents}
            >
              {markdown}
            </ReactMarkdown>
          ) : (
            <p className="text-sm text-muted-foreground">笔记内容为空。</p>
          )}
        </div>
      </ScrollArea>
    )
  }

  // 其余状态（PENDING / PARSING / DOWNLOADING / TRANSCRIBING / ANALYZING / SUMMARIZING）
  return <LoadingState />
}

export default MarkdownViewer

