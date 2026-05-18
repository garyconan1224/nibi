/* Preflight — 前置配置面板 · PRD §4
   背景信息 + 模型选择 + 任务勾选,根据内容类型动态切换勾选项.
   作为右侧抽屉弹出,沿用 .drawer 风格.                              */

const CONTENT_TYPES = ['课程','会议','宣传片','Vlog','访谈','纯音乐','其他'];
const PURPOSES = ['复刻参考','竞品分析','内容学习','其他'];
const MEDIA_KINDS = [
  { id:'video', label:'视频', ic:'IcFilm',  tone:'pink'   },
  { id:'audio', label:'音频', ic:'IcMusic', tone:'purple' },
  { id:'image', label:'图片', ic:'IcImage', tone:'blue'   },
  { id:'text',  label:'文字', ic:'IcDoc',   tone:'amber'  },
];

const MODEL_PRESETS = {
  vision: ['GPT-4o · OpenAI', 'Claude 3.5 Sonnet · Anthropic', 'Qwen-VL-Max · 阿里', 'Gemini 1.5 Pro · Google'],
  text:   ['GPT-4o-mini · OpenAI', 'Claude 3.5 Haiku · Anthropic', 'Qwen-Plus · 阿里', 'DeepSeek-V3 · DeepSeek'],
  video:  ['Gemini 1.5 Pro · Google', 'Qwen-VL-Max · 阿里', 'GPT-4o · OpenAI'],
};

/* ─── Task checkbox groups per media kind (PRD §4.4) ─── */
const TASK_GROUPS = {
  video: [
    { id:'frame_prompt', label:'画面提示词生成', sub:'截帧 · VLM · 提示词', default:true,
      children: [
        { id:'frame_mode', label:'截帧模式', type:'radio', options:['按秒截帧','AI 镜头分析'], default:'AI 镜头分析' },
        { id:'sec_per_frame', label:'按秒间隔', type:'number', default:2, unit:'秒/帧', whenParent:'frame_mode', whenValue:'按秒截帧' },
        { id:'max_frames', label:'最大帧数', type:'number', default:120, unit:'帧',     whenParent:'frame_mode', whenValue:'按秒截帧' },
        { id:'shot_frames', label:'镜头取帧', type:'radio', options:['2 帧 · 首+尾','3 帧 · 首+中+尾'], default:'3 帧 · 首+中+尾', whenParent:'frame_mode', whenValue:'AI 镜头分析' },
      ]
    },
    { id:'summary', label:'视频文案总结', sub:'字幕 · 音视频合并 · 视频模型', default:true,
      children: [
        { id:'summary_path', label:'总结路径', type:'radio', options:['字幕直接总结','音视频合并 · 最详细','视频模型直接分析'], default:'音视频合并 · 最详细' },
        { id:'summary_depth', label:'总结深度', type:'radio', options:['简洁','详细','带画面引用'], default:'详细', whenParent:'summary_path', whenValue:'音视频合并 · 最详细' },
      ]
    },
    { id:'music', label:'音乐分析', sub:'BPM / 调性 / 乐器 / 提示词', default:false,
      children: [
        { id:'music_suno', label:'同时生成 Suno / Udio 格式提示词', type:'check', default:true },
      ]
    },
    { id:'srt', label:'字幕导出', sub:'.srt 文件', default:true },
  ],
  audio: [
    { id:'asr', label:'人声转写 + 内容总结', sub:'Whisper · 多语言', default:true,
      children: [
        { id:'asr_lang', label:'语言', type:'radio', options:['自动检测','中文','英文','其他'], default:'自动检测' },
        { id:'asr_diar', label:'开启说话人分离', type:'check', default:true },
      ]
    },
    { id:'voiceprint', label:'说话人音色区分', sub:'声纹聚类 · 自动匹配参与人员', default:true },
    { id:'srt', label:'生成字幕文件', sub:'.srt / .txt', default:true },
    { id:'music', label:'音乐分析', sub:'BPM / 调性 / 乐器', default:false,
      children: [
        { id:'music_suno', label:'生成 Suno / Udio 格式提示词', type:'check', default:true },
      ]
    },
  ],
  image: [
    { id:'describe',label:'内容识别描述', sub:'主体 / 场景 / 色调 / 构图 / 风格', default:true },
    { id:'ocr',     label:'OCR 文字提取', sub:'中英混合 · 手写 · 竖排', default:false },
    { id:'prompt',  label:'画面提示词生成', sub:'7 维度自动标签', default:true,
      children: [
        { id:'prompt_fmt', label:'输出格式', type:'radio', options:['Midjourney','Stable Diffusion','JSON'], default:'Midjourney' },
      ]
    },
    { id:'assoc',  label:'内容联想总结', sub:'用途 / 设计 / 竞品 / 情绪', default:false,
      children: [
        { id:'assoc_dir', label:'联想方向', type:'radio', options:['用途推断','设计分析','竞品洞察','情绪解读'], default:'用途推断' },
      ]
    },
    { id:'compare', label:'多图对比分析', sub:'仅多张图片时可选', default:false },
  ],
  text: [
    { id:'summary', label:'摘要 / 要点 / 金句', sub:'一次调用 · 三类输出', default:true,
      children: [
        { id:'sum_len', label:'摘要长度', type:'radio', options:['50 字','100 字','200 字'], default:'100 字' },
      ]
    },
    { id:'assoc', label:'联想归纳', sub:'深度解读 / 观点 / 趋势 / 行动', default:true,
      children: [
        { id:'assoc_dir', label:'方向', type:'radio', options:['深度解读','观点提炼','趋势判断','行动建议'], default:'深度解读' },
      ]
    },
    { id:'rewrite', label:'改写 / 润色', sub:'与原文并排对照', default:false,
      children: [
        { id:'rw_style', label:'风格', type:'radio', options:['正式','口语','简洁','丰富'], default:'简洁' },
      ]
    },
    { id:'translate', label:'翻译', sub:'目标语言', default:false,
      children: [
        { id:'tr_lang', label:'目标语言', type:'text', default:'English' },
      ]
    },
    { id:'multi', label:'多文对比', sub:'观点 / 立场 / 时间线', default:false },
  ],
};

/* ─── Preflight Drawer ─── */
const Preflight = ({ open, onClose, onStart, sourceUrl, sourcePlatform, defaultKind='video' }) => {
  const [kind, setKind] = React.useState(defaultKind);
  const [bg, setBg] = React.useState({
    contentType: '宣传片',
    people: 'Hugo · 影视飓风',
    theme: 'Q2 数码产品开箱评测 · 目标抖音切片',
    terms: 'Pocket 4, D-Log M, ProRes RAW, 1英寸大底',
    purpose: '复刻参考',
  });
  const [models, setModels] = React.useState({
    vision: MODEL_PRESETS.vision[0],
    text:   MODEL_PRESETS.text[0],
    video:  MODEL_PRESETS.video[0],
  });
  const [tasks, setTasks] = React.useState(() => {
    const init = {};
    Object.entries(TASK_GROUPS).forEach(([k, groups]) => {
      init[k] = {};
      groups.forEach(g => {
        init[k][g.id] = { on: g.default };
        if (g.children) g.children.forEach(c => init[k][g.id][c.id] = c.default);
      });
    });
    return init;
  });

  const groups = TASK_GROUPS[kind] || [];
  const enabledCount = Object.values(tasks[kind] || {}).filter(v => v.on).length;

  const setTask = (gid, patch) => setTasks(s => ({
    ...s, [kind]: { ...s[kind], [gid]: { ...s[kind][gid], ...patch } }
  }));

  return (
    <>
      <div className="drawer-backdrop" data-open={open} onClick={onClose}/>
      <aside className="drawer" data-open={open} style={{width:520}}>
        <div className="d-head">
          <div>
            <div className="eyebrow" style={{marginBottom:6}}>Preflight · 前置配置 · §4</div>
            <h3 style={{margin:0, fontFamily:'var(--display)', fontSize:30}}>开始解析前</h3>
            <div className="mono" style={{fontSize:11, color:'var(--ink-3)', marginTop:6}}>
              {sourceUrl ? sourceUrl : '从工作台传入'} · {sourcePlatform || 'auto'}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><IcX size={16}/></button>
        </div>

        <div className="d-body" style={{padding:'4px 22px 16px'}}>

          {/* ─── Media kind tabs ─── */}
          <div style={{display:'flex', gap:6, padding:'14px 0 18px'}}>
            {MEDIA_KINDS.map(m => {
              const Ic = window[m.ic];
              const active = kind === m.id;
              return (
                <button key={m.id}
                  onClick={() => setKind(m.id)}
                  className="btn"
                  style={{
                    flex:1, height:42, justifyContent:'center',
                    background: active ? 'var(--ink)' : 'var(--bg-elev)',
                    color: active ? 'var(--bg)' : 'var(--ink)',
                    borderColor: active ? 'var(--ink)' : 'var(--line)',
                  }}>
                  <Ic size={14}/>
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* ─── Section 1: 背景信息 ─── */}
          <PFSection num="01" title="背景信息" sub="Context · 注入到所有 AI 调用">
            <PFGrid>
              <PFField label="内容类型" hint="影响总结结构">
                <select className="pf-sel" value={bg.contentType} onChange={e=>setBg(s=>({...s,contentType:e.target.value}))}>
                  {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </PFField>
              <PFField label="分析目的" hint="影响 LLM 风格">
                <select className="pf-sel" value={bg.purpose} onChange={e=>setBg(s=>({...s,purpose:e.target.value}))}>
                  {PURPOSES.map(t => <option key={t}>{t}</option>)}
                </select>
              </PFField>
            </PFGrid>
            <PFField label="参与人员" hint="逗号分隔 · 用于声纹匹配">
              <input className="pf-inp" value={bg.people} onChange={e=>setBg(s=>({...s,people:e.target.value}))}/>
            </PFField>
            <PFField label="主题背景" hint="一句话上下文">
              <input className="pf-inp" value={bg.theme} onChange={e=>setBg(s=>({...s,theme:e.target.value}))}/>
            </PFField>
            <PFField label="专有名词" hint="影响 Whisper 识别准确率">
              <input className="pf-inp" value={bg.terms} onChange={e=>setBg(s=>({...s,terms:e.target.value}))}/>
            </PFField>
          </PFSection>

          {/* ─── Section 2: 模型选择 ─── */}
          <PFSection num="02" title="模型选择" sub="Models · 仅可选已配置项" extra={
            <button className="btn btn-ghost" style={{height:26, padding:'0 10px', fontSize:11}}>
              <IcSettings size={11}/>
              管理模型
            </button>
          }>
            <PFField label="视觉大模型" hint="VLM · 截帧 / 图片分析">
              <select className="pf-sel" value={models.vision} onChange={e=>setModels(s=>({...s,vision:e.target.value}))}>
                {MODEL_PRESETS.vision.map(m => <option key={m}>{m}</option>)}
              </select>
            </PFField>
            <PFField label="文本大模型" hint="LLM · 总结 / 归纳 / 对话">
              <select className="pf-sel" value={models.text} onChange={e=>setModels(s=>({...s,text:e.target.value}))}>
                {MODEL_PRESETS.text.map(m => <option key={m}>{m}</option>)}
              </select>
            </PFField>
            {(kind === 'video' && tasks.video.summary?.on && tasks.video.summary?.summary_path === '视频模型直接分析') && (
              <PFField label="视频大模型" hint="路径 3 · 整段视频直送">
                <select className="pf-sel" value={models.video} onChange={e=>setModels(s=>({...s,video:e.target.value}))}>
                  {MODEL_PRESETS.video.map(m => <option key={m}>{m}</option>)}
                </select>
              </PFField>
            )}
          </PFSection>

          {/* ─── Section 3: 任务勾选 ─── */}
          <PFSection num="03" title="任务勾选" sub={`Tasks · 已选 ${enabledCount} / ${groups.length}`}>
            <div style={{display:'grid', gap:10}}>
              {groups.map(g => {
                const state = tasks[kind][g.id] || {};
                return (
                  <PFTaskCard key={g.id} group={g} state={state} setState={(p)=>setTask(g.id, p)}/>
                );
              })}
            </div>
          </PFSection>

        </div>

        {/* ─── Footer ─── */}
        <div style={{
          borderTop:'1px solid var(--line)',
          padding:'14px 22px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'var(--bg-elev)',
        }}>
          <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>
            <span style={{color:'var(--accent-green)'}}>●</span> 配置已就绪 · {enabledCount} 项分析任务
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn-run" onClick={() => onStart && onStart({kind, bg, models, tasks: tasks[kind]})}>
              开始分析
              <span className="iconwrap"><IcPlay size={12}/></span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

/* ─── Sub-components ─── */
const PFSection = ({ num, title, sub, extra, children }) => (
  <section style={{marginBottom:24}}>
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
      <div style={{display:'flex', alignItems:'baseline', gap:10}}>
        <span className="mono" style={{
          fontSize:10, padding:'3px 8px', borderRadius:6,
          background:'var(--bg-sunken)', color:'var(--ink-2)',
          fontWeight:600, letterSpacing:'0.08em',
        }}>{num}</span>
        <h4 style={{margin:0, fontFamily:'var(--display)', fontSize:22, fontWeight:500}}>{title}</h4>
        <span className="mono" style={{fontSize:10, color:'var(--ink-3)', letterSpacing:'0.06em'}}>{sub}</span>
      </div>
      {extra}
    </div>
    <div style={{display:'grid', gap:12}}>{children}</div>
  </section>
);

const PFGrid = ({ children }) => (
  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>{children}</div>
);

const PFField = ({ label, hint, children }) => (
  <label style={{display:'block'}}>
    <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:6}}>
      <span style={{fontSize:12, fontWeight:500, color:'var(--ink)'}}>{label}</span>
      {hint && <span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{hint}</span>}
    </div>
    {children}
  </label>
);

const PFTaskCard = ({ group, state, setState }) => {
  const on = !!state.on;
  return (
    <div style={{
      border:'1px solid var(--line)',
      borderRadius:14,
      padding:14,
      background: on ? 'var(--bg-elev)' : 'transparent',
      transition:'background 140ms ease, border-color 140ms ease',
      borderColor: on ? 'var(--line-strong)' : 'var(--line)',
    }}>
      <label style={{display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer'}}>
        <div style={{
          width:22, height:22, borderRadius:7,
          border:`2px solid ${on?'var(--ink)':'var(--line-strong)'}`,
          background: on ? 'var(--ink)' : 'transparent',
          display:'grid', placeItems:'center',
          flexShrink:0, marginTop:2,
          transition:'all 140ms ease',
        }}>
          {on && <IcCheck size={12} stroke="var(--bg)" sw={3}/>}
          <input type="checkbox" checked={on} onChange={e=>setState({on:e.target.checked})}
                 style={{position:'absolute', opacity:0}}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:14, fontWeight:600, color:'var(--ink)'}}>{group.label}</div>
          {group.sub && <div className="mono" style={{fontSize:10, color:'var(--ink-3)', marginTop:3, letterSpacing:'0.04em'}}>{group.sub}</div>}
        </div>
      </label>

      {on && group.children && (
        <div style={{
          marginTop:14, paddingTop:14,
          borderTop:'1px dashed var(--line)',
          display:'grid', gap:10,
        }}>
          {group.children.map(c => {
            // conditional show
            if (c.whenParent && state[c.whenParent] !== c.whenValue) return null;

            if (c.type === 'radio') {
              const val = state[c.id] ?? c.default;
              return (
                <div key={c.id}>
                  <div style={{fontSize:11, color:'var(--ink-2)', marginBottom:6, fontWeight:500}}>{c.label}</div>
                  <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                    {c.options.map(o => {
                      const active = val === o;
                      return (
                        <button key={o} onClick={() => setState({[c.id]: o})}
                          style={{
                            height:28, padding:'0 12px',
                            borderRadius:8,
                            border:`1px solid ${active?'var(--ink)':'var(--line)'}`,
                            background: active ? 'var(--ink)' : 'var(--bg)',
                            color: active ? 'var(--bg)' : 'var(--ink)',
                            fontSize:11, fontFamily:'var(--mono)',
                            cursor:'pointer',
                          }}>
                          {o}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (c.type === 'check') {
              return (
                <label key={c.id} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12}}>
                  <input type="checkbox" checked={!!state[c.id]} onChange={e=>setState({[c.id]: e.target.checked})}
                         style={{accentColor:'var(--ink)', width:14, height:14}}/>
                  <span style={{color:'var(--ink-2)'}}>{c.label}</span>
                </label>
              );
            }
            if (c.type === 'number') {
              return (
                <div key={c.id} style={{display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:11, color:'var(--ink-2)', minWidth:60}}>{c.label}</span>
                  <input type="number" value={state[c.id] ?? c.default}
                         onChange={e=>setState({[c.id]: Number(e.target.value)})}
                         className="pf-inp" style={{width:80, height:28, padding:'0 8px'}}/>
                  <span className="mono" style={{fontSize:10, color:'var(--ink-3)'}}>{c.unit}</span>
                </div>
              );
            }
            if (c.type === 'text') {
              return (
                <div key={c.id}>
                  <div style={{fontSize:11, color:'var(--ink-2)', marginBottom:6}}>{c.label}</div>
                  <input className="pf-inp" value={state[c.id] ?? c.default} onChange={e=>setState({[c.id]: e.target.value})}/>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};

window.Preflight = Preflight;
