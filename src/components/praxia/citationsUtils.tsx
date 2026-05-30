import { PraxiaTokens } from "./tokens";

/**
 * Helpers de citações (não-componentes). Separados de `Citations.tsx` para que
 * o arquivo de componentes exporte só componentes (react-refresh/Fast Refresh).
 */

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
