import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, GitFork } from 'lucide-react'
import type { Markmap } from 'markmap-view'
import { transformMarkdown, createMarkmap } from '@/lib/markmap'

interface MarkmapComponentProps {
  /** Markdown 字符串，用于生成思维导图 */
  markdown: string
}

/**
 * MarkmapComponent
 *
 * - 接受 markdown prop
 * - 动态 import markmap-lib（约 200KB）避免首屏阻塞
 * - 将 Markdown 转换为 AST，渲染为 SVG 思维导图
 * - 支持缩放 / 平移（markmap-view 内置）
 */
export default function MarkmapComponent({ markdown }: MarkmapComponentProps) {
  const { t } = useTranslation('homePage')
  const svgRef = useRef<SVGSVGElement>(null)
  const mmRef = useRef<Markmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!svgRef.current || !markdown.trim()) {
      setLoading(false)
      return
    }

    let cancelled = false

    const init = async () => {
      setLoading(true)
      setError(null)
      try {
        // 动态加载并转换
        const result = await transformMarkdown(markdown)
        if (cancelled) return

        if (mmRef.current) {
          // 已有实例：仅更新数据
          await mmRef.current.setData(result.root)
          await mmRef.current.fit()
        } else {
          // 首次创建实例
          mmRef.current = await createMarkmap(svgRef.current!, result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('viewer.loadMarkmap'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [markdown, t])

  // 组件卸载时销毁 markmap 实例并释放引用
  useEffect(() => {
    return () => {
      mmRef.current?.destroy()
      mmRef.current = null
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-red-500">
        <GitFork className="h-8 w-8 opacity-50" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[400px] w-full overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">{t('viewer.loadMarkmap')}</span>
        </div>
      )}
      <svg
        ref={svgRef}
        className="h-full w-full"
        style={{ display: markdown.trim() ? 'block' : 'none' }}
      />
      {!markdown.trim() && !loading && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <GitFork className="h-8 w-8 opacity-30" />
          <p className="text-sm">{t('tabs.mindmap')}</p>
        </div>
      )}
    </div>
  )
}

