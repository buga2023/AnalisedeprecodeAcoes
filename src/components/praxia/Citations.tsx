import { PraxiaTokens } from "./tokens";
import { renderWithLinks } from "./citationsUtils";

interface SourcesListProps {
  sources: string[];
  accent: string;
}

/** Pretty-print the parsed `Fontes:` block. */
export function SourcesList({ sources, accent }: SourcesListProps) {
  const T = PraxiaTokens;
  if (sources.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: `0.5px dashed ${T.hairline}`,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 9.5,
          letterSpacing: 0.8,
          color: T.ink50,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        Fontes
      </div>
      {sources.map((src, i) => (
        <div
          key={i}
          style={{
            fontFamily: T.body,
            fontSize: 11,
            color: T.ink70,
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {renderWithLinks(src, accent)}
        </div>
      ))}
    </div>
  );
}

/** Single inline source pill (used by structured insight cards). */
export function SourceChip({ source, accent }: { source: string; accent: string }) {
  const T = PraxiaTokens;
  const isUrl = /^https?:\/\//i.test(source);
  if (isUrl) {
    return (
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: T.mono,
          fontSize: 10,
          padding: "2px 8px",
          borderRadius: 999,
          background: `${accent}1a`,
          color: accent,
          border: `0.5px solid ${accent}33`,
          textDecoration: "none",
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "inline-block",
        }}
        title={source}
      >
        {new URL(source).hostname}
      </a>
    );
  }
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        color: T.ink70,
        border: `0.5px solid ${T.hairline}`,
      }}
    >
      {source}
    </span>
  );
}
