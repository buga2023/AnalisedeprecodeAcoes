import { useCallback, useEffect, useRef, useState } from "react";
import { PraxiaTokens } from "@/components/praxia/tokens";
import type { ChatTone } from "@/hooks/usePraChat";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchPreferencesFromServer,
  savePreferencesToServer,
} from "@/lib/supabaseSync";

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
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(load);
  const syncedUserRef = useRef<string | null>(null);
  const skipNextWriteRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    // Write-through pra Supabase. Pula quando o setPrefs veio da propria sync
    // (evita loop infinito).
    if (user && !skipNextWriteRef.current) {
      void savePreferencesToServer(user.id, {
        accent: prefs.accent,
        tone: prefs.tone,
        aiVerbosity: prefs.aiVerbosity,
      });
    }
    skipNextWriteRef.current = false;
  }, [prefs, user]);

  // Sync on login.
  useEffect(() => {
    if (!user) {
      syncedUserRef.current = null;
      return;
    }
    if (syncedUserRef.current === user.id) return;

    let cancelled = false;
    (async () => {
      const remote = await fetchPreferencesFromServer(user.id);
      if (cancelled) return;
      syncedUserRef.current = user.id;

      if (remote) {
        skipNextWriteRef.current = true;
        setPrefs({
          accent: remote.accent,
          tone: remote.tone,
          aiVerbosity: remote.aiVerbosity,
        });
      } else {
        // Servidor sem preferencias — sobe as locais.
        await savePreferencesToServer(user.id, {
          accent: prefs.accent,
          tone: prefs.tone,
          aiVerbosity: prefs.aiVerbosity,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
