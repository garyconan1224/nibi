import { useLibraryStore, FILTER_OPTIONS, type FilterKey } from '@/store/libraryStore'

interface FilterChipsProps {
  counts?: Record<FilterKey, number>
}

export function FilterChips({ counts }: FilterChipsProps) {
  const selectedFilters = useLibraryStore((s) => s.selectedFilters)
  const toggleFilter = useLibraryStore((s) => s.toggleFilter)

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
      {FILTER_OPTIONS.map(({ key, label }) => {
        const active = selectedFilters.includes(key)
        const count = counts?.[key]
        return (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className="chip"
            style={{
              cursor: 'pointer',
              gap: 7,
              background: active ? 'var(--pill-bg)' : 'var(--bg-sunken)',
              color: active ? 'var(--pill-ink)' : 'var(--ink-2)',
              borderColor: active ? 'var(--pill-bg)' : 'var(--line)',
              transition: 'all 140ms ease',
            }}
          >
            {label}
            {count != null && (
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  opacity: 0.7,
                  fontWeight: 500,
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
