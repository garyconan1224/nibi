/* VidMirror — sample data for DJI Pocket 4 video */
(function(){
  const FRAMES = [
    { ts:'00:00:00', sec:0,  bg:'#0a0a0a', title:'产品主视觉', subtitle:'Pocket 4 on tripod', tag:'特写', scene:'A' },
    { ts:'00:00:02', sec:2,  bg:'#0d0d14', title:'四代同堂', subtitle:'Pocket 1·2·3·4 并排', tag:'对比', scene:'A' },
    { ts:'00:00:12', sec:12, bg:'#0f1729', title:'主持人入镜', subtitle:'"我是非常困惑的"', tag:'访谈', scene:'B' },
    { ts:'00:00:22', sec:22, bg:'#050505', title:'背部模组', subtitle:'三镜头 · 碳纤纹理', tag:'细节', scene:'B' },
    { ts:'00:01:32', sec:92, bg:'#1a0a2e', title:'H 霓虹灯', subtitle:'品牌调性符号', tag:'氛围', scene:'C' },
    { ts:'00:01:42', sec:102,bg:'#0a1a2a', title:'拍摄界面', subtitle:'4K · 8K · ProRes', tag:'UI', scene:'C' },
    { ts:'00:03:30', sec:210,bg:'#0b1018', title:'Pocket 3 vs 4', subtitle:'分屏对比 · 动态范围', tag:'对比', scene:'D' },
    { ts:'00:05:54', sec:354,bg:'#2a1a0a', title:'海滩日落', subtitle:'情感化实拍', tag:'实拍', scene:'E' },
  ];

  const TRANSCRIPT = [
    { t:'00:00:02', text:'大家好，我是Hugo，今天我们来聊聊大疆刚刚发布的Pocket 4。' },
    { t:'00:00:12', text:'说实话第一次看到它的时候，我是非常困惑的。' },
    { t:'00:00:22', text:'因为从外观上看，Pocket 4相比三代的变化几乎肉眼可辨——但又说不出到底哪里不一样。' },
    { t:'00:00:40', text:'直到我把它和前三代摆在一起——这种"一脉相承的进化"才真正清晰起来。' },
    { t:'00:01:02', text:'最核心的升级其实藏在镜头和算法里：全新的1英寸大底、D-Log M 色彩模式。' },
    { t:'00:01:32', text:'画面一打灯，你就能感受到品牌想要传递的专业氛围。' },
    { t:'00:01:42', text:'录制选项里多了 Apple ProRes RAW HQ——这意味着后期空间更大。' },
    { t:'00:02:20', text:'三代已经封神，那么四代到底带来了什么？答案是：细节。' },
    { t:'00:02:48', text:'屏幕更亮、追踪更准、续航更稳。每一点都不惊艳，但加起来就是质变。' },
    { t:'00:03:30', text:'我们同时用 Pocket 3 和 Pocket 4 拍了同一个场景。右边 Pocket 4 的高光细节明显更丰富。' },
    { t:'00:04:12', text:'在户外强光下，它几乎没有出现三代上偶尔会有的过曝问题。' },
    { t:'00:05:00', text:'如果你是内容创作者，Pocket 4 值得升级吗？我的答案是——要看你拍什么。' },
    { t:'00:05:54', text:'但如果你像我一样喜欢在海边、在街头抓拍日常——它确实是目前最趁手的那一个。' },
  ];

  const NOTES_MD = `
## 核心观点

这期视频用**"四代同堂"**的对比开场，并不急着展示 Pocket 4 的参数升级，而是先让观众感受设计语言的延续性。这是一种**情感式评测**——先建立共鸣，再谈技术。

## 结构拆解

### 1. 产品开箱（0:00 – 0:40）
- 黑底 + 白色几何线条的极简布景
- 四代并排构图，暗示迭代逻辑
- 少量红色点缀（Pocket 3 红标）

### 2. 外观与握持（0:40 – 1:30）
- 大量特写聚焦镜头模组、金属装饰
- 手持视角展示便携性
- 碳纤维纹理的触觉暗示

### 3. 核心升级（1:30 – 3:00）
- 1 英寸大底
- **D-Log M** 色彩模式
- Apple ProRes RAW HQ 录制
- 霓虹"H"——主持人个人品牌符号

### 4. 实拍对比（3:00 – 5:00）
- 分屏：Pocket 3 vs Pocket 4
- 强调高光细节、动态范围
- 户外抓拍 · 海滩 · 城市夜景

### 5. 购买建议（5:00 – 6:30）
- 情感化收尾：家庭、日常、记录
- 不追求"炸裂卖点"，强调"日常够用"

## 关键词

> 便携专业 · 迭代进化 · 日常记录 · 画质升级 · 1英寸大底 · D-Log M · ProRes RAW

## AI 建议

基于转录与视觉分析，这条视频可以拆出**3 条短视频切片**：
1. "4 代同堂"对比（0:00–0:40，30s 适合抖音）
2. 画质实拍对比（3:00–4:12，适合 B 站切片）
3. 购买建议口播（5:00–6:30，适合小红书图文）
`;

  const STORYBOARD = {
    A: {
      name: '情感·日常',
      desc: '弱卖点，重生活',
      tagline: '口播 + 实拍，B 站原味',
      hook: '以"四代同堂"的产品对比开场，把观众拉进一个设计迭代的故事里——用日常语气讲专业产品。',
      shots: [
        { num:'01', ts:'0:00', dur:'0:04', title:'开场：四代并排', desc:'Pocket 1·2·3·4 横向排列，暗色背景，白色辉光。', vo:'从一代到四代，这条线一直没断过。', frame:0 },
        { num:'02', ts:'0:04', dur:'0:08', title:'主持人入镜', desc:'半侧身，面向镜头，霓虹 H 背景。', vo:'说实话，第一眼我是困惑的。', frame:2 },
        { num:'03', ts:'0:12', dur:'0:10', title:'产品特写', desc:'三脚架上的 Pocket 4，侧光打亮纹理。', vo:'但当我把它拿起来——一切都通了。', frame:3 },
        { num:'04', ts:'0:22', dur:'0:14', title:'海滩实拍', desc:'日落，手持，自然光。', vo:'它让你愿意带出门。', frame:7 },
        { num:'05', ts:'0:36', dur:'0:08', title:'收尾', desc:'手持视角，环境虚化。', vo:'四代，不炸裂。但——够用。', frame:5 },
      ],
    },
    B: {
      name: '参数·对比',
      desc: '数码党首选',
      tagline: '技术控剪辑，适合男频',
      hook: '不讲故事，直接上参数和 A/B 对比——把 Pocket 3 和 4 按在同一帧里。',
      shots: [
        { num:'01', ts:'0:00', dur:'0:03', title:'硬切参数卡', desc:'全黑背景 + 大字：1英寸 / D-Log M / ProRes RAW。', vo:'三个升级。记住。', frame:5 },
        { num:'02', ts:'0:03', dur:'0:08', title:'分屏对比', desc:'左 Pocket 3，右 Pocket 4，同场景。', vo:'高光保留，Pocket 4 胜。', frame:6 },
        { num:'03', ts:'0:11', dur:'0:10', title:'ProRes 菜单', desc:'屏幕特写，手指点击 Apple ProRes RAW HQ。', vo:'后期空间直接拉满。', frame:5 },
        { num:'04', ts:'0:21', dur:'0:12', title:'实拍合集', desc:'城市夜景、海滩、霓虹。', vo:'不解释了，看画面。', frame:4 },
        { num:'05', ts:'0:33', dur:'0:06', title:'结论卡', desc:'白字黑底："值得。"', vo:'值得。', frame:0 },
      ],
    },
    C: {
      name: '反转·脱口秀',
      desc: '高完播率',
      tagline: '抖音 / 小红书 30s 切片',
      hook: '以"这代我不买"作为钩子开场，中间翻车翻盘，最后以"真香"作结。',
      shots: [
        { num:'01', ts:'0:00', dur:'0:03', title:'钩子', desc:'大字幕："这代我真的不想买。"', vo:'Pocket 4？我一开始是不想买的。', frame:2 },
        { num:'02', ts:'0:03', dur:'0:05', title:'槽点一：外观', desc:'四代并排，画外音吐槽。', vo:'长得跟三代几乎一样。', frame:1 },
        { num:'03', ts:'0:08', dur:'0:07', title:'转折：上手', desc:'手持实拍，镜头摇过海滩。', vo:'直到我把它拿出门——', frame:7 },
        { num:'04', ts:'0:15', dur:'0:10', title:'翻盘：画质', desc:'Pocket 3 vs 4 分屏。', vo:'这高光，这动态范围……我改口了。', frame:6 },
        { num:'05', ts:'0:25', dur:'0:05', title:'真香收尾', desc:'产品特写 + 大字幕："真香。"', vo:'真香。', frame:3 },
      ],
    },
  };

  const TASKS = [
    { id:'a1', title:'三代封神！那四代呢？大疆Pocket 4首发体验', src:'bilibili.com/BV1abc', type:'note', state:'running', progress:42, thumb:0 },
    { id:'a2', title:'iPhone 17 Pro 上手：换了胶水的相机', src:'youtube.com/shorts/xYz', type:'analyze', state:'queued', progress:0, thumb:1 },
    { id:'a3', title:'Sora 2 首发测评：100 个提示词全部实测', src:'bilibili.com/BV2def', type:'storyboard', state:'done', progress:100, thumb:4 },
    { id:'a4', title:'雷总 Xiaomi 15 Ultra 演讲完整复盘', src:'bilibili.com/BV3ghi', type:'note', state:'done', progress:100, thumb:3 },
    { id:'a5', title:'徕卡 M11 两年用后感', src:'youtube.com/watch?v=abc', type:'analyze', state:'error', progress:38, thumb:6 },
    { id:'a6', title:'DJI Osmo Action 6 实战：骑行 vs 摩托 vs 雪道', src:'bilibili.com/BV4jkl', type:'note', state:'done', progress:100, thumb:7 },
    { id:'a7', title:'Canon R5 Mark II 开箱', src:'youtube.com/watch?v=xyz', type:'storyboard', state:'queued', progress:0, thumb:2 },
  ];

  const EXAMPLES = [
    { title:'Sora 2 首发测评', sub:'BILIBILI · 12:34', thumb:4 },
    { title:'Xiaomi 15 Ultra 演讲复盘', sub:'BILIBILI · 38:02', thumb:3 },
    { title:'徕卡 M11 两年后', sub:'YOUTUBE · 18:50', thumb:6 },
    { title:'Canon R5 II 开箱', sub:'YOUTUBE · 09:14', thumb:2 },
  ];

  // ─── v2.1: Materials per task (video/audio/image/text) ───
  const MATERIALS = [
    { id:'m1', type:'video',  title:'大疆 Pocket 4 首发体验',          source:'bilibili.com/BV1abc',       meta:'6:42 · 1080p · 387MB',   state:'done',    thumb:0, tags:['产品开箱','对比','cinematic'] },
    { id:'m2', type:'video',  title:'iPhone 17 Pro 上手',               source:'youtube.com/xYz',           meta:'4:12 · 4K · 612MB',      state:'done',    thumb:1, tags:['特写','warm tones'] },
    { id:'m3', type:'image',  title:'海边日落参考图 · 9张',              source:'uploads/sunset_batch',     meta:'JPEG · 9图 · 34.2MB',    state:'done',    thumb:7, tags:['golden hour','海滩','portrait'] },
    { id:'m4', type:'audio',  title:'背景乐参考 · Lo-Fi · City Pop',    source:'uploads/music_ref.mp3',     meta:'3:41 · 128kbps',         state:'done',    thumb:4, tags:['lo-fi','92 BPM','Cmaj'] },
    { id:'m5', type:'video',  title:'Sora 2 测评 · 100个提示词',         source:'bilibili.com/BV2def',       meta:'12:34 · 1080p',          state:'running',progress:67, thumb:4, tags:['AI视频','蒙太奇'] },
    { id:'m6', type:'image',  title:'霓虹街拍灵感 · Pinterest',         source:'pinterest.com/pin/48273',   meta:'PNG · 12图',             state:'done',    thumb:5, tags:['neon','赛博朋克','night'] },
    { id:'m7', type:'text',   title:'三明治拍摄脚本参考',                source:'uploads/script_draft.md',   meta:'MD · 1,842字',           state:'done',    thumb:2, tags:['脚本','旁白'] },
    { id:'m8', type:'video',  title:'影视飓风：运镜十招',                source:'bilibili.com/BV5mno',       meta:'18:20 · 4K',             state:'queued', progress:0,  thumb:6, tags:[] },
  ];

  // ─── Prompt tag library (auto-classified by dimension) ───
  const TAG_LIB = {
    '风格': [
      { tag:'cinematic',  count:12, auto:true,  from:['m1','m2','m3','m5'] },
      { tag:'portrait',   count:7,  auto:true,  from:['m2','m3','m6'] },
      { tag:'documentary',count:4,  auto:false, from:['m1','m5'] },
      { tag:'neon',       count:6,  auto:true,  from:['m6'] },
    ],
    '光线': [
      { tag:'golden hour',   count:9, auto:true, from:['m3','m1'] },
      { tag:'backlight',     count:5, auto:true, from:['m1','m3'] },
      { tag:'studio light',  count:3, auto:true, from:['m1'] },
      { tag:'neon glow',     count:6, auto:true, from:['m6'] },
    ],
    '构图': [
      { tag:'close-up',      count:11, auto:true, from:['m1','m2','m3'] },
      { tag:'wide shot',     count:6,  auto:true, from:['m3','m5'] },
      { tag:"bird's eye",    count:2,  auto:true, from:['m5'] },
      { tag:'split-screen',  count:3,  auto:false,from:['m1'] },
    ],
    '色调': [
      { tag:'warm tones',    count:10, auto:true, from:['m1','m2','m3'] },
      { tag:'desaturated',   count:4,  auto:true, from:['m5'] },
      { tag:'high contrast', count:7,  auto:true, from:['m1','m6'] },
    ],
    '镜头': [
      { tag:'bokeh',         count:8, auto:true, from:['m1','m2','m3'] },
      { tag:'motion blur',   count:3, auto:true, from:['m5'] },
      { tag:'handheld',      count:5, auto:false,from:['m1'] },
    ],
  };

  // ─── Favorites (参考帧收藏夹 · 复刻清单) ───
  const FAVORITES = [
    { id:'f1', material:'m1', ts:'00:00:02', thumb:0, note:'开场调性参考',     prompt:'DJI Pocket 4 on tripod, black backdrop, rim light, carbon fiber texture, product photography, cinematic, --ar 16:9' },
    { id:'f2', material:'m1', ts:'00:01:32', thumb:4, note:'霓虹 H 做转场',    prompt:'neon letter H sign, purple magenta glow, bokeh, cyberpunk vibe, ultra-wide, 35mm, --ar 16:9 --style raw' },
    { id:'f3', material:'m1', ts:'00:05:54', thumb:7, note:'结尾情感化镜头',   prompt:'woman walking on beach at sunset, backlit, silhouette, warm tones, shallow depth of field, hasselblad, film grain, --ar 16:9' },
    { id:'f4', material:'m3', ts:'img_004',  thumb:3, note:'色调样板',        prompt:'desaturated warm portrait, window light, 85mm f/1.4, shot on Kodak Portra 400, editorial, --ar 4:5' },
    { id:'f5', material:'m6', ts:'img_002',  thumb:5, note:'参考夜景氛围',     prompt:'tokyo alley at night, neon signs, rain puddle reflection, 35mm, anamorphic lens flare, blade runner mood, --ar 21:9' },
  ];

  // ─── Prompt version history (one anchor prompt, 3 versions) ───
  const PROMPT_VERSIONS = [
    { v:'v1', at:'2026-04-22 14:02', note:'初稿 · 从 f2 自动生成',           by:'auto', text:'neon letter H sign, purple glow, cyberpunk, bokeh, --ar 16:9' },
    { v:'v2', at:'2026-04-22 14:18', note:'加入镜头与调色规格',               by:'you',  text:'neon letter H sign, purple magenta glow, bokeh, cyberpunk, shot on anamorphic lens, 2.39:1, teal + magenta palette, --ar 21:9 --style raw' },
    { v:'v3', at:'2026-04-22 16:41', note:'试生成3张后微调,强化雾气',         by:'you',  text:'neon letter H sign, purple magenta glow, bokeh, cyberpunk alley, anamorphic lens flare, volumetric fog, teal + magenta, wet asphalt, blade runner mood, --ar 21:9 --style raw --s 250', active:true },
  ];

  // ─── Creator style report (auto-generated after N≥5 materials) ───
  const STYLE_REPORT = {
    author:'影视飓风 · Hugo',
    materials: 8,
    generated:'2026-04-24 09:11',
    wordcloud: [
      { w:'cinematic',   size:36 },{ w:'warm tones',   size:30 },{ w:'close-up', size:28 },
      { w:'bokeh',       size:26 },{ w:'golden hour',  size:24 },{ w:'portrait', size:22 },
      { w:'35mm',        size:20 },{ w:'handheld',     size:18 },{ w:'backlight',size:18 },
      { w:'split-screen',size:16 },{ w:'neon',         size:16 },{ w:'desaturated',size:14 },
      { w:'low angle',   size:14 },{ w:'shallow DOF',  size:13 },{ w:'film grain',size:12 },
    ],
    palette: ['#2A1812','#F4B987','#8A3A2C','#E8DCC4','#1B2840','#C2724A'],
    shots: { 近景:48, 中景:28, 远景:14, 航拍:6, 特写:24 },
    music: { bpm:'88–104', keys:['Cmaj','Amin'], genres:['lo-fi','city pop','ambient'] },
    advice: [
      '复刻时优先用 85mm+ 长焦营造浅景深',
      '色调参考: 暖调 + 高光偏橙 + 暗部轻青',
      '音乐 BPM 锁定 90 ± 10',
      '开场采用"产品并排"的对比叙事结构',
    ],
  };

  // ─── Compare report (original vs generated) ───
  const COMPARE = {
    precision:'构图细节对比',
    score:78,
    reference:{ thumb:0, label:'f1 · 00:00:02 · 开场调性' },
    generated:{ thumb:5, label:'MJ v6 · 生成 4 次后' },
    deltas:[
      { dim:'整体风格',  match:92, note:'调性一致,产品摄影氛围到位' },
      { dim:'构图',      match:74, note:'主体偏左 30% ,原作居中' },
      { dim:'光线',      match:81, note:'侧光方向正确,但高光过曝 1/3EV' },
      { dim:'色调',      match:69, note:'暖调偏橙,原作更偏琥珀' },
      { dim:'细节',      match:65, note:'碳纤纹理缺失,产品反光过强' },
    ],
    suggestions:[
      '加入 "centered composition, dead center" 修正主体位置',
      '降低光圈描述 "f/5.6" 替代 "f/2.8" 以收回高光',
      '在 prompt 末尾追加 "amber highlights, carbon fiber detail visible"',
    ],
  };

  // ─── Background / task config ───
  const TASK_CONFIG = {
    name:'影视飓风 · Pocket 4 复刻',
    contentType:'宣传片',
    people:'Hugo · 影视飓风',
    background:'Q2 数码产品开箱评测 · 目标抖音切片',
    terms:'Pocket 4, D-Log M, ProRes RAW, 1英寸大底',
    purpose:'复刻参考',
  };

  window.VM_DATA = { FRAMES, TRANSCRIPT, NOTES_MD, STORYBOARD, TASKS, EXAMPLES, MATERIALS, TAG_LIB, FAVORITES, PROMPT_VERSIONS, STYLE_REPORT, COMPARE, TASK_CONFIG };
})();
