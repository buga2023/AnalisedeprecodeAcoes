// brand-logos.jsx — Praxia v3 — Private-bank serif wordmarks, sober palette.
// Inspired by BTG / XP institutional restraint. Type is the protagonist.

const PALETTE = {
  ink:     '#f4ecdf',     // warm parchment white
  inkDim:  'rgba(244,236,223,0.55)',
  inkFaint:'rgba(244,236,223,0.30)',
  bg:      '#0a0a10',     // near-black with slight cool tint
  bgWarm:  '#13110d',     // slightly warm dark for serif depth
  paper:   '#f1eadb',     // cream paper for light bg
  paperInk:'#1a1610',     // espresso brown-black
  gold:    '#c8a25c',     // discreet champagne gold
  goldDim: 'rgba(200,162,92,0.55)',
  rule:    'rgba(244,236,223,0.14)',
};

// ─── WORDMARKS ────────────────────────────────────────────────────────────

// W1 · ENGRAVED — Cormorant SC, tracked, gold rule
function WMEngraved({ size = 40, color = PALETTE.ink, gold = PALETTE.gold, showRule = true }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.22 }}>
      <div style={{
        fontFamily: '"Cormorant SC", "Cormorant Garamond", serif',
        fontSize: size, fontWeight: 500, color,
        letterSpacing: size * 0.18,
        lineHeight: 1, paddingLeft: size * 0.18,
      }}>PRAXIA</div>
      {showRule && (
        <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.2 }}>
          <div style={{ width: size * 0.4, height: 1, background: gold }}/>
          <div style={{ width: 3, height: 3, background: gold, transform: 'rotate(45deg)' }}/>
          <div style={{ width: size * 0.4, height: 1, background: gold }}/>
        </div>
      )}
    </div>
  );
}

// W2 · ESTABLISHMENT — Playfair Display, mixed case, confident
function WMEstablishment({ size = 40, color = PALETTE.ink, gold = PALETTE.gold }) {
  return (
    <div style={{
      fontFamily: '"Playfair Display", "Cormorant Garamond", serif',
      fontSize: size, fontWeight: 500, color,
      letterSpacing: -size * 0.012, lineHeight: 1,
      display: 'inline-flex', alignItems: 'baseline',
    }}>
      <span>Pra</span>
      <span style={{ fontStyle: 'italic', color }}>x</span>
      <span>ia</span>
    </div>
  );
}

// W3 · SIGNATURE — Cormorant Garamond italic, intimate
function WMSignature({ size = 44, color = PALETTE.ink, gold = PALETTE.gold }) {
  return (
    <div style={{
      fontFamily: '"Cormorant Garamond", "EB Garamond", serif',
      fontSize: size, fontWeight: 500, color, fontStyle: 'italic',
      letterSpacing: -size * 0.005, lineHeight: 1,
      display: 'inline-flex', alignItems: 'baseline', gap: size * 0.04,
    }}>
      <span>Praxia</span>
      <span style={{
        width: size * 0.12, height: size * 0.12, borderRadius: '50%',
        background: gold, display: 'inline-block',
        alignSelf: 'flex-end', marginBottom: size * 0.10,
      }}/>
    </div>
  );
}

// W4 · INSCRIPTION — Garamond all-caps with interpuncts, Roman feel
function WMInscription({ size = 28, color = PALETTE.ink, gold = PALETTE.gold }) {
  const letters = ['P','R','A','X','I','A'];
  return (
    <div style={{
      fontFamily: '"EB Garamond", "Cormorant Garamond", serif',
      fontSize: size, fontWeight: 500, color,
      display: 'inline-flex', alignItems: 'center', gap: size * 0.28,
      lineHeight: 1,
    }}>
      {letters.map((l, i) => (
        <React.Fragment key={i}>
          <span style={{ letterSpacing: size * 0.02 }}>{l}</span>
          {i < letters.length - 1 && (
            <span style={{
              width: size * 0.08, height: size * 0.08, borderRadius: '50%',
              background: gold, display: 'inline-block', alignSelf: 'center',
            }}/>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// W5 · DUET — Two-line institutional: wordmark + descriptor
function WMDuet({ size = 26, color = PALETTE.ink, gold = PALETTE.gold }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.28 }}>
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: size, fontWeight: 500, color,
        letterSpacing: size * 0.32, lineHeight: 1,
        paddingLeft: size * 0.32,
      }}>PRAXIA</div>
      <div style={{ width: size * 4, height: 1, background: gold, opacity: 0.7 }}/>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: size * 0.32, fontWeight: 500,
        color: PALETTE.inkDim, letterSpacing: size * 0.10,
        lineHeight: 1,
      }}>RESEARCH · PLANNING</div>
    </div>
  );
}

// W6 · MONOGRAM — Just "P" in Cormorant SC, as a standalone glyph
//      Pairs with a small "RAXIA" caption for full lockups.
function WMMonogram({ size = 64, color = PALETTE.ink, gold = PALETTE.gold }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.18 }}>
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: size, fontWeight: 500, color,
        lineHeight: 0.85, fontStyle: 'normal',
        position: 'relative', display: 'inline-block',
      }}>
        P
        <span style={{
          position: 'absolute',
          right: -size * 0.05, top: size * 0.18,
          width: size * 0.06, height: size * 0.06,
          background: gold, borderRadius: '50%',
        }}/>
      </div>
      <div style={{ width: 1, height: size * 0.55, background: PALETTE.rule }}/>
      <div style={{
        fontFamily: '"Cormorant SC", "Cormorant Garamond", serif',
        fontSize: size * 0.34, fontWeight: 500, color,
        letterSpacing: size * 0.04, lineHeight: 1,
      }}>RAXIA</div>
    </div>
  );
}

// ─── SEALS / MARKS (companion only — type is the protagonist) ──────────────

// Small circular seal — gold outline, monogram center. Like a wax seal.
function SealMark({ size = 56, gold = PALETTE.gold, ink = PALETTE.ink, label = 'PRX' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `1px solid ${gold}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 3, borderRadius: '50%',
        border: `0.5px solid ${gold}`, opacity: 0.5,
      }}/>
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: size * 0.42, fontWeight: 500, color: gold,
        letterSpacing: size * 0.02, lineHeight: 1,
      }}>{label}</div>
    </div>
  );
}

// A thin diamond "tessera" — gold inlay accent
function TesseraMark({ size = 56, gold = PALETTE.gold }) {
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: size * 0.5, height: size * 0.5,
        background: gold, transform: 'rotate(45deg)',
      }}/>
      <div style={{
        position: 'absolute',
        width: size * 0.25, height: size * 0.25,
        background: PALETTE.bg, transform: 'rotate(45deg)',
      }}/>
    </div>
  );
}

// A tall serif initial — "P" set in a thin gold frame
function PlateMark({ size = 56, gold = PALETTE.gold, ink = PALETTE.ink }) {
  return (
    <div style={{
      width: size * 0.78, height: size,
      border: `1px solid ${gold}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{
        fontFamily: '"Cormorant Garamond", serif',
        fontSize: size * 0.68, fontWeight: 500, color: ink,
        lineHeight: 1, transform: 'translateY(-2%)',
      }}>P</div>
      {/* corner ticks */}
      <div style={{ position: 'absolute', top: 3, left: 3, width: 4, height: 1, background: gold }}/>
      <div style={{ position: 'absolute', top: 3, left: 3, width: 1, height: 4, background: gold }}/>
      <div style={{ position: 'absolute', top: 3, right: 3, width: 4, height: 1, background: gold }}/>
      <div style={{ position: 'absolute', top: 3, right: 3, width: 1, height: 4, background: gold }}/>
      <div style={{ position: 'absolute', bottom: 3, left: 3, width: 4, height: 1, background: gold }}/>
      <div style={{ position: 'absolute', bottom: 3, left: 3, width: 1, height: 4, background: gold }}/>
      <div style={{ position: 'absolute', bottom: 3, right: 3, width: 4, height: 1, background: gold }}/>
      <div style={{ position: 'absolute', bottom: 3, right: 3, width: 1, height: 4, background: gold }}/>
    </div>
  );
}

// ─── PRESENTATION CARD ────────────────────────────────────────────────────
function BrandCard({ id, name, tagline, recommended, children, palette = PALETTE }) {
  return (
    <div style={{
      width: 820, background: palette.bg,
      border: `0.5px solid ${palette.rule}`,
      borderRadius: 4,
      fontFamily: '"Manrope", system-ui, sans-serif',
      color: palette.ink,
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '22px 32px',
        borderBottom: `0.5px solid ${palette.rule}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            color: palette.inkFaint, letterSpacing: 1.6,
          }}>{id}</div>
          <div style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontSize: 20, fontWeight: 500, letterSpacing: 0.4,
            color: palette.ink,
          }}>{name}</div>
          {recommended && (
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
              color: palette.gold, letterSpacing: 1.4,
              padding: '4px 8px',
              border: `0.5px solid ${palette.goldDim}`,
            }}>RECOMENDADA</div>
          )}
        </div>
        <div style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontStyle: 'italic', fontSize: 14,
          color: palette.inkDim, maxWidth: 420, textAlign: 'right',
        }}>{tagline}</div>
      </div>
      {children}
    </div>
  );
}

// Body of a card — three rows: hero dark / lockup variations / hero cream
function BrandShowcase({ Wordmark, Companion, palette = PALETTE }) {
  return (
    <>
      {/* hero dark — large, centered, breathing room */}
      <div style={{
        padding: '72px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        background: `radial-gradient(120% 80% at 50% 0%, ${palette.bgWarm} 0%, ${palette.bg} 70%)`,
      }}>
        {/* corner marks */}
        <CornerMarks color={palette.goldDim} inset={20}/>
        <Wordmark size={56} color={palette.ink} gold={palette.gold}/>
      </div>

      {/* mid row — scale tests + companion mark */}
      <div style={{
        padding: '28px 32px',
        borderTop: `0.5px solid ${palette.rule}`,
        borderBottom: `0.5px solid ${palette.rule}`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 24,
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: palette.inkFaint, letterSpacing: 1.4 }}>NAVEGAÇÃO · 14PX</div>
          <Wordmark size={14} color={palette.ink} gold={palette.gold}/>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: palette.inkFaint, letterSpacing: 1.4 }}>CARTÃO · 28PX</div>
          <Wordmark size={28} color={palette.ink} gold={palette.gold}/>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: palette.inkFaint, letterSpacing: 1.4 }}>SELO COMPANHEIRO</div>
          {Companion ? <Companion size={48} gold={palette.gold} ink={palette.ink}/> : (
            <div style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 12, fontStyle: 'italic', color: palette.inkFaint }}>sem selo</div>
          )}
        </div>
      </div>

      {/* hero cream */}
      <div style={{
        padding: '60px 32px',
        background: palette.paper,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <CornerMarks color="rgba(0,0,0,0.18)" inset={20}/>
        <Wordmark size={48} color={palette.paperInk} gold={palette.gold}/>
      </div>
    </>
  );
}

function CornerMarks({ color, inset = 20, len = 10 }) {
  const lineH = { position: 'absolute', height: 1, width: len, background: color };
  const lineV = { position: 'absolute', width: 1, height: len, background: color };
  return (
    <>
      <div style={{ ...lineH, top: inset, left: inset }}/>
      <div style={{ ...lineV, top: inset, left: inset }}/>
      <div style={{ ...lineH, top: inset, right: inset }}/>
      <div style={{ ...lineV, top: inset, right: inset }}/>
      <div style={{ ...lineH, bottom: inset, left: inset }}/>
      <div style={{ ...lineV, bottom: inset, left: inset }}/>
      <div style={{ ...lineH, bottom: inset, right: inset }}/>
      <div style={{ ...lineV, bottom: inset, right: inset }}/>
    </>
  );
}

Object.assign(window, {
  PALETTE,
  WMEngraved, WMEstablishment, WMSignature, WMInscription, WMDuet, WMMonogram,
  SealMark, TesseraMark, PlateMark,
  BrandCard, BrandShowcase, CornerMarks,
});
