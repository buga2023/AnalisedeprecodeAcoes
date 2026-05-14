// system.jsx — Praxia design tokens, icons, mock data, helpers
// Shared across prototype + variations.

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────
const PraxiaTokens = {
  // Backgrounds (deep navy gradient stack)
  bg: '#05071a',          // base canvas
  bgDeep: '#020314',      // edge / vignette
  surface: '#0d1330',     // raised card
  surface2: '#161e44',    // hover / elevated
  surfaceInk: 'rgba(255,255,255,0.04)',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineStrong: 'rgba(255,255,255,0.14)',

  // Text
  ink: '#ffffff',
  ink70: 'rgba(255,255,255,0.72)',
  ink50: 'rgba(255,255,255,0.52)',
  ink30: 'rgba(255,255,255,0.32)',

  // Semantic
  up: '#42e8a3',
  down: '#ff6b81',
  warn: '#ffc857',

  // Accent (overridable via Tweaks)
  accent: '#5b7cff',
  accentSoft: 'rgba(91,124,255,0.18)',
  accentGlow: 'rgba(91,124,255,0.45)',

  // Type
  display: '"Sora", system-ui, sans-serif',
  body: '"Manrope", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

// Build accent variants from a hue choice
function accentSet(hex) {
  // Convert hex to rgb
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return {
    accent: hex,
    accentSoft: `rgba(${r},${g},${b},0.16)`,
    accentSofter: `rgba(${r},${g},${b},0.08)`,
    accentGlow: `rgba(${r},${g},${b},0.5)`,
    accentDeep: `rgba(${r},${g},${b},0.85)`,
  };
}

// Background ambient — soft navy radial glows
function PraxiaBackground({ children, accent = PraxiaTokens.accent, style = {} }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(120% 60% at 80% -10%, ${accent.replace(')', ',0.22)').replace('rgb', 'rgba')} 0%, transparent 55%),
        radial-gradient(80% 50% at -10% 30%, rgba(80, 60, 200, 0.18) 0%, transparent 60%),
        radial-gradient(100% 70% at 50% 110%, rgba(20, 30, 80, 0.55) 0%, transparent 65%),
        linear-gradient(180deg, #05071a 0%, #03051a 50%, #020314 100%)
      `,
      overflow: 'hidden',
      ...style,
    }}>
      {/* subtle grid texture */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
      }} />
      {/* film grain */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5, mixBlendMode: 'overlay',
        background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>")`,
      }} />
      {children}
    </div>
  );
}

// Glass card surface
function PraxiaCard({ children, style = {}, raised = false, padding = 16, accent = PraxiaTokens.accent }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 22, padding,
      background: raised
        ? `linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)`
        : `linear-gradient(160deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)`,
      border: `0.5px solid ${PraxiaTokens.hairline}`,
      boxShadow: raised
        ? `0 24px 50px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`
        : `inset 0 1px 0 rgba(255,255,255,0.04)`,
      backdropFilter: 'blur(12px) saturate(140%)',
      WebkitBackdropFilter: 'blur(12px) saturate(140%)',
      ...style,
    }}>{children}</div>
  );
}

// ─── ICONS ────────────────────────────────────────────────────────────────
// Hand-crafted lucide-ish 1.5 stroke icons
const Icon = {
  home: (s=20, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-3v-7h-8v7H5a2 2 0 0 1-2-2v-9z"/></svg>
  ),
  market: (s=20, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l5-5 4 4 8-9"/><path d="M14 7h6v6"/></svg>
  ),
  activity: (s=20, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>
  ),
  profile: (s=20, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>
  ),
  bell: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
  ),
  menu: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
  ),
  search: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  ),
  plus: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
  ),
  send: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
  ),
  close: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
  ),
  arrowUp: (s=12, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3-4 3 4"/></svg>
  ),
  arrowDown: (s=12, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 4 3 4 3-4"/></svg>
  ),
  spark: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/></svg>
  ),
  chat: (s=20, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-12 7l-5 2 2-5a8 8 0 1 1 15-4z"/></svg>
  ),
  invest: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 16V8m4 8V5m4 11V11m4 5V8m4 8v-3"/></svg>
  ),
  funds: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9m0 0h5"/></svg>
  ),
  withdraw: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14"/></svg>
  ),
  filter: (s=16, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M6 12h12M10 18h4"/></svg>
  ),
  shield: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/></svg>
  ),
  trend: (s=18, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17 9 11l4 4 8-8"/><path d="M14 7h7v7"/></svg>
  ),
  star: (s=16, c='currentColor', fill='none') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 9 10l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z"/></svg>
  ),
  share: (s=16, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4M12 2v14"/></svg>
  ),
  dots: (s=16, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
  ),
  check: (s=16, c='currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>
  ),
  // Pra avatar — circular "P" with spark dot (matches app logo DNA)
  praMark: (s=22, c='#fff', accent='#5b7cff') => {
    const gid = 'pra-g-' + accent.replace('#','');
    const sid = 'pra-s-' + accent.replace('#','');
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
        <defs>
          <radialGradient id={gid} cx="0.32" cy="0.28" r="0.95">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85"/>
            <stop offset="38%" stopColor={accent} stopOpacity="1"/>
            <stop offset="100%" stopColor={accent} stopOpacity="0.7"/>
          </radialGradient>
          <linearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)"/>
            <stop offset="60%" stopColor="rgba(255,255,255,0)"/>
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill={`url(#${gid})`}/>
        <circle cx="16" cy="16" r="14" fill={`url(#${sid})`}/>
        {/* P glyph + spark dot inside bowl */}
        <path d="M12 9.5v13" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M12 9.5c5.5 0 7.5 2.2 7.5 5s-2 5-7.5 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <circle cx="16.5" cy="14.5" r="1.4" fill="white"/>
      </svg>
    );
  },
};

// ─── MOCK MARKET DATA ─────────────────────────────────────────────────────
const Stocks = [
  { tk:'PETR4', name:'Petrobras PN', mkt:'B3', price:38.42, chg:+2.34, color:'#1a8754', sector:'Energia', shares:120, val:4610.4 },
  { tk:'AAPL',  name:'Apple Inc.', mkt:'NASDAQ', price:228.51, chg:+1.18, color:'#444', sector:'Tech', shares:30, val:6855.3 },
  { tk:'VALE3', name:'Vale ON', mkt:'B3', price:62.10, chg:-0.84, color:'#c89e5d', sector:'Mineração', shares:80, val:4968.0 },
  { tk:'NVDA',  name:'NVIDIA Corp.', mkt:'NASDAQ', price:142.30, chg:+3.42, color:'#76b900', sector:'Semicondutores', shares:25, val:3557.5 },
  { tk:'ITUB4', name:'Itaú Unibanco', mkt:'B3', price:35.04, chg:+0.62, color:'#ff7a00', sector:'Bancos', shares:200, val:7008.0 },
  { tk:'MSFT',  name:'Microsoft', mkt:'NASDAQ', price:421.85, chg:+0.94, color:'#0078d4', sector:'Tech', shares:12, val:5062.2 },
  { tk:'WEGE3', name:'WEG ON', mkt:'B3', price:54.18, chg:+1.42, color:'#0a4d8c', sector:'Industrial', shares:90, val:4876.2 },
  { tk:'TSLA',  name:'Tesla Inc.', mkt:'NASDAQ', price:248.50, chg:-2.18, color:'#cc0000', sector:'Auto', shares:15, val:3727.5 },
];

// Returns synthetic price-series points for charts (deterministic per ticker)
function genSeries(seed = 1, n = 60, base = 100, vol = 0.022, trend = 0.001) {
  let v = base;
  const arr = [];
  let s = seed * 9301;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280 - 0.5;
    v = Math.max(1, v * (1 + r * vol + trend));
    arr.push(v);
  }
  return arr;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────
const fmt = {
  usd: (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%',
  num: (n) => n.toLocaleString('en-US'),
};

// Smooth path generator for sparklines / area charts
function smoothPath(values, w, h, pad = 4) {
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [pad + i * stepX, pad + (1 - (v - min) / range) * (h - pad * 2)]);
  // Catmull-Rom -> Bezier
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return { d, pts };
}

function Sparkline({ values, w = 60, h = 24, color = PraxiaTokens.up, strokeWidth = 1.6 }) {
  const { d } = smoothPath(values, w, h, 2);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AreaChart({ values, w, h, color, fillId, strokeWidth = 1.8, padBottom = 0 }) {
  const { d } = smoothPath(values, w, h - padBottom, 4);
  const lastY = d.split(' ').slice(-1)[0];
  const fillD = `${d} L ${w-4} ${h - padBottom - 4} L 4 ${h - padBottom - 4} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${fillId})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Tag pill
function Tag({ children, color = 'rgba(255,255,255,0.08)', text = 'rgba(255,255,255,0.78)', size = 'sm' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: size === 'sm' ? 20 : 24,
      padding: size === 'sm' ? '0 8px' : '0 10px',
      borderRadius: 999, background: color, color: text,
      fontSize: size === 'sm' ? 11 : 12, fontWeight: 600, letterSpacing: 0.2,
      fontFamily: PraxiaTokens.body,
      border: '0.5px solid rgba(255,255,255,0.06)',
    }}>{children}</span>
  );
}

// Stock avatar (color disc with ticker letters)
function StockAvatar({ stock, size = 38 }) {
  const initials = stock.tk.slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0,
      background: `linear-gradient(140deg, ${stock.color}, ${stock.color}aa)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontFamily: PraxiaTokens.display, fontWeight: 700,
      fontSize: size * 0.34, letterSpacing: 0.4,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px ${stock.color}33`,
      border: '0.5px solid rgba(255,255,255,0.12)',
    }}>{initials}</div>
  );
}

Object.assign(window, {
  PraxiaTokens, PraxiaBackground, PraxiaCard, Icon, Stocks, genSeries, smoothPath,
  Sparkline, AreaChart, fmt, Tag, StockAvatar, accentSet,
});
