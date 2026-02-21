import React from "react";
import { Badge } from "@/components/ui/badge";
import { getScoreLabel } from "@/lib/calculators";
import type { ScoreLabel } from "@/types/stock";

const SCORE_STYLES: Record<ScoreLabel, string> = {
  "Compra Forte": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "Observação": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "Risco Elevado": "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, className = "" }) => {
  const label = getScoreLabel(score);
  const style = SCORE_STYLES[label];

  return (
    <Badge
      className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 shadow-lg ${style} ${className}`}
    >
      {label}
    </Badge>
  );
};
