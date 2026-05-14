import { PraxiaTokens } from "./tokens";

interface AIBadgeProps {
  /** "alta" | "media" | "baixa" — modula a intensidade visual */
  confianca?: "alta" | "media" | "baixa";
  /** Texto tooltip; quando passado é mostrado via title nativo */
  reference?: string;
  /** Tamanho compacto (8px) ou padrão (10px). */
  size?: "xs" | "sm";
}

/**
 * Selo "IA" — usado para marcar qualquer valor que veio do fallback de IA
 * (não foi servido pela fonte primária). Sempre acompanhado de tooltip com
 * a referência da estimativa, deixando claro para o usuário que é estimativa.
 */
export function AIBadge({ confianca = "media", reference, size = "xs" }: AIBadgeProps) {
  const T = PraxiaTokens;
  const intensity = confianca === "alta" ? 0.85 : confianca === "media" ? 0.65 : 0.45;
  const px = size === "xs" ? 8 : 10;
  return (
    <span
      title={
        reference
          ? `Estimado por IA · ${confianca} confiança · ${reference}`
          : `Estimado por IA · ${confianca} confiança`
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: size === "xs" ? "1px 4px" : "2px 6px",
        marginLeft: 6,
        borderRadius: 3,
        background: `rgba(200,162,92,${intensity * 0.20})`,
        border: `0.5px solid rgba(200,162,92,${intensity * 0.65})`,
        color: T.gold,
        fontFamily: T.mono,
        fontSize: px,
        fontWeight: 700,
        letterSpacing: 0.8,
        verticalAlign: "middle",
        cursor: reference ? "help" : "default",
      }}
    >
      <svg
        width={px + 1}
        height={px + 1}
        viewBox="0 0 12 12"
        fill="none"
        stroke={T.gold}
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M3 9V3l3 4 3-4v6" />
      </svg>
      IA
    </span>
  );
}
