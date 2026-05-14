import { smoothPath, PraxiaTokens } from "./tokens";

interface SparklineProps {
  values: number[];
  w?: number;
  h?: number;
  color?: string;
  strokeWidth?: number;
}

export function Sparkline({
  values,
  w = 60,
  h = 24,
  color = PraxiaTokens.up,
  strokeWidth = 1.6,
}: SparklineProps) {
  if (values.length < 2) {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} />;
  }
  const d = smoothPath(values, w, h, 2);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface AreaChartProps {
  values: number[];
  w: number;
  h: number;
  color: string;
  fillId: string;
  strokeWidth?: number;
  padBottom?: number;
}

export function AreaChart({
  values,
  w,
  h,
  color,
  fillId,
  strokeWidth = 1.8,
  padBottom = 0,
}: AreaChartProps) {
  if (values.length < 2) {
    return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} />;
  }
  const d = smoothPath(values, w, h - padBottom, 4);
  const fillD = `${d} L ${w - 4} ${h - padBottom - 4} L 4 ${h - padBottom - 4} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${fillId})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
