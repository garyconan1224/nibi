/* Settings — providers, models, keys, pipeline defaults. v2.2 */

const PROVIDERS = [
  { id:'anthropic', name:'Anthropic', sub:'Claude 4.5 Opus · Sonnet · Haiku', keyMask:'sk-ant-****-****-k7F2', on:true, latency:'312ms', cost:'$3.2/1M', color:'#CC785C' },
  { id:'openai',    name:'OpenAI',    sub:'GPT-4.1 · GPT-4o · o3',            keyMask:'sk-****-****-9Lm',     on:true, latency:'284ms', cost:'$5.0/1M', color:'#10A37F' },
  { id:'deepseek',  name:'DeepSeek',  sub:'DeepSeek-V3 · DeepSeek-R1',        keyMask:'sk-****-xG8',          on:true, latency:'198ms', cost:'$0.5/1M', color:'#4C6EF5' },
  { id:'qwen',      name:'Qwen',      sub:'Qwen3-Max · VL · Turbo',           keyMask:'sk-****-****-v4X',     on:true, latency:'221ms', cost:'$0.8/1M', color:'#B84CFF' },
  { id:'ollama',    name:'Ollama',    sub:'本地 · llama3.3 · qwen2.5-vl',     keyMask:'local · no key',       on:false,latency:'42ms',  cost:'free',    color:'#22D39A' },
  { id:'azure',     name:'Azure',     sub:'Fallback endpoint',                 keyMask:'—',                    on:false,latency:'—',     cost:'—',       color:'#3C77FB' },
];

const PIPELINE_DEFAULTS = [
  { k:'download',   l:'下载',     v:'yt-dlp', opts:['yt-dlp','bilibili-api','streamlink'] },
  { k:'frames',     l:'抽帧',     v:'1fps + scene', opts:['1fps + scene','uniform 128','dense 30s'] },
  { k:'asr',        l:'语音转录', v:'Whisper v3 large', opts:['Whisper v3 large','Whisper medium','FunASR','SenseVoice'] },
  { k:'vlm',        l:'视觉',     v:'Qwen-VL-Max', opts:['Qwen-VL-Max','GPT-4.1 vision','Claude Sonnet'] },
  { k:'summarize',  l:'摘要',     v:'Claude 4.5 Opus', opts:['Claude 4.5 Opus','GPT-4.1','DeepSeek-V3'] },
  { k:'storyboard', l:'分镜',     v:'Claude 4.5 Opus', opts:['Claude 4.5 Opus','GPT-4.1','Qwen3-Max'] },
];

/* ─── Add Provider form ─── */
const AddProviderForm = ({ onClose }) => {
  const [name, setName] = React.useState('');
  const [baseUrl, setBaseUrl] = React.useState('');
  const [key, setKey] = React.useState('');
  const [modelName, setModelName] = React.useState('');
  const [modelType, setModelType] = React.useState('text');
  const modelTypes = [
    { id:'text',  l:'文本大模型',   desc:'用于总结/归纳/对话' },
    { id:'vision',l:'视觉大模型',   desc:'用于图片/截帧分析' },
    { id:'video', l:'视频大模型',   desc:'用于视频直接分析路径3' },
  ];
  const presets = [
    { n:'OpenAI',    url:'https://api.openai.com/v1',      ph:'sk-...' },
    { n:'Anthropic', url:'https://api.anthropic.com',      ph:'sk-ant-...' },
    { n:'Ollama',    url:'http://localhost:11434/v1',       ph:'ollama (无需key)' },
    { n:'DeepSeek',  url:'https://api.deepseek.com/v1',    ph:'sk-...' },
    { n:'Qwen',      url:'https://dashscope.aliyuncs.com/compatible-mode/v1', ph:'sk-...' },
    { n:'自定义',    url:'',                                ph:'sk-...' },
  ];
  return (
    <>
      <div className="modal-backdrop" data-open={true} onClick={onClose}/>
      <div className="modal" data-open={true} style={{width:560}}>
        <div className="m-head">
          <div>
            <div className="eyebrow">ADD PROVIDER · API 兼容格式 / Anthropic / Ollama</div>
            <h3 className="display" style={{fontSize:26, margin:'4px 0 0'}}>添加模型提供方</h3>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><IcX size={16}/></button>
        </div>
        <div className="m-body" style={{gap:20}}>
          {/* Preset quick-pick */}
          <div className="m-section">
            <div className="eyebrow" style={{marginBottom:10}}>快速选择</div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {presets.map(p => (
                <button key={p.n} className="kw" style={{cursor:'pointer', padding:'6px 12px', fontSize:12}}
                  onClick={()=>{ if(p.url){setBaseUrl(p.url);} setName(p.n==='自定义'?'':p.n); }}>
                  {p.n}
                </button>
              ))}
            </div>
          </div>
          {/* Form fields */}
          <div className="m-section" style={{display:'grid', gap:12}}>
            <div className="eyebrow" style={{marginBottom:2}}>填写信息</div>
            {[
              { l:'名称', ph:'如 "我的 Qwen"', val:name, set:setName },
              { l:'Base URL', ph:'https://api.openai.com/v1', val:baseUrl, set:setBaseUrl },
              { l:'API Key', ph:'sk-...', val:key, set:setKey, type:'password' },
              { l:'默认模型名', ph:'gpt-4o / claude-sonnet-4-5 / ...', val:modelName, set:setModelName },
            ].map(f => (
              <div key={f.l} style={{display:'grid', gridTemplateColumns:'100px 1fr', gap:10, alignItems:'center'}}>
                <label className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{f.l}</label>
                <input type={f.type||'text'} value={f.val} onChange={e=>f.set(e.target.value)}
                  placeholder={f.ph}
                  style={{height:36, padding:'0 12px', borderRadius:8, border:'1px solid var(--line)',
                    background:'var(--bg-sunken)', fontSize:13, outline:'none', fontFamily:'var(--mono)',
                    color:'var(--ink)'}}/>
              </div>
            ))}
            {/* Model type */}
            <div style={{display:'grid', gridTemplateColumns:'100px 1fr', gap:10, alignItems:'flex-start'}}>
              <label className="mono" style={{fontSize:11, color:'var(--ink-3)', paddingTop:4}}>模型类型</label>
              <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                {modelTypes.map(t => (
                  <button key={t.id} className="type-card" data-active={modelType===t.id}
                    onClick={()=>setModelType(t.id)} style={{padding:'10px 14px', minWidth:0}}>
                    <div className="tc-l">{t.l}</div>
                    <div className="tc-en">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="m-foot">
          <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>所有 OpenAI API 兼容格式均支持</span>
          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-ghost"><IcSpark size={13}/>测试连接</button>
            <button className="btn btn-primary" onClick={onClose}><IcCheck size={13}/>保存</button>
          </div>
        </div>
      </div>
    </>
  );
};

const Settings = () => {
  const [tab,        setTab]        = React.useState('providers');
  const [addOpen,    setAddOpen]    = React.useState(false);
  const [testingId,  setTestingId]  = React.useState(null);
  const [testResults,setTestResults]= React.useState({});
  const [assignments, setAssignments] = React.useState({
    vision: 'Qwen-VL-Max',
    text:   'Claude 4.5 Opus',
    video:  'Gemini 1.5 Pro',
    chat:   'Claude 4.5 Opus',
  });

  const MODEL_OPTIONS = {
    vision: ['Qwen-VL-Max','GPT-4.1 Vision','Claude Sonnet','Gemini 1.5 Pro'],
    text:   ['Claude 4.5 Opus','GPT-4.1','DeepSeek-V3','Qwen3-Max','llama3.3 (local)'],
    video:  ['Gemini 1.5 Pro','GPT-4o','Qwen-VL-Max','Claude Sonnet'],
    chat:   ['Claude 4.5 Opus','GPT-4.1','DeepSeek-V3','Qwen3-Max'],
  };
  const TASK_LABELS = {
    vision:'截帧视觉分析', text:'文本总结 / 摘要', video:'视频直接分析', chat:'LLM 对话',
  };
  const TASK_ICONS = { vision: IcEye, text: IcDoc, video: IcFilm, chat: IcSpark };
  const TASK_DESC  = {
    vision:'用于图片/截帧的内容描述与提示词提取',
    text:  '用于字幕总结、要点提炼、风格报告',
    video: '路径 3：整段视频直接送入分析（无需截帧）',
    chat:  '任务级 LLM 对话时使用的模型',
  };

  const handleTest = async (providerId) => {
    setTestingId(providerId);
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 900));
    const ok      = Math.random() > 0.15;
    const latency = ok ? Math.round(140 + Math.random() * 320) : null;
    setTestResults(prev => ({ ...prev, [providerId]: { ok, latency } }));
    setTestingId(null);
  };

  const tabs = [
    { id:'providers', l:'模型 · Providers', ic: IcCpu },
    { id:'pipeline',  l:'流水线 · Pipeline', ic: IcSpark },
    { id:'storage',   l:'存储 · Storage',    ic: IcLayers },
    { id:'advanced',  l:'高级 · Advanced',   ic: IcSliders },
  ];

  return (
    <div className="settings-wrap">
      {addOpen && <AddProviderForm onClose={()=>setAddOpen(false)}/>}
      <div className="settings-head">
        <div className="eyebrow">SETTINGS · LOCAL · ~/.vidmirror</div>
        <h1 style={{fontFamily:'var(--display)', fontSize:56, margin:'8px 0 10px', letterSpacing:'-0.02em', lineHeight:0.95}}>
          设置
        </h1>
        <p style={{fontSize:14, color:'var(--ink-2)', maxWidth:560, lineHeight:1.6, margin:0}}>
          模型、API 密钥、下载路径、流水线默认。所有设置本地存储,不上传到服务器。
        </p>
      </div>

      <div className="settings-layout">
        <aside className="settings-nav">
          {tabs.map(t => (
            <button key={t.id} className="sn-item" data-active={tab===t.id} onClick={()=>setTab(t.id)}>
              <t.ic size={16}/>
              <span>{t.l}</span>
            </button>
          ))}
          <div style={{marginTop:20, padding:14, border:'1px dashed var(--line-strong)', borderRadius:12}}>
            <div className="eyebrow" style={{marginBottom:6}}>Build</div>
            <div style={{fontFamily:'var(--display)', fontSize:28, lineHeight:1}}>v0.3.0</div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:3, fontFamily:'var(--mono)'}}>0a7f · 2 days ago</div>
          </div>
        </aside>

        <main className="settings-main">
          {tab === 'providers' && (
            <>
              <div className="sect-head">
                <h2 style={{fontFamily:'var(--display)', fontSize:36, margin:0}}>模型配置</h2>
                <button className="btn btn-primary" onClick={()=>setAddOpen(true)}><IcPlus size={14}/>添加 Provider</button>
              </div>

              {/* ── 任务模型分配 ── */}
              <div style={{marginBottom:22}}>
                <div className="eyebrow" style={{marginBottom:12}}>任务模型分配 · Task Model Assignment</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                  {Object.entries(TASK_LABELS).map(([key, label]) => {
                    const Ic = TASK_ICONS[key];
                    const opts = MODEL_OPTIONS[key];
                    return (
                      <div key={key} style={{background:'var(--bg-elev)', border:'1px solid var(--line)',
                                              borderRadius:14, padding:'14px 16px'}}>
                        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                          <Ic size={14} style={{color:'var(--accent)', flexShrink:0}}/>
                          <div>
                            <div style={{fontSize:13, fontWeight:700}}>{label}</div>
                            <div style={{fontSize:11, color:'var(--ink-3)', marginTop:1}}>{TASK_DESC[key]}</div>
                          </div>
                        </div>
                        <select value={assignments[key]}
                                onChange={e=>setAssignments(a=>({...a,[key]:e.target.value}))}
                                style={{width:'100%', height:34, padding:'0 10px',
                                        background:'var(--bg-sunken)', border:'1px solid var(--line)',
                                        borderRadius:8, fontSize:13, color:'var(--ink)',
                                        outline:'none', fontFamily:'var(--mono)', cursor:'pointer'}}>
                          {opts.map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Provider cards ── */}
              <div className="eyebrow" style={{marginBottom:12}}>API 提供方 · Providers</div>
              <div className="provider-grid">
                {PROVIDERS.map(p => {
                  const tr      = testResults[p.id];
                  const testing = testingId === p.id;
                  return (
                    <div key={p.id} className="provider-card" data-on={p.on}>
                      <div className="pc-top">
                        <div className="pc-logo" style={{background:p.color}}>{p.name[0]}</div>
                        <div style={{flex:1, minWidth:0}}>
                          <div className="pc-name">{p.name}</div>
                          <div className="pc-sub">{p.sub}</div>
                        </div>
                        <label className="toggle">
                          <input type="checkbox" defaultChecked={p.on}/>
                          <span className="tog-track"><span className="tog-thumb"/></span>
                        </label>
                      </div>
                      <div className="pc-key">
                        <span className="eyebrow" style={{fontSize:9}}>API KEY</span>
                        <code>{p.keyMask}</code>
                        <button className="btn btn-ghost" style={{height:26,padding:'0 8px',fontSize:11}}>
                          <IcEdit size={12}/>编辑
                        </button>
                      </div>
                      <div className="pc-stats">
                        <div>
                          <span className="eyebrow" style={{fontSize:9}}>LATENCY</span>
                          <b>{tr ? (tr.ok ? `${tr.latency}ms` : '超时') : p.latency}</b>
                        </div>
                        <div>
                          <span className="eyebrow" style={{fontSize:9}}>COST</span>
                          <b>{p.cost}</b>
                        </div>
                        <div>
                          <span className="eyebrow" style={{fontSize:9}}>STATUS</span>
                          <b style={{color: tr ? (tr.ok?'var(--accent-green)':'var(--accent)') : (p.on?'var(--accent-green)':'var(--ink-4)')}}>
                            {tr ? (tr.ok ? '● online' : '✗ error') : (p.on ? '● online' : '○ offline')}
                          </b>
                        </div>
                      </div>
                      {/* Test connection button */}
                      <button onClick={()=>handleTest(p.id)} disabled={testing}
                              style={{width:'100%', height:30, marginTop:10, borderRadius:8, fontSize:12,
                                       fontWeight:600, border:'1px solid var(--line)', cursor:'pointer',
                                       display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                                       background: testing ? 'var(--bg-sunken)' : 'transparent',
                                       color: testing ? 'var(--ink-3)' : 'var(--ink-2)',
                                       transition:'all 140ms'}}>
                        {testing
                          ? <><div style={{width:12,height:12,borderRadius:99,border:'2px solid var(--ink-4)',borderTopColor:'var(--accent)',animation:'qp-spin 0.7s linear infinite'}}/> 测试中…</>
                          : tr
                          ? <><IcCheck size={12} style={{color: tr.ok?'var(--accent-green)':'var(--accent)'}}/> {tr.ok?`${tr.latency}ms ✓`:'重新测试'}</>
                          : <><IcSpark size={12}/> 测试连接</>}
                      </button>
                    </div>
                  );
                })}
              </div>
              <style>{`@keyframes qp-spin{to{transform:rotate(360deg)}}`}</style>
            </>
          )}

          {tab === 'pipeline' && (
            <>
              <div className="sect-head">
                <h2 style={{fontFamily:'var(--display)', fontSize:36, margin:0}}>流水线默认值</h2>
                <span className="chip"><span className="chip-dot"/>已保存</span>
              </div>
              <div style={{background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:'var(--radius-lg)', overflow:'hidden'}}>
                {PIPELINE_DEFAULTS.map((p, i) => (
                  <div key={p.k} style={{display:'grid', gridTemplateColumns:'200px 1fr auto', alignItems:'center', padding:'18px 24px', borderBottom: i<PIPELINE_DEFAULTS.length-1 ? '1px solid var(--line)' : 'none', gap:20}}>
                    <div>
                      <div style={{fontSize:15, fontWeight:600}}>{p.l}</div>
                      <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:3, letterSpacing:'0.08em'}}>{p.k}</div>
                    </div>
                    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                      {p.opts.map(o => (
                        <button key={o} className="chip" style={{background: o===p.v?'var(--ink)':'var(--bg-sunken)', color: o===p.v?'var(--bg)':'var(--ink-2)', border: o===p.v?'1px solid var(--ink)':'1px solid var(--line)'}}>
                          {o}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-ghost" style={{height:32}}><IcSettings size={14}/></button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'storage' && (
            <>
              <div className="sect-head">
                <h2 style={{fontFamily:'var(--display)', fontSize:36, margin:0}}>本地存储</h2>
              </div>
              <div className="stat-row" style={{marginTop:0}}>
                <div className="stat-cell"><div className="label">视频缓存</div><div className="value">48.7<span style={{fontSize:16, color:'var(--ink-3)'}}> GB</span></div></div>
                <div className="stat-cell"><div className="label">转录 / 帧</div><div className="value">2.1<span style={{fontSize:16, color:'var(--ink-3)'}}> GB</span></div></div>
                <div className="stat-cell"><div className="label">任务数</div><div className="value">312</div></div>
                <div className="stat-cell"><div className="label">可用空间</div><div className="value">847<span style={{fontSize:16, color:'var(--ink-3)'}}> GB</span></div></div>
              </div>
              <div style={{marginTop:18, padding:'22px 24px', background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:'var(--radius)'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                  <div>
                    <div style={{fontSize:15, fontWeight:600}}>视频根目录</div>
                    <div className="mono" style={{fontSize:12, color:'var(--ink-3)', marginTop:3}}>~/vidmirror/data/videos/</div>
                  </div>
                  <button className="btn"><IcEdit size={13}/>修改路径</button>
                </div>
                <div style={{display:'flex', gap:10, marginTop:14}}>
                  <button className="btn"><IcDownload size={13}/>清理 7天前缓存</button>
                  <button className="btn"><IcLayers size={13}/>导出全部任务</button>
                </div>
              </div>
            </>
          )}

          {tab === 'advanced' && (
            <>
              <div className="sect-head"><h2 style={{fontFamily:'var(--display)', fontSize:36, margin:0}}>高级</h2></div>
              <div style={{display:'grid', gap:12}}>
                {[
                  { t:'启用实验性分镜器 v2', d:'多风格并行 · beta · 可能不稳定', on:true },
                  { t:'遥测 (匿名)', d:'帮助我们改进 · 不包含视频内容', on:false },
                  { t:'自动更新', d:'每 24h 检查 · 静默下载', on:true },
                  { t:'启用离线模式', d:'完全使用本地模型 (Ollama)', on:false },
                  { t:'调试日志', d:'输出 debug 级别到 ~/.vidmirror/log', on:false },
                ].map((r,i)=>(
                  <div key={i} style={{display:'flex', alignItems:'center', gap:20, padding:'18px 22px', background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius:'var(--radius)'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14, fontWeight:600}}>{r.t}</div>
                      <div style={{fontSize:12, color:'var(--ink-3)', marginTop:3}}>{r.d}</div>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked={r.on}/>
                      <span className="tog-track"><span className="tog-thumb"/></span>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

window.Settings = Settings;
