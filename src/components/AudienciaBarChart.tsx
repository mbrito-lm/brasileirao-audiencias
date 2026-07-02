"use client";
import { useState } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { SEASON_COLORS } from "@/data/games";

interface DataPoint {
  rodada: number;
  "2025": number | null;
  "2026": number | null;
  avg2025: number;
  avg2026: number;
}

interface Props { data: DataPoint[]; isPnt?: boolean }

function fmtY(v: number, isPnt?: boolean) {
  if (isPnt) return v.toFixed(1).replace(".", ",");
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return String(v);
}

function fmtVal(v: number, isPnt?: boolean) {
  if (isPnt) return v.toFixed(1).replace(".", ",") + " pts";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(".", ",") + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return String(v);
}

function CustomTooltip({ active, payload, label, isPnt }: any) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p: any) => p.value != null);
  if (!items.length) return null;
  return (
    <div className="glass rounded-xl px-4 py-3 text-sm shadow-2xl">
      <p className="text-white/50 text-xs mb-2 font-medium">Rodada {label}</p>
      {items.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <svg width="16" height="10">
            <line x1="0" y1="5" x2="16" y2="5" stroke={p.stroke} strokeWidth="2" />
            <circle cx="8" cy="5" r="3.5" fill="transparent" stroke={p.stroke} strokeWidth="2" />
          </svg>
          <span className="text-white/70">{p.dataKey}</span>
          <span className="font-bold text-white ml-auto pl-4">{fmtVal(p.value, isPnt)}</span>
        </div>
      ))}
    </div>
  );
}

// Custom hollow dot component
function HollowDot({ cx, cy, stroke, xOffset = 0 }: any) {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={(cx ?? 0) + xOffset}
      cy={cy ?? 0}
      r={4}
      fill="transparent"
      stroke={stroke}
      strokeWidth={2}
    />
  );
}

function ActiveDot({ cx, cy, stroke, xOffset = 0 }: any) {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={(cx ?? 0) + xOffset}
      cy={cy ?? 0}
      r={5.5}
      fill={stroke}
      stroke="rgba(0,0,0,0.5)"
      strokeWidth={1.5}
    />
  );
}

export default function AudienciaBarChart({ data, isPnt }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

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

  // 2026 dots are shifted slightly right for visual separation
  const DOT_OFFSET = 6;

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-4 justify-end">
        {[2025, 2026].map((yr) => {
          const off = hidden.has(yr.toString());
          const avg = yr === 2025 ? avg25 : avg26;
          return (
            <button key={yr} onClick={() => toggle(yr.toString())}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                off ? "border-white/10 text-white/25" : "border-white/10 text-white/70 bg-white/5"
              }`}>
              <svg width="20" height="12" className="flex-shrink-0">
                <line x1="0" y1="6" x2="20" y2="6" stroke={off ? "#444" : SEASON_COLORS[yr]} strokeWidth="2" />
                <circle cx="10" cy="6" r="3.5" fill="transparent" stroke={off ? "#444" : SEASON_COLORS[yr]} strokeWidth="2" />
              </svg>
              {yr}
              {!off && avg > 0 && (
                <span className="text-white/30 ml-1">· méd {fmtVal(avg, isPnt)}</span>
              )}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="rodada"
            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
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
          <Tooltip content={(props) => <CustomTooltip {...props} isPnt={isPnt} />}
            cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }} />

          {/* Average reference lines */}
          {show25 && avg25 > 0 && (
            <ReferenceLine
              y={avg25}
              stroke={SEASON_COLORS[2025]}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              strokeOpacity={0.45}
              label={{ value: "méd 25", position: "insideTopRight", fill: SEASON_COLORS[2025], fontSize: 10, opacity: 0.6 }}
            />
          )}
          {show26 && avg26 > 0 && (
            <ReferenceLine
              y={avg26}
              stroke={SEASON_COLORS[2026]}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              strokeOpacity={0.45}
              label={{ value: "méd 26", position: "insideTopRight", fill: SEASON_COLORS[2026], fontSize: 10, opacity: 0.6, dy: 14 }}
            />
          )}

          {/* 2025 line — standard position */}
          {show25 && (
            <Line
              dataKey="2025"
              stroke={SEASON_COLORS[2025]}
              strokeWidth={2}
              connectNulls={false}
              dot={(props) => <HollowDot {...props} stroke={SEASON_COLORS[2025]} xOffset={0} />}
              activeDot={(props) => <ActiveDot {...props} stroke={SEASON_COLORS[2025]} xOffset={0} />}
            />
          )}

          {/* 2026 line — dots shifted right for visual separation */}
          {show26 && (
            <Line
              dataKey="2026"
              stroke={SEASON_COLORS[2026]}
              strokeWidth={2}
              connectNulls={false}
              dot={(props) => <HollowDot {...props} stroke={SEASON_COLORS[2026]} xOffset={DOT_OFFSET} />}
              activeDot={(props) => <ActiveDot {...props} stroke={SEASON_COLORS[2026]} xOffset={DOT_OFFSET} />}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
