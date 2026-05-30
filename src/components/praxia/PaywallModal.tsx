import { useState } from "react";
import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";
import { CVMDisclaimerFooter } from "./CVMDisclaimerFooter";
import { PRO_PRICE_BRL, FREE_MONTHLY_LIMIT, featureLabels } from "@/lib/billing";
import { startProCheckout } from "@/lib/checkoutClient";
import type { PaywallRequiredPayload } from "@/types/stock";

/**
 * Modal de paywall — disparado quando uma chamada IA bate o limite free (402).
 * Sibling de `AppShell` em `App.tsx`. Inerte com billing dormente (nunca recebe
 * payload porque o servidor não devolve 402).
 */

interface PaywallModalProps {
  payload: PaywallRequiredPayload | null;
  accent?: string;
  onClose: () => void;
}

const PRO_BENEFITS = [
  "Consultas de IA ilimitadas",
  featureLabels["portfolio-insights"],
  featureLabels["optimize-dividends"],
  featureLabels.digest,
  featureLabels.screener,
  featureLabels["fundamentals-history"],
];

export function PaywallModal({ payload, accent = PraxiaTokens.accent, onClose }: PaywallModalProps) {
  const T = PraxiaTokens;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!payload) return null;

  const used = payload.currentUsage || FREE_MONTHLY_LIMIT;
  const limit = payload.limit || FREE_MONTHLY_LIMIT;

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    const r = await startProCheckout();
    if (!r.ok) {
      setError(r.error);
      setLoading(false);
    }
    // Em sucesso o browser redireciona pro Mercado Pago — não precisa resetar.
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 60,
          background: "rgba(2, 3, 20, 0.6)",
          backdropFilter: "blur(6px)",
          animation: "praFadeIn 0.2s ease-out",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          background: `
            radial-gradient(120% 60% at 80% 0%, ${accent}22 0%, transparent 50%),
            linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 85%)
          `,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          border: `0.5px solid ${T.hairlineStrong}`,
          padding: "8px 18px 22px",
          animation: "praSlideUp 0.32s cubic-bezier(.2,.7,.3,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: `linear-gradient(140deg, ${accent}, ${accent}88)`,
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon.star size={18} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.display, fontSize: 18, fontWeight: 600, color: T.ink }}>
              Praxia Pro
            </div>
            <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50 }}>
              Você usou {used} de {limit} consultas de IA grátis este mês
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.03)",
            border: `0.5px solid ${T.hairline}`,
            marginBottom: 16,
          }}
        >
          {PRO_BENEFITS.map((b) => (
            <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon.check size={14} color={accent} />
              <span style={{ fontFamily: T.body, fontSize: 13, color: T.ink70 }}>{b}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ fontFamily: T.body, fontSize: 12, color: T.down, marginBottom: 10 }}>{error}</div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 16,
            border: "none",
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: "white",
            fontFamily: T.display,
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Abrindo checkout…" : `Assinar Pro — R$ ${PRO_PRICE_BRL.toFixed(0)}/mês`}
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "10px 0",
            marginTop: 8,
            background: "transparent",
            border: "none",
            color: T.ink50,
            fontFamily: T.body,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Agora não
        </button>

        <CVMDisclaimerFooter />
      </div>
    </>
  );
}
