// screens.jsx — Praxia individual screens (presentational; controlled by prototype.jsx)

// ─── SCREEN: ONBOARDING SPLASH ────────────────────────────────────────────
function ScreenOnboarding({ onStart, accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PraxiaBackground accent={accent} />
      {/* Hero abstract orb shape — pure CSS, no 3D crystal */}
      <div style={{
        position: 'absolute', bottom: -120, left: -40, right: -40, height: 480,
        background: `
          radial-gradient(closest-side at 50% 50%, ${accent} 0%, ${accent}88 30%, transparent 70%),
          radial-gradient(closest-side at 30% 60%, #8b5cf6aa 0%, transparent 60%)
        `,
        filter: 'blur(40px)', opacity: 0.7, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
        width: 220, height: 220, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, white 0%, ${accent} 30%, ${accent}44 60%, transparent 80%)`,
        opacity: 0.35, filter: 'blur(2px)',
      }} />
      <div style={{ position: 'relative', zIndex: 2, padding: '90px 28px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.95 }}>
          <PraxiaLogo size={18} accent={accent}/>
          <span style={{ fontFamily: T.display, fontSize: 16, fontWeight: 600, letterSpacing: 0.4, color: T.ink }}>Praxia</span>
        </div>
        <div style={{ marginTop: 'auto', paddingBottom: 56 }}>
          <div style={{
            fontFamily: T.display, fontSize: 46, fontWeight: 600, lineHeight: 1.0,
            color: T.ink, letterSpacing: -1.2, textWrap: 'balance',
          }}>
            Invista com<br/>uma mente clara.
          </div>
          <div style={{
            marginTop: 18, fontFamily: T.body, fontSize: 15, lineHeight: 1.5,
            color: T.ink70, maxWidth: 300,
          }}>
            Análise, precificação e uma IA que conversa com você para entender suas prioridades — não as do mercado.
          </div>
          <button onClick={onStart} style={{
            marginTop: 36, height: 56, padding: '0 26px',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: T.ink, color: '#05071a',
            border: 'none', borderRadius: 999,
            fontFamily: T.display, fontWeight: 600, fontSize: 16,
            cursor: 'pointer', letterSpacing: -0.1,
            boxShadow: '0 12px 30px rgba(255,255,255,0.15)',
          }}>
            Começar
            <span style={{ width: 28, height: 28, borderRadius: 14, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
            </span>
          </button>
          <div style={{ marginTop: 28, fontFamily: PraxiaTokens.mono, fontSize: 10.5, color: T.ink30, letterSpacing: 1, textTransform: 'uppercase' }}>
            Já tem conta? <span style={{ color: T.ink70, textDecoration: 'underline' }}>Entrar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PraxiaLogo({ size = 22, accent }) {
  const r = Math.round(size * 0.26);
  const gid = 'plg-' + accent.replace('#','') + '-' + size;
  const sid = 'pls-' + size;
  return (
    <div style={{
      width: size, height: size, borderRadius: r,
      position: 'relative', overflow: 'hidden',
      boxShadow: `0 2px 10px ${accent}55, inset 0 0.5px 0 rgba(255,255,255,0.4)`,
    }}>
      <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85"/>
            <stop offset="55%" stopColor={accent}/>
            <stop offset="100%" stopColor={accent} stopOpacity="0.85"/>
          </linearGradient>
          <radialGradient id={sid} cx="0.3" cy="0.25" r="0.65">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
        </defs>
        <rect width="32" height="32" rx={r * 32 / size} fill={`url(#${gid})`}/>
        <rect width="32" height="32" rx={r * 32 / size} fill={`url(#${sid})`}/>
        {/* P glyph */}
        <path d="M11 7v18" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
        <path d="M11 7c7 0 9.5 2.8 9.5 6.5S18 20 11 20" stroke="white" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
        {/* spark dot — the "planning insight" */}
        <circle cx="16.5" cy="13.5" r="1.7" fill="white"/>
      </svg>
    </div>
  );
}

// ─── SCREEN: PROFILE QUIZ ────────────────────────────────────────────────
const QuizSteps = [
  {
    q: 'Quanto risco você topa?',
    sub: 'Sua tolerância nos ajuda a calibrar as recomendações.',
    opts: [
      { v: 'low', lbl: 'Conservador', desc: 'Prefiro segurança, mesmo que renda menos.' },
      { v: 'mid', lbl: 'Moderado', desc: 'Topo oscilações por retorno equilibrado.' },
      { v: 'high', lbl: 'Arrojado', desc: 'Aceito volatilidade por retorno maior.' },
    ],
  },
  {
    q: 'Qual seu horizonte?',
    sub: 'Por quanto tempo o dinheiro pode ficar investido.',
    opts: [
      { v: 'short', lbl: 'Curto', desc: 'Até 1 ano' },
      { v: 'mid',   lbl: 'Médio', desc: '1 a 5 anos' },
      { v: 'long',  lbl: 'Longo', desc: 'Mais de 5 anos' },
    ],
  },
  {
    q: 'O que mais te interessa?',
    sub: 'Pode escolher um ou mais.',
    multi: true,
    opts: [
      { v: 'div', lbl: 'Dividendos', desc: 'Renda passiva mensal' },
      { v: 'gro', lbl: 'Crescimento', desc: 'Empresas em expansão' },
      { v: 'esg', lbl: 'ESG', desc: 'Sustentabilidade e governança' },
      { v: 'tec', lbl: 'Tecnologia', desc: 'Inovação e disrupção' },
    ],
  },
];

function ScreenQuiz({ onComplete, accent }) {
  const T = PraxiaTokens;
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const s = QuizSteps[step];
  const sel = answers[step];
  const picked = s.multi ? (sel || []) : sel;
  const canNext = s.multi ? (picked?.length > 0) : !!picked;

  const choose = (v) => {
    if (s.multi) {
      const cur = answers[step] || [];
      const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
      setAnswers({ ...answers, [step]: next });
    } else {
      setAnswers({ ...answers, [step]: v });
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PraxiaBackground accent={accent} />
      <div style={{ position: 'relative', zIndex: 2, padding: '70px 24px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {QuizSteps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= step ? accent : 'rgba(255,255,255,0.12)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10.5, color: accent, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
          Passo {step + 1} de {QuizSteps.length} · Perfil
        </div>
        <div style={{
          fontFamily: T.display, fontSize: 28, fontWeight: 600, color: T.ink,
          letterSpacing: -0.6, lineHeight: 1.1, textWrap: 'balance',
        }}>{s.q}</div>
        <div style={{ marginTop: 10, fontFamily: T.body, fontSize: 14, color: T.ink50, lineHeight: 1.5 }}>{s.sub}</div>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.opts.map(opt => {
            const isSel = s.multi ? (picked || []).includes(opt.v) : picked === opt.v;
            return (
              <button key={opt.v} onClick={() => choose(opt.v)} style={{
                textAlign: 'left', padding: '14px 16px', borderRadius: 16,
                background: isSel ? `${accent}1f` : 'rgba(255,255,255,0.035)',
                border: `1px solid ${isSel ? accent : 'rgba(255,255,255,0.08)'}`,
                color: T.ink, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 0.18s', fontFamily: T.body,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: s.multi ? 6 : 11, flexShrink: 0,
                  border: `1.5px solid ${isSel ? accent : 'rgba(255,255,255,0.25)'}`,
                  background: isSel ? accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSel && Icon.check(13, 'white')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.display, fontSize: 15, fontWeight: 600, color: T.ink, letterSpacing: -0.1 }}>{opt.lbl}</div>
                  <div style={{ fontSize: 12.5, color: T.ink50, marginTop: 2 }}>{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', paddingBottom: 40, display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} style={{
              height: 52, padding: '0 22px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)', color: T.ink,
              border: '1px solid rgba(255,255,255,0.1)', fontFamily: T.display, fontWeight: 600,
              fontSize: 15, cursor: 'pointer',
            }}>Voltar</button>
          )}
          <button disabled={!canNext} onClick={() => {
            if (step < QuizSteps.length - 1) setStep(step + 1);
            else onComplete(answers);
          }} style={{
            flex: 1, height: 52, borderRadius: 999,
            background: canNext ? T.ink : 'rgba(255,255,255,0.1)',
            color: canNext ? '#05071a' : 'rgba(255,255,255,0.4)',
            border: 'none', fontFamily: T.display, fontWeight: 600, fontSize: 15,
            cursor: canNext ? 'pointer' : 'not-allowed', letterSpacing: -0.1,
            transition: 'all 0.2s',
          }}>
            {step === QuizSteps.length - 1 ? 'Concluir perfil' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: HOME / DASHBOARD ────────────────────────────────────────────
function ScreenHome({ accent, onOpenStock, onTab, density }) {
  const T = PraxiaTokens;
  const compact = density === 'compact';
  const series = React.useMemo(() => genSeries(3, 80, 124580, 0.015, 0.0008), []);
  const portfolioValue = series[series.length - 1];
  const ytd = ((portfolioValue / series[0]) - 1) * 100;
  const today = +2134;
  const holdings = Stocks.slice(0, 4);

  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <PraxiaBackground accent={accent} />
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 100px', display: 'flex', flexDirection: 'column', gap: compact ? 12 : 16 }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 4 }}>
          <button style={glassBtn(T)}>{Icon.menu(18, T.ink70)}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PraxiaLogo size={16} accent={accent}/>
            <span style={{ fontFamily: T.display, fontSize: 13.5, fontWeight: 600, color: T.ink70, letterSpacing: 0.2 }}>Praxia</span>
          </div>
          <button style={glassBtn(T)}>{Icon.bell(18, T.ink70)}</button>
        </div>

        {/* portfolio hero card */}
        <PraxiaCard raised style={{
          background: `
            radial-gradient(120% 90% at 80% -10%, ${accent}33 0%, transparent 60%),
            linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)
          `,
          padding: compact ? 18 : 22, paddingBottom: 16,
        }}>
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, fontWeight: 500, letterSpacing: 0.2 }}>
            Patrimônio total
          </div>
          <div style={{
            marginTop: 4, fontFamily: T.display, fontSize: compact ? 36 : 40, fontWeight: 600,
            color: T.ink, letterSpacing: -1.4, lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt.usd(portfolioValue)}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.body, fontSize: 13 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px 3px 6px', borderRadius: 8,
              background: 'rgba(66, 232, 163, 0.16)', color: T.up, fontWeight: 600,
            }}>
              {Icon.arrowUp(10, T.up)} {fmt.pct(ytd)}
            </span>
            <span style={{ color: T.ink50 }}>+{fmt.usd(today)} hoje</span>
          </div>

          {/* mini chart */}
          <div style={{ marginTop: 14, marginLeft: -8, marginRight: -8 }}>
            <AreaChart values={series} w={326} h={70} color={accent} fillId="hero-fill" strokeWidth={2}/>
          </div>

          {/* action row */}
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <HeroAction icon={Icon.invest} label="Investir" accent={accent}/>
            <HeroAction icon={Icon.funds} label="Aportar" accent={accent}/>
            <HeroAction icon={Icon.withdraw} label="Resgatar" accent={accent}/>
          </div>
        </PraxiaCard>

        {/* AI insight card */}
        <AIInsightCard accent={accent} onTab={onTab}/>

        {/* Performance semanal — bar chart with tooltip */}
        <BigStatCard accent={accent}/>

        {/* Top Holdings */}
        <div>
          <SectionHeader label="Minhas posições" trailing="Ver todas"/>
          <PraxiaCard padding={4}>
            {holdings.map((s, i) => (
              <HoldingRow key={s.tk} stock={s} onClick={() => onOpenStock(s)} isLast={i === holdings.length - 1}/>
            ))}
          </PraxiaCard>
        </div>

        {/* Allocation breakdown */}
        <div>
          <SectionHeader label="Alocação por setor" trailing="Detalhes"/>
          <PraxiaCard padding={18}>
            <AllocationBars accent={accent}/>
          </PraxiaCard>
        </div>

      </div>
    </div>
  );
}

function glassBtn(T) {
  return {
    width: 38, height: 38, borderRadius: 19,
    background: 'rgba(255,255,255,0.06)',
    border: `0.5px solid ${T.hairline}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: T.ink,
    backdropFilter: 'blur(12px)',
  };
}

function HeroAction({ icon, label, accent }) {
  const T = PraxiaTokens;
  return (
    <button style={{
      height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.045)',
      border: `0.5px solid ${T.hairline}`, color: T.ink, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      fontFamily: T.body, fontSize: 12, fontWeight: 600,
    }}>
      <div style={{ color: accent }}>{icon(18, accent)}</div>
      <div style={{ color: T.ink70, fontSize: 11.5 }}>{label}</div>
    </button>
  );
}

function SectionHeader({ label, trailing }) {
  const T = PraxiaTokens;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
      <div style={{ fontFamily: T.display, fontSize: 16, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>{label}</div>
      {trailing && <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, fontWeight: 600 }}>{trailing}</div>}
    </div>
  );
}

function HoldingRow({ stock, onClick, isLast }) {
  const T = PraxiaTokens;
  const positive = stock.chg >= 0;
  const series = genSeries(stock.tk.charCodeAt(0), 30, 100, 0.02, positive ? 0.002 : -0.001);
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 12px', width: '100%',
      background: 'transparent', border: 'none', cursor: 'pointer',
      borderBottom: isLast ? 'none' : `0.5px solid ${T.hairline}`,
      color: T.ink, textAlign: 'left',
    }}>
      <StockAvatar stock={stock}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PraxiaTokens.display, fontWeight: 600, fontSize: 14.5, color: T.ink, letterSpacing: -0.1 }}>{stock.tk}</div>
        <div style={{ fontSize: 12, color: T.ink50, fontFamily: T.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.name}</div>
      </div>
      <Sparkline values={series} w={48} h={22} color={positive ? T.up : T.down}/>
      <div style={{ textAlign: 'right', minWidth: 80 }}>
        <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 13.5, color: T.ink, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {fmt.usd(stock.val)}
        </div>
        <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 11.5, color: positive ? T.up : T.down, fontWeight: 600 }}>
          {fmt.pct(stock.chg)}
        </div>
      </div>
    </button>
  );
}

function AllocationBars({ accent }) {
  const T = PraxiaTokens;
  const data = [
    { lbl: 'Tech', pct: 38, c: accent },
    { lbl: 'Bancos', pct: 22, c: '#a78bfa' },
    { lbl: 'Energia', pct: 18, c: T.up },
    { lbl: 'Mineração', pct: 12, c: T.warn },
    { lbl: 'Outros', pct: 10, c: 'rgba(255,255,255,0.3)' },
  ];
  return (
    <div>
      {/* stacked bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
        {data.map(d => (
          <div key={d.lbl} style={{ width: d.pct + '%', background: d.c }}/>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {data.map(d => (
          <div key={d.lbl} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.body, fontSize: 12.5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.c, flexShrink: 0 }}/>
            <div style={{ flex: 1, color: T.ink70 }}>{d.lbl}</div>
            <div style={{ color: T.ink, fontWeight: 600, fontFamily: PraxiaTokens.mono, fontSize: 12 }}>{d.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIInsightCard({ accent, onTab }) {
  const T = PraxiaTokens;
  return (
    <PraxiaCard padding={16} style={{
      background: `
        linear-gradient(160deg, ${accent}1f 0%, ${accent}08 60%, rgba(255,255,255,0.01) 100%)
      `,
      border: `0.5px solid ${accent}44`,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>{Icon.praMark(38, '#fff', accent)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13.5, color: T.ink }}>Pra</div>
            <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 9.5, color: accent, padding: '1px 6px', borderRadius: 4, background: `${accent}22`, letterSpacing: 0.6 }}>IA</div>
            <div style={{ fontSize: 11, color: T.ink30, fontFamily: T.body }}>· agora</div>
          </div>
          <div style={{ marginTop: 6, fontFamily: T.body, fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>
            Sua carteira está <b style={{ color: accent }}>38% em tech</b>. Pelo seu perfil moderado, sugiro avaliar setores defensivos. Quer ver opções?
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={miniChip(T, accent, true)}>Mostrar opções</button>
            <button style={miniChip(T, accent)}>Mais detalhes</button>
            <button style={miniChip(T, accent)}>Ignorar</button>
          </div>
        </div>
      </div>
    </PraxiaCard>
  );
}

function miniChip(T, accent, primary) {
  return {
    height: 30, padding: '0 12px', borderRadius: 999,
    background: primary ? accent : 'rgba(255,255,255,0.06)',
    color: primary ? 'white' : T.ink70,
    border: primary ? 'none' : `0.5px solid ${T.hairline}`,
    fontFamily: T.body, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };
}

Object.assign(window, {
  ScreenOnboarding, ScreenQuiz, ScreenHome,
  PraxiaLogo, HoldingRow, SectionHeader, AllocationBars, AIInsightCard,
  glassBtn, miniChip, HeroAction, QuizSteps,
});
