/* Taskboard — 工作空间主页:素材 / 队列 / 导出 / AI 对话
   复刻专项（标签库/收藏/风格报告/对比/版本）已迁出至 Director 路由 */

const _typeIcon = { video: IcFilm, audio: IcMusic, image: IcImage, text: IcDoc };
const _typeLabel = { video:'视频', audio:'音频', image:'图片', text:'文字' };
const _typeTone = { video:'pink', audio:'purple', image:'blue', text:'amber' };

/* ─── Material chip card ─── */
const MaterialCard = ({ m, onOpen = () => {} }) => {
  const Ic = _typeIcon[m.type];
  const f = VM_DATA.FRAMES[m.thumb % VM_DATA.FRAMES.length];
  const stateDot = { done:'var(--accent-green)', running:'var(--ink)', queued:'var(--ink-4)', error:'var(--accent)' }[m.state];
  return (
    <div className="mat-card" data-type={m.type} onClick={onOpen}>
      <div className="mat-thumb">
        <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}/>
        <span className="mat-type" data-tone={_typeTone[m.type]}><Ic size={11}/>{_typeLabel[m.type]}</span>
        {m.state==='running' && <div className="mat-prog"><div style={{width:`${m.progress}%`}}/></div>}
      </div>
      <div className="mat-body">
        <div className="mat-title">{m.title}</div>
        <div className="mat-meta">
          <span className="dot" style={{background:stateDot}}/>
          <span>{m.source}</span>
        </div>
        <div className="mat-sub mono">{m.meta}</div>
        {m.tags.length > 0 && (
          <div className="mat-tags">
            {m.tags.slice(0,3).map(t => <span key={t} className="kw">{t}</span>)}
            {m.tags.length>3 && <span className="kw" style={{opacity:0.5}}>+{m.tags.length-3}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── 任务中心主界面 ─── */
const Taskboard = ({ onAddMaterial, onOpenMaterial }) => {
  const [tab, setTab] = React.useState('materials');
  const cfg = VM_DATA.TASK_CONFIG || { name:'未命名任务', contentType:'—', people:'—', background:'—', terms:'—', purpose:'—' };
  const tabs = [
    { id:'materials', l:'素材', en:'Materials',   ic: IcLayers,  n: (VM_DATA.MATERIALS||[]).length },
    { id:'export',    l:'导出', en:'Export',      ic: IcArchive, n: null },
    { id:'chat',      l:'AI 对话', en:'Task Chat', ic: IcSpark,   n: null },
  ];

  return (
    <div className="tb-wrap">
      {/* ─── Task header ─── */}
      <div className="tb-head">
        <div className="tb-head-l">
          <div className="eyebrow">TASK · 复刻工作台 · 本地</div>
          <h1 className="display" style={{fontSize:56, margin:'8px 0 16px', lineHeight:0.95}}>
            {cfg.name}
          </h1>
          <div className="tb-ctx">
            <span className="ctx-k">内容类型</span><span className="ctx-v">{cfg.contentType}</span>
            <span className="ctx-k">人物</span><span className="ctx-v">{cfg.people}</span>
            <span className="ctx-k">背景</span><span className="ctx-v">{cfg.background}</span>
            <span className="ctx-k">专有词</span><span className="ctx-v mono" style={{fontSize:12}}>{cfg.terms}</span>
            <span className="ctx-k">目的</span><span className="ctx-v">{cfg.purpose}</span>
          </div>
        </div>
        <div className="tb-head-r">
          <button className="btn"><IcEdit size={14}/>编辑背景</button>
          <button className="btn btn-primary" onClick={onAddMaterial}><IcPlus size={14}/>添加素材</button>
        </div>
      </div>

      {/* ─── Workspace knowledge search (Phase 3B inline) ─── */}
      <WorkspaceSearchBar workspaceName={cfg.name}/>

      {/* ─── Sub-tabs ─── */}
      <div className="tb-tabs">
        {tabs.map(t => (
          <button key={t.id} className="tb-tab" data-active={tab===t.id} onClick={()=>setTab(t.id)}>
            <t.ic size={15}/>
            <span>{t.l}</span>
            <span className="mono" style={{fontSize:10, opacity:0.55}}>{t.en}</span>
            {t.n !== null && <span className="tb-tab-n">{t.n}</span>}
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      <div className="tb-body">
        {tab==='materials' && <TBMaterials onAdd={onAddMaterial} onOpenMaterial={onOpenMaterial}/>}
        {tab==='export'    && <TBExport/>}
        {tab==='chat'      && <TaskChat/>}
      </div>
    </div>
  );
};

/* ─── Materials tab ─── */
const TBMaterials = ({ onAdd, onOpenMaterial }) => {
  const groups = ['video','audio','image','text'];
  return (
    <>
      <div className="tb-mat-grid">
        {VM_DATA.MATERIALS.map(m => <MaterialCard key={m.id} m={m} onOpen={() => onOpenMaterial && onOpenMaterial(m)}/>)}
        <div className="mat-card mat-add" onClick={onAdd}>
          <div className="mat-add-inner">
            <IcPlus size={24}/>
            <div style={{marginTop:10, fontSize:14, fontWeight:600}}>添加素材</div>
            <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:4, letterSpacing:'0.1em'}}>URL · FILE · DRAG</div>
            <div className="mat-add-types">
              {groups.map(g => {
                const Ic = _typeIcon[g];
                return <span key={g} className="kw"><Ic size={11}/>{_typeLabel[g]}</span>;
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ─── Export workbench (.zip) ─── */
const TBExport = () => {
  const parts = [
    { name:'reference_frames/',  en:'参考帧图片',    count:12, size:'18.2 MB', on:true,  ic:IcImage },
    { name:'prompts.json',       en:'所有提示词(MJ/SD)', count:24, size:'68 KB', on:true,  ic:IcTag },
    { name:'prompts_by_tag.json',en:'按标签分类',    count:5,  size:'12 KB', on:true,  ic:IcLayers },
    { name:'subtitles.srt',      en:'字幕文件',      count:142,size:'24 KB', on:true,  ic:IcMic },
    { name:'music_analysis.json',en:'音乐分析',      count:3,  size:'8 KB',  on:true,  ic:IcMusic },
    { name:'style_report.md',    en:'风格报告',      count:1,  size:'4 KB',  on:true,  ic:IcSpark },
    { name:'favorites/',         en:'收藏帧+提示词',  count:5,  size:'6.4 MB',on:true,  ic:IcStar },
    { name:'README.md',          en:'使用说明',      count:1,  size:'2 KB',  on:true,  ic:IcDoc },
  ];
  const [on, setOn] = React.useState(parts.map(p=>p.on));
  const selectedCount = on.filter(Boolean).length;
  const totalSize = parts.reduce((a,p,i) => on[i] ? a + parseFloat(p.size) : a, 0);
  return (
    <>
      <div className="tb-head-mini">
        <div>
          <div className="eyebrow">复刻工作包 · LOCAL ONLY · .zip</div>
          <h2 className="display" style={{fontSize:28, margin:'4px 0 0'}}>导出工作包 · Export</h2>
        </div>
        <div className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>
          已选 {selectedCount} / {parts.length} 项 · ~ {totalSize.toFixed(1)} MB
        </div>
      </div>
      <div className="exp-list">
        {parts.map((p, i) => (
          <div key={p.name} className="exp-row" data-on={on[i]}
               onClick={()=>setOn(ss => ss.map((v,j)=> j===i ? !v : v))}>
            <div className="exp-chk">{on[i] && <IcCheck size={14}/>}</div>
            <div className="exp-ic"><p.ic size={16}/></div>
            <div className="exp-nm">
              <span className="mono">{p.name}</span>
              <span style={{color:'var(--ink-3)', fontSize:12}}>{p.en}</span>
            </div>
            <div className="exp-count mono">{p.count} 项</div>
            <div className="exp-size mono">{p.size}</div>
          </div>
        ))}
      </div>
      <div className="exp-foot">
        <div className="exp-path mono">
          <IcArchive size={14}/>
          ~/vidmirror/exports/pocket4-复刻-2026-04-24.zip
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn"><IcEdit size={13}/>修改路径</button>
          <button className="btn btn-primary"><IcDownload size={13}/>打包导出 ({totalSize.toFixed(1)} MB)</button>
        </div>
      </div>
    </>
  );
};

/* ─── Queue · 并行队列管理 (重试 / 取消 / 调序 / 性能检测) ─── */
const TBQueue = () => {
  const detected = { cpu:16, ram:64, gpu:'RTX 4090 · 24GB' };
  const recommend = 6;
  const [cur, setCur] = React.useState(3);
  // Build queue from MATERIALS that are still active
  const seed = VM_DATA.MATERIALS.filter(m => m.state==='running' || m.state==='queued' || m.state==='error');
  // Add a couple synthetic running rows in case data is thin
  const extra = [
    { id:'q-extra-1', title:'大疆 Pocket 4 · 画面提示词', state:'running', progress:67, stage:'视觉分析', source:'bilibili.com/BV1abc' },
    { id:'q-extra-2', title:'iPhone 17 Pro · 字幕转录',   state:'running', progress:42, stage:'Whisper · zh', source:'youtube.com/xYz' },
    { id:'q-extra-3', title:'徕卡 M11 · 视频总结',       state:'error',   progress:38, stage:'API 超限 · 限流 429', source:'youtube.com/abc' },
  ];
  const rows = [...seed.map(m => ({
    id: m.id,
    title: m.title,
    state: m.state,
    progress: m.progress ?? (m.state==='queued'?0:m.state==='error'?38:50),
    stage: m.state==='running' ? '视觉分析 · stage 4/6'
         : m.state==='queued'  ? '等待并行槽位'
         : 'API 超限',
    source: m.source,
  })), ...extra];

  const running = rows.filter(r=>r.state==='running').length;
  const queued  = rows.filter(r=>r.state==='queued').length;
  const errored = rows.filter(r=>r.state==='error').length;

  const pctColor = (s) => s==='running'?'var(--ink)' : s==='queued'?'var(--ink-4)' : s==='error'?'var(--accent)' : 'var(--accent-green)';

  return (
    <>
      <div className="tb-head-mini">
        <div>
          <div className="eyebrow">BATCH QUEUE · 并行执行 · 本机性能检测</div>
          <h2 className="display" style={{fontSize:28, margin:'4px 0 0'}}>队列 · Queue</h2>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn"><IcDownload size={13}/>导出队列日志</button>
          <button className="btn" disabled={!errored}><IcSpark size={13}/>全部重试 ({errored})</button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap'}}>
        <span className="kw" style={{background:'var(--bg-sunken)', fontSize:12, padding:'5px 11px'}}>
          <span className="dot" style={{background:'var(--ink)', width:6, height:6, borderRadius:99, display:'inline-block', marginRight:6}}/>
          运行中 <b style={{marginLeft:4, fontFamily:'var(--mono)'}}>{running}</b>
        </span>
        <span className="kw" style={{background:'var(--bg-sunken)', fontSize:12, padding:'5px 11px'}}>
          <span className="dot" style={{background:'var(--ink-4)', width:6, height:6, borderRadius:99, display:'inline-block', marginRight:6}}/>
          排队中 <b style={{marginLeft:4, fontFamily:'var(--mono)'}}>{queued}</b>
        </span>
        <span className="kw" style={{background:'var(--bg-sunken)', fontSize:12, padding:'5px 11px'}}>
          <span className="dot" style={{background:'var(--accent)', width:6, height:6, borderRadius:99, display:'inline-block', marginRight:6}}/>
          失败 <b style={{marginLeft:4, fontFamily:'var(--mono)'}}>{errored}</b>
        </span>
      </div>

      {/* System detection + parallel slider */}
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
            <span>并行数量上限 · 系统推荐 <b className="mono">{recommend}</b></span>
            <span className="mono">{cur}</span>
          </div>
          <input type="range" min="1" max={recommend+2} value={cur} onChange={e=>setCur(+e.target.value)}
            style={{width:'100%', marginTop:8, accentColor:'var(--accent)'}}/>
          <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:4, display:'flex', justifyContent:'space-between'}}>
            <span>1</span><span style={{color:'var(--accent-green)'}}>↑ 推荐 {recommend}</span><span>{recommend+2}</span>
          </div>
        </div>
      </div>

      {/* Queue rows */}
      <div className="qp-list" style={{marginTop:14}}>
        {rows.map((q, i) => (
          <div key={q.id} className="qp-row" data-state={q.state}>
            <div className="qp-dot" data-state={q.state}/>
            <div className="qp-t">
              <div style={{fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{q.title}</div>
              <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:3}}>
                {q.stage}{q.source ? ` · ${q.source}` : ''}
              </div>
            </div>
            <div className="qp-bar"><span style={{width:`${q.progress}%`}}/></div>
            <div className="mono qp-pct" style={{width:50, textAlign:'right', color: pctColor(q.state)}}>
              {q.state==='running'?`${q.progress}%` : q.state==='queued'?'—' : q.state==='error'?'失败':'完成'}
            </div>
            <div className="qp-acts">
              {q.state==='error' && <button className="btn btn-ghost" style={{height:26, fontSize:11}}><IcSpark size={12}/>重试</button>}
              {q.state==='queued' && i>0 && <button className="btn btn-ghost" style={{height:26, fontSize:11}} title="上移优先级">↑</button>}
              {q.state==='queued' && <button className="btn btn-ghost" style={{height:26, fontSize:11}} title="下移优先级">↓</button>}
              {q.state==='running' && <button className="btn btn-ghost" style={{height:26, fontSize:11}} title="暂停">暂停</button>}
              <button className="btn btn-ghost" style={{height:26, padding:'0 8px'}} title="取消"><IcX size={12}/></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* ─── Add material modal ─── */
const AddMaterialModal = ({ open, onClose, onSubmit, onFineTune, urlValue, workspaceIds }) => {
  const [url, setUrl] = React.useState('');
  // Accept url passed from Workbench composer
  React.useEffect(() => { if (urlValue) setUrl(urlValue); }, [urlValue]);

  // ── § 多类型选择 + 按类型勾选 features ──
  const TASK_BY_TYPE = {
    video: ['画面提示词','视频文案总结','字幕导出','音乐分析'],
    audio: ['人声转写总结','说话人区分','音乐分析','音乐提示词'],
    image: ['内容识别描述','OCR文字提取','画面提示词','联想总结'],
    text:  ['摘要/要点/金句','联想归纳','改写/润色','多文对比'],
  };
  const typeOptions = [
    { id:'video', l:'视频', en:'Video', ic:IcFilm  },
    { id:'audio', l:'音频', en:'Audio', ic:IcMusic },
    { id:'image', l:'图片', en:'Image', ic:IcImage },
    { id:'text',  l:'文字', en:'Text',  ic:IcDoc   },
  ];
  // Auto-detect type set from URL (xhs can be video+image+text, weixin = text, etc.)
  const TYPES_BY_HOST = {
    'bilibili.com':   ['video'],
    'youtube.com':    ['video'],
    'youtu.be':       ['video'],
    'douyin.com':     ['video'],
    'kuaishou.com':   ['video'],
    'xiaohongshu.com':['video','image','text'],
    'weixin.qq.com':  ['text'],
  };
  const detectTypes = (u) => {
    if (!u) return ['video'];
    try {
      const h = new URL(u).hostname.replace('www.','');
      for (const k in TYPES_BY_HOST) if (h.includes(k)) return TYPES_BY_HOST[k];
    } catch {}
    return ['video'];
  };
  const initialDefaults = (typeList) => Object.fromEntries(
    typeList.map(t => [t, Object.fromEntries(TASK_BY_TYPE[t].map((task, i) => [task, i < 2]))])
  );

  const [types, setTypes] = React.useState(['video']);
  // tasks shape: { video: { '画面提示词': true, ... }, image: {...} }
  const [tasks, setTasks] = React.useState(initialDefaults(['video']));

  // On open: derive initial type set from URL & seed defaults
  React.useEffect(() => {
    if (!open) return;
    const initial = detectTypes(urlValue || url);
    setTypes(initial);
    setTasks(initialDefaults(initial));
  }, [open, urlValue]);

  const toggleType = (id) => {
    setTypes(prev => {
      const isOn = prev.includes(id);
      const next = isOn ? prev.filter(x => x !== id) : [...prev, id];
      setTasks(prevTasks => {
        const out = { ...prevTasks };
        if (isOn) { delete out[id]; }
        else { out[id] = Object.fromEntries(TASK_BY_TYPE[id].map((task, i) => [task, i < 2])); }
        return out;
      });
      return next;
    });
  };
  const toggleTask = (typeId, task) => setTasks(s => ({
    ...s,
    [typeId]: { ...(s[typeId]||{}), [task]: !(s[typeId]||{})[task] },
  }));

  const enabledCount = Object.values(tasks).reduce((sum, m) => sum + Object.values(m).filter(Boolean).length, 0);
  // ── §3.1 背景信息 ──
  const [bgOpen,    setBgOpen]    = React.useState(false);
  const [bgType,    setBgType]    = React.useState('宣传片');
  const [bgPeople,  setBgPeople]  = React.useState('');
  const [bgContext, setBgContext] = React.useState('');
  const [bgTerms,   setBgTerms]   = React.useState('');
  const [bgPurpose, setBgPurpose] = React.useState('复刻参考');

  const TASK_BY_TYPE_LEGACY = {};

  const BG_CONTENT_TYPES = ['课程','会议','宣传片','Vlog','访谈','纯音乐','新闻报道'];
  const BG_PURPOSES      = ['复刻参考','竞品分析','内容总结','学习研究'];

  const inputStyle = {
    width: '100%', height: 34, padding: '0 10px',
    background: 'var(--bg-sunken)', border: '1px solid var(--line)',
    borderRadius: 8, fontSize: 13, color: 'var(--ink)', outline: 'none',
    fontFamily: 'var(--sans)',
  };

  return (
    <>
      <div className="modal-backdrop" data-open={open} onClick={onClose}/>
      <div className="modal" data-open={open}>
        <div className="m-head">
          <div>
            <div className="eyebrow">ADD MATERIAL · 添加素材到当前任务</div>
            <h3 className="display" style={{fontSize:28, margin:'4px 0 0'}}>{(VM_DATA.TASK_CONFIG||{}).name||'任务'}</h3>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><IcX size={16}/></button>
        </div>

        <div className="m-body">
          {/* ① 素材类型 */}
          <div className="m-section">
            <div className="eyebrow" style={{marginBottom:10}}>① 素材类型</div>
            <div className="type-row">
              {typeOptions.map(t => (
                <button key={t.id} className="type-card" data-active={type===t.id} onClick={()=>setType(t.id)}>
                  <t.ic size={22}/>
                  <div className="tc-l">{t.l}</div>
                  <div className="mono tc-en">{t.en}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ② 输入源 */}
          <div className="m-section">
            <div className="eyebrow" style={{marginBottom:10}}>② 输入源</div>
            <div className="composer-url" style={{marginBottom:10}}>
              <div className="platform"><IcLink size={18}/></div>
              <input value={url} onChange={e=>setUrl(e.target.value)}
                placeholder={type==='text'?'粘贴链接或文本...':'B站 / 小红书 / 抖音 / YouTube / 本地文件路径'}/>
              <button className="btn btn-ghost"><IcUpload size={14}/>上传</button>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              <span className="kw"><IcLink size={11}/>支持网络链接</span>
              <span className="kw"><IcUpload size={11}/>拖拽上传</span>
              <span className="kw">本地版无大小限制</span>
            </div>
          </div>

          {/* ③ 分析任务 */}
          <div className="m-section">
            <div className="eyebrow" style={{marginBottom:10}}>③ 勾选分析任务 · {type}</div>
            <div className="task-chips">
              {currentTasks.map(t => (
                <button key={t} className="task-chip" data-on={!!tasks[t]}
                  onClick={()=>setTasks(s=>({...s, [t]: !s[t]}))}>
                  <span className="tc-box">{tasks[t] && <IcCheck size={12}/>}</span>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ④ 背景信息（可选，强烈推荐） §3.1 */}
          <div className="m-section">
            <button onClick={() => setBgOpen(o => !o)}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:8, background:'none',
                             border:'1px solid var(--line)', borderRadius:10, padding:'10px 14px',
                             cursor:'pointer', color:'var(--ink-2)', transition:'all 140ms' }}>
              <IcCpu size={14} style={{ color:'var(--accent)', flexShrink:0 }}/>
              <span style={{ fontFamily:'var(--mono)', fontSize:11, letterSpacing:'0.1em',
                             textTransform:'uppercase', flex:1, textAlign:'left' }}>
                ④ 背景信息（可选 · 强烈推荐）
              </span>
              <span className="kw" style={{ fontSize:10, background:'rgba(255,77,126,0.1)',
                                             color:'var(--accent)', border:'none', flexShrink:0 }}>
                注入所有 AI 调用
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                   style={{ transform: bgOpen ? 'rotate(180deg)' : 'none', transition:'transform 200ms', flexShrink:0 }}>
                <path d="M2 4l4 4 4-4"/>
              </svg>
            </button>

            {bgOpen && (
              <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:10,
                            padding:'14px 16px', background:'var(--bg-sunken)',
                            border:'1px solid var(--line)', borderRadius:12 }}>

                {/* 内容类型 */}
                <div>
                  <div className="mono" style={{ fontSize:10, color:'var(--ink-3)', marginBottom:5, letterSpacing:'0.08em' }}>
                    内容类型
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {BG_CONTENT_TYPES.map(ct => (
                      <button key={ct} onClick={() => setBgType(ct)}
                              style={{ height:28, padding:'0 11px', borderRadius:7, fontSize:12, border:'none', cursor:'pointer',
                                       background: bgType===ct ? 'var(--ink)' : 'var(--bg-elev)',
                                       color: bgType===ct ? 'var(--bg)' : 'var(--ink-3)',
                                       border: bgType===ct ? 'none' : '1px solid var(--line)' }}>
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 参与人员 */}
                <div>
                  <div className="mono" style={{ fontSize:10, color:'var(--ink-3)', marginBottom:5, letterSpacing:'0.08em' }}>
                    参与人员 <span style={{ opacity:0.5 }}>· 用于说话人识别匹配</span>
                  </div>
                  <input value={bgPeople} onChange={e=>setBgPeople(e.target.value)}
                         placeholder="张总、李总、产品负责人…" style={inputStyle}/>
                </div>

                {/* 主题背景 */}
                <div>
                  <div className="mono" style={{ fontSize:10, color:'var(--ink-3)', marginBottom:5, letterSpacing:'0.08em' }}>
                    主题背景 <span style={{ opacity:0.5 }}>· 注入 LLM 上下文</span>
                  </div>
                  <input value={bgContext} onChange={e=>setBgContext(e.target.value)}
                         placeholder="Q3 战略会议 · AI 工具评测…" style={inputStyle}/>
                </div>

                {/* 专有名词 */}
                <div>
                  <div className="mono" style={{ fontSize:10, color:'var(--ink-3)', marginBottom:5, letterSpacing:'0.08em' }}>
                    专有名词 <span style={{ opacity:0.5 }}>· 提升 Whisper 识别准确率</span>
                  </div>
                  <input value={bgTerms} onChange={e=>setBgTerms(e.target.value)}
                         placeholder="Pocket 4, D-Log M, ProRes RAW…" style={inputStyle}/>
                </div>

                {/* 分析目的 */}
                <div>
                  <div className="mono" style={{ fontSize:10, color:'var(--ink-3)', marginBottom:5, letterSpacing:'0.08em' }}>
                    分析目的 <span style={{ opacity:0.5 }}>· 影响总结侧重点</span>
                  </div>
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {BG_PURPOSES.map(p => (
                      <button key={p} onClick={() => setBgPurpose(p)}
                              style={{ height:28, padding:'0 11px', borderRadius:7, fontSize:12, cursor:'pointer',
                                       background: bgPurpose===p ? 'var(--accent)' : 'var(--bg-elev)',
                                       color: bgPurpose===p ? '#fff' : 'var(--ink-3)',
                                       border: bgPurpose===p ? 'none' : '1px solid var(--line)' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mono" style={{ fontSize:10, color:'var(--ink-4)', marginTop:2 }}>
                  以上信息将注入到所有后续 AI 调用（视觉分析 · 文本总结 · LLM 对话），提升准确率。
                </div>
              </div>
            )}
          </div>

          {/* ⑤ 模型选择 */}
          <div className="m-section">
            <div className="eyebrow" style={{marginBottom:10}}>⑤ 模型选择</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10}}>
              <div className="opt-cell">
                <div className="opt-label">视觉</div>
                <div className="opt-value">Qwen-VL-Max <IcArrowRight size={12}/></div>
              </div>
              <div className="opt-cell">
                <div className="opt-label">文本</div>
                <div className="opt-value">Claude 4.5 <IcArrowRight size={12}/></div>
              </div>
              <div className="opt-cell">
                <div className="opt-label">视频大模型</div>
                <div className="opt-value">Gemini 1.5 Pro <IcArrowRight size={12}/></div>
              </div>
            </div>
          </div>
        </div>

        <div className="m-foot">
          <span className="mono" style={{fontSize:12, color:'var(--ink-3)'}}>
            <span className="chip-dot" style={{marginRight:6}}/>
            已勾选 {Object.values(tasks).filter(Boolean).length} 项 · 预计 ~ 4 min · 并行上限 3
          </span>
          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={()=>onFineTune && onFineTune({type,url,tasks,bg:{bgType,bgPeople,bgContext,bgTerms,bgPurpose},workspaceIds})}>
              <IcSliders size={13}/>细调…
            </button>
            <button className="btn btn-primary" onClick={()=>onSubmit({type,url,tasks,bg:{bgType,bgPeople,bgContext,bgTerms,bgPurpose},workspaceIds})}>
              <IcSpark size={13}/>一键解析
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { Taskboard, AddMaterialModal });
