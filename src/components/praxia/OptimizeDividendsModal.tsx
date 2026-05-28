import { useEffect, useState } from "react";
import { PraxiaTokens, fmt } from "./tokens";
import { GlassButton } from "./GlassButton";
import { Icon } from "./Icon";
import { PraxiaCard } from "./PraxiaCard";
import { CVMDisclaimerFooter } from "./CVMDisclaimerFooter";
import { useDividendCalendar } from "@/hooks/useDividendCalendar";
import { otimizarDividendos, type DividendOptimization } from "@/lib/aiDividends";
import type { InvestorProfile, Stock } from "@/types/stock";

interface OptimizeDividendsModalProps {
  open: boolean;
  onClose: () => void;
  stocks: Stock[];
  profile: InvestorProfile | null;
  /** Total anual projetado, calculado pelo `ScreenDividends` (evita rodar o hook 2x). */
  annualProjected: number;
  accent?: string;
}

const ACAO_LABELS: Record<DividendOptimization["sugestoes"][number]["acao"], string> = {
  manter: "Manter",
  aumentar: "Aumentar",
  reduzir: "Reduzir",
  adicionar: "Adicionar",
};

export function OptimizeDividendsModal({
  open,
  onClose,
  stocks,
  profile,
  annualProjected,
  accent = PraxiaTokens.accent,
}: OptimizeDividendsModalProps) {
  const T = PraxiaTokens;
  const { buckets } = useDividendCalendar(stocks);
  const [result, setResult] = useState<DividendOptimization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Cada abertura roda uma nova consulta — feature inteira é cara de cachear
    // do lado do cliente porque depende do perfil + buckets do momento.
    // Resets ficam dentro da IIFE async (microtask) pra não disparar setState
    // sincronamente no body do effect (regra react-hooks/set-state-in-effect).
    let cancelled = false;
    void (async () => {
      setResult(null);
      setError(null);
      setLoading(true);
      try {
        const r = await otimizarDividendos(stocks, buckets, profile);
        if (!cancelled) setResult(r);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Falha ao consultar IA.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, stocks, buckets, profile]);

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
        {/* Grip */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.2)",
            }}
          />
        </div>

        {/* Header */}
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
            }}
          >
            <Icon.invest size={16} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 16,
                fontWeight: 600,
                color: T.ink,
                letterSpacing: -0.3,
              }}
            >
              Otimizar renda passiva
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 11.5,
                color: T.ink50,
                letterSpacing: 0.3,
              }}
            >
              Total atual projetado · {fmt.brl(annualProjected)}/ano
            </div>
          </div>
          <GlassButton onClick={onClose} ariaLabel="Fechar">
            <Icon.close size={14} color={T.ink70} />
          </GlassButton>
        </div>

        {/* Conteúdo scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 16px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {loading && (
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink70,
                textAlign: "center",
                padding: "40px 0",
                letterSpacing: 0.3,
              }}
            >
              Pra está analisando seu perfil + cadência de pagamentos…
            </div>
          )}

          {error && !loading && (
            <PraxiaCard
              padding={14}
              style={{
                background: `${T.down}10`,
                border: `0.5px solid ${T.down}55`,
              }}
            >
              <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink }}>
                {error}
              </div>
            </PraxiaCard>
          )}

          {result && !loading && (
            <>
              <PraxiaCard padding={16} raised>
                <div
                  style={{
                    fontFamily: T.body,
                    fontSize: 10.5,
                    color: T.ink50,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                >
                  Resumo · análise IA
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: T.body,
                    fontSize: 13,
                    color: T.ink,
                    lineHeight: 1.55,
                  }}
                >
                  {result.resumo}
                </div>
                {result.fontes.length > 0 && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {result.fontes.map((f, i) => (
                      <span
                        key={`${f}-${i}`}
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          color: T.ink70,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: T.surfaceInk,
                          border: `0.5px solid ${T.hairline}`,
                          letterSpacing: 0.3,
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </PraxiaCard>

              {result.sugestoes.length === 0 && (
                <PraxiaCard padding={16}>
                  <div
                    style={{
                      fontFamily: T.body,
                      fontSize: 12.5,
                      color: T.ink70,
                      lineHeight: 1.5,
                    }}
                  >
                    A IA não sugeriu mudanças — a carteira parece equilibrada
                    para o seu perfil agora.
                  </div>
                </PraxiaCard>
              )}

              {result.sugestoes.map((sug, idx) => (
                <PraxiaCard key={`${sug.ticker}-${idx}`} padding={14}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: T.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.ink,
                        letterSpacing: 0.4,
                      }}
                    >
                      {sug.ticker}
                    </div>
                    <span
                      style={{
                        fontFamily: T.body,
                        fontSize: 11,
                        fontWeight: 600,
                        color: accent,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: `${accent}1f`,
                        border: `0.5px solid ${accent}55`,
                        letterSpacing: 0.3,
                      }}
                    >
                      {ACAO_LABELS[sug.acao]}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: T.body,
                      fontSize: 12.5,
                      color: T.ink70,
                      lineHeight: 1.55,
                    }}
                  >
                    {sug.tese}
                  </div>
                  {sug.impactoEstimado && (
                    <div
                      style={{
                        marginTop: 8,
                        fontFamily: T.mono,
                        fontSize: 11.5,
                        color: T.up,
                        letterSpacing: 0.3,
                      }}
                    >
                      Impacto estimado: {sug.impactoEstimado}
                    </div>
                  )}
                  {sug.fontes.length > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                      }}
                    >
                      {sug.fontes.map((f, i) => (
                        <span
                          key={`${sug.ticker}-fonte-${i}`}
                          style={{
                            fontFamily: T.mono,
                            fontSize: 9.5,
                            color: T.ink50,
                            padding: "2px 7px",
                            borderRadius: 999,
                            background: T.surfaceInk,
                            border: `0.5px solid ${T.hairline}`,
                          }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </PraxiaCard>
              ))}
              <CVMDisclaimerFooter />
            </>
          )}
        </div>
      </div>
    </>
  );
}
