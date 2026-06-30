"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { SEASON_COLORS } from "@/data/games";

interface DataPoint {
  rodada: number;
  "2025": number | null;
  "2026": number | null;
  avg2025: number;
  avg2026: number;
}

interface Props { data: DataPoint[] }

function fmtY(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return String(v);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-4 py-3 text-sm shadow-2xl">
      <p className="text-white/50 text-xs mb-2 font-medium">Rodada {label}</p>
      {payload.map((p: any) => p.value != null && (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-white/70">{p.dataKey}</span>
          <span className="font-bold text-white ml-auto pl-4">{fmtY(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AudienciaBarChart({ data }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (!data.length) return (
    <div className="h-64 flex items-center justify-center text-white/20 text-sm">
      Sem dados de audiência disponíveis
    </div>
  );

  const toggle = (key: string) =>
    setHidden((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const show25 = !hidden.has("2025");
  const show26 = !hidden.has("2026");
  const avg25 = data[0]?.avg2025 ?? 0;
  const avg26 = data[0]?.avg2026 ?? 0;

  return (
    <div>
      {/* Custom legend */}
      <div className="flex gap-4 mb-4 justify-end">
        {[2025, 2026].map((yr) => {
          const off = hidden.has(yr.toString());
          return (
            <button key={yr} onClick={() => toggle(yr.toString())}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                off
                  ? "border-white/10 text-white/25 bg-transparent"
                  : "border-white/10 text-white/70 bg-white/5"
              }`}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: off ? "#333" : SEASON_COLORS[yr] }} />
              {yr}
              {!off && avg25 > 0 && yr === 2025 && (
                <span className="text-white/30 ml-1">· méd {fmtY(avg25)}</span>
              )}
              {!off && avg26 > 0 && yr === 2026 && (
                <span className="text-white/30 ml-1">· méd {fmtY(avg26)}</span>
              )}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }} barGap={3} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="rodada" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
            axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtY} tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
            axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)", radius: 6 }} />

          {show25 && avg25 > 0 && (
            <ReferenceLine y={avg25} stroke={SEASON_COLORS[2025]}
              strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.5}
              label={{ value: `méd 25`, position: "insideTopRight", fill: SEASON_COLORS[2025], fontSize: 10, opacity: 0.6 }} />
          )}
          {show26 && avg26 > 0 && (
            <ReferenceLine y={avg26} stroke={SEASON_COLORS[2026]}
              strokeDasharray="4 4" strokeWidth={1.5} strokeOpacity={0.5}
              label={{ value: `méd 26`, position: "insideTopRight", fill: SEASON_COLORS[2026], fontSize: 10, opacity: 0.6, dy: 14 }} />
          )}

          {show25 && (
            <Bar dataKey="2025" fill={SEASON_COLORS[2025]} radius={[4, 4, 0, 0]} maxBarSize={22}>
              {data.map((entry, i) => (
                <Cell key={i} fill={SEASON_COLORS[2025]}
                  fillOpacity={entry["2025"] != null ? 1 : 0} />
              ))}
            </Bar>
          )}
          {show26 && (
            <Bar dataKey="2026" fill={SEASON_COLORS[2026]} radius={[4, 4, 0, 0]} maxBarSize={22}>
              {data.map((entry, i) => (
                <Cell key={i} fill={SEASON_COLORS[2026]}
                  fillOpacity={entry["2026"] != null ? 1 : 0} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
