import { PraxiaTokens } from "./tokens";
import { PraMark } from "./PraMark";

interface FloatingPraButtonProps {
  onClick: () => void;
  accent?: string;
  hasNew?: boolean;
}

export function FloatingPraButton({
  onClick,
  accent = PraxiaTokens.accent,
  hasNew = false,
}: FloatingPraButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Conversar com a Pra"
      style={{
        position: "absolute",
        right: 16,
        bottom: 100,
        zIndex: 5,
        width: 58,
        height: 58,
        borderRadius: 29,
        border: "none",
        cursor: "pointer",
        background: `linear-gradient(140deg, ${accent}, ${accent}aa)`,
        boxShadow: `0 12px 32px ${accent}66, 0 0 0 4px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.3)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PraMark size={36} accent={accent} />
      {hasNew && (
        <div
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: PraxiaTokens.up,
            border: "2px solid #05071a",
          }}
        />
      )}
    </button>
  );
}
