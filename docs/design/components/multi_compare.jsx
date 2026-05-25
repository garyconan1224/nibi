/* MultiCompare — spec v1.1 §7.3 / §8.3
 *   MultiImageCompare : 多图横向对比报告 — 风格一致性 / 差异点 / 共同特征
 *   MultiTextCompare  : 多文对比报告 — 观点异同 / 立场倾向 / 信息完整性 / 时间线
 */

/* ─── helpers ─── */
const MCEyebrow = ({ children }) => (
  <span className="eyebrow" style={{ fontSize:10 }}>{children}</span>
);

const MCToneFor = (k) => ({
  green: 'var(--accent-green)',
  warm:  'var(--accent-warm)',
  pink:  'var(--accent)',
  blue:  'var(--accent-3)',
  purple:'var(--accent-2)',
  mono:  'var(--ink-2)',
}[k] || 'var(--ink-2)');

/* ═══════════════════════════════════════════
   §7.3 — MultiImageCompare
   ═══════════════════════════════════════════ */

const MC_IMAGE_BATCH = [
  { fi:3, label:'金时调 · 海岸',  ts:'IMG_4012.HEIC' },
  { fi:7, label:'霓虹街拍 · 雨后',  ts:'IMG_4018.HEIC' },
  { fi:5, label:'室内人像 · 窗光',  ts:'IMG_4022.HEIC' },
  { fi:0, label:'产品摄影 · 黑底',  ts:'IMG_4030.HEIC' },
  { fi:4, label:'霓虹H · 转场',     ts:'IMG_4035.HEIC' },
];

const MC_IMG_DIMS = [
  { k:'风格',  values:['Cinematic','Cinematic','Editorial','Studio','Cyberpunk'] },
  { k:'色调',  values:['暖琥珀','冷蓝紫','中性暖','纯黑','洋红绿'] },
  { k:'光线',  values:['Backlight','Neon','Window soft','Rim hard','Volumetric'] },
  { k:'景别',  values:['Wide','Medium','Close-up','Macro','Wide'] },
  { k:'人/物', values:['人像','人像','人像','产品','场景'] },
];

const MC_IMG_COMMON = ['shallow depth of field', 'high contrast', '16:9 framing', 'directional light'];
const MC_IMG_DIFFS  = [
  { dim:'色调',     dist:[2,1,3,1,1], note:'5 张色调跨度大,无法归为同一调色板' },
  { dim:'景别',     dist:[2,2,1,0,0], note:'广中近三档分布尚均匀,适合用作 5 镜头脚本' },
  { dim:'风格',     dist:[2,1,1,1,1], note:'Cinematic 占 40%,可作为主导风格' },
];

const MultiImageCompare = ({ onBack, onPickImage }) => {
  const [view, setView] = React.useState('grid');  // grid | table | report
  const [selected, setSelected] = React.useState(MC_IMAGE_BATCH.map((_, i) => i));
  const [pinnedDim, setPinnedDim] = React.useState('色调');

  const toggle = (i) => setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i]);
  const dimRow = MC_IMG_DIMS.find(d => d.k === pinnedDim);

  return (
    <div style={{ height:'100%', overflow:'auto' }}>
      <div className="tb-wrap" style={{ paddingTop:24 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                      gap:24, marginBottom:24, flexWrap:'wrap' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:8 }}>
              MULTI-IMAGE COMPARE · §7.3 · {selected.length} / {MC_IMAGE_BATCH.length} 张
            </div>
            <h1 className="display" style={{ fontSize:42, margin:0, letterSpacing:'-0.01em', lineHeight:1.1 }}>
              横向对比 · <span style={{ fontStyle:'italic', color:'var(--ink-3)' }}>5 张参考图</span>
            </h1>
            <p style={{ margin:'10px 0 0', fontSize:13, color:'var(--ink-3)', maxWidth:560, lineHeight:1.55 }}>
              对比 {MC_IMAGE_BATCH.length} 张同类型素材的风格一致性 · 差异点 · 共同特征。可切换表格 / 报告视图。
            </p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <div className="tw-segm">
              {[['grid','缩略图'],['table','维度表'],['report','报告']].map(([id,l]) => (
                <button key={id} data-active={view===id} onClick={()=>setView(id)}>{l}</button>
              ))}
            </div>
            <button className="btn" onClick={onBack}>
              <IcArrowRight size={12} style={{ transform:'rotate(180deg)' }}/>返回
            </button>
            <button className="btn btn-primary"><IcDownload size={13}/>导出 .md</button>
          </div>
        </div>

        {/* ── GRID view ── */}
        {view === 'grid' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:10, marginBottom:24 }}>
              {MC_IMAGE_BATCH.map((b, i) => {
                const f = VM_DATA.FRAMES[b.fi];
                const isSel = selected.includes(i);
                return (
                  <div key={i}
                       onClick={() => toggle(i)}
                       style={{
                         borderRadius:14, overflow:'hidden', cursor:'pointer',
                         background:'var(--bg-elev)',
                         border: `2px solid ${isSel ? 'var(--ink)' : 'var(--line)'}`,
                         opacity: isSel ? 1 : 0.5,
                         transition:'all 160ms ease',
                         position:'relative',
                       }}>
                    <div style={{ position:'relative', aspectRatio:'1/1', background:'var(--bg-sunken)' }}>
                      <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}
                           style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                      <div style={{
                        position:'absolute', top:8, left:8, width:22, height:22, borderRadius:99,
                        background: isSel ? 'var(--ink)' : 'rgba(255,255,255,0.8)',
                        color: isSel ? 'var(--bg)' : 'var(--ink-3)',
                        display:'grid', placeItems:'center',
                        fontFamily:'var(--mono)', fontSize:10, fontWeight:700,
                      }}>{i+1}</div>
                    </div>
                    <div style={{ padding:'10px 12px' }}>
                      <div style={{ fontSize:12, fontWeight:600, lineHeight:1.3,
                                     whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {b.label}
                      </div>
                      <div className="mono" style={{ fontSize:10, color:'var(--ink-4)', marginTop:2 }}>
                        {b.ts}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Per-dimension distribution bars · 5 stripes */}
            <div style={{
              background:'var(--bg-elev)', border:'1px solid var(--line)',
              borderRadius:'var(--radius)', padding:'18px 22px', marginBottom:24,
            }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
                <MCEyebrow>维度概览 · 选一行钉到下方</MCEyebrow>
                <span className="mono" style={{ fontSize:10, color:'var(--ink-4)' }}>
                  点击维度名固定查看
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'70px repeat(5, 1fr)', gap:'4px 8px',
                            alignItems:'center' }}>
                <div/>
                {MC_IMAGE_BATCH.map((b, i) => (
                  <div key={i} className="mono" style={{ fontSize:9, color:'var(--ink-4)', textAlign:'center' }}>
                    {String(i+1).padStart(2,'0')}
                  </div>
                ))}
                {MC_IMG_DIMS.map(d => {
                  const focused = pinnedDim === d.k;
                  return (
                    <React.Fragment key={d.k}>
                      <button onClick={() => setPinnedDim(d.k)}
                              style={{ textAlign:'right', padding:'4px 6px',
                                       background: focused ? 'var(--ink)' : 'transparent',
                                       color: focused ? 'var(--bg)' : 'var(--ink-2)',
                                       borderRadius:6, fontSize:11, fontWeight:600,
                                       border:'none', cursor:'pointer' }}>
                        {d.k}
                      </button>
                      {d.values.map((v, i) => {
                        const isSel = selected.includes(i);
                        return (
                          <div key={i} style={{
                            padding:'5px 6px', borderRadius:6, textAlign:'center',
                            fontSize:11, color: isSel ? 'var(--ink)' : 'var(--ink-4)',
                            background: isSel ? 'var(--bg-sunken)' : 'transparent',
                            opacity: isSel ? 1 : 0.4,
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                          }}>
                            {v}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Diff & common summary */}
            <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14 }}>
              <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                            borderRadius:'var(--radius)', padding:'18px 22px' }}>
                <MCEyebrow>差异点 · {pinnedDim}</MCEyebrow>
                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:14 }}>
                  {MC_IMG_DIFFS.map(d => (
                    <div key={d.dim} style={{
                      padding:'12px 14px', borderRadius:12,
                      background: d.dim === pinnedDim ? 'var(--bg-sunken)' : 'transparent',
                      border: `1px solid ${d.dim === pinnedDim ? 'var(--line-strong)' : 'var(--line)'}`,
                    }}>
                      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{d.dim}</span>
                        <span className="mono" style={{ fontSize:10, color:'var(--ink-3)' }}>
                          分布 [{d.dist.join(',')}]
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:3, marginBottom:7 }}>
                        {d.dist.map((n, i) => (
                          <div key={i} style={{
                            flex:1, height:14, borderRadius:3,
                            background: n === 0 ? 'var(--bg-sunken)' : MCToneFor(['green','warm','pink','blue','purple'][i]),
                            opacity: selected.includes(i) ? 1 : 0.3,
                            position:'relative',
                          }}>
                            {n > 0 && (
                              <span style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                                              fontFamily:'var(--mono)', fontSize:9, color:'#fff', fontWeight:700 }}>
                                {n}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize:12, color:'var(--ink-2)', lineHeight:1.5 }}>{d.note}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                            borderRadius:'var(--radius)', padding:'18px 22px' }}>
                <MCEyebrow>共同特征 · 5/5 命中</MCEyebrow>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
                  {MC_IMG_COMMON.map(t => (
                    <span key={t} className="kw" style={{ fontSize:12, padding:'5px 11px' }}>
                      <IcCheck size={11} style={{ color:'var(--accent-green)' }}/>
                      {t}
                    </span>
                  ))}
                </div>
                <div style={{ height:1, background:'var(--line)', margin:'18px 0' }}/>
                <MCEyebrow>风格一致性 · 综合分</MCEyebrow>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:6 }}>
                  <span className="display" style={{ fontSize:56, lineHeight:1 }}>67</span>
                  <span style={{ fontSize:12, color:'var(--ink-3)' }}>/ 100 · 中等</span>
                </div>
                <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:8, lineHeight:1.55 }}>
                  色调跨度过大是主因。建议拆为 2 个子系列分别复刻:
                  <b style={{ color:'var(--ink)' }}>暖琥珀组(1, 3)</b> + <b style={{ color:'var(--ink)' }}>冷霓虹组(2, 5)</b>。
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── TABLE view ── */}
        {view === 'table' && (
          <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                        borderRadius:'var(--radius)', overflow:'hidden' }}>
            <div style={{ display:'grid',
                          gridTemplateColumns:`120px repeat(${MC_IMAGE_BATCH.length}, 1fr)`,
                          background:'var(--bg-sunken)', borderBottom:'1px solid var(--line-strong)' }}>
              <div style={{ padding:'14px 16px', fontFamily:'var(--mono)', fontSize:10, letterSpacing:'0.1em',
                            color:'var(--ink-3)', textTransform:'uppercase' }}>维度</div>
              {MC_IMAGE_BATCH.map((b, i) => {
                const f = VM_DATA.FRAMES[b.fi];
                return (
                  <div key={i} style={{ padding:8, borderLeft:'1px solid var(--line)' }}>
                    <div style={{ aspectRatio:'16/9', borderRadius:6, overflow:'hidden',
                                   background:'var(--bg-sunken)', marginBottom:6 }}>
                      <img src={`assets/frame_${f.ts.replace(/:/g,'_')}.svg`}
                           style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                    </div>
                    <div style={{ fontSize:11, fontWeight:600, lineHeight:1.3,
                                   whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {b.label}
                    </div>
                    <div className="mono" style={{ fontSize:9, color:'var(--ink-4)', marginTop:2 }}>
                      {String(i+1).padStart(2,'0')}
                    </div>
                  </div>
                );
              })}
            </div>
            {MC_IMG_DIMS.map(d => (
              <div key={d.k} style={{ display:'grid',
                                        gridTemplateColumns:`120px repeat(${MC_IMAGE_BATCH.length}, 1fr)`,
                                        borderTop:'1px solid var(--line)' }}>
                <div style={{ padding:'14px 16px', fontWeight:600, fontSize:13, color:'var(--ink)',
                              background:'var(--bg-sunken)' }}>{d.k}</div>
                {d.values.map((v, i) => (
                  <div key={i} style={{ padding:'14px 12px', borderLeft:'1px solid var(--line)',
                                          fontSize:13, color: selected.includes(i) ? 'var(--ink)' : 'var(--ink-4)',
                                          opacity: selected.includes(i) ? 1 : 0.5 }}>
                    {v}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── REPORT view ── */}
        {view === 'report' && (
          <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                        borderRadius:'var(--radius-lg)', padding:'40px 56px',
                        maxWidth:780, margin:'0 auto', lineHeight:1.7 }}>
            <MCEyebrow>横向对比报告 · 自动生成 · GPT-4o</MCEyebrow>
            <h2 style={{ fontFamily:'var(--display)', fontSize:32, margin:'10px 0 22px', lineHeight:1.15 }}>
              5 张参考图的<span style={{ color:'var(--accent)', fontStyle:'italic' }}>风格 DNA</span>
            </h2>

            <h3 style={{ fontSize:15, fontWeight:600, margin:'24px 0 8px' }}>① 共同特征</h3>
            <p style={{ fontSize:14, color:'var(--ink-2)', margin:0 }}>
              5 张图全部使用了 <b>shallow depth of field</b>、<b>high contrast</b> 与 <b>directional light</b>。
              都遵循 16:9 取景。这说明创作者熟悉电影感构图,且偏好戏剧化光线。
            </p>

            <h3 style={{ fontSize:15, fontWeight:600, margin:'24px 0 8px' }}>② 关键差异点</h3>
            <ul style={{ paddingLeft:22, margin:0, color:'var(--ink-2)', fontSize:14 }}>
              <li><b>色调</b>跨度大 —— 暖琥珀、冷蓝紫、洋红绿三组互不兼容,难以归为同一调色板。</li>
              <li><b>风格</b>以 Cinematic 主导(40%),但夹杂 Studio 与 Editorial,商业气质混杂。</li>
              <li><b>景别</b>分布均匀(广 2 / 中 2 / 近 1),适合作为一个完整脚本的 5 个镜头。</li>
            </ul>

            <h3 style={{ fontSize:15, fontWeight:600, margin:'24px 0 8px' }}>③ 复刻建议</h3>
            <p style={{ fontSize:14, color:'var(--ink-2)', margin:'0 0 12px' }}>
              建议拆为两个子系列分别复刻,不要混在一组 prompt 里跑:
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ background:'var(--bg-sunken)', border:'1px solid var(--line)',
                            borderRadius:12, padding:'14px 16px' }}>
                <MCEyebrow>暖琥珀组</MCEyebrow>
                <div style={{ fontSize:13, fontWeight:600, marginTop:5 }}>图 1 + 图 3</div>
                <div className="mono" style={{ fontSize:11, color:'var(--ink-3)', marginTop:6, lineHeight:1.5 }}>
                  warm amber, backlight, golden hour, cinematic
                </div>
              </div>
              <div style={{ background:'var(--bg-sunken)', border:'1px solid var(--line)',
                            borderRadius:12, padding:'14px 16px' }}>
                <MCEyebrow>冷霓虹组</MCEyebrow>
                <div style={{ fontSize:13, fontWeight:600, marginTop:5 }}>图 2 + 图 5</div>
                <div className="mono" style={{ fontSize:11, color:'var(--ink-3)', marginTop:6, lineHeight:1.5 }}>
                  neon magenta, volumetric fog, wet asphalt, cyberpunk
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

window.MultiImageCompare = MultiImageCompare;

/* ═══════════════════════════════════════════
   §8.3 — MultiTextCompare
   ═══════════════════════════════════════════ */

const MC_TEXT_BATCH = [
  { id:'t1', title:'Pocket 4 评测稿',  source:'微信公众号',   words:1842, date:'2026-04-22',
    tone:'pink',   stance:'中性偏正' },
  { id:'t2', title:'iPhone 17 上手稿', source:'极客公园',     words:1245, date:'2026-04-23',
    tone:'blue',   stance:'积极推荐' },
  { id:'t3', title:'徕卡 M11 长测稿',  source:'知乎专栏',     words:2611, date:'2026-04-25',
    tone:'amber',  stance:'保留意见' },
];

const MC_TEXT_DIMS = [
  { k:'核心观点', values:[
    'Pocket 4 在「便携 + 画质」之间做到了同类最优,但不是规格最强',
    'iPhone 17 Pro 摄像头是「无脑选」 — 苹果再次拉开了智能手机视频的差距',
    '徕卡 M11 是身份符号,买它的人不会去比参数,你不该和工程师论性价比',
  ]},
  { k:'立场倾向', values:['理性中立 · 60%','激情推荐 · 85%','怀旧保留 · 45%'] },
  { k:'信息密度', values:['高(8 项参数 + 3 项实测)','中(5 项参数 + 1 段视频对比)','低(2 项参数 + 4 段抒情)'] },
  { k:'引用来源', values:['官方规格表 · DPReview','苹果官网 · MKBHD','无 · 全凭主观体验'] },
  { k:'目标读者', values:['决策中的潜在买家','已买 / 准备升级的果粉','文艺中产 · 收藏向'] },
];

const MC_TEXT_OVERLAP = [
  { topic:'便携性', t1:'重要', t2:'未提', t3:'未提', who:'仅 1 篇' },
  { topic:'画质 / 动态范围', t1:'重要', t2:'重要', t3:'未提', who:'2 篇' },
  { topic:'价格 / 性价比', t1:'重要', t2:'未提', t3:'回避', who:'仅 1 篇' },
  { topic:'情绪价值 / 信仰', t1:'未提', t2:'未提', t3:'核心', who:'仅 1 篇' },
  { topic:'对手机摄影的看法', t1:'未提', t2:'核心', t3:'未提', who:'仅 1 篇' },
];

const MC_TEXT_TIMELINE = [
  { date:'2026-04-22', t1:'发布',      t2:null,     t3:null,     evt:'Pocket 4 评测发布(B站首发体验日 +1)' },
  { date:'2026-04-23', t1:null,        t2:'发布',   t3:null,     evt:'极客公园 iPhone 17 上手稿' },
  { date:'2026-04-24', t1:'10w 阅读',  t2:'4w',     t3:null,     evt:'流量峰值 · Pocket 4 评测进微博热搜' },
  { date:'2026-04-25', t1:null,        t2:null,     t3:'发布',   evt:'知乎 M11 长测 · 24h 内点赞 8.2k' },
];

const MultiTextCompare = ({ onBack }) => {
  const [view, setView] = React.useState('matrix'); // matrix | timeline | report

  return (
    <div style={{ height:'100%', overflow:'auto' }}>
      <div className="tb-wrap" style={{ paddingTop:24 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                      gap:24, marginBottom:24, flexWrap:'wrap' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom:8 }}>
              MULTI-TEXT COMPARE · §8.3 · {MC_TEXT_BATCH.length} 篇
            </div>
            <h1 className="display" style={{ fontSize:42, margin:0, letterSpacing:'-0.01em', lineHeight:1.1 }}>
              观点对照 · <span style={{ fontStyle:'italic', color:'var(--ink-3)' }}>3 篇评测稿</span>
            </h1>
            <p style={{ margin:'10px 0 0', fontSize:13, color:'var(--ink-3)', maxWidth:560, lineHeight:1.55 }}>
              对比观点异同 · 立场倾向 · 信息完整性 · 时间线分布。可切换矩阵 / 时间轴 / 报告视图。
            </p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <div className="tw-segm">
              {[['matrix','观点矩阵'],['timeline','时间线'],['report','报告']].map(([id,l]) => (
                <button key={id} data-active={view===id} onClick={()=>setView(id)}>{l}</button>
              ))}
            </div>
            <button className="btn" onClick={onBack}>
              <IcArrowRight size={12} style={{ transform:'rotate(180deg)' }}/>返回
            </button>
            <button className="btn btn-primary"><IcDownload size={13}/>导出 .md</button>
          </div>
        </div>

        {/* Source cards row · always visible */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:24 }}>
          {MC_TEXT_BATCH.map((t, i) => (
            <div key={t.id} style={{
              background:'var(--bg-elev)', border:`1px solid var(--line)`,
              borderRadius:14, padding:'14px 16px',
              borderTop:`3px solid ${MCToneFor(t.tone)}`,
            }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
                <span style={{
                  display:'inline-grid', placeItems:'center',
                  width:18, height:18, borderRadius:5,
                  background:MCToneFor(t.tone), color:'#fff',
                  fontFamily:'var(--mono)', fontSize:10, fontWeight:700,
                }}>{i+1}</span>
                <span style={{ fontSize:14, fontWeight:600, lineHeight:1.3, flex:1, minWidth:0,
                                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {t.title}
                </span>
              </div>
              <div className="mono" style={{ fontSize:10, color:'var(--ink-3)', display:'flex',
                                              gap:8, flexWrap:'wrap' }}>
                <span>{t.source}</span>
                <span style={{ color:'var(--ink-4)' }}>·</span>
                <span>{t.words} 字</span>
                <span style={{ color:'var(--ink-4)' }}>·</span>
                <span>{t.date}</span>
              </div>
              <div style={{ marginTop:6, fontSize:11, color:'var(--ink-2)' }}>
                立场 · <b style={{ color:MCToneFor(t.tone) }}>{t.stance}</b>
              </div>
            </div>
          ))}
        </div>

        {/* ── MATRIX view ── */}
        {view === 'matrix' && (
          <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                        borderRadius:'var(--radius)', overflow:'hidden', marginBottom:24 }}>
            <div style={{ display:'grid',
                          gridTemplateColumns:`130px repeat(${MC_TEXT_BATCH.length}, 1fr)`,
                          background:'var(--bg-sunken)', borderBottom:'1px solid var(--line-strong)' }}>
              <div style={{ padding:'14px 16px', fontFamily:'var(--mono)', fontSize:10, letterSpacing:'0.1em',
                            color:'var(--ink-3)', textTransform:'uppercase' }}>维度</div>
              {MC_TEXT_BATCH.map((t, i) => (
                <div key={t.id} style={{ padding:'12px 14px', borderLeft:'1px solid var(--line)',
                                          display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{
                    display:'inline-grid', placeItems:'center',
                    width:18, height:18, borderRadius:5,
                    background:MCToneFor(t.tone), color:'#fff',
                    fontFamily:'var(--mono)', fontSize:10, fontWeight:700,
                  }}>{i+1}</span>
                  <span style={{ fontSize:12, fontWeight:600,
                                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
            {MC_TEXT_DIMS.map((d, di) => (
              <div key={d.k} style={{ display:'grid',
                                        gridTemplateColumns:`130px repeat(${MC_TEXT_BATCH.length}, 1fr)`,
                                        borderTop: di===0 ? 'none' : '1px solid var(--line)' }}>
                <div style={{ padding:'16px 16px', fontWeight:600, fontSize:13, color:'var(--ink)',
                              background:'var(--bg-sunken)' }}>{d.k}</div>
                {d.values.map((v, i) => (
                  <div key={i} style={{ padding:'16px 14px', borderLeft:'1px solid var(--line)',
                                          fontSize:13, lineHeight:1.5, color:'var(--ink-2)' }}>
                    {v}
                  </div>
                ))}
              </div>
            ))}
            {/* Overlap table */}
            <div style={{ borderTop:'1px solid var(--line-strong)', padding:'18px 22px',
                          background:'var(--bg-sunken)' }}>
              <MCEyebrow>话题覆盖矩阵 · ⊙ 核心 · ● 重要 · ○ 未提 · ✗ 回避</MCEyebrow>
              <div style={{ display:'grid', gridTemplateColumns:'1fr repeat(3, 80px) 80px',
                            gap:'4px 12px', marginTop:12, alignItems:'center' }}>
                <div/>
                {MC_TEXT_BATCH.map((t, i) => (
                  <div key={t.id} className="mono" style={{ fontSize:10, color:'var(--ink-3)', textAlign:'center' }}>
                    {String(i+1).padStart(2,'0')}
                  </div>
                ))}
                <div className="mono" style={{ fontSize:10, color:'var(--ink-3)', textAlign:'right' }}>覆盖率</div>
                {MC_TEXT_OVERLAP.map(row => {
                  const symFor = (v) => v === '核心' ? '⊙' : v === '重要' ? '●' : v === '回避' ? '✗' : '○';
                  const colFor = (v) => v === '核心' ? 'var(--accent)'
                                       : v === '重要' ? 'var(--accent-warm)'
                                       : v === '回避' ? 'var(--ink-2)' : 'var(--ink-4)';
                  return (
                    <React.Fragment key={row.topic}>
                      <div style={{ fontSize:13, color:'var(--ink)', padding:'6px 0' }}>{row.topic}</div>
                      {[row.t1, row.t2, row.t3].map((v, i) => (
                        <div key={i} style={{ textAlign:'center', fontFamily:'var(--mono)', fontSize:18,
                                                color:colFor(v), lineHeight:1 }}>
                          {symFor(v)}
                        </div>
                      ))}
                      <div className="mono" style={{ fontSize:11, color:'var(--ink-3)', textAlign:'right' }}>
                        {row.who}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TIMELINE view ── */}
        {view === 'timeline' && (
          <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                        borderRadius:'var(--radius)', padding:'24px 28px' }}>
            <MCEyebrow>发表时间线 · 阅读数据</MCEyebrow>
            <div style={{ marginTop:18, display:'flex', flexDirection:'column', gap:0,
                          position:'relative' }}>
              <div style={{ position:'absolute', left:78, top:14, bottom:14, width:2,
                            background:'var(--line-strong)' }}/>
              {MC_TEXT_TIMELINE.map((row, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'70px 20px 1fr',
                                        gap:14, padding:'14px 0', position:'relative' }}>
                  <div className="mono" style={{ fontSize:11, color:'var(--ink-3)', textAlign:'right',
                                                   paddingTop:3, letterSpacing:'0.04em' }}>
                    {row.date}
                  </div>
                  <div style={{ position:'relative' }}>
                    <div style={{ width:12, height:12, borderRadius:99,
                                   background:'var(--bg-elev)', border:'2px solid var(--ink)',
                                   margin:'4px 4px' }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'var(--ink)' }}>{row.evt}</div>
                    <div style={{ display:'flex', gap:6, marginTop:6 }}>
                      {[row.t1, row.t2, row.t3].map((v, idx) => v && (
                        <span key={idx} className="kw mono" style={{
                          fontSize:10, padding:'2px 7px',
                          background: MCToneFor(MC_TEXT_BATCH[idx].tone), color:'#fff', border:'none',
                        }}>
                          {String(idx+1).padStart(2,'0')} · {v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── REPORT view ── */}
        {view === 'report' && (
          <div style={{ background:'var(--bg-elev)', border:'1px solid var(--line)',
                        borderRadius:'var(--radius-lg)', padding:'40px 56px',
                        maxWidth:780, margin:'0 auto', lineHeight:1.7 }}>
            <MCEyebrow>观点对照报告 · 自动生成 · Claude 4.5</MCEyebrow>
            <h2 style={{ fontFamily:'var(--display)', fontSize:32, margin:'10px 0 22px', lineHeight:1.15 }}>
              三篇评测<span style={{ color:'var(--accent)', fontStyle:'italic' }}>各执一词</span>
            </h2>

            <h3 style={{ fontSize:15, fontWeight:600, margin:'24px 0 8px' }}>① 立场差异</h3>
            <p style={{ fontSize:14, color:'var(--ink-2)', margin:0 }}>
              三篇分别代表了三种截然不同的视角:
              <b>① Pocket 4</b> 是工程师视角的理性中立(信息密度最高),
              <b>② iPhone 17</b> 是发烧友视角的激情推荐(情绪最高),
              <b>③ M11</b> 是文艺中产视角的怀旧保留(信息密度最低但情绪最浓)。
              如果只读一篇,得到的「市场判断」会南辕北辙。
            </p>

            <h3 style={{ fontSize:15, fontWeight:600, margin:'24px 0 8px' }}>② 信息互补</h3>
            <p style={{ fontSize:14, color:'var(--ink-2)', margin:0 }}>
              5 个核心话题中只有 <b>画质 / 动态范围</b> 被两篇同时讨论,
              其余 4 个话题都是某一篇独占。这说明三篇之间几乎没有交叉验证,
              对于读者而言,需要全部读完才能拼出完整的市场画像。
            </p>

            <h3 style={{ fontSize:15, fontWeight:600, margin:'24px 0 8px' }}>③ 行动建议</h3>
            <ul style={{ paddingLeft:22, margin:0, color:'var(--ink-2)', fontSize:14 }}>
              <li>做摄影设备选购决策:① 信息量最大,可作为主参考</li>
              <li>看市场趋势:② 与 ③ 互为对照(消费电子 vs. 奢侈品两种叙事)</li>
              <li>写自己的评测稿时:可以借鉴 ① 的理性框架 + ③ 的情绪结尾</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

window.MultiTextCompare = MultiTextCompare;
