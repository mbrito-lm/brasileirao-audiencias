"use client";
import { useState, useMemo } from "react";
import { games, DETENTORES, SEASON_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, PNT_DETENTORES, avg, normalizeHorario } from "@/lib/stats";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

const PALETTE = [
  "#3b82f6", "#a855f7", "#f59e0b", "#10b981",
  "#ef4444", "#06b6d4", "#f97316", "#ec4899",
  "#8b5cf6", "#14b8a6",
];

interface Series {
  id: string;
  detentor: string;
  ano: 2025 | 2026;
  color: string;
}

const ANOS: Array<2025 | 2026> = [2025, 2026];

export default function GraficosPage() {
  const [series, setSeries] = useState<Series[]>([
    { id: "s0", detentor: "CazéTV", ano: 2026, color: PALETTE[0] },
    { id: "s1", detentor: "CazéTV", ano: 2025, color: PALETTE[1] },
  ]);
  const [newDet, setNewDet] = useState<string>("Amazon");
  const [newAno, setNewAno] = useState<2025 | 2026>(2026);
  const [showAvgs, setShowAvgs] = useState(true);

  // Collect all rodadas across all series
  const allRodadas = useMemo(() => {
    const rods = new Set<number>();
    series.forEach((s) => {
      games
        .filter((g) => g.detentor === s.detentor && g.ano === s.ano)
        .forEach((g) => rods.add(g.rodada));
    });
    return Array.from(rods).sort((a, b) => a - b);
  }, [series]);

  // Build chart data points
  const chartData = useMemo(() => {
    return allRodadas.map((rod) => {
      const point: Record<string, number | null | string> = { rodada: rod };
      series.forEach((s) => {
        const gs = games.filter(
          (g) => g.rodada === rod && g.detentor === s.detentor && g.ano === s.ano && getMetric(g) !== null
        );
        point[s.id] = gs.length ? avg(gs.map((g) => getMetric(g) as number)) : null;
      });
      return point;
    });
  }, [series, allRodadas]);

  // Per-series averages (for reference lines)
  const seriesAvgs = useMemo(() => {
    return series.map((s) => {
      const vals = games
        .filter((g) => g.detentor === s.detentor && g.ano === s.ano && getMetric(g) !== null)
        .map((g) => getMetric(g) as number);
      return { id: s.id, avg: vals.length ? avg(vals) : null };
    });
  }, [series]);

  function addSeries() {
    if (series.some((s) => s.detentor === newDet && s.ano === newAno)) return;
    const usedColors = series.map((s) => s.color);
    const color = PALETTE.find((c) => !usedColors.includes(c)) ?? PALETTE[series.length % PALETTE.length];
    setSeries((prev) => [...prev, { id: `s${Date.now()}`, detentor: newDet, ano: newAno, color }]);
  }

  function removeSeries(id: string) {
    setSeries((prev) => prev.filter((s) => s.id !== id));
  }

  const hasMixed = series.some((s) => PNT_DETENTORES.has(s.detentor)) &&
    series.some((s) => !PNT_DETENTORES.has(s.detentor));

  const fmtY = (v: number) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(".", ",") + "M";
    if (v >= 1_000) return Math.round(v / 1_000) + "k";
    return v.toFixed(1).replace(".", ",");
  };

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Gráficos</h1>
        <p className="text-white/40 text-sm mt-1.5">Monte um gráfico personalizado combinando detentores e temporadas</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar — series builder */}
        <aside className="w-64 flex-shrink-0 flex flex-col gap-4">
          {/* Series list */}
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">Séries ativas</p>
            {series.length === 0 ? (
              <p className="text-xs text-white/25">Nenhuma série adicionada</p>
            ) : (
              <div className="flex flex-col gap-2">
                {series.map((s) => (
                  <div key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border"
                    style={{ borderColor: s.color + "44", background: s.color + "12" }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {LOGOS[s.detentor]
                          ? <img src={LOGOS[s.detentor]} alt={s.detentor} className="h-3.5 w-auto object-contain"
                              style={{ filter: "brightness(0) invert(1)", opacity: 0.7 }} />
                          : <span style={{ color: s.color }} className="font-medium truncate">{s.detentor}</span>
                        }
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: SEASON_COLORS[s.ano] }}>
                        {s.ano} {PNT_DETENTORES.has(s.detentor) && <span className="text-white/30">· pts</span>}
                      </p>
                    </div>
                    <button onClick={() => removeSeries(s.id)}
                      className="text-white/20 hover:text-white/60 transition-colors text-base leading-none shrink-0">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add series */}
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">Adicionar série</p>
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">Detentor</p>
                <select value={newDet} onChange={(e) => setNewDet(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.10] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 appearance-none">
                  {[...DETENTORES].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-white/30 mb-1 uppercase tracking-wider">Temporada</p>
                <div className="flex gap-2">
                  {ANOS.map((a) => (
                    <button key={a} onClick={() => setNewAno(a)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        newAno === a
                          ? "border-blue-500/50 text-white"
                          : "border-white/10 text-white/35 hover:text-white/60"
                      }`}
                      style={newAno === a ? { color: SEASON_COLORS[a], borderColor: SEASON_COLORS[a] + "60", background: SEASON_COLORS[a] + "15" } : {}}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={addSeries}
                disabled={series.some((s) => s.detentor === newDet && s.ano === newAno)}
                className="w-full py-2 rounded-xl text-xs font-semibold bg-blue-600/25 text-blue-300 border border-blue-500/40 hover:bg-blue-600/35 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-1">
                + Adicionar
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">Opções</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showAvgs} onChange={(e) => setShowAvgs(e.target.checked)}
                className="rounded accent-blue-500" />
              <span className="text-xs text-white/50">Mostrar médias</span>
            </label>
          </div>
        </aside>

        {/* Chart area */}
        <div className="flex-1 min-w-0">
          {hasMixed && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 mb-4">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-xs text-red-400">
                Métricas mistas — algumas séries são em pontos PNT e outras em espectadores. Os valores não são comparáveis entre si.
              </p>
            </div>
          )}

          <div className="glass rounded-2xl p-6">
            {series.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-white/20 gap-3">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <p className="text-sm">Adicione pelo menos uma série para ver o gráfico</p>
              </div>
            ) : (
              <>
                {/* Custom legend */}
                <div className="flex flex-wrap gap-4 mb-6">
                  {series.map((s) => {
                    const sa = seriesAvgs.find((x) => x.id === s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className="w-4 h-0.5 rounded" style={{ background: s.color }} />
                        <span className="text-xs text-white/60">
                          {s.detentor} <span style={{ color: SEASON_COLORS[s.ano] }}>{s.ano}</span>
                        </span>
                        {sa?.avg !== null && sa?.avg !== undefined && (
                          <span className="text-[10px] text-white/25">
                            ({formatMetric(s.detentor, sa.avg)} média)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="rodada"
                      tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      label={{ value: "Rodada", position: "insideBottom", offset: -8, fill: "rgba(255,255,255,0.18)", fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={fmtY}
                      tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 11 }}
                      axisLine={false} tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,9,15,0.97)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 12,
                        fontSize: 12,
                        padding: "10px 14px",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.40)", marginBottom: 6, fontSize: 11 }}
                      labelFormatter={(v) => `Rodada ${v}`}
                      formatter={(value: any, name: string) => {
                        const s = series.find((s) => s.id === name);
                        const label = s ? `${s.detentor} ${s.ano}` : name;
                        return [fmtY(value as number), label];
                      }}
                      itemStyle={{ padding: "2px 0" }}
                    />
                    {/* Average reference lines */}
                    {showAvgs && seriesAvgs.map((sa) => {
                      const s = series.find((s) => s.id === sa.id);
                      if (!s || sa.avg === null) return null;
                      return (
                        <ReferenceLine key={`avg-${sa.id}`} y={sa.avg}
                          stroke={s.color} strokeOpacity={0.3}
                          strokeDasharray="4 4" strokeWidth={1} />
                      );
                    })}
                    {series.map((s) => (
                      <Line
                        key={s.id}
                        dataKey={s.id}
                        stroke={s.color}
                        strokeWidth={2}
                        dot={{ fill: s.color, r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls={false}
                        name={s.id}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
