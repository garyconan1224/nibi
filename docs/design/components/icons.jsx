/* VidMirror — icons + logo. Stroke-based 18–20px. */

const Icon = ({ d, size = 18, fill = 'none', stroke = 'currentColor', sw = 1.7, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children || <path d={d} />}
  </svg>
);
const IcHome = (p) => <Icon {...p}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/></Icon>;
const IcSpark = (p) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></Icon>;
const IcLibrary = (p) => <Icon {...p}><rect x="3" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M18 5l3 15"/></Icon>;
const IcClap = (p) => <Icon {...p}><path d="M4 9l16-4 1 5L5 14z"/><path d="M5 14v6h14v-8"/><path d="M8 7l1 3M13 6l1 3"/></Icon>;
const IcTree = (p) => <Icon {...p}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M6 8v4h12V8M12 12v4"/></Icon>;
const IcSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>;
const IcLink = (p) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></Icon>;
const IcUpload = (p) => <Icon {...p}><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></Icon>;
const IcPlay = (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M7 5v14l12-7z"/></Icon>;
const IcArrowRight = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>;
const IcDownload = (p) => <Icon {...p}><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></Icon>;
const IcEye = (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>;
const IcMic = (p) => <Icon {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></Icon>;
const IcCpu = (p) => <Icon {...p}><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></Icon>;
const IcWand = (p) => <Icon {...p}><path d="M15 4l5 5-11 11-5-5z"/><path d="M14 5l5 5"/><path d="M19 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></Icon>;
const IcText = (p) => <Icon {...p}><path d="M4 6h16M6 12h12M8 18h8"/></Icon>;
const IcCheck = (p) => <Icon {...p}><path d="M5 12l4 4 10-10"/></Icon>;
const IcX = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>;
const IcBolt = (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></Icon>;
const IcGrid = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Icon>;
const IcList = (p) => <Icon {...p}><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></Icon>;
const IcSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></Icon>;
const IcMoon = (p) => <Icon {...p}><path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/></Icon>;
const IcSun = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></Icon>;
const IcGlobe = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></Icon>;
const IcFilm = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 8h4M17 8h4M3 12h4M17 12h4M3 16h4M17 16h4"/></Icon>;
const IcSend = (p) => <Icon {...p} fill="currentColor" stroke="none"><path d="M3 11l18-8-8 18-2-8z"/></Icon>;
const IcSliders = (p) => <Icon {...p}><path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></Icon>;
const IcShare = (p) => <Icon {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.5 10.5l7-4M8.5 13.5l7 4"/></Icon>;
const IcEdit = (p) => <Icon {...p}><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/></Icon>;
const IcLayers = (p) => <Icon {...p}><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 18l9 5 9-5"/></Icon>;
const IcImage = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></Icon>;
const IcDoc = (p) => <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></Icon>;
const IcMusic = (p) => <Icon {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Icon>;
const IcPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
const IcStar = (p) => <Icon {...p}><path d="M12 2l3 7 7 .6-5.3 4.8L18 22l-6-3.7L6 22l1.3-7.6L2 9.6 9 9z"/></Icon>;
const IcTag = (p) => <Icon {...p}><path d="M3 12l9-9h8v8l-9 9z"/><circle cx="15" cy="9" r="1.5" fill="currentColor"/></Icon>;
const IcCompare = (p) => <Icon {...p}><path d="M12 3v18M5 7l-2 2 2 2M19 15l2 2-2 2M3 9h6M15 17h6"/></Icon>;
const IcArchive = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/></Icon>;
const IcClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;

const LogoMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <defs>
      <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FF4D7E"/>
        <stop offset="0.55" stopColor="#B84CFF"/>
        <stop offset="1" stopColor="#3C77FB"/>
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="12" fill="url(#lm-g)"/>
    <path d="M14 14 L24 34 L34 14" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="24" cy="24" r="3" fill="#fff"/>
  </svg>
);

Object.assign(window, {
  Icon, IcHome, IcSpark, IcLibrary, IcClap, IcTree, IcSettings, IcLink, IcUpload,
  IcPlay, IcArrowRight, IcDownload, IcEye, IcMic, IcCpu, IcWand,
  IcText, IcCheck, IcX, IcBolt, IcGrid, IcList, IcSearch, IcMoon, IcSun,
  IcGlobe, IcFilm, IcSend, IcSliders, IcShare, IcEdit, IcLayers, LogoMark,
  IcImage, IcDoc, IcMusic, IcPlus, IcStar, IcTag, IcCompare, IcArchive, IcClock,
});
