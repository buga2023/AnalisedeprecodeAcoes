import { useCallback, useEffect, useState } from "react";
import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { Icon } from "./Icon";
import { analisarAcaoComIA, type AnaliseIA, type DadosQuantitativos } from "@/lib/ai";
import { calculateGrahamValue, calculateMarginOfSafety } from "@/lib/calculators";
import type { InvestorProfile, Stock } from "@/types/stock";
import { renderWithLinks, SourceChip } from "./Citations";
import { riskLabel } from "@/hooks/useInvestorProfile";

interface StockAIAnalysisSectionProps {
  stock: Stock;
  profile: InvestorProfile | null;
  accent?: string;
}

interface CacheEntry {
  timestamp: number;
  analise: AnaliseIA;
}

const CACHE_KEY_PREFIX = "stocks-ai-analysis:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache(ticker: string): AnaliseIA | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.analise;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, analise: AnaliseIA) {
  const entry: CacheEntry = { timestamp: Date.now(), analise };
  localStorage.setItem(CACHE_KEY_PREFIX + ticker, JSON.stringify(entry));
}

function buildDados(stock: Stock): DadosQuantitativos {
  const grahamValue = calculateGrahamValue(stock.lpa, stock.vpa);
  const margem = grahamValue > 0 ? calculateMarginOfSafety(stock.price, grahamValue) / 100 : 0;
  return {
    cotacao: stock.price,
    precoTeto: grahamValue,
    margemSeguranca: margem,
    score: stock.score,
    pl: stock.pl,
    pvp: stock.pvp,
    roe: stock.roe,
    dividendYield: stock.dividendYield,
    debtToEbitda: stock.debtToEbitda,
    netMargin: stock.netMargin,
  };
}

function recColor(rec: AnaliseIA["recomendacao"]): string {
  if (rec === "COMPRAR") return PraxiaTokens.up;
  if (rec === "VENDER") return PraxiaTokens.down;
  return PraxiaTokens.warn;
}

export function StockAIAnalysisSection({ stock, profile, accent = PraxiaTokens.accent }: StockAIAnalysisSectionProps) {
  const T = PraxiaTokens;
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  useEffect(() => {
    setError(null);
    const cached = readCache(stock.ticker);
    setAnalise(cached);
    if (cached) {
      const raw = localStorage.getItem(CACHE_KEY_PREFIX + stock.ticker);
      if (raw) {
        try {
          const entry = JSON.parse(raw) as CacheEntry;
          setGeneratedAt(entry.timestamp);
        } catch {
          setGeneratedAt(null);
        }
      }
    } else {
      setGeneratedAt(null);
    }
  }, [stock.ticker]);

  const run = useCallback(async () => {
    if (!profile) {
      setError("Complete o quiz de perfil antes — minhas recomendações precisam estar ancoradas no seu perfil.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dados = buildDados(stock);
      const result = await analisarAcaoComIA(stock.ticker, stock.name ?? stock.ticker, dados, profile);
      writeCache(stock.ticker, result);
      setAnalise(result);
      setGeneratedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar análise.");
    } finally {
      setLoading(false);
    }
  }, [stock, profile]);

  return (
    <PraxiaCard padding={14} style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: `linear-gradient(140deg, ${accent}, ${accent}88)`,
            display: "grid",
            placeItems: "center",
            boxShadow: `0 4px 12px ${accent}44`,
          }}
        >
          <Icon.shield size={14} color="white" />
        </div>
        <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 13, color: T.ink }}>
          Análise profunda com IA
        </div>
        {generatedAt && analise && (
          <div
            style={{
              marginLeft: "auto",
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink50,
              letterSpacing: 0.4,
            }}
          >
            {new Date(generatedAt).toLocaleDateString("pt-BR")}
          </div>
        )}
      </div>

      {!analise && !loading && !error && (
        <>
          <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink70, lineHeight: 1.5, marginBottom: 12 }}>
            Gera recomendação <strong>Comprar / Segurar / Vender</strong>, resumo do último trimestre e red flags com
            base em fundamentos + dados de RI. Cada afirmação vem com fonte e a recomendação é ancorada no seu perfil
            {profile ? ` (${riskLabel(profile.risk).toLowerCase()})` : ""}.
          </div>
          <button
            onClick={run}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              border: "none",
              background: accent,
              color: "white",
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: `0 8px 22px ${accent}55`,
            }}
          >
            Gerar análise
          </button>
        </>
      )}

      {loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 4px",
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
          Analisando {stock.ticker}… isso pode levar 5–15s.
        </div>
      )}

      {error && (
        <div style={{ fontFamily: T.body, fontSize: 12, color: T.down, lineHeight: 1.5 }}>
          {error}
          <button
            onClick={run}
            style={{
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 8,
              border: `0.5px solid ${T.hairline}`,
              background: "transparent",
              color: T.ink,
              fontFamily: T.body,
              fontSize: 12,
              cursor: "pointer",
              display: "block",
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {analise && !loading && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              background: `${recColor(analise.recomendacao)}22`,
              border: `0.5px solid ${recColor(analise.recomendacao)}66`,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontFamily: T.display,
                fontSize: 14,
                fontWeight: 700,
                color: recColor(analise.recomendacao),
                letterSpacing: 0.4,
              }}
            >
              {analise.recomendacao}
            </div>
            {analise.periodoAnalisado && (
              <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink50 }}>
                {analise.periodoAnalisado}
              </div>
            )}
          </div>

          <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink, lineHeight: 1.55, marginBottom: 12 }}>
            {renderWithLinks(analise.justificativa, accent)}
          </div>

          {analise.resumoTrimestral && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.6, marginBottom: 4 }}>
                ÚLTIMO TRIMESTRE
              </div>
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink70, lineHeight: 1.5 }}>
                {renderWithLinks(analise.resumoTrimestral, accent)}
              </div>
            </div>
          )}

          {analise.comparacaoTrimestre && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink30, letterSpacing: 0.6, marginBottom: 4 }}>
                COMPARAÇÃO
              </div>
              <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink70, lineHeight: 1.5 }}>
                {renderWithLinks(analise.comparacaoTrimestre, accent)}
              </div>
            </div>
          )}

          {analise.redFlags && analise.redFlags.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.down, letterSpacing: 0.6, marginBottom: 6 }}>
                RED FLAGS
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: T.body, fontSize: 12.5, color: T.ink, lineHeight: 1.55 }}>
                {analise.redFlags.map((flag, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {renderWithLinks(flag, accent)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fontes — obrigatório */}
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: `0.5px dashed ${T.hairline}`,
            }}
          >
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 9.5,
                color: T.ink50,
                letterSpacing: 0.8,
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              Fontes
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(analise.fontes ?? []).length === 0 && analise.fonte && (
                <SourceChip source={analise.fonte} accent={accent} />
              )}
              {(analise.fontes ?? []).map((src, i) => (
                <SourceChip key={i} source={src} accent={accent} />
              ))}
              {(analise.fontes ?? []).length === 0 && !analise.fonte && (
                <span style={{ fontFamily: T.body, fontSize: 11, color: T.down }}>
                  (modelo não retornou fontes — peça para regerar)
                </span>
              )}
            </div>
          </div>

          <button
            onClick={run}
            style={{
              marginTop: 12,
              padding: "6px 12px",
              borderRadius: 8,
              border: `0.5px solid ${T.hairline}`,
              background: "transparent",
              color: T.ink50,
              fontFamily: T.body,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Regerar análise
          </button>
        </>
      )}
    </PraxiaCard>
  );
}
