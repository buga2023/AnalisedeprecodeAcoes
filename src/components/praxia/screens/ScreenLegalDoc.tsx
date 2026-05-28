import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { SectionHeader } from "../SectionHeader";
import { Icon } from "../Icon";
import { PRIVACY_POLICY, TERMS_OF_USE } from "@/lib/legal";

/**
 * Tela genérica para documentos legais (Privacidade / Termos).
 *
 * O conteúdo vem de `lib/legal.ts` — fonte única da verdade, versionada.
 * Mantemos isso como tela SPA (sem rota) porque o Praxia é single-screen
 * union (ver `App.tsx:type Screen`).
 */

type LegalDoc = "privacy" | "terms";

interface ScreenLegalDocProps {
  accent?: string;
  doc: LegalDoc;
  onBack: () => void;
}

export function ScreenLegalDoc({ accent, doc, onBack }: ScreenLegalDocProps) {
  const T = PraxiaTokens;
  const accentColor = accent || T.accent;
  const data = doc === "privacy" ? PRIVACY_POLICY : TERMS_OF_USE;

  return (
    <div style={{ position: "relative", paddingBottom: 40 }}>
      <PraxiaBackground accent={accentColor} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "24px 20px 12px",
        }}
      >
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: T.ink70,
            fontFamily: T.body,
            fontSize: 12.5,
            cursor: "pointer",
            padding: 0,
            marginBottom: 18,
          }}
        >
          <Icon.arrowLeft size={14} color={T.ink70} />
          Voltar
        </button>

        <SectionHeader label={data.titulo} />

        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10.5,
            color: T.ink50,
            letterSpacing: 0.6,
            marginTop: -4,
            marginBottom: 14,
          }}
        >
          VIGOR · {data.vigorEm}
        </div>

        <p
          style={{
            marginTop: 0,
            fontFamily: T.body,
            fontSize: 13.5,
            color: T.ink70,
            lineHeight: 1.55,
          }}
        >
          {data.intro}
        </p>
      </div>

      <div style={{ padding: "8px 20px 24px", position: "relative", zIndex: 1 }}>
        {data.secoes.map((sec, idx) => (
          <section key={idx} style={{ marginBottom: 22 }}>
            <h3
              style={{
                margin: 0,
                fontFamily: T.display,
                fontSize: 15,
                fontWeight: 600,
                color: T.ink,
                letterSpacing: -0.1,
                marginBottom: 8,
              }}
            >
              {sec.titulo}
            </h3>
            {sec.conteudo.map((paragrafo, i) => (
              <p
                key={i}
                style={{
                  margin: "0 0 8px 0",
                  fontFamily: T.body,
                  fontSize: 13,
                  color: T.ink70,
                  lineHeight: 1.55,
                }}
              >
                {paragrafo}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
