// perf-cards.jsx — Mobile-dark cards inspired by Twisty reference
// Brings: vertical bar week-chart with tooltip, big stat + descriptor, 3-column
// score card with histogram stems, status pill tags. All using Praxia tokens.

// ─── BAR WEEK CHART (S M T W T F S with active bar + tooltip) ────────────
function BarWeekChart({ values, labels = ['S','M','T','W','T','F','S'], activeIdx, accent, color, w = 320, h = 130 }) {
  const T = PraxiaTokens;
  const c = color || accent;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const padTop = 26, padBottom = 36;
  const usable = h - padTop - padBottom;
  const colW = w / values.length;
  const ai = activeIdx ?? values.indexOf(Math.max(...values));

  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {values.map((v, i) => {
          const norm = (v - min * 0.5) / (max - min * 0.5);
          const cy = padTop + (1 - norm) * usable;
          const cx = colW * i + colW / 2;
          const active = i === ai;
          return (
            <g key={i}>
              {/* vertical band behind active bar */}
              {active && (
                <rect
                  x={cx - 18} y={padTop - 6} width={36} height={usable + 12}
                  rx={18} fill={`${c}11`} stroke={`${c}33`} strokeWidth="0.5"
                />
              )}
              {/* stem line from base to dot */}
              <line
                x1={cx} y1={padTop + usable} x2={cx} y2={cy}
                stroke={active ? c : 'rgba(255,255,255,0.18)'}
                strokeWidth={active ? 2 : 1}
              />
              {/* dot */}
              <circle cx={cx} cy={cy} r={active ? 5 : 3.5} fill={active ? '#fff' : c} stroke={active ? c : 'none'} strokeWidth={active ? 2 : 0}/>
              {/* day pill at baseline */}
              <circle
                cx={cx} cy={padTop + usable + 18} r={11}
                fill={active ? c : 'rgba(255,255,255,0.06)'}
                stroke={active ? 'none' : 'rgba(255,255,255,0.08)'}
                strokeWidth="0.5"
              />
              <text
                x={cx} y={padTop + usable + 22}
                textAnchor="middle"
                fontSize={11}
                fontWeight={active ? 700 : 500}
                fill={active ? '#fff' : T.ink50}
                fontFamily={PraxiaTokens.body}
              >{labels[i]}</text>
            </g>
          );
        })}
      </svg>
      {/* tooltip on active bar */}
      {(() => {
        const cx = colW * ai + colW / 2;
        const norm = (values[ai] - min * 0.5) / (max - min * 0.5);
        const cy = padTop + (1 - norm) * usable;
        return (
          <div style={{
            position: 'absolute', left: cx - 36, top: Math.max(0, cy - 32),
            width: 72, height: 22, borderRadius: 11,
            background: '#0a1230', border: `0.5px solid ${T.hairlineStrong}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: PraxiaTokens.mono, fontSize: 11, color: T.ink, fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            boxShadow: `0 6px 18px rgba(0,0,0,0.5), 0 0 0 0.5px ${c}33`,
          }}>
            {fmt.usd(values[ai])}
            {/* arrow */}
            <div style={{
              position: 'absolute', bottom: -3, left: '50%', marginLeft: -3,
              width: 6, height: 6, background: '#0a1230', transform: 'rotate(45deg)',
              borderRight: `0.5px solid ${T.hairlineStrong}`, borderBottom: `0.5px solid ${T.hairlineStrong}`,
            }}/>
          </div>
        );
      })()}
    </div>
  );
}

// ─── BIG STAT CARD ("+12.4% Esta semana...") ────────────────────────────
function BigStatCard({ accent }) {
  const T = PraxiaTokens;
  const weekData = [21800, 22400, 24100, 26500, 25700, 26200, 27340];
  return (
    <PraxiaCard padding={18} style={{
      background: `linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.06)', border: `0.5px solid ${T.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
        }}>{Icon.trend(16, accent)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 600, color: T.ink, letterSpacing: -0.3 }}>Performance semanal</div>
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, marginTop: 2 }}>Acompanhe seu rendimento dia a dia.</div>
        </div>
        <StatusTag color="rgba(66,232,163,0.18)" text={T.up}>Semana ▾</StatusTag>
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ paddingBottom: 36 }}>
          <div style={{
            fontFamily: T.display, fontSize: 36, fontWeight: 600, color: T.ink,
            letterSpacing: -1.2, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>+12.4%</div>
          <div style={{ marginTop: 6, fontFamily: T.body, fontSize: 11.5, color: T.ink50, maxWidth: 110, lineHeight: 1.35 }}>
            Esta semana superou a anterior em <b style={{ color: T.up }}>2.1pp</b>.
          </div>
        </div>
        <div style={{ flex: 1, marginRight: -8 }}>
          <BarWeekChart values={weekData} accent={accent} activeIdx={3} w={186} h={130}/>
        </div>
      </div>
    </PraxiaCard>
  );
}

// ─── 3-COLUMN SCORE CARD with histogram stems ────────────────────────────
function ScoreCard({ accent }) {
  const T = PraxiaTokens;
  const data = [
    { lbl: 'Sugestões', val: 64, c: accent, bars: genStems(28, 7) },
    { lbl: 'Acertos', val: 52, c: T.up, bars: genStems(28, 12) },
    { lbl: 'Alertas', val: 8, c: T.warn, bars: genStems(28, 18) },
  ];

  return (
    <PraxiaCard padding={18} style={{
      background: `linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 600, color: T.ink, letterSpacing: -0.3 }}>Score da Pra</div>
          <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, marginTop: 2 }}>Histórico das últimas 90 sugestões.</div>
        </div>
        <StatusTag color={`${accent}22`} text={accent}>Trim ▾</StatusTag>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {data.map(d => (
          <div key={d.lbl}>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50, letterSpacing: 0.2 }}>{d.lbl}</div>
            <div style={{
              marginTop: 2, fontFamily: PraxiaTokens.display, fontSize: 30, fontWeight: 600,
              color: T.ink, letterSpacing: -0.8, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>{d.val}</div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 34 }}>
              {d.bars.map((b, i) => (
                <div key={i} style={{
                  flex: 1, height: b + '%', borderRadius: 1,
                  background: i > d.bars.length - 6 ? d.c : `${d.c}55`,
                  minHeight: 2,
                }}/>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PraxiaCard>
  );
}

// deterministic stem heights
function genStems(n, seed) {
  let s = seed * 9301;
  const arr = [];
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    arr.push(20 + (s / 233280) * 80);
  }
  return arr;
}

// ─── STATUS TAG (filled pill, reference style) ───────────────────────────
function StatusTag({ children, color, text, size = 'sm' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: size === 'sm' ? 22 : 26,
      padding: size === 'sm' ? '0 9px' : '0 12px',
      borderRadius: 999,
      background: color, color: text,
      fontFamily: PraxiaTokens.body, fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 700, letterSpacing: 0.2,
    }}>{children}</span>
  );
}

// ─── PEOPLE CONNECT CARD (matches "Let's Connect") ───────────────────────
function ProSuggestionsCard({ accent }) {
  const T = PraxiaTokens;
  const pros = [
    { name: 'Lucas Almeida', role: 'Trader macro · BR', tag: 'Senior', tagBg: '#ff8a4d', initials: 'LA', g: '#7c3aed' },
    { name: 'Renata Silva',  role: 'Analista ESG',      tag: 'Pro',    tagBg: accent,    initials: 'RS', g: '#ec4899' },
  ];
  return (
    <PraxiaCard padding={14}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 600, color: T.ink }}>Siga especialistas</div>
        <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, fontWeight: 600 }}>Ver todos</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pros.map(p => (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px 8px 8px', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.hairline}`,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 17, flexShrink: 0,
              background: `linear-gradient(140deg, ${p.g}, ${p.g}aa)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.display, fontWeight: 700, fontSize: 12, color: 'white', letterSpacing: 0.2,
            }}>{p.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 12.5, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <StatusTag color={p.tagBg} text="white">{p.tag}</StatusTag>
              </div>
              <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50, marginTop: 1 }}>{p.role}</div>
            </div>
            <button style={{
              width: 28, height: 28, borderRadius: 14, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: `0.5px solid ${T.hairlineStrong}`,
              color: T.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{Icon.plus(14, T.ink)}</button>
          </div>
        ))}
      </div>
    </PraxiaCard>
  );
}

// ─── UPGRADE CARD (matches "Unlock Premium" w/ dot pattern) ──────────────
function UpgradeCard({ accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{
      position: 'relative', padding: 18, borderRadius: 22, overflow: 'hidden',
      background: `linear-gradient(160deg, ${accent}30 0%, ${accent}12 60%, rgba(255,255,255,0.02) 100%)`,
      border: `0.5px solid ${accent}44`,
    }}>
      {/* dot pattern texture */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4,
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)`,
        backgroundSize: '8px 8px',
        maskImage: 'radial-gradient(120% 80% at 100% 100%, black 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(120% 80% at 100% 100%, black 30%, transparent 75%)',
      }}/>
      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 600, color: T.ink, letterSpacing: -0.2, maxWidth: 220 }}>
          Praxia Pro
        </div>
        <div style={{ marginTop: 6, fontFamily: T.body, fontSize: 12, color: T.ink70, lineHeight: 1.4, maxWidth: 240 }}>
          Análises sob demanda da Pra, alertas em tempo real e relatórios setoriais.
        </div>
        <button style={{
          marginTop: 14, height: 40, padding: '0 18px 0 16px',
          borderRadius: 999, background: '#fff', color: '#05071a',
          border: 'none', cursor: 'pointer',
          fontFamily: T.display, fontWeight: 600, fontSize: 13, letterSpacing: -0.1,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          Conhecer
          <span style={{ width: 22, height: 22, borderRadius: 11, background: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── VARIATION HOME D: Performance-led ──────────────────────────────────
function VarHomePerformance({ accent }) {
  const T = PraxiaTokens;
  const series = genSeries(13, 50, 124580, 0.012, 0.0008);

  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PraxiaLogo size={20} accent={accent}/>
            <span style={{ fontFamily: T.display, fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: 0.2 }}>Praxia</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={glassBtn(T)}>{Icon.search(16, T.ink70)}</button>
            <button style={glassBtn(T)}>{Icon.bell(16, T.ink70)}</button>
          </div>
        </div>

        {/* greet + tags */}
        <div>
          <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50, letterSpacing: 0.4, textTransform: 'uppercase' }}>Bom dia, Marina</div>
          <div style={{ marginTop: 4, fontFamily: T.display, fontSize: 26, fontWeight: 600, color: T.ink, letterSpacing: -0.7 }}>Sua semana foi <span style={{ color: T.up }}>positiva</span>.</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <StatusTag color={`${accent}22`} text={accent}>Perfil moderado</StatusTag>
            <StatusTag color="rgba(255,255,255,0.06)" text={T.ink70}>1–5 anos</StatusTag>
          </div>
        </div>

        {/* big bar performance card */}
        <BigStatCard accent={accent}/>

        {/* score */}
        <ScoreCard accent={accent}/>

        {/* upgrade */}
        <UpgradeCard accent={accent}/>

        {/* people / pros */}
        <ProSuggestionsCard accent={accent}/>
      </div>
    </div>
  );
}

Object.assign(window, {
  BarWeekChart, BigStatCard, ScoreCard, StatusTag, ProSuggestionsCard, UpgradeCard, VarHomePerformance,
});
