"use client";
import { useState, useCallback } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceArea, ReferenceLine, Customized,
} from "recharts";
import { SEASON_COLORS } from "@/data/games";
import { ChartTeam } from "@/lib/stats";

interface DataPoint {
  rodada: number;
  "2025": number | null;
  "2026": number | null;
  avg2025: number;
  avg2026: number;
  missing2025: boolean;
  missing2026: boolean;
  teams25: ChartTeam[];
  teams26: ChartTeam[];
}

export interface HoverData {
  rodada: number;
  v25: number | null;
  v26: number | null;
  isOutlier25: boolean;
  isOutlier26: boolean;
  teams25: ChartTeam[];
  teams26: ChartTeam[];
}

interface Props {
  data: DataPoint[];
  isPnt?: boolean;
  onHoverChange?: (d: HoverData | null) => void;
  onDotClick?: (d: HoverData) => void;
  lockedRodada?: number | null;
}

const BG = "#08090f";
const OFFSET = 0.38;
const OUTLIER_THRESHOLD = 0.65;

interface BridgeSeg { x1: number; y1: number; x2: number; y2: number; color: string }

function buildBridgeSegs(pts: { rod: number; val: number | null }[], color: string): BridgeSeg[] {
  const out: BridgeSeg[] = [];
  let lastNonNull: { rod: number; val: number } | null = null;
  let inGap = false;
  for (const p of pts) {
    if (p.val !== null) {
      if (inGap && lastNonNull !== null) {
        out.push({ x1: lastNonNull.rod, y1: lastNonNull.val, x2: p.rod, y2: p.val, color });
      }
      lastNonNull = { rod: p.rod, val: p.val };
      inGap = false;
    } else {
      if (lastNonNull !== null) inGap = true;
    }
  }
  return out;
}

function fmtVal(v: number, isPnt?: boolean) {
  if (isPnt) return v.toFixed(1).replace(".", ",") + " pts";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(".", ",") + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return String(v);
}

function fmtY(v: number, isPnt?: boolean) {
  if (isPnt) return v.toFixed(1).replace(".", ",");
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return String(v);
}

function isOutlier(val: number | null, avg: number): boolean {
  if (val === null || avg === 0) return false;
  return Math.abs((val - avg) / avg) > OUTLIER_THRESHOLD;
}

function HollowDot({ cx, cy, stroke, value, onMouseEnter, onMouseLeave, onClick, locked }: any) {
  if (cx == null || cy == null || value == null) return null;
  return (
    <circle cx={cx} cy={cy} r={locked ? 5 : 4}
      fill={locked ? `${stroke}33` : BG}
      stroke={stroke} strokeWidth={locked ? 2.5 : 2}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}
      style={{ cursor: "pointer" }} />
  );
}

function ActiveHollowDot({ cx, cy, stroke, value }: any) {
  if (cx == null || cy == null || value == null) return null;
  return <circle cx={cx} cy={cy} r={5.5} fill={BG} stroke={stroke} strokeWidth={2.5} />;
}

function OutlierDot({ cx, cy, stroke, value, onMouseEnter, onMouseLeave, onClick, locked }: any) {
  if (cx == null || cy == null || value == null) return null;
  return (
    <g onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick} style={{ cursor: "pointer" }}>
      <circle cx={cx} cy={cy} r={9} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray="3 2" opacity={locked ? 1 : 0.75} />
      <circle cx={cx} cy={cy} r={4} fill={locked ? `${stroke}44` : BG} stroke={stroke} strokeWidth={locked ? 2.5 : 2} />
    </g>
  );
}

function OutlierActiveDot({ cx, cy, stroke, value }: any) {
  if (cx == null || cy == null || value == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.9} />
      <circle cx={cx} cy={cy} r={5.5} fill={BG} stroke={stroke} strokeWidth={2.5} />
    </g>
  );
}

function CustomTick({ x, y, payload, allRods, missingSet, offset }: any) {
  const rawIdx = payload?.value ?? 0;
  const idx = Math.round(rawIdx - offset / 2);
  const rodada = allRods[idx] as number | undefined;
  const isMissing = rodada != null && (missingSet as Set<number>).has(rodada);
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text x={0} y={0} dy={14}
        fill={isMissing ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.85)"}
        fontSize={11} textAnchor="middle">
        {rodada ?? ""}
      </text>
    </g>
  );
}

export default function AudienciaBarChart({ data, isPnt, onHoverChange, onDotClick, lockedRodada }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [hoverDot, setHoverDot] = useState<{ val: number; color: string } | null>(null);

  if (!data.length) return (
    <div className="h-64 flex items-center justify-center text-white/20 text-sm">
      Sem dados disponíveis
    </div>
  );

  const toggle = (key: string) =>
    setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const show25 = !hidden.has("2025");
  const show26 = !hidden.has("2026");
  const avg25 = data[0]?.avg2025 ?? 0;
  const avg26 = data[0]?.avg2026 ?? 0;

  const allRods = data.map((d) => d.rodada);
  const rodToIdx = new Map(allRods.map((r, i) => [r, i]));
  const maxIdx = allRods.length - 1;

  const missingSet = new Set<number>(
    data.filter((d) => d["2025"] === null && d["2026"] === null).map((d) => d.rodada)
  );

  const data25 = data.map((d) => ({ rod: rodToIdx.get(d.rodada)!, val: d["2025"] }));
  const data26 = data.map((d) => ({ rod: rodToIdx.get(d.rodada)! + OFFSET, val: d["2026"] }));

  // Bridge segments: only the endpoints around gap regions — drawn as SVG lines to avoid overlap with main line
  const segs25 = show25 ? buildBridgeSegs(data25, SEASON_COLORS[2025]) : [];
  const segs26 = show26 ? buildBridgeSegs(data26, SEASON_COLORS[2026]) : [];

  const midTicks = allRods.map((_, i) => i + OFFSET / 2);

  const handleMouseMove = useCallback((chartState: any) => {
    if (!chartState?.activeLabel) return;
    const idx = Math.round((chartState.activeLabel as number) - OFFSET / 2);
    if (idx < 0 || idx >= allRods.length) return;
    const rodada = allRods[idx];
    setActiveIdx(idx);
    const point = data.find((d) => d.rodada === rodada);
    const v25 = point?.["2025"] ?? null;
    const v26 = point?.["2026"] ?? null;
    onHoverChange?.({
      rodada, v25, v26,
      isOutlier25: isOutlier(v25, avg25),
      isOutlier26: isOutlier(v26, avg26),
      teams25: point?.teams25 ?? [],
      teams26: point?.teams26 ?? [],
    });
  }, [data, allRods, onHoverChange, avg25, avg26]);

  const handleMouseLeave = useCallback(() => {
    setActiveIdx(null);
    setHoverDot(null);
    onHoverChange?.(null);
  }, [onHoverChange]);

  const makeDotHandler = (val: number, color: string, rodadaIdx: number) => {
    const rodada = allRods[rodadaIdx];
    const point = data.find((d) => d.rodada === rodada);
    return {
      onMouseEnter: () => setHoverDot({ val, color }),
      onMouseLeave: () => setHoverDot(null),
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onDotClick?.({
          rodada,
          v25: point?.["2025"] ?? null,
          v26: point?.["2026"] ?? null,
          isOutlier25: isOutlier(point?.["2025"] ?? null, avg25),
          isOutlier26: isOutlier(point?.["2026"] ?? null, avg26),
          teams25: point?.teams25 ?? [],
          teams26: point?.teams26 ?? [],
        });
      },
    };
  };

  return (
    <div>
      <div className="flex gap-4 mb-4 justify-end">
        {[2025, 2026].map((yr) => {
          const off = hidden.has(yr.toString());
          const aval = yr === 2025 ? avg25 : avg26;
          return (
            <button key={yr} onClick={() => toggle(yr.toString())}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                off ? "border-white/10 text-white/25" : "border-white/10 text-white/70 bg-white/5"
              }`}>
              <svg width="20" height="12" className="flex-shrink-0">
                <line x1="0" y1="6" x2="20" y2="6" stroke={off ? "#444" : SEASON_COLORS[yr]} strokeWidth="2" />
                <circle cx="10" cy="6" r="3.5" fill={off ? "#222" : BG} stroke={off ? "#444" : SEASON_COLORS[yr]} strokeWidth="2" />
              </svg>
              {yr}
              {!off && aval > 0 && (
                <span className="text-white/30 ml-1">· méd {fmtVal(aval, isPnt)}</span>
              )}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          margin={{ top: 28, right: 16, left: 0, bottom: 4 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />

          {/* Active column highlight */}
          {activeIdx !== null && (
            <ReferenceArea
              x1={activeIdx + OFFSET / 2 - 0.5}
              x2={activeIdx + OFFSET / 2 + 0.5}
              fill="rgba(255,255,255,0.05)"
              stroke="none"
            />
          )}

          {/* Average reference lines */}
          {show25 && avg25 > 0 && (
            <ReferenceLine y={avg25} stroke={SEASON_COLORS[2025]}
              strokeDasharray="5 4" strokeWidth={1.5} strokeOpacity={0.45}
              label={{ value: "méd 25", position: "insideTopRight", fill: SEASON_COLORS[2025], fontSize: 10, opacity: 0.6 }} />
          )}
          {show26 && avg26 > 0 && (
            <ReferenceLine y={avg26} stroke={SEASON_COLORS[2026]}
              strokeDasharray="5 4" strokeWidth={1.5} strokeOpacity={0.45}
              label={{ value: "méd 26", position: "insideTopRight", fill: SEASON_COLORS[2026], fontSize: 10, opacity: 0.6, dy: 14 }} />
          )}

          {/* Horizontal dot-hover line */}
          {hoverDot && (
            <ReferenceLine
              y={hoverDot.val}
              stroke={hoverDot.color}
              strokeDasharray="3 4"
              strokeWidth={1}
              strokeOpacity={0.55}
            />
          )}

          <XAxis
            dataKey="rod"
            type="number"
            domain={[-0.6, maxIdx + OFFSET + 0.6]}
            ticks={midTicks}
            interval={0}
            tick={(props: any) => (
              <CustomTick {...props} allRods={allRods} missingSet={missingSet} offset={OFFSET} />
            )}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmtY(v, isPnt)}
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={isPnt ? 34 : 48}
            domain={[(d: number) => Math.max(0, d * 0.92), (d: number) => d * 1.14]}
          />

          {/* Bridge lines overlay — straight SVG lines drawn only in gap segments (avoids double-line on data segments) */}
          <Customized
            component={(props: any) => {
              const xAxis = Object.values(props.xAxisMap ?? {})[0] as any;
              const yAxis = Object.values(props.yAxisMap ?? {})[0] as any;
              if (!xAxis?.scale || !yAxis?.scale) return null;
              const xs = xAxis.scale;
              const ys = yAxis.scale;
              const allSegs = [...segs25, ...segs26];
              if (!allSegs.length) return null;
              return (
                <g>
                  {allSegs.map((seg, i) => (
                    <line
                      key={i}
                      x1={xs(seg.x1)} y1={ys(seg.y1)}
                      x2={xs(seg.x2)} y2={ys(seg.y2)}
                      stroke={seg.color}
                      strokeWidth={1.5}
                      strokeOpacity={0.30}
                      strokeDasharray="3 4"
                    />
                  ))}
                </g>
              );
            }}
          />

          {/* 2025 main line */}
          {show25 && (
            <Line
              data={data25}
              dataKey="val"
              name="2025"
              stroke={SEASON_COLORS[2025]}
              strokeWidth={2}
              type="monotone"
              dot={(props: any) => {
                if (props.value == null) return null as any;
                const handlers = makeDotHandler(props.value, SEASON_COLORS[2025], props.index);
                const isLocked = lockedRodada === allRods[props.index];
                if (isOutlier(props.value, avg25)) {
                  return <OutlierDot {...props} stroke={SEASON_COLORS[2025]} {...handlers} locked={isLocked} />;
                }
                return <HollowDot {...props} stroke={SEASON_COLORS[2025]} {...handlers} locked={isLocked} />;
              }}
              activeDot={(props: any) => {
                if (isOutlier(props.value, avg25)) return <OutlierActiveDot {...props} stroke={SEASON_COLORS[2025]} />;
                return <ActiveHollowDot {...props} stroke={SEASON_COLORS[2025]} />;
              }}
              isAnimationActive={false}
            />
          )}

          {/* 2026 main line */}
          {show26 && (
            <Line
              data={data26}
              dataKey="val"
              name="2026"
              stroke={SEASON_COLORS[2026]}
              strokeWidth={2}
              type="monotone"
              dot={(props: any) => {
                if (props.value == null) return null as any;
                const handlers = makeDotHandler(props.value, SEASON_COLORS[2026], props.index);
                const isLocked = lockedRodada === allRods[props.index];
                if (isOutlier(props.value, avg26)) {
                  return <OutlierDot {...props} stroke={SEASON_COLORS[2026]} {...handlers} locked={isLocked} />;
                }
                return <HollowDot {...props} stroke={SEASON_COLORS[2026]} {...handlers} locked={isLocked} />;
              }}
              activeDot={(props: any) => {
                if (isOutlier(props.value, avg26)) return <OutlierActiveDot {...props} stroke={SEASON_COLORS[2026]} />;
                return <ActiveHollowDot {...props} stroke={SEASON_COLORS[2026]} />;
              }}
              isAnimationActive={false}
            />
          )}

          {/* Dim overlay — rendered after lines so it covers the non-active chart area */}
          <Customized
            component={(props: any) => {
              if (activeIdx === null) return null;
              const xAxis = Object.values(props.xAxisMap ?? {})[0] as any;
              const yAxis = Object.values(props.yAxisMap ?? {})[0] as any;
              if (!xAxis?.scale || !yAxis?.scale) return null;
              const xs = xAxis.scale;
              const ys = yAxis.scale;
              const domain = xAxis.domain ?? [-0.6, maxIdx + OFFSET + 0.6];
              const plotLeft = xs(domain[0]);
              const plotRight = xs(domain[1]);
              const yDomain = yAxis.domain ?? [0, 1];
              const plotTop = Math.min(ys(yDomain[0]), ys(yDomain[1]));
              const plotBottom = Math.max(ys(yDomain[0]), ys(yDomain[1]));
              const colLeft = xs(activeIdx + OFFSET / 2 - 0.5);
              const colRight = xs(activeIdx + OFFSET / 2 + 0.5);
              const h = plotBottom - plotTop;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect x={plotLeft} y={plotTop} width={Math.max(0, colLeft - plotLeft)} height={h} fill="rgba(0,0,0,0.16)" />
                  <rect x={colRight} y={plotTop} width={Math.max(0, plotRight - colRight)} height={h} fill="rgba(0,0,0,0.16)" />
                </g>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
