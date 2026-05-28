import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { Icon } from "./Icon";
import { Tag } from "./Tag";
import { useWeeklyDigest, type WeeklyDigestInputs } from "@/hooks/useWeeklyDigest";
import { getWeekStart, formatWeekLabelPtBR } from "@/lib/isoWeek";
import type { DigestScreenTarget } from "@/types/stock";

interface WeeklyDigestCardProps extends WeeklyDigestInputs {
  accent?: string;
  /** Callback de navegacao para os botoes de "proximas acoes". */
  onNavigate?: (screen: DigestScreenTarget) => void;
}

/**
 * Card do digest semanal no topo da Home. Renderiza estados:
 * empty (carteira vazia), pre-geracao (botao "Gerar"), loading, pronto, erro.
 * Tudo vem da IA com base em dados REAIS (assembleDigestContext).
 */
export function WeeklyDigestCard({
  accent = PraxiaTokens.accent,
  onNavigate,
  ...inputs
}: WeeklyDigestCardProps) {
  const T = PraxiaTokens;
  const { digest, loading, error, fromCache, isFresh, canGenerate, isoWeek, generate, regenerate } =
    useWeeklyDigest(inputs);

  // Card so aparece se a carteira tem posicao. Em outros casos, o componente
  // some — nao polui o feed do usuario.
  if (!canGenerate) return null;

  // Reconstroi o weekStart a partir da isoWeek para mostrar label PT-BR.
  // (ISO-week → segunda) — algoritmo simples: voltar 7 dias e usar getWeekStart.
  const refDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekStartLabel = formatWeekLabelPtBR(getWeekStart(refDate));

  return (
    <PraxiaCard
      padding={16}
      raised
      style={{
        background: `
          radial-gradient(120% 80% at 100% 0%, ${accent}1f 0%, transparent 55%),
          linear-gradient(180deg, ${T.surface2} 0%, ${T.surface} 100%)
        `,
        border: `0.5px solid ${accent}33`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon.feed size={13} color="white" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 9.5,
                color: accent,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Digest semanal · {isoWeek}
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 11.5,
                color: T.ink50,
                marginTop: 2,
              }}
            >
              {weekStartLabel}
              {fromCache ? " · cache" : ""}
            </div>
          </div>
        </div>

        {digest && !loading && (
          <button
            type="button"
            onClick={() => void regenerate()}
            aria-label="Regenerar"
            style={{
              background: "transparent",
              border: "none",
              color: T.ink50,
              cursor: "pointer",
              padding: 6,
              display: "flex",
            }}
          >
            <Icon.refresh size={14} color={T.ink50} />
          </button>
        )}
      </div>

      {/* Body */}
      {loading && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 0",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: T.body,
            fontSize: 12.5,
            color: T.ink70,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: accent,
              animation: "praDot 0.8s ease-in-out infinite",
            }}
          />
          Pra está costurando o resumo da sua semana…
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: `${T.down}14`,
            border: `0.5px solid ${T.down}55`,
            fontFamily: T.body,
            fontSize: 12.5,
            color: T.ink,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {!digest && !loading && !error && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12.5,
              color: T.ink70,
              lineHeight: 1.55,
            }}
          >
            Sintetizo o que aconteceu na sua carteira na semana passada:
            variação, dividendos pagos, alertas disparados e notícias
            materiais. Geração sob demanda.
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              background: `linear-gradient(135deg, ${accent}33, ${accent}1a)`,
              border: `0.5px solid ${accent}77`,
              color: T.ink,
              fontFamily: T.body,
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: 0.3,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon.feed size={13} color={accent} />
            Gerar digest da semana
          </button>
        </div>
      )}

      {digest && !loading && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Destaque */}
          {digest.destaque && (
            <div
              style={{
                fontFamily: T.display,
                fontSize: 17,
                fontWeight: 600,
                color: T.ink,
                lineHeight: 1.35,
                letterSpacing: -0.2,
              }}
            >
              {digest.destaque}
            </div>
          )}

          {/* Resumo */}
          {digest.resumo && (
            <div
              style={{
                fontFamily: T.body,
                fontSize: 13,
                color: T.ink70,
                lineHeight: 1.6,
              }}
            >
              {digest.resumo}
            </div>
          )}

          {/* Eventos notáveis */}
          {digest.eventosNotaveis.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {digest.eventosNotaveis.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    paddingLeft: 10,
                    borderLeft: `2px solid ${accent}66`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: T.body,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: T.ink,
                      }}
                    >
                      {ev.titulo}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontFamily: T.body,
                        fontSize: 12,
                        color: T.ink70,
                        lineHeight: 1.5,
                      }}
                    >
                      {ev.detalhe}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Próximas ações */}
          {digest.proximasAcoes.length > 0 && (
            <div>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 9.5,
                  color: T.ink50,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Próximas ações
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {digest.proximasAcoes.map((acao, i) => {
                  const clickable = !!(acao.screenAlvo && onNavigate);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!clickable}
                      onClick={() => {
                        if (acao.screenAlvo && onNavigate) onNavigate(acao.screenAlvo);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: T.surfaceInk,
                        border: `0.5px solid ${T.hairline}`,
                        cursor: clickable ? "pointer" : "default",
                        textAlign: "left",
                        opacity: clickable ? 1 : 0.85,
                      }}
                    >
                      <span
                        style={{
                          marginTop: 2,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          background: `${accent}22`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon.arrowUp size={10} color={accent} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: T.body,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: T.ink,
                          }}
                        >
                          {acao.acao}
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontFamily: T.body,
                            fontSize: 11.5,
                            color: T.ink50,
                            lineHeight: 1.5,
                          }}
                        >
                          {acao.motivo}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fontes */}
          {digest.fontes.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {digest.fontes.map((f, i) => (
                <Tag key={i} color={T.surfaceInk} text={T.ink50}>
                  {f.length > 32 ? `[${i + 1}]` : f}
                </Tag>
              ))}
            </div>
          )}

          {/* Fresh indicator */}
          {!isFresh && (
            <div style={{ fontFamily: T.body, fontSize: 10, color: T.ink30, letterSpacing: 0.3 }}>
              Digest da semana anterior · próxima geração quando virar a semana
            </div>
          )}
        </div>
      )}
    </PraxiaCard>
  );
}
