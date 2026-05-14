import { PraxiaTokens } from "./tokens";

/**
 * Split a Pra message into its body and a `Fontes:` block (if present).
 * The Fontes block is everything after a line starting with "Fontes:".
 */
export function splitCitations(text: string): { body: string; sources: string[] } {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*fontes\s*:\s*$/i.test(l) || /^\s*fontes\s*:/i.test(l));
  if (idx === -1) return { body: text, sources: [] };

  const body = lines.slice(0, idx).join("\n").trimEnd();
  // The "Fontes:" line itself may already contain the first source on the same line
  const first = lines[idx].replace(/^\s*fontes\s*:\s*/i, "").trim();
  const tail = lines.slice(idx + 1);
  const all = [first, ...tail].map((l) => l.trim()).filter(Boolean);
  return { body, sources: all };
}

/** Convert URLs in a string into clickable anchor segments. */
export function renderWithLinks(text: string, accent: string) {
  const T = PraxiaTokens;
  // Highlight inline references like [1], [2] and turn URLs into links
  const parts: React.ReactNode[] = [];
  const urlRe = /(https?:\/\/[^\s)]+)/g;
  const refRe = /(\[\d+\])/g;

  // First split by URLs, then process refs within non-url chunks
  let key = 0;
  const segments = text.split(urlRe);
  segments.forEach((seg) => {
    if (urlRe.test(seg)) {
      parts.push(
        <a
          key={`u-${key++}`}
          href={seg}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: accent, textDecoration: "underline", wordBreak: "break-all" }}
        >
          {seg}
        </a>
      );
      // Reset lastIndex (split semantics keep regex sticky in some envs)
      urlRe.lastIndex = 0;
      return;
    }
    // process [n] refs
    seg.split(refRe).forEach((piece) => {
      if (refRe.test(piece)) {
        parts.push(
          <sup
            key={`r-${key++}`}
            style={{
              color: accent,
              fontFamily: T.mono,
              fontSize: "0.78em",
              fontWeight: 600,
              padding: "0 1px",
            }}
          >
            {piece}
          </sup>
        );
        refRe.lastIndex = 0;
      } else {
        parts.push(<span key={`t-${key++}`}>{piece}</span>);
      }
    });
  });

  return parts;
}

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
