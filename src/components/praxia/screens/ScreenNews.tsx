import { useMemo, useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { PraMark } from "../PraMark";
import { StatusTag } from "../Tag";
import { NewsFeedCard } from "../NewsFeedCard";
import { FeatureHintBanner } from "@/components/praxia/FeatureHintBanner";
import { useWorldNews } from "@/hooks/useWorldNews";
import { useNewsFeed } from "@/hooks/useNewsFeed";
import {
  resumirNoticiasComIA,
  getCachedResumoNoticias,
  type ResumoNoticiasIA,
} from "@/lib/aiNews";
import type {
  InvestorProfile,
  Stock,
} from "@/types/stock";
import type {
  WorldNewsItem,
  WorldNewsTopicBundle,
} from "@/lib/context";

type ViewMode = "topicos" | "feed";
type FeedFilter = "para-voce" | "todos" | string;
const PARA_VOCE: FeedFilter = "para-voce";

interface ScreenNewsProps {
  accent?: string;
  profile: InvestorProfile | null;
  stocks: Stock[];
  onBack: () => void;
}

const TOPIC_LABEL: Record<string, string> = {
  geopolitica: "Geopolítica",
  "politica-eua": "Política EUA",
  china: "China",
  commodities: "Commodities",
  "brasil-fiscal": "Brasil · Fiscal",
  guerra: "Guerra",
  "mercado-acoes": "Mercado · Ações",
  regulatorio: "Fato relevante",
  carteira: "Carteira",
};

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

function originLabel(origem: WorldNewsItem["origem"]): string {
  switch (origem) {
    case "gdelt":
      return "GDELT";
    case "google-news":
      return "Google News";
    case "reddit":
      return "Reddit";
    case "bbc":
      return "BBC";
  }
}

export function ScreenNews({ accent = PraxiaTokens.accent, profile, stocks, onBack }: ScreenNewsProps) {
  const T = PraxiaTokens;
  const feed = useNewsFeed(profile, stocks);
  // useWorldNews continua disponível pra modo Tópicos consumir o mesmo cache.
  const worldOnly = useWorldNews();
  const data = feed.worldData ?? worldOnly.data;
  const isLoading = feed.isLoading || worldOnly.isLoading;
  const error = feed.error ?? worldOnly.error;
  const refresh = async (force = false) => {
    await Promise.all([feed.refresh(force), worldOnly.refresh(force)]);
  };

  const hasCarteira = stocks.length > 0;
  const [activeTopic, setActiveTopic] = useState<FeedFilter | null>(hasCarteira ? PARA_VOCE : null);
  const [viewMode, setViewMode] = useState<ViewMode>("feed");

  // B4 fix: memoizar topics pra evitar re-render quando data não mudou.
  const topics = useMemo(() => data?.topics ?? [], [data]);
  const generated = data ? new Date(data.generatedAt).toLocaleString("pt-BR") : "";

  // Topic filter — null = todos; PARA_VOCE só faz sentido no modo feed.
  const visibleTopics = useMemo(() => {
    if (!activeTopic || activeTopic === PARA_VOCE) return topics;
    return topics.filter((t) => t.topic === activeTopic);
  }, [topics, activeTopic]);

  // Feed achatado já ranqueado pelo useNewsFeed; aqui só aplica filtro de pill.
  const feedItems = useMemo(() => {
    if (activeTopic === PARA_VOCE) return feed.personalItems;
    if (activeTopic && activeTopic !== PARA_VOCE) {
      return feed.items.filter((e) => e.topic === activeTopic);
    }
    return feed.items;
  }, [feed.items, feed.personalItems, activeTopic]);

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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 22,
                fontWeight: 600,
                color: T.ink,
                letterSpacing: -0.4,
              }}
            >
              Notícias
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 11,
                color: T.ink50,
                marginTop: 2,
              }}
            >
              {viewMode === "feed"
                ? "Feed cronológico · análise IA por notícia"
                : "Tópicos resumidos pela Pra · atualizados a cada 2h"}
            </div>
          </div>
          <GlassButton onClick={() => refresh(true)} ariaLabel="Atualizar agora">
            <Icon.refresh size={16} color={T.ink70} />
          </GlassButton>
        </div>

        <FeatureHintBanner hintKey="news" accent={accent} />

        {/* View mode toggle: Feed | Tópicos */}
        <div
          style={{
            display: "flex",
            gap: 0,
            padding: 3,
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: `0.5px solid ${T.hairline}`,
            alignSelf: "stretch",
          }}
        >
          <ModeToggleButton
            label="Feed personalizado"
            active={viewMode === "feed"}
            onClick={() => setViewMode("feed")}
            accent={accent}
          />
          <ModeToggleButton
            label="Tópicos"
            active={viewMode === "topicos"}
            onClick={() => setViewMode("topicos")}
            accent={accent}
          />
        </div>

        {generated && (
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink30,
              letterSpacing: 0.4,
              padding: "0 4px",
            }}
          >
            Geradas em {generated} · {data?.source ?? ""}
          </div>
        )}

        {/* Topic filter pills */}
        <div
          className="praxia-scroll"
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 4,
            margin: "0 -4px",
            paddingLeft: 4,
          }}
        >
          {viewMode === "feed" && (
            <FilterPill
              label="Para você"
              active={activeTopic === PARA_VOCE}
              onClick={() => setActiveTopic(PARA_VOCE)}
              accent={accent}
              count={feed.personalItems.length}
            />
          )}
          <FilterPill
            label="Todos"
            active={activeTopic === null}
            onClick={() => setActiveTopic(null)}
            accent={accent}
            count={viewMode === "feed" ? feed.items.length : topics.reduce((acc, t) => acc + t.items.length, 0)}
          />
          {viewMode === "feed" && (
            <FilterPill
              label="Fato relevante"
              active={activeTopic === "regulatorio"}
              onClick={() => setActiveTopic("regulatorio")}
              accent={accent}
              count={feed.items.filter((e) => e.topic === "regulatorio").length}
            />
          )}
          {topics.map((t) => (
            <FilterPill
              key={t.topic}
              label={TOPIC_LABEL[t.topic] ?? t.topic}
              active={activeTopic === t.topic}
              onClick={() => setActiveTopic(t.topic)}
              accent={accent}
              count={t.items.length}
            />
          ))}
        </div>

        {/* Loading / error */}
        {isLoading && topics.length === 0 && (
          <PraxiaCard padding={20}>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink50,
                textAlign: "center",
              }}
            >
              Buscando manchetes globais…
            </div>
          </PraxiaCard>
        )}
        {error && (
          <PraxiaCard
            padding={14}
            style={{
              background: "rgba(255,107,129,0.08)",
              border: "0.5px solid rgba(255,107,129,0.3)",
            }}
          >
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.down }}>{error}</div>
          </PraxiaCard>
        )}

        {/* Render: Feed personalizado ou Tópicos */}
        {viewMode === "feed" ? (
          <>
            {feedItems.length === 0 && !isLoading && !error && (
              <PraxiaCard padding={20}>
                <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink50, textAlign: "center" }}>
                  Nenhuma notícia disponível no momento.
                </div>
              </PraxiaCard>
            )}
            {feedItems.map(({ item, topic, topicLabel }) => (
              <NewsFeedCard
                key={`${topic}-${item.link}`}
                item={item}
                topicLabel={topic === "carteira" ? "Carteira" : TOPIC_LABEL[topic] ?? topicLabel}
                accent={accent}
                profile={profile}
                stocks={stocks}
              />
            ))}
          </>
        ) : (
          <>
            {visibleTopics.map((bundle) => (
              <TopicCard key={bundle.topic} bundle={bundle} accent={accent} profile={profile} />
            ))}
            {visibleTopics.length === 0 && !isLoading && !error && (
              <PraxiaCard padding={20}>
                <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink50, textAlign: "center" }}>
                  Sem notícias neste tópico no momento.
                </div>
              </PraxiaCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ModeToggleButton({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  const T = PraxiaTokens;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 32,
        borderRadius: 8,
        background: active ? accent : "transparent",
        color: active ? "white" : T.ink70,
        border: "none",
        fontFamily: T.body,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  accent,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent: string;
  count?: number;
}) {
  const T = PraxiaTokens;
  return (
    <button
      onClick={onClick}
      style={{
        height: 30,
        padding: "0 12px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: active ? accent : "rgba(255,255,255,0.05)",
        color: active ? "white" : T.ink70,
        border: active ? "none" : `0.5px solid ${T.hairline}`,
        fontFamily: T.body,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            opacity: 0.8,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function TopicCard({
  bundle,
  accent,
  profile,
}: {
  bundle: WorldNewsTopicBundle;
  accent: string;
  profile: InvestorProfile | null;
}) {
  const T = PraxiaTokens;
  const [summary, setSummary] = useState<ResumoNoticiasIA | null>(() =>
    getCachedResumoNoticias(bundle)
  );
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleSummarize = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const result = await resumirNoticiasComIA(bundle, profile);
      setSummary(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erro ao gerar resumo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PraxiaCard padding={16}>
      {/* Cabeçalho do tópico */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div
          style={{
            fontFamily: T.display,
            fontSize: 16,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: -0.2,
          }}
        >
          {TOPIC_LABEL[bundle.topic] ?? bundle.topic}
        </div>
        <StatusTag color={`${accent}22`} text={accent}>
          {bundle.items.length}
        </StatusTag>
      </div>
      <div
        style={{
          fontFamily: T.body,
          fontSize: 12.5,
          color: T.ink70,
          lineHeight: 1.5,
        }}
      >
        {bundle.description}
      </div>
      <div
        style={{
          marginTop: 8,
          padding: "8px 10px",
          borderRadius: 10,
          background: `${accent}10`,
          border: `0.5px solid ${accent}33`,
          fontFamily: T.body,
          fontSize: 11.5,
          color: T.ink70,
          lineHeight: 1.45,
        }}
      >
        <span style={{ color: accent, fontWeight: 700, marginRight: 4 }}>Arbitragem:</span>
        {bundle.arbitrageAngle}
      </div>

      {/* Resumo da Pra */}
      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 12,
          background: "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: `0.5px solid ${T.hairline}`,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flexShrink: 0 }}>
            <PraMark size={26} accent={accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.display,
                fontSize: 12.5,
                fontWeight: 700,
                color: T.ink,
                letterSpacing: 0.2,
              }}
            >
              Resumo da Pra
            </div>
            {summary ? (
              <>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: T.body,
                    fontSize: 13,
                    color: T.ink,
                    lineHeight: 1.5,
                  }}
                >
                  {summary.resumo}
                </div>
                {summary.impactoArbitragem && (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: T.body,
                      fontSize: 12,
                      color: T.ink70,
                      lineHeight: 1.45,
                    }}
                  >
                    <b style={{ color: T.ink }}>Impacto:</b> {summary.impactoArbitragem}
                  </div>
                )}
                {summary.alvos.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {summary.alvos.map((a, i) => {
                      const c =
                        a.direcao === "ganha"
                          ? T.up
                          : a.direcao === "perde"
                            ? T.down
                            : T.warn;
                      const arrow = a.direcao === "ganha" ? "↑" : a.direcao === "perde" ? "↓" : "→";
                      return (
                        <span
                          key={`${a.alvo}-${i}`}
                          title={a.motivo}
                          style={{
                            padding: "4px 9px",
                            borderRadius: 999,
                            background: `${c}1f`,
                            color: c,
                            fontFamily: T.body,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {arrow} {a.alvo}
                        </span>
                      );
                    })}
                  </div>
                )}
                {summary.fontes.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: T.mono,
                      fontSize: 10,
                      color: T.ink50,
                      letterSpacing: 0.3,
                    }}
                  >
                    fontes citadas: {summary.fontes.length}
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: T.body,
                    fontSize: 12,
                    color: T.ink50,
                    lineHeight: 1.45,
                  }}
                >
                  Toque para a Pra resumir as manchetes deste tópico e apontar quais ativos podem se mover.
                </div>
                <button
                  onClick={handleSummarize}
                  disabled={loading || bundle.items.length === 0}
                  style={{
                    marginTop: 10,
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 8,
                    background: accent,
                    color: "white",
                    border: "none",
                    fontFamily: T.display,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    boxShadow: `0 6px 16px ${accent}55`,
                  }}
                >
                  {loading ? "Resumindo…" : "Resumir com IA"}
                </button>
                {aiError && (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: T.body,
                      fontSize: 11,
                      color: T.down,
                    }}
                  >
                    {aiError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lista de manchetes com link */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 10,
            color: T.ink50,
            letterSpacing: 0.6,
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Manchetes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(bundle.items ?? []).slice(0, 8).map((item, i) => (
            <ArticleRow key={`${item.link}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </PraxiaCard>
  );
}

function ArticleRow({ item }: { item: WorldNewsItem }) {
  const T = PraxiaTokens;
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 8px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        border: `0.5px solid ${T.hairline}`,
        textDecoration: "none",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.body,
            fontSize: 12.5,
            color: T.ink,
            lineHeight: 1.4,
          }}
        >
          {item.titulo}
        </div>
        <div
          style={{
            marginTop: 4,
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontFamily: T.body,
            fontSize: 10.5,
            color: T.ink50,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 600 }}>{item.fonte || originLabel(item.origem)}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ fontFamily: T.mono, letterSpacing: 0.2 }}>{originLabel(item.origem)}</span>
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
                  color:
                    item.tom > 0.1
                      ? PraxiaTokens.up
                      : item.tom < -0.1
                        ? PraxiaTokens.down
                        : PraxiaTokens.ink50,
                }}
              >
                tom {item.tom > 0 ? "+" : ""}
                {item.tom.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          background: "rgba(255,255,255,0.05)",
          border: `0.5px solid ${T.hairline}`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          color: T.ink70,
        }}
        aria-hidden
      >
        <Icon.share size={11} color={T.ink70} />
      </div>
    </a>
  );
}
