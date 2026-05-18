/* Phase 3C — 7 维度标签库
 *
 *  ItemTagsPanel       : 嵌入 4 个 result 详情页顶部, 显示该 item 的 7 维度标签 + 重新生成
 *  WorkspaceTagFilter  : 嵌入 TasksDrawer (workspace 列表) 顶部的 chip filter row
 *  TaskTagPreview      : 在每个 task 行底部叠加 3-5 颗标签预览 (additive, 不替换原行)
 *
 *  视觉延用 token: --bg-elev / --line / --accent* / .summary-card / .kw
 */

/* ─── 相对时间 (基于 _generated_at_display 字段, 已在 data.js 中预计算) ─── */
const itGetRelative = (t) => t?._generated_at_display || (t?._generated_at ? t._generated_at.split('T')[0] : '—');

/* ═══════════════════════════════════════════
   ItemTagsPanel — 用于 4 个 result 详情页顶部
   ═══════════════════════════════════════════ */
const ItemTagsPanel = ({ itemId = 'm1', itemTitle, compact = false }) => {
  const T = VM_DATA.TAG_DIMENSIONS;
  const order = VM_DATA.TAG_DIM_ORDER;
  const initial = VM_DATA.ITEM_TAGS?.[itemId] || null;

  const [tags, setTags] = React.useState(initial);
  const [regen, setRegen] = React.useState(false);
  const [toast, setToast] = React.useState(false);

  const doRegen = () => {
    if (regen) return;
    setRegen(true);
    setTimeout(() => {
      // For demo: re-use sample data; in production this is the API call
      const fallback = VM_DATA.ITEM_TAGS?.m1;
      setTags({ ...(initial || fallback || {}), _generated_at_display:'刚刚', _generated_model:'Qwen/Qwen2.5-72B-Instruct' });
      setRegen(false);
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    }, 1400);
  };

  /* Empty state */
  if (!tags) {
    return (
      <div className="it-panel it-empty" data-compact={compact}>
        <div className="it-head">
          <div className="it-head-l">
            <div className="eyebrow it-eyebrow">
              <span>CONTENT TAGS · 内容标签</span>
              <span className="ks-eyebrow-tag">PHASE 3C</span>
            </div>
            <div className="it-meta">暂无标签 — 点右上角「重新生成」让 AI 自动打标</div>
          </div>
          <button className="btn it-regen" onClick={doRegen} disabled={regen}>
            {regen
              ? <><span className="spinner" style={{width:13,height:13,borderWidth:1.5}}/> 生成中</>
              : <><IcSpark size={13}/> 重新生成</>}
          </button>
        </div>
        <div className="it-empty-strip">
          {order.map(k => (
            <div key={k} className="it-badge it-badge-skel" aria-hidden="true">
              <span className="it-badge-k mono">{T[k].short}</span>
              <span className="it-badge-sep">·</span>
              <span className="it-badge-v" style={{opacity:0.35}}>—</span>
            </div>
          ))}
        </div>
        {toast && <div className="it-toast">✓ 标签已生成</div>}
      </div>
    );
  }

  return (
    <div className="it-panel" data-compact={compact} data-regen={regen}>
      <div className="it-head">
        <div className="it-head-l">
          <div className="eyebrow it-eyebrow">
            <span>CONTENT TAGS · 内容标签</span>
            <span className="ks-eyebrow-tag">PHASE 3C</span>
          </div>
          <div className="it-meta">
            <span>AI 自动打标</span>
            <span className="it-meta-dot">·</span>
            <span>{itGetRelative(tags)}</span>
            <span className="it-meta-dot">·</span>
            <span className="mono it-meta-model">{tags._generated_model}</span>
          </div>
        </div>
        <button className="btn it-regen" onClick={doRegen} disabled={regen} title="重新让 AI 打标">
          {regen
            ? <><span className="spinner" style={{width:13,height:13,borderWidth:1.5}}/> 生成中</>
            : <><IcSpark size={13}/> 重新生成</>}
        </button>
      </div>

      <div className="it-badges">
        {order.map(k => tags[k] && (
          <div key={k} className="it-badge" data-tone={T[k].tone} title={T[k].label}>
            <span className="it-badge-k mono">{T[k].short}</span>
            <span className="it-badge-sep">·</span>
            <span className="it-badge-v">{tags[k]}</span>
          </div>
        ))}
        {(tags.custom_tags || []).length > 0 && <span className="it-badge-divider"/>}
        {(tags.custom_tags || []).map((c, i) => (
          <div key={i} className="it-badge it-badge-custom" title="自定义标签">
            <span className="it-badge-hash">#</span>
            <span>{c}</span>
          </div>
        ))}
      </div>

      {toast && <div className="it-toast"><IcCheck size={12}/> 标签已更新</div>}
    </div>
  );
};

/* ═══════════════════════════════════════════
   WorkspaceTagFilter — workspace 列表顶部的 chip filter row
   filter 状态形状: { content_type: Set<string>, ..., custom: string }
   ═══════════════════════════════════════════ */

/* ── 单个维度的 chip + dropdown ── */
const TagFilterChip = ({ dim, dimKey, selected, setSelected, openId, setOpenId }) => {
  const ref = React.useRef(null);
  const open = openId === dimKey;
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpenId(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpenId]);

  const toggle = (v) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    setSelected(next);
  };
  const clear = () => setSelected(new Set());

  const n = selected.size;
  let label;
  if (n === 0) label = dim.label;
  else if (n === 1) label = `${dim.short}: ${[...selected][0]}`;
  else label = `${dim.short} (${n})`;

  return (
    <div className="tf-chip-wrap" ref={ref}>
      <button className="tf-chip" data-tone={dim.tone} data-on={n > 0} data-open={open}
              onClick={() => setOpenId(open ? null : dimKey)}>
        <span className="tf-chip-label">{label}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" className="tf-chip-caret">
          <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="tf-pop">
          <div className="tf-pop-head">
            <span className="eyebrow">{dim.label.toUpperCase()} · {dim.label}</span>
            {n > 0 && <button className="tf-pop-clear" onClick={clear}>清空</button>}
          </div>
          <div className="tf-pop-body">
            {dim.options.map(opt => {
              const on = selected.has(opt);
              return (
                <button key={opt} className="tf-opt" data-on={on} onClick={() => toggle(opt)}>
                  <span className="tf-opt-box">
                    {on && <IcCheck size={10}/>}
                  </span>
                  <span className="tf-opt-label">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── filter 主组件 ── */
const WorkspaceTagFilter = ({ value, onChange, matches, total }) => {
  const T = VM_DATA.TAG_DIMENSIONS;
  const order = VM_DATA.TAG_DIM_ORDER;
  const [openId, setOpenId] = React.useState(null);

  const setDim = (k) => (next) => onChange({ ...value, [k]: next });
  const setCustom = (e) => onChange({ ...value, custom: e.target.value });

  const activeCount = order.reduce((n, k) => n + (value[k]?.size || 0), 0) + (value.custom?.trim() ? 1 : 0);
  const clearAll = () => onChange({ ...Object.fromEntries(order.map(k => [k, new Set()])), custom:'' });

  return (
    <div className="tf-wrap">
      <div className="tf-row">
        {order.map(k => (
          <TagFilterChip key={k} dim={T[k]} dimKey={k}
            selected={value[k] || new Set()}
            setSelected={setDim(k)}
            openId={openId} setOpenId={setOpenId}/>
        ))}
      </div>
      <div className="tf-row tf-row-2">
        <div className="tf-custom">
          <span className="tf-custom-hash">#</span>
          <input value={value.custom || ''} onChange={setCustom}
            placeholder="自定义关键词 (contains)" />
          {value.custom && (
            <button className="tf-custom-x" onClick={() => onChange({ ...value, custom:'' })} title="清空"><IcX size={11}/></button>
          )}
        </div>
        <div className="tf-row2-spacer"/>
        <span className="tf-match-meta mono">
          {activeCount > 0 ? `${matches}/${total}` : `${total}`} 个工作空间
        </span>
        {activeCount > 0 && (
          <button className="tf-clear" onClick={clearAll}>
            <IcX size={11}/> 清除 ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   筛选逻辑 helpers
   ═══════════════════════════════════════════ */
const wsMatchesFilter = (taskTags, filter) => {
  if (!taskTags) return false;
  const order = VM_DATA.TAG_DIM_ORDER;
  // 跨维度 AND
  for (const k of order) {
    const sel = filter[k];
    if (!sel || sel.size === 0) continue;
    const wsVals = taskTags[k] || [];
    // 同维度多选 OR
    const anyHit = wsVals.some(v => sel.has(v));
    if (!anyHit) return false;
  }
  // 自定义关键词 (contains 任一 custom_tag)
  if (filter.custom && filter.custom.trim()) {
    const q = filter.custom.trim().toLowerCase();
    const ct = taskTags.custom_tags || [];
    if (!ct.some(t => t.toLowerCase().includes(q))) return false;
  }
  return true;
};

/* ═══════════════════════════════════════════
   TaskTagPreview — 在每个 task 行底部叠 3-5 颗最相关 tag (additive)
   高亮当前 filter 命中的 tag
   ═══════════════════════════════════════════ */
const TaskTagPreview = ({ taskId, filter }) => {
  const tags = VM_DATA.TASK_TAGS?.[taskId];
  if (!tags) return null;
  const T = VM_DATA.TAG_DIMENSIONS;
  const order = VM_DATA.TAG_DIM_ORDER;

  // 取每个维度的第一个值作为预览, 加上 1-2 个 custom_tag
  const chips = [];
  for (const k of order) {
    const v = tags[k]?.[0];
    if (!v) continue;
    const hit = filter?.[k]?.has?.(v);
    chips.push({ kind:'dim', dim:k, value:v, hit });
    if (chips.length >= 3) break;
  }
  const customQ = filter?.custom?.trim?.()?.toLowerCase();
  for (const c of (tags.custom_tags || []).slice(0, 2)) {
    const hit = customQ && c.toLowerCase().includes(customQ);
    chips.push({ kind:'custom', value:c, hit });
  }

  return (
    <div className="ttp-row">
      {chips.map((c, i) => (
        c.kind === 'dim' ? (
          <span key={i} className="ttp-chip" data-tone={T[c.dim].tone} data-hit={!!c.hit}>
            <span className="ttp-chip-k mono">{T[c.dim].short}</span>
            <span className="ttp-chip-v">{c.value}</span>
          </span>
        ) : (
          <span key={i} className="ttp-chip ttp-chip-custom" data-hit={!!c.hit}>
            #{c.value}
          </span>
        )
      ))}
      {(tags.items_total && tags.items_with_tags < tags.items_total) && (
        <span className="ttp-progress mono" title="该工作空间内已打标素材数">
          {tags.items_with_tags}/{tags.items_total} 已打标
        </span>
      )}
    </div>
  );
};

/* default empty filter */
const ITF_EMPTY = () => ({
  ...Object.fromEntries(VM_DATA.TAG_DIM_ORDER.map(k => [k, new Set()])),
  custom: '',
});

/* localStorage round-trip for filter state */
const ITF_save = (f) => {
  const out = {};
  for (const k of VM_DATA.TAG_DIM_ORDER) {
    if (f[k] && f[k].size > 0) out[k] = [...f[k]];
  }
  if (f.custom) out.custom = f.custom;
  try { localStorage.setItem('vm-ws-filter', JSON.stringify(out)); } catch (e) {}
};
const ITF_load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('vm-ws-filter') || '{}');
    const f = ITF_EMPTY();
    for (const k of VM_DATA.TAG_DIM_ORDER) {
      if (Array.isArray(raw[k])) f[k] = new Set(raw[k]);
    }
    if (typeof raw.custom === 'string') f.custom = raw.custom;
    return f;
  } catch (e) { return ITF_EMPTY(); }
};

Object.assign(window, {
  ItemTagsPanel, WorkspaceTagFilter, TaskTagPreview,
  wsMatchesFilter, ITF_EMPTY, ITF_save, ITF_load,
});
