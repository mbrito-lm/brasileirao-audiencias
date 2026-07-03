"use client";
import { useMemo, useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, avg, normalizeHorario, PNT_DETENTORES } from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";

const DIA_LABELS: Record<string, string> = {
  "seg.": "Segunda", "ter.": "Terça", "qua.": "Quarta",
  "qui.": "Quinta", "sex.": "Sexta", "sáb.": "Sábado", "dom.": "Domingo",
};

export default function GeralPage() {
  const [selectedDetentor, setSelectedDetentor] = useState<string>(DETENTORES[0]);

  const stats = useMemo(() => {
    const gamesWithMetric = games.filter((g) => getMetric(g) !== null);

    type DetentorDetail = {
      detentor: string;
      count: number;
      avgVal: number;
      top10: typeof games;
      topClubs: { team: string; avg: number; count: number }[];
      topSlots: { dia: string; horario: string; avg: number; count: number }[];
    };

    const detentorDetails: DetentorDetail[] = [...DETENTORES].flatMap((d) => {
      const dGames = gamesWithMetric.filter((g) => g.detentor === d);
      if (!dGames.length) return [];

      const metrics = dGames.map((g) => getMetric(g) as number);
      const avgVal = avg(metrics);
      const sorted = [...dGames].sort((a, b) => (getMetric(b) ?? 0) - (getMetric(a) ?? 0));

      // Top clubs
      const clubMap = new Map<string, number[]>();
      dGames.forEach((g) => {
        const m = getMetric(g) as number;
        [g.mandante, g.visitante].forEach((t) => {
          if (!clubMap.has(t)) clubMap.set(t, []);
          clubMap.get(t)!.push(m);
        });
      });
      const topClubs = Array.from(clubMap.entries())
        .map(([team, ms]) => ({ team, avg: avg(ms), count: ms.length }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 8);

      // Top slots
      const slotMap = new Map<string, { dia: string; horario: string; metrics: number[] }>();
      dGames.forEach((g) => {
        const h = normalizeHorario(g.horario.substring(0, 5));
        const key = `${g.dia}|${h}`;
        if (!slotMap.has(key)) slotMap.set(key, { dia: g.dia, horario: h, metrics: [] });
        slotMap.get(key)!.metrics.push(getMetric(g) as number);
      });
      const topSlots = Array.from(slotMap.values())
        .map((s) => ({ ...s, avg: avg(s.metrics), count: s.metrics.length }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 8);

      return [{ detentor: d, count: dGames.length, avgVal, top10: sorted.slice(0, 10), topClubs, topSlots }];
    });

    return {
      totalGames: games.length,
      gamesWithData: gamesWithMetric.length,
      detentorDetails,
    };
  }, []);

  const current = stats.detentorDetails.find((d) => d.detentor === selectedDetentor) ?? stats.detentorDetails[0];

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Geral</h1>
        <p className="text-white/40 text-sm mt-1.5">Rankings por detentor — Brasileirão 2025 e 2026</p>
      </div>

      {/* Detentor selector */}
      <div className="flex gap-1.5 flex-wrap mb-8 p-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03]"
        style={{ backdropFilter: "blur(12px)" }}>
        {stats.detentorDetails.map(({ detentor }) => {
          const isActive = selectedDetentor === detentor;
          const logo = LOGOS[detentor];
          return (
            <button key={detentor} onClick={() => setSelectedDetentor(detentor)}
              title={detentor}
              className="flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200"
              style={isActive ? {
                background: "rgba(18, 55, 215, 0.70)",
                border: "1px solid rgba(60, 100, 255, 0.55)",
                boxShadow: "0 0 16px rgba(30, 70, 255, 0.35)"
              } : { border: "1px solid transparent" }}>
              {logo ? (
                <img src={logo} alt={detentor} className="h-8 w-auto object-contain"
                  style={{ filter: isActive ? "brightness(0) invert(1)" : "grayscale(1) opacity(0.45)" }} />
              ) : (
                <span className={`text-xs font-semibold px-1 ${isActive ? "text-white" : "text-white/35"}`}>{detentor}</span>
              )}
            </button>
          );
        })}
      </div>

      {current && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <KpiCard
              label={PNT_DETENTORES.has(current.detentor) ? "PNT médio" : "Audiência média"}
              value={formatMetric(current.detentor, current.avgVal)}
              accent={DETENTOR_COLORS[current.detentor]} />
            <KpiCard label="Jogos com dados" value={current.count.toString()} accent="#3b82f6" />
            <KpiCard
              label="Recorde"
              value={formatMetric(current.detentor, getMetric(current.top10[0]) ?? null)}
              sub={current.top10[0] ? `${current.top10[0].mandante} × ${current.top10[0].visitante} · Rod. ${current.top10[0].rodada}` : undefined}
              accent="#f59e0b" />
          </div>

          {/* 3-column rankings */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Top 10 audiências */}
            <div>
              <SectionTitle>Top 10 Audiências</SectionTitle>
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="px-4 py-3 text-left font-medium w-8">#</th>
                      <th className="px-4 py-3 text-left font-medium">Jogo</th>
                      <th className="px-4 py-3 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.top10.map((g, idx) => (
                      <tr key={idx} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                        <td className="px-4 py-2.5 text-white/20 text-xs tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <TeamLogo team={g.mandante} size={14} />
                            <span className="text-white/65 text-xs font-medium truncate max-w-[120px]">{g.mandante}</span>
                            <span className="text-white/20 text-[10px]">×</span>
                            <span className="text-white/65 text-xs font-medium truncate max-w-[120px]">{g.visitante}</span>
                            <TeamLogo team={g.visitante} size={14} />
                          </div>
                          <span className="text-white/25 text-[10px] tabular-nums">Rod. {g.rodada} · {g.ano}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums text-sm">
                          {formatMetric(g.detentor, getMetric(g))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top clubes */}
            <div>
              <SectionTitle>Top Clubes</SectionTitle>
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="px-4 py-3 text-left font-medium w-8">#</th>
                      <th className="px-4 py-3 text-left font-medium">Clube</th>
                      <th className="px-4 py-3 text-right font-medium">Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.topClubs.map((c, idx) => {
                      const maxAvg = current.topClubs[0]?.avg ?? 1;
                      const pct = (c.avg / maxAvg) * 100;
                      return (
                        <tr key={c.team} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                          <td className="px-4 py-2.5 text-white/20 text-xs tabular-nums">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <TeamLogo team={c.team} size={16} />
                              <div>
                                <div className="text-white/75 text-xs font-medium">{c.team}</div>
                                <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden mt-1">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DETENTOR_COLORS[current.detentor] || "#3b82f6" }} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums text-sm">
                            {formatMetric(current.detentor, c.avg)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top slots */}
            <div>
              <SectionTitle>Top Slots</SectionTitle>
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="px-4 py-3 text-left font-medium">#</th>
                      <th className="px-4 py-3 text-left font-medium">Dia · Horário</th>
                      <th className="px-4 py-3 text-right font-medium">Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.topSlots.map((s, idx) => (
                      <tr key={`${s.dia}|${s.horario}`} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                        <td className="px-4 py-2.5 text-white/20 text-xs tabular-nums w-8">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-white/70 text-xs capitalize">{DIA_LABELS[s.dia] ?? s.dia}</span>
                          <span className="text-white/25 mx-1.5">·</span>
                          <span className="text-white/50 text-xs tabular-nums">{s.horario}</span>
                          <div className="text-white/25 text-[10px] mt-0.5">{s.count} {s.count === 1 ? "jogo" : "jogos"}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums text-sm">
                          {formatMetric(current.detentor, s.avg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{children}</h2>;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${accent || "#3b82f6"}, transparent 70%)` }} />
      <p className="text-white/35 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="text-white/25 text-xs mt-1 truncate">{sub}</p>}
    </div>
  );
}
