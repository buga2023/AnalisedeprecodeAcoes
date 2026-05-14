import { useEffect, useMemo, useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { SectionHeader } from "../SectionHeader";
import { PraMark } from "../PraMark";
import { CompareTable } from "../CompareTable";
import type { InvestorProfile, Stock } from "@/types/stock";
import { calculateGrahamValue, calculateMarginOfSafety } from "@/lib/calculators";
import {
  compararAcoesComIA,
  toPortfolioData,
  type ComparacaoIA,
} from "@/lib/ai";

interface ScreenCompareProps {
  accent?: string;
  stocks: Stock[];
  selectedTickers: string[];
  profile: InvestorProfile | null;
  onBack: () => void;
  onRemoveTicker: (ticker: string) => void;
  onAddTicker?: () => void;
}

const MAX_COMPARE = 4;
const CACHE_PREFIX = "stocks-ai-comparison:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function makeSignature(stocks: Stock[]): string {
  return stocks
    .map((s) => s.ticker)
    .sort()
    .join("|");
}

function readCache(sig: string): ComparacaoIA | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + sig);
    if (!raw) return null;
    const { savedAt, payload } = JSON.parse(raw) as { savedAt: number; payload: ComparacaoIA };
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function writeCache(sig: string, payload: ComparacaoIA) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + sig,
      JSON.stringify({ savedAt: Date.now(), payload })
    );
  } catch {
    // localStorage quota: ignore
  }
}

export function ScreenCompare({
  accent = PraxiaTokens.accent,
  stocks,
  selectedTickers,
  profile,
  onBack,
  onRemoveTicker,
  onAddTicker,
}: ScreenCompareProps) {
  const T = PraxiaTokens;
  const selected = useMemo(
    () =>
      selectedTickers
        .map((t) => stocks.find((s) => s.ticker === t))
        .filter((s): s is Stock => !!s),
    [selectedTickers, stocks]
  );

  const signature = makeSignature(selected);

  const [analysis, setAnalysis] = useState<ComparacaoIA | null>(() =>
    selected.length >= 2 ? readCache(signature) : null
  );
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Reset analysis when the selection changes
  useEffect(() => {
    setAiError(null);
    setAnalysis(selected.length >= 2 ? readCache(signature) : null);
  }, [signature, selected.length]);

  const handleAnalyze = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setAiError(null);
    try {
      const data = selected.map((s) => {
        const graham = calculateGrahamValue(s.lpa, s.vpa);
        return toPortfolioData({
          ...s,
          grahamValue: graham,
          marginOfSafety:
            graham > 0 ? calculateMarginOfSafety(s.price, graham) * 100 : 0,
        });
      });
      const result = await compararAcoesComIA(data, profile);
      setAnalysis(result);
      writeCache(signature, result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erro ao gerar comparação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="praxia-scroll"
      style={{
        position: "relative",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "54px 16px 120px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 22,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.4,
              flex: 1,
            }}
          >
            Comparar ações
          </div>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 11,
              color: T.ink50,
              letterSpacing: 0.4,
            }}
          >
            {selected.length}/{MAX_COMPARE}
          </div>
        </div>

        {selected.length === 0 && (
          <PraxiaCard padding={20}>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink70,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Adicione 2 a 4 ações para comparar. Abra uma ação na carteira e toque em{" "}
              <b style={{ color: T.ink }}>Comparar</b>.
            </div>
            {onAddTicker && (
              <button
                onClick={onAddTicker}
                style={{
                  marginTop: 14,
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  background: accent,
                  color: "white",
                  border: "none",
                  fontFamily: T.display,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: `0 6px 18px ${accent}55`,
                }}
              >
                Escolher ações
              </button>
            )}
          </PraxiaCard>
        )}

        {selected.length > 0 && (
          <CompareTable
            stocks={selected}
            accent={accent}
            winnerTicker={analysis?.vencedor}
            onRemove={onRemoveTicker}
          />
        )}

        {selected.length >= 2 && (
          <PraxiaCard
            padding={16}
            style={{
              background: `linear-gradient(160deg, ${accent}1f 0%, ${accent}08 60%, rgba(255,255,255,0.01) 100%)`,
              border: `0.5px solid ${accent}44`,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flexShrink: 0 }}>
                <PraMark size={36} accent={accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: T.display,
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: T.ink,
                  }}
                >
                  Análise IA comparativa
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: T.body,
                    fontSize: 12,
                    color: T.ink50,
                    lineHeight: 1.5,
                  }}
                >
                  {analysis
                    ? "Resultado em cache (atualiza após 24h)."
                    : "Pra avalia qual ativo encaixa melhor no seu perfil, com pros e contras citados."}
                </div>
                <button
                  disabled={loading}
                  onClick={handleAnalyze}
                  style={{
                    marginTop: 12,
                    padding: "9px 16px",
                    borderRadius: 10,
                    background: accent,
                    color: "white",
                    border: "none",
                    fontFamily: T.display,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    boxShadow: `0 8px 20px ${accent}55`,
                  }}
                >
                  {loading
                    ? "Analisando…"
                    : analysis
                      ? "Refazer análise"
                      : "Analisar comparação"}
                </button>
                {aiError && (
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: T.body,
                      fontSize: 11.5,
                      color: T.down,
                    }}
                  >
                    {aiError}
                  </div>
                )}
              </div>
            </div>
          </PraxiaCard>
        )}

        {analysis && (
          <>
            <SectionHeader label="Veredito" />
            <PraxiaCard padding={16}>
              <div
                style={{
                  fontFamily: T.body,
                  fontSize: 13.5,
                  color: T.ink,
                  lineHeight: 1.55,
                }}
              >
                {analysis.resumo}
              </div>
              {analysis.fontes?.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: T.mono,
                    fontSize: 10,
                    color: T.ink50,
                    letterSpacing: 0.4,
                  }}
                >
                  fontes: {analysis.fontes.join(" · ")}
                </div>
              )}
            </PraxiaCard>

            <SectionHeader label="Por ativo" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {analysis.itens.map((it) => {
                const isWinner = it.ticker === analysis.vencedor;
                const recColor =
                  it.recomendacao === "COMPRAR"
                    ? T.up
                    : it.recomendacao === "VENDER"
                      ? T.down
                      : T.warn;
                return (
                  <PraxiaCard
                    key={it.ticker}
                    padding={14}
                    style={{
                      border: isWinner ? `0.5px solid ${accent}66` : undefined,
                      background: isWinner
                        ? `linear-gradient(160deg, ${accent}14 0%, rgba(255,255,255,0.012) 100%)`
                        : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: T.display,
                          fontWeight: 700,
                          fontSize: 14,
                          color: T.ink,
                        }}
                      >
                        {it.ticker}
                      </div>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: `${recColor}1f`,
                          color: recColor,
                          fontFamily: T.display,
                          fontWeight: 700,
                          fontSize: 10.5,
                          letterSpacing: 0.6,
                        }}
                      >
                        {it.recomendacao}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: T.body,
                        fontSize: 13,
                        color: T.ink,
                        lineHeight: 1.5,
                      }}
                    >
                      {it.tese}
                    </div>
                    {(it.pros.length > 0 || it.contras.length > 0) && (
                      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                        {it.pros.map((p, idx) => (
                          <div
                            key={`p-${idx}`}
                            style={{
                              fontFamily: T.body,
                              fontSize: 12,
                              color: T.ink70,
                              display: "flex",
                              gap: 6,
                            }}
                          >
                            <span style={{ color: T.up, fontWeight: 700 }}>+</span>
                            <span>{p}</span>
                          </div>
                        ))}
                        {it.contras.map((c, idx) => (
                          <div
                            key={`c-${idx}`}
                            style={{
                              fontFamily: T.body,
                              fontSize: 12,
                              color: T.ink70,
                              display: "flex",
                              gap: 6,
                            }}
                          >
                            <span style={{ color: T.down, fontWeight: 700 }}>−</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {it.fontes?.length > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          fontFamily: T.mono,
                          fontSize: 10,
                          color: T.ink50,
                          letterSpacing: 0.4,
                        }}
                      >
                        fontes: {it.fontes.join(" · ")}
                      </div>
                    )}
                  </PraxiaCard>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
