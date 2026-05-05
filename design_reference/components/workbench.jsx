/* Workbench (Home) — task-centric home with URL composer, platform detection, frame modes. v2.2 */

const PLATFORMS = {
  'bilibili.com':  { name:'Bilibili',  color:'#00A1D6', types:['video'] },
  'youtube.com':   { name:'YouTube',   color:'#FF0000', types:['video'] },
  'youtu.be':      { name:'YouTube',   color:'#FF0000', types:['video'] },
  'douyin.com':    { name:'抖音',      color:'#010101', types:['video'] },
  'xiaohongshu.com':{ name:'小红书',   color:'#FF2442', types:['video','image','article'] },
  'kuaishou.com':  { name:'快手',      color:'#FF6600', types:['video'] },
  'weixin.qq.com': { name:'微信公众号', color:'#07C160', types:['article'] },
};

const detectPlatform = (url) => {
  try {
    const host = new URL(url).hostname.replace('www.','');
    return Object.entries(PLATFORMS).find(([k]) => host.includes(k));
  } catch { return null; }
};

const PIPE_STEPS = [
  { n:'1', t:'下载',   s:'Download',  ic: IcDownload, on: true,  tone: null },
  { n:'2', t:'抽帧',   s:'Frames',    ic: IcFilm,     on: true,  tone: null },
  { n:'3', t:'转录',   s:'ASR',       ic: IcMic,      on: true,  tone: 'pink' },
  { n:'4', t:'视觉',   s:'VLM',       ic: IcEye,      on: true,  tone: 'purple' },
  { n:'5', t:'结构化', s:'Summarize', ic: IcCpu,      on: true,  tone: 'blue' },
  { n:'6', t:'分镜',   s:'Storyboard',ic: IcWand,     on: false, tone: 'amber' },
  { n:'7', t:'切片',   s:'Clips',     ic: IcLayers,   on: false, tone: null },
];

const QUALITY_OPTS = ['最高画质','1080p','720p','仅音频'];
const FRAME_MODES = [
  { id:'A', l:'按秒截帧', desc:'每 N 秒 1 张,自动过滤相似帧' },
  { id:'B', l:'AI 镜头分析', desc:'识别镜头切换点,每镜头取 2–3 帧' },
];

const Workbench = ({ onStart }) => {
  const [url, setUrl] = React.useState('');
  const [steps, setSteps] = React.useState(() => PIPE_STEPS.map(s => s.on));
  const [model, setModel] = React.useState('claude');
  const [asr, setAsr] = React.useState('whisper');
  const [quality, setQuality] = React.useState('1080p');
  const [frameMode, setFrameMode] = React.useState('A');
  const [fps, setFps] = React.useState(2);
  const [maxFrames, setMaxFrames] = React.useState(128);
  const [mixedOpen, setMixedOpen] = React.useState(false);
  const [mixedSel, setMixedSel] = React.useState({video:true, audio:true, article:false});

  const toggle = (i) => setSteps(ss => ss.map((v,j) => j===i ? !v : v));
  const detected = detectPlatform(url);
  const platform = detected ? detected[1] : null;
  const isMixed = platform && platform.types.length > 1;

  const handleUrl = (e) => {
    setUrl(e.target.value);
  };

  const handleRun = () => {
    if (isMixed) { setMixedOpen(true); return; }
    onStart({ url, model, asr, steps });
  };

  return (
    <>
      {/* ─── Hero + Composer ─── */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="hb-pill">v0.3 BETA</span>
          VidMirror · <span className="mono" style={{fontSize:11}}>127.0.0.1:8010</span>
          <span style={{width:4,height:4,borderRadius:99,background:'var(--ink-4)'}}/>
          本地版 · 无文件大小限制
        </div>
        <h1 className="display">
          把任意内容,变成<br/>
          <span className="accent-pink">可复刻</span>的<span className="accent-purple">创作蓝图</span>。
        </h1>
        <p className="lede">
          粘贴 B站 / YouTube / 小红书 / 抖音链接,或上传本地视频·图片·音频·文字 —— VidMirror 自动识别类型,
          调用 AI 分析并提取画面提示词、字幕、风格参数,归入任务数据库。
        </p>

        <div className="composer">
          {/* URL row */}
          <div className="composer-url">
            {platform ? (
              <div className="platform" style={{background: platform.color, color:'#fff', fontSize:10, fontWeight:700, letterSpacing:'0.04em', width:'auto', padding:'0 10px'}}>
                {platform.name}
              </div>
            ) : (
              <div className="platform"><IcLink size={18}/></div>
            )}
            <input value={url} onChange={handleUrl}
                   placeholder="粘贴 B站 / YouTube / 小红书 / 抖音 / 本地文件路径..."/>
            {/* Detected types */}
            {platform && (
              <div style={{display:'flex', gap:4, flexShrink:0}}>
                {platform.types.map(t => (
                  <span key={t} className="kw" style={{background:'var(--bg-sunken)', fontSize:11}}>{t}</span>
                ))}
              </div>
            )}
            <button className="btn btn-ghost" title="上传本地文件"><IcUpload size={16}/>上传</button>
          </div>

          {/* Download quality row (only for video) */}
          {(!platform || platform.types.includes('video')) && (
            <div style={{display:'flex', gap:8, padding:'0 20px 0', alignItems:'center', flexWrap:'wrap'}}>
              <span className="eyebrow" style={{fontSize:9}}>画质</span>
              <div className="tw-segm" style={{display:'flex', gap:3}}>
                {QUALITY_OPTS.map(q => (
                  <button key={q} data-active={quality===q} onClick={()=>setQuality(q)}
                    style={{height:28, padding:'0 10px', fontSize:11, borderRadius:7, border:'none',
                      background: quality===q ? 'var(--ink)' : 'transparent',
                      color: quality===q ? 'var(--bg)' : 'var(--ink-3)'}}>
                    {q}
                  </button>
                ))}
              </div>
              <span style={{width:1, height:16, background:'var(--line)', flexShrink:0}}/>
              <span className="eyebrow" style={{fontSize:9}}>抽帧</span>
              {FRAME_MODES.map(m => (
                <button key={m.id} data-active={frameMode===m.id} onClick={()=>setFrameMode(m.id)}
                  style={{height:28, padding:'0 10px', fontSize:11, borderRadius:7, border:'none',
                    background: frameMode===m.id ? 'var(--ink)' : 'transparent',
                    color: frameMode===m.id ? 'var(--bg)' : 'var(--ink-3)'}}>
                  {m.id}: {m.l}
                </button>
              ))}
              {frameMode==='A' && (
                <>
                  <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>每</span>
                  <input type="number" min="1" max="60" value={fps}
                    onChange={e=>setFps(+e.target.value)}
                    style={{width:46, height:28, borderRadius:7, border:'1px solid var(--line)',
                      background:'var(--bg-sunken)', textAlign:'center', fontFamily:'var(--mono)', fontSize:12,
                      color:'var(--ink)', padding:'0 6px'}}/>
                  <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>秒 · 上限</span>
                  <input type="number" min="16" max="512" value={maxFrames}
                    onChange={e=>setMaxFrames(+e.target.value)}
                    style={{width:52, height:28, borderRadius:7, border:'1px solid var(--line)',
                      background:'var(--bg-sunken)', textAlign:'center', fontFamily:'var(--mono)', fontSize:12,
                      color:'var(--ink)', padding:'0 6px'}}/>
                  <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>帧</span>
                </>
              )}
            </div>
          )}

          {/* Options row */}
          <div className="composer-options">
            <div className="opt-cell">
              <div className="opt-label">ASR</div>
              <div className="opt-value">
                <select value={asr} onChange={e=>setAsr(e.target.value)}
                  style={{background:'transparent',border:'none',outline:'none',font:'inherit',color:'inherit',padding:0}}>
                  <option value="whisper">Whisper v3 large</option>
                  <option value="funasr">FunASR · Paraformer</option>
                  <option value="sense">SenseVoice · 多语</option>
                </select>
              </div>
            </div>
            <div className="opt-cell">
              <div className="opt-label">视觉 LLM</div>
              <div className="opt-value">Qwen-VL-Max <IcArrowRight size={12}/></div>
            </div>
            <div className="opt-cell">
              <div className="opt-label">文本 LLM</div>
              <div className="opt-value">
                <select value={model} onChange={e=>setModel(e.target.value)}
                  style={{background:'transparent',border:'none',outline:'none',font:'inherit',color:'inherit',padding:0}}>
                  <option value="claude">Claude 4.5 · 长文本</option>
                  <option value="gpt">GPT-4.1 · 通用</option>
                  <option value="qwen">Qwen3-Max · 中文</option>
                  <option value="local">Ollama · 本地</option>
                </select>
              </div>
            </div>
            <div className="opt-cell">
              <div className="opt-label">提示词风格</div>
              <div className="opt-value">Midjourney · 双语 <IcArrowRight size={12}/></div>
            </div>
          </div>

          {/* Pipeline */}
          <div className="composer-pipeline">
            <span className="pipe-label">Pipeline</span>
            {PIPE_STEPS.map((s, i) => (
              <button key={i} className="step-pill" data-on={steps[i]} data-tone={s.tone}
                      onClick={() => toggle(i)}>
                <span className="spn">{s.n}</span>
                <s.ic size={14}/>
                {s.t}
                <span className="mono" style={{fontSize:10, opacity:0.5}}>{s.s}</span>
              </button>
            ))}
          </div>

          {/* Run */}
          <div className="composer-run">
            <div className="meta">
              <span className="chip"><span className="chip-dot"/>预计 ~ 4 min</span>
              <span style={{opacity:0.5}}>·</span>
              <span className="mono" style={{fontSize:11}}>{frameMode==='A'?`按秒截帧 ${fps}s · ≤${maxFrames}帧`:'AI 镜头分析模式'}</span>
            </div>
            <button className="btn-run" onClick={handleRun}>
              {isMixed ? '选择内容类型' : '开始解析'}
              <span className="iconwrap"><IcArrowRight size={14}/></span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── Mixed content modal ─── */}
      <div className="modal-backdrop" data-open={mixedOpen} onClick={()=>setMixedOpen(false)}/>
      <div className="modal" data-open={mixedOpen} style={{width:460}}>
        <div className="m-head">
          <div>
            <div className="eyebrow">混合内容 · 请选择下载范围</div>
            <h3 className="display" style={{fontSize:24, margin:'4px 0 0'}}>{platform?.name} 页面</h3>
          </div>
          <button className="btn btn-ghost" onClick={()=>setMixedOpen(false)}><IcX size={16}/></button>
        </div>
        <div className="m-body" style={{gap:12}}>
          {platform?.types.map(t => (
            <label key={t} className="fav-item" style={{cursor:'pointer', gridTemplateColumns:'auto 1fr'}}>
              <input type="checkbox" checked={mixedSel[t]||false}
                onChange={e=>setMixedSel(s=>({...s,[t]:e.target.checked}))}
                style={{accentColor:'var(--accent)', width:16, height:16}}/>
              <div>
                <div style={{fontSize:14, fontWeight:600, textTransform:'capitalize'}}>{t}</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>
                  {t==='video'?'下载视频文件 · yt-dlp':t==='audio'?'仅下载音频 · MP3/WAV':'抓取文章文字 · 通用抓取'}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="m-foot">
          <span className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>已选 {Object.values(mixedSel).filter(Boolean).length} 类内容</span>
          <button className="btn btn-primary" onClick={()=>{setMixedOpen(false); onStart({url,model,asr,steps});}}>
            <IcDownload size={13}/>确认下载
          </button>
        </div>
      </div>

      {/* ─── Recent tasks ─── */}
      <section className="examples">
        <div className="examples-head">
          <h2 className="display" style={{margin:0, fontSize:36}}>最近任务</h2>
          <button className="btn btn-ghost">全部 · {VM_DATA.TASKS.length} <IcArrowRight size={14}/></button>
        </div>
        <div className="ex-grid">
          {VM_DATA.TASKS.slice(0, 8).map(t => {
            const f = VM_DATA.FRAMES[t.thumb % VM_DATA.FRAMES.length];
            const stateColor = {done:'var(--accent-green)',running:'var(--ink)',error:'var(--accent)',queued:'var(--ink-4)'}[t.state];
            return (
              <div key={t.id} className="ex-card">
                <div className="ex-thumb">
                  <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/>
                  <div style={{position:'absolute',top:8,left:8,display:'inline-flex',alignItems:'center',
                    gap:5,padding:'3px 8px',borderRadius:99,background:'rgba(0,0,0,0.65)',
                    fontSize:10,color:'#fff',fontFamily:'var(--mono)'}}>
                    <span style={{width:5,height:5,borderRadius:99,background:stateColor}}/>
                    {t.state}
                  </div>
                </div>
                <div className="ex-meta">
                  <div className="ex-title">{t.title}</div>
                  <div className="ex-sub">{t.src} · {t.type}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
};

window.Workbench = Workbench;

