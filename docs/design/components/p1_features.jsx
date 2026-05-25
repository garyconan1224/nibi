/* P1 Features — spec v1.1 §15.2 / §11.3 / §5.1
 *
 *   PresetBar       : Preflight 顶部 5 个一键预设 (复刻参考/字幕优先/快速预览/会议记录/自定义)
 *   FloatingQueue   : 全局浮动队列 — 跨页可见 · 折叠/展开 (§11.3)
 *   ShotConfirmModal: AI 镜头模式下「检测到 N 个镜头,请确认」中断点 (§5.1)
 */

/* ═══════════════════════════════════════════
   §15.2 — PresetBar (Preflight 顶部)
   ═══════════════════════════════════════════ */

const PRESETS = [
  {
    id: 'remix',     l: '复刻参考',  en: 'Remix Reference',
    desc: '拆解别人的跳转 · 提示词 + 文案 + 音乐',
    tone: 'pink',
    apply: {
      video: {
        frame_prompt: { on: true, frame_mode: 'AI 镜头分析', shot_frames: '3 帧 · 首+中+尾' },
        summary:      { on: true, summary_path: '字幕直接总结' },
        music:        { on: true, music_suno: true },
        srt:          { on: false },
      },
      audio: {
        asr:        { on: true, asr_lang: '自动检测', asr_diar: true },
        voiceprint: { on: true },
        srt:        { on: true },
        music:      { on: true, music_suno: true },
      },
      image: {
        describe: { on: true },
        ocr:      { on: false },
        prompt:   { on: true, prompt_fmt: 'Midjourney' },
        assoc:    { on: true, assoc_dir: '设计分析' },
        compare:  { on: false },
      },
      text: {
        summary: { on: true, sum_len: '100 字' },
        assoc:   { on: true, assoc_dir: '观点提炼' },
        rewrite: { on: false },
        translate:{ on: false },
        multi:   { on: false },
      },
    },
  },
  {
    id: 'srt',       l: '字幕优先',  en: 'Subtitles Only',
    desc: '仅记录讲话内容 · 不跑截帧',
    tone: 'blue',
    apply: {
      video: {
        frame_prompt: { on: false },
        summary:      { on: true, summary_path: '字幕直接总结' },
        music:        { on: false },
        srt:          { on: true },
      },
      audio: {
        asr:        { on: true, asr_lang: '自动检测', asr_diar: false },
        voiceprint: { on: false },
        srt:        { on: true },
        music:      { on: false },
      },
    },
  },
  {
    id: 'quick',     l: '快速预览',  en: 'Quick Preview',
    desc: '丰富素材筛选 · 仅视频模型',
    tone: 'amber',
    apply: {
      video: {
        frame_prompt: { on: false },
        summary:      { on: true, summary_path: '视频模型直接分析' },
        music:        { on: false },
        srt:          { on: false },
      },
    },
  },
  {
    id: 'meeting',   l: '会议记录',  en: 'Meeting',
    desc: '钉钉 / 腾讯会议导入 · 转写 + 区分人',
    tone: 'purple',
    apply: {
      audio: {
        asr:        { on: true, asr_lang: '中文', asr_diar: true },
        voiceprint: { on: true },
        srt:        { on: true },
        music:      { on: false },
      },
      video: {
        frame_prompt: { on: false },
        summary:      { on: true, summary_path: '字幕直接总结' },
        srt:          { on: true },
        music:        { on: false },
      },
    },
  },
  {
    id: 'custom',    l: '自定义',    en: 'Custom',
    desc: '手动勾选 · 隐藏所有预设',
    tone: 'mono',
    apply: null, // sentinel: don't touch state
  },
];

const PresetBar = ({ kind, current, onPick }) => (
  <div style={{ display:'grid', gap:6 }}>
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
      <span className="eyebrow">一键预设 · §15.2</span>
      <span className="mono" style={{ fontSize:10, color:'var(--ink-4)' }}>
        {current ? `当前 · ${PRESETS.find(p=>p.id===current)?.l}` : '点击下方继续手动勾选'}
      </span>
    </div>
    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
      {PRESETS.map(p => {
        const active = current === p.id;
        const compatible = p.apply === null || p.apply[kind];
        const toneFg = {
          pink:'var(--accent)', blue:'var(--accent-3)', amber:'var(--accent-warm)',
          purple:'var(--accent-2)', mono:'var(--ink-2)'
        }[p.tone] || 'var(--ink)';
        return (
          <button key={p.id}
                  onClick={() => onPick(p)}
                  disabled={!compatible}
                  title={!compatible ? `当前素材类型不适用` : p.desc}
                  style={{
                    flex: '1 0 calc(33% - 4px)', minWidth: 130,
                    padding:'9px 11px', borderRadius:10,
                    background: active ? 'var(--ink)' : 'var(--bg-elev)',
                    border:`1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                    color: active ? 'var(--bg)' : 'var(--ink)',
                    cursor: compatible ? 'pointer' : 'not-allowed',
                    opacity: compatible ? 1 : 0.4,
                    textAlign:'left',
                    transition:'all 140ms ease',
                    display:'flex', flexDirection:'column', gap:2,
                  }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{
                width:6, height:6, borderRadius:99,
                background: active ? 'var(--bg)' : toneFg,
                flexShrink:0,
              }}/>
              <span style={{ fontSize:12, fontWeight:600 }}>{p.l}</span>
            </div>
            <span style={{ fontSize:10, color: active?'rgba(255,255,255,0.6)':'var(--ink-3)',
                          lineHeight:1.4, fontFamily:'var(--mono)' }}>
              {p.desc}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

window.PresetBar = PresetBar;
window.VM_PRESETS = PRESETS;

/* ═══════════════════════════════════════════
   §11.3 — FloatingQueue (全局浮动队列)
   ═══════════════════════════════════════════ */

const FloatingQueue = ({ onSelectTask, currentTaskId }) => {
  const [open, setOpen] = React.useState(false);
  const [pos,  setPos]  = React.useState({ x: 24, y: 24 }); // bottom-right offsets

  /* Pick live rows from VM_DATA · 只看活跃任务 (running / queued / error) */
  const rows = (() => {
    const seed = (VM_DATA.MATERIALS || []).filter(m => m.state==='running' || m.state==='queued' || m.state==='error');
    const extra = [
      { id:'fq-1', title:'大疆 Pocket 4 · 画面提示词', state:'running', progress:67, stage:'vlm · 86/128' },
      { id:'fq-2', title:'iPhone 17 Pro · 字幕转录',   state:'running', progress:42, stage:'asr · zh' },
      { id:'fq-3', title:'徕卡 M11 · 视频总结',       state:'error',   progress:38, stage:'API 限流 429' },
    ];
    return [...seed.map(m => ({
      id: m.id, title: m.title, state: m.state,
      progress: m.progress ?? (m.state==='queued'?0:m.state==='error'?38:50),
      stage: m.state==='running' ? 'vlm · stage 4/6'
           : m.state==='queued'  ? '等待槽位'
           : 'API 超限',
    })), ...extra];
  })();

  const running = rows.filter(r => r.state==='running').length;
  const queued  = rows.filter(r => r.state==='queued').length;
  const errored = rows.filter(r => r.state==='error').length;
  const total   = rows.length;
  /* aggregate progress · weight running rows by progress, queued = 0, done = 100 */
  const avgPct = total ? Math.round(rows.reduce((a,r) => a + (r.progress||0), 0) / total) : 0;

  const dotColor = (s) => s==='running' ? 'var(--accent)'
                       : s==='queued'   ? 'var(--ink-4)'
                       : s==='error'    ? 'var(--accent)'
                       : 'var(--accent-green)';

  /* hide entirely when there's nothing to show */
  if (total === 0) return null;

  return (
    <>
      {/* ───── Collapsed FAB ───── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position:'fixed', right:pos.x, bottom:pos.y, zIndex:38,
            display:'flex', alignItems:'center', gap:10,
            padding:'10px 16px 10px 12px',
            background:'var(--ink)', color:'var(--bg)',
            borderRadius:99, border:'none', cursor:'pointer',
            boxShadow:'var(--shadow-lg)',
            fontFamily:'var(--mono)', fontSize:12, fontWeight:500,
            transition:'transform 160ms ease, box-shadow 160ms ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          title="任务 · §11.3">
          {/* mini progress ring */}
          <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink:0 }}>
            <circle cx="11" cy="11" r="8.5" stroke="rgba(255,255,255,0.18)" strokeWidth="2" fill="none"/>
            <circle cx="11" cy="11" r="8.5" stroke="var(--accent-green)" strokeWidth="2" fill="none"
                    strokeDasharray={`${(avgPct/100)*53.4} 53.4`}
                    strokeLinecap="round"
                    transform="rotate(-90 11 11)"/>
            <text x="11" y="14" textAnchor="middle" fontSize="7"
                  fontFamily="var(--mono)" fill="var(--bg)" fontWeight="700">
              {avgPct}
            </text>
          </svg>
          <div style={{ display:'flex', flexDirection:'column', gap:1, alignItems:'flex-start', lineHeight:1.1 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--bg)', letterSpacing:'0.02em' }}>
              任务 · {running + queued + errored} 项进行中
            </span>
            <span style={{ fontSize:10, opacity:0.65 }}>
              {running > 0 && <>● {running} 处理</>}
              {queued  > 0 && <>{running > 0 ? ' · ' : ''}○ {queued} 等待</>}
              {errored > 0 && <>{(running||queued) ? ' · ' : ''}<span style={{ color:'var(--accent)' }}>✗ {errored} 失败</span></>}
            </span>
          </div>
        </button>
      )}

      {/* ───── Expanded panel ───── */}
      {open && (
        <div style={{
          position:'fixed', right:pos.x, bottom:pos.y, zIndex:38,
          width:380, maxHeight:'70vh',
          background:'var(--bg-elev)', border:'1px solid var(--line)',
          borderRadius:16, boxShadow:'var(--shadow-lg)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          animation:'ks-menu-in 200ms cubic-bezier(0.2,0.8,0.2,1)',
        }}>
          {/* Header */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 14px', borderBottom:'1px solid var(--line)',
            background:'var(--bg-sunken)',
          }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
              <span className="eyebrow">任务 · 近期活跃</span>
              <span className="mono" style={{ fontSize:10, color:'var(--ink-3)' }}>
                {running}/{total} 处理中 · 平均 {avgPct}%
              </span>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}
                      style={{ width:24, height:24, padding:0, display:'grid', placeItems:'center' }}>
                <IcX size={12}/>
              </button>
            </div>
          </div>

          {/* Aggregate bar */}
          <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--line)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <span className="mono" style={{ fontSize:10, color:'var(--ink-3)' }}>聚合进度</span>
              <div style={{ flex:1, height:3, background:'var(--bg-sunken)', borderRadius:99, overflow:'hidden' }}>
                <div style={{
                  height:'100%',
                  width:`${avgPct}%`,
                  background:'linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent-green))',
                  transition:'width 400ms ease',
                }}/>
              </div>
              <span className="mono" style={{ fontSize:10, color:'var(--ink)' }}>{avgPct}%</span>
            </div>
          </div>

          {/* Rows · 整行可点 → 跳到 Processing 详情并切换到该任务 */}
          <div style={{ flex:1, overflowY:'auto', padding:'4px 0' }}>
            {rows.map(r => {
              const isActive = currentTaskId === r.id;
              return (
              <div key={r.id}
                   onClick={() => { onSelectTask && onSelectTask(r); setOpen(false); }}
                   style={{ padding:'10px 14px',
                            borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                            background: isActive ? 'var(--bg-sunken)' : 'transparent',
                            borderBottom:'1px solid var(--line)',
                            cursor:'pointer',
                            transition:'background 140ms ease',
                            display:'flex', flexDirection:'column', gap:5 }}
                   onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                   onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:7, height:7, borderRadius:99, background: dotColor(r.state), flexShrink:0,
                                  animation: r.state==='running' ? 'proc-blink 1.6s infinite' : 'none' }}/>
                  <span style={{ flex:1, minWidth:0, fontSize:12.5, fontWeight:600,
                                 whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                 color: r.state==='error' ? 'var(--accent)' : 'var(--ink)' }}>
                    {r.title}
                  </span>
                  {isActive && (
                    <span className="mono" style={{ fontSize:9, color:'var(--accent)', flexShrink:0,
                                                     padding:'1px 5px', border:'1px solid var(--accent)', borderRadius:4,
                                                     letterSpacing:'0.04em' }}>
                      查看中
                    </span>
                  )}
                  <span className="mono" style={{ fontSize:10, color: dotColor(r.state), flexShrink:0 }}>
                    {r.state==='error' ? 'FAIL' : `${r.progress}%`}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <div style={{ flex:1, height:2, background:'var(--bg-sunken)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{
                      height:'100%',
                      width:`${r.progress}%`,
                      background: dotColor(r.state),
                      transition:'width 400ms ease',
                    }}/>
                  </div>
                  <span className="mono" style={{ fontSize:9.5, color:'var(--ink-4)', letterSpacing:'0.02em' }}>
                    {r.stage}
                  </span>
                  {r.state === 'error' && (
                    <button className="btn btn-ghost"
                            style={{ height:20, padding:'0 7px', fontSize:10 }}
                            onClick={(e) => { e.stopPropagation(); alert('Retry queued (mock)'); }}>
                      <ErrIcRefresh size={10}/>重试
                    </button>
                  )}
                </div>
              </div>
            );})}
          </div>

          {/* Footer */}
          <div style={{
            display:'flex', gap:6, padding:'10px 14px',
            borderTop:'1px solid var(--line)',
            background:'var(--bg-sunken)',
          }}>
            <button className="btn" style={{ flex:1, height:30, fontSize:12 }}>
              暂停全部
            </button>
            <button className="btn" style={{ flex:1, height:30, fontSize:12 }}
                    disabled={errored === 0}>
              <ErrIcRefresh size={11}/>
              重试 {errored} 项
            </button>
          </div>
        </div>
      )}
    </>
  );
};

window.FloatingQueue = FloatingQueue;

/* ═══════════════════════════════════════════
   §5.1 — ShotConfirmModal
   ═══════════════════════════════════════════ */

const ShotConfirmModal = ({ open, onClose, onConfirm, onAdjust, shots = 42, framesPerShot = 3 }) => {
  const totalFrames = shots * framesPerShot;
  /* Quick mental ETA: ~ 1s vlm/frame · 8 concurrent → roughly */
  const etaSec = Math.round(totalFrames * 0.7);
  const etaStr = etaSec < 60 ? `${etaSec}s` : `${Math.round(etaSec/60)}m`;

  return (
    <>
      <div className="modal-backdrop" data-open={open} onClick={onClose}/>
      <div className="modal" data-open={open} style={{ width:520 }}>
        <div className="m-head">
          <div style={{ flex:1, minWidth:0 }}>
            <div className="eyebrow" style={{ marginBottom:6 }}>
              CHECKPOINT · §5.1 · AI 镜头分析
            </div>
            <h3 className="display" style={{ fontSize:24, margin:'0 0 6px', lineHeight:1.2 }}>
              已识别 <span style={{ color:'var(--accent)' }}>{shots}</span> 个镜头,确认开始?
            </h3>
            <p style={{ margin:0, fontSize:13, color:'var(--ink-2)', lineHeight:1.55 }}>
              按每镜头取 <b>{framesPerShot} 帧</b>(首+中+尾)将产生 <b>{totalFrames} 帧</b> 进入视觉模型,
              预计耗时 <b>{etaStr}</b>。如镜头数远超预期,可返回调整截帧策略。
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><IcX size={16}/></button>
        </div>

        <div className="m-body" style={{ paddingTop:14 }}>
          {/* Visual shot indicator bar */}
          <div className="eyebrow" style={{ marginBottom:8 }}>镜头分布 · 时间轴</div>
          <div style={{
            display:'flex', gap:2, height:36, marginBottom:14,
            background:'var(--bg-sunken)', borderRadius:8, padding:4, overflow:'hidden',
          }}>
            {Array.from({ length: shots }).map((_, i) => {
              const h = 40 + Math.round(Math.sin(i * 1.3) * 28 + Math.random() * 12);
              return (
                <div key={i} style={{
                  flex:1, height:`${h}%`, alignSelf:'flex-end',
                  background: `oklch(${0.45 + (i % 5) * 0.07} 0.18 ${5 + i * 8})`,
                  borderRadius:1, minWidth:2,
                }}/>
              );
            })}
          </div>

          {/* Key stats */}
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10,
            padding:'14px 16px', borderRadius:12,
            background:'var(--bg-sunken)', border:'1px solid var(--line)',
          }}>
            {[
              ['镜头数',     `${shots}`,         ''],
              ['每镜头取',   `${framesPerShot}`, '帧'],
              ['总帧数',     `${totalFrames}`,   ''],
              ['预计耗时',   etaStr,             ''],
            ].map(([l, v, u]) => (
              <div key={l}>
                <div className="eyebrow" style={{ fontSize:9, marginBottom:4 }}>{l}</div>
                <div className="display" style={{ fontSize:24, lineHeight:1 }}>
                  {v}<span style={{ fontSize:11, color:'var(--ink-3)', marginLeft:3 }}>{u}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Cost hint */}
          {totalFrames > 80 && (
            <ErrorState
              tone="warn"
              title="镜头较多 · 视觉模型成本较高"
              detail={`${totalFrames} 帧 × VLM 调用 ≈ $${(totalFrames * 0.008).toFixed(2)}。可改为「2 帧 · 首+尾」减半,或在 Preflight 切换到按秒截帧模式。`}
            />
          )}
        </div>

        <div className="m-foot">
          <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
            <span style={{ color:'var(--accent-warm)' }}>●</span> 中断点 · 等待确认
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" onClick={onAdjust}>
              <IcArrowRight size={12} style={{ transform:'rotate(180deg)' }}/>
              返回调整
            </button>
            <button className="btn-run" onClick={onConfirm}>
              确认 · 开始视觉分析
              <span className="iconwrap"><IcArrowRight size={12}/></span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

window.ShotConfirmModal = ShotConfirmModal;
