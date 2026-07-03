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

export interface LockedDot {
  rodada: number;
  season: 2025 | 2026;
  val: number;
  teams: ChartTeam[];
  isOutlier: boolean;
}

interface Props {
  data: DataPoint[];
  isPnt?: boolean;
  onHoverChange?: (d: HoverData | null) => void;
  onDotClick?: (d: LockedDot) => void;
  lockedDot?: LockedDot | null;
}

const BG = "#08090f";
const OFFSET = 0.38;
const OUTLIER_THRESHOLD = 0.65;

interface BridgeSeg {
  x0: number; y0: number;
  x1: number; y1: number;
  prevX: number | null; prevY: number | null;
  nextX: number | null; nextY: number | null;
  color: string;
}

function buildBridgeSegs(pts: { rod: number; val: number | null }[], color: string): BridgeSeg[] {
  const out: BridgeSeg[] = [];
  let prevNonNull: { rod: number; val: number } | null = null;
  let lastNonNull: { rod: number; val: number } | null = null;
  let gapState: { prevPrev: { rod: number; val: number } | null; bridgeStart: { rod: number; val: number } } | null = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.val !== null) {
      if (gapState !== null) {
        const nextNonNull = pts.slice(i + 1).find((q) => q.val !== null);
        out.push({
          x0: gapState.bridgeStart.rod, y0: gapState.bridgeStart.val,
          x1: p.rod, y1: p.val,
          prevX: gapState.prevPrev?.rod ?? null,
          prevY: gapState.prevPrev?.val ?? null,
          nextX: nextNonNull?.rod ?? null,
          nextY: nextNonNull?.val ?? null,
          color,
        });
      }
      prevNonNull = lastNonNull;
      lastNonNull = { rod: p.rod, val: p.val };
      gapState = null;
    } else if (lastNonNull !== null && gapState === null) {
      gapState = { prevPrev: prevNonNull, bridgeStart: lastNonNull };
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

// bright-data helper: returns data array with only 3 points around idx non-null
function mkBrightData(fullData: { rod: number; val: number | null }[], idx: number) {
  return fullData.map((p, i) => ({ rod: p.rod, val: Math.abs(i - idx) <= 1 ? p.val : null }));
}

export default function AudienciaBarChart({ data, isPnt, onHoverChange, onDotClick, lockedDot }: Props) {
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

  const segs25 = show25 ? buildBridgeSegs(data25, SEASON_COLORS[2025]) : [];
  const segs26 = show26 ? buildBridgeSegs(data26, SEASON_COLORS[2026]) : [];

  const midTicks = allRods.map((_, i) => i + OFFSET / 2);

  const lockedRodadaIdx = lockedDot ? (rodToIdx.get(lockedDot.rodada) ?? null) : null;

  // Dim when hovering OR when a dot is locked
  const isDimming = activeIdx !== null || lockedRodadaIdx !== null;

  const colBounds = (idx: number) => ({
    x1: idx + OFFSET / 2 - 0.5,
    x2: idx + OFFSET / 2 + 0.5,
  });

  // Bright segment data for overlay lines at active and locked columns
  const bright25Active = show25 && activeIdx !== null ? mkBrightData(data25, activeIdx) : null;
  const bright26Active = show26 && activeIdx !== null ? mkBrightData(data26, activeIdx) : null;
  const bright25Locked = show25 && lockedRodadaIdx !== null && lockedRodadaIdx !== activeIdx
    ? mkBrightData(data25, lockedRodadaIdx) : null;
  const bright26Locked = show26 && lockedRodadaIdx !== null && lockedRodadaIdx !== activeIdx
    ? mkBrightData(data26, lockedRodadaIdx) : null;

  const handleMouseMove = useCallback((chartState: any) => {
    if (!chartState?.activeLabel) return;
    const idx = Math.round((chartState.activeLabel as number) - OFFSET / 2);
    if (idx < 0 || idx >= allRods.length) return;
    // Clear hoverDot when switching columns
    if (idx !== activeIdx) setHoverDot(null);
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
  }, [data, allRods, activeIdx, onHoverChange, avg25, avg26]);

  const handleMouseLeave = useCallback(() => {
    setActiveIdx(null);
    setHoverDot(null);
    onHoverChange?.(null);
  }, [onHoverChange]);

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
            <ReferenceArea {...colBounds(activeIdx)} fill="rgba(255,255,255,0.05)" stroke="none" />
          )}
          {/* Locked column highlight (when different from active) */}
          {lockedRodadaIdx !== null && lockedRodadaIdx !== activeIdx && (
            <ReferenceArea {...colBounds(lockedRodadaIdx)} fill="rgba(255,255,255,0.05)" stroke="none" />
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

          {/* Horizontal dot hover reference line — stays while in column */}
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

          {/* Smooth bezier bridges (below main lines) */}
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
                  {allSegs.map((seg, i) => {
                    const px0 = xs(seg.x0), py0 = ys(seg.y0);
                    const px1 = xs(seg.x1), py1 = ys(seg.y1);
                    const ppx = seg.prevX !== null ? xs(seg.prevX) : px0;
                    const ppy = seg.prevY !== null ? ys(seg.prevY) : py0;
                    const pnx = seg.nextX !== null ? xs(seg.nextX) : px1;
                    const pny = seg.nextY !== null ? ys(seg.nextY) : py1;
                    const t0x = (px1 - ppx) / 2, t0y = (py1 - ppy) / 2;
                    const t1x = (pnx - px0) / 2, t1y = (pny - py0) / 2;
                    const cp1x = px0 + t0x / 3, cp1y = py0 + t0y / 3;
                    const cp2x = px1 - t1x / 3, cp2y = py1 - t1y / 3;
                    return (
                      <path key={i}
                        d={`M${px0},${py0} C${cp1x},${cp1y} ${cp2x},${cp2y} ${px1},${py1}`}
                        fill="none" stroke={seg.color}
                        strokeWidth={1.5} strokeOpacity={0.30} strokeDasharray="3 4"
                      />
                    );
                  })}
                </g>
              );
            }}
          />

          {/* Main lines — dim when isDimming */}
          {show25 && (
            <Line data={data25} dataKey="val" name="2025"
              stroke={SEASON_COLORS[2025]} strokeWidth={2}
              strokeOpacity={isDimming ? 0.5 : 1}
              type="monotone" dot={false} activeDot={false} isAnimationActive={false} />
          )}
          {show26 && (
            <Line data={data26} dataKey="val" name="2026"
              stroke={SEASON_COLORS[2026]} strokeWidth={2}
              strokeOpacity={isDimming ? 0.5 : 1}
              type="monotone" dot={false} activeDot={false} isAnimationActive={false} />
          )}

          {/* Bright segment overlays for active column */}
          {bright25Active && (
            <Line data={bright25Active} dataKey="val" name="2025-bright-active"
              stroke={SEASON_COLORS[2025]} strokeWidth={2.5} strokeOpacity={1}
              type="monotone" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
          )}
          {bright26Active && (
            <Line data={bright26Active} dataKey="val" name="2026-bright-active"
              stroke={SEASON_COLORS[2026]} strokeWidth={2.5} strokeOpacity={1}
              type="monotone" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
          )}

          {/* Bright segment overlays for locked column (when different from active) */}
          {bright25Locked && (
            <Line data={bright25Locked} dataKey="val" name="2025-bright-locked"
              stroke={SEASON_COLORS[2025]} strokeWidth={2.5} strokeOpacity={1}
              type="monotone" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
          )}
          {bright26Locked && (
            <Line data={bright26Locked} dataKey="val" name="2026-bright-locked"
              stroke={SEASON_COLORS[2026]} strokeWidth={2.5} strokeOpacity={1}
              type="monotone" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
          )}

          {/* Dot layer — re-renders on state change, handles dim/lock/hover/click */}
          <Customized
            component={(props: any) => {
              const xAxis = Object.values(props.xAxisMap ?? {})[0] as any;
              const yAxis = Object.values(props.yAxisMap ?? {})[0] as any;
              if (!xAxis?.scale || !yAxis?.scale) return null;
              const xs = xAxis.scale;
              const ys = yAxis.scale;

              const renderDot = (pt: { rod: number; val: number | null }, idx: number, season: 2025 | 2026) => {
                if (pt.val === null) return null;
                const cx = xs(pt.rod);
                const cy = ys(pt.val);
                const rodada = allRods[idx];
                const avg = season === 2025 ? avg25 : avg26;
                const color = SEASON_COLORS[season];
                const isOut = isOutlier(pt.val, avg);
                const isActive = activeIdx !== null && allRods[activeIdx] === rodada;
                const isLockedSeason = lockedDot?.rodada === rodada && lockedDot?.season === season;
                const isLockedRod = lockedDot?.rodada === rodada;
                // Dim if isDimming and not active column and not locked column
                const dimmed = isDimming && !isActive && !isLockedRod;
                const point = data.find((d) => d.rodada === rodada);
                const teams = season === 2025 ? (point?.teams25 ?? []) : (point?.teams26 ?? []);

                const r = isActive ? 5.5 : isLockedSeason ? 5 : 4;
                const fill = isLockedSeason ? color : BG;
                const sw = isActive || isLockedSeason ? 2.5 : 2;

                return (
                  <g
                    key={`${season}-${idx}`}
                    opacity={dimmed ? 0.6 : 1}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoverDot({ val: pt.val!, color })}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDotClick?.({ rodada, season, val: pt.val!, teams, isOutlier: isOut });
                    }}
                  >
                    {isOut && (
                      <circle cx={cx} cy={cy} r={isActive ? 10 : 9}
                        fill="none" stroke={color} strokeWidth={1.5}
                        strokeDasharray="3 2" opacity={isLockedSeason ? 1 : 0.75} />
                    )}
                    <circle cx={cx} cy={cy} r={r} fill={fill} stroke={color} strokeWidth={sw} />
                  </g>
                );
              };

              return (
                <g>
                  {show25 && data25.map((p, i) => renderDot(p, i, 2025))}
                  {show26 && data26.map((p, i) => renderDot(p, i, 2026))}
                </g>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
