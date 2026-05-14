// variations.jsx — Side-by-side variation artboards for key screens

// ─── ONBOARDING VARIATION B: Type-led, minimal ───────────────────────────
function VarOnboardingTypeLed({ accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PraxiaBackground accent={accent} style={{
        background: `linear-gradient(180deg, #02030f 0%, #050818 100%)`,
      }}/>
      {/* big number 01 background */}
      <div style={{
        position: 'absolute', top: 80, right: -20, fontFamily: PraxiaTokens.display,
        fontSize: 280, fontWeight: 700, color: 'rgba(255,255,255,0.025)',
        letterSpacing: -8, lineHeight: 0.85, zIndex: 1,
      }}>01</div>
      <div style={{ position: 'relative', zIndex: 2, padding: '90px 28px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PraxiaLogo size={18} accent={accent}/>
          <span style={{ fontFamily: T.display, fontSize: 16, fontWeight: 600, color: T.ink }}>Praxia</span>
        </div>
        <div style={{ marginTop: 'auto', paddingBottom: 56 }}>
          <div style={{
            fontFamily: T.mono, fontSize: 11, color: accent, letterSpacing: 1.2, marginBottom: 16, textTransform: 'uppercase',
          }}>// boas-vindas</div>
          <div style={{
            fontFamily: T.display, fontSize: 56, fontWeight: 600, lineHeight: 0.95,
            color: T.ink, letterSpacing: -2,
          }}>
            Pense.<br/>
            <span style={{ color: accent }}>Analise.</span><br/>
            Invista.
          </div>
          <div style={{ marginTop: 18, fontFamily: T.body, fontSize: 14.5, lineHeight: 1.55, color: T.ink70, maxWidth: 280 }}>
            Uma IA que conversa com você antes de sugerir. Praxia é a habilidade de planejar — agora aplicada ao seu dinheiro.
          </div>
          <div style={{ marginTop: 36, display: 'flex', gap: 8 }}>
            <button style={{
              flex: 1, height: 54, borderRadius: 14,
              background: accent, color: 'white', border: 'none',
              fontFamily: T.display, fontWeight: 600, fontSize: 15, cursor: 'pointer',
              boxShadow: `0 14px 30px ${accent}55`,
            }}>Criar conta</button>
            <button style={{
              flex: 1, height: 54, borderRadius: 14,
              background: 'rgba(255,255,255,0.06)', color: T.ink,
              border: `0.5px solid ${T.hairlineStrong}`,
              fontFamily: T.display, fontWeight: 600, fontSize: 15, cursor: 'pointer',
            }}>Entrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HOME VARIATION B: List-led, dense ───────────────────────────────────
function VarHomeDense({ accent }) {
  const T = PraxiaTokens;
  const series = genSeries(7, 50, 124580, 0.014, 0.0007);
  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 16px 100px' }}>
        {/* compact top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50, letterSpacing: 0.5, textTransform: 'uppercase' }}>Bom dia, Marina</div>
            <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: -0.5 }}>Sua carteira</div>
          </div>
          <button style={glassBtn(T)}>{Icon.bell(18, T.ink70)}</button>
        </div>

        {/* inline hero — no card */}
        <div style={{ padding: '4px 4px 12px' }}>
          <div style={{
            fontFamily: T.display, fontSize: 44, fontWeight: 600, color: T.ink,
            letterSpacing: -1.6, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          }}>{fmt.usd(series[series.length-1])}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', fontFamily: T.body, fontSize: 13 }}>
            <span style={{ color: T.up, fontWeight: 600 }}>+12.4%</span>
            <span style={{ color: T.ink50 }}>retorno total</span>
            <span style={{ color: T.ink30 }}>·</span>
            <span style={{ color: T.up, fontWeight: 600 }}>+$2,134</span>
            <span style={{ color: T.ink50 }}>hoje</span>
          </div>
        </div>

        {/* full-width chart */}
        <div style={{ marginLeft: -16, marginRight: -16 }}>
          <AreaChart values={series} w={358} h={120} color={accent} fillId="var-fill" strokeWidth={2}/>
        </div>

        {/* range tabs inline */}
        <div style={{ display: 'flex', gap: 16, marginTop: 4, padding: '6px 4px 18px', fontFamily: PraxiaTokens.mono, fontSize: 11.5 }}>
          {['1D','1S','1M','3M','1A'].map((r, i) => (
            <span key={r} style={{
              color: i === 2 ? accent : T.ink50, fontWeight: i === 2 ? 700 : 500,
              padding: '2px 0', borderBottom: i === 2 ? `1.5px solid ${accent}` : '1.5px solid transparent',
              letterSpacing: 0.4,
            }}>{r}</span>
          ))}
        </div>

        {/* tight section with horizontal cards */}
        <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 600, color: T.ink70, marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase' }}>Top performers</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, marginBottom: 18 }}>
          {Stocks.slice(0, 6).map(s => <MoverCard key={s.tk} stock={s} accent={accent}/>)}
        </div>

        {/* Pra inline insight (no card) */}
        <div style={{
          padding: '12px 14px', borderRadius: 14, marginBottom: 18,
          background: `linear-gradient(140deg, ${accent}25, ${accent}08)`,
          borderLeft: `2.5px solid ${accent}`,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          {Icon.praMark(24, '#fff', accent)}
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.45 }}>
            <b style={{ color: accent }}>NVDA</b> tá +3.42%. Você comprou a $138 — lucro de $107 não realizado. Realizar?
          </div>
        </div>

        {/* dense list */}
        <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 600, color: T.ink70, marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase' }}>Posições</div>
        {Stocks.slice(0, 6).map((s, i) => (
          <DenseRow key={s.tk} stock={s} last={i === 5}/>
        ))}
      </div>
    </div>
  );
}

function DenseRow({ stock, last }) {
  const T = PraxiaTokens;
  const positive = stock.chg >= 0;
  const series = genSeries(stock.tk.charCodeAt(0) * 2, 24, 100, 0.02, positive ? 0.002 : -0.001);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
      borderBottom: last ? 'none' : `0.5px solid ${T.hairline}`,
    }}>
      <div style={{ width: 32, fontFamily: PraxiaTokens.display, fontSize: 12.5, fontWeight: 700, color: T.ink, letterSpacing: -0.1 }}>{stock.tk}</div>
      <Sparkline values={series} w={50} h={20} color={positive ? T.up : T.down}/>
      <div style={{ flex: 1, fontFamily: T.body, fontSize: 11, color: T.ink50, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.sector}</div>
      <div style={{ textAlign: 'right', minWidth: 90 }}>
        <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 12.5, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{fmt.usd(stock.val)}</div>
        <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 10.5, color: positive ? T.up : T.down, fontWeight: 600 }}>{fmt.pct(stock.chg)}</div>
      </div>
    </div>
  );
}

// ─── CHAT VARIATION B: Full-screen "thinking partner" ────────────────────
function VarChatFullscreen({ accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 18px 18px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* header — large */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button style={glassBtn(T)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.ink70} strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 10, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>Conversa</div>
            <div style={{ fontFamily: T.display, fontSize: 17, fontWeight: 600, color: T.ink, letterSpacing: -0.3 }}>Pra · sua mentora</div>
          </div>
          <button style={glassBtn(T)}>{Icon.dots(14, T.ink70)}</button>
        </div>

        {/* daily brief card */}
        <PraxiaCard padding={16} style={{
          background: `linear-gradient(160deg, ${accent}22 0%, ${accent}06 100%)`,
          border: `0.5px solid ${accent}44`, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {Icon.praMark(28, '#fff', accent)}
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>Briefing da manhã</div>
              <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50 }}>Personalizado pro seu perfil · 13 mai</div>
            </div>
          </div>
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
            <b style={{ color: T.ink }}>3 coisas pra hoje:</b> NVDA pulou 3.42% no after-hours — vale realizar parte. ITUB4 paga dividendo amanhã. Setor de mineração tá pressionado, VALE3 caindo desde segunda.
          </div>
        </PraxiaCard>

        {/* recent threads */}
        <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 10, color: T.ink30, letterSpacing: 1, marginBottom: 10 }}>CONVERSAS RECENTES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { t: 'Vale a pena rebalancear?', s: '4 mensagens · ontem' },
            { t: 'Comparação PETR4 vs PRIO3', s: '6 mensagens · 11 mai' },
            { t: 'O que é dividend yield?', s: '2 mensagens · 8 mai' },
          ].map((c, i) => (
            <button key={i} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.hairline}`,
              cursor: 'pointer', color: T.ink, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: accent }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.body, fontSize: 13, fontWeight: 500 }}>{c.t}</div>
                <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50 }}>{c.s}</div>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6" stroke={T.ink30} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
            </button>
          ))}
        </div>

        {/* big input at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div style={{
            padding: '14px 16px', borderRadius: 22,
            background: 'rgba(255,255,255,0.05)',
            border: `0.5px solid ${T.hairlineStrong}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1, fontFamily: T.body, fontSize: 14, color: T.ink50 }}>Pergunte qualquer coisa…</div>
            <button style={{
              width: 36, height: 36, borderRadius: 18, border: 'none', background: accent, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{Icon.send(16, 'white')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHAT VARIATION C: Contextual minimal popover ────────────────────────
function VarChatPopover({ accent }) {
  const T = PraxiaTokens;
  // mock a stock detail with a popover hint floating
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <ScreenStockDetail
        stock={Stocks[3]}
        accent={accent}
        onBack={() => {}}
        onBuy={() => {}}
      />
      {/* overlay popover */}
      <div style={{
        position: 'absolute', bottom: 110, left: 16, right: 16, zIndex: 10,
        padding: 14, borderRadius: 18,
        background: `linear-gradient(160deg, ${accent}30 0%, ${accent}10 100%)`,
        border: `0.5px solid ${accent}66`,
        boxShadow: `0 16px 40px ${accent}33, 0 0 0 0.5px rgba(255,255,255,0.06)`,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {Icon.praMark(28, '#fff', accent)}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>Pra</span>
              <span style={{ fontFamily: PraxiaTokens.mono, fontSize: 9.5, color: accent, padding: '1px 6px', borderRadius: 4, background: `${accent}22`, letterSpacing: 0.6 }}>SUGESTÃO</span>
            </div>
            <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.45 }}>
              NVDA tá em alta forte. Quer que eu compare com AMD e INTC antes de você decidir?
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <button style={miniChip(T, accent, true)}>Sim, comparar</button>
              <button style={miniChip(T, accent)}>Agora não</button>
            </div>
          </div>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.ink50, padding: 0 }}>
            {Icon.close(14, T.ink50)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HOME VARIATION C: Card-grid ─────────────────────────────────────────
function VarHomeGrid({ accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{ position: 'relative', height: '100%', overflowY: 'auto' }}>
      <PraxiaBackground accent={accent}/>
      <div style={{ position: 'relative', zIndex: 2, padding: '54px 14px 100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '0 4px' }}>
          <div style={{ fontFamily: T.display, fontSize: 22, fontWeight: 600, color: T.ink, letterSpacing: -0.5 }}>Praxia</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={glassBtn(T)}>{Icon.search(16, T.ink70)}</button>
            <button style={glassBtn(T)}>{Icon.bell(16, T.ink70)}</button>
          </div>
        </div>

        {/* 2-col tile grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* big tile */}
          <PraxiaCard raised padding={14} style={{
            gridColumn: '1 / 3',
            background: `radial-gradient(120% 80% at 90% -10%, ${accent}40, transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))`,
          }}>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50, letterSpacing: 0.4, textTransform: 'uppercase' }}>Patrimônio</div>
            <div style={{ fontFamily: T.display, fontSize: 36, fontWeight: 600, color: T.ink, letterSpacing: -1.3, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{fmt.usd(124580.32)}</div>
            <div style={{ marginTop: 4, fontFamily: T.body, fontSize: 12, color: T.up, fontWeight: 600 }}>+$2,134 · +1.74% hoje</div>
            <div style={{ marginTop: 8, marginLeft: -6, marginRight: -6 }}>
              <AreaChart values={genSeries(11, 40, 124580, 0.012, 0.001)} w={328} h={60} color={accent} fillId="grid-fill" strokeWidth={1.8}/>
            </div>
          </PraxiaCard>

          {/* small tiles */}
          <PraxiaCard padding={12}>
            <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50, letterSpacing: 0.4, textTransform: 'uppercase' }}>Disponível</div>
            <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{fmt.usd(7150)}</div>
            <div style={{ marginTop: 8, fontFamily: T.body, fontSize: 11.5, color: accent, fontWeight: 600 }}>+ Aportar</div>
          </PraxiaCard>

          <PraxiaCard padding={12}>
            <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50, letterSpacing: 0.4, textTransform: 'uppercase' }}>Dividendos / mês</div>
            <div style={{ fontFamily: T.display, fontSize: 19, fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{fmt.usd(312.40)}</div>
            <div style={{ marginTop: 8, fontFamily: T.body, fontSize: 11.5, color: T.up, fontWeight: 600 }}>↑ 12% YoY</div>
          </PraxiaCard>

          {/* Pra tile */}
          <PraxiaCard padding={14} style={{
            gridColumn: '1 / 3',
            background: `linear-gradient(160deg, ${accent}22 0%, ${accent}05 100%)`,
            border: `0.5px solid ${accent}44`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {Icon.praMark(24, '#fff', accent)}
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>Pra · análise da semana</div>
            </div>
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink, lineHeight: 1.45 }}>
              Sua carteira venceu o IBOV em 1.8pp este mês. <b>NVDA</b> e <b>WEGE3</b> puxaram o resultado. Quer que eu sugira como travar parte do lucro?
            </div>
          </PraxiaCard>

          {/* top stocks tiles */}
          {Stocks.slice(0, 4).map(s => (
            <PraxiaCard key={s.tk} padding={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <StockAvatar stock={s} size={22}/>
                <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 12, color: T.ink }}>{s.tk}</div>
              </div>
              <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 13, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{fmt.usd(s.price)}</div>
              <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 11, color: s.chg >= 0 ? T.up : T.down, fontWeight: 600 }}>{fmt.pct(s.chg)}</div>
            </PraxiaCard>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  VarOnboardingTypeLed, VarHomeDense, VarHomeGrid, VarChatFullscreen, VarChatPopover,
});
