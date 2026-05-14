// prototype.jsx — Interactive Praxia prototype container (full flow)

function PraxiaPrototype({ accent, tone, density }) {
  // app state machine
  const [stage, setStage] = React.useState('app'); // 'onboarding' | 'quiz' | 'app'
  const [tab, setTab] = React.useState('home'); // home | market | activity | profile
  const [stack, setStack] = React.useState([]); // navigation stack within a tab
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatContext, setChatContext] = React.useState(null);
  const [quickStock, setQuickStock] = React.useState(null); // quick-watch bottom sheet target

  // Reset to onboarding helper (debug)
  const restart = () => { setStage('onboarding'); setTab('home'); setStack([]); setQuickStock(null); };

  // Tap a stock row → quick-watch preview (bottom sheet), not full detail
  const openStock = (stock) => setQuickStock(stock);
  const openOrder = (stock) => { setQuickStock(null); setStack(s => [...s, { kind: 'order', stock }]); };
  const openFullDetail = (stock) => { setQuickStock(null); setStack(s => [...s, { kind: 'stock', stock }]); };
  const openReview = (stock, order) => setStack(s => [...s, { kind: 'review', stock, order }]);
  const pop = () => setStack(s => s.slice(0, -1));
  const popAll = () => setStack([]);

  // Render
  let content;
  if (stage === 'onboarding') {
    content = <ScreenOnboarding onStart={() => setStage('quiz')} accent={accent}/>;
  } else if (stage === 'quiz') {
    content = <ScreenQuiz onComplete={() => setStage('app')} accent={accent}/>;
  } else {
    const top = stack[stack.length - 1];
    if (top?.kind === 'stock') {
      content = <ScreenStockDetail stock={top.stock} accent={accent} onBack={pop} onBuy={(s) => openOrder(s)}/>;
    } else if (top?.kind === 'order') {
      content = <ScreenOrder stock={top.stock} accent={accent} onBack={pop} onConfirm={(o) => openReview(top.stock, o)}/>;
    } else if (top?.kind === 'review') {
      content = <ScreenOrderReview stock={top.stock} order={top.order} accent={accent} onClose={popAll} onBuy={() => { popAll(); setTab('home'); }}/>;
    } else {
      // tabs
      if (tab === 'home') content = <ScreenHome accent={accent} density={density} onOpenStock={openStock} onTab={setTab}/>;
      else if (tab === 'market') content = <ScreenMarket accent={accent} onOpenStock={openStock}/>;
      else if (tab === 'activity') content = <ScreenActivity accent={accent}/>;
      else if (tab === 'profile') content = <ScreenProfile accent={accent} onRestart={restart}/>;
    }
  }

  // Show bottom nav only on main tabs (not in stack, not onboarding/quiz, not on review)
  const showNav = stage === 'app' && stack.length === 0;
  // Show FAB only on app tabs (not on order/review modal screens or onboarding, not when quickwatch is up)
  const showFab = stage === 'app' && !quickStock && stack[stack.length - 1]?.kind !== 'order' && stack[stack.length - 1]?.kind !== 'review';

  return (
    <div style={{ height: '100%', position: 'relative', background: '#02030f', overflow: 'hidden' }}>
      {content}
      {showNav && <BottomNav tab={tab} setTab={setTab} accent={accent}/>}
      {showFab && <FloatingPraButton accent={accent} onClick={() => setChatOpen(true)} hasNew={!chatOpen}/>}
      <QuickWatch
        stock={quickStock}
        open={!!quickStock}
        accent={accent}
        onClose={() => setQuickStock(null)}
        onBuy={() => openOrder(quickStock)}
        onSell={() => openOrder(quickStock)}
        onSeeDetail={() => openFullDetail(quickStock)}
      />
      <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} accent={accent} tone={tone} context={chatContext}/>
    </div>
  );
}

// ─── ACTIVITY TAB ────────────────────────────────────────────────────────
function ScreenActivity({ accent }) {
  const T = PraxiaTokens;
  const orders = [
    { tk: 'AAPL', side: 'COMPRA', shares: 5, price: 228.51, when: 'Hoje · 14:32', state: 'Executada' },
    { tk: 'PETR4', side: 'DIVIDENDO', shares: 120, price: 0.42, when: 'Ontem', state: 'Creditado' },
    { tk: 'NVDA', side: 'COMPRA', shares: 10, price: 138.20, when: '12 mai', state: 'Pendente' },
    { tk: 'VALE3', side: 'VENDA', shares: 30, price: 63.10, when: '08 mai', state: 'Executada' },
    { tk: 'ITUB4', side: 'COMPRA', shares: 50, price: 34.20, when: '02 mai', state: 'Executada' },
  ];
  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 100px' }}>
        <div style={{ fontFamily: T.display, fontSize: 24, fontWeight: 600, color: T.ink, letterSpacing: -0.6, marginBottom: 14 }}>Atividade</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
          {['Tudo','Compras','Vendas','Dividendos','Depósitos'].map((t, i) => (
            <button key={t} style={{
              height: 30, padding: '0 12px', borderRadius: 999, whiteSpace: 'nowrap',
              background: i === 0 ? T.ink : 'rgba(255,255,255,0.05)',
              color: i === 0 ? '#05071a' : T.ink70,
              border: i === 0 ? 'none' : `0.5px solid ${T.hairline}`,
              fontFamily: T.body, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>
        <PraxiaCard padding={4}>
          {orders.map((o, i, a) => {
            const isBuy = o.side === 'COMPRA';
            const isSell = o.side === 'VENDA';
            const isDiv = o.side === 'DIVIDENDO';
            const c = isBuy ? T.up : isSell ? T.down : accent;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hairline}`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${c}1f`, border: `0.5px solid ${c}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isBuy && Icon.arrowDown(16, c)}
                  {isSell && Icon.arrowUp(16, c)}
                  {isDiv && Icon.funds(16, c)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13.5, color: T.ink }}>{o.tk}</div>
                    <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 9.5, color: c, letterSpacing: 0.6 }}>{o.side}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.ink50, fontFamily: T.body }}>{o.when} · {o.state}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 13, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt.usd(o.shares * o.price)}
                  </div>
                  <div style={{ marginTop: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <StatusTag
                      size="sm"
                      color={o.state === 'Pendente' ? `${T.warn}26` : 'rgba(66,232,163,0.16)'}
                      text={o.state === 'Pendente' ? T.warn : T.up}
                    >{o.state}</StatusTag>
                  </div>
                </div>
              </div>
            );
          })}
        </PraxiaCard>
      </div>
    </div>
  );
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────
function ScreenProfile({ accent, onRestart }) {
  const T = PraxiaTokens;
  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 100px' }}>
        <div style={{ fontFamily: T.display, fontSize: 24, fontWeight: 600, color: T.ink, letterSpacing: -0.6, marginBottom: 18 }}>Perfil</div>

        {/* hero */}
        <PraxiaCard raised padding={18} style={{
          background: `radial-gradient(120% 90% at 30% 0%, ${accent}33 0%, transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 30,
              background: `linear-gradient(140deg, ${accent}, #8b5cf6)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.display, fontWeight: 700, fontSize: 22, color: 'white', letterSpacing: -0.3,
              boxShadow: `0 8px 20px ${accent}44`,
            }}>MR</div>
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 18, color: T.ink }}>Marina Reis</div>
              <div style={{ fontSize: 12.5, color: T.ink50, fontFamily: T.body }}>marina@email.com</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <StatTile lbl="Perfil" val="Moderado"/>
            <StatTile lbl="Horizonte" val="1–5a"/>
            <StatTile lbl="Score Pra" val="82/100" accent={accent}/>
          </div>
        </PraxiaCard>

        <div style={{ marginTop: 16 }}>
          <SectionHeader label="Conta"/>
          <PraxiaCard padding={4}>
            <SettingsRow icon={Icon.shield} lbl="Segurança e biometria"/>
            <SettingsRow icon={Icon.funds} lbl="Métodos de pagamento"/>
            <SettingsRow icon={Icon.trend} lbl="Histórico de aportes"/>
            <SettingsRow icon={Icon.bell} lbl="Notificações" last/>
          </PraxiaCard>
        </div>

        <div style={{ marginTop: 16 }}>
          <SectionHeader label="IA"/>
          <PraxiaCard padding={4}>
            <SettingsRow icon={Icon.spark} lbl="Como a Pra te conhece"/>
            <SettingsRow icon={Icon.chat} lbl="Tom da conversa" detail="Casual"/>
            <SettingsRow icon={Icon.praMark} lbl="Refazer quiz de perfil" onClick={onRestart} last/>
          </PraxiaCard>
        </div>
      </div>
    </div>
  );
}

function StatTile({ lbl, val, accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.hairline}`,
    }}>
      <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50, letterSpacing: 0.4, textTransform: 'uppercase' }}>{lbl}</div>
      <div style={{ marginTop: 2, fontFamily: PraxiaTokens.display, fontSize: 14, fontWeight: 600, color: accent || T.ink }}>{val}</div>
    </div>
  );
}

function SettingsRow({ icon, lbl, detail, last, onClick }) {
  const T = PraxiaTokens;
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', width: '100%',
      background: 'transparent', border: 'none', cursor: 'pointer', color: T.ink,
      textAlign: 'left', borderBottom: last ? 'none' : `0.5px solid ${T.hairline}`,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {typeof icon === 'function' ? icon(16, T.ink70) : icon}
      </div>
      <div style={{ flex: 1, fontFamily: T.body, fontSize: 14, fontWeight: 500 }}>{lbl}</div>
      {detail && <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>{detail}</div>}
      <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.ink30} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
    </button>
  );
}

Object.assign(window, { PraxiaPrototype, ScreenActivity, ScreenProfile, StatTile, SettingsRow });
