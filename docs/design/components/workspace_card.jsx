/* WorkspaceCard — 精致的工作空间卡片
 *
 * 从原 library.jsx 中抽出来，作为可复用组件。
 * 两种变体：
 *   - default : 完整卡片，含 4 帧拼图 + 组成统计 + 状态徽标 footer
 *   - compact : 紧凑卡片，用于 Workbench 最近工作空间一行；
 *               去掉 footer，状态 pill 上移到 title 行右侧，padding/字号减小
 *
 * 数据来源：task ∈ VM_DATA.TASKS（id/title/state/progress）+ 派生 composition / thumbs / 时间
 */

(() => {

/* 工作空间内部素材类型 → 主色 + 中文名 */
const TYPE_TONE = {
  video: { c:'var(--accent-2)',     l:'视频' },  // 紫
  audio: { c:'var(--accent-green)', l:'音频' },  // 绿
  image: { c:'var(--accent-3)',     l:'图片' },  // 蓝
  text:  { c:'var(--ink-3)',        l:'文字' },  // 灰
};

const hashOf = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);

/* 单个 workspace 的素材组成。ws-a1 用真实 MATERIALS，其它按哈希假造 */
const compositionFor = (taskId) => {
  if (taskId === 'a1') {
    const ms = (window.VM_DATA?.MATERIALS) || [];
    return ['video', 'audio', 'image', 'text']
      .map(t => ({ t, n: ms.filter(m => m.type === t).length }))
      .filter(d => d.n > 0);
  }
  const h = Math.abs(hashOf(taskId));
  return [
    { t: 'video', n: 1 + (h % 4) },
    { t: 'image', n: (h >> 2) % 5 },
    { t: 'audio', n: (h >> 4) % 3 },
    { t: 'text',  n: (h >> 5) % 2 },
  ].filter(d => d.n > 0);
};

const dominantType = (comp) =>
  comp.slice().sort((a, b) => b.n - a.n)[0]?.t || 'video';

const thumbsFor = (taskId, total) => {
  const h = Math.abs(hashOf(taskId));
  const frames = (window.VM_DATA?.FRAMES || []).length;
  if (frames === 0) return [];
  const out = [];
  for (let i = 0; i < Math.min(4, total); i++) {
    out.push((h + i * 13) % frames);
  }
  return out;
};

const relativeOf = (taskId, offsetDays) => {
  const h = Math.abs(hashOf(taskId));
  const days = offsetDays ?? (h % 14);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7)   return `${days} 天前`;
  if (days < 14)  return '上周';
  return `${Math.floor(days / 7)} 周前`;
};

const stateOf = (t) => {
  const map = {
    running: { l: '处理中', c: 'var(--accent)' },
    queued:  { l: '等待中', c: 'var(--ink-4)' },
    done:    { l: '已完成', c: 'var(--accent-green)' },
    error:   { l: '有错误', c: 'var(--accent)' },
  };
  return map[t.state] || map.queued;
};

/* 状态 pill —— 复用于 default footer & compact header */
const StatePill = ({ task, st, size = 'md' }) => {
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sm ? 4 : 5,
      padding: sm ? '2px 7px' : '3px 9px',
      borderRadius: 99,
      background:
        task.state === 'running' ? 'rgba(255,77,126,0.10)' :
        task.state === 'done'    ? 'rgba(34,211,154,0.12)' :
        task.state === 'error'   ? 'rgba(255,77,126,0.12)' : 'var(--bg-sunken)',
      border: '1px solid var(--line)',
      color: st.c,
      fontSize: sm ? 10 : 10.5,
      fontWeight: 600,
      flexShrink: 0,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: sm ? 4 : 5, height: sm ? 4 : 5, borderRadius: 99, background: st.c }} />
      {st.l}
      {task.state === 'running' && task.progress != null && (
        <span style={{ fontFamily: 'var(--mono)', opacity: 0.85, marginLeft: 2 }}>
          {task.progress}%
        </span>
      )}
    </span>
  );
};

/* ═══════════════════════════════════════════
   WorkspaceCard
   ═══════════════════════════════════════════ */
const WorkspaceCard = ({ task, onOpen, compact = false }) => {
  const comp        = compositionFor(task.id);
  const total       = comp.reduce((a, c) => a + c.n, 0);
  const stripeColor = TYPE_TONE[dominantType(comp)].c;
  const thumbs      = thumbsFor(task.id, total);
  const more        = Math.max(0, total - thumbs.length);
  const st          = stateOf(task);

  /* compact 与 default 的尺寸刻度 */
  const sizes = compact ? {
    stripe: 3, pad: '12px 14px 14px', gap: 9, title: 13.5, titleClamp: 2,
    metaSize: 10, thumbAR: '16/10', thumbGap: 5, thumbRadius: 7,
    moreFont: 11, footerPad: 0,
  } : {
    stripe: 4, pad: '18px 20px 16px', gap: 12, title: 15.5, titleClamp: 2,
    metaSize: 10.5, thumbAR: '16/10', thumbGap: 6, thumbRadius: 8,
    moreFont: 13, footerPad: 10,
  };

  return (
    <button
      onClick={() => onOpen?.(task)}
      data-comment-anchor={`workspace-card-${task.id}`}
      style={{
        display: 'flex', flexDirection: 'column',
        textAlign: 'left', cursor: 'pointer',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        padding: 0, font: 'inherit', color: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform    = 'translateY(-2px)';
        e.currentTarget.style.boxShadow    = 'var(--shadow-md)';
        e.currentTarget.style.borderColor  = 'var(--line-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform    = '';
        e.currentTarget.style.boxShadow    = '';
        e.currentTarget.style.borderColor  = 'var(--line)';
      }}
    >
      {/* 主色顶条 */}
      <div style={{ height: sizes.stripe, background: stripeColor, flexShrink: 0 }} />

      <div style={{
        padding: sizes.pad,
        display: 'flex', flexDirection: 'column', gap: sizes.gap, flex: 1,
      }}>
        {/* ── Title row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: sizes.title, fontWeight: 600, lineHeight: 1.35,
              display: '-webkit-box', WebkitLineClamp: sizes.titleClamp, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', color: 'var(--ink)',
            }}>
              {task.title}
            </div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: sizes.metaSize,
              color: 'var(--ink-3)', letterSpacing: '0.04em',
              marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap',
            }}>
              <span style={{ whiteSpace: 'nowrap' }}>创建于 {relativeOf(task.id)}</span>
              {!compact && <span style={{ opacity: 0.4 }}>·</span>}
              {!compact && (
                <span style={{ whiteSpace: 'nowrap' }}>活跃 {relativeOf(task.id + '.act')}</span>
              )}
            </div>
          </div>
          {compact ? (
            <StatePill task={task} st={st} size="sm" />
          ) : (
            <span style={{
              width: 8, height: 8, borderRadius: 99, background: st.c, flexShrink: 0,
              marginTop: 6,
              boxShadow: task.state === 'running' ? '0 0 0 3px rgba(255,77,126,0.16)' : 'none',
            }} title={st.l} />
          )}
        </div>

        {/* ── Thumb row ── */}
        <div style={{ display: 'flex', gap: sizes.thumbGap }}>
          {thumbs.map((idx, i) => {
            const f = window.VM_DATA.FRAMES[idx];
            return (
              <div key={i} style={{
                flex: 1, aspectRatio: sizes.thumbAR,
                borderRadius: sizes.thumbRadius, overflow: 'hidden',
                background: 'var(--bg-sunken)',
              }}>
                <img
                  src={`assets/frame_${f.ts.replace(/:/g, '_')}.svg`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            );
          })}
          {more > 0 && (
            <div style={{
              flex: 1, aspectRatio: sizes.thumbAR, borderRadius: sizes.thumbRadius,
              background: 'var(--bg-sunken)', border: '1px dashed var(--line-strong)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--mono)', fontSize: sizes.moreFont, color: 'var(--ink-3)',
            }}>+{more}</div>
          )}
          {Array.from({
            length: Math.max(0, 4 - thumbs.length - (more > 0 ? 1 : 0)),
          }).map((_, i) => (
            <div key={`spacer-${i}`} style={{
              flex: 1, aspectRatio: sizes.thumbAR, borderRadius: sizes.thumbRadius,
              background: 'transparent',
            }} />
          ))}
        </div>

        {/* ── Footer (default only) ── */}
        {!compact && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, paddingTop: sizes.footerPad,
            borderTop: '1px solid var(--line)',
          }}>
            <div style={{
              display: 'flex', gap: 10, flexWrap: 'wrap',
              fontSize: 11.5, color: 'var(--ink-2)',
            }}>
              {comp.map((c) => (
                <span key={c.t} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: 99, background: TYPE_TONE[c.t].c,
                  }} />
                  <b style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{c.n}</b>
                  <span style={{ color: 'var(--ink-3)' }}>{TYPE_TONE[c.t].l}</span>
                </span>
              ))}
            </div>
            <StatePill task={task} st={st} />
          </div>
        )}
      </div>
    </button>
  );
};

/* expose helpers + component to global scope so library.jsx 也可复用 */
Object.assign(window, {
  WorkspaceCard,
  VM_TYPE_TONE: TYPE_TONE,
  VM_compositionFor: compositionFor,
  VM_relativeOf: relativeOf,
  VM_stateOf: stateOf,
});

})();
