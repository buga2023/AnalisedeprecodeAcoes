import { useCallback, useEffect, useState } from "react";
import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { GlassButton } from "./GlassButton";
import { Icon } from "./Icon";
import { fetchAIInsights, toPortfolioData, type AIInsight, type AIResponse } from "@/lib/ai";
import type { InvestorProfile, Stock } from "@/types/stock";
import { renderWithLinks, SourceChip } from "./Citations";
import { riskLabel } from "@/hooks/useInvestorProfile";

interface PortfolioInsightsModalProps {
  open: boolean;
  onClose: () => void;
  stocks: Stock[];
  profile: InvestorProfile | null;
  accent?: string;
}

const CACHE_KEY = "stocks-ai-portfolio-insights";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  timestamp: number;
  signature: string;
  response: AIResponse;
}

function portfolioSignature(stocks: Stock[]): string {
  return stocks
    .map((s) => `${s.ticker}:${s.quantity}`)
    .sort()
    .join("|");
}

function readCache(signature: string): { response: AIResponse; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.signature !== signature) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return { response: entry.response, timestamp: entry.timestamp };
  } catch {
    return null;
  }
}

function writeCache(signature: string, response: AIResponse) {
  const entry: CacheEntry = { timestamp: Date.now(), signature, response };
  localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
}

function sentimentColor(s: AIResponse["sentimento"]): string {
  if (s === "otimista") return PraxiaTokens.up;
  if (s === "pessimista") return PraxiaTokens.down;
  return PraxiaTokens.warn;
}

function tipoColor(t: AIInsight["tipo"]): string {
  if (t === "alta") return PraxiaTokens.up;
  if (t === "baixa") return PraxiaTokens.down;
  if (t === "alerta") return PraxiaTokens.warn;
  return PraxiaTokens.ink70;
}

export function PortfolioInsightsModal({
  open,
  onClose,
  stocks,
  profile,
  accent = PraxiaTokens.accent,
}: PortfolioInsightsModalProps) {
  const T = PraxiaTokens;
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const signature = portfolioSignature(stocks);

  useEffect(() => {
    if (!open) return;
    const cached = readCache(signature);
    if (cached) {
      setResponse(cached.response);
      setGeneratedAt(cached.timestamp);
    } else {
      setResponse(null);
      setGeneratedAt(null);
    }
    setError(null);
  }, [open, signature]);

  const run = useCallback(async () => {
    if (stocks.length === 0) {
      setError("Adicione ações ao portfólio antes de gerar insights.");
      return;
    }
    if (!profile) {
      setError("Complete o quiz de perfil antes — as recomendações precisam estar ancoradas no seu perfil.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = stocks.map(toPortfolioData);
      const result = await fetchAIInsights(payload, profile);
      writeCache(signature, result);
      setResponse(result);
      setGeneratedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar insights.");
    } finally {
      setLoading(false);
    }
  }, [stocks, signature, profile]);

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
            linear-gradient(180deg, #0a1030 0%, #050818 80%)
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
              {generatedAt && response ? ` · ${new Date(generatedAt).toLocaleString("pt-BR")}` : ""}
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
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {!response && !loading && !error && (
            <PraxiaCard padding={16}>
              <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink70, lineHeight: 1.55, marginBottom: 14 }}>
                Gera 4–8 insights acionáveis sobre seu portfólio cobrindo tendência, valuation, saúde financeira,
                rentabilidade, dividendos e momentum.
              </div>
              <button
                onClick={run}
                disabled={stocks.length === 0}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: stocks.length === 0 ? "rgba(255,255,255,0.06)" : accent,
                  color: stocks.length === 0 ? T.ink30 : "white",
                  fontFamily: T.display,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: stocks.length === 0 ? "not-allowed" : "pointer",
                  boxShadow: stocks.length === 0 ? "none" : `0 8px 22px ${accent}55`,
                }}
              >
                {stocks.length === 0 ? "Adicione ações primeiro" : "Gerar insights"}
              </button>
            </PraxiaCard>
          )}

          {loading && (
            <PraxiaCard padding={16}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: T.body,
                  fontSize: 13,
                  color: T.ink70,
                }}
              >
                <span style={{ display: "inline-flex", gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        background: accent,
                        display: "inline-block",
                        animation: `praDot 1s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </span>
                Analisando portfólio com IA…
              </div>
            </PraxiaCard>
          )}

          {error && (
            <PraxiaCard padding={14}>
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.down, lineHeight: 1.5 }}>
                {error}
              </div>
              <button
                onClick={run}
                style={{
                  marginTop: 10,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `0.5px solid ${T.hairline}`,
                  background: "transparent",
                  color: T.ink,
                  fontFamily: T.body,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Tentar novamente
              </button>
            </PraxiaCard>
          )}

          {response && !loading && (
            <>
              <PraxiaCard
                padding={14}
                style={{
                  background: `linear-gradient(160deg, ${sentimentColor(response.sentimento)}1a 0%, ${sentimentColor(
                    response.sentimento
                  )}05 100%)`,
                  border: `0.5px solid ${sentimentColor(response.sentimento)}55`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.mono,
                      fontSize: 10,
                      letterSpacing: 0.6,
                      color: sentimentColor(response.sentimento),
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {response.sentimento}
                  </div>
                </div>
                <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
                  {renderWithLinks(response.resumo, accent)}
                </div>
                {(response.fontes ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {response.fontes.map((src, idx) => (
                      <SourceChip key={idx} source={src} accent={accent} />
                    ))}
                  </div>
                )}
              </PraxiaCard>

              {response.insights.map((insight, i) => (
                <PraxiaCard
                  key={i}
                  padding={14}
                  style={{
                    borderLeft: `3px solid ${tipoColor(insight.tipo)}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: T.display,
                        fontWeight: 600,
                        fontSize: 13.5,
                        color: T.ink,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {insight.titulo}
                    </div>
                    {insight.ticker && (
                      <div
                        style={{
                          fontFamily: T.mono,
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.06)",
                          color: T.ink70,
                          letterSpacing: 0.4,
                        }}
                      >
                        {insight.ticker}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9.5,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: `${tipoColor(insight.tipo)}22`,
                        color: tipoColor(insight.tipo),
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        fontWeight: 600,
                      }}
                    >
                      {insight.tipo}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9.5,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.06)",
                        color: T.ink50,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                      }}
                    >
                      {insight.categoria}
                    </span>
                    <span
                      style={{
                        fontFamily: T.mono,
                        fontSize: 9.5,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "rgba(255,255,255,0.06)",
                        color: T.ink50,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                      }}
                    >
                      conf. {insight.confianca}
                    </span>
                  </div>
                  <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink70, lineHeight: 1.55 }}>
                    {renderWithLinks(insight.descricao, accent)}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      borderTop: `0.5px dashed ${T.hairline}`,
                      paddingTop: 8,
                    }}
                  >
                    {(insight.fontes ?? []).length === 0 ? (
                      <span style={{ fontFamily: T.body, fontSize: 11, color: T.down }}>
                        (sem fontes — peça para regerar)
                      </span>
                    ) : (
                      (insight.fontes ?? []).map((src, idx) => (
                        <SourceChip key={idx} source={src} accent={accent} />
                      ))
                    )}
                  </div>
                </PraxiaCard>
              ))}

              <button
                onClick={run}
                disabled={loading}
                style={{
                  marginTop: 4,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `0.5px solid ${T.hairline}`,
                  background: "transparent",
                  color: T.ink50,
                  fontFamily: T.body,
                  fontSize: 12,
                  cursor: loading ? "not-allowed" : "pointer",
                  alignSelf: "flex-start",
                }}
              >
                Regerar análise
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
