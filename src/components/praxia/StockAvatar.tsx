import { PraxiaTokens } from "./tokens";
import { brandColor } from "@/lib/stockMeta";

interface StockAvatarProps {
  ticker: string;
  color?: string;
  size?: number;
}

export function StockAvatar({ ticker, color, size = 38 }: StockAvatarProps) {
  const initials = ticker.slice(0, 2);
  const c = color ?? brandColor(ticker);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        flexShrink: 0,
        background: `linear-gradient(140deg, ${c}, ${c}aa)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: PraxiaTokens.display,
        fontWeight: 700,
        fontSize: size * 0.34,
        letterSpacing: 0.4,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px ${c}33`,
        border: "0.5px solid rgba(255,255,255,0.12)",
      }}
    >
      {initials}
    </div>
  );
}
