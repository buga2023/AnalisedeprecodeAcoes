import { useState } from "react";
import { PraxiaTokens } from "../tokens";
import { PraxiaCard } from "../PraxiaCard";
import { Icon } from "../Icon";
import { PraMark } from "../PraMark";
import { SectionHeader } from "../SectionHeader";
import { HoldingRow } from "../HoldingRow";
import type { Stock, InvestorProfile } from "@/types/stock";
import { parseScreenerQuery } from "@/lib/ai";
import { runScreener, describeFilter, type ScreenerFilter, type ScreenerResult } from "@/lib/screener";

/**
 * Aba "Descobrir" (Fase 4). O usuario descreve em linguagem natural o que
 * procura; a Pra traduz pra `ScreenerFilter` (em `lib/ai`), e o `runScreener`
 * filtra/ranqueia o universo curado da B3 com dados REAIS do Yahoo (via
 * `/api/brapi`). Nenhuma metrica e fabricada — tickers sem dado sao omitidos.
 */

const EXAMPLES = [
  "Ações pra dividendos com qualidade",
  "Empresas baratas com margem de segurança",
  "Bancos sólidos e rentáveis",
  "Pouco endividadas e com ROE alto",
];

interface ScreenMarketScreenerProps {
  profile: InvestorProfile | null;
  accent: string;
  ownedTickers: string[];
  onOpenStock: (s: Stock) => void;
}

export function ScreenMarketScreener({
  profile,
  accent,
  ownedTickers,
  onOpenStock,
}: ScreenMarketScreenerProps) {
  const T = PraxiaTokens;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScreenerFilter | null>(null);
  const [result, setResult] = useState<ScreenerResult | null>(null);

  const run = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setResult(null);
    setFilter(null);
    try {
      const f = await parseScreenerQuery(q, profile);
      setFilter(f);
      const res = await runScreener(f, ownedTickers);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui rodar a busca agora.");
    } finally {
      setLoading(false);
    }
  };

  const badges = filter ? describeFilter(filter) : [];

  return (
    <div>
      {/* intro */}
      <PraxiaCard
        padding={14}
        style={{
          background: `linear-gradient(160deg, ${accent}1a 0%, ${accent}05 100%)`,
          border: `0.5px solid ${accent}44`,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <PraMark size={22} accent={accent} />
          <div style={{ fontFamily: T.display, fontSize: 13, fontWeight: 600, color: T.ink }}>
            Descobrir com a Pra
          </div>
        </div>
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink70, lineHeight: 1.45 }}>
          Descreva o que procura em português. A Pra traduz em filtros e ranqueia
          ações da B3 pelo score fundamentalista — só com dados reais do Yahoo.
        </div>
      </PraxiaCard>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 44,
          padding: "0 14px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.05)",
          border: `0.5px solid ${T.hairline}`,
          marginBottom: 10,
        }}
      >
        <Icon.search size={16} color={T.ink50} />
        <input
          id="screener-query"
          name="screener-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: ações pra dividendos com qualidade…"
          spellCheck={false}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: T.ink,
            fontFamily: T.body,
            fontSize: 14,
            padding: "11px 0",
          }}
        />
        {query.trim() && (
          <button
            type="submit"
            disabled={loading}
            style={{
              background: accent,
              color: "white",
              border: "none",
              borderRadius: 8,
              height: 28,
              padding: "0 12px",
              fontSize: 11.5,
              fontWeight: 700,
              fontFamily: T.body,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : "Buscar"}
          </button>
        )}
      </form>

      {/* example chips (descoberta) */}
      {!result && !loading && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => run(ex)}
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: `0.5px solid ${T.hairline}`,
                color: T.ink70,
                fontFamily: T.body,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* loading */}
      {loading && (
        <PraxiaCard padding={20} style={{ marginBottom: 14 }}>
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
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: accent,
                animation: "praDot 0.8s ease-in-out infinite",
              }}
            />
            Traduzindo o pedido e varrendo a B3…
          </div>
        </PraxiaCard>
      )}

      {/* error */}
      {error && !loading && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(255,107,129,0.08)",
            border: "0.5px solid rgba(255,107,129,0.3)",
            color: T.down,
            fontFamily: T.body,
            fontSize: 12.5,
            marginBottom: 14,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {/* applied filters */}
      {badges.length > 0 && !loading && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              color: T.ink50,
              letterSpacing: 0.8,
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            Filtros aplicados
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {badges.map((b) => (
              <span
                key={b}
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: `${accent}1f`,
                  border: `0.5px solid ${accent}55`,
                  color: accent,
                  fontFamily: T.mono,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* results */}
      {result && !loading && (
        <>
          {result.results.length === 0 ? (
            <PraxiaCard padding={20}>
              <div style={{ fontFamily: T.body, fontSize: 13, color: T.ink70, lineHeight: 1.5 }}>
                Nenhuma ação do universo varrido passou nesses filtros. Tente
                afrouxar os critérios — varri {result.scanned}{" "}
                {result.scanned === 1 ? "ação" : "ações"} da B3.
              </div>
            </PraxiaCard>
          ) : (
            <div>
              <SectionHeader
                label={`${result.matched} ${result.matched === 1 ? "ação passou" : "ações passaram"} · top ${result.results.length}`}
              />
              <PraxiaCard padding={4}>
                {result.results.map((s, i) => (
                  <HoldingRow
                    key={s.ticker}
                    stock={s}
                    onClick={() => onOpenStock(s)}
                    isLast={i === result.results.length - 1}
                    showValue={false}
                  />
                ))}
              </PraxiaCard>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: T.body,
                  fontSize: 11,
                  color: T.ink30,
                  textAlign: "center",
                }}
              >
                Varri {result.scanned} ações da B3. Toque pra ver a análise completa.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
