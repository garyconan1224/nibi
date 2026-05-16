import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, RefreshCw } from 'lucide-react'
import { listWorkspaces } from '@/services/workspaces'
import {
  type ItemType,
  type WorkspaceItem,
  type WorkspaceRecord,
  ITEM_TYPE_TEXT,
  ITEM_TYPE_COLOR,
} from '@/types/workspace'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TabKey = 'all' | ItemType

interface FavoriteEntry {
  workspace: WorkspaceRecord
  item: WorkspaceItem
}

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'video', label: ITEM_TYPE_TEXT.video },
  { key: 'audio', label: ITEM_TYPE_TEXT.audio },
  { key: 'image', label: ITEM_TYPE_TEXT.image },
  { key: 'text', label: ITEM_TYPE_TEXT.text },
]

function collectFavorites(workspaces: WorkspaceRecord[]): FavoriteEntry[] {
  const out: FavoriteEntry[] = []
  for (const ws of workspaces) {
    const favSet = new Set(ws.favorites)
    for (const item of ws.items) {
      if (favSet.has(item.item_id)) out.push({ workspace: ws, item })
    }
  }
  out.sort(
    (a, b) =>
      new Date(b.item.updated_at).getTime() - new Date(a.item.updated_at).getTime(),
  )
  return out
}

function resultRouteFor(entry: FavoriteEntry): string {
  const { workspace, item } = entry
  const map: Record<string, string> = {
    video: 'result',
    audio: 'audio_result',
    image: 'image_result',
    text: 'text_result',
  }
  const suffix = map[item.type] ?? 'result'
  return `/workspaces/${workspace.workspace_id}/items/${item.item_id}/${suffix}`
}

export default function FavoritesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('all')

  const reload = () => {
    setLoading(true)
    setError(null)
    listWorkspaces()
      .then((list) => setWorkspaces(list))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const favorites = useMemo(() => collectFavorites(workspaces), [workspaces])
  const counts = useMemo(() => {
    const acc: Record<TabKey, number> = {
      all: favorites.length,
      video: 0,
      audio: 0,
      image: 0,
      text: 0,
    }
    for (const f of favorites) acc[f.item.type] += 1
    return acc
  }, [favorites])

  const filtered = useMemo(
    () => (tab === 'all' ? favorites : favorites.filter((f) => f.item.type === tab)),
    [favorites, tab],
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-semibold">收藏夹</h1>
          <span className="text-sm text-muted-foreground">
            {loading ? '加载中…' : `共 ${favorites.length} 项`}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          加载失败：{error}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          {TAB_DEFS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              <span className="ml-1 text-xs text-muted-foreground">
                {counts[t.key]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_DEFS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-3">
            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={t.key === 'all' ? '还没有收藏内容' : `还没有${t.label}收藏`}
                description="在工作区里点击星标即可把素材收藏到这里。"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((entry) => (
                  <FavoriteCard key={entry.item.item_id} entry={entry} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function FavoriteCard({ entry }: { entry: FavoriteEntry }) {
  const { workspace, item } = entry
  return (
    <Link to={resultRouteFor(entry)}>
      <Card className="group flex h-full flex-col gap-2 p-3 transition-colors hover:border-violet-400">
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-medium">
            {item.name || item.source_value}
          </span>
          <Badge className={ITEM_TYPE_COLOR[item.type]} variant="outline">
            {ITEM_TYPE_TEXT[item.type]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">所属：{workspace.name}</p>
        <p className="text-xs text-muted-foreground">
          更新于 {new Date(item.updated_at).toLocaleString()}
        </p>
      </Card>
    </Link>
  )
}
