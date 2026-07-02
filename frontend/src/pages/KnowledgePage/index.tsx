import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Database,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  askKnowledge,
  getKnowledgeStatus,
  rebuildKnowledge,
  type KnowledgeAskResponse,
  type KnowledgeStatus,
} from '@/services/knowledge'
import type { SearchSource } from '@/services/search'
import { cn } from '@/lib/utils'

type KnowledgeMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SearchSource[]
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '尚未建立'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusText(status: KnowledgeStatus | null): string {
  if (!status) return '正在读取索引状态'
  if (status.running) {
    return `正在建立索引 ${status.rebuild.processed_workspaces}/${status.rebuild.total_workspaces}`
  }
  if (status.item_count <= 0) return '暂无可收录笔记'
  if (!status.ready) {
    return `待刷新 ${status.indexed_item_count}/${status.item_count} 个素材`
  }
  return `已收录 ${status.indexed_workspace_count} 个合集 / ${status.indexed_item_count} 个素材`
}

export default function KnowledgePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [asking, setAsking] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<KnowledgeMessage[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getKnowledgeStatus()
      setStatus(next)
      return next
    } catch (err) {
      const msg = err instanceof Error ? err.message : '读取知识库状态失败'
      toast.error(msg)
      return null
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (!status?.running) return
    const timer = window.setInterval(() => {
      void refreshStatus()
    }, 1800)
    return () => window.clearInterval(timer)
  }, [refreshStatus, status?.running])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, asking])

  const canAsk = Boolean(status?.ready && input.trim() && !asking)
  const coverage = useMemo(() => {
    if (!status || status.item_count <= 0) return 0
    return Math.round((status.indexed_item_count / status.item_count) * 100)
  }, [status])

  const handleRebuild = async () => {
    setRebuilding(true)
    try {
      const next = await rebuildKnowledge(true)
      setStatus(next)
      toast.success('已开始刷新知识库索引')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '刷新索引失败'
      toast.error(msg)
    } finally {
      setRebuilding(false)
    }
  }

  const handleAsk = async () => {
    const question = input.trim()
    if (!question || asking) return
    if (!status?.ready) {
      toast.error('知识库索引还未就绪，请先刷新索引')
      return
    }

    const userMessage: KnowledgeMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: question,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setAsking(true)
    try {
      const res: KnowledgeAskResponse = await askKnowledge(question)
      const assistantMessage: KnowledgeMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.answer || '（没有生成回答）',
        sources: res.sources ?? [],
      }
      setMessages((prev) => [...prev, assistantMessage])
      if (res.status) setStatus(res.status)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : err instanceof Error ? err.message : '提问失败'
      toast.error(msg)
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
      void refreshStatus()
    } finally {
      setAsking(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void handleAsk()
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-col bg-background">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
              <BookOpen size={14} />
              Global Knowledge
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">知识库</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refreshStatus()} disabled={loadingStatus}>
              <RefreshCw size={14} className={cn(loadingStatus && 'animate-spin')} />
              状态
            </Button>
            <Button size="sm" onClick={() => void handleRebuild()} disabled={rebuilding || status?.running}>
              {rebuilding || status?.running ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Database size={14} />
              )}
              刷新索引
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-xs text-muted-foreground">状态</div>
            <div className="mt-1 text-sm font-medium text-foreground">{statusText(status)}</div>
          </div>
          <div className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-xs text-muted-foreground">覆盖</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${coverage}%` }} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{coverage}%</span>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-xs text-muted-foreground">上次更新</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {formatDate(status?.last_indexed_at)}
            </div>
          </div>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col px-6 py-5">
        {status && status.item_count > 0 && !status.ready && !status.running ? (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle size={16} />
            <span>索引未就绪，刷新索引后即可跨全部笔记提问。</span>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !asking ? (
              <div className="flex h-full min-h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
                {status?.item_count === 0
                  ? '先去做几篇笔记，知识库会自动收录。'
                  : status?.ready
                    ? '向所有笔记提问，答案会附上来源。'
                    : '刷新索引后开始提问。'}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onOpenSource={(source) => navigate(source.jump_url)}
                  />
                ))}
                {asking ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    正在检索和生成回答
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[52px] resize-none text-sm"
                rows={2}
                disabled={asking || !status?.ready}
                placeholder={status?.ready ? '向所有笔记提问' : '索引就绪后可提问'}
              />
              <Button size="sm" onClick={() => void handleAsk()} disabled={!canAsk}>
                {asking ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function MessageBubble({
  message,
  onOpenSource,
}: {
  message: KnowledgeMessage
  onOpenSource: (source: SearchSource) => void
}) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[760px] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-background text-foreground',
        )}
      >
        {message.content}
      </div>
      {!isUser && message.sources && message.sources.length > 0 ? (
        <div className="grid w-full max-w-[860px] gap-2 md:grid-cols-2">
          {message.sources.map((source, index) => (
            <button
              key={`${source.workspace_id}-${source.item_id}-${index}`}
              type="button"
              onClick={() => onOpenSource(source)}
              className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {source.workspace_name} · {source.item_title}
                </span>
                <ArrowUpRight size={13} className="shrink-0 text-muted-foreground" />
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">
                {source.chunk_excerpt || '无片段预览'}
              </p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
