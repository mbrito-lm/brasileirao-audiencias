"use client";
import { useMemo } from "react";
import { games, DETENTORES, DETENTOR_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, formatAudiencia, avg, normalizeHorario, PNT_DETENTORES } from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";

const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];
const DIA_LABELS: Record<string, string> = {
  "seg.": "Segunda", "ter.": "Terça", "qua.": "Quarta",
  "qui.": "Quinta", "sex.": "Sexta", "sáb.": "Sábado", "dom.": "Domingo",
};

export default function GeralPage() {
  const stats = useMemo(() => {
    const gamesWithMetric = games.filter((g) => getMetric(g) !== null);
    const nonPntGames = gamesWithMetric.filter((g) => !PNT_DETENTORES.has(g.detentor));

    // Por detentor
    type DetentorStat = { detentor: string; count: number; avg: number; max: number; maxGame: typeof games[0] | undefined; count25: number; count26: number };
    const byDetentor: DetentorStat[] = [...DETENTORES].flatMap((d) => {
      const dGames = gamesWithMetric.filter((g) => g.detentor === d);
      if (!dGames.length) return [];
      const metrics = dGames.map((g) => getMetric(g) as number);
      const avgVal = avg(metrics);
      const maxVal = Math.max(...metrics);
      const maxGame = dGames.find((g) => getMetric(g) === maxVal);
      return [{ detentor: d, count: dGames.length, avg: avgVal, max: maxVal, maxGame, count25: dGames.filter((g) => g.ano === 2025).length, count26: dGames.filter((g) => g.ano === 2026).length }];
    });

    // Por clube (apenas audiência — exclui PNT)
    const clubMap = new Map<string, number[]>();
    nonPntGames.forEach((g) => {
      const m = getMetric(g) as number;
      [g.mandante, g.visitante].forEach((team) => {
        if (!clubMap.has(team)) clubMap.set(team, []);
        clubMap.get(team)!.push(m);
      });
    });
    const byClub = Array.from(clubMap.entries())
      .map(([team, metrics]) => ({ team, count: metrics.length, avg: avg(metrics) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 20);

    // Por slot (apenas audiência)
    const slotMap = new Map<string, { dia: string; horario: string; metrics: number[] }>();
    nonPntGames.forEach((g) => {
      const h = normalizeHorario(g.horario.substring(0, 5));
      const key = `${g.dia}|${h}`;
      if (!slotMap.has(key)) slotMap.set(key, { dia: g.dia, horario: h, metrics: [] });
      slotMap.get(key)!.metrics.push(getMetric(g) as number);
    });
    const bySlot = Array.from(slotMap.values())
      .map((s) => ({ ...s, avg: avg(s.metrics), count: s.metrics.length }))
      .sort((a, b) => b.avg - a.avg);

    return {
      totalGames: games.length,
      gamesWithData: gamesWithMetric.length,
      byDetentor,
      byClub,
      bySlot,
    };
  }, []);

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Geral</h1>
        <p className="text-white/40 text-sm mt-1.5">Visão consolidada das audiências — Brasileirão 2025 e 2026</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <KpiCard label="Total de jogos" value={stats.totalGames.toString()} accent="#3b82f6" />
        <KpiCard label="Jogos com dados" value={stats.gamesWithData.toString()} accent="#10b981" />
        <KpiCard label="Detentores" value={stats.byDetentor.length.toString()} accent="#a855f7" />
        <KpiCard label="Temporadas" value="2025 · 2026" accent="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Por Detentor */}
        <div className="xl:col-span-2">
          <SectionTitle>Por Detentor</SectionTitle>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-medium">Detentor</th>
                  <th className="px-4 py-3 text-right font-medium">Jogos</th>
                  <th className="px-4 py-3 text-right font-medium">Média</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Recorde</th>
                </tr>
              </thead>
              <tbody>
                {stats.byDetentor.map((d) => (
                  <tr key={d.detentor} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {LOGOS[d.detentor]
                          ? <img src={LOGOS[d.detentor]} alt={d.detentor} className="h-5 w-auto object-contain opacity-80" />
                          : <span className="text-xs font-semibold" style={{ color: DETENTOR_COLORS[d.detentor] || "#9ca3af" }}>{d.detentor}</span>
                        }
                        <div className="flex gap-1">
                          {d.count25 > 0 && <span className="text-[9px] text-white/20 tabular-nums">{d.count25}× '25</span>}
                          {d.count25 > 0 && d.count26 > 0 && <span className="text-white/10">·</span>}
                          {d.count26 > 0 && <span className="text-[9px] text-white/20 tabular-nums">{d.count26}× '26</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white/50 tabular-nums text-xs">{d.count}</td>
                    <td className="px-4 py-3 text-right font-bold text-white tabular-nums text-sm">
                      {formatMetric(d.detentor, d.avg)}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs hidden sm:table-cell">
                      {d.maxGame
                        ? <span className="truncate block max-w-[180px]">{d.maxGame.mandante} × {d.maxGame.visitante} <span className="text-white/20">Rod.{d.maxGame.rodada}</span></span>
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Por Slot */}
        <div>
          <SectionTitle>Por Slot <span className="text-white/25 font-normal text-xs normal-case ml-1">(excl. PNT)</span></SectionTitle>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left font-medium">Slot</th>
                  <th className="px-4 py-3 text-right font-medium">Jogos</th>
                  <th className="px-4 py-3 text-right font-medium">Média</th>
                </tr>
              </thead>
              <tbody>
                {stats.bySlot.map((s) => (
                  <tr key={`${s.dia}|${s.horario}`} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-white/70 text-xs capitalize">{DIA_LABELS[s.dia] ?? s.dia}</span>
                      <span className="text-white/25 mx-1.5">·</span>
                      <span className="text-white/50 text-xs tabular-nums">{s.horario}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-white/40 tabular-nums text-xs">{s.count}</td>
                    <td className="px-4 py-3 text-right font-bold text-white tabular-nums text-sm">
                      {formatAudiencia(s.avg)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Por Clube */}
      <div className="mt-8">
        <SectionTitle>Top Clubes por Audiência <span className="text-white/25 font-normal text-xs normal-case ml-1">(jogos não-PNT, média mandante + visitante)</span></SectionTitle>
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left font-medium w-8">#</th>
                <th className="px-4 py-3 text-left font-medium">Clube</th>
                <th className="px-4 py-3 text-right font-medium">Jogos</th>
                <th className="px-4 py-3 text-right font-medium">Média</th>
                <th className="px-4 py-3 pr-6 hidden sm:table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {stats.byClub.map((c, idx) => {
                const maxAvg = stats.byClub[0]?.avg ?? 1;
                const pct = (c.avg / maxAvg) * 100;
                return (
                  <tr key={c.team} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                    <td className="px-4 py-2.5 text-white/20 text-xs tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <TeamLogo team={c.team} size={18} />
                        <span className="text-white/80 text-sm font-medium">{c.team}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-white/40 tabular-nums text-xs">{c.count}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums text-sm">
                      {formatAudiencia(c.avg)}
                    </td>
                    <td className="px-4 py-2.5 pr-6 hidden sm:table-cell">
                      <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{children}</h2>;
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${accent || "#3b82f6"}, transparent 70%)` }} />
      <p className="text-white/35 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}
