/* Library — 资料库 (双区聚合页)
 *
 * 对齐 codebase: frontend/src/pages/LibraryPage/
 *   - GET /workspaces/library 返回 { items[], workspaces[] }
 *   - 顶部 chip 多选: 全部 / 视频 / 音频 / 图片 / 文字 / 工作空间
 *   - 排序菜单 6 项 (创建/完成/时长/状态)
 *   - grid / list 视图切换 (list = 真表格)
 *   - 选择模式 + 批量删除 + 单条删除
 *   - 工作空间 chip 开启时, 用本地 <WorkspaceCard> 渲染 (精致版)
 *
 * mock 数据: items from VM_DATA.MATERIALS, workspaces from VM_DATA.TASKS
 */

(() => {

const PERSIST_KEY = 'vidmirror-library-ui';
const loadPersisted = () => {
  try { return JSON.parse(localStorage.getItem(PERSIST_KEY)) || {}; }
  catch { return {}; }
};
const savePersisted = (s) => {
  try { localStorage.setItem(PERSIST_KEY, JSON.stringify(s)); } catch {}
};

/* ─── Filter / sort options ─── */
const FILTER_OPTIONS = [
  { key: 'all',       label: '全部' },
  { key: 'video',     label: '视频' },
  { key: 'audio',     label: '音频' },
  { key: 'image',     label: '图片' },
  { key: 'text',      label: '文字' },
  { key: 'workspace', label: '工作空间' },
];

const SORT_OPTIONS = [
  { value: 'created_desc',   label: '创建时间 · 新 → 旧' },
  { value: 'created_asc',    label: '创建时间 · 旧 → 新' },
  { value: 'completed_desc', label: '完成时间 · 最近在前' },
  { value: 'duration_desc',  label: '时长 · 长 → 短' },
  { value: 'duration_asc',   label: '时长 · 短 → 长' },
  { value: 'status',         label: '状态 · 错误优先' },
];

/* ─── 类型映射 (复用 workspace_card 的 TYPE_TONE) ─── */
const TYPE_ICON = { video: IcFilm, audio: IcMusic, image: IcImage, text: IcDoc };

const STATE_COLOR = {
  done:    'var(--accent-green)',
  running: 'var(--ink)',
  error:   'var(--accent)',
  queued:  'var(--ink-4)',
};
const STATE_LABEL = { done: 'done', running: 'running', queued: 'queued', error: 'error' };

const STATE_ORDER = { error: 0, running: 1, queued: 2, done: 3 };

/* ─── Helpers ─── */
const parseDuration = (meta) => {
  if (!meta) return null;
  const m = meta.match(/(\d+):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : null;
};
const formatDuration = (sec) => {
  if (sec == null || sec <= 0) return '--';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
const extractSrcLabel = (src) => {
  if (!src) return '';
  if (src.startsWith('uploads/')) return src.replace('uploads/', '');
  return src.length > 38 ? src.slice(0, 38) + '…' : src;
};

/* MATERIAL 到 workspace 的固定派发 (覆盖所有 8 个素材) */
const WS_OF_MAT = {
  m1: 'a1', m2: 'a2', m3: 'a1', m4: 'a1',
  m5: 'a3', m6: 'a5', m7: 'a1', m8: 'a6',
};

/* 把 MATERIAL + TASKS 拼成 LibraryItem 形状 */
const buildItems = () => {
  const materials = (window.VM_DATA?.MATERIALS) || [];
  const tasksById = Object.fromEntries(((window.VM_DATA?.TASKS) || []).map(t => [t.id, t]));
  const now = Date.now();
  return materials.map((m, i) => {
    const wsId = WS_OF_MAT[m.id] || 'a1';
    const ws = tasksById[wsId] || { id: wsId, title: wsId, state: 'done' };
    const ageDays = (m.id.charCodeAt(1) % 12);  // deterministic 0-11
    const created = new Date(now - ageDays * 86400 * 1000);
    const status =
      m.state === 'done'    ? 'SUCCESS' :
      m.state === 'running' ? 'RUNNING' :
      m.state === 'error'   ? 'FAILED'  :
      m.state === 'queued'  ? 'QUEUED'  : 'PENDING';
    return {
      item_id:       m.id,
      workspace_id:  wsId,
      workspace_name: ws.title,
      type:          m.type,
      source_value:  m.source,
      name:          m.title,
      created_at:    created.toISOString(),
      updated_at:    created.toISOString(),
      duration_seconds: parseDuration(m.meta),
      thumb_idx:     m.thumb,
      tags:          m.tags || [],
      meta:          m.meta,
      primary_task_status: status,
      _state:        m.state,
    };
  });
};

/* 状态字符串映射 — 与 codebase primaryStatusToState 一致 */
const primaryStatusToState = (raw) => {
  if (!raw) return 'queued';
  const s = raw.toUpperCase();
  if (s === 'SUCCESS') return 'done';
  if (s === 'FAILED' || s === 'CANCELLED') return 'error';
  if (s === 'QUEUED') return 'queued';
  return 'running';
};

/* ─── 排序逻辑 (与 codebase sortItems 一致) ─── */
const sortItems = (items, sortBy) => {
  const arr = [...items];
  const byTs = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  switch (sortBy) {
    case 'created_desc':   return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case 'created_asc':    return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case 'completed_desc': return arr.sort((a, b) => {
      const ad = a._state === 'done' ? new Date(a.updated_at).getTime() : 0;
      const bd = b._state === 'done' ? new Date(b.updated_at).getTime() : 0;
      if (ad && bd) return bd - ad;
      if (ad) return -1;
      if (bd) return 1;
      return byTs(a, b);
    });
    case 'duration_desc': return arr.sort((a, b) => {
      const da = a.duration_seconds ?? -1, db = b.duration_seconds ?? -1;
      if (da >= 0 && db >= 0) return db - da;
      if (da >= 0) return -1;
      if (db >= 0) return 1;
      return byTs(a, b);
    });
    case 'duration_asc': return arr.sort((a, b) => {
      const da = a.duration_seconds ?? -1, db = b.duration_seconds ?? -1;
      if (da >= 0 && db >= 0) return da - db;
      if (da >= 0) return -1;
      if (db >= 0) return 1;
      return byTs(a, b);
    });
    case 'status': return arr.sort((a, b) => {
      const sa = STATE_ORDER[primaryStatusToState(a.primary_task_status)] ?? 9;
      const sb = STATE_ORDER[primaryStatusToState(b.primary_task_status)] ?? 9;
      if (sa !== sb) return sa - sb;
      return byTs(a, b);
    });
    default: return arr;
  }
};

/* ═══════════════════════════════════════════
   FilterChips
   ═══════════════════════════════════════════ */
const FilterChips = ({ selected, onToggle, counts }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
    {FILTER_OPTIONS.map(({ key, label }) => {
      const active = selected.includes(key);
      const count = counts?.[key];
      return (
        <button
          key={key}
          onClick={() => onToggle(key)}
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
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              opacity: 0.7, fontWeight: 500,
            }}>{count}</span>
          )}
        </button>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════
   SortMenu
   ═══════════════════════════════════════════ */
const SortMenu = ({ sortBy, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const current = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? '排序';

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="btn"
        style={{ gap: 6, fontSize: 12, height: 32, padding: '0 12px' }}
      >
        {current}
        <span style={{
          display: 'inline-block', transform: open ? 'rotate(180deg)' : '',
          transition: 'transform 140ms', lineHeight: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
            <path d="M3 5l3.5 3.5L10 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          minWidth: 200,
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 50, padding: 4,
        }}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 6, fontSize: 12,
                color:      opt.value === sortBy ? 'var(--ink)' : 'var(--ink-3)',
                background: opt.value === sortBy ? 'var(--bg-sunken)' : 'transparent',
                border: 'none', cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   ViewToggle (grid ⇄ list)
   ═══════════════════════════════════════════ */
const ViewToggle = ({ value, onChange }) => (
  <div style={{
    display: 'flex', gap: 4, padding: 3,
    background: 'var(--bg-sunken)', borderRadius: 10,
  }}>
    {[
      { id: 'grid', ic: IcGrid, title: '网格视图' },
      { id: 'list', ic: IcList, title: '列表视图' },
    ].map(({ id, ic: Ic, title }) => {
      const on = value === id;
      return (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={title}
          style={{
            padding: '6px 10px', borderRadius: 7, fontSize: 12,
            background: on ? 'var(--bg-elev)' : 'transparent',
            color:      on ? 'var(--ink)'     : 'var(--ink-3)',
            boxShadow:  on ? 'var(--shadow-sm)' : 'none',
            border: 'none', cursor: 'pointer',
            display: 'inline-grid', placeItems: 'center',
          }}
        >
          <Ic size={14}/>
        </button>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════
   ItemCard (grid)
   ═══════════════════════════════════════════ */
const ItemCard = ({ item, selected, selectMode, onToggle, onDelete, onOpen }) => {
  const Icon       = TYPE_ICON[item.type] || IcDoc;
  const state      = primaryStatusToState(item.primary_task_status);
  const stateColor = STATE_COLOR[state];
  const stateLabel = STATE_LABEL[state];
  const dur        = formatDuration(item.duration_seconds);
  const hasDur     = item.duration_seconds && item.duration_seconds > 0;
  const srcLabel   = extractSrcLabel(item.source_value);
  const frames     = (window.VM_DATA?.FRAMES) || [];
  const frame      = frames[item.thumb_idx % frames.length];
  const thumbSrc   = frame ? `assets/frame_${frame.ts.replace(/:/g, '_')}.svg` : null;

  return (
    <div
      onClick={() => selectMode ? onToggle(item) : onOpen(item)}
      data-comment-anchor={`library-item-${item.item_id}`}
      style={{
        position: 'relative', cursor: 'pointer',
        background: 'var(--bg-elev)',
        border: '1px solid', borderColor: selected ? 'var(--ink)' : 'var(--line)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        const del = e.currentTarget.querySelector('[data-del]');
        if (del) del.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
        const del = e.currentTarget.querySelector('[data-del]');
        if (del) del.style.opacity = '0';
      }}
    >
      {/* ── Thumbnail ── */}
      <div style={{
        aspectRatio: '16/9',
        background: '#0a0a0a',
        position: 'relative', overflow: 'hidden',
        display: 'grid', placeItems: 'center',
      }}>
        {thumbSrc && item.type !== 'text' && item.type !== 'audio' ? (
          <img src={thumbSrc} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          }}/>
        ) : (
          <Icon size={32} stroke="rgba(255,255,255,0.45)" sw={1.2}/>
        )}

        {/* progress bar for running items */}
        {item._state === 'running' && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
            background: 'rgba(255,255,255,0.18)',
          }}>
            <div style={{
              height: '100%', width: '40%',
              background: 'var(--accent)',
              transition: 'width 400ms',
            }}/>
          </div>
        )}

        {/* state badge — top-left */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 99,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          fontSize: 10, color: '#fff', fontFamily: 'var(--mono)',
          letterSpacing: '0.04em',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: stateColor }}/>
          {stateLabel}
        </div>

        {/* top-right — selection / duration */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          {selectMode && (
            <span
              onClick={(e) => { e.stopPropagation(); onToggle(item); }}
              style={{
                cursor: 'pointer', display: 'grid', placeItems: 'center',
                width: 22, height: 22, borderRadius: 99,
                background: selected ? '#fff' : 'rgba(0,0,0,0.5)',
                color: selected ? 'var(--ink)' : '#fff',
                border: '1.5px solid', borderColor: selected ? '#fff' : 'rgba(255,255,255,0.6)',
                transition: 'all 120ms',
              }}
            >
              {selected && <IcCheck size={12} sw={3}/>}
            </span>
          )}
          {!selectMode && (
            <>
              <button
                data-del=""
                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                title="删除"
                style={{
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                  border: 'none', borderRadius: 7,
                  padding: '4px 5px', cursor: 'pointer',
                  color: '#fff', display: 'grid', placeItems: 'center',
                  opacity: 0, transition: 'opacity 140ms, background 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}
              >
                <Icon size={0}/>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
                </svg>
              </button>
              {hasDur && (
                <span style={{
                  padding: '2px 7px', borderRadius: 6,
                  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                  fontSize: 10, color: '#fff', fontFamily: 'var(--mono)',
                }}>{dur}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Meta ── */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6,
        }}>
          <Icon size={14} sw={1.5} style={{ color: 'var(--ink-3)', flexShrink: 0, marginTop: 2 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div title={item.name} style={{
              fontSize: 13.5, fontWeight: 500, lineHeight: 1.35,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{item.name || '未命名'}</div>
          </div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 10.5,
          color: 'var(--ink-3)', letterSpacing: '0.04em',
        }}>
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>{srcLabel}</span>
          <span style={{ flexShrink: 0, opacity: 0.7 }}>{item.workspace_name}</span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   ListView (table)
   ═══════════════════════════════════════════ */
const ListView = ({ items, selectMode, selectedSet, selectionKey, onToggle, onOpen, onDelete }) => {
  const thStyle = {
    padding: '10px 14px', textAlign: 'left', fontWeight: 500,
    fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.08em',
    color: 'var(--ink-3)', textTransform: 'uppercase',
    background: 'var(--bg-sunken)',
  };
  const tdStyle = { padding: '12px 14px', fontSize: 13 };
  const monoTd  = { padding: '12px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return iso.slice(0, 16); }
  };

  return (
    <div style={{
      borderRadius: 'var(--radius)',
      border: '1px solid var(--line)',
      overflow: 'hidden',
      background: 'var(--bg-elev)',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {selectMode && <th style={{ ...thStyle, width: 36 }}></th>}
            <th style={thStyle}>名称</th>
            <th style={{ ...thStyle, width: 80 }}>类型</th>
            <th style={{ ...thStyle, width: 110 }}>状态</th>
            <th style={{ ...thStyle, width: 80 }}>时长</th>
            <th style={{ ...thStyle, width: 160 }}>工作空间</th>
            <th style={{ ...thStyle, width: 100 }}>创建时间</th>
            <th style={{ ...thStyle, width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const Icon       = TYPE_ICON[item.type] || IcDoc;
            const state      = primaryStatusToState(item.primary_task_status);
            const stateColor = STATE_COLOR[state];
            const stateLabel = STATE_LABEL[state];
            const isSel      = selectedSet.has(selectionKey(item.workspace_id, item.item_id));
            return (
              <tr
                key={item.item_id}
                onClick={() => selectMode ? onToggle(item) : onOpen(item)}
                style={{
                  cursor: 'pointer',
                  borderTop: '1px solid var(--line)',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
              >
                {selectMode && (
                  <td style={tdStyle} onClick={(e) => { e.stopPropagation(); onToggle(item); }}>
                    <span style={{
                      display: 'grid', placeItems: 'center',
                      width: 18, height: 18, borderRadius: 99,
                      background: isSel ? 'var(--ink)' : 'transparent',
                      color: isSel ? 'var(--bg)' : 'var(--ink-3)',
                      border: '1.5px solid', borderColor: isSel ? 'var(--ink)' : 'var(--line-strong)',
                    }}>
                      {isSel && <IcCheck size={10} sw={3}/>}
                    </span>
                  </td>
                )}
                <td style={tdStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} sw={1.4} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{item.name || '未命名'}</span>
                  </div>
                </td>
                <td style={monoTd}>{item.type}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontFamily: 'var(--mono)',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: 99, background: stateColor }}/>
                    {stateLabel}
                  </span>
                </td>
                <td style={monoTd}>{formatDuration(item.duration_seconds)}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-2)' }}>
                  {item.workspace_name}
                </td>
                <td style={monoTd}>{formatDate(item.created_at)}</td>
                <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onDelete(item)}
                    title="删除"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--ink-4)', display: 'grid', placeItems: 'center',
                      padding: 4, borderRadius: 4,
                      transition: 'color 120ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-4)'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════════════════════
   EmptyState
   ═══════════════════════════════════════════ */
const EmptyState = ({ kind, onClear, onCreate }) => {
  const map = {
    none: {
      title: '资料库还是空的',
      sub: '把一条链接或几张图粘到一起 —— 这就是一个工作空间。',
      showClear: false,
    },
    filtered: {
      title: '没有匹配的素材',
      sub: '试试清除筛选，或者切换排序。',
      showClear: true,
    },
    ws_filtered: {
      title: '没有匹配的工作空间',
      sub: '当前筛选下，所有工作空间都被排除。',
      showClear: true,
    },
  };
  const m = map[kind] || map.filtered;
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18, padding: '80px 40px',
      background: 'var(--bg-elev)',
      border: '1px dashed var(--line-strong)',
      borderRadius: 'var(--radius-lg)',
    }}>
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none">
        <rect x="8"  y="14" width="40" height="50" rx="6" fill="var(--bg-sunken)" stroke="var(--line-strong)"/>
        <rect x="42" y="8"  width="40" height="56" rx="6" fill="var(--bg-elev)"   stroke="var(--line-strong)"/>
        <rect x="74" y="18" width="40" height="46" rx="6" fill="var(--bg-sunken)" stroke="var(--line-strong)"/>
        <line x1="52" y1="22" x2="72" y2="22" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="52" y1="30" x2="68" y2="30" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="52" y1="38" x2="70" y2="38" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 24, lineHeight: 1.2, marginBottom: 8 }}>
          {m.title}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          {m.sub}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {m.showClear && (
          <button className="btn" onClick={onClear}>
            <IcX size={13}/>清除筛选
          </button>
        )}
        <button className="btn btn-primary" onClick={onCreate}>
          <IcPlus size={13}/>新建工作空间
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   Library main
   ═══════════════════════════════════════════ */
const Library = ({ onPickTask, onPickItem, onCreateTask }) => {
  const persisted = loadPersisted();
  const [selectedFilters, setSelectedFilters] = React.useState(persisted.filters || ['all']);
  const [sortBy, setSortBy]   = React.useState(persisted.sortBy || 'created_desc');
  const [viewMode, setViewMode] = React.useState(persisted.viewMode || 'grid');
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedSet, setSelectedSet] = React.useState(new Set());
  const [deletedIds, setDeletedIds] = React.useState(new Set());

  /* persist on change */
  React.useEffect(() => {
    savePersisted({ filters: selectedFilters, sortBy, viewMode });
  }, [selectedFilters, sortBy, viewMode]);

  /* base data */
  const allItems = React.useMemo(() => buildItems(), []);
  const allWorkspaces = (window.VM_DATA?.TASKS) || [];

  /* filter logic */
  const toggleFilter = (key) => {
    setSelectedFilters(prev => {
      const has = prev.includes(key);
      if (key === 'all') return ['all'];
      if (has) {
        const next = prev.filter(k => k !== key);
        return next.length > 0 ? next : ['all'];
      }
      return prev.filter(k => k !== 'all').concat(key);
    });
  };

  const showAll       = selectedFilters.includes('all');
  const showWorkspace = selectedFilters.includes('workspace');
  const typeFilters   = selectedFilters.filter(k => k !== 'all' && k !== 'workspace');

  /* visible items */
  const visibleItems = React.useMemo(() => {
    let items;
    if (showAll) {
      items = allItems;
    } else if (typeFilters.length === 0) {
      items = [];
    } else {
      items = allItems.filter(it => typeFilters.includes(it.type));
    }
    items = items.filter(it => !deletedIds.has(it.item_id));
    return sortItems(items, sortBy);
  }, [allItems, showAll, typeFilters.join('|'), sortBy, deletedIds]);

  const visibleWorkspaces = showWorkspace ? allWorkspaces : null;

  /* filter chip counts */
  const aliveItems = allItems.filter(it => !deletedIds.has(it.item_id));
  const chipCounts = {
    all:   aliveItems.length,
    video: aliveItems.filter(i => i.type === 'video').length,
    audio: aliveItems.filter(i => i.type === 'audio').length,
    image: aliveItems.filter(i => i.type === 'image').length,
    text:  aliveItems.filter(i => i.type === 'text').length,
    workspace: allWorkspaces.length,
  };

  /* selection */
  const selectionKey = (ws, id) => `${ws}:${id}`;
  const toggleSelect = React.useCallback((item) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      const k = selectionKey(item.workspace_id, item.item_id);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }, []);
  const selectAll = () => {
    setSelectedSet(new Set(visibleItems.map(it => selectionKey(it.workspace_id, it.item_id))));
  };
  const clearSelection = () => {
    setSelectedSet(new Set());
    setSelectMode(false);
  };
  const enterSelectMode = () => {
    setSelectedSet(new Set());
    setSelectMode(true);
  };

  /* delete */
  const handleDeleteOne = (item) => {
    if (!window.confirm(`确定删除「${item.name || '未命名'}」？`)) return;
    setDeletedIds(prev => { const n = new Set(prev); n.add(item.item_id); return n; });
  };
  const handleBatchDelete = () => {
    if (selectedSet.size === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedSet.size} 个素材？此操作不可撤销。`)) return;
    const ids = new Set([...selectedSet].map(k => k.split(':').slice(1).join(':')));
    setDeletedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    setSelectedSet(new Set());
  };

  /* eyebrow stat */
  const itemsOnly = showWorkspace && typeFilters.length === 0;
  const statLabel = itemsOnly
    ? `${visibleWorkspaces?.length ?? 0} WORKSPACES`
    : `${visibleItems.length} ITEMS`;

  /* show item section unless we are workspace-only */
  const showItemSection     = !itemsOnly;
  const showSectionDividers = showWorkspace && typeFilters.length > 0;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 32px 80px' }}
         data-screen-label="Library / 资料库">

      {/* ─── Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, marginBottom: 28, flexWrap: 'wrap',
      }}>
        <div>
          <div className="eyebrow">LIBRARY · {statLabel} · LOCAL</div>
          <h1 className="display" style={{
            fontSize: 'clamp(56px, 7vw, 92px)', lineHeight: 0.98,
            margin: '10px 0 4px', letterSpacing: '-0.02em',
          }}>资料库</h1>
          <p style={{
            fontSize: 16, color: 'var(--ink-3)', maxWidth: 560,
            margin: '12px 0 0', lineHeight: 1.55,
          }}>
            横切所有工作空间的素材池。按类型筛、按时长/状态排，找到该用的那一个。
          </p>
        </div>

        {/* right controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Selection controls */}
          {visibleItems.length > 0 && (selectMode ? (
            <>
              <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={selectAll}>
                全选
              </button>
              <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={clearSelection}>
                取消
              </button>
              {selectedSet.size > 0 && (
                <button
                  className="btn"
                  style={{
                    fontSize: 12, height: 32,
                    color: 'var(--accent)', borderColor: 'var(--accent)',
                  }}
                  onClick={handleBatchDelete}
                >
                  删除 ({selectedSet.size})
                </button>
              )}
            </>
          ) : (
            <button className="btn" style={{ fontSize: 12, height: 32 }} onClick={enterSelectMode}>
              选择
            </button>
          ))}

          <SortMenu sortBy={sortBy} onChange={setSortBy}/>
          <ViewToggle value={viewMode} onChange={setViewMode}/>

          {/* Import (placeholder, matches codebase) */}
          <button
            className="btn btn-primary"
            style={{ opacity: 0.55, cursor: 'not-allowed', height: 32, fontSize: 12 }}
            title="导入功能即将推出"
            onClick={(e) => e.preventDefault()}
          >
            <IcUpload size={13}/>导入
          </button>
        </div>
      </div>

      {/* ─── Filter chips ─── */}
      <FilterChips selected={selectedFilters} onToggle={toggleFilter} counts={chipCounts}/>

      {/* ─── Workspace section ─── */}
      {visibleWorkspaces && visibleWorkspaces.length > 0 && (
        <>
          {showSectionDividers && (
            <div className="eyebrow" style={{ marginBottom: 14, marginTop: 4 }}>
              工作空间 · {visibleWorkspaces.length}
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 18,
            marginBottom: showItemSection ? 32 : 0,
          }}>
            {visibleWorkspaces.map(ws => (
              <WorkspaceCard key={ws.id} task={ws} onOpen={onPickTask}/>
            ))}
          </div>
        </>
      )}

      {showWorkspace && visibleWorkspaces && visibleWorkspaces.length === 0 && (
        <EmptyState
          kind="ws_filtered"
          onClear={() => setSelectedFilters(['all'])}
          onCreate={onCreateTask}
        />
      )}

      {/* ─── Item section ─── */}
      {showItemSection && (
        <>
          {showSectionDividers && visibleItems.length > 0 && (
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              素材 · {visibleItems.length}
            </div>
          )}
          {visibleItems.length === 0 ? (
            <EmptyState
              kind={showAll && aliveItems.length === 0 ? 'none' : 'filtered'}
              onClear={() => setSelectedFilters(['all'])}
              onCreate={onCreateTask}
            />
          ) : viewMode === 'list' ? (
            <ListView
              items={visibleItems}
              selectMode={selectMode}
              selectedSet={selectedSet}
              selectionKey={selectionKey}
              onToggle={toggleSelect}
              onOpen={onPickItem}
              onDelete={handleDeleteOne}
            />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {visibleItems.map(item => (
                <ItemCard
                  key={item.item_id}
                  item={item}
                  selected={selectedSet.has(selectionKey(item.workspace_id, item.item_id))}
                  selectMode={selectMode}
                  onToggle={toggleSelect}
                  onDelete={handleDeleteOne}
                  onOpen={onPickItem}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

Object.assign(window, { Library });

})();
