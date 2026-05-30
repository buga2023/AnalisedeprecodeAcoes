import { useEffect, useState } from "react";
import { PraxiaTokens } from "./tokens";
import { PraxiaCard } from "./PraxiaCard";
import { ScoreDimBar } from "./ScoreDimBar";
import { calculateFIIScore } from "@/lib/fiiScore";
import { fetchFIIData } from "@/lib/fiiData";
import { fetchDividendHistory, dividendYieldFromHistory } from "@/lib/dividends";
import type { Stock } from "@/types/stock";

export function FIIDetailStats({ fii, accent }: { fii: Stock; accent: string }) {
  const T = PraxiaTokens;
  const [vacancyRate, setVacancyRate] = useState<number | undefined>(fii.vacancyRate);
  // DY do quote (fração → %); fallbacks de histórico/scrape sobrescrevem se vierem > 0.
  const [dyPct, setDyPct] = useState<number>(fii.dividendYield > 0 ? fii.dividendYield * 100 : 0);

  useEffect(() => {
    let active = true;
    // (a) histórico de dividendos — fonte preferida pra FII
    fetchDividendHistory(fii.ticker).then((hist) => {
      if (!active) return;
      const fromHist = dividendYieldFromHistory(hist, fii.price);
      if (fromHist > 0) setDyPct(fromHist);
    });
    // (c) scraping — vacância (e DY de reforço quando o resto falhar)
    fetchFIIData(fii.ticker).then((d) => {
      if (!active) return;
      if (typeof d.vacancyRate === "number") setVacancyRate(d.vacancyRate);
      if (typeof d.dividendYield === "number") {
        const scraped = d.dividendYield;
        setDyPct((prev) => (prev > 0 ? prev : scraped));
      }
    });
    return () => { active = false; };
  }, [fii.ticker, fii.price]);

  const { total, breakdown } = calculateFIIScore({ dividendYield: dyPct, pvp: fii.pvp, vacancyRate, segment: fii.sector });

  return (
    <PraxiaCard padding={16} style={{ marginTop: 16, border: `0.5px solid ${T.hairlineStrong}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: T.displaySC, fontSize: 11, color: T.ink50, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Fundo Imobiliário — Indicadores
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink30, letterSpacing: 0.6 }}>FII</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <FIIStat label="Dividend Yield" value={dyPct > 0 ? `${dyPct.toFixed(1)}%` : "—"} color={dyPct >= 6 ? T.up : T.ink} />
        <FIIStat label="P/VP" value={fii.pvp > 0 ? fii.pvp.toFixed(2) : "—"} color={fii.pvp > 0 && fii.pvp <= 1.05 ? T.up : T.warn} />
        <FIIStat label="Segmento" value={fii.sector && fii.sector !== "—" ? fii.sector : "—"} />
        <FIIStat label="Vacância" value={typeof vacancyRate === "number" ? `${vacancyRate.toFixed(1)}%` : "—"} color={typeof vacancyRate === "number" ? (vacancyRate < 10 ? T.up : T.down) : T.ink50} />
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `0.5px dashed ${T.hairline}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: T.displaySC, fontSize: 11, color: T.ink50, letterSpacing: 1.2 }}>Score FII</div>
          <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 15, color: total >= 70 ? T.up : total >= 40 ? T.warn : T.down, letterSpacing: -0.3 }}>
            {total}<span style={{ fontSize: 10, color: T.ink50, fontWeight: 400, marginLeft: 1 }}>/100</span>
          </div>
        </div>
        <ScoreDimBar label="Dividend Yield" pts={breakdown.dividendScore} max={40} detail={`DY ${dyPct > 0 ? dyPct.toFixed(1) + "%" : "N/D"} — máx. em >8%`} accent={accent} />
        <ScoreDimBar label="P/VP (desconto ao patrimônio)" pts={breakdown.valuationScore} max={30} detail={`P/VP ${fii.pvp > 0 ? fii.pvp.toFixed(2) : "N/D"} — máx. em ≤0,95`} accent={accent} />
        {typeof vacancyRate === "number" && (
          <ScoreDimBar label="Vacância" pts={breakdown.healthScore} max={15} detail={`${vacancyRate.toFixed(1)}% — máx. em <5%`} accent={accent} />
        )}
        <ScoreDimBar label="Segmento" pts={breakdown.profitabilityScore} max={15} detail={fii.sector && fii.sector !== "—" ? fii.sector : "segmento não mapeado"} accent={accent} />
        {typeof vacancyRate !== "number" && (
          <div style={{ marginTop: 4, fontFamily: T.mono, fontSize: 9, color: T.ink30 }}>
            Vacância indisponível — score normalizado sobre os indicadores com dado.
          </div>
        )}
      </div>
    </PraxiaCard>
  );
}

function FIIStat({ label, value, color }: { label: string; value: string; color?: string }) {
  const T = PraxiaTokens;
  return (
    <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.hairline}` }}>
      <div style={{ fontFamily: T.body, fontSize: 10, color: T.ink50, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: color ?? T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
