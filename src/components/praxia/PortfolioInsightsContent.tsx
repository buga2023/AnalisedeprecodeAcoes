import { useCallback, useEffect, useState } from "react";
import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { fetchAIInsights, toPortfolioData, type AIResponse } from "@/lib/ai";
import { fetchMacroContext, type MacroContext } from "@/lib/context";
import type { InvestorProfile, Stock } from "@/types/stock";
import { renderWithLinks, SourceChip } from "./Citations";
import { riskLabel } from "@/hooks/useInvestorProfile";
import { DisclaimerBar } from "./DisclaimerBar";
import {
  portfolioSignature,
  readInsightsCache,
  sentimentColor,
  tipoColor,
  writeInsightsCache,
} from "./portfolioInsightsUtils";

interface PortfolioInsightsContentProps {
  stocks: Stock[];
  profile: InvestorProfile | null;
  accent?: string;
  /** Se true, o conteúdo é renderizado imediatamente sem esperar trigger externo */
  autoLoad?: boolean;
}

export function PortfolioInsightsContent({
  stocks,
  profile,
  accent = PraxiaTokens.accent,
  autoLoad = false,
}: PortfolioInsightsContentProps) {
  const T = PraxiaTokens;
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [macro, setMacro] = useState<MacroContext | null>(null);

  const signature = portfolioSignature(stocks);

  useEffect(() => {
    const cached = readInsightsCache(signature);
    if (cached) {
      setResponse(cached.response);
      setGeneratedAt(cached.timestamp);
    } else {
      setResponse(null);
      setGeneratedAt(null);
    }
    setError(null);
    fetchMacroContext().then((m) => setMacro(m));
  }, [signature]);

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
      writeInsightsCache(signature, result);
      setResponse(result);
      setGeneratedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar insights.");
    } finally {
      setLoading(false);
    }
  }, [stocks, signature, profile]);

  // Auto-load: dispara análise automaticamente se não há cache
  useEffect(() => {
    if (autoLoad && !response && !loading && stocks.length > 0 && profile) {
      run();
    }
    // run é estável pelo useCallback — depende de stocks/signature/profile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {macro && <MacroStrip macro={macro} accent={accent} />}

      {!response && !loading && !error && (
        <>
          <DisclaimerBar accent={accent} />
          <PraxiaCard padding={16}>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink70,
                lineHeight: 1.55,
                marginBottom: 14,
              }}
            >
              Gera 4–8{" "}
              <b style={{ color: T.ink }}>sugestões com fonte</b> sobre seu portfólio
              cobrindo tendência, valuation, saúde financeira, rentabilidade,
              dividendos e momentum. Cada item cita a origem.
            </div>
            <button
              onClick={run}
              disabled={stocks.length === 0}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: 12,
                border: "none",
                background:
                  stocks.length === 0 ? "rgba(255,255,255,0.06)" : accent,
                color: stocks.length === 0 ? T.ink30 : "white",
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 14,
                cursor: stocks.length === 0 ? "not-allowed" : "pointer",
                boxShadow:
                  stocks.length === 0 ? "none" : `0 8px 22px ${accent}55`,
              }}
            >
              {stocks.length === 0 ? "Adicione ações primeiro" : "Gerar sugestões"}
            </button>
          </PraxiaCard>
        </>
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
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12.5,
              color: T.down,
              lineHeight: 1.5,
            }}
          >
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
              background: `linear-gradient(160deg, ${sentimentColor(response.sentimento)}1a 0%, ${sentimentColor(response.sentimento)}05 100%)`,
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
              {generatedAt && (
                <div
                  style={{
                    marginLeft: "auto",
                    fontFamily: T.mono,
                    fontSize: 9,
                    color: T.ink30,
                  }}
                >
                  {new Date(generatedAt).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
            <div
              style={{ fontFamily: T.body, fontSize: 13, color: T.ink, lineHeight: 1.55 }}
            >
              {renderWithLinks(response.resumo, accent)}
            </div>
            {(response.fontes ?? []).length > 0 && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}
              >
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
              style={{ borderLeft: `3px solid ${tipoColor(insight.tipo)}` }}
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
                {[
                  { text: insight.tipo, color: tipoColor(insight.tipo), bg: `${tipoColor(insight.tipo)}22` },
                  { text: insight.categoria, color: T.ink50, bg: "rgba(255,255,255,0.06)" },
                  { text: `conf. ${insight.confianca}`, color: T.ink50, bg: "rgba(255,255,255,0.06)" },
                ].map((chip) => (
                  <span
                    key={chip.text}
                    style={{
                      fontFamily: T.mono,
                      fontSize: 9.5,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: chip.bg,
                      color: chip.color,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      fontWeight: chip.color === tipoColor(insight.tipo) ? 600 : 400,
                    }}
                  >
                    {chip.text}
                  </span>
                ))}
              </div>
              <div
                style={{
                  fontFamily: T.body,
                  fontSize: 12.5,
                  color: T.ink70,
                  lineHeight: 1.55,
                }}
              >
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

          <DisclaimerBar accent={accent} variant="inline" />
        </>
      )}

      {/* Informação de perfil */}
      {profile && (
        <div
          style={{
            fontFamily: T.body,
            fontSize: 11,
            color: T.ink30,
            textAlign: "center",
          }}
        >
          {stocks.length} {stocks.length === 1 ? "ativo" : "ativos"} · perfil{" "}
          {riskLabel(profile.risk).toLowerCase()}
        </div>
      )}
    </div>
  );
}

function MacroStrip({ macro, accent }: { macro: MacroContext; accent: string }) {
  const T = PraxiaTokens;
  const cells: { label: string; value: string; sub?: string }[] = [];
  if (macro.selicMeta.valor != null)
    cells.push({ label: "SELIC", value: `${macro.selicMeta.valor.toFixed(2)}%`, sub: macro.selicMeta.data ?? undefined });
  if (macro.ipca12m.valor != null)
    cells.push({ label: "IPCA 12m", value: `${macro.ipca12m.valor.toFixed(2)}%`, sub: macro.ipca12m.data ?? undefined });
  else if (macro.ipcaMensal.valor != null)
    cells.push({ label: "IPCA mês", value: `${macro.ipcaMensal.valor.toFixed(2)}%`, sub: macro.ipcaMensal.data ?? undefined });
  if (macro.cdi12m.valor != null)
    cells.push({ label: "CDI 12m", value: `${macro.cdi12m.valor.toFixed(2)}%` });
  if (macro.ibcbr.valor != null)
    cells.push({ label: "IBC-Br", value: macro.ibcbr.valor.toFixed(2), sub: macro.ibcbr.data ?? undefined });
  if (macro.ibovespa.price != null && macro.ibovespa.changePct != null)
    cells.push({
      label: "IBOV",
      value: `${macro.ibovespa.price.toFixed(0)} pts`,
      sub: `${macro.ibovespa.changePct >= 0 ? "+" : ""}${macro.ibovespa.changePct.toFixed(2)}%`,
    });
  if (cells.length === 0) return null;

  return (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink50, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, paddingLeft: 4 }}>
        Macro Brasil · contexto da análise
      </div>
      <div className="praxia-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {cells.map((c) => (
          <div
            key={c.label}
            style={{
              flex: "0 0 auto",
              minWidth: 96,
              padding: "8px 12px",
              borderRadius: 12,
              background: `linear-gradient(160deg, ${accent}10 0%, ${accent}03 100%)`,
              border: `0.5px solid ${accent}33`,
            }}
          >
            <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.ink50, letterSpacing: 0.6, textTransform: "uppercase" }}>{c.label}</div>
            <div style={{ marginTop: 2, fontFamily: T.mono, fontSize: 13, color: T.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
            {c.sub && <div style={{ fontFamily: T.body, fontSize: 9.5, color: T.ink30, marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 4, fontFamily: T.body, fontSize: 10, color: T.ink30, paddingLeft: 4 }}>
        fonte: {macro.source}
      </div>
    </div>
  );
}
