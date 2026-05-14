// quickwatch.jsx — Bottom-sheet preview for a stock (tap on a list item)

function QuickWatch({ stock, open, onClose, onBuy, onSell, onSeeDetail, accent }) {
  const T = PraxiaTokens;
  if (!stock || !open) return null;
  const positive = stock.chg >= 0;
  const series = React.useMemo(
    () => genSeries(stock.tk.charCodeAt(0) + 7, 36, stock.price, 0.018, positive ? 0.0008 : -0.0008),
    [stock.tk, stock.price, positive]
  );

  // Mock position data
  const pos = stock.shares || Math.round(stock.val / stock.price);
  const dayPL = stock.val * (stock.chg / 100);

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: 'rgba(2,3,20,0.55)', backdropFilter: 'blur(6px)',
        animation: 'qwFade 0.22s ease-out',
      }}/>
      {/* sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 41,
        padding: '0 10px 10px',
        animation: 'qwUp 0.32s cubic-bezier(.2,.7,.3,1)',
      }}>
        <div style={{
          borderRadius: 28, overflow: 'hidden',
          background: `
            radial-gradient(120% 60% at 80% 0%, ${accent}33 0%, transparent 55%),
            linear-gradient(180deg, #0a1235 0%, #050a22 100%)
          `,
          border: `0.5px solid ${T.hairlineStrong}`,
          boxShadow: `0 -20px 60px rgba(0,0,0,0.55), 0 0 0 0.5px ${accent}22`,
        }}>
          {/* handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}/>
          </div>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 0' }}>
            <StockAvatar stock={stock} size={36}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 16, color: T.ink, letterSpacing: -0.2 }}>
                {stock.name}
              </div>
              <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50 }}>
                {stock.tk} · {stock.mkt} · {stock.sector}
              </div>
            </div>
            <div style={{ color: accent }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.5 6.5L21 11l-6 5 2 7-5-4-5 4 2-7-6-5 6.5-2.5L12 2z" fill="currentColor" opacity="0.95"/>
              </svg>
            </div>
          </div>

          {/* price */}
          <div style={{ padding: '14px 20px 4px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{
              fontFamily: T.display, fontSize: 44, fontWeight: 600, color: T.ink,
              letterSpacing: -1.6, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>{fmt.usd(stock.price)}</div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px 5px 8px', borderRadius: 999,
              background: positive ? 'rgba(66,232,163,0.18)' : 'rgba(255,107,129,0.18)',
              color: positive ? T.up : T.down, fontWeight: 700, fontSize: 13,
              fontFamily: T.body,
            }}>
              {positive ? Icon.arrowUp(12, positive ? T.up : T.down) : Icon.arrowDown(12, T.down)}
              {fmt.pct(stock.chg)}
            </span>
          </div>

          {/* sparkline strip */}
          <div style={{ padding: '4px 8px 0' }}>
            <AreaChart values={series} w={364} h={56} color={positive ? T.up : T.down} fillId={`qw-${stock.tk}`} strokeWidth={1.8}/>
          </div>

          {/* 3 stats */}
          <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <QWStat lbl="Sua posição" val={`${pos}`} sub="ações"/>
            <QWStat lbl="Valor de mercado" val={fmt.usd(stock.val)}/>
            <QWStat lbl="P/L hoje"
                    val={(dayPL >= 0 ? '+' : '') + fmt.usd(Math.abs(dayPL))}
                    valColor={dayPL >= 0 ? T.up : T.down}/>
          </div>

          {/* Pra note */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 14,
              background: `linear-gradient(160deg, ${accent}18 0%, ${accent}06 100%)`,
              border: `0.5px solid ${accent}33`,
            }}>
              {Icon.praMark(22, '#fff', accent)}
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink, lineHeight: 1.45, flex: 1 }}>
                {praQuickNote(stock)}
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div style={{ padding: '16px 16px 8px', display: 'flex', gap: 10 }}>
            <button onClick={onSell} style={{
              flex: 1, height: 52, borderRadius: 999,
              background: 'rgba(255,255,255,0.06)', color: T.ink,
              border: `0.5px solid ${T.hairlineStrong}`,
              fontFamily: T.display, fontWeight: 600, fontSize: 15, cursor: 'pointer',
            }}>Vender</button>
            <button onClick={onBuy} style={{
              flex: 1.3, height: 52, borderRadius: 999,
              background: accent, color: 'white', border: 'none',
              fontFamily: T.display, fontWeight: 600, fontSize: 15, cursor: 'pointer',
              boxShadow: `0 14px 30px ${accent}55`,
            }}>Comprar</button>
          </div>

          <button onClick={onSeeDetail} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', height: 44, background: 'transparent', border: 'none',
            color: T.ink50, fontFamily: T.body, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            paddingBottom: 18, paddingTop: 4,
          }}>
            Ver análise completa
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes qwFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes qwUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  );
}

function QWStat({ lbl, val, sub, valColor }) {
  const T = PraxiaTokens;
  return (
    <div>
      <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50, letterSpacing: 0.4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{lbl}</div>
      <div style={{
        marginTop: 4, fontFamily: PraxiaTokens.mono, fontSize: 14, fontWeight: 600,
        color: valColor || T.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>{val}</div>
      {sub && <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink30, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function praQuickNote(stock) {
  const positive = stock.chg >= 0;
  if (stock.tk === 'NVDA') return 'NVDA tá +3.42%. Você comprou a $138 — segura ou realiza? Posso comparar com AMD/INTC.';
  if (stock.tk === 'PETR4') return 'Petrobras com P/L baixo + yield forte. Boa pra dividendos, mas evite ultrapassar 15% da carteira.';
  if (stock.tk === 'VALE3') return 'Setor pressionado, mas fundamentos sólidos. Pode ser oportunidade de aporte gradual.';
  if (positive) return `${stock.tk} subindo bem hoje. Momentum positivo, mas verifique alvo antes de aumentar posição.`;
  return `${stock.tk} caindo hoje, sem mudança nos fundamentos. Avalie se faz sentido aproveitar pra reforçar.`;
}

Object.assign(window, { QuickWatch, QWStat });
