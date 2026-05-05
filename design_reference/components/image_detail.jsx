/* ImageDetail — 图片详情页 · 左原图全尺寸 + 右侧分区面板 (§6.5) */

/* ── Mock data for image analysis ── */
const IMG_ANALYSIS = {
  description: {
    subject:    '一位身着浅色系穿搭的女性，站立于落地窗旁，表情自然放松。',
    scene:      '现代简约风室内空间，背景为城市建筑虚化效果。',
    tones:      '主色：米白 · 莫兰迪粉 · 浅灰；整体色温偏暖，约 5000K。',
    composition:'3/4 身人像，右侧留白构图；焦距等效约 85mm，景深极浅。',
    style:      '日系清新写实风格，略带胶片质感。',
    detail:     '窗帘边缘有柔和的漫射光晕；人物左侧耳环为银色小圆片。',
  },
  ocr: '无可识别文字内容',
  inference: {
    usage:    '品牌形象片 / 小红书穿搭 Lookbook / 电商主图备选',
    audience: '18–30 岁城市女性，追求自然与质感生活方式',
    intent:   '传递「轻生活·高质感」视觉理念，弱化商品属性，强化情绪共鸣',
    insight:  '同类竞品多采用户外场景；室内窗光构图在该品类中属差异化打法',
  },
  exif: {
    device:   'Canon EOS R5',
    lens:     'RF 85mm f/1.2 L',
    shutter:  '1/200s',
    iso:      'ISO 100',
    aperture: 'f/1.4',
    location: '上海 · 徐汇区',
    date:     '2026-03-18 14:22',
  },
  prompts: {
    mj: 'young asian woman standing near window, soft natural light, moody interior, 85mm portrait, shallow DOF, film grain, warm tones, clean background, --ar 4:5 --style raw --s 250',
    sd: 'young asian woman by window, soft daylight, moody interior, 85mm f/1.4, bokeh background, film grain, Kodak Portra 400, warm tones',
    json: null, // will be generated dynamically
  },
  tags: ['portrait', 'window light', 'warm tones', 'shallow DOF', 'film grain', 'indoor'],
};

/* ── Collapsible section ── */
const IDSection = ({ title, icon: Ic, children, defaultOpen = true }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <button onClick={() => setOpen(o => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                       padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer',
                       color: 'var(--ink-2)' }}>
        {Ic && <Ic size={14}/>}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
                        textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>{title}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
             style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4"/>
        </svg>
      </button>
      {open && <div style={{ padding: '0 18px 14px' }}>{children}</div>}
    </div>
  );
};

/* ── Key-value row ── */
const KVRow = ({ label, value, mono = false }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, padding: '4px 0',
                fontSize: 13, lineHeight: 1.5 }}>
    <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--mono)', fontSize: 11 }}>{label}</span>
    <span style={{ color: 'var(--ink-2)', fontFamily: mono ? 'var(--mono)' : 'inherit', fontSize: mono ? 11 : 13 }}>{value}</span>
  </div>
);

/* ═══════════════════════════════════════════
   ImageDetail
   ═══════════════════════════════════════════ */
const ImageDetail = ({ material, onBack }) => {
  const [promptStyle, setPromptStyle] = React.useState('mj');
  const [copied, setCopied]     = React.useState(false);
  const [favored, setFavored]   = React.useState(false);
  const [activeImg, setActiveImg] = React.useState(3); // thumb index

  const frame = VM_DATA.FRAMES[activeImg];

  const promptText = promptStyle === 'json'
    ? JSON.stringify({
        file: material?.title || '海边日落参考图',
        prompt_mj: IMG_ANALYSIS.prompts.mj,
        prompt_sd: IMG_ANALYSIS.prompts.sd,
        tags: IMG_ANALYSIS.tags,
        description: IMG_ANALYSIS.description,
      }, null, 2)
    : (promptStyle === 'sd' ? IMG_ANALYSIS.prompts.sd : IMG_ANALYSIS.prompts.mj);

  const handleCopy = () => {
    navigator.clipboard?.writeText(promptText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  /* Mock multi-image batch (reuse FRAMES as stand-ins) */
  const batchImages = [3, 7, 5, 0, 4];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', height: '100%', overflow: 'hidden' }}>

      {/* ════════ LEFT: Image viewer ════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-sunken)' }}>

        {/* Nav bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                      borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-elev)' }}>
          <button className="btn btn-ghost" onClick={onBack}
                  style={{ height: 28, padding: '0 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcArrowRight size={13} style={{ transform: 'rotate(180deg)' }}/> 任务中心
          </button>
          <span style={{ width: 1, height: 16, background: 'var(--line)' }}/>
          <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {material?.title || '海边日落参考图 · 9张'}
          </span>
          <span className="kw mono" style={{ fontSize: 10 }}>IMAGE · {batchImages.length} 张</span>
          <button className="btn btn-ghost" style={{ height: 28, padding: '0 10px', fontSize: 12 }}>
            <IcDownload size={13}/> OCR .txt
          </button>
        </div>

        {/* Main image display */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 24, overflow: 'hidden' }}>
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', borderRadius: 16, overflow: 'hidden',
                        boxShadow: 'var(--shadow-lg)' }}>
            <img src={`assets/frame_${frame.ts.replace(/:/g, '_')}.svg`}
                 style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 220px)', objectFit: 'contain' }}/>
            {/* Tag overlay */}
            <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 5 }}>
              {IMG_ANALYSIS.tags.slice(0, 3).map(t => (
                <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 99,
                                        background: 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: 'var(--mono)' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Thumbnail strip (multi-image batch) */}
        <div style={{ flexShrink: 0, padding: '10px 20px 14px', borderTop: '1px solid var(--line)', background: 'var(--bg-elev)' }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {batchImages.map((fi, i) => {
              const f = VM_DATA.FRAMES[fi];
              return (
                <div key={i} onClick={() => setActiveImg(fi)}
                     style={{ flexShrink: 0, width: 72, borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                               border: `2px solid ${fi === activeImg ? 'var(--accent)' : 'transparent'}`,
                               transition: 'border-color 140ms' }}>
                  <img src={`assets/frame_${f.ts.replace(/:/g, '_')}.svg`}
                       style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}/>
                </div>
              );
            })}
            <div style={{ flexShrink: 0, width: 72, borderRadius: 8, border: '2px dashed var(--line-strong)',
                          display: 'grid', placeItems: 'center', cursor: 'pointer', aspectRatio: '16/9' }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>+4</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════ RIGHT: Analysis panel ════════ */}
      <div style={{ borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
                    background: 'var(--bg-elev)', overflow: 'hidden' }}>

        {/* Prompt section (sticky top) */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px',
                        background: 'var(--bg-sunken)', borderBottom: '1px solid var(--line)' }}>
            <IcTag size={13} style={{ color: 'var(--accent)' }}/>
            <span className="eyebrow" style={{ flex: 1 }}>画面提示词</span>
            {['mj', 'sd', 'json'].map(s => (
              <button key={s} onClick={() => setPromptStyle(s)}
                      style={{ height: 24, padding: '0 9px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                               fontFamily: 'var(--mono)', border: 'none', cursor: 'pointer',
                               background: promptStyle === s ? 'var(--ink)' : 'transparent',
                               color: promptStyle === s ? 'var(--bg)' : 'var(--ink-3)' }}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.7,
                          background: 'var(--bg-sunken)', padding: '10px 12px', borderRadius: 10,
                          border: '1px solid var(--line)', color: 'var(--ink)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          maxHeight: 120, overflowY: 'auto' }}>
              {promptText}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={handleCopy}
                      style={{ flex: 1, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600,
                               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                               cursor: 'pointer', border: 'none', background: 'var(--ink)', color: 'var(--bg)' }}>
                {copied ? <IcCheck size={13}/> : <IcDownload size={13}/>}
                {copied ? '已复制' : '复制提示词'}
              </button>
              <button onClick={() => setFavored(f => !f)}
                      style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)',
                               display: 'grid', placeItems: 'center', cursor: 'pointer',
                               background: favored ? 'rgba(255,184,76,0.1)' : 'var(--bg-sunken)' }}>
                <IcStar size={14} style={{
                  fill:  favored ? 'var(--accent-warm)' : 'none',
                  color: favored ? 'var(--accent-warm)' : 'var(--ink-3)',
                }}/>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable analysis sections */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* 内容识别描述 */}
          <IDSection title="内容识别描述" icon={IcEye}>
            <KVRow label="主体" value={IMG_ANALYSIS.description.subject}/>
            <KVRow label="场景" value={IMG_ANALYSIS.description.scene}/>
            <KVRow label="色调" value={IMG_ANALYSIS.description.tones}/>
            <KVRow label="构图" value={IMG_ANALYSIS.description.composition}/>
            <KVRow label="风格" value={IMG_ANALYSIS.description.style}/>
            <KVRow label="细节" value={IMG_ANALYSIS.description.detail}/>
          </IDSection>

          {/* OCR */}
          <IDSection title="OCR 文字提取" icon={IcDoc} defaultOpen={false}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)',
                          padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 8 }}>
              {IMG_ANALYSIS.ocr}
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 8, height: 28, fontSize: 11 }}>
              <IcDownload size={12}/> 导出 .txt
            </button>
          </IDSection>

          {/* 联想总结 */}
          <IDSection title="内容联想总结" icon={IcSpark}>
            <KVRow label="用途推断" value={IMG_ANALYSIS.inference.usage}/>
            <KVRow label="目标受众" value={IMG_ANALYSIS.inference.audience}/>
            <KVRow label="设计意图" value={IMG_ANALYSIS.inference.intent}/>
            <KVRow label="竞品洞察" value={IMG_ANALYSIS.inference.insight}/>
          </IDSection>

          {/* EXIF */}
          <IDSection title="EXIF 拍摄信息" icon={IcCpu} defaultOpen={false}>
            <KVRow label="设备" value={IMG_ANALYSIS.exif.device}/>
            <KVRow label="镜头" value={IMG_ANALYSIS.exif.lens} mono/>
            <KVRow label="快门" value={IMG_ANALYSIS.exif.shutter} mono/>
            <KVRow label="ISO" value={IMG_ANALYSIS.exif.iso} mono/>
            <KVRow label="光圈" value={IMG_ANALYSIS.exif.aperture} mono/>
            <KVRow label="地点" value={IMG_ANALYSIS.exif.location}/>
            <KVRow label="时间" value={IMG_ANALYSIS.exif.date} mono/>
          </IDSection>

        </div>
      </div>
    </div>
  );
};

window.ImageDetail = ImageDetail;
