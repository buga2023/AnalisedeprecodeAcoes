import { useRef, useState } from "react";
import { PraxiaTokens, fmt } from "../tokens";
import { PraxiaBackground } from "../PraxiaBackground";
import { PraxiaCard } from "../PraxiaCard";
import { GlassButton } from "../GlassButton";
import { Icon } from "../Icon";
import { SectionHeader } from "../SectionHeader";
import { useBatchValuation, type PendingData } from "@/hooks/useBatchValuation";
import { exportResults } from "@/lib/exportResults";
import type { CSVRow, ValuationRow } from "@/types/stock";

interface ScreenBatchValuationProps {
  accent?: string;
  onBack: () => void;
}

const REQUIRED_FIELDS: { key: keyof CSVRow; label: string; required: boolean }[] = [
  { key: "ticker", label: "Ticker", required: true },
  { key: "avgCost", label: "Preço médio", required: false },
  { key: "quantity", label: "Quantidade", required: false },
  { key: "dpa", label: "DPA (Dividendo/ação)", required: false },
  { key: "eps", label: "LPA (EPS)", required: false },
  { key: "bvps", label: "VPA (BVPS)", required: false },
];

export function ScreenBatchValuation({ accent = PraxiaTokens.accent, onBack }: ScreenBatchValuationProps) {
  const T = PraxiaTokens;
  const {
    rows,
    isLoading,
    progress,
    growthRate,
    pendingData,
    startImport,
    processBatch,
    cancelImport,
    updateGrowthRate,
    clearBatch,
  } = useBatchValuation();
  const fileRef = useRef<HTMLInputElement>(null);

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
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <GlassButton onClick={onBack} ariaLabel="Voltar">
            <Icon.arrowLeft size={16} color={T.ink70} />
          </GlassButton>
          <div
            style={{
              fontFamily: T.display,
              fontSize: 22,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: -0.4,
            }}
          >
            Valuation em lote
          </div>
        </div>

        <PraxiaCard padding={16}>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 13,
              color: T.ink70,
              lineHeight: 1.5,
            }}
          >
            Importe uma planilha (CSV ou XLSX) com sua carteira; o app busca a cotação atual,
            calcula Bazin, Graham VI, Graham Crescimento e ROI por ticker.
          </div>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              id="valuation-file-input"
              name="valuation-file"
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startImport(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <button
              disabled={isLoading}
              onClick={() => fileRef.current?.click()}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                background: accent,
                color: "white",
                border: "none",
                fontFamily: T.display,
                fontWeight: 600,
                fontSize: 13.5,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
                boxShadow: `0 6px 18px ${accent}55`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Icon.plus size={15} color="white" />
              Selecionar arquivo
            </button>
            {rows.length > 0 && (
              <button
                onClick={clearBatch}
                style={{
                  height: 44,
                  padding: "0 14px",
                  borderRadius: 12,
                  background: "rgba(255,107,129,0.08)",
                  color: T.down,
                  border: "0.5px solid rgba(255,107,129,0.3)",
                  fontFamily: T.body,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Limpar
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: T.body,
                fontSize: 12,
                color: T.ink50,
                fontWeight: 500,
              }}
            >
              Crescimento Graham
            </div>
            <input
              id="growth-rate-input"
              name="growthRate"
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={growthRate}
              onChange={(e) => updateGrowthRate(parseFloat(e.target.value) || 0)}
              style={{
                width: 70,
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: `0.5px solid ${T.hairline}`,
                color: T.ink,
                fontFamily: T.mono,
                fontSize: 12.5,
                outline: "none",
              }}
            />
            <div style={{ fontFamily: T.body, fontSize: 12, color: T.ink50 }}>% a.a.</div>
          </div>
        </PraxiaCard>

        {pendingData && (
          <ColumnMapperCard
            accent={accent}
            data={pendingData}
            onCancel={cancelImport}
            onConfirm={(mapping) => processBatch(mapping)}
          />
        )}

        {isLoading && progress.total > 0 && (
          <PraxiaCard padding={14}>
            <div
              style={{
                fontFamily: T.body,
                fontSize: 12.5,
                color: T.ink70,
                marginBottom: 8,
              }}
            >
              Processando {progress.done} de {progress.total}…
            </div>
            <div
              style={{
                width: "100%",
                height: 6,
                borderRadius: 3,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(progress.done / progress.total) * 100}%`,
                  height: "100%",
                  background: accent,
                  transition: "width 0.2s",
                }}
              />
            </div>
          </PraxiaCard>
        )}

        {rows.length > 0 && (
          <>
            <SectionHeader
              label={`Resultados (${rows.length})`}
              trailing="Exportar XLSX"
              onTrailingClick={() => exportResults(rows)}
            />
            <PraxiaCard padding={4}>
              {rows.map((row, i) => (
                <ResultRow key={`${row.ticker}-${i}`} row={row} isLast={i === rows.length - 1} />
              ))}
            </PraxiaCard>
          </>
        )}
      </div>
    </div>
  );
}

function ResultRow({ row, isLast }: { row: ValuationRow; isLast: boolean }) {
  const T = PraxiaTokens;

  const buys =
    (row.bazinSignal === "Comprar" ? 1 : 0) +
    (row.grahamSignal === "Comprar" ? 1 : 0) +
    (row.grahamGrowthSignal === "Comprar" ? 1 : 0);
  const overall = buys >= 2 ? "COMPRAR" : buys === 0 ? "CARO" : "OBSERVAR";
  const overallColor = overall === "COMPRAR" ? T.up : overall === "CARO" ? T.down : T.warn;

  return (
    <div
      style={{
        padding: "12px 12px",
        borderBottom: isLast ? "none" : `0.5px solid ${T.hairline}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: 14,
              color: T.ink,
              letterSpacing: 0.2,
            }}
          >
            {row.ticker}
          </div>
          <div
            style={{
              fontFamily: T.body,
              fontSize: 11,
              color: T.ink50,
              marginTop: 2,
            }}
          >
            {row.currentPrice !== null
              ? `${fmt.brl(row.currentPrice)}${row.roi !== null ? ` · ROI ${row.roi.toFixed(1)}%` : ""}`
              : row.fetchError ?? "Sem cotação"}
          </div>
        </div>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            background: `${overallColor}1f`,
            color: overallColor,
            fontFamily: T.display,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        >
          {overall}
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
        }}
      >
        <Metric label="Bazin" value={row.bazinCeiling} margin={row.bazinMargin} signal={row.bazinSignal} />
        <Metric label="Graham" value={row.grahamVI} margin={row.grahamMargin} signal={row.grahamSignal} />
        <Metric label="G. Cresc." value={row.grahamGrowth} margin={row.grahamGrowthMargin} signal={row.grahamGrowthSignal} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  margin,
  signal,
}: {
  label: string;
  value: number | null;
  margin: number | null;
  signal: "Comprar" | "Caro" | "Sem dados";
}) {
  const T = PraxiaTokens;
  const color = signal === "Comprar" ? T.up : signal === "Caro" ? T.down : T.ink50;
  return (
    <div
      style={{
        padding: "6px 8px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        border: `0.5px solid ${T.hairline}`,
      }}
    >
      <div
        style={{
          fontFamily: T.body,
          fontSize: 10,
          color: T.ink50,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: 12,
          color: T.ink,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value !== null ? fmt.brl(value) : "—"}
      </div>
      <div
        style={{
          marginTop: 2,
          fontFamily: T.mono,
          fontSize: 10,
          color,
          fontWeight: 600,
        }}
      >
        {margin !== null ? `${margin >= 0 ? "+" : ""}${margin.toFixed(1)}%` : "—"}
      </div>
    </div>
  );
}

function ColumnMapperCard({
  accent,
  data,
  onCancel,
  onConfirm,
}: {
  accent: string;
  data: PendingData;
  onCancel: () => void;
  onConfirm: (mapping: Record<keyof CSVRow, number | undefined>) => void;
}) {
  const T = PraxiaTokens;
  const [mapping, setMapping] = useState<Record<keyof CSVRow, number | undefined>>(() => {
    const init: Record<keyof CSVRow, number | undefined> = {
      ticker: undefined,
      avgCost: undefined,
      quantity: undefined,
      dpa: undefined,
      eps: undefined,
      bvps: undefined,
    };
    for (const [k, v] of Object.entries(data.initialMapping)) {
      init[k as keyof CSVRow] = v as number;
    }
    return init;
  });

  const canConfirm = mapping.ticker !== undefined;

  return (
    <PraxiaCard padding={16}>
      <div
        style={{
          fontFamily: T.display,
          fontSize: 14,
          fontWeight: 600,
          color: T.ink,
        }}
      >
        Mapear colunas
      </div>
      <div
        style={{
          fontFamily: T.body,
          fontSize: 12,
          color: T.ink50,
          marginTop: 4,
        }}
      >
        Arquivo: <b style={{ color: T.ink70 }}>{data.fileName}</b> · {data.rows.length} linhas
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {REQUIRED_FIELDS.map((field) => (
          <div key={field.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: 1,
                fontFamily: T.body,
                fontSize: 12.5,
                color: T.ink70,
              }}
            >
              {field.label}
              {field.required && <span style={{ color: T.down, marginLeft: 4 }}>*</span>}
            </div>
            <select
              id={`mapping-${field.key}`}
              name={`mapping-${field.key}`}
              value={mapping[field.key] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setMapping((prev) => ({
                  ...prev,
                  [field.key]: v === "" ? undefined : parseInt(v, 10),
                }));
              }}
              style={{
                flex: 1.2,
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: `0.5px solid ${T.hairline}`,
                color: T.ink,
                fontFamily: T.body,
                fontSize: 12.5,
                outline: "none",
              }}
            >
              <option value="">— ignorar —</option>
              {data.headers.map((h, i) => (
                <option key={`${h}-${i}`} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            color: T.ink70,
            border: `0.5px solid ${T.hairline}`,
            fontFamily: T.body,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          disabled={!canConfirm}
          onClick={() => onConfirm(mapping)}
          style={{
            flex: 1.4,
            height: 40,
            borderRadius: 10,
            background: canConfirm ? accent : "rgba(255,255,255,0.1)",
            color: canConfirm ? "white" : "rgba(255,255,255,0.4)",
            border: "none",
            fontFamily: T.display,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: canConfirm ? "pointer" : "not-allowed",
            boxShadow: canConfirm ? `0 6px 18px ${accent}55` : "none",
          }}
        >
          Calcular {data.rows.length} ativos
        </button>
      </div>
    </PraxiaCard>
  );
}
