/* VideoDetail — 视频详情页 · 三轨时间轴 + 右侧浮动面板 (§4.4) */

/* ── 每帧对应的提示词数据 ── */
const VD_PROMPTS = [
  {
    mj: 'DJI Pocket 4 on tripod, black backdrop, rim light, carbon fiber texture, studio photography, cinematic --ar 16:9 --style raw',
    sd: 'DJI Pocket 4 on tripod, black background, rim lighting, ultra sharp, product photography, 8k',
    tags: ['product', 'studio light', 'close-up'],
  },
  {
    mj: '4 action cameras side by side on white surface, product comparison, backlit, editorial --ar 16:9',
    sd: '4 action cameras flat lay, clean background, soft diffused light, editorial photography',
    tags: ['comparison', 'minimal', 'flat lay'],
  },
  {
    mj: 'asian male presenter semi-profile, neon H bokeh background, studio interview, 35mm f/1.8 --ar 16:9 --style raw',
    sd: 'man talking to camera, purple neon background bokeh, cinematic portrait, shallow depth of field',
    tags: ['portrait', 'interview', 'neon'],
  },
  {
    mj: 'camera lens module macro detail, carbon fiber texture, dramatic hard side light, product --ar 16:9',
    sd: 'camera module close-up, carbon fiber pattern, hard side lighting, macro lens, pin-sharp detail',
    tags: ['macro', 'texture', 'detail'],
  },
  {
    mj: 'neon letter H sign, purple magenta glow, bokeh, cyberpunk alley, volumetric fog, wet asphalt, blade runner mood --ar 21:9 --style raw --s 250',
    sd: 'neon H sign glowing purple, foggy alley, bokeh, cyberpunk atmosphere, anamorphic lens flare',
    tags: ['neon', 'cyberpunk', 'bokeh', 'fog'],
  },
  {
    mj: 'camera LCD screen showing ProRes RAW HQ recording menu, dark interface, macro product detail --ar 16:9',
    sd: 'camera LCD ProRes RAW HQ menu, dark background, macro lens, sharp edges, tech detail',
    tags: ['UI', 'detail', 'dark', 'macro'],
  },
  {
    mj: 'split screen two cameras same scene side by side, left vs right dynamic range comparison, cinematic --ar 16:9',
    sd: 'side by side video comparison, two cameras same scene, dynamic range test, exposure difference',
    tags: ['comparison', 'split-screen', 'cinematic'],
  },
  {
    mj: 'silhouette woman walking on beach at golden hour, backlit, shallow DOF, hasselblad film grain, warm tones --ar 16:9',
    sd: 'woman at beach sunset, silhouette, golden hour, bokeh, warm amber tones, Kodak Portra 400, emotional',
    tags: ['golden hour', 'beach', 'portrait', 'warm tones'],
  },
];

/* ── Pause icon (not in icons.jsx) ── */
const VDIcPause = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="6"  y="4" width="4" height="16" rx="1.5"/>
    <rect x="14" y="4" width="4" height="16" rx="1.5"/>
  </svg>
);

const TRACK_COLORS = [
  'var(--accent)', 'var(--accent-2)', 'var(--accent-3)',
  'var(--accent-warm)', 'var(--accent-green)',
];

/* ═══════════════════════════════════════════
   VideoDetail
   ═══════════════════════════════════════════ */
const VideoDetail = ({ material, onBack, onAddFavorite }) => {
  const [activeFrame, setActiveFrame] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [promptStyle, setPromptStyle] = React.useState('mj');
  const [copied, setCopied]     = React.useState(false);
  const [favored, setFavored]   = React.useState({});

  const transcriptRef = React.useRef(null);
  const stripRef      = React.useRef(null);
  const promptZoneRef = React.useRef(null);

  /* ── Simulated playback ── */
  React.useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setActiveFrame(f => {
        if (f >= VM_DATA.FRAMES.length - 1) { setPlaying(false); return f; }
        return f + 1;
      });
    }, 1400);
    return () => clearInterval(t);
  }, [playing]);

  const frame  = VM_DATA.FRAMES[activeFrame];
  const prompt = VD_PROMPTS[activeFrame] || VD_PROMPTS[0];
  const totalSec = 402; // 6:42
  const progress = frame.sec / totalSec;

  /* ── Active transcript line ── */
  const activeTrIdx = VM_DATA.TRANSCRIPT.reduce((best, l, i) => {
    const sec = l.t.split(':').reduce((a, b, idx) => a + (idx === 0 ? Number(b) * 60 : Number(b)), 0);
    return sec <= frame.sec ? i : best;
  }, 0);

  /* ── Auto-scroll: transcript ── */
  React.useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]');
    if (active) el.scrollTop = Math.max(0, active.offsetTop - el.clientHeight / 2 + active.clientHeight / 2);
  }, [activeTrIdx]);

  /* ── Auto-scroll: thumbnail strip ── */
  React.useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const el = strip.children[activeFrame];
    if (el) strip.scrollLeft = Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2);
  }, [activeFrame]);

  /* ── Auto-scroll: prompt zone strip ── */
  React.useEffect(() => {
    const strip = promptZoneRef.current;
    if (!strip) return;
    const el = strip.children[activeFrame];
    if (el) strip.scrollLeft = Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2);
  }, [activeFrame]);

  /* ── Jump by transcript click ── */
  const jumpToLine = (l) => {
    const sec = l.t.split(':').reduce((a, b, idx) => a + (idx === 0 ? Number(b) * 60 : Number(b)), 0);
    const nf  = VM_DATA.FRAMES.reduce((best, f, fi) =>
      Math.abs(f.sec - sec) < Math.abs(VM_DATA.FRAMES[best].sec - sec) ? fi : best, 0);
    setActiveFrame(nf); setPlaying(false);
  };

  /* ── Copy prompt ── */
  const handleCopy = () => {
    const text = promptStyle === 'json'
      ? JSON.stringify({ timestamp: frame.ts, title: frame.title, prompt_mj: prompt.mj, prompt_sd: prompt.sd, tags: prompt.tags }, null, 2)
      : (promptStyle === 'sd' ? prompt.sd : prompt.mj);
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  /* ── Favorite ── */
  const handleFavorite = () => {
    const next = !favored[activeFrame];
    setFavored(f => ({ ...f, [activeFrame]: next }));
    if (next && onAddFavorite) onAddFavorite(activeFrame, frame, prompt);
  };

  const promptText = promptStyle === 'json'
    ? JSON.stringify({ timestamp: frame.ts, title: frame.title, prompt_mj: prompt.mj, prompt_sd: prompt.sd, tags: prompt.tags }, null, 2)
    : (promptStyle === 'sd' ? prompt.sd : prompt.mj);

  /* ── Render ── */
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', height: '100%', overflow: 'hidden' }}>

      {/* ════════ LEFT: Player + 3-track timeline ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Nav bar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px',
                      borderBottom:'1px solid var(--line)', flexShrink:0, background:'var(--bg-elev)' }}>
          <button className="btn btn-ghost" onClick={onBack}
                  style={{ height:28, padding:'0 10px', fontSize:12, display:'flex', alignItems:'center', gap:5 }}>
            <IcArrowRight size={13} style={{ transform:'rotate(180deg)' }}/> 任务中心
          </button>
          <span style={{ width:1, height:16, background:'var(--line)', flexShrink:0 }}/>
          <span style={{ fontWeight:600, fontSize:13, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {material?.title || '大疆 Pocket 4 首发体验'}
          </span>
          <span className="kw mono" style={{ fontSize:10, flexShrink:0 }}>VIDEO · 6:42</span>
          <button className="btn btn-ghost" style={{ height:28, padding:'0 10px', fontSize:12, flexShrink:0 }}>
            <IcDownload size={13}/> .srt
          </button>
          <button className="btn btn-ghost" style={{ height:28, padding:'0 10px', fontSize:12, flexShrink:0 }}>
            <IcDownload size={13}/> .md
          </button>
        </div>

        {/* ── Video player ── */}
        <div style={{ padding:'14px 20px 10px', flexShrink:0 }}>
          <div onClick={() => setPlaying(p => !p)}
               style={{ position:'relative', borderRadius:16, overflow:'hidden', cursor:'pointer',
                        background: frame.bg, aspectRatio:'16/9', maxHeight:260 }}>
            <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`}
                 style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>

            {/* Bottom overlay */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 16px',
                          background:'linear-gradient(0deg,rgba(0,0,0,0.78) 0%,transparent)' }}>
              <div className="mono" style={{ fontSize:10, color:'rgba(255,255,255,0.6)' }}>
                {frame.ts} · {frame.tag} · Scene {frame.scene}
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginTop:2 }}>{frame.title}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1 }}>{frame.subtitle}</div>
            </div>

            {/* Play / Pause button */}
            <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                          width:48, height:48, borderRadius:99, background:'rgba(255,255,255,0.9)',
                          display:'grid', placeItems:'center', color:'#000' }}>
              {playing ? <VDIcPause size={18}/> : <IcPlay size={18}/>}
            </div>

            {/* Progress bar */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:3, background:'rgba(255,255,255,0.15)' }}>
              <div style={{ height:'100%', width:`${progress*100}%`, background:'var(--accent)', transition:'width 300ms ease' }}/>
            </div>
          </div>
        </div>

        {/* ── Three tracks ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 20px 20px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* ─ Track 1: Frame thumbnails ─ */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
              <span className="eyebrow">轨道 1 · 镜头缩略图</span>
              <span className="mono" style={{ fontSize:10, color:'var(--ink-4)' }}>
                {VM_DATA.FRAMES.length} 帧 · 点击跳转
              </span>
            </div>
            <div ref={stripRef}
                 style={{ display:'flex', gap:5, overflowX:'auto', paddingBottom:6 }}>
              {VM_DATA.FRAMES.map((f, i) => (
                <div key={i} onClick={() => { setActiveFrame(i); setPlaying(false); }}
                     style={{
                       flexShrink:0, width:96, borderRadius:8, overflow:'hidden', cursor:'pointer',
                       border:`2px solid ${i===activeFrame ? 'var(--accent)' : 'transparent'}`,
                       background:'var(--bg-sunken)',
                       transform: i===activeFrame ? 'translateY(-2px)' : 'none',
                       transition:'border-color 140ms, transform 140ms',
                     }}>
                  <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}
                       style={{ width:'100%', aspectRatio:'16/9', objectFit:'cover', display:'block' }}/>
                  <div className="mono" style={{ fontSize:9, color:'var(--ink-4)', padding:'3px 5px 0' }}>{f.ts}</div>
                  <div style={{ fontSize:10, padding:'1px 5px 5px', fontWeight: i===activeFrame ? 600 : 400,
                                color: i===activeFrame ? 'var(--accent)' : 'var(--ink-2)',
                                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ─ Track 2: Subtitle text ─ */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
              <span className="eyebrow">轨道 2 · 字幕文本</span>
              <span className="mono" style={{ fontSize:10, color:'var(--ink-4)' }}>点击行跳转 · 自动高亮</span>
            </div>
            <div ref={transcriptRef}
                 style={{ maxHeight:185, overflowY:'auto', background:'var(--bg-elev)',
                          border:'1px solid var(--line)', borderRadius:14, padding:'4px' }}>
              {VM_DATA.TRANSCRIPT.map((l, i) => (
                <div key={i} className="tr-line" data-active={i===activeTrIdx}
                     onClick={() => jumpToLine(l)}>
                  <span className="ts">{l.t}</span>
                  <span className="txt">{l.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ─ Track 3: Prompt zones ─ */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
              <span className="eyebrow">轨道 3 · 提示词区间</span>
              <span className="mono" style={{ fontSize:10, color:'var(--ink-4)' }}>点击切换到对应帧</span>
            </div>
            <div ref={promptZoneRef}
                 style={{ display:'flex', gap:5, background:'var(--bg-elev)', border:'1px solid var(--line)',
                          borderRadius:14, padding:8, overflowX:'auto' }}>
              {VM_DATA.FRAMES.map((f, i) => {
                const p   = VD_PROMPTS[i] || VD_PROMPTS[0];
                const col = TRACK_COLORS[i % TRACK_COLORS.length];
                const on  = i === activeFrame;
                return (
                  <div key={i} onClick={() => { setActiveFrame(i); setPlaying(false); }}
                       style={{
                         flexShrink:0, width:118, padding:'9px 10px', borderRadius:10, cursor:'pointer',
                         background: on ? col : 'var(--bg-sunken)',
                         border:`1.5px solid ${on ? col : 'transparent'}`,
                         transition:'all 160ms ease',
                       }}>
                    <div className="mono" style={{ fontSize:9, marginBottom:4,
                                                   color: on ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)' }}>
                      {f.ts}
                    </div>
                    <div style={{ fontSize:10, lineHeight:1.45, overflow:'hidden',
                                  display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical',
                                  color: on ? '#fff' : 'var(--ink-3)' }}>
                      {p.mj.substring(0, 65)}…
                    </div>
                    <div style={{ display:'flex', gap:3, marginTop:6, flexWrap:'wrap' }}>
                      {p.tags.slice(0,2).map(t => (
                        <span key={t} style={{ fontSize:9, padding:'1px 5px', borderRadius:4,
                          background: on ? 'rgba(255,255,255,0.22)' : 'var(--bg-elev)',
                          color: on ? '#fff' : 'var(--ink-3)' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>{/* end three tracks */}
      </div>{/* end left area */}

      {/* ════════ RIGHT: Floating prompt panel ════════ */}
      <div style={{ borderLeft:'1px solid var(--line)', display:'flex', flexDirection:'column',
                    background:'var(--bg-elev)', overflow:'hidden' }}>

        {/* Frame preview thumbnail */}
        <div style={{ position:'relative', flexShrink:0, aspectRatio:'16/9', background:frame.bg }}>
          <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`}
               style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
          <div className="mono" style={{ position:'absolute', bottom:8, left:10, fontSize:9,
                                         color:'rgba(255,255,255,0.85)', background:'rgba(0,0,0,0.55)',
                                         padding:'2px 7px', borderRadius:5 }}>
            {frame.ts} · {frame.tag}
          </div>
          {/* Favorite star badge */}
          {favored[activeFrame] && (
            <div style={{ position:'absolute', top:8, right:10 }}>
              <IcStar size={16} style={{ fill:'var(--accent-warm)', color:'var(--accent-warm)' }}/>
            </div>
          )}
        </div>

        {/* Frame info */}
        <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--line)', flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:700, lineHeight:1.3 }}>{frame.title}</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:2 }}>{frame.subtitle}</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:8 }}>
            {prompt.tags.map(t => (
              <span key={t} className="kw" style={{ fontSize:10 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Prompt style tabs */}
        <div style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 12px',
                      borderBottom:'1px solid var(--line)', flexShrink:0, background:'var(--bg-sunken)' }}>
          <span className="eyebrow" style={{ flex:1 }}>提示词格式</span>
          {['mj','sd','json'].map(s => (
            <button key={s} onClick={() => setPromptStyle(s)}
                    style={{ height:26, padding:'0 10px', borderRadius:6, fontSize:11, fontWeight:700,
                             fontFamily:'var(--mono)', border:'none', cursor:'pointer',
                             background: promptStyle===s ? 'var(--ink)' : 'transparent',
                             color: promptStyle===s ? 'var(--bg)' : 'var(--ink-3)' }}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Prompt text area */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:11.5, lineHeight:1.72,
                        background:'var(--bg-sunken)', padding:'12px 13px', borderRadius:12,
                        border:'1px solid var(--line)', color:'var(--ink)',
                        whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
            {promptText}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ padding:'10px 12px', borderTop:'1px solid var(--line)',
                      display:'flex', flexDirection:'column', gap:7, flexShrink:0 }}>
          <button onClick={handleCopy}
                  style={{ width:'100%', height:36, borderRadius:10, fontSize:13, fontWeight:600,
                           display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                           cursor:'pointer', border:'none', background:'var(--ink)', color:'var(--bg)',
                           transition:'opacity 120ms' }}>
            {copied ? <IcCheck size={14}/> : <IcDownload size={14}/>}
            {copied ? '已复制！' : '一键复制提示词'}
          </button>
          <button onClick={handleFavorite}
                  style={{ width:'100%', height:36, borderRadius:10, fontSize:13, fontWeight:600,
                           display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                           cursor:'pointer', border:'1px solid var(--line)',
                           background: favored[activeFrame] ? 'rgba(255,184,76,0.1)' : 'var(--bg-sunken)',
                           color: favored[activeFrame] ? 'var(--accent-warm)' : 'var(--ink-2)',
                           transition:'all 140ms' }}>
            <IcStar size={14} style={{
              fill:  favored[activeFrame] ? 'var(--accent-warm)' : 'none',
              color: favored[activeFrame] ? 'var(--accent-warm)' : 'inherit',
            }}/>
            {favored[activeFrame] ? '已收藏此帧 ★' : '收藏此帧'}
          </button>

          {/* Frame counter */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span className="mono" style={{ fontSize:10, color:'var(--ink-4)' }}>
              帧 {activeFrame+1} / {VM_DATA.FRAMES.length} · Scene {frame.scene}
            </span>
            <div style={{ display:'flex', gap:4 }}>
              <button className="btn btn-ghost"
                      style={{ width:26, height:26, padding:0, display:'grid', placeItems:'center' }}
                      onClick={() => setActiveFrame(f => Math.max(0, f-1))} title="上一帧">
                <IcArrowRight size={12} style={{ transform:'rotate(180deg)' }}/>
              </button>
              <button className="btn btn-ghost"
                      style={{ width:26, height:26, padding:0, display:'grid', placeItems:'center' }}
                      onClick={() => setActiveFrame(f => Math.min(VM_DATA.FRAMES.length-1, f+1))} title="下一帧">
                <IcArrowRight size={12}/>
              </button>
            </div>
          </div>
        </div>

      </div>{/* end right panel */}
    </div>
  );
};

window.VideoDetail = VideoDetail;
