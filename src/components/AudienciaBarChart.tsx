"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { SEASON_COLORS } from "@/data/games";

interface Props {
  data: { rodada: number; "2025": number | null; "2026": number | null }[];
}

function formatY(value: number) {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(0) + "k";
  return value.toString();
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-3 text-sm shadow-xl">
      <p className="font-semibold text-gray-200 mb-2">Rodada {label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="mb-0.5">
          {p.dataKey}:{" "}
          <span className="font-bold">
            {p.value ? formatY(p.value) : "—"}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function AudienciaBarChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
        Sem dados de audiência disponíveis
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barGap={2} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="rodada"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#374151" }}
          tickLine={false}
          label={{ value: "Rodada", position: "insideBottom", offset: -2, fill: "#6b7280", fontSize: 11 }}
        />
        <YAxis
          tickFormatter={formatY}
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#9ca3af", paddingTop: 8 }}
          formatter={(value) => (
            <span style={{ color: SEASON_COLORS[parseInt(value)] || "#9ca3af" }}>{value}</span>
          )}
        />
        <Bar dataKey="2025" fill={SEASON_COLORS[2025]} radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="2026" fill={SEASON_COLORS[2026]} radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
