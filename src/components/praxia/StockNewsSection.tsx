import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { Icon } from "./Icon";
import { SourceChip, renderWithLinks } from "./Citations";
import { DisclaimerBar } from "./DisclaimerBar";
import { useStockNews } from "@/hooks/useStockNews";
import type {
  StockNewsClassifiedItem,
  StockNewsSentiment,
} from "@/lib/stockNews";
import type { InvestorProfile } from "@/types/stock";

interface StockNewsSectionProps {
  ticker: string;
  profile: InvestorProfile | null;
  accent?: string;
}

function sentimentColor(s: StockNewsSentiment): string {
  if (s === "positivo") return PraxiaTokens.up;
  if (s === "negativo") return PraxiaTokens.down;
  return PraxiaTokens.ink50;
}

function sentimentLabel(s: StockNewsSentiment): string {
  if (s === "positivo") return "POSITIVO";
  if (s === "negativo") return "NEGATIVO";
  return "NEUTRO";
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const minutes = Math.round((Date.now() - t) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(t).toLocaleDateString("pt-BR");
}

export function StockNewsSection({
  ticker,
  profile,
  accent = PraxiaTokens.accent,
}: StockNewsSectionProps) {
  const T = PraxiaTokens;
  const { analysis, loading, error, load, refresh, fromCache } = useStockNews(
    ticker,
    profile
  );

  return (
    <PraxiaCard padding={14} style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
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
          <Icon.feed size={14} color="white" />
        </div>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 13,
            color: T.ink,
          }}
        >
          Notícias com sentimento IA
        </div>
        {analysis && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <SentimentPill sentimento={analysis.sentimentoGeral} />
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                color: T.ink50,
                letterSpacing: 0.4,
              }}
              title={
                fromCache
                  ? `Cache local · ${new Date(analysis.generatedAt).toLocaleString("pt-BR")}`
                  : new Date(analysis.generatedAt).toLocaleString("pt-BR")
              }
            >
              {fromCache ? "CACHE · " : ""}
              {timeAgo(new Date(analysis.generatedAt).toISOString())}
            </div>
          </div>
        )}
      </div>

      {!analysis && !loading && !error && (
        <>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12.5,
              color: T.ink70,
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            Últimas manchetes do <strong>{ticker}</strong> classificadas pela Pra:
            sentimento por item, sinalização de evento <em>material</em> e impacto
            em uma frase ancorado no seu perfil.
          </div>
          <button
            onClick={() => void load()}
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
            Carregar notícias do {ticker}
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
          Lendo e classificando manchetes de {ticker}…
        </div>
      )}

      {error && (
        <div
          style={{
            fontFamily: T.body,
            fontSize: 12,
            color: T.down,
            lineHeight: 1.5,
          }}
        >
          {error}
          <button
            onClick={() => void load()}
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

      {analysis && !loading && (
        <>
          {analysis.itens.length === 0 ? (
            <div
              style={{
                fontFamily: T.body,
                fontSize: 12.5,
                color: T.ink70,
                lineHeight: 1.55,
              }}
            >
              Sem manchetes recentes relevantes para {ticker} — o motor não viu
              fato novo que mude a tese.
            </div>
          ) : (
            <>
              {analysis.resumo && (
                <div
                  style={{
                    fontFamily: T.body,
                    fontSize: 12.5,
                    color: T.ink,
                    lineHeight: 1.55,
                    marginBottom: 12,
                  }}
                >
                  {renderWithLinks(analysis.resumo, accent)}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {analysis.itens.map((item, i) => (
                  <NewsItemCard key={item.link || i} item={item} index={i + 1} />
                ))}
              </div>

              {analysis.fontes.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
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
                    {analysis.fontes.map((src, i) => (
                      <SourceChip key={i} source={src} accent={accent} />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => void refresh()}
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
                Atualizar manchetes
              </button>

              <DisclaimerBar accent={accent} variant="inline" />
            </>
          )}
        </>
      )}
    </PraxiaCard>
  );
}

function SentimentPill({ sentimento }: { sentimento: StockNewsSentiment }) {
  const T = PraxiaTokens;
  const color = sentimentColor(sentimento);
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 9,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 999,
        background: `${color}1f`,
        color,
        border: `0.5px solid ${color}55`,
        letterSpacing: 0.6,
      }}
    >
      {sentimentLabel(sentimento)}
    </span>
  );
}

function NewsItemCard({
  item,
  index,
}: {
  item: StockNewsClassifiedItem;
  index: number;
}) {
  const T = PraxiaTokens;
  const color = sentimentColor(item.sentimento);
  const hostname = (() => {
    try {
      return new URL(item.link).hostname.replace(/^www\./, "");
    } catch {
      return item.fonte || "";
    }
  })();
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        padding: 10,
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: `0.5px solid ${item.material ? `${PraxiaTokens.warn}55` : T.hairline}`,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 9.5,
            color: T.ink30,
            letterSpacing: 0.4,
          }}
        >
          [{index}]
        </span>
        <SentimentPill sentimento={item.sentimento} />
        {item.material && (
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 9,
              fontWeight: 700,
              padding: "3px 7px",
              borderRadius: 999,
              background: `${PraxiaTokens.warn}1f`,
              color: PraxiaTokens.warn,
              border: `0.5px solid ${PraxiaTokens.warn}55`,
              letterSpacing: 0.6,
            }}
          >
            MATERIAL
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontFamily: T.mono,
            fontSize: 9.5,
            color: T.ink50,
          }}
        >
          {hostname}
          {item.publicado ? ` · ${timeAgo(item.publicado)}` : ""}
        </span>
      </div>
      <div
        style={{
          fontFamily: T.body,
          fontSize: 12.5,
          color: T.ink,
          lineHeight: 1.4,
          fontWeight: 500,
        }}
      >
        {item.titulo}
      </div>
      {item.impacto && (
        <div
          style={{
            marginTop: 4,
            fontFamily: T.body,
            fontSize: 11.5,
            color: color === T.ink50 ? T.ink70 : color,
            lineHeight: 1.45,
            fontStyle: "italic",
          }}
        >
          → {item.impacto}
        </div>
      )}
    </a>
  );
}
