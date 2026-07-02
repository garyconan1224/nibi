import { BookOpen, RefreshCw, Search } from 'lucide-react'

export default function KnowledgePage() {
  return (
    <main className="flex h-full min-h-0 flex-col bg-background">
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Global Knowledge
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">知识库</h1>
          </div>
          <button className="btn btn-sm" disabled>
            <RefreshCw size={14} />
            刷新索引
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col px-6 py-5">
        <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
          <BookOpen size={16} />
          <span>全局问答索引将在下一步接入。</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
          <div className="flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
            先去做几篇笔记，知识库会自动收录。
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              <Search size={16} />
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                disabled
                placeholder="向所有笔记提问"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
