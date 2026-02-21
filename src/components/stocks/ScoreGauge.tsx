import React from "react";
import { getScoreLabel } from "@/lib/calculators";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "lg";
}

function getScoreColor(score: number): string {
  if (score > 80) return "#34d399";  // emerald-400
  if (score >= 50) return "#fbbf24"; // amber-400
  return "#fb7185";                   // rose-400
}

function getScoreTrailColor(score: number): string {
  if (score > 80) return "rgba(52, 211, 153, 0.15)";
  if (score >= 50) return "rgba(251, 191, 36, 0.15)";
  return "rgba(251, 113, 133, 0.15)";
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, size = "lg" }) => {
  const label = getScoreLabel(score);
  const color = getScoreColor(score);
  const trailColor = getScoreTrailColor(score);

  const dim = size === "lg" ? 160 : 100;
  const strokeWidth = size === "lg" ? 12 : 8;
  const radius = (dim - strokeWidth) / 2;
  const circumference = Math.PI * radius; // semicircle
  const progress = (score / 100) * circumference;
  const fontSize = size === "lg" ? "text-3xl" : "text-lg";
  const labelSize = size === "lg" ? "text-[10px]" : "text-[8px]";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={dim}
        height={dim / 2 + strokeWidth}
        viewBox={`0 0 ${dim} ${dim / 2 + strokeWidth}`}
      >
        {/* Trail */}
        <path
          d={`M ${strokeWidth / 2} ${dim / 2} A ${radius} ${radius} 0 0 1 ${dim - strokeWidth / 2} ${dim / 2}`}
          fill="none"
          stroke={trailColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M ${strokeWidth / 2} ${dim / 2} A ${radius} ${radius} 0 0 1 ${dim - strokeWidth / 2} ${dim / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-8">
        <span className={`${fontSize} font-black`} style={{ color }}>
          {score}
        </span>
        <span className={`${labelSize} font-black uppercase tracking-[0.2em] text-muted-foreground`}>
          {label}
        </span>
      </div>
    </div>
  );
};
