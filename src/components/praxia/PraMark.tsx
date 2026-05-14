interface PraMarkProps {
  size?: number;
  accent?: string;
}

/** Pra avatar — circular gradient with the "P" glyph + spark dot. */
export function PraMark({ size = 22, accent = "#5b7cff" }: PraMarkProps) {
  const gid = "pra-g-" + accent.replace("#", "") + "-" + size;
  const sid = "pra-s-" + accent.replace("#", "") + "-" + size;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id={gid} cx="0.32" cy="0.28" r="0.95">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="38%" stopColor={accent} stopOpacity="1" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.7" />
        </radialGradient>
        <linearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#${gid})`} />
      <circle cx="16" cy="16" r="14" fill={`url(#${sid})`} />
      <path d="M12 9.5v13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M12 9.5c5.5 0 7.5 2.2 7.5 5s-2 5-7.5 5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="16.5" cy="14.5" r="1.4" fill="white" />
    </svg>
  );
}
