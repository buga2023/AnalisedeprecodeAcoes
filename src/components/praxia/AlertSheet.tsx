import { useState } from "react";
import { PraxiaTokens, fmt } from "./tokens";
import { Icon } from "./Icon";
import type { AlertType, Stock } from "@/types/stock";

interface AlertSheetProps {
  open: boolean;
  accent: string;
  stock: Stock | null;
  onClose: () => void;
  onCreate: (input: { type: AlertType; value: number; note?: string }) => void;
}

const TYPE_OPTIONS: { value: AlertType; label: string; hint: string }[] = [
  { value: "price-below", label: "Preço abaixo de", hint: "alvo de compra" },
  { value: "price-above", label: "Preço acima de", hint: "alvo de venda" },
  { value: "graham-margin", label: "Margem Graham ≥", hint: "oportunidade" },
  { value: "change-drop", label: "Queda no dia ≥", hint: "stop manual" },
];

/** Default suggested value for a given alert type + stock snapshot. */
function defaultValueFor(type: AlertType, stock: Stock | null): string {
  if (!stock) return "";
  switch (type) {
    case "price-below":
      return (stock.price * 0.95).toFixed(2);
    case "price-above":
      return (stock.price * 1.1).toFixed(2);
    case "graham-margin":
      return "20";
    case "change-drop":
      return "5";
  }
}

export function AlertSheet({ open, accent, stock, onClose, onCreate }: AlertSheetProps) {
  const T = PraxiaTokens;
  const [type, setType] = useState<AlertType>("price-below");
  const [value, setValue] = useState<string>(() => defaultValueFor("price-below", stock));
  const [note, setNote] = useState<string>("");
  // Remember which (stock,type) combo we last seeded so we don't overwrite
  // user edits but DO refresh when the user changes ticker or alert type.
  const [seedKey, setSeedKey] = useState<string>(stock ? `${stock.ticker}:price-below` : ":");

  if (!open || !stock) return null;

  const expectedKey = `${stock.ticker}:${type}`;
  if (expectedKey !== seedKey) {
    // Defer the state update to a microtask via render-phase guard: do it
    // exactly once when the combo changes, NOT every render.
    setValue(defaultValueFor(type, stock));
    setSeedKey(expectedKey);
  }

  const numericValue = parseFloat(value.replace(",", "."));
  const canSubmit = !Number.isNaN(numericValue) && numericValue > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        background: "rgba(2,3,20,0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        animation: "praFadeIn 0.18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: `linear-gradient(180deg, ${PraxiaTokens.surface} 0%, ${PraxiaTokens.bg} 100%)`,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: `0.5px solid ${T.hairlineStrong}`,
          padding: "18px 18px 24px",
          animation: "praSlideUp 0.22s ease-out",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 17,
                color: T.ink,
                letterSpacing: -0.3,
              }}
            >
              Criar alerta
            </div>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink50,
                marginTop: 2,
              }}
            >
              {stock.ticker} · {fmt.brl(stock.price)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: "rgba(255,255,255,0.06)",
              border: `0.5px solid ${T.hairline}`,
              color: T.ink70,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon.close size={14} color={T.ink70} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                textAlign: "left",
                background: type === opt.value ? `${accent}25` : "rgba(255,255,255,0.04)",
                border:
                  type === opt.value
                    ? `1px solid ${accent}`
                    : `0.5px solid ${T.hairline}`,
                color: T.ink,
                cursor: "pointer",
              }}
            >
              <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 12.5 }}>
                {opt.label}
              </div>
              <div style={{ fontFamily: T.body, fontSize: 10.5, color: T.ink50, marginTop: 2 }}>
                {opt.hint}
              </div>
            </button>
          ))}
        </div>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily: T.body,
            fontSize: 12,
            color: T.ink50,
            fontWeight: 500,
          }}
        >
          {type === "price-below" || type === "price-above"
            ? "Preço alvo (R$)"
            : type === "graham-margin"
              ? "Margem mínima (%)"
              : "Queda mínima no dia (%)"}
          <input
            id="alert-value"
            name="value"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              height: 44,
              padding: "0 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: `0.5px solid ${T.hairline}`,
              color: T.ink,
              fontFamily: T.mono,
              fontSize: 15,
              outline: "none",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontFamily: T.body,
            fontSize: 12,
            color: T.ink50,
            fontWeight: 500,
          }}
        >
          Observação (opcional)
          <input
            id="alert-note"
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: comprar mais 100 cotas"
            style={{
              height: 40,
              padding: "0 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: `0.5px solid ${T.hairline}`,
              color: T.ink,
              fontFamily: T.body,
              fontSize: 13,
              outline: "none",
            }}
          />
        </label>

        <button
          disabled={!canSubmit}
          onClick={() => {
            if (!canSubmit) return;
            onCreate({ type, value: numericValue, note: note.trim() || undefined });
            setNote("");
            onClose();
          }}
          style={{
            height: 48,
            borderRadius: 14,
            background: canSubmit ? accent : "rgba(255,255,255,0.1)",
            color: canSubmit ? "white" : "rgba(255,255,255,0.4)",
            border: "none",
            fontFamily: T.display,
            fontSize: 14,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            boxShadow: canSubmit ? `0 10px 24px ${accent}55` : "none",
          }}
        >
          Criar alerta
        </button>
      </div>
    </div>
  );
}
