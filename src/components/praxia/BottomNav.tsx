import { PraxiaTokens } from "./tokens";
import { Icon } from "./Icon";

export type NavTab = "home" | "market" | "activity" | "profile";

interface BottomNavProps {
  tab: NavTab;
  onChange: (t: NavTab) => void;
  accent?: string;
}

const ITEMS: { k: NavTab; lbl: string; render: (c: string) => React.ReactNode }[] = [
  { k: "home", lbl: "Início", render: (c) => <Icon.home color={c} size={18} /> },
  { k: "market", lbl: "Mercado", render: (c) => <Icon.market color={c} size={18} /> },
  {
    k: "activity",
    lbl: "Atividade",
    render: (c) => <Icon.activity color={c} size={18} />,
  },
  { k: "profile", lbl: "Perfil", render: (c) => <Icon.profile color={c} size={18} /> },
];

export function BottomNav({ tab, onChange, accent = PraxiaTokens.accent }: BottomNavProps) {
  const T = PraxiaTokens;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 4,
        padding: "8px 12px 24px",
        background: "linear-gradient(180deg, transparent, rgba(2,3,20,0.92) 30%)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: 60,
          borderRadius: 30,
          background: "rgba(13, 19, 48, 0.7)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "0.5px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 16px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          pointerEvents: "auto",
        }}
      >
        {ITEMS.map((it) => {
          const active = tab === it.k;
          const color = active ? accent : T.ink50;
          return (
            <button
              key={it.k}
              onClick={() => onChange(it.k)}
              aria-label={it.lbl}
              aria-current={active ? "page" : undefined}
              style={{
                flex: active ? 1.45 : 1,
                height: 44,
                borderRadius: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: active ? `${accent}22` : "transparent",
                border: "none",
                cursor: "pointer",
                color,
                fontFamily: T.body,
                fontWeight: 600,
                fontSize: 12,
                letterSpacing: -0.1,
                transition:
                  "flex 0.28s cubic-bezier(.2,.7,.3,1), background 0.2s ease, color 0.2s ease",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {it.render(color)}
              <span
                style={{
                  maxWidth: active ? 80 : 0,
                  opacity: active ? 1 : 0,
                  transition: "max-width 0.28s cubic-bezier(.2,.7,.3,1), opacity 0.2s ease",
                  overflow: "hidden",
                  display: "inline-block",
                }}
              >
                {it.lbl}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
