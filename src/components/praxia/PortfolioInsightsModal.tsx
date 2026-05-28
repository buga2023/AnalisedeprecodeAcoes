import { PraxiaTokens } from "./tokens";
import { GlassButton } from "./GlassButton";
import { Icon } from "./Icon";
import { PortfolioInsightsContent } from "./PortfolioInsightsContent";
import { riskLabel } from "@/hooks/useInvestorProfile";
import type { InvestorProfile, Stock } from "@/types/stock";

interface PortfolioInsightsModalProps {
  open: boolean;
  onClose: () => void;
  stocks: Stock[];
  profile: InvestorProfile | null;
  accent?: string;
}

export function PortfolioInsightsModal({
  open,
  onClose,
  stocks,
  profile,
  accent = PraxiaTokens.accent,
}: PortfolioInsightsModalProps) {
  const T = PraxiaTokens;
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
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
          zIndex: 51,
          height: "90%",
          background: `
            radial-gradient(120% 60% at 80% 0%, ${accent}22 0%, transparent 50%),
            linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 80%)
          `,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          border: `0.5px solid ${T.hairlineStrong}`,
          display: "flex",
          flexDirection: "column",
          animation: "praSlideUp 0.32s cubic-bezier(.2,.7,.3,1)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px 14px",
            borderBottom: `0.5px solid ${T.hairline}`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: `linear-gradient(140deg, ${accent}, ${accent}88)`,
              display: "grid",
              placeItems: "center",
              boxShadow: `0 4px 12px ${accent}44`,
            }}
          >
            <Icon.invest size={18} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 15, color: T.ink }}>
              Análise IA do portfólio
            </div>
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50 }}>
              {stocks.length} {stocks.length === 1 ? "ativo" : "ativos"}
              {profile ? ` · perfil ${riskLabel(profile.risk).toLowerCase()}` : " · perfil não definido"}
            </div>
          </div>
          <GlassButton onClick={onClose} ariaLabel="Fechar">
            <Icon.close size={16} color={T.ink70} />
          </GlassButton>
        </div>

        <div
          className="praxia-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 18px 24px",
          }}
        >
          <PortfolioInsightsContent stocks={stocks} profile={profile} accent={accent} />
        </div>
      </div>
    </>
  );
}
