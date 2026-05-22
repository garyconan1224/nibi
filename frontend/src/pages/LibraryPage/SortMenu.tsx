import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLibraryStore, SORT_OPTIONS } from '@/store/libraryStore'

export function SortMenu() {
  const sortBy = useLibraryStore((s) => s.sortBy)
  const setSortBy = useLibraryStore((s) => s.setSortBy)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? '排序'

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn"
        style={{ gap: 6, fontSize: 12, height: 32, padding: '0 12px' }}
      >
        {currentLabel}
        <ChevronDown size={13} style={{ transition: 'transform 140ms', transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 190,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
            padding: 4,
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSortBy(opt.value)
                close()
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                color: opt.value === sortBy ? 'var(--ink)' : 'var(--ink-3)',
                background: opt.value === sortBy ? 'var(--bg-sunken)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
