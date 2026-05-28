import { useState } from "react";
import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { PraMark } from "./PraMark";
import { Icon } from "./Icon";
import {
  analisarNoticiaParaCarteira,
  getCachedAnaliseNoticia,
  type AnaliseNoticiaIA,
  type TickerImpact,
} from "@/lib/aiNewsFeed";
import type { InvestorProfile, Stock } from "@/types/stock";
import type { WorldNewsItem } from "@/lib/context";

interface NewsFeedCardProps {
  item: WorldNewsItem;
  topicLabel?: string;
  accent: string;
  profile: InvestorProfile | null;
  stocks: Stock[];
}

function pubDateRelative(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

function categoryLabel(c: AnaliseNoticiaIA["categoria"]): string {
  switch (c) {
    case "guerra":
      return "Guerra";
    case "queda-acoes":
      return "Queda de ações";
    case "ma-corporativo":
      return "M&A / Corporativo";
    case "macro":
      return "Macro";
    case "setor":
      return "Setorial";
    default:
      return "Geral";
  }
}

export function NewsFeedCard({ item, topicLabel, accent, profile, stocks }: NewsFeedCardProps) {
  const T = PraxiaTokens;
  const [analise, setAnalise] = useState<AnaliseNoticiaIA | null>(() =>
    getCachedAnaliseNoticia(item, stocks)
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setErr(null);
    try {
      const result = await analisarNoticiaParaCarteira(item, profile, stocks, topicLabel);
      setAnalise(result);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao analisar notícia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PraxiaCard padding={14}>
      {/* Header da notícia */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: T.body,
              fontSize: 13.5,
              fontWeight: 600,
              color: T.ink,
              lineHeight: 1.4,
              textDecoration: "none",
              display: "block",
            }}
          >
            {item.titulo}
          </a>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
              fontFamily: T.body,
              fontSize: 10.5,
              color: T.ink50,
            }}
          >
            <span style={{ fontWeight: 600, color: T.ink70 }}>{item.fonte || "—"}</span>
            {topicLabel && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span
                  style={{
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: `${accent}22`,
                    color: accent,
                    fontFamily: T.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                  }}
                >
                  {topicLabel}
                </span>
              </>
            )}
            {item.publicado && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{pubDateRelative(item.publicado)}</span>
              </>
            )}
            {item.tom !== undefined && (
              <>
                <span style={{ opacity: 0.5 }}>·</span>
                <span
                  style={{
                    fontFamily: T.mono,
                    color: item.tom > 0.1 ? T.up : item.tom < -0.1 ? T.down : T.ink50,
                  }}
                >
                  tom {item.tom > 0 ? "+" : ""}
                  {item.tom.toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            border: `0.5px solid ${T.hairline}`,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: T.ink70,
            textDecoration: "none",
          }}
          aria-label="Abrir notícia"
        >
          <Icon.share size={12} color={T.ink70} />
        </a>
      </div>

      {/* Bloco IA */}
      <div
        style={{
          marginTop: 12,
          padding: 11,
          borderRadius: 10,
          background: "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: `0.5px solid ${T.hairline}`,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <PraMark size={24} accent={accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {analise ? (
              <AnaliseBlock analise={analise} accent={accent} />
            ) : (
              <>
                <div
                  style={{
                    fontFamily: T.display,
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.ink,
                    letterSpacing: 0.2,
                  }}
                >
                  Análise da Pra
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: T.body,
                    fontSize: 11.5,
                    color: T.ink50,
                    lineHeight: 1.45,
                  }}
                >
                  Como esta notícia mexe com {stocks.length > 0 ? `seus ${stocks.length} ativos` : "ativos da B3"}?
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  style={{
                    marginTop: 9,
                    height: 30,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: accent,
                    color: "white",
                    border: "none",
                    fontFamily: T.display,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    boxShadow: `0 4px 12px ${accent}55`,
                  }}
                >
                  {loading ? "Analisando…" : "Analisar pra minha carteira"}
                </button>
                {err && (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: T.body,
                      fontSize: 10.5,
                      color: T.down,
                    }}
                  >
                    {err}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PraxiaCard>
  );
}

function AnaliseBlock({
  analise,
  accent,
}: {
  analise: AnaliseNoticiaIA;
  accent: string;
}) {
  const T = PraxiaTokens;
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: T.display,
            fontSize: 12,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: 0.2,
          }}
        >
          Análise da Pra
        </div>
        <span
          style={{
            padding: "1px 7px",
            borderRadius: 999,
            background: `${accent}22`,
            color: accent,
            fontFamily: T.mono,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {categoryLabel(analise.categoria)}
        </span>
      </div>

      <div
        style={{
          marginTop: 6,
          fontFamily: T.body,
          fontSize: 12.5,
          color: T.ink,
          lineHeight: 1.5,
        }}
      >
        {analise.tese}
      </div>

      {analise.tickersImpactados.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {analise.tickersImpactados.map((t) => (
            <TickerChip key={`${t.ticker}-${t.direcao}`} impact={t} />
          ))}
        </div>
      )}

      {analise.acaoSugerida && (
        <div
          style={{
            marginTop: 9,
            padding: "8px 10px",
            borderRadius: 8,
            background: `${accent}10`,
            border: `0.5px solid ${accent}33`,
            fontFamily: T.body,
            fontSize: 11.5,
            color: T.ink70,
            lineHeight: 1.45,
          }}
        >
          <span style={{ color: accent, fontWeight: 700, marginRight: 4 }}>Ação sugerida:</span>
          {analise.acaoSugerida}
        </div>
      )}

      {analise.fontes.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontFamily: T.mono,
            fontSize: 9.5,
            color: T.ink50,
            letterSpacing: 0.3,
          }}
        >
          fontes citadas: {analise.fontes.length}
        </div>
      )}
    </>
  );
}

function TickerChip({ impact }: { impact: TickerImpact }) {
  const T = PraxiaTokens;
  const c =
    impact.direcao === "ganha" ? T.up : impact.direcao === "perde" ? T.down : T.warn;
  const arrow = impact.direcao === "ganha" ? "↑" : impact.direcao === "perde" ? "↓" : "→";
  // Intensidade: 1 chip simples, 2 contorno, 3 fundo cheio
  const filled = impact.intensidade === 3;
  const outlined = impact.intensidade === 2;

  return (
    <span
      title={`${impact.motivo}${impact.emCarteira ? " · em carteira" : ""}`}
      style={{
        padding: "4px 9px",
        borderRadius: 999,
        background: filled ? c : `${c}1f`,
        color: filled ? "white" : c,
        border: outlined ? `0.5px solid ${c}` : "none",
        fontFamily: T.body,
        fontSize: 11,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        position: "relative",
      }}
    >
      {arrow} {impact.ticker}
      {impact.emCarteira && (
        <span
          aria-label="em carteira"
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: filled ? "white" : c,
            opacity: 0.8,
          }}
        />
      )}
    </span>
  );
}
