/* Storyboard — .storyboard-card, .sb-tabs, .sb-tab, .sb-body, .sb-grid, .sb-shot */

const Storyboard = ({ active, setActive }) => {
  const keys = Object.keys(VM_DATA.STORYBOARD);
  const current = VM_DATA.STORYBOARD[active];

  return (
    <>
      <div style={{padding:'28px 32px 0', maxWidth:1200, margin:'0 auto'}}>
        <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, marginBottom:24}}>
          <div>
            <div className="eyebrow">STORYBOARD · 3 VARIANTS · BV1abc</div>
            <h1 style={{fontFamily:'var(--display)', fontSize:52, margin:'8px 0 10px', letterSpacing:'-0.02em', lineHeight:0.95}}>
              三种改编方向
            </h1>
            <p style={{fontSize:14, color:'var(--ink-2)', maxWidth:540, lineHeight:1.6}}>
              基于转录 + 视觉分析,AI 生成三种脚本化改编——不同长度、调性、平台适配。选一种继续编辑。
            </p>
          </div>
          <div style={{display:'flex', gap:8, flexShrink:0}}>
            <button className="btn"><IcDownload size={14}/>导出 .fcpxml</button>
            <button className="btn btn-primary"><IcPlay size={14}/>生成预览</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200, margin:'0 auto', padding:'0 32px 48px'}}>
        <div className="storyboard-card">
          {/* Tab row */}
          <div className="sb-tabs">
            {keys.map(k => {
              const v = VM_DATA.STORYBOARD[k];
              return (
                <button key={k} className="sb-tab" data-active={active===k} onClick={()=>setActive(k)}>
                  <div className="ix">{k}</div>
                  <div className="nm">{v.name}</div>
                  <div className="ds">{v.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="sb-body">
            <div className="plan-hd">
              <div className="left">
                <div className="plan-title">{current.name}</div>
                <div className="plan-hook">{current.hook}</div>
              </div>
              <div style={{display:'flex', gap:10, alignItems:'flex-start', flexShrink:0}}>
                <div className="side-card" style={{minWidth:120, padding:'12px 16px'}}>
                  <div className="eyebrow">镜头</div>
                  <div style={{fontFamily:'var(--display)', fontSize:36}}>{current.shots.length}</div>
                </div>
                <div className="side-card" style={{minWidth:120, padding:'12px 16px'}}>
                  <div className="eyebrow">时长</div>
                  <div style={{fontFamily:'var(--display)', fontSize:36}}>
                    {current.shots.reduce((a,s)=>{const[m,sec]=s.dur.split(':').map(Number); return a+m*60+sec;},0)}s
                  </div>
                </div>
              </div>
            </div>

            <div className="sb-grid">
              {current.shots.map((s, i) => {
                const f = VM_DATA.FRAMES[s.frame];
                return (
                  <div key={i} className="sb-shot">
                    <div className="sh-thumb">
                      <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/>
                      <span className="num">{s.num}</span>
                      <span className="dur">{s.dur}</span>
                    </div>
                    <div className="sh-body">
                      <div className="sh-title">{s.title}</div>
                      <div className="sh-desc">{s.desc}</div>
                      <div className="sh-voice">"{s.vo}"</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Library ───
const Library = () => {
  const [view, setView] = React.useState('grid');
  return (
    <div style={{padding:'28px 32px'}}>
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24}}>
        <div>
          <div className="eyebrow">LIBRARY · {VM_DATA.TASKS.length} ITEMS</div>
          <h1 style={{fontFamily:'var(--display)', fontSize:48, margin:'8px 0 6px', letterSpacing:'-0.02em'}}>资料库</h1>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <div className="tw-segm" style={{display:'flex', gap:4, padding:3, background:'var(--bg-sunken)', borderRadius:10}}>
            <button style={{padding:'6px 10px', borderRadius:7, fontSize:12, background: view==='grid'?'var(--bg-elev)':'transparent', color: view==='grid'?'var(--ink)':'var(--ink-3)', boxShadow: view==='grid'?'var(--shadow-sm)':'none'}} onClick={()=>setView('grid')}><IcGrid size={13}/></button>
            <button style={{padding:'6px 10px', borderRadius:7, fontSize:12, background: view==='list'?'var(--bg-elev)':'transparent', color: view==='list'?'var(--ink)':'var(--ink-3)', boxShadow: view==='list'?'var(--shadow-sm)':'none'}} onClick={()=>setView('list')}><IcList size={13}/></button>
          </div>
          <button className="btn btn-primary"><IcUpload size={14}/>导入</button>
        </div>
      </div>

      <div className="ex-grid">
        {VM_DATA.TASKS.map(t => {
          const f = VM_DATA.FRAMES[t.thumb % VM_DATA.FRAMES.length];
          const stateColor = {done:'var(--accent-green)',running:'var(--ink)',error:'var(--accent)',queued:'var(--ink-4)'}[t.state];
          return (
            <div key={t.id} className="ex-card">
              <div className="ex-thumb">
                <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/>
                <div style={{position:'absolute', top:8, left:8, display:'inline-flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:99, background:'rgba(0,0,0,0.6)', fontSize:10, color:'#fff', fontFamily:'var(--mono)'}}>
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
    </div>
  );
};

// ─── Director ───
const Director = () => {
  const [input, setInput] = React.useState('');
  const msgs = [
    { r:'ai',   t:'我已读完这条 6:42 的 Pocket 4 视频。最值得做成内容的 3 个钩子：\n① 0:12 "我是非常困惑的" — 反常识开场\n② 3:30 Pocket 3 vs 4 分屏 — 视觉证据\n③ 5:54 海滩日落 — 情感共鸣\n\n你想改编成哪个方向？' },
    { r:'user', t:'帮我剪一条 30 秒抖音切片，钩子要狠' },
    { r:'ai',   t:'建议 Variant C（反转·脱口秀）:\n① 0–3s "这代我真的不想买" 大字幕\n② 3–15s 分屏翻盘（Pocket 3 vs 4）\n③ 15–25s 海滩实拍 + 真香转折\n④ 25–30s "真香" 定格\n\n已生成分镜 → 点击"进入分镜"查看。' },
  ];
  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
      <div style={{padding:'20px 32px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:16}}>
        <LogoMark size={24}/>
        <div>
          <div className="eyebrow">AI DIRECTOR · BV1abc loaded</div>
          <h2 style={{margin:0, fontFamily:'var(--display)', fontSize:32, lineHeight:1}}>AI 导演</h2>
        </div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 280px', flex:1, minHeight:0}}>
        <div style={{padding:'20px 32px', overflowY:'auto', display:'flex', flexDirection:'column', gap:16}}>
          {msgs.map((m,i) => (
            <div key={i} style={{display:'flex', gap:12, alignItems:'flex-start', flexDirection: m.r==='user'?'row-reverse':'row'}}>
              <div style={{width:32, height:32, borderRadius:99, background: m.r==='ai'?'var(--ink)':'var(--bg-sunken)', border:'1px solid var(--line)', display:'grid', placeItems:'center', flexShrink:0}}>
                {m.r==='ai' ? <LogoMark size={18}/> : <span style={{fontFamily:'var(--mono)', fontSize:10}}>you</span>}
              </div>
              <div style={{maxWidth:'70%', background: m.r==='ai'?'var(--bg-elev)':'var(--bg-sunken)', border:'1px solid var(--line)', borderRadius: m.r==='ai'?'4px 18px 18px 18px':'18px 4px 18px 18px', padding:'12px 16px', fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap'}}>
                {m.t}
              </div>
            </div>
          ))}
        </div>
        <div style={{borderLeft:'1px solid var(--line)', padding:16}}>
          <div className="eyebrow" style={{marginBottom:12}}>视频上下文</div>
          <div style={{borderRadius:12, overflow:'hidden', marginBottom:10}}>
            <img src={`assets/frame_${VM_DATA.FRAMES[2].ts.replace(/:/g,'_')}.svg`} style={{width:'100%'}}/>
          </div>
          <div style={{fontSize:12, fontWeight:600, marginBottom:4}}>三代封神！那四代呢？大疆 Pocket 4 首发体验</div>
          <div className="eyebrow" style={{marginTop:16, marginBottom:8}}>快速提问</div>
          {['改成小红书图文','提取最炸5句话','对比 Insta360 GO 3'].map((q,i)=>(
            <button key={i} style={{display:'block', width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:8, background:'var(--bg-sunken)', border:'1px solid var(--line)', fontSize:12, marginBottom:6, cursor:'pointer'}}>{q}</button>
          ))}
        </div>
      </div>
      <div style={{padding:'14px 24px', borderTop:'1px solid var(--line)', display:'flex', gap:10, alignItems:'center'}}>
        <IcSpark size={16} style={{color:'var(--ink-3)', flexShrink:0}}/>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="告诉 AI 导演你想要什么——切片、改编、翻译..."
          style={{flex:1, background:'transparent', border:'none', outline:'none', fontSize:14}}/>
        <button className="btn btn-primary"><IcSend size={14}/>发送</button>
      </div>
    </div>
  );
};

Object.assign(window, { Storyboard, Library, Director });
