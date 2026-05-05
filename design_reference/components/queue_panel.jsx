/* QueuePanel — 批量队列管理面板 (§10.3) · 进度 · 取消 · 重试 · 优先级调序 · 性能检测 */

const Q_STATE = {
  running: { label:'处理中', color:'var(--accent-3)' },
  queued:  { label:'等待中', color:'var(--ink-4)'    },
  done:    { label:'已完成', color:'var(--accent-green)' },
  error:   { label:'失败',   color:'var(--accent)'   },
};

/* ─── Small chevron btn ─── */
const ChevBtn = ({ up, onClick }) => (
  <button onClick={onClick}
          style={{ width:20, height:20, borderRadius:4, border:'1px solid var(--line)',
                   background:'var(--bg-sunken)', cursor:'pointer',
                   display:'grid', placeItems:'center', color:'var(--ink-3)' }}>
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {up ? <path d="M1 5.5l3-3 3 3"/> : <path d="M1 2.5l3 3 3-3"/>}
    </svg>
  </button>
);

/* ─── Detect hardware ─── */
const detectPerf = () => {
  const cores = navigator.hardwareConcurrency || 4;
  const ram   = navigator.deviceMemory || 8;
  let gpu = '未知';
  try {
    const gl  = document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const full = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
      gpu = full.split('/')[0].split('(')[0].trim() || '未知';
    }
  } catch {}
  const recommended = Math.max(1, Math.min(6, Math.floor(cores / 4)));
  return { cores, ram, gpu, recommended };
};

/* ═══════════════════════════════════════════
   QueuePanel
   ═══════════════════════════════════════════ */
const QueuePanel = ({ onOpenMaterial }) => {

  /* Local task state — extend VM_DATA with mutable fields */
  const [tasks, setTasks] = React.useState(() =>
    VM_DATA.TASKS.map((t, i) => ({
      ...t,
      order:    i,
      progress: t.progress || 0,
    }))
  );
  const [parallelMax, setParallelMax] = React.useState(3);
  const [perf, setPerf]               = React.useState(null);

  /* Detect on mount */
  React.useEffect(() => {
    const p = detectPerf();
    setPerf(p);
    setParallelMax(p.recommended);
  }, []);

  /* Simulate running task progress */
  React.useEffect(() => {
    const t = setInterval(() => {
      setTasks(prev => prev.map(task =>
        task.state === 'running' && task.progress < 100
          ? { ...task, progress: Math.min(100, task.progress + 0.6) }
          : task
      ));
    }, 180);
    return () => clearInterval(t);
  }, []);

  /* ── Reorder helpers ── */
  const swap = (id, dir) => setTasks(prev => {
    const sorted = [...prev].sort((a, b) => a.order - b.order);
    const idx    = sorted.findIndex(t => t.id === id);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return prev;
    const aOrd = sorted[idx].order;
    const bOrd = sorted[target].order;
    return prev.map(t => {
      if (t.id === sorted[idx].id)     return { ...t, order: bOrd };
      if (t.id === sorted[target].id)  return { ...t, order: aOrd };
      return t;
    });
  });

  const cancelTask = (id) => setTasks(prev =>
    prev.map(t => t.id === id && (t.state === 'running' || t.state === 'queued')
      ? { ...t, state: 'error', progress: t.progress }
      : t)
  );
  const retryTask  = (id) => setTasks(prev =>
    prev.map(t => t.id === id && t.state === 'error'
      ? { ...t, state: 'queued', progress: 0 }
      : t)
  );
  const retryAll   = () => setTasks(prev =>
    prev.map(t => t.state === 'error' ? { ...t, state: 'queued', progress: 0 } : t)
  );
  const cancelQueued = () => setTasks(prev =>
    prev.map(t => t.state === 'queued' ? { ...t, state: 'error' } : t)
  );

  /* ── Derived stats ── */
  const sorted  = [...tasks].sort((a, b) => a.order - b.order);
  const running = tasks.filter(t => t.state === 'running').length;
  const done    = tasks.filter(t => t.state === 'done').length;
  const queued  = tasks.filter(t => t.state === 'queued').length;
  const errors  = tasks.filter(t => t.state === 'error').length;
  const total   = tasks.length;
  const overallPct = Math.round((done / total) * 100);

  return (
    <div style={{ padding:'28px 32px 56px', maxWidth:1000, margin:'0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom:24 }}>
        <div className="eyebrow">BATCH QUEUE · 批量队列管理</div>
        <h1 className="display" style={{ fontSize:52, margin:'8px 0 10px' }}>任务队列</h1>
      </div>

      {/* ── Overall progress bar ── */}
      <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                    borderRadius:'var(--radius)', padding:'18px 24px', marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:24, marginBottom:14, flexWrap:'wrap' }}>
          {[
            { l:'总计', v:total,   c:'var(--ink)' },
            { l:'处理中', v:running, c:'var(--accent-3)' },
            { l:'等待中', v:queued,  c:'var(--ink-4)' },
            { l:'已完成', v:done,    c:'var(--accent-green)' },
            { l:'失败',   v:errors,  c:'var(--accent)' },
          ].map(({ l, v, c }) => (
            <div key={l}>
              <div className="display" style={{ fontSize:38, lineHeight:1, color:c }}>{v}</div>
              <div className="eyebrow" style={{ marginTop:3 }}>{l}</div>
            </div>
          ))}
          <div style={{ flex:1 }}/>
          <div style={{ textAlign:'right' }}>
            <div className="display" style={{ fontSize:52, lineHeight:1 }}>{overallPct}<span style={{ fontSize:24, color:'var(--ink-3)' }}>%</span></div>
            <div className="eyebrow">整体进度</div>
          </div>
        </div>
        {/* Bar */}
        <div style={{ position:'relative', height:6, background:'var(--bg-sunken)', borderRadius:6, overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, height:'100%', borderRadius:6,
                         width:`${overallPct}%`, transition:'width 500ms ease',
                         background:'linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-3))' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
          {[0,25,50,75,100].map(v => (
            <span key={v} className="mono" style={{ fontSize:9, color:'var(--ink-4)' }}>{v}%</span>
          ))}
        </div>
      </div>

      {/* ── Parallel control + perf info ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>

        {/* Parallel slider */}
        <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                      borderRadius:'var(--radius)', padding:'16px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <IcCpu size={14} style={{ color:'var(--accent-3)' }}/>
            <span style={{ fontWeight:700, fontSize:14 }}>并行数量上限</span>
            {perf && (
              <span className="kw" style={{ marginLeft:'auto', fontSize:10, background:'rgba(60,119,251,0.1)', color:'var(--accent-3)', border:'none' }}>
                推荐 ≤ {perf.recommended}
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <input type="range" min={1} max={8} value={parallelMax}
                   onChange={e => setParallelMax(+e.target.value)}
                   style={{ flex:1, accentColor:'var(--accent-3)', height:4 }}/>
            <div className="display" style={{ fontSize:44, lineHeight:1, minWidth:36, textAlign:'right' }}>
              {parallelMax}
            </div>
          </div>
          <div className="mono" style={{ fontSize:10, color:'var(--ink-4)', marginTop:8 }}>
            当前 <strong style={{ color:'var(--accent-3)' }}>{running}</strong> 个运行中 · 上限 {parallelMax} 个并行
          </div>
        </div>

        {/* Perf detection */}
        <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                      borderRadius:'var(--radius)', padding:'16px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <IcBolt size={14} style={{ color:'var(--accent-warm)' }}/>
            <span style={{ fontWeight:700, fontSize:14 }}>系统性能检测</span>
            <span className="chip" style={{ marginLeft:'auto', fontSize:10 }}>
              <span className="chip-dot" style={{ background:'var(--accent-green)' }}/>启动时检测
            </span>
          </div>
          {perf ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 20px' }}>
              {[
                ['CPU 核心', `${perf.cores} 核`],
                ['内存',     `${perf.ram} GB`],
                ['GPU',      perf.gpu.length > 22 ? perf.gpu.slice(0,22)+'…' : perf.gpu],
                ['建议并行',  `≤ ${perf.recommended} 任务`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="eyebrow" style={{ marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)' }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mono" style={{ fontSize:11, color:'var(--ink-4)' }}>检测中…</div>
          )}
        </div>
      </div>

      {/* ── Task table ── */}
      <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                    borderRadius:'var(--radius)', overflow:'hidden', marginBottom:14 }}>

        {/* Table header */}
        <div style={{ display:'grid', gridTemplateColumns:'28px 80px 1fr 100px 130px 110px',
                       gap:12, padding:'10px 20px', borderBottom:'1px solid var(--line)',
                       background:'var(--bg-sunken)' }}>
          {['优先级','缩略图','素材','状态','进度','操作'].map(h => (
            <span key={h} className="eyebrow" style={{ fontSize:9 }}>{h}</span>
          ))}
        </div>

        {sorted.map((task, idx) => {
          const f    = VM_DATA.FRAMES[task.thumb % VM_DATA.FRAMES.length];
          const st   = Q_STATE[task.state] || Q_STATE.queued;
          const isRunning = task.state === 'running';
          const isError   = task.state === 'error';
          const isDone    = task.state === 'done';
          const isQueued  = task.state === 'queued';
          const pct = isDone ? 100 : Math.round(task.progress);

          return (
            <div key={task.id}
                 style={{ display:'grid', gridTemplateColumns:'28px 80px 1fr 100px 130px 110px',
                           gap:12, padding:'14px 20px', alignItems:'center',
                           borderBottom: idx < sorted.length - 1 ? '1px solid var(--line)' : 'none',
                           background: isRunning ? 'rgba(60,119,251,0.025)' :
                                        isError   ? 'rgba(255,77,126,0.025)' : 'transparent',
                           transition:'background 300ms' }}>

              {/* Priority controls */}
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <ChevBtn up onClick={() => swap(task.id, -1)}/>
                <ChevBtn    onClick={() => swap(task.id,  1)}/>
              </div>

              {/* Thumbnail */}
              <div style={{ borderRadius:8, overflow:'hidden', aspectRatio:'16/9',
                             background:'var(--bg-sunken)', position:'relative' }}>
                <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}
                     style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                {isRunning && (
                  <div style={{ position:'absolute', inset:0, background:'rgba(60,119,251,0.18)',
                                 display:'grid', placeItems:'center' }}>
                    <div style={{ width:16, height:16, borderRadius:99,
                                   border:'2.5px solid rgba(255,255,255,0.9)',
                                   borderTopColor:'transparent',
                                   animation:'qp-spin 0.75s linear infinite' }}/>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, overflow:'hidden',
                               textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {task.title}
                </div>
                <div className="mono" style={{ fontSize:10, color:'var(--ink-4)', marginTop:2 }}>
                  {task.src}
                </div>
                <span className="kw" style={{ fontSize:9, marginTop:4, display:'inline-flex' }}>
                  {task.type}
                </span>
              </div>

              {/* State */}
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:7, height:7, borderRadius:99, background:st.color, flexShrink:0,
                               animation: isRunning ? 'qp-pulse 1.4s ease infinite' : 'none' }}/>
                <span style={{ fontSize:12, fontWeight:600, color:st.color }}>{st.label}</span>
              </div>

              {/* Progress */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span className="mono" style={{ fontSize:10, color:'var(--ink-3)' }}>
                    {isDone ? '✓ 完成' : isError ? '✗ 中断' : `${pct}%`}
                  </span>
                  {isRunning && (
                    <span className="mono" style={{ fontSize:9, color:'var(--ink-4)' }}>
                      剩余 ~{Math.max(1, Math.round((100-pct)/3))}s
                    </span>
                  )}
                </div>
                <div style={{ height:4, background:'var(--bg-sunken)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:4, transition:'width 400ms ease',
                                 width:`${pct}%`,
                                 background: isDone    ? 'var(--accent-green)' :
                                              isError   ? 'var(--accent)' :
                                              'linear-gradient(90deg, var(--accent), var(--accent-2))' }}/>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {isError && (
                  <button onClick={() => retryTask(task.id)}
                          style={{ height:28, padding:'0 10px', borderRadius:7, fontSize:11, fontWeight:600,
                                   border:'none', cursor:'pointer', background:'rgba(34,211,154,0.12)',
                                   color:'var(--accent-green)', display:'flex', alignItems:'center', gap:5 }}>
                    <IcSpark size={11}/> 重试
                  </button>
                )}
                {(isRunning || isQueued) && (
                  <button onClick={() => cancelTask(task.id)}
                          style={{ height:28, padding:'0 10px', borderRadius:7, fontSize:11, fontWeight:600,
                                   border:'none', cursor:'pointer', background:'rgba(255,77,126,0.1)',
                                   color:'var(--accent)', display:'flex', alignItems:'center', gap:5 }}>
                    <IcX size={11}/> 取消
                  </button>
                )}
                {isDone && (
                  <button onClick={() => onOpenMaterial && onOpenMaterial({ ...task, type:'video' })}
                          style={{ height:28, padding:'0 10px', borderRadius:7, fontSize:11, fontWeight:600,
                                   border:'1px solid var(--line)', cursor:'pointer',
                                   background:'var(--bg-sunken)', color:'var(--ink-2)',
                                   display:'flex', alignItems:'center', gap:5 }}>
                    <IcArrowRight size={11}/> 查看
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Batch actions ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <button className="btn" onClick={retryAll} disabled={errors === 0}
                style={{ opacity: errors > 0 ? 1 : 0.4 }}>
          <IcSpark size={13}/> 重试所有失败（{errors}）
        </button>
        <button className="btn" onClick={cancelQueued} disabled={queued === 0}
                style={{ opacity: queued > 0 ? 1 : 0.4 }}>
          <IcX size={13}/> 取消所有等待（{queued}）
        </button>
        <div style={{ flex:1 }}/>
        <span className="mono" style={{ fontSize:11, color:'var(--ink-4)' }}>
          {errors > 0
            ? `⚠ ${errors} 个失败 · 点击重试`
            : running > 0
            ? `${running} 个处理中 · 并行上限 ${parallelMax}`
            : '队列空闲'}
        </span>
      </div>

      <style>{`
        @keyframes qp-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes qp-spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
};

window.QueuePanel = QueuePanel;
