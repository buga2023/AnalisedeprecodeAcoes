import { useEffect, useState } from "react";
import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";
import { getCachedStockNews } from "@/lib/stockNews";
import type { Stock } from "@/types/stock";

interface MaterialEventBannerProps {
  stocks: Stock[];
  accent?: string;
  /** Abre o stock detail no ticker em destaque. */
  onOpen: (stock: Stock) => void;
}

interface MaterialHit {
  stock: Stock;
  titulo: string;
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function findMaterialHit(stocks: Stock[]): MaterialHit | null {
  // Só consulta cache local — não dispara IA. Mostra o evento material mais
  // recente entre os tickers da carteira (quantidade > 0).
  let best: { hit: MaterialHit; at: number } | null = null;
  for (const s of stocks) {
    if ((s.quantity || 0) <= 0) continue;
    const cached = getCachedStockNews(s.ticker);
    if (!cached || !cached.hasMaterial) continue;
    if (Date.now() - cached.generatedAt > MAX_AGE_MS) continue;
    const material = cached.itens.find((it) => it.material);
    if (!material) continue;
    if (!best || cached.generatedAt > best.at) {
      best = { hit: { stock: s, titulo: material.titulo }, at: cached.generatedAt };
    }
  }
  return best?.hit ?? null;
}

export function MaterialEventBanner({
  stocks,
  accent = PraxiaTokens.accent,
  onOpen,
}: MaterialEventBannerProps) {
  const T = PraxiaTokens;
  // tick força re-render a cada 30s pra pegar cache atualizado por outras
  // telas (ex.: usuário rodou análise no ScreenStockDetail e voltou pra Home).
  // O setState fica dentro do timer callback, não no corpo do effect — atende
  // a regra react-hooks/set-state-in-effect do React 19. `findMaterialHit` lê
  // de localStorage (fonte externa), então é recalculado a cada render.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const hit = findMaterialHit(stocks);

  if (!hit) return null;

  return (
    <button
      onClick={() => onOpen(hit.stock)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: `linear-gradient(140deg, ${PraxiaTokens.warn}1f 0%, ${accent}10 100%)`,
        border: `0.5px solid ${PraxiaTokens.warn}55`,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: `${PraxiaTokens.warn}33`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon.feed size={14} color={PraxiaTokens.warn} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 9.5,
            color: PraxiaTokens.warn,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Evento material · {hit.stock.ticker}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: T.body,
            fontSize: 12.5,
            color: T.ink,
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hit.titulo}
        </div>
      </div>
      <Icon.arrowUp size={14} color={T.ink50} />
    </button>
  );
}
