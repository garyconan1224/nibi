import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  type ChatMessage,
  createChatTurn,
  listChatMessages,
  subscribeChatTurn,
} from '@/services/chat'
import { toast } from 'sonner'

interface ChatDrawerProps {
  workspaceId: string
  /** 前端构建的 system prompt（ln.md + transcript 上下文） */
  systemPrompt: string
}

/**
 * B-8: 学习笔记页内 AI 问答抽屉。
 *
 * 浮动按钮在笔记面板右下角；点击滑出右侧 360px 抽屉。
 * 问答上下文限定为当前 ln.md + transcript。
 */
export default function ChatDrawer({ workspaceId, systemPrompt }: ChatDrawerProps) {
  const [open, setOpen] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // 打开时拉一次最近会话（若有 chatId）
  useEffect(() => {
    if (!open || !chatId) return
    let cancelled = false
    listChatMessages(workspaceId, chatId)
      .then((msgs) => {
        if (!cancelled) setHistory(msgs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, chatId, workspaceId])

  // 自动滚到底
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history, streamText, streaming])

  // 卸载时清掉 SSE
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const handleSend = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt || streaming) return
    setInput('')
    setStreaming(true)
    setStreamText('')

    const optimisticUser: ChatMessage = {
      chat_id: chatId ?? '__pending__',
      message_id: `tmp-${Date.now()}`,
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
      model: null,
    }
    setHistory((h) => [...h, optimisticUser])

    try {
      const turn = await createChatTurn(workspaceId, {
        prompt,
        chat_id: chatId ?? undefined,
        system_prompt: systemPrompt,
      })
      setChatId(turn.chat_id)

      cleanupRef.current?.()
      cleanupRef.current = subscribeChatTurn(workspaceId, turn.turn_id, {
        onDelta: (text) => setStreamText((s) => s + text),
        onDone: async () => {
          try {
            const fresh = await listChatMessages(workspaceId, turn.chat_id)
            setHistory(fresh)
          } catch {
            /* ignore */
          }
          setStreamText('')
          setStreaming(false)
        },
        onError: (msg) => {
          toast.error(`聊天出错：${msg}`)
          setStreamText('')
          setStreaming(false)
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`发送失败：${msg}`)
      setStreaming(false)
      setHistory((h) => h.filter((m) => m.message_id !== optimisticUser.message_id))
    }
  }, [input, streaming, workspaceId, chatId, systemPrompt])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <>
      {/* 浮动按钮：笔记面板右下角 */}
      {!open && (
        <button
          aria-label="问 AI"
          onClick={() => setOpen(true)}
          className="ln-chat-fab"
        >
          <MessageCircle size={18} />
          <span>问 AI</span>
        </button>
      )}

      {/* 右侧抽屉 */}
      {open && (
        <div className="ln-chat-drawer">
          {/* Header */}
          <div className="ln-chat-drawer-header">
            <div className="ln-chat-drawer-title">
              <MessageCircle size={14} />
              <span>问 AI</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              title="关闭"
              onClick={() => setOpen(false)}
            >
              <X size={14} />
            </Button>
          </div>

          {/* 作用域提示 */}
          <div className="ln-chat-scope-hint">
            仅基于本视频笔记与字幕回答
          </div>

          {/* Messages */}
          <ScrollArea className="ln-chat-messages">
            <div ref={scrollRef} className="ln-chat-messages-inner">
              {history.length === 0 && !streaming && (
                <p className="ln-chat-empty">
                  问个问题吧 · Enter 发送 / Shift+Enter 换行
                </p>
              )}
              {history.map((m) => (
                <Bubble key={m.message_id} role={m.role} content={m.content} />
              ))}
              {streaming && (
                <Bubble role="assistant" content={streamText} pending />
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="ln-chat-input-area">
            <div className="ln-chat-input-row">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息…"
                rows={2}
                className="ln-chat-textarea"
                disabled={streaming}
              />
              <Button
                size="sm"
                onClick={() => void handleSend()}
                disabled={streaming || !input.trim()}
              >
                {streaming ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface BubbleProps {
  role: ChatMessage['role']
  content: string
  pending?: boolean
}

function Bubble({ role, content, pending }: BubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={cn('ln-chat-bubble-row', isUser && 'ln-chat-bubble-user')}>
      <div
        className={cn(
          'ln-chat-bubble',
          isUser ? 'ln-chat-bubble-user-bg' : 'ln-chat-bubble-assistant-bg',
          pending && 'ln-chat-bubble-pending',
        )}
      >
        {content || (pending ? '…' : '')}
      </div>
    </div>
  )
}
