import { useMemo } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { Icon } from "../Icon";
import { StockAvatar } from "../StockAvatar";
import type { Transaction } from "@/types/stock";

interface ScreenActivityProps {
  transactions: Transaction[];
  accent?: string;
}

export function ScreenActivity({ transactions, accent = PraxiaTokens.accent }: ScreenActivityProps) {
  const T = PraxiaTokens;

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const key = new Date(t.timestamp).toLocaleDateString("pt-BR");
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [transactions]);

  const totalBuys = transactions
    .filter((t) => t.type === "buy")
    .reduce((acc, t) => acc + t.total, 0);
  const totalSells = transactions
    .filter((t) => t.type === "sell")
    .reduce((acc, t) => acc + t.total, 0);

  return (
    <div
      className="praxia-scroll"
      style={{
        position: "relative",
        height: "100dvh",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <PraxiaBackground accent={accent} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "54px 16px 120px",
        }}
      >
        <div
          style={{
            fontFamily: T.display,
            fontSize: 24,
            fontWeight: 600,
            color: T.ink,
            letterSpacing: -0.6,
            marginBottom: 14,
          }}
        >
          Atividade
        </div>

        {/* Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <PraxiaCard padding={14}>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50 }}>
              Compras
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 16,
                color: T.up,
                fontWeight: 600,
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt.brl(totalBuys)}
            </div>
          </PraxiaCard>
          <PraxiaCard padding={14}>
            <div style={{ fontFamily: T.body, fontSize: 11, color: T.ink50 }}>
              Vendas
            </div>
            <div
              style={{
                fontFamily: T.mono,
                fontSize: 16,
                color: T.down,
                fontWeight: 600,
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt.brl(totalSells)}
            </div>
          </PraxiaCard>
        </div>

        {transactions.length === 0 ? (
          <PraxiaCard padding={28}>
            <div
              style={{
                textAlign: "center",
                color: T.ink50,
                fontFamily: T.body,
                fontSize: 13.5,
                lineHeight: 1.5,
              }}
            >
              Nenhuma transação ainda.
              <br />
              Compre uma ação para começar a montar seu histórico.
            </div>
          </PraxiaCard>
        ) : (
          grouped.map(([day, items]) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontFamily: T.mono,
                  fontSize: 10.5,
                  color: T.ink50,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 6,
                  paddingLeft: 4,
                }}
              >
                {day}
              </div>
              <PraxiaCard padding={4}>
                {items.map((tx, i) => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    isLast={i === items.length - 1}
                  />
                ))}
              </PraxiaCard>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TxRow({ tx, isLast }: { tx: Transaction; isLast: boolean }) {
  const T = PraxiaTokens;
  const isBuy = tx.type === "buy";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderBottom: isLast ? "none" : `0.5px solid ${T.hairline}`,
      }}
    >
      <StockAvatar ticker={tx.ticker} />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: 14.5,
            color: T.ink,
          }}
        >
          {isBuy ? "Compra" : "Venda"} {tx.ticker}
        </div>
        <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50 }}>
          {tx.shares} × {tx.price.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}{" "}
          · {tx.orderType}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontFamily: T.mono,
            fontSize: 13.5,
            color: isBuy ? T.up : T.down,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isBuy ? (
            <Icon.arrowUp size={10} color={T.up} />
          ) : (
            <Icon.arrowDown size={10} color={T.down} />
          )}
          {fmt.brl(tx.total)}
        </div>
        <div
          style={{
            fontFamily: T.body,
            fontSize: 10.5,
            color: T.ink30,
            marginTop: 2,
          }}
        >
          {new Date(tx.timestamp).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
