// brand-app.jsx — Praxia v3 — Private banking + modern fintech direction

function BrandPage() {
  const options = [
    {
      id: '01',
      name: 'Engraved',
      tagline: 'Pequenas maiúsculas serifadas, espaçadas como inscrição em pedra. Filete dourado abaixo.',
      Wordmark: WMEngraved,
      Companion: SealMark,
      recommended: true,
    },
    {
      id: '02',
      name: 'Establishment',
      tagline: 'Mista case em Playfair, com o "x" em itálico — detalhe sutil de personalidade.',
      Wordmark: WMEstablishment,
      Companion: PlateMark,
    },
    {
      id: '03',
      name: 'Signature',
      tagline: 'Itálico em Cormorant Garamond, como a assinatura de um banker. Intimista.',
      Wordmark: WMSignature,
      Companion: null,
    },
    {
      id: '04',
      name: 'Inscription',
      tagline: 'Letras separadas por interpuncts dourados — referência romana ao praxis grego.',
      Wordmark: WMInscription,
      Companion: TesseraMark,
    },
    {
      id: '05',
      name: 'Duet',
      tagline: 'Wordmark + filete + descritor mono. Lock-up institucional, BTG-coded.',
      Wordmark: WMDuet,
      Companion: SealMark,
    },
    {
      id: '06',
      name: 'Initial',
      tagline: 'P grande serifado como protagonista, "RAXIA" como sub-elemento. Funciona como favicon.',
      Wordmark: WMMonogram,
      Companion: null,
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#06060a',
      padding: '72px 48px 120px',
      fontFamily: '"Manrope", system-ui, sans-serif',
      color: PALETTE.ink,
    }}>
      {/* page header */}
      <div style={{ maxWidth: 820, margin: '0 auto 56px' }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
          color: PALETTE.inkFaint, letterSpacing: 1.8, marginBottom: 18,
        }}>PRAXIA · BRAND IDENTITY · v03 — PRIVATE EDITION</div>
        <h1 style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontSize: 60, fontWeight: 500,
          letterSpacing: -0.5, lineHeight: 1.0, margin: 0,
          color: PALETTE.ink, textWrap: 'balance',
        }}>
          A tipografia <span style={{ fontStyle: 'italic' }}>é</span> a marca.
        </h1>
        <p style={{
          marginTop: 22, fontSize: 15, lineHeight: 1.65,
          color: PALETTE.inkDim, maxWidth: 580,
        }}>
          Direção: referências BTG/XP — tradição de private banking servida com a
          clareza de uma fintech moderna. Sem ícones genéricos, sem geometria fria.
          Serif refinado em preto e branco com dourado discreto como único acento.
          Cada opção abaixo mostra o mark em fundo escuro grande, em duas escalas funcionais,
          um selo companheiro opcional, e a versão em papel creme. A recomendação é
          {' '}<b style={{ color: PALETTE.ink }}>01 Engraved</b> — leitura imediata, autoridade clássica,
          e o filete dourado dá personalidade sem ruído.
        </p>

        <div style={{ marginTop: 30, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            color: PALETTE.inkFaint, letterSpacing: 1.4,
          }}>PALETA</div>
          <Swatch color="#0a0a10" label="Onyx"/>
          <Swatch color="#f1eadb" label="Vellum"/>
          <Swatch color="#c8a25c" label="Gold"/>
        </div>
      </div>

      {/* cards */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        {options.map(o => (
          <BrandCard key={o.id} id={o.id} name={o.name} tagline={o.tagline} recommended={o.recommended}>
            <BrandShowcase Wordmark={o.Wordmark} Companion={o.Companion}/>
          </BrandCard>
        ))}
      </div>

      {/* footer */}
      <div style={{
        maxWidth: 820, margin: '60px auto 0',
        padding: '24px 0', borderTop: `0.5px solid ${PALETTE.rule}`,
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        color: PALETTE.inkFaint, letterSpacing: 1.4,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>PRÓXIMO PASSO</span>
        <span>ESCOLHA UMA · EU APLICO NO APP</span>
      </div>
    </div>
  );
}

function Swatch({ color, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 18, height: 18, borderRadius: 2,
        background: color, border: '0.5px solid rgba(255,255,255,0.10)',
      }}/>
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: 13, fontStyle: 'italic',
        color: PALETTE.inkDim,
      }}>{label}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<BrandPage/>);
