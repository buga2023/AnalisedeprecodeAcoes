import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  color?: string;
  fill?: string;
  style?: CSSProperties;
}

const base = (props: IconProps) => ({
  width: props.size ?? 20,
  height: props.size ?? 20,
  viewBox: "0 0 24 24",
  fill: props.fill ?? "none",
  stroke: props.color ?? "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: props.style,
});

export const Icon = {
  home: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-3v-7h-8v7H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  ),
  market: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 17l5-5 4 4 8-9" />
      <path d="M14 7h6v6" />
    </svg>
  ),
  activity: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  ),
  profile: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  ),
  bell: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  menu: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 7h18M3 12h18M3 17h12" />
    </svg>
  ),
  search: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  plus: (p: IconProps = {}) => (
    <svg {...base({ ...p })}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  send: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  ),
  close: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  arrowUp: (p: IconProps = {}) => (
    <svg {...base({ ...p, size: p.size ?? 12 })} viewBox="0 0 12 12">
      <path d="m3 8 3-4 3 4" />
    </svg>
  ),
  arrowDown: (p: IconProps = {}) => (
    <svg {...base({ ...p, size: p.size ?? 12 })} viewBox="0 0 12 12">
      <path d="m3 4 3 4 3-4" />
    </svg>
  ),
  arrowLeft: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  chat: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M21 12a8 8 0 0 1-12 7l-5 2 2-5a8 8 0 1 1 15-4z" />
    </svg>
  ),
  invest: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 16V8m4 8V5m4 11V11m4 5V8m4 8v-3" />
    </svg>
  ),
  funds: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9m0 0h5" />
    </svg>
  ),
  withdraw: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
  ),
  filter: (p: IconProps = {}) => (
    <svg {...base({ ...p, size: p.size ?? 16 })}>
      <path d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  ),
  shield: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />
    </svg>
  ),
  trend: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  feed: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 5h13a4 4 0 0 1 4 4v10H7a4 4 0 0 1-4-4V5z" />
      <path d="M7 9h9M7 13h6" />
    </svg>
  ),
  star: (p: IconProps = {}) => (
    <svg {...base({ ...p, size: p.size ?? 16 })}>
      <path d="M12 3 9 10l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z" />
    </svg>
  ),
  share: (p: IconProps = {}) => (
    <svg {...base({ ...p, size: p.size ?? 16 })}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4M12 2v14" />
    </svg>
  ),
  dots: (p: IconProps = {}) => (
    <svg
      width={p.size ?? 16}
      height={p.size ?? 16}
      viewBox="0 0 24 24"
      fill={p.color ?? "currentColor"}
    >
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  ),
  check: (p: IconProps = {}) => (
    <svg {...base({ ...p, size: p.size ?? 16 })} strokeWidth={2}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  refresh: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  ),
  settings: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  ),
  logout: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  trash: (p: IconProps = {}) => (
    <svg {...base(p)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
};

