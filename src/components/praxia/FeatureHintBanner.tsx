import { useState } from "react";
import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";
import { TUTORIAL_HINTS, isHintDismissed, dismissHint, type HintKey } from "@/lib/tutorialHints";

interface FeatureHintBannerProps {
  /** Qual feature explicar — chave do registro TUTORIAL_HINTS. */
  hintKey: HintKey;
  accent?: string;
}

/**
 * Banner dismissivel de tutorial no topo de uma tela. Mostra titulo + 1-2 frases
 * explicando a feature. Ao tocar "Entendi" some e nao volta (persistido em
 * localStorage via tutorialHints). Renderiza null se ja dispensado.
 */
export function FeatureHintBanner({ hintKey, accent = PraxiaTokens.accent }: FeatureHintBannerProps) {
  const T = PraxiaTokens;
  // Lazy: le a dispensa uma vez no mount. As telas remontam ao navegar, entao
  // a leitura fica atualizada sem precisar de effect.
  const [visible, setVisible] = useState(() => !isHintDismissed(hintKey));
  if (!visible) return null;

  const hint = TUTORIAL_HINTS[hintKey];

  function handleDismiss() {
    dismissHint(hintKey);
    setVisible(false);
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        width: "100%",
        marginBottom: 14,
        padding: "12px 12px 12px 14px",
        borderRadius: 14,
        background: `linear-gradient(140deg, ${accent}1c 0%, ${accent}0a 100%)`,
        border: `0.5px solid ${accent}44`,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: `${accent}2e`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon.info size={15} color={accent} />
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 9.5,
            color: accent,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Como usar · {hint.title}
        </div>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: T.body,
            fontSize: 12.5,
            color: T.ink70,
            lineHeight: 1.45,
          }}
        >
          {hint.body}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            marginTop: 10,
            height: 30,
            padding: "0 14px",
            borderRadius: 999,
            background: accent,
            color: "white",
            border: "none",
            fontFamily: T.body,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Entendi
        </button>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fechar dica"
        style={{
          alignSelf: "flex-start",
          width: 24,
          height: 24,
          borderRadius: 12,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon.close size={13} color={T.ink50} />
      </button>
    </div>
  );
}
