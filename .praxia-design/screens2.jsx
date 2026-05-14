// screens2.jsx — Stock detail, Market, Order, Order Review, Chat, BottomNav, FAB

// ─── SCREEN: STOCK DETAIL ────────────────────────────────────────────────
function ScreenStockDetail({ stock, onBack, onBuy, accent }) {
  const T = PraxiaTokens;
  const [range, setRange] = React.useState('1M');
  const ranges = ['1D','1S','1M','3M','1A','TUDO'];
  const seed = stock.tk.charCodeAt(0) + stock.tk.charCodeAt(1);
  const series = React.useMemo(() => genSeries(seed, range === '1D' ? 24 : range === '1S' ? 30 : range === '1M' ? 50 : range === '3M' ? 60 : 80, stock.price, 0.018, stock.chg >= 0 ? 0.0008 : -0.0006), [range, seed, stock.chg, stock.price]);
  const positive = stock.chg >= 0;

  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 100px' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <button onClick={onBack} style={glassBtn(T)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.ink70} strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={glassBtn(T)}>{Icon.star(16, T.ink70)}</button>
            <button style={glassBtn(T)}>{Icon.dots(16, T.ink70)}</button>
          </div>
        </div>

        {/* identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <StockAvatar stock={stock} size={48}/>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 20, color: T.ink, letterSpacing: -0.3 }}>{stock.tk}</div>
              <Tag color="rgba(255,255,255,0.06)" text={T.ink50}>{stock.mkt}</Tag>
            </div>
            <div style={{ fontSize: 13, color: T.ink50, fontFamily: T.body }}>{stock.name} · {stock.sector}</div>
          </div>
        </div>

        {/* price */}
        <div style={{
          fontFamily: T.display, fontSize: 40, fontWeight: 600, color: T.ink,
          letterSpacing: -1.2, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums',
        }}>
          {fmt.usd(stock.price)}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px 3px 6px', borderRadius: 8,
            background: positive ? 'rgba(66,232,163,0.16)' : 'rgba(255,107,129,0.16)',
            color: positive ? T.up : T.down, fontWeight: 600, fontSize: 12.5,
            fontFamily: T.body,
          }}>
            {positive ? Icon.arrowUp(10, T.up) : Icon.arrowDown(10, T.down)} {fmt.pct(stock.chg)}
          </span>
          <span style={{ color: T.ink50, fontFamily: T.body, fontSize: 12.5 }}>hoje</span>
        </div>

        {/* chart */}
        <div style={{ marginTop: 16, marginLeft: -8, marginRight: -8 }}>
          <AreaChart values={series} w={342} h={150} color={positive ? T.up : T.down} fillId={`sd-${stock.tk}`} strokeWidth={2}/>
        </div>

        {/* range picker */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 4px' }}>
          {ranges.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              flex: 1, height: 30, fontFamily: PraxiaTokens.mono, fontSize: 11,
              background: range === r ? accent : 'transparent',
              color: range === r ? 'white' : T.ink50,
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, letterSpacing: 0.4,
            }}>{r}</button>
          ))}
        </div>

        {/* AI take */}
        <PraxiaCard padding={14} style={{
          marginTop: 16,
          background: `linear-gradient(160deg, ${accent}1a 0%, ${accent}05 100%)`,
          border: `0.5px solid ${accent}44`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {Icon.praMark(26, '#fff', accent)}
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>O que a Pra acha</div>
            <div style={{ marginLeft: 'auto', fontFamily: PraxiaTokens.mono, fontSize: 10, color: T.ink50, letterSpacing: 0.6 }}>
              CONFIANÇA <span style={{ color: positive ? T.up : T.warn, fontWeight: 700 }}>{positive ? 'ALTA' : 'MÉDIA'}</span>
            </div>
          </div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
            {positive
              ? `Pelo seu perfil moderado, ${stock.tk} parece um bom complemento. Múltiplo P/L abaixo da média do setor (${stock.sector}) e momentum positivo.`
              : `${stock.tk} caiu ${Math.abs(stock.chg).toFixed(2)}% hoje, mas fundamentos seguem sólidos. Pode ser oportunidade de aporte se você já tinha planejado.`}
          </div>
        </PraxiaCard>

        {/* stats */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat label="P/L" value="14.2x"/>
          <Stat label="Div. Yield" value="3.8%"/>
          <Stat label="Volume" value="4.2M"/>
          <Stat label="Min/Max 52s" value={`${(stock.price * 0.74).toFixed(0)}–${(stock.price * 1.22).toFixed(0)}`}/>
        </div>

        {/* news / events */}
        <div style={{ marginTop: 16 }}>
          <SectionHeader label="Notícias"/>
          <PraxiaCard padding={4}>
            {[
              { tit: `${stock.tk} apresenta resultados acima do esperado`, src: 'Bloomberg', age: '2h' },
              { tit: 'Setor avança após dados macro', src: 'Reuters', age: '6h' },
              { tit: 'Analistas elevam recomendação', src: 'XP Research', age: '1d' },
            ].map((n, i, a) => (
              <div key={i} style={{
                padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 4,
                borderBottom: i === a.length - 1 ? 'none' : `0.5px solid ${T.hairline}`,
              }}>
                <div style={{ fontFamily: T.body, fontWeight: 500, fontSize: 13, color: T.ink, lineHeight: 1.35 }}>{n.tit}</div>
                <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50 }}>{n.src} · {n.age}</div>
              </div>
            ))}
          </PraxiaCard>
        </div>
      </div>

      {/* sticky buy CTA */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 16px 24px',
        background: 'linear-gradient(180deg, transparent, rgba(2,3,20,0.9) 40%)',
        display: 'flex', gap: 8, zIndex: 5,
      }}>
        <button style={{
          flex: 1, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,0.06)', color: T.ink,
          border: '0.5px solid rgba(255,255,255,0.12)',
          fontFamily: T.display, fontWeight: 600, fontSize: 15, cursor: 'pointer',
        }}>Vender</button>
        <button onClick={() => onBuy(stock)} style={{
          flex: 1.4, height: 52, borderRadius: 16,
          background: accent, color: 'white', border: 'none',
          fontFamily: T.display, fontWeight: 600, fontSize: 15, cursor: 'pointer',
          boxShadow: `0 12px 30px ${accent}55`,
        }}>Comprar</button>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  const T = PraxiaTokens;
  return (
    <PraxiaCard padding={12}>
      <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50, fontWeight: 500, letterSpacing: 0.2 }}>{label}</div>
      <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 16, color: T.ink, fontWeight: 500, marginTop: 4 }}>{value}</div>
    </PraxiaCard>
  );
}

// ─── SCREEN: MARKET / WATCHLIST ──────────────────────────────────────────
function ScreenMarket({ accent, onOpenStock }) {
  const T = PraxiaTokens;
  const [tab, setTab] = React.useState('Trending');
  const tabs = ['Trending', 'Para você', 'Watchlist', 'B3', 'NASDAQ'];
  let list = Stocks;
  if (tab === 'B3') list = Stocks.filter(s => s.mkt === 'B3');
  if (tab === 'NASDAQ') list = Stocks.filter(s => s.mkt === 'NASDAQ');
  if (tab === 'Para você') list = [Stocks[3], Stocks[5], Stocks[0], Stocks[6]];

  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 100px' }}>
        {/* top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: T.display, fontSize: 24, fontWeight: 600, color: T.ink, letterSpacing: -0.6 }}>Mercado</div>
          <button style={glassBtn(T)}>{Icon.filter(16, T.ink70)}</button>
        </div>

        {/* search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 14px',
          borderRadius: 14, background: 'rgba(255,255,255,0.05)',
          border: `0.5px solid ${T.hairline}`, color: T.ink50, marginBottom: 14,
        }}>
          {Icon.search(16, T.ink50)}
          <span style={{ fontFamily: T.body, fontSize: 14 }}>Buscar ações, ETFs, FIIs…</span>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4, marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              height: 34, padding: '0 14px', borderRadius: 999, whiteSpace: 'nowrap',
              background: tab === t ? T.ink : 'rgba(255,255,255,0.05)',
              color: tab === t ? '#05071a' : T.ink70,
              border: tab === t ? 'none' : `0.5px solid ${T.hairline}`,
              fontFamily: T.body, fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0,
            }}>{t}</button>
          ))}
        </div>

        {/* AI recommendations strip (only on Para você) */}
        {tab === 'Para você' && (
          <PraxiaCard padding={14} style={{
            background: `linear-gradient(160deg, ${accent}1a 0%, ${accent}05 100%)`,
            border: `0.5px solid ${accent}44`, marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {Icon.praMark(22, '#fff', accent)}
              <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 600, color: T.ink }}>Pra · curadoria do dia</div>
            </div>
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink70, lineHeight: 1.45 }}>
              Selecionei 4 ações que combinam com seu perfil <b style={{ color: T.ink }}>moderado</b> e interesse em <b style={{ color: T.ink }}>tech + dividendos</b>.
            </div>
          </PraxiaCard>
        )}

        {/* movers strip */}
        <div style={{ marginBottom: 14 }}>
          <SectionHeader label="Em destaque hoje"/>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4 }}>
            {Stocks.slice(0, 5).map(s => <MoverCard key={s.tk} stock={s} onClick={() => onOpenStock(s)} accent={accent}/>)}
          </div>
        </div>

        {/* list */}
        <PraxiaCard padding={4}>
          {list.map((s, i) => (
            <HoldingRow key={s.tk} stock={s} onClick={() => onOpenStock(s)} isLast={i === list.length - 1}/>
          ))}
        </PraxiaCard>
      </div>
    </div>
  );
}

function MoverCard({ stock, onClick, accent }) {
  const T = PraxiaTokens;
  const positive = stock.chg >= 0;
  const series = genSeries(stock.tk.charCodeAt(1), 30, 100, 0.02, positive ? 0.002 : -0.001);
  return (
    <button onClick={onClick} style={{
      width: 130, flexShrink: 0, padding: 12, borderRadius: 18,
      background: 'rgba(255,255,255,0.04)',
      border: `0.5px solid ${T.hairline}`, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
      color: T.ink,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StockAvatar stock={stock} size={26}/>
        <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>{stock.tk}</div>
      </div>
      <Sparkline values={series} w={106} h={26} color={positive ? T.up : T.down}/>
      <div>
        <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 13, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
          {fmt.usd(stock.price)}
        </div>
        <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 11, color: positive ? T.up : T.down, fontWeight: 600 }}>
          {fmt.pct(stock.chg)}
        </div>
      </div>
    </button>
  );
}

// ─── SCREEN: ORDER (BUY FORM) ────────────────────────────────────────────
function ScreenOrder({ stock, onBack, onConfirm, accent }) {
  const T = PraxiaTokens;
  const [shares, setShares] = React.useState(10);
  const [orderType, setOrderType] = React.useState('Mercado');
  const total = shares * stock.price;
  const fee = 0;

  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
        {/* top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={glassBtn(T)}>{Icon.close(16, T.ink70)}</button>
          <div style={{ fontFamily: T.display, fontSize: 14, fontWeight: 600, color: T.ink70 }}>Nova ordem</div>
          <div style={{ width: 38 }}/>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StockAvatar stock={stock} size={42}/>
          <div>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 17, color: T.ink }}>{stock.tk}</div>
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>{stock.name} · {fmt.usd(stock.price)}</div>
          </div>
        </div>

        {/* shares stepper */}
        <PraxiaCard padding={20}>
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, fontWeight: 500, letterSpacing: 0.2 }}>Quantidade</div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setShares(Math.max(1, shares - 1))} style={stepperBtn(T)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14"/></svg>
            </button>
            <input type="number" value={shares} onChange={e => setShares(Math.max(1, parseInt(e.target.value) || 1))} style={{
              flex: 1, textAlign: 'center', background: 'transparent', border: 'none',
              fontFamily: PraxiaTokens.display, fontSize: 44, fontWeight: 600,
              color: T.ink, outline: 'none', letterSpacing: -1.5,
              fontVariantNumeric: 'tabular-nums', width: '100%',
            }}/>
            <button onClick={() => setShares(shares + 1)} style={stepperBtn(T)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M12 5v14"/></svg>
            </button>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
            {[1, 5, 10, 50, 100].map(n => (
              <button key={n} onClick={() => setShares(n)} style={{
                flex: 1, height: 30, borderRadius: 8,
                background: shares === n ? `${accent}25` : 'rgba(255,255,255,0.04)',
                color: shares === n ? accent : T.ink50,
                border: shares === n ? `0.5px solid ${accent}55` : `0.5px solid ${T.hairline}`,
                fontFamily: PraxiaTokens.mono, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>{n}</button>
            ))}
          </div>
        </PraxiaCard>

        {/* order type */}
        <div>
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, fontWeight: 500, letterSpacing: 0.2, marginBottom: 8, paddingLeft: 4 }}>Tipo de ordem</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Mercado','Limite','Stop'].map(t => (
              <button key={t} onClick={() => setOrderType(t)} style={{
                flex: 1, height: 44, borderRadius: 12,
                background: orderType === t ? `${accent}25` : 'rgba(255,255,255,0.04)',
                color: orderType === t ? T.ink : T.ink70,
                border: orderType === t ? `1px solid ${accent}` : `0.5px solid ${T.hairline}`,
                fontFamily: T.body, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* summary */}
        <PraxiaCard padding={16}>
          <SummaryRow lbl="Preço estimado" val={fmt.usd(stock.price)}/>
          <SummaryRow lbl="Quantidade" val={`${shares} ações`}/>
          <SummaryRow lbl="Taxa" val={fmt.usd(fee)}/>
          <div style={{ height: 0.5, background: T.hairline, margin: '10px 0' }}/>
          <SummaryRow lbl="Total estimado" val={fmt.usd(total)} bold/>
        </PraxiaCard>

        <button onClick={() => onConfirm({ shares, total, fee, orderType })} style={{
          marginTop: 'auto', height: 56, borderRadius: 999,
          background: accent, color: 'white', border: 'none',
          fontFamily: T.display, fontWeight: 600, fontSize: 16, cursor: 'pointer',
          boxShadow: `0 16px 36px ${accent}55`, letterSpacing: -0.1,
        }}>
          Revisar ordem · {fmt.usd(total)}
        </button>
      </div>
    </div>
  );
}

function stepperBtn(T) {
  return {
    width: 44, height: 44, borderRadius: 22,
    background: 'rgba(255,255,255,0.06)', border: `0.5px solid ${T.hairline}`,
    color: T.ink, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

function SummaryRow({ lbl, val, bold }) {
  const T = PraxiaTokens;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0',
      fontFamily: T.body, fontSize: bold ? 15 : 13.5,
    }}>
      <span style={{ color: bold ? T.ink : T.ink70, fontWeight: bold ? 600 : 500 }}>{lbl}</span>
      <span style={{ color: T.ink, fontWeight: bold ? 700 : 600, fontFamily: PraxiaTokens.mono, fontVariantNumeric: 'tabular-nums', fontSize: bold ? 16 : 13.5 }}>{val}</span>
    </div>
  );
}

// ─── SCREEN: ORDER REVIEW / CONFIRMATION ─────────────────────────────────
function ScreenOrderReview({ stock, order, onClose, onBuy, accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <PraxiaBackground accent={accent}/>
      {/* hero radial */}
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 320, height: 320,
        background: `radial-gradient(circle, ${accent}55 0%, transparent 65%)`,
        filter: 'blur(20px)', zIndex: 1,
      }}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 24px 28px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={glassBtn(T)}>{Icon.close(16, T.ink70)}</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={glassBtn(T)}>{Icon.share(14, T.ink70)}</button>
            <button style={glassBtn(T)}>{Icon.dots(14, T.ink70)}</button>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: T.display, fontSize: 32, fontWeight: 600, color: T.ink, letterSpacing: -0.8, lineHeight: 1.05 }}>
            Revisar ordem
          </div>
          <div style={{ marginTop: 6, fontFamily: T.body, fontSize: 13.5, color: T.ink70 }}>
            Confirme os detalhes antes de enviar.
          </div>
        </div>

        <PraxiaCard padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StockAvatar stock={stock} size={42}/>
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 16, color: T.ink }}>{stock.tk}</div>
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>{stock.name}</div>
            </div>
          </div>
          <div style={{
            marginTop: 16, fontFamily: T.display, fontSize: 38, fontWeight: 600, color: T.ink,
            letterSpacing: -1.2, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt.usd(order.total)}
          </div>
          <div style={{ marginTop: 6, fontFamily: T.body, fontSize: 12.5, color: T.ink50 }}>
            {order.shares} ações × {fmt.usd(stock.price)} · {new Date().toLocaleDateString('pt-BR')}
          </div>
        </PraxiaCard>

        <PraxiaCard padding={16}>
          <ReviewRow lbl="Tipo de ordem" val={order.orderType}/>
          <ReviewRow lbl="Ações" val={String(order.shares)}/>
          <ReviewRow lbl="Preço por ação" val={fmt.usd(stock.price)}/>
          <ReviewRow lbl="Taxa de transação" val={fmt.usd(order.fee)}/>
          <div style={{ height: 0.5, background: T.hairline, margin: '12px 0' }}/>
          <ReviewRow lbl="Total estimado" val={fmt.usd(order.total)} accent/>
          <ReviewRow lbl="Preço de execução" val={fmt.usd(stock.price - 0.31)}/>
          <ReviewRow lbl="Poder de compra após" val={fmt.usd(7150)}/>
        </PraxiaCard>

        {/* AI sanity check */}
        <PraxiaCard padding={14} style={{
          background: `linear-gradient(160deg, ${accent}1a 0%, ${accent}05 100%)`,
          border: `0.5px solid ${accent}44`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {Icon.praMark(22, '#fff', accent)}
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 12.5, color: T.ink }}>Pra confere</div>
          </div>
          <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
            Essa compra deixa <b>{stock.tk}</b> em {((order.total / 124580) * 100).toFixed(1)}% da carteira — ainda dentro da sua zona de conforto.
          </div>
        </PraxiaCard>

        <button onClick={onBuy} style={{
          marginTop: 'auto', height: 56, borderRadius: 999,
          background: accent, color: 'white', border: 'none',
          fontFamily: T.display, fontWeight: 600, fontSize: 16, cursor: 'pointer',
          boxShadow: `0 16px 36px ${accent}55`, letterSpacing: -0.1,
        }}>
          Confirmar compra
        </button>
      </div>
    </div>
  );
}

function ReviewRow({ lbl, val, accent: hl }) {
  const T = PraxiaTokens;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontFamily: T.body }}>
      <span style={{ color: T.ink70, fontSize: 13.5 }}>{lbl}</span>
      <span style={{
        color: hl ? T.ink : T.ink, fontWeight: hl ? 700 : 600,
        fontFamily: PraxiaTokens.mono, fontSize: hl ? 15 : 13.5, fontVariantNumeric: 'tabular-nums',
      }}>{val}</span>
    </div>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────
function BottomNav({ tab, setTab, accent }) {
  const T = PraxiaTokens;
  const items = [
    { k: 'home', lbl: 'Início', i: Icon.home },
    { k: 'market', lbl: 'Mercado', i: Icon.market },
    { k: 'activity', lbl: 'Atividade', i: Icon.activity },
    { k: 'profile', lbl: 'Perfil', i: Icon.profile },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 4,
      padding: '8px 12px 24px',
      background: 'linear-gradient(180deg, transparent, rgba(2,3,20,0.92) 30%)',
      pointerEvents: 'none',
    }}>
      <div style={{
        height: 60, borderRadius: 30,
        background: 'rgba(13, 19, 48, 0.7)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: `0.5px solid rgba(255,255,255,0.1)`,
        boxShadow: '0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', padding: '0 8px',
        pointerEvents: 'auto',
      }}>
        {items.map(it => {
          const active = tab === it.k;
          return (
            <button key={it.k} onClick={() => setTab(it.k)} style={{
              flex: 1, height: 44, borderRadius: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: active ? `${accent}22` : 'transparent', border: 'none', cursor: 'pointer',
              color: active ? accent : T.ink50,
              fontFamily: T.body, fontWeight: 600, fontSize: 12, letterSpacing: -0.1,
              transition: 'all 0.2s',
            }}>
              {it.i(18, active ? accent : T.ink50)}
              {active && <span>{it.lbl}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── FLOATING AI BUTTON ───────────────────────────────────────────────────
function FloatingPraButton({ accent, onClick, hasNew }) {
  const T = PraxiaTokens;
  return (
    <button onClick={onClick} style={{
      position: 'absolute', right: 16, bottom: 110, zIndex: 5,
      width: 58, height: 58, borderRadius: 29, border: 'none', cursor: 'pointer',
      background: `linear-gradient(140deg, ${accent}, ${accent}aa)`,
      boxShadow: `0 12px 32px ${accent}66, 0 0 0 4px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.3)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'absolute',
    }}>
      {Icon.praMark(36, 'white', accent)}
      {hasNew && (
        <div style={{
          position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7,
          background: T.up, border: '2px solid #05071a',
        }}/>
      )}
    </button>
  );
}

Object.assign(window, {
  ScreenStockDetail, ScreenMarket, ScreenOrder, ScreenOrderReview,
  BottomNav, FloatingPraButton, MoverCard, Stat, ReviewRow,
});
