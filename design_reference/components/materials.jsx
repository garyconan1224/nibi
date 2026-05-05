/* Material detail views — video/audio/image/text per spec v2.1 §六七八十 */

/* ─── Video detail · 3-track timeline ─── */
const MatVideo = () => {
  const [active, setActive] = React.useState(2);
  const [playing, setPlaying] = React.useState(false);
  const f = VM_DATA.FRAMES[active];
  return (
    <div className="md-video">
      {/* Player */}
      <div className="mv-player">
        <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/>
        <div className="mv-play" onClick={()=>setPlaying(!playing)}>
          <IcPlay size={28}/>
        </div>
        <div className="mv-info">
          <span className="mono" style={{opacity:0.7, fontSize:11}}>{f.ts}</span>
          <span style={{fontWeight:600}}>{f.title}</span>
        </div>
      </div>

      {/* 3-track panel */}
      <div className="mv-tracks">
        {/* Track 1: frames */}
        <div className="mv-track">
          <div className="mv-track-h"><span className="eyebrow">轨道1 · 镜头</span><span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{VM_DATA.FRAMES.length} 关键帧</span></div>
          <div className="mv-frames">
            {VM_DATA.FRAMES.map((ff, i) => (
              <div key={i} className="mvf" data-active={i===active} onClick={()=>setActive(i)}>
                <img src={`assets/frame_${ff.ts.replace(/:/g,'_')}.svg`}/>
                <span className="mono">{ff.ts}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Track 2: transcript scroll */}
        <div className="mv-track">
          <div className="mv-track-h"><span className="eyebrow">轨道2 · 字幕</span><span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>随播放高亮</span></div>
          <div className="mv-trans">
            {VM_DATA.TRANSCRIPT.slice(0,5).map((l,i) => {
              const sec = l.t.split(':').reduce((a,b,i)=>a+(i===0?+b*60:+b),0);
              const nf = VM_DATA.FRAMES.reduce((b,ff,fi)=>Math.abs(ff.sec-sec)<Math.abs(VM_DATA.FRAMES[b].sec-sec)?fi:b,0);
              return (
                <div key={i} className="mvt-l" data-active={nf===active} onClick={()=>setActive(nf)}>
                  <span className="mono">{l.t}</span>
                  <span>{l.text}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Track 3: prompt intervals */}
        <div className="mv-track">
          <div className="mv-track-h"><span className="eyebrow">轨道3 · 提示词区间</span><span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>对应镜头</span></div>
          <div className="mv-prompts">
            {VM_DATA.FRAMES.map((ff,i)=>(
              <div key={i} className="mvp" data-active={i===active} onClick={()=>setActive(i)}>
                <span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{ff.ts}</span>
                <span>{ff.tag} · {ff.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right-side current-frame prompt */}
      <div className="mv-side">
        <div className="eyebrow" style={{marginBottom:8}}>当前帧 · {f.ts}</div>
        <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`} style={{width:'100%', borderRadius:10, marginBottom:10}}/>
        <div style={{fontSize:14, fontWeight:600, marginBottom:4}}>{f.title}</div>
        <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:12}}>{f.subtitle}</div>
        <div className="fp-text" style={{fontSize:12, padding:12}}>
          {f.title.toLowerCase()}, cinematic lighting, shallow DOF, warm tones, shot on 35mm, --ar 16:9
        </div>
        <div style={{display:'flex', gap:6, marginTop:10}}>
          <button className="btn" style={{flex:1}}><IcDownload size={12}/>复制</button>
          <button className="btn btn-primary" style={{flex:1}}><IcStar size={12}/>收藏此帧</button>
        </div>
      </div>
    </div>
  );
};

/* ─── Audio detail · VAD + Whisper + speaker + music ─── */
const MatAudio = () => {
  const speakers = [
    { id:'S1', name:'Hugo · 主持',   color:'var(--accent)',   lines:28, sec:184 },
    { id:'S2', name:'工程师 · 嘉宾', color:'var(--accent-3)', lines:12, sec:62  },
    { id:'BGM', name:'背景音乐',     color:'var(--accent-warm)', lines:0, sec:158 },
  ];
  const music = [
    { t:'00:00–00:34', genre:'ambient', bpm:76, key:'Cmaj', mood:'悬疑', inst:'合成器pad + 钢琴' },
    { t:'01:20–02:10', genre:'lo-fi',   bpm:92, key:'Amin', mood:'轻松', inst:'鼓组 + 电钢' },
    { t:'04:10–05:02', genre:'cinematic',bpm:88,key:'Dmin',mood:'升华', inst:'弦乐 + 打击乐' },
  ];
  return (
    <div className="md-audio">
      <div className="ma-wave">
        <div className="ma-wave-h">
          <span className="eyebrow">VAD · 人声/音乐分布 · 5:24</span>
          <div style={{display:'flex', gap:6}}>
            <span className="kw" style={{background:'var(--accent)', color:'#fff', border:'none'}}>人声 46%</span>
            <span className="kw" style={{background:'var(--accent-warm)', color:'#111', border:'none'}}>音乐 49%</span>
            <span className="kw">静音 5%</span>
          </div>
        </div>
        <div className="ma-wave-body">
          {Array.from({length:160}).map((_,i)=>{
            const h = 8 + Math.abs(Math.sin(i*0.28) + Math.cos(i*0.11)) * 18;
            const typ = i<30?'v':i<50?'m':i<90?'v':i<130?'m':'v';
            const color = typ==='v'?'var(--accent)':typ==='m'?'var(--accent-warm)':'var(--ink-4)';
            return <span key={i} className="ma-bar" style={{height:`${h}px`, background:color}}/>;
          })}
        </div>
      </div>

      <div className="ma-cols">
        <div className="ma-col">
          <div className="eyebrow" style={{marginBottom:10}}>说话人聚类 · pyannote · 声纹匹配</div>
          {speakers.map(s => (
            <div key={s.id} className="spk-row">
              <div className="spk-av" style={{background:s.color}}>{s.id}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:600}}>{s.name}</div>
                <div className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{s.lines} 句 · {Math.floor(s.sec/60)}:{String(s.sec%60).padStart(2,'0')}</div>
              </div>
              <button className="btn btn-ghost" style={{height:28, fontSize:11}}><IcEdit size={11}/>改名</button>
            </div>
          ))}
          <div style={{padding:'12px 0 0', borderTop:'1px solid var(--line)', marginTop:12, display:'flex', gap:6, flexWrap:'wrap'}}>
            <span className="kw">Whisper v3</span>
            <span className="kw">中文 · 94% conf</span>
            <span className="kw">SRT · 142 段</span>
            <button className="btn" style={{marginLeft:'auto'}}><IcDownload size={12}/>导出 .srt</button>
          </div>
        </div>

        <div className="ma-col">
          <div className="eyebrow" style={{marginBottom:10}}>音乐片段切分 · 3段</div>
          {music.map((m,i)=>(
            <div key={i} className="mus-row">
              <div className="mus-head">
                <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{m.t}</span>
                <span className="kw">{m.genre}</span>
              </div>
              <div className="mus-stats">
                <div><span className="eyebrow" style={{fontSize:9}}>BPM</span><b>{m.bpm}</b></div>
                <div><span className="eyebrow" style={{fontSize:9}}>KEY</span><b>{m.key}</b></div>
                <div><span className="eyebrow" style={{fontSize:9}}>情绪</span><b>{m.mood}</b></div>
              </div>
              <div style={{fontSize:12, color:'var(--ink-3)'}}>{m.inst}</div>
              <div className="fp-text" style={{fontSize:11, padding:10, marginTop:8}}>
                {m.mood} {m.genre} at {m.bpm} BPM in {m.key}, {m.inst}, for video background
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Image detail · 4 parallel tasks ─── */
const MatImage = () => {
  const tasks = [
    { k:'desc',   l:'内容识别描述', icon:IcEye,  body:'一名身穿红裙的女性,站在落地窗边,侧光打亮面部。构图中心偏左,背景虚化呈现橘黄色光斑。整体风格电影感,暖调,高对比度,有意利用剪影与轮廓光。' },
    { k:'ocr',    l:'OCR 文字提取', icon:IcText, body:'Midjourney · v6\nmodel: v6.1\nstyle: raw\naspect: 16:9\nprompted by @hugo.film' },
    { k:'prompt', l:'画面提示词',   icon:IcTag,  body:'woman in red dress, window light, rim light, shallow depth of field, warm tones, cinematic, 35mm, kodak portra 400, editorial portrait, --ar 16:9 --style raw' },
    { k:'assoc',  l:'联想总结',     icon:IcSpark,body:'用途: 时尚杂志封面 / 短视频封面\n受众: 25-35女性 / 时尚爱好者\n设计意图: 温暖+神秘,营造"被凝视的主角感"\n竞品洞察: 与Vogue近期封面调性一致' },
  ];
  const exif = [
    ['相机','Canon EOS R5'], ['镜头','RF 85mm f/1.2'], ['光圈','f/1.4'],
    ['快门','1/250s'], ['ISO','400'], ['时间','2026-03-14 17:42'],
  ];
  return (
    <div className="md-image">
      <div className="mi-main">
        <img src={`assets/frame_${VM_DATA.FRAMES[3].ts.replace(/:/g,'_')}.svg`}/>
      </div>
      <div className="mi-side">
        <div className="eyebrow" style={{marginBottom:10}}>EXIF · 元信息</div>
        <div className="exif-grid">
          {exif.map(([k,v])=>(<React.Fragment key={k}>
            <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{k}</span>
            <span style={{fontSize:12}}>{v}</span>
          </React.Fragment>))}
        </div>
        <div style={{display:'flex', gap:6, marginTop:14}}>
          <button className="btn" style={{flex:1}}><IcStar size={12}/>加入收藏</button>
          <button className="btn btn-primary" style={{flex:1}}><IcDownload size={12}/>导出</button>
        </div>
      </div>
      <div className="mi-tasks">
        {tasks.map(t => (
          <div key={t.k} className="mit">
            <div className="mit-h">
              <t.icon size={14}/>
              <span style={{fontSize:13, fontWeight:600}}>{t.l}</span>
              <span className="chip" style={{marginLeft:'auto', background:'rgba(34,211,154,0.12)', color:'var(--accent-green)', borderColor:'rgba(34,211,154,0.3)'}}><span className="chip-dot" style={{background:'var(--accent-green)'}}/>完成</span>
            </div>
            <div className="mit-b" style={t.k==='prompt'||t.k==='ocr'?{fontFamily:'var(--mono)', fontSize:11.5}:{}}>{t.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Text detail · 4 parallel tasks ─── */
const MatText = () => {
  const tasks = [
    { k:'sum', l:'摘要 / 要点 / 金句', body:[
        ['摘要','这份文档讨论了在短视频拍摄中如何用"产品并排对比"作为开场钩子,以降低观众认知摩擦。'],
        ['要点','① 对比优于陈述  ② 视觉节奏决定完播  ③ 结尾情感化是订阅触发点'],
        ['金句','"不是最炸裂,但是最趁手。"'],
    ] },
    { k:'ass', l:'联想归纳 · 方向:观点', body:'作者在暗示:在参数红海里,"日常够用"比"规格顶点"更能打动普通消费者——这和苹果从 iPhone 12 开始强调"续航和手感"而非峰值性能的策略高度一致。' },
    { k:'rew', l:'改写 · 小红书风格',   body:'🌸姐妹们!终于找到 Vlog 神器了!\nPocket 4 真的不是堆参数——\n是那种 "你一拿起来就想拍" 的感觉✨\n日常记录 / 街拍 / 海边 全都扛得住\n想入手的 ddl 冲!' },
    { k:'cmp', l:'多文对比 · 3篇',      body:null, table:[
        ['维度','Pocket 4 稿','iPhone 稿','Leica 稿'],
        ['开场','并排对比','单品特写','情怀引言'],
        ['长度','1820字','1240字','2610字'],
        ['情绪','理性+温暖','克制','怀旧'],
        ['建议','作主稿','做切片','做长文'],
    ] },
  ];
  return (
    <div className="md-text">
      <div className="mt-head">
        <div>
          <div className="eyebrow">TEXT · 1,842字 · 中文 · 预计阅读 8分钟</div>
          <h3 className="display" style={{fontSize:32, margin:'4px 0 0'}}>三明治拍摄脚本参考</h3>
        </div>
        <button className="btn"><IcDownload size={13}/>原文 .md</button>
      </div>
      <div className="mt-grid">
        {tasks.map(t=>(
          <div key={t.k} className="mit" style={{gridColumn: t.k==='cmp'?'span 2':'auto'}}>
            <div className="mit-h">
              <span style={{fontSize:13, fontWeight:600}}>{t.l}</span>
              <span className="chip" style={{marginLeft:'auto'}}><span className="chip-dot"/>已完成</span>
            </div>
            <div className="mit-b">
              {Array.isArray(t.body) ? t.body.map(([k,v],i)=>(
                <div key={i} style={{marginBottom:10}}>
                  <div className="mono" style={{fontSize:10, color:'var(--ink-3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:3}}>{k}</div>
                  <div>{v}</div>
                </div>
              )) : t.body}
              {t.table && (
                <table className="cmp-tbl">
                  <tbody>
                    {t.table.map((r,i)=>(
                      <tr key={i}>
                        {r.map((c,j)=><td key={j} style={i===0?{fontWeight:600, background:'var(--bg-sunken)'}:{}}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Parallel queue panel · global concurrency ─── */
const QueuePanel = () => {
  const detected = { cpu:16, ram:64, gpu:'RTX 4090 · 24GB' };
  const recommend = 6;
  const [cur, setCur] = React.useState(4);
  const queue = [
    { id:'q1', title:'大疆 Pocket 4 · 画面提示词', state:'running', pct:67, stage:'视觉分析' },
    { id:'q2', title:'iPhone 17 Pro · 字幕转录',  state:'running', pct:42, stage:'Whisper' },
    { id:'q3', title:'海边日落 · 9张 · 联想总结', state:'running', pct:88, stage:'LLM总结' },
    { id:'q4', title:'背景乐参考 · 音乐分析',     state:'running', pct:22, stage:'特征提取' },
    { id:'q5', title:'Sora 2 测评 · 分镜',       state:'queued',  pct:0,  stage:'等待中' },
    { id:'q6', title:'运镜十招 · 画面提示词',     state:'queued',  pct:0,  stage:'等待中' },
    { id:'q7', title:'徕卡 M11 · 视频总结',      state:'error',   pct:38, stage:'API 超限' },
  ];
  return (
    <div className="qp-wrap">
      <div className="tb-head-mini">
        <div>
          <div className="eyebrow">批量队列 · 本机性能检测</div>
          <h2 className="display" style={{fontSize:28, margin:'4px 0 0'}}>并行队列 · Queue</h2>
        </div>
        <button className="btn"><IcDownload size={13}/>导出队列日志</button>
      </div>

      <div className="qp-sys">
        <div className="qp-det">
          <div className="eyebrow">本机检测</div>
          <div style={{display:'flex', gap:18, marginTop:8, alignItems:'baseline'}}>
            <span><span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>CPU</span> <b style={{fontSize:16}}>{detected.cpu}</b><span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}> 核</span></span>
            <span><span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>RAM</span> <b style={{fontSize:16}}>{detected.ram}</b><span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}> GB</span></span>
            <span><span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>GPU</span> <b style={{fontSize:14}}>{detected.gpu}</b></span>
          </div>
        </div>
        <div className="qp-slider">
          <div style={{display:'flex', justifyContent:'space-between', fontSize:12}}>
            <span>并行上限 · 系统推荐 <b className="mono">{recommend}</b></span>
            <span className="mono">{cur}</span>
          </div>
          <input type="range" min="1" max={recommend+2} value={cur} onChange={e=>setCur(+e.target.value)}
            style={{width:'100%', marginTop:8, accentColor:'var(--accent)'}}/>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:4, display:'flex', justifyContent:'space-between'}}>
            <span>1</span><span style={{color:'var(--accent-green)'}}>↑ 推荐 {recommend}</span><span>{recommend+2}</span>
          </div>
        </div>
      </div>

      <div className="qp-list">
        {queue.map(q => (
          <div key={q.id} className="qp-row" data-state={q.state}>
            <div className="qp-dot" data-state={q.state}/>
            <div className="qp-t">
              <div style={{fontSize:13, fontWeight:600}}>{q.title}</div>
              <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:3}}>{q.stage}</div>
            </div>
            <div className="qp-bar"><span style={{width:`${q.pct}%`}}/></div>
            <div className="mono qp-pct" style={{width:50, textAlign:'right'}}>
              {q.state==='running'?`${q.pct}%` : q.state==='queued'?'—' : q.state==='error'?'失败':'完成'}
            </div>
            <div className="qp-acts">
              {q.state==='error' && <button className="btn btn-ghost" style={{height:26, fontSize:11}}>重试</button>}
              {q.state==='queued' && <button className="btn btn-ghost" style={{height:26, fontSize:11}}>上移</button>}
              <button className="btn btn-ghost" style={{height:26, padding:'0 8px'}}><IcX size={12}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Material explorer (showcase all 4 types) ─── */
const MatExplorer = () => {
  const [t, setT] = React.useState('video');
  const tabs = [
    { id:'video', l:'视频', ic:IcFilm },
    { id:'audio', l:'音频', ic:IcMusic },
    { id:'image', l:'图片', ic:IcImage },
    { id:'text',  l:'文字', ic:IcDoc },
    { id:'queue', l:'并行队列', ic:IcLayers },
  ];
  return (
    <div style={{padding:'28px 32px', maxWidth:1400, margin:'0 auto'}}>
      <div className="tb-head-mini">
        <div>
          <div className="eyebrow">MATERIAL DETAIL · 按类型</div>
          <h1 className="display" style={{fontSize:48, margin:'4px 0 0', lineHeight:0.95}}>素材详情</h1>
        </div>
        <div className="tb-tabs" style={{margin:0}}>
          {tabs.map(tt=>(
            <button key={tt.id} className="tb-tab" data-active={t===tt.id} onClick={()=>setT(tt.id)}>
              <tt.ic size={14}/>{tt.l}
            </button>
          ))}
        </div>
      </div>
      <div style={{marginTop:20}}>
        {t==='video' && <MatVideo/>}
        {t==='audio' && <MatAudio/>}
        {t==='image' && <MatImage/>}
        {t==='text'  && <MatText/>}
        {t==='queue' && <QueuePanel/>}
      </div>
    </div>
  );
};

Object.assign(window, { MatVideo, MatAudio, MatImage, MatText, QueuePanel, MatExplorer });
