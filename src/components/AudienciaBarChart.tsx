"use client";
import { useState, useCallback } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from "recharts";
import { SEASON_COLORS } from "@/data/games";

interface DataPoint {
  rodada: number;
  "2025": number | null;
  "2026": number | null;
  avg2025: number;
  avg2026: number;
  missing2025: boolean;
  missing2026: boolean;
}

export interface HoverData {
  rodada: number;
  v25: number | null;
  v26: number | null;
}

interface Props {
  data: DataPoint[];
  isPnt?: boolean;
  onHoverChange?: (d: HoverData | null) => void;
}

const BG = "#08090f";
const OFFSET = 0.38;

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

function HollowDot({ cx, cy, stroke, value }: any) {
  if (cx == null || cy == null || value == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill={BG} stroke={stroke} strokeWidth={2} />;
}

function ActiveHollowDot({ cx, cy, stroke, value }: any) {
  if (cx == null || cy == null || value == null) return null;
  return <circle cx={cx} cy={cy} r={5.5} fill={BG} stroke={stroke} strokeWidth={2.5} />;
}

function CustomTick({ x, y, payload, missingSet }: any) {
  const rodada = Math.round(payload?.value ?? 0);
  const isMissing = (missingSet as Set<number>).has(rodada);
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text x={0} y={0} dy={14} fill={isMissing ? "#FCD34D" : "rgba(255,255,255,0.25)"}
        fontSize={11} textAnchor="middle">
        {rodada}
      </text>
    </g>
  );
}

export default function AudienciaBarChart({ data, isPnt, onHoverChange }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [activeRodada, setActiveRodada] = useState<number | null>(null);

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
  const maxRod = allRods.length ? Math.max(...allRods) : 0;
  const minRod = allRods.length ? Math.min(...allRods) : 1;

  // Rounds where neither season has data — shown in amber on x-axis
  const missingSet = new Set<number>(
    data.filter((d) => d["2025"] === null && d["2026"] === null).map((d) => d.rodada)
  );

  // Separate data arrays — 2026 shifted right so entire line is offset
  const data25 = data.filter((d) => d["2025"] != null)
    .map((d) => ({ rod: d.rodada, val: d["2025"] as number }));
  const data26 = data.filter((d) => d["2026"] != null)
    .map((d) => ({ rod: d.rodada + OFFSET, val: d["2026"] as number }));

  // Ticks at midpoint between the two series so label aligns with both dots
  const midTicks = allRods.map((r) => r + OFFSET / 2);

  const handleMouseMove = useCallback((chartState: any) => {
    if (!chartState?.activeLabel) return;
    const rodada = Math.round(chartState.activeLabel as number);
    setActiveRodada(rodada);
    const point = data.find((d) => d.rodada === rodada);
    onHoverChange?.({ rodada, v25: point?.["2025"] ?? null, v26: point?.["2026"] ?? null });
  }, [data, onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    setActiveRodada(null);
    onHoverChange?.(null);
  }, [onHoverChange]);

  return (
    <div>
      {/* Legend */}
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
          margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />

          {/* Column highlight for active rodada */}
          {activeRodada !== null && (
            <ReferenceArea
              x1={activeRodada - 0.52}
              x2={activeRodada + OFFSET + 0.52}
              fill="rgba(255,255,255,0.05)"
              stroke="none"
            />
          )}

          {/* Average reference lines (behind data lines) */}
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

          {/* Numeric X axis — ticks centered between both series */}
          <XAxis
            dataKey="rod"
            type="number"
            domain={[minRod - 0.6, maxRod + OFFSET + 0.6]}
            ticks={midTicks}
            tick={(props: any) => <CustomTick {...props} missingSet={missingSet} />}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => fmtY(v, isPnt)}
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={isPnt ? 34 : 48}
          />

          {/* 2025 line — standard x positions */}
          {show25 && (
            <Line
              data={data25}
              dataKey="val"
              name="2025"
              stroke={SEASON_COLORS[2025]}
              strokeWidth={2}
              type="monotone"
              dot={(props: any) => <HollowDot {...props} stroke={SEASON_COLORS[2025]} />}
              activeDot={(props: any) => <ActiveHollowDot {...props} stroke={SEASON_COLORS[2025]} />}
              isAnimationActive={false}
            />
          )}

          {/* 2026 line — full series shifted right by OFFSET */}
          {show26 && (
            <Line
              data={data26}
              dataKey="val"
              name="2026"
              stroke={SEASON_COLORS[2026]}
              strokeWidth={2}
              type="monotone"
              dot={(props: any) => <HollowDot {...props} stroke={SEASON_COLORS[2026]} />}
              activeDot={(props: any) => <ActiveHollowDot {...props} stroke={SEASON_COLORS[2026]} />}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
