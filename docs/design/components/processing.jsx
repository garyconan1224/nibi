/* Processing — .proc-wrap, .step-row, .side-card, .tasklet */

const STAGES = [
  { id:'dl',  ic: IcDownload, t:'下载视频',   s:'download',   desc:'yt-dlp · bilibili dash · 读取并合并字幕。', dur: 8 },
  { id:'fr',  ic: IcFilm,     t:'抽取关键帧', s:'frames',     desc:'PySceneDetect + 1fps 采样 → 128帧。',       dur: 6 },
  { id:'asr', ic: IcMic,      t:'语音转录',   s:'asr',        desc:'Whisper v3 large · 中文 · 带时间戳 SRT。',   dur: 14 },
  { id:'vlm', ic: IcEye,      t:'视觉描述',   s:'vlm',        desc:'Qwen-VL 镜头识别 · OCR · 品牌符号。',         dur: 12 },
  { id:'sum', ic: IcCpu,      t:'结构化摘要', s:'summarize',  desc:'Claude 4.5 生成章节 · 要点 · 关键词。',       dur: 10 },
  { id:'st',  ic: IcWand,     t:'分镜改编',   s:'storyboard', desc:'三种风格化脚本 —— 情感/参数/反转。',          dur: 6 },
];

const LOGS_BY = {
  dl:  [{t:'yt-dlp 1080p · bilibili dash · 387 MB @ 12 MB/s'}, {t:'合并视频 + 音轨 → BV1abc.mp4', k:'ok'}, {t:'提取音频 → audio.wav', k:'ok'}],
  fr:  [{t:'PySceneDetect threshold=30 · 42个场景边界'}, {t:'采样128帧 → /cache/BV1abc/', k:'ok'}],
  asr: [{t:'Whisper v3 large · cuda · device=0'}, {t:'language=zh · conf=0.94'}, {t:'校正专有名词: Pocket/D-Log M/ProRes', k:'warn'}, {t:'SRT · 142段 · 6:42', k:'ok'}],
  vlm: [{t:'Qwen-VL · batch=8 · 128帧'}, {t:'识别霓虹H · DJI logo · 4代并排'}, {t:'OCR × 23处', k:'ok'}],
  sum: [{t:'Claude-4.5 · 5段 · 7关键词'}, {t:'推荐切片×3 · Markdown导出', k:'ok'}],
  st:  [{t:'方案A/B/C生成中…'}, {t:'完成。可查看Results。', k:'ok'}],
};

const Processing = ({ progress, onDone, onCancel }) => {
  const total = STAGES.reduce((a,b) => a + b.dur, 0);
  const elapsed = progress * total;
  let acc = 0;
  const withState = STAGES.map(s => {
    const start = acc; acc += s.dur; const end = start + s.dur;
    let state = 'queued', p = 0;
    if (elapsed >= end) { state = 'done'; p = 1; }
    else if (elapsed > start) { state = 'running'; p = (elapsed - start) / s.dur; }
    return { ...s, state, p };
  });
  const frame = VM_DATA.FRAMES[Math.min(VM_DATA.FRAMES.length-1, Math.floor(progress*(VM_DATA.FRAMES.length-0.01)))];

  return (
    <div className="proc-wrap">
      <div className="proc-main">
        <div className="proc-hero">
          <div className="thumb">
            <div className="live">● LIVE</div>
            <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`}/>
          </div>
          <div className="info">
            <div className="eyebrow">PROCESSING · BV1abc</div>
            <div className="title">三代封神！那四代呢？<br/><span style={{fontSize:22,color:'var(--ink-3)'}}>大疆 Pocket 4 首发体验</span></div>
            <div className="src">bilibili.com/video/BV1abc · 1080p · 387 MB</div>
            <div className="stats">
              <span><strong>6:42</strong> 时长</span>
              <span><strong>128</strong> 帧</span>
              <span><strong>142</strong> 句转录</span>
              <span>剩余 <strong>{Math.max(0,Math.round((1-progress)*total))}s</strong></span>
            </div>
            <div style={{marginTop:16, display:'flex', gap:8, alignItems:'center'}}>
              <button className="btn" onClick={onCancel}><IcX size={14}/>取消</button>
              <button className="btn btn-primary" onClick={onDone}
                style={{opacity: progress < 1 ? 0.5 : 1, cursor: progress < 1 ? 'not-allowed' : 'pointer'}}>
                查看结果 <IcArrowRight size={14}/>
              </button>
              {progress >= 1 && (
                <span className="chip" style={{background:'rgba(34,211,154,0.12)', color:'var(--accent-green)', borderColor:'rgba(34,211,154,0.3)'}}>
                  <span className="chip-dot" style={{background:'var(--accent-green)'}}/>
                  完成 · 自动跳转中…
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="step-stream">
          {withState.map((s, i) => {
            const allLogs = LOGS_BY[s.id] || [];
            const visLogs = s.state === 'done' ? allLogs : allLogs.slice(0, Math.ceil(s.p * allLogs.length));
            return (
              <div key={s.id} className="step-row" data-state={s.state}>
                <div className="ico">
                  {s.state === 'done' ? <IcCheck size={20}/> :
                   s.state === 'running' ? <div className="spinner"/> : <s.ic size={18}/>}
                </div>
                <div className="body">
                  <div className="hd">
                    {s.t}
                    <span className="kbd mono">{s.s}</span>
                  </div>
                  <div className="desc">{s.desc}</div>
                  {visLogs.length > 0 && (
                    <div className="logs">
                      {visLogs.map((l,j) => (
                        <div key={j} className={`ln ${l.k||''}`}>{l.t}</div>
                      ))}
                      {s.state === 'running' && <div className="ln">▌</div>}
                    </div>
                  )}
                </div>
                <div className="progress">
                  <div className="pct">{s.state==='queued'?'—': s.state==='done'?'✓ DONE':`${Math.round(s.p*100)}%`}</div>
                  <div className="bar"><div className="fill" style={{width:`${s.p*100}%`}}/></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="proc-side">
        <div className="side-card">
          <h4>系统资源 <span className="chip"><span className="chip-dot"/>GPU active</span></h4>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[['GPU','71%','RTX 4090 · 24G'],['RAM','18.2G','/ 64 GB DDR5'],['VRAM','16.1G','/ 24 GB'],['ETA',`${Math.max(0,Math.round((1-progress)*total))}s`,'剩余时间']].map(([l,v,s])=>(
              <div key={l}>
                <div className="eyebrow" style={{marginBottom:4}}>{l}</div>
                <div style={{fontFamily:'var(--display)',fontSize:28,lineHeight:1}}>{v}</div>
                <div style={{color:'var(--ink-3)',fontSize:11,marginTop:3}}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="side-card">
          <h4>任务队列 <span className="mono" style={{fontSize:10,opacity:0.6}}>7 TASKS</span></h4>
          {VM_DATA.TASKS.map(t => {
            const f = VM_DATA.FRAMES[t.thumb % VM_DATA.FRAMES.length];
            const dotCls = {running:'running',done:'done',error:'err',queued:'queued'}[t.state]||'queued';
            return (
              <div key={t.id} className="tasklet">
                <div className="tl-thumb"><img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/></div>
                <div className="tl-body">
                  <div className="tl-title">{t.title}</div>
                  <div className="tl-meta">
                    <span className={`dot ${dotCls}`}/>
                    <span>{t.state}</span>
                    <span style={{opacity:0.4}}>·</span>
                    <span>{t.type}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="side-card">
          <h4>预览帧 <span className="mono" style={{fontSize:10,opacity:0.6}}>{frame.ts}</span></h4>
          <div style={{borderRadius:12,overflow:'hidden',marginBottom:10}}>
            <img src={`assets/frame_${frame.ts.replace(/:/g,'_')}.svg`} style={{width:'100%',display:'block'}}/>
          </div>
          <div style={{fontSize:12,fontWeight:600}}>{frame.title}</div>
          <div style={{fontSize:11,color:'var(--ink-3)',marginTop:3}}>{frame.subtitle}</div>
        </div>
      </aside>
    </div>
  );
};

window.Processing = Processing;
