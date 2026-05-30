import { useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { Icon } from "../Icon";
import { CVMDisclaimerFooter } from "../CVMDisclaimerFooter";
import { PRO_PRICE_BRL, FREE_MONTHLY_LIMIT } from "@/lib/billing";
import { startProCheckout } from "@/lib/checkoutClient";
import type { Plan, Subscription, UsageThisMonth } from "@/types/stock";

/**
 * Tela "Gerenciar plano" — acessível via Profile (só com billing ligado).
 * Free: mostra uso do mês + CTA assinar. Pro: status, renovação e como cancelar.
 */

interface ScreenBillingProps {
  plan: Plan;
  subscription: Subscription | null;
  usageThisMonth: UsageThisMonth | null;
  accent?: string;
  onBack: () => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ScreenBilling({
  plan,
  subscription,
  usageThisMonth,
  accent = PraxiaTokens.accent,
  onBack,
}: ScreenBillingProps) {
  const T = PraxiaTokens;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = plan === "pro";
  const used = usageThisMonth?.total ?? 0;
  const pct = Math.min(100, Math.round((used / FREE_MONTHLY_LIMIT) * 100));

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    const r = await startProCheckout();
    if (!r.ok) {
      setError(r.error);
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100%", padding: "0 18px 96px" }}>
      <PraxiaBackground />

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 0 14px" }}>
        <button
          onClick={onBack}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
          aria-label="Voltar"
        >
          <Icon.arrowLeft size={18} color={T.ink70} />
        </button>
        <span style={{ fontFamily: T.display, fontSize: 18, fontWeight: 600, color: T.ink }}>
          Gerenciar plano
        </span>
      </div>

      <PraxiaCard>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontFamily: T.display, fontSize: 20, fontWeight: 700, color: T.ink }}>
            {isPro ? "Praxia Pro" : "Plano Free"}
          </span>
          {isPro && (
            <span
              style={{
                fontFamily: T.body,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                padding: "3px 8px",
                borderRadius: 999,
                background: `${accent}22`,
                color: accent,
                textTransform: "uppercase",
              }}
            >
              {subscription?.status ?? "ativo"}
            </span>
          )}
        </div>

        {isPro ? (
          <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink70, lineHeight: 1.6 }}>
            <div>Valor: R$ {(subscription?.amountBRL ?? PRO_PRICE_BRL).toFixed(2).replace(".", ",")}/mês</div>
            <div>Próxima renovação: {fmtDate(subscription?.currentPeriodEnd ?? null)}</div>
            {subscription?.status === "cancelled" && (
              <div style={{ color: T.warn, marginTop: 6 }}>
                Cancelada — acesso mantido até {fmtDate(subscription?.currentPeriodEnd ?? null)}.
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink70, marginBottom: 10 }}>
              {used} de {FREE_MONTHLY_LIMIT} consultas de IA usadas este mês
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: pct >= 100 ? T.down : accent,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </>
        )}
      </PraxiaCard>

      {!isPro && (
        <>
          {error && (
            <div style={{ fontFamily: T.body, fontSize: 12, color: T.down, margin: "12px 2px 0" }}>
              {error}
            </div>
          )}
          <button
            onClick={handleSubscribe}
            disabled={loading}
            style={{
              width: "100%",
              marginTop: 14,
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
        </>
      )}

      {isPro && (
        <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50, marginTop: 16, lineHeight: 1.6 }}>
          Para cancelar a assinatura, acesse sua conta no Mercado Pago → Assinaturas. O acesso Pro
          continua até o fim do período já pago.
        </div>
      )}

      <CVMDisclaimerFooter />
    </div>
  );
}
