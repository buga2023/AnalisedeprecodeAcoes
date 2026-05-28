import { useCallback, useEffect, useState } from "react";
import { PraxiaTokens } from "@/components/praxia/tokens";
import type { ChatTone } from "@/hooks/usePraChat";

const STORAGE_KEY = "praxia-ui-prefs";

export type AIVerbosity = "concise" | "verbose";

interface Preferences {
  accent: string;
  tone: ChatTone;
  /**
   * Verbosidade da IA. "concise" (default) usa thinking compacto, prompt
   * enxuto e templates deterministicos onde possivel — economiza tokens.
   * "verbose" desliga as otimizacoes pra ter o output completo (debug).
   */
  aiVerbosity: AIVerbosity;
}

const DEFAULTS: Preferences = {
  accent: PraxiaTokens.accent,
  tone: "casual",
  aiVerbosity: "concise",
};

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    /* swallow */
  }
  return DEFAULTS;
}

export function useUIPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setAccent = useCallback(
    (accent: string) => setPrefs((p) => ({ ...p, accent })),
    []
  );
  const setTone = useCallback(
    (tone: ChatTone) => setPrefs((p) => ({ ...p, tone })),
    []
  );
  const setAIVerbosity = useCallback(
    (aiVerbosity: AIVerbosity) => setPrefs((p) => ({ ...p, aiVerbosity })),
    []
  );

  return { ...prefs, setAccent, setTone, setAIVerbosity };
}
