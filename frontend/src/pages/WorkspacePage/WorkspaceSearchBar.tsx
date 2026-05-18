import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { searchWorkspace, type SearchResponse } from '@/services/search'
import { ITEM_TYPE_TEXT } from '@/types/workspace'

interface Props {
  workspaceId: string
}

/** Phase 3B.5：WorkspaceDetail 顶部窄版搜索条，结果内联可折叠。 */
export function WorkspaceSearchBar({ workspaceId }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [expanded, setExpanded] = useState(true)

  async function submit() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setExpanded(true)
    try {
      const data = await searchWorkspace(workspaceId, q, 5)
      setResult(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '检索失败'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !loading) submit()
            }}
            placeholder="在本工作空间内检索…"
            className="h-8 pl-8 text-sm"
            disabled={loading}
          />
        </div>
        <Button size="sm" onClick={submit} disabled={loading || !query.trim()}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : '搜索'}
        </Button>
        {result && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(v => !v)}
            title={expanded ? '折叠结果' : '展开结果'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        )}
      </div>

      {result && expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{result.answer || '（模型未返回内容）'}</ReactMarkdown>
          </div>
          {result.sources.length > 0 && (
            <ul className="space-y-1">
              {result.sources.map((s, i) => (
                <li key={`${s.item_id}-${i}`}>
                  <Link
                    to={s.jump_url}
                    className="block rounded-md border border-border p-2 text-xs hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-mono text-foreground">[{i + 1}]</span>
                      <Badge variant="secondary" className="px-1 py-0">
                        {ITEM_TYPE_TEXT[s.item_type] ?? s.item_type}
                      </Badge>
                      <span className="truncate">{s.item_title || '（无标题）'}</span>
                      <span className="ml-auto font-mono">{s.score.toFixed(3)}</span>
                    </div>
                    {s.chunk_excerpt && (
                      <div className="mt-1 line-clamp-2 text-muted-foreground">
                        {s.chunk_excerpt}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
