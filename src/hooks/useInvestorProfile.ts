import { useCallback, useState } from "react";
import type { InvestorProfile } from "@/types/stock";

const STORAGE_KEY = "praxia-investor-profile";

function load(): InvestorProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as InvestorProfile;
  } catch {
    /* swallow */
  }
  return null;
}

function persist(p: InvestorProfile | null) {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota / SSR */
  }
}

export function useInvestorProfile() {
  const [profile, setProfile] = useState<InvestorProfile | null>(load);

  const saveProfile = useCallback(
    (p: Omit<InvestorProfile, "completedAt">) => {
      const next: InvestorProfile = { ...p, completedAt: new Date().toISOString() };
      persist(next);
      setProfile(next);
    },
    []
  );

  const reset = useCallback(() => {
    persist(null);
    setProfile(null);
  }, []);

  return { profile, saveProfile, reset, hasProfile: profile !== null };
}

/** Human-readable label for a risk tolerance. */
export function riskLabel(r: InvestorProfile["risk"]): string {
  return r === "low" ? "Conservador" : r === "mid" ? "Moderado" : "Arrojado";
}

export function horizonLabel(h: InvestorProfile["horizon"]): string {
  return h === "short" ? "Curto (até 1 ano)" : h === "mid" ? "Médio (1-5 anos)" : "Longo (5+ anos)";
}

export function interestLabel(i: InvestorProfile["interests"][number]): string {
  return i === "div"
    ? "Dividendos"
    : i === "gro"
    ? "Crescimento"
    : i === "esg"
    ? "ESG"
    : "Tecnologia";
}
