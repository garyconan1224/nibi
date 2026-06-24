import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { listWorkspaces } from '@/services/workspaces'
import { searchGlobal, searchWorkspace, type SearchResponse } from '@/services/search'
import { ITEM_TYPE_TEXT, type WorkspaceRecord } from '@/types/workspace'

type ScopeKey = '__all__' | string // workspaceId or special

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<ScopeKey>('__all__')
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch(err => {
        console.error(err)
        toast.error('加载合集列表失败')
      })
  }, [])

  const scopeLabel = useMemo(() => {
    if (scope === '__all__') return '全部合集'
    const ws = workspaces.find(w => w.workspace_id === scope)
    return ws?.name ?? scope
  }, [scope, workspaces])

  async function handleSearch() {
    const q = query.trim()
    if (!q) {
      toast.warning('请输入查询内容')
      return
    }
    setLoading(true)
    setSubmitted(true)
    setResult(null)
    try {
      const data =
        scope === '__all__'
          ? await searchGlobal(q, { topK: 10 })
          : await searchWorkspace(scope, q, 5)
      setResult(data)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : '检索失败'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* 顶部输入区 */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <h1 className="text-lg font-semibold">知识库检索</h1>
          <p className="text-xs text-muted-foreground">
            跨合集语义检索（RAG）。返回带引用的回答和可跳转的来源片段。
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !loading) handleSearch()
                }}
                placeholder="输入问题，例如：发布会上提到了哪些产品特性？"
                className="pl-9"
                disabled={loading}
              />
            </div>
            <Select value={scope} onValueChange={v => setScope(v as ScopeKey)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部合集</SelectItem>
                {workspaces.map(ws => (
                  <SelectItem key={ws.workspace_id} value={ws.workspace_id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? (
                <>
                  <Loader2 size={14} className="mr-1 animate-spin" />
                  检索中
                </>
              ) : (
                '搜索'
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            范围：<span className="font-medium text-foreground">{scopeLabel}</span>
          </div>
        </div>
      </div>

      {/* 结果区 */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {loading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!loading && !submitted && (
            <EmptyState
              illustration={<SearchIcon className="size-6" />}
              title="开始你的第一次检索"
              description="在上方输入框中输入问题，按回车或点击搜索。"
            />
          )}

          {!loading && submitted && result && (
            <SearchResultView result={result} />
          )}

          {!loading && submitted && !result && (
            <EmptyState
              illustration={<SearchIcon className="size-6" />}
              title="未返回结果"
              description="可能是网络异常或后端报错，请查看控制台或稍后重试。"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function SearchResultView({ result }: { result: SearchResponse }) {
  return (
    <>
      <Card className="p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          回答
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{result.answer || '（模型未返回内容）'}</ReactMarkdown>
        </div>
      </Card>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          来源（{result.sources.length}）
        </div>
        {result.sources.length === 0 ? (
          <EmptyState
            illustration={<SearchIcon className="size-6" />}
            title="无引用来源"
            description="模型未能在选定范围内匹配到相关片段。"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {result.sources.map((s, idx) => (
              <li key={`${s.workspace_id}-${s.item_id}-${idx}`}>
                <Link
                  to={s.jump_url}
                  className="block rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-foreground">[{idx + 1}]</span>
                    <Badge variant="secondary" className="px-1.5 py-0">
                      {ITEM_TYPE_TEXT[s.item_type] ?? s.item_type}
                    </Badge>
                    <span className="truncate">{s.workspace_name}</span>
                    <span className="ml-auto font-mono">
                      score {s.score.toFixed(3)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {s.item_title || '（无标题）'}
                  </div>
                  {s.chunk_excerpt && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {s.chunk_excerpt}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
