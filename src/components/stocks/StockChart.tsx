import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { fetchStockHistory } from "@/lib/api";
import type { HistoricalDataPoint, HistoryRange } from "@/lib/api";

interface StockChartProps {
    ticker: string;
    token?: string;
    onClose: () => void;
}

const PERIODS: { label: string; value: HistoryRange }[] = [
    { label: "1 Dia", value: "1d" },
    { label: "1 Semana", value: "5d" },
    { label: "6 Meses", value: "6mo" },
];

const CHART_WIDTH = 800;
const CHART_HEIGHT = 320;
const PADDING = { top: 20, right: 20, bottom: 30, left: 60 };
const INNER_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

function formatDate(timestamp: number, range: HistoryRange): string {
    const date = new Date(timestamp * 1000);
    if (range === "1d") {
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    if (range === "5d") {
        return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatPrice(value: number): string {
    return `R$ ${value.toFixed(2)}`;
}

export const StockChart: React.FC<StockChartProps> = ({ ticker, token, onClose }) => {
    const [range, setRange] = useState<HistoryRange>("5d");
    const [data, setData] = useState<HistoricalDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; point: HistoricalDataPoint; idx: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setTooltip(null);
        try {
            const history = await fetchStockHistory(ticker, range, token || undefined);
            const filtered = history.filter((p) => p.close > 0);
            setData(filtered);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar histórico.");
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, [ticker, range, token]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Compute all chart metrics
    const metrics = useMemo(() => {
        if (data.length === 0) {
            return {
                prices: [], allHighs: [], allLows: [],
                minPrice: 0, maxPrice: 0, yMin: 0, yMax: 0, yRange: 1,
                firstPrice: 0, lastPrice: 0, priceChange: 0, priceChangePercent: 0,
                isPositive: true, periodHigh: 0, periodLow: 0,
                periodHighIdx: 0, periodLowIdx: 0,
            };
        }

        const prices = data.map((d) => d.close);
        const allHighs = data.map((d) => d.high);
        const allLows = data.map((d) => d.low);

        const minPrice = Math.min(...allLows);
        const maxPrice = Math.max(...allHighs);
        const priceRange = maxPrice - minPrice || 1;
        const pricePadding = priceRange * 0.1;
        const yMin = minPrice - pricePadding;
        const yMax = maxPrice + pricePadding;
        const yRange = yMax - yMin;

        const firstPrice = prices[0];
        const lastPrice = prices[prices.length - 1];
        const priceChange = lastPrice - firstPrice;
        const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
        const isPositive = priceChange >= 0;

        const periodHigh = maxPrice;
        const periodLow = minPrice;
        const periodHighIdx = allHighs.indexOf(periodHigh);
        const periodLowIdx = allLows.indexOf(periodLow);

        return {
            prices, allHighs, allLows,
            minPrice, maxPrice, yMin, yMax, yRange,
            firstPrice, lastPrice, priceChange, priceChangePercent,
            isPositive, periodHigh, periodLow,
            periodHighIdx, periodLowIdx,
        };
    }, [data]);

    const lineColor = metrics.isPositive ? "#34d399" : "#fb7185";
    const highLowStrokeColor = metrics.isPositive ? "rgba(52, 211, 153, 0.2)" : "rgba(251, 113, 133, 0.2)";

    // Map data to SVG coordinates
    const toX = (i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * INNER_WIDTH;
    const toY = (val: number) => PADDING.top + (1 - (val - metrics.yMin) / metrics.yRange) * INNER_HEIGHT;

    const points = data.map((d, i) => ({
        x: toX(i),
        yClose: toY(d.close),
        yHigh: toY(d.high),
        yLow: toY(d.low),
        data: d,
    }));

    // SVG path for close line
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yClose}`).join(" ");

    // SVG path for area under close line
    const areaPath = points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${PADDING.top + INNER_HEIGHT} L ${points[0].x} ${PADDING.top + INNER_HEIGHT} Z`
        : "";

    // SVG path for high/low band (area between high and low)
    const highPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yHigh}`).join(" ");
    const lowPathReversed = [...points].reverse().map((p, i) => `${i === 0 ? "L" : "L"} ${p.x} ${p.yLow}`).join(" ");
    const bandPath = points.length > 0 ? `${highPath} ${lowPathReversed} Z` : "";

    // High/low dashed lines
    const highLinePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yHigh}`).join(" ");
    const lowLinePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yLow}`).join(" ");

    // Y-axis labels (5 ticks)
    const yTicks = Array.from({ length: 5 }, (_, i) => {
        const value = metrics.yMin + (metrics.yRange * i) / 4;
        const y = PADDING.top + (1 - i / 4) * INNER_HEIGHT;
        return { value, y };
    });

    // X-axis labels
    const xTickCount = Math.min(6, data.length);
    const xTicks = Array.from({ length: xTickCount }, (_, i) => {
        const idx = Math.round((i * (data.length - 1)) / Math.max(xTickCount - 1, 1));
        const d = data[idx];
        if (!d) return null;
        const x = toX(idx);
        return { label: formatDate(d.date, range), x };
    }).filter(Boolean) as { label: string; x: number }[];

    // Period high/low marker positions
    const highMarker = points[metrics.periodHighIdx];
    const lowMarker = points[metrics.periodLowIdx];

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (points.length === 0 || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;

        let closestIdx = 0;
        let minDist = Math.abs(mouseX - points[0].x);
        for (let i = 1; i < points.length; i++) {
            const dist = Math.abs(mouseX - points[i].x);
            if (dist < minDist) {
                minDist = dist;
                closestIdx = i;
            }
        }

        const closest = points[closestIdx];
        setTooltip({ x: closest.x, y: closest.yClose, point: closest.data, idx: closestIdx });
    };

    const handleMouseLeave = () => setTooltip(null);

    return (
        <Card className="w-full border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden border-t-4 border-t-primary">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-xl font-black tracking-tight">
                        {metrics.isPositive ? (
                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-rose-400" />
                        )}
                        <span>{ticker}</span>
                        {!isLoading && data.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-white">
                                    {formatPrice(metrics.lastPrice)}
                                </span>
                                <Badge
                                    className={`text-[10px] font-black border ${
                                        metrics.isPositive
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                    }`}
                                >
                                    {metrics.isPositive ? "+" : ""}{metrics.priceChange.toFixed(2)} ({metrics.isPositive ? "+" : ""}{metrics.priceChangePercent.toFixed(2)}%)
                                </Badge>
                            </div>
                        )}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-white"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Period selector + High/Low stats */}
                <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                    <div className="flex gap-1">
                        {PERIODS.map((p) => (
                            <Button
                                key={p.value}
                                variant={range === p.value ? "default" : "outline"}
                                size="sm"
                                className={`h-7 text-xs font-bold ${
                                    range === p.value
                                        ? "bg-primary hover:bg-blue-600 text-white"
                                        : "border-border text-muted-foreground hover:text-white"
                                }`}
                                onClick={() => setRange(p.value)}
                                disabled={isLoading}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>

                    {!isLoading && data.length > 0 && (
                        <div className="flex items-center gap-4 text-xs font-bold">
                            <div className="flex items-center gap-1.5">
                                <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-muted-foreground">Máx:</span>
                                <span className="text-emerald-400 font-black">{formatPrice(metrics.periodHigh)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <ArrowDown className="h-3.5 w-3.5 text-rose-400" />
                                <span className="text-muted-foreground">Mín:</span>
                                <span className="text-rose-400 font-black">{formatPrice(metrics.periodLow)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Amplitude:</span>
                                <span className="text-blue-400 font-black">
                                    {((metrics.periodHigh - metrics.periodLow) / metrics.periodLow * 100).toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-[320px]">
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-medium">Carregando histórico...</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-[320px]">
                        <div className="text-center space-y-2">
                            <p className="text-sm text-rose-400">{error}</p>
                            <Button variant="outline" size="sm" onClick={loadData}>
                                Tentar novamente
                            </Button>
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-[320px]">
                        <p className="text-sm text-muted-foreground">Nenhum dado disponível para este período.</p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                            className="w-full h-auto max-h-[370px]"
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                        >
                            <defs>
                                {/* Close line gradient fill */}
                                <linearGradient id={`chart-gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.20" />
                                    <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
                                </linearGradient>
                                {/* High/Low band gradient */}
                                <linearGradient id={`band-gradient-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.10" />
                                    <stop offset="50%" stopColor={lineColor} stopOpacity="0.03" />
                                    <stop offset="100%" stopColor={lineColor} stopOpacity="0.10" />
                                </linearGradient>
                            </defs>

                            {/* Grid lines */}
                            {yTicks.map((tick, i) => (
                                <line
                                    key={`grid-${i}`}
                                    x1={PADDING.left}
                                    y1={tick.y}
                                    x2={PADDING.left + INNER_WIDTH}
                                    y2={tick.y}
                                    stroke="rgba(255,255,255,0.06)"
                                    strokeDasharray="4 4"
                                />
                            ))}

                            {/* Y-axis labels */}
                            {yTicks.map((tick, i) => (
                                <text
                                    key={`y-label-${i}`}
                                    x={PADDING.left - 8}
                                    y={tick.y + 4}
                                    textAnchor="end"
                                    className="fill-muted-foreground"
                                    fontSize="10"
                                    fontWeight="600"
                                    fontFamily="monospace"
                                >
                                    {tick.value.toFixed(2)}
                                </text>
                            ))}

                            {/* X-axis labels */}
                            {xTicks.map((tick, i) => (
                                <text
                                    key={`x-label-${i}`}
                                    x={tick.x}
                                    y={CHART_HEIGHT - 6}
                                    textAnchor="middle"
                                    className="fill-muted-foreground"
                                    fontSize="10"
                                    fontWeight="600"
                                >
                                    {tick.label}
                                </text>
                            ))}

                            {/* High/Low band fill */}
                            <path
                                d={bandPath}
                                fill={`url(#band-gradient-${ticker})`}
                            />

                            {/* High line (dashed) */}
                            <path
                                d={highLinePath}
                                fill="none"
                                stroke={highLowStrokeColor}
                                strokeWidth="1"
                                strokeDasharray="3 4"
                            />

                            {/* Low line (dashed) */}
                            <path
                                d={lowLinePath}
                                fill="none"
                                stroke={highLowStrokeColor}
                                strokeWidth="1"
                                strokeDasharray="3 4"
                            />

                            {/* Area fill under close line */}
                            <path
                                d={areaPath}
                                fill={`url(#chart-gradient-${ticker})`}
                            />

                            {/* Close line */}
                            <path
                                d={linePath}
                                fill="none"
                                stroke={lineColor}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Glow on close line */}
                            <path
                                d={linePath}
                                fill="none"
                                stroke={lineColor}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.12"
                            />

                            {/* Period HIGH marker */}
                            {highMarker && (
                                <>
                                    <circle
                                        cx={highMarker.x}
                                        cy={highMarker.yHigh}
                                        r="6"
                                        fill="#34d399"
                                        opacity="0.15"
                                    />
                                    <circle
                                        cx={highMarker.x}
                                        cy={highMarker.yHigh}
                                        r="3"
                                        fill="#34d399"
                                        stroke="#020617"
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={highMarker.x}
                                        y={highMarker.yHigh - 10}
                                        textAnchor="middle"
                                        fill="#34d399"
                                        fontSize="9"
                                        fontWeight="800"
                                        fontFamily="monospace"
                                    >
                                        {metrics.periodHigh.toFixed(2)}
                                    </text>
                                </>
                            )}

                            {/* Period LOW marker */}
                            {lowMarker && (
                                <>
                                    <circle
                                        cx={lowMarker.x}
                                        cy={lowMarker.yLow}
                                        r="6"
                                        fill="#fb7185"
                                        opacity="0.15"
                                    />
                                    <circle
                                        cx={lowMarker.x}
                                        cy={lowMarker.yLow}
                                        r="3"
                                        fill="#fb7185"
                                        stroke="#020617"
                                        strokeWidth="1.5"
                                    />
                                    <text
                                        x={lowMarker.x}
                                        y={lowMarker.yLow + 16}
                                        textAnchor="middle"
                                        fill="#fb7185"
                                        fontSize="9"
                                        fontWeight="800"
                                        fontFamily="monospace"
                                    >
                                        {metrics.periodLow.toFixed(2)}
                                    </text>
                                </>
                            )}

                            {/* Tooltip crosshair and dot */}
                            {tooltip && (
                                <>
                                    {/* Vertical crosshair */}
                                    <line
                                        x1={tooltip.x}
                                        y1={PADDING.top}
                                        x2={tooltip.x}
                                        y2={PADDING.top + INNER_HEIGHT}
                                        stroke="rgba(255,255,255,0.2)"
                                        strokeDasharray="3 3"
                                    />
                                    {/* Horizontal crosshair */}
                                    <line
                                        x1={PADDING.left}
                                        y1={tooltip.y}
                                        x2={PADDING.left + INNER_WIDTH}
                                        y2={tooltip.y}
                                        stroke="rgba(255,255,255,0.1)"
                                        strokeDasharray="3 3"
                                    />

                                    {/* High/Low range bar for this point */}
                                    <line
                                        x1={tooltip.x}
                                        y1={points[tooltip.idx].yHigh}
                                        x2={tooltip.x}
                                        y2={points[tooltip.idx].yLow}
                                        stroke={lineColor}
                                        strokeWidth="2"
                                        opacity="0.4"
                                        strokeLinecap="round"
                                    />
                                    {/* High tick */}
                                    <line
                                        x1={tooltip.x - 4}
                                        y1={points[tooltip.idx].yHigh}
                                        x2={tooltip.x + 4}
                                        y2={points[tooltip.idx].yHigh}
                                        stroke="#34d399"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    {/* Low tick */}
                                    <line
                                        x1={tooltip.x - 4}
                                        y1={points[tooltip.idx].yLow}
                                        x2={tooltip.x + 4}
                                        y2={points[tooltip.idx].yLow}
                                        stroke="#fb7185"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />

                                    {/* Close dot glow */}
                                    <circle
                                        cx={tooltip.x}
                                        cy={tooltip.y}
                                        r="8"
                                        fill={lineColor}
                                        opacity="0.2"
                                    />
                                    {/* Close dot */}
                                    <circle
                                        cx={tooltip.x}
                                        cy={tooltip.y}
                                        r="4"
                                        fill={lineColor}
                                        stroke="#020617"
                                        strokeWidth="2"
                                    />

                                    {/* Tooltip box (OHLC) */}
                                    <foreignObject
                                        x={tooltip.x > CHART_WIDTH / 2 ? tooltip.x - 172 : tooltip.x + 12}
                                        y={Math.max(Math.min(tooltip.y - 55, CHART_HEIGHT - 120), 0)}
                                        width="160"
                                        height="110"
                                    >
                                        <div className="bg-slate-900/95 border border-border/50 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm">
                                            <p className="text-[10px] text-muted-foreground font-bold mb-1.5">
                                                {formatDate(tooltip.point.date, range)}
                                            </p>
                                            <div className="space-y-0.5">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-muted-foreground font-bold">Abertura</span>
                                                    <span className="text-white font-black">{formatPrice(tooltip.point.open)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-emerald-400 font-bold">Máxima</span>
                                                    <span className="text-emerald-400 font-black">{formatPrice(tooltip.point.high)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-rose-400 font-bold">Mínima</span>
                                                    <span className="text-rose-400 font-black">{formatPrice(tooltip.point.low)}</span>
                                                </div>
                                                <div className="flex justify-between text-[10px] border-t border-border/30 pt-0.5 mt-0.5">
                                                    <span className="text-muted-foreground font-bold">Fechamento</span>
                                                    <span className="text-white font-black">{formatPrice(tooltip.point.close)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </foreignObject>
                                </>
                            )}
                        </svg>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
