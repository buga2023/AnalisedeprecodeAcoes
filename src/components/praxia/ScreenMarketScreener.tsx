import { useState, useRef } from "react";
import { PraxiaTokens, fmt } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { Icon } from "./Icon";
import { PraMark } from "./PraMark";
import { StockAvatar } from "./StockAvatar";
import { SectionHeader } from "./SectionHeader";
import type { Stock, InvestorProfile } from "@/types/stock";
import { runScreener, type ScreenerResult } from "@/lib/screener";

const QUICK_QUERIES = [
  "ações com dividendos acima de 6%",
  "ações de crescimento com ROE alto",
  "elétricas com bom DY",
  "ações baratas pelo Graham",
  "blue chips brasileiras",
  "setor financeiro com P/L baixo",
];

interface ScreenMarketScreenerProps {
  accent?: string;
  profile: InvestorProfile | null;
  onOpenStock: (s: Stock) => void;
}

export function ScreenMarketScreener({
  accent = PraxiaTokens.accent,
  profile,
  onOpenStock,
}: ScreenMarketScreenerProps) {
  const T = PraxiaTokens;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreenerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await runScreener(trimmed, profile);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar triagem");
    } finally {
      setLoading(false);
    }
  };

  const pickQuick = (q: string) => {
    setQuery(q);
    void run(q);
  };

  return (
    <div>
      {/* Header card */}
      <PraxiaCard
        padding={16}
        style={{
          background: `linear-gradient(160deg, ${accent}1a 0%, ${accent}05 100%)`,
          border: `0.5px solid ${accent}44`,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <PraMark size={22} accent={accent} />
          <span style={{ fontFamily: T.display, fontSize: 13, fontWeight: 600, color: T.ink }}>
            Triagem com IA · Descobrir
          </span>
        </div>
        <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.ink70, lineHeight: 1.45, margin: 0 }}>
          Descreva o que você procura em linguagem natural. A Pra traduz para critérios fundamentalistas e busca ações reais.
        </p>
      </PraxiaCard>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
        style={{ marginBottom: 12 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            border: `0.5px solid ${loading ? accent : T.hairline}`,
            transition: "border-color 0.2s",
            minHeight: 48,
          }}
        >
          <Icon.search size={16} color={T.ink50} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: ações com dividendos e ROE alto…"
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: T.ink,
              fontFamily: T.body,
              fontSize: 14,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          />
          {query.trim() && (
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "rgba(255,255,255,0.1)" : accent,
                color: loading ? T.ink50 : "#fff",
                border: "none",
                borderRadius: 8,
                height: 30,
                padding: "0 12px",
                fontSize: 11.5,
                fontWeight: 700,
                fontFamily: T.body,
                cursor: loading ? "wait" : "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {loading ? "Buscando…" : "Buscar"}
            </button>
          )}
        </div>
      </form>

      {/* Quick queries */}
      {!result && !loading && (
        <div style={{ marginBottom: 18 }}>
          <SectionHeader label="Buscar rapidamente" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUICK_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => pickQuick(q)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  border: `0.5px solid ${T.hairline}`,
                  color: T.ink70,
                  fontFamily: T.body,
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              gap: 4,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: accent,
                  display: "inline-block",
                  animation: `praDot 1s ${i * 0.2}s infinite ease-in-out`,
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 12,
              color: T.ink50,
              marginTop: 10,
            }}
          >
            Analisando e buscando cotações…
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <PraxiaCard
          padding={14}
          style={{
            background: "rgba(200,115,113,0.08)",
            border: "0.5px solid rgba(200,115,113,0.3)",
            marginBottom: 14,
          }}
        >
          <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.down }}>
            {error}
          </div>
          <button
            onClick={() => void run(query)}
            style={{
              marginTop: 8,
              background: "transparent",
              border: `0.5px solid ${T.down}`,
              color: T.down,
              borderRadius: 8,
              padding: "5px 12px",
              fontFamily: T.body,
              fontSize: 11.5,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </PraxiaCard>
      )}

      {/* Results */}
      {result && !loading && (
        <div>
          {/* Filters badge bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <span
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                background: `${accent}22`,
                border: `0.5px solid ${accent}55`,
                color: accent,
                fontFamily: T.mono,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {result.label}
            </span>
            <button
              onClick={() => {
                setResult(null);
                setError(null);
                setQuery("");
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "none",
                color: T.ink50,
                fontFamily: T.body,
                fontSize: 11.5,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Nova busca
            </button>
          </div>

          {/* Rationale */}
          {result.rationale && (
            <div
              style={{
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink50,
                marginBottom: 12,
                lineHeight: 1.4,
              }}
            >
              {result.rationale}
            </div>
          )}

          {/* Stock list */}
          {result.stocks.length === 0 ? (
            <PraxiaCard padding={20}>
              <div
                style={{
                  textAlign: "center",
                  fontFamily: T.body,
                  fontSize: 13,
                  color: T.ink50,
                  lineHeight: 1.5,
                }}
              >
                Nenhuma ação encontrada com esses critérios.
                <br />
                <span style={{ fontSize: 11.5 }}>Tente ampliar os filtros.</span>
              </div>
            </PraxiaCard>
          ) : (
            <>
              <SectionHeader
                label={`${result.stocks.length} resultado${result.stocks.length > 1 ? "s" : ""} encontrado${result.stocks.length > 1 ? "s" : ""}`}
              />
              <PraxiaCard padding={4}>
                {result.stocks.map((s, i) => (
                  <ScreenerRow
                    key={s.ticker}
                    stock={s}
                    rank={i + 1}
                    accent={accent}
                    onClick={() => onOpenStock(s)}
                    isLast={i === result.stocks.length - 1}
                  />
                ))}
              </PraxiaCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScreenerRow({
  stock,
  rank,
  accent,
  onClick,
  isLast,
}: {
  stock: Stock;
  rank: number;
  accent: string;
  onClick: () => void;
  isLast: boolean;
}) {
  const T = PraxiaTokens;
  const positive = stock.changePercent >= 0;
  const scoreColor = stock.score >= 70 ? T.up : stock.score >= 50 ? T.gold : T.down;

  return (
    <button
      onClick={onClick}
      className="pra-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px",
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: isLast ? "none" : `0.5px solid ${T.hairline}`,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {/* Rank */}
      <div
        style={{
          width: 20,
          fontFamily: T.mono,
          fontSize: 10.5,
          color: rank <= 3 ? accent : T.ink30,
          fontWeight: 700,
          flexShrink: 0,
          textAlign: "center",
        }}
      >
        {rank}
      </div>

      <StockAvatar ticker={stock.ticker} size={36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 14,
            color: T.ink,
            lineHeight: 1.2,
          }}
        >
          {stock.ticker}
        </div>
        <div
          style={{
            fontFamily: T.body,
            fontSize: 11.5,
            color: T.ink50,
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {stock.sector ?? "—"} · DY {fmt.pct(stock.dividendYield)}
        </div>
      </div>

      {/* Score badge */}
      <div
        style={{
          padding: "3px 8px",
          borderRadius: 999,
          background: `${scoreColor}1a`,
          border: `0.5px solid ${scoreColor}55`,
          fontFamily: T.mono,
          fontSize: 11,
          fontWeight: 700,
          color: scoreColor,
          flexShrink: 0,
        }}
      >
        {stock.score}
      </div>

      {/* Price + change */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 13,
            color: T.ink,
            fontWeight: 600,
          }}
        >
          {fmt.brl(stock.price)}
        </div>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            color: positive ? T.up : T.down,
            marginTop: 1,
          }}
        >
          {positive ? "+" : ""}
          {fmt.pct(stock.changePercent / 100)}
        </div>
      </div>
    </button>
  );
}
