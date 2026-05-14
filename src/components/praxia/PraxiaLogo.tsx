interface PraxiaLogoProps {
  size?: number;
  accent?: string;
}

export function PraxiaLogo({ size = 22, accent = "#5b7cff" }: PraxiaLogoProps) {
  const r = Math.round(size * 0.26);
  const gid = "plg-" + accent.replace("#", "") + "-" + size;
  const sid = "pls-" + size;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        position: "relative",
        overflow: "hidden",
        boxShadow: `0 2px 10px ${accent}55, inset 0 0.5px 0 rgba(255,255,255,0.4)`,
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="55%" stopColor={accent} />
            <stop offset="100%" stopColor={accent} stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id={sid} cx="0.3" cy="0.25" r="0.65">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect width="32" height="32" rx={(r * 32) / size} fill={`url(#${gid})`} />
        <rect width="32" height="32" rx={(r * 32) / size} fill={`url(#${sid})`} />
        <path d="M11 7v18" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
        <path
          d="M11 7c7 0 9.5 2.8 9.5 6.5S18 20 11 20"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="16.5" cy="13.5" r="1.7" fill="white" />
      </svg>
    </div>
  );
}
