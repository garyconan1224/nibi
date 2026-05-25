/* Errors & exception states — spec v1.1 §13 异常处理汇总
 *
 *   ModelMissingDialog : 拦截「开始分析」并引导到设置页 (§13 / §4.3)
 *   ErrorState          : 通用空/错状态卡片 (复用色板, 不引入新视觉)
 *   FailedFrameOverlay  : 帧分析失败的视觉叠加 (§13 视觉模型失败)
 *
 *   Trigger 矩阵 (主 App 通过 state 控制):
 *     未配置模型      → ModelMissingDialog
 *     视觉模型重试    → Processing logs 中 warn 行 (已接)
 *     帧分析失败 3/3  → FailedFrameOverlay 在 VideoDetail 缩略图上
 *     批量任务单失败  → mat-card 红色边 + 重试按钮 (Taskboard 已有)
 */

const ErrIcWarn = (p) => (
  <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9"  x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const ErrIcRefresh = (p) => (
  <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>
);

/* ─── ModelMissingDialog ─── §13 模型未配置 拦截 */
const ModelMissingDialog = ({ open, onClose, onGoSettings }) => {
  const steps = [
    { n:'1', t:'打开 模型 · Providers',   d:'设置 → Providers 标签' },
    { n:'2', t:'添加 API Key',            d:'OpenAI / Anthropic / Ollama 三选一,本地 Ollama 无需 key' },
    { n:'3', t:'回到工作台,继续分析',     d:'未配置前所有「开始分析」会被拦截' },
  ];
  return (
    <>
      <div className="modal-backdrop" data-open={open} onClick={onClose}/>
      <div className="modal" data-open={open} style={{width:520}}>
        <div className="m-head" style={{ background:'var(--bg-elev)', borderBottom:'1px solid var(--line)' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:14, flex:1, minWidth:0 }}>
            <div style={{
              width:42, height:42, borderRadius:12, flexShrink:0,
              background:'rgba(255,184,76,0.14)', color:'var(--accent-warm)',
              display:'grid', placeItems:'center',
            }}>
              <ErrIcWarn size={22}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="eyebrow" style={{ color:'var(--accent-warm)', marginBottom:6 }}>
                EXCEPTION · §13 · MODEL NOT CONFIGURED
              </div>
              <h3 className="display" style={{ fontSize:24, margin:'0 0 6px', lineHeight:1.2 }}>
                请先添加至少一个模型
              </h3>
              <p style={{ margin:0, fontSize:13, color:'var(--ink-2)', lineHeight:1.55 }}>
                VidMirror 不内置任何模型 · 所有 AI 调用都使用你自己配置的 API。
                目前还没有可用的视觉/文本模型,「开始分析」已被拦截。
              </p>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><IcX size={16}/></button>
        </div>

        <div className="m-body" style={{ paddingTop:18 }}>
          <div className="eyebrow" style={{ marginBottom:10 }}>三步配置</div>
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {steps.map((s, i) => (
              <div key={s.n}
                   style={{ display:'grid', gridTemplateColumns:'28px 1fr',
                            gap:14, padding:'12px 4px',
                            borderBottom: i<steps.length-1 ? '1px dashed var(--line)' : 'none',
                            alignItems:'flex-start' }}>
                <div className="mono" style={{ fontSize:11, color:'var(--ink-3)', letterSpacing:'0.06em',
                                                 padding:'2px 0 0' }}>{s.n}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)' }}>{s.t}</div>
                  <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:3, lineHeight:1.5 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Preset shortcuts (§15.1) */}
          <div className="eyebrow" style={{ marginTop:18, marginBottom:8 }}>
            预设模板 · 一键填入 Base URL
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {[
              { n:'OpenAI',    u:'api.openai.com/v1' },
              { n:'Anthropic', u:'api.anthropic.com' },
              { n:'Ollama',    u:'localhost:11434/v1' },
            ].map(p => (
              <button key={p.n} onClick={onGoSettings}
                style={{ display:'inline-flex', flexDirection:'column', gap:2, alignItems:'flex-start',
                         padding:'10px 14px', borderRadius:10,
                         background:'var(--bg-sunken)', border:'1px solid var(--line)',
                         cursor:'pointer', transition:'all 140ms' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{p.n}</span>
                <span className="mono" style={{ fontSize:10, color:'var(--ink-3)' }}>{p.u}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="m-foot">
          <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
            <span style={{ color:'var(--accent-warm)' }}>●</span> 拦截中 · 配置后自动恢复
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" onClick={onClose}>稍后再说</button>
            <button className="btn-run" onClick={onGoSettings}>
              前往设置 · 添加模型
              <span className="iconwrap"><IcArrowRight size={12}/></span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/* ─── ErrorState · 通用错误占位 (空/失败/超限/不支持) ─── */
const ErrorState = ({ tone='warn', code, title, detail, action, onAction, mono }) => {
  const palette = {
    warn:    { bg:'rgba(255,184,76,0.10)', fg:'var(--accent-warm)', border:'rgba(255,184,76,0.32)' },
    err:     { bg:'rgba(255,77,126,0.10)', fg:'var(--accent)',       border:'rgba(255,77,126,0.32)' },
    info:    { bg:'var(--bg-sunken)',       fg:'var(--ink-2)',        border:'var(--line)' },
  };
  const p = palette[tone] || palette.warn;
  return (
    <div style={{ padding:'14px 16px', borderRadius:14, background:p.bg,
                  border:`1px solid ${p.border}`,
                  display:'flex', alignItems:'flex-start', gap:12 }}>
      <div style={{ flexShrink:0, color:p.fg, marginTop:1 }}><ErrIcWarn size={18}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
          {code && (
            <span className="mono" style={{ fontSize:10, color:p.fg, letterSpacing:'0.08em',
                                             padding:'1px 6px', borderRadius:4, background:'rgba(255,255,255,0.5)',
                                             border:`1px solid ${p.border}` }}>
              {code}
            </span>
          )}
          <span style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{title}</span>
        </div>
        {detail && (
          <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:5, lineHeight:1.55,
                        fontFamily: mono ? 'var(--mono)' : 'var(--sans)' }}>
            {detail}
          </div>
        )}
      </div>
      {action && (
        <button onClick={onAction}
                style={{ flexShrink:0, padding:'6px 11px', borderRadius:8,
                         border:`1px solid ${p.border}`, background:'var(--bg-elev)',
                         color:'var(--ink)', fontSize:12, fontWeight:500, cursor:'pointer',
                         display:'inline-flex', alignItems:'center', gap:5 }}>
          <ErrIcRefresh size={11}/>{action}
        </button>
      )}
    </div>
  );
};

/* ─── FailedFrameOverlay · 单帧分析失败 (覆盖在缩略图上) ─── */
const FailedFrameOverlay = ({ onRetry }) => (
  <div onClick={(e) => { e.stopPropagation(); onRetry && onRetry(); }}
       style={{ position:'absolute', inset:0, borderRadius:8,
                background:'rgba(255,77,126,0.86)', color:'#fff',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:4, cursor:'pointer', backdropFilter:'blur(2px)',
                fontSize:10, fontFamily:'var(--mono)', letterSpacing:'0.04em',
                textAlign:'center', padding:6 }}>
    <ErrIcWarn size={16}/>
    <div>分析失败</div>
    <div style={{ fontSize:9, opacity:0.85, display:'inline-flex', gap:3, alignItems:'center' }}>
      <ErrIcRefresh size={9}/>重试
    </div>
  </div>
);

Object.assign(window, { ModelMissingDialog, ErrorState, FailedFrameOverlay, ErrIcWarn, ErrIcRefresh });
