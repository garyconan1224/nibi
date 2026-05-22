import { useLibraryStore, FILTER_OPTIONS } from '@/store/libraryStore'

export function FilterChips() {
  const selectedFilters = useLibraryStore((s) => s.selectedFilters)
  const toggleFilter = useLibraryStore((s) => s.toggleFilter)

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
      {FILTER_OPTIONS.map(({ key, label }) => {
        const active = selectedFilters.includes(key)
        return (
          <button
            key={key}
            onClick={() => toggleFilter(key)}
            className="chip"
            style={{
              cursor: 'pointer',
              background: active ? 'var(--pill-bg)' : 'var(--bg-sunken)',
              color: active ? 'var(--pill-ink)' : 'var(--ink-2)',
              borderColor: active ? 'var(--pill-bg)' : 'var(--line)',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
