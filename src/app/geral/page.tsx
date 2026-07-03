"use client";
import { useMemo, useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, avg, normalizeHorario, PNT_DETENTORES, parseDate } from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";

const DIA_LABELS: Record<string, string> = {
  "seg.": "Segunda", "ter.": "Terça", "qua.": "Quarta",
  "qui.": "Quinta", "sex.": "Sexta", "sáb.": "Sábado", "dom.": "Domingo",
};
const WEEK_DAYS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

function parseDateObj(dateStr: string): Date {
  const [d, m, y] = dateStr.split("/");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}

function SeasonPill({ ano }: { ano: number }) {
  return (
    <span className="tabular-nums font-semibold text-[10px] px-1 rounded" style={{ color: SEASON_COLORS[ano] }}>
      {ano}
    </span>
  );
}

function SeasonFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1">
      {[null, 2025, 2026].map((v) => (
        <button key={v ?? "all"} onClick={() => onChange(v)}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
            value === v
              ? "border-white/25 bg-white/10 text-white"
              : "border-white/[0.07] text-white/30 hover:text-white/50"
          }`}>
          {v == null ? "Todas" : v}
        </button>
      ))}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

type BroadcasterInfo = { detentor: string; metric: number | null };
type MatchBox = { mandante: string; visitante: string; horario: string; broadcasters: BroadcasterInfo[] };
type DayCol = { date: string; display: string; weekday: string; matches: MatchBox[] };
type RodadaGroup = { rodada: number; ano: number; key: string; days: DayCol[] };

function buildTimeline(): RodadaGroup[] {
  const dateMap = new Map<string, typeof games>();
  games.forEach((g) => {
    if (!dateMap.has(g.data)) dateMap.set(g.data, []);
    dateMap.get(g.data)!.push(g);
  });

  const rodadaKey = (g: typeof games[0]) => `${g.rodada}-${g.ano}`;

  const rodadaMap = new Map<string, { rodada: number; ano: number; dates: Map<string, typeof games> }>();
  dateMap.forEach((dayGames, date) => {
    dayGames.forEach((g) => {
      const key = rodadaKey(g);
      if (!rodadaMap.has(key)) rodadaMap.set(key, { rodada: g.rodada, ano: g.ano, dates: new Map() });
      const rg = rodadaMap.get(key)!;
      if (!rg.dates.has(date)) rg.dates.set(date, []);
      rg.dates.get(date)!.push(g);
    });
  });

  const sorted = Array.from(rodadaMap.entries())
    .sort(([, a], [, b]) => {
      const aTs = Math.max(...Array.from(a.dates.keys()).map((d) => parseDate(d)));
      const bTs = Math.max(...Array.from(b.dates.keys()).map((d) => parseDate(d)));
      return bTs - aTs;
    });

  return sorted.map(([key, { rodada, ano, dates }]) => {
    const sortedDates = Array.from(dates.entries())
      .sort(([a], [b]) => parseDate(a) - parseDate(b));

    const days: DayCol[] = sortedDates.map(([dateStr, dayGames]) => {
      const dateObj = parseDateObj(dateStr);
      const display = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
      const weekday = WEEK_DAYS[dateObj.getDay()];

      const matchMap = new Map<string, MatchBox>();
      dayGames.forEach((g) => {
        const mKey = `${g.mandante}|${g.visitante}`;
        if (!matchMap.has(mKey)) {
          matchMap.set(mKey, {
            mandante: g.mandante, visitante: g.visitante,
            horario: normalizeHorario(g.horario.substring(0, 5)),
            broadcasters: [],
          });
        }
        matchMap.get(mKey)!.broadcasters.push({ detentor: g.detentor, metric: getMetric(g) });
      });

      const matches = Array.from(matchMap.values())
        .sort((a, b) => a.horario.localeCompare(b.horario));

      return { date: dateStr, display, weekday, matches };
    });

    return { rodada, ano, key, days };
  });
}

function Timeline() {
  const rodadaGroups = useMemo(buildTimeline, []);

  return (
    <div className="mb-10">
      <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Calendário</h2>
      <div style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        className="pb-2">
        <div style={{ display: "flex", gap: "12px", minWidth: "max-content" }}>
          {rodadaGroups.map((rg) => (
            <div key={rg.key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {/* Rodada header */}
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 mb-0.5">
                Rod. {rg.rodada}
                <span className="ml-1 font-normal" style={{ color: SEASON_COLORS[rg.ano] }}>{rg.ano}</span>
              </div>
              {/* Day columns */}
              <div style={{ display: "flex", gap: "4px" }}>
                {rg.days.map((day) => (
                  <div key={day.date} style={{ width: 128, flexShrink: 0 }}>
                    {/* Day header */}
                    <div className="text-[10px] text-white/30 px-1 mb-1">
                      <span className="capitalize">{day.weekday.slice(0, 3)}</span>
                      <span className="text-white/20 ml-1">{day.display}</span>
                    </div>
                    {/* Game boxes */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {day.matches.map((match) => (
                        <div key={`${match.mandante}|${match.visitante}`}
                          className="glass rounded-lg px-2 py-1.5 border border-white/[0.06]">
                          <div className="flex items-center gap-1 mb-1">
                            <TeamLogo team={match.mandante} size={11} />
                            <span className="text-white/60 text-[10px] truncate">{match.mandante}</span>
                            <span className="text-white/20 text-[9px] shrink-0">×</span>
                            <span className="text-white/60 text-[10px] truncate">{match.visitante}</span>
                            <TeamLogo team={match.visitante} size={11} />
                          </div>
                          {match.broadcasters.map((b) => (
                            <div key={b.detentor} className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-semibold" style={{ color: DETENTOR_COLORS[b.detentor] || "#9ca3af" }}>
                                {b.detentor}
                              </span>
                              <span className="text-[10px] font-bold text-white tabular-nums shrink-0">
                                {formatMetric(b.detentor, b.metric)}
                              </span>
                            </div>
                          ))}
                          <div className="text-[9px] text-white/20 mt-0.5">{match.horario}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Rankings ─────────────────────────────────────────────────────────────────

function computeDetentorStats(season: number | null) {
  const filtered = season ? games.filter((g) => g.ano === season) : games;
  return [...DETENTORES].flatMap((d) => {
    const dGames = filtered.filter((g) => g.detentor === d && getMetric(g) !== null);
    if (!dGames.length) return [];

    const sorted = [...dGames].sort((a, b) => (getMetric(b) ?? 0) - (getMetric(a) ?? 0));

    const clubMap = new Map<string, { metrics: number[]; games: number }>();
    dGames.forEach((g) => {
      const m = getMetric(g) as number;
      [g.mandante, g.visitante].forEach((t) => {
        if (!clubMap.has(t)) clubMap.set(t, { metrics: [], games: 0 });
        const c = clubMap.get(t)!;
        c.metrics.push(m);
        c.games++;
      });
    });
    const topClubs = Array.from(clubMap.entries())
      .map(([team, { metrics, games: gc }]) => ({ team, avg: avg(metrics), count: gc }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);

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

    return [{ detentor: d, count: dGames.length, avgVal: avg(dGames.map((g) => getMetric(g) as number)), top10: sorted.slice(0, 10), topClubs, topSlots }];
  });
}

function DetentorHeader({ detentor }: { detentor: string }) {
  const logo = LOGOS[detentor];
  const color = DETENTOR_COLORS[detentor];
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
      {logo ? (
        <img src={logo} alt={detentor} className="h-5 w-auto object-contain"
          style={{ filter: "brightness(0) invert(1)", opacity: 0.7 }} />
      ) : (
        <span className="text-xs font-bold" style={{ color }}>{detentor}</span>
      )}
    </div>
  );
}

function RankingSection({ title, season, onSeasonChange, children }: {
  title: string; season: number | null;
  onSeasonChange: (v: number | null) => void; children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-4 mb-3">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">{title}</h2>
        <SeasonFilter value={season} onChange={onSeasonChange} />
      </div>
      <div style={{ overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties} className="pb-2">
        <div style={{ display: "flex", gap: "10px", minWidth: "max-content" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function GeralPage() {
  const [top10Season, setTop10Season] = useState<number | null>(null);
  const [clubSeason, setClubSeason] = useState<number | null>(null);
  const [slotSeason, setSlotSeason] = useState<number | null>(null);

  const top10Stats = useMemo(() => computeDetentorStats(top10Season), [top10Season]);
  const clubStats = useMemo(() => computeDetentorStats(clubSeason), [clubSeason]);
  const slotStats = useMemo(() => computeDetentorStats(slotSeason), [slotSeason]);

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Geral</h1>
        <p className="text-white/40 text-sm mt-1.5">Calendário e rankings por detentor — Brasileirão 2025 e 2026</p>
      </div>

      <Timeline />

      {/* Top 10 Audiências */}
      <RankingSection title="Top 10 Audiências" season={top10Season} onSeasonChange={setTop10Season}>
        {top10Stats.map((d) => (
          <div key={d.detentor} className="glass rounded-2xl overflow-hidden" style={{ minWidth: 260 }}>
            <DetentorHeader detentor={d.detentor} />
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <span className="text-[10px] text-white/30">Média: </span>
              <span className="text-xs font-bold text-white">{formatMetric(d.detentor, d.avgVal)}</span>
              <span className="text-[10px] text-white/25 ml-2">{d.count} jogos</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {d.top10.map((g, idx) => (
                  <tr key={idx} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="pl-3 pr-1 py-1.5 text-white/20 tabular-nums w-5">{idx + 1}</td>
                    <td className="py-1.5 pr-1">
                      <div className="flex items-center gap-1">
                        <TeamLogo team={g.mandante} size={11} />
                        <span className="text-white/55 truncate max-w-[60px]">{g.mandante}</span>
                        <span className="text-white/20 text-[9px]">×</span>
                        <span className="text-white/55 truncate max-w-[60px]">{g.visitante}</span>
                        <TeamLogo team={g.visitante} size={11} />
                      </div>
                      <div className="text-[9px] text-white/25 flex gap-1 mt-0.5">
                        <span>Rod. {g.rodada}</span>
                        <SeasonPill ano={g.ano} />
                      </div>
                    </td>
                    <td className="pr-3 py-1.5 text-right font-bold text-white tabular-nums">
                      {formatMetric(g.detentor, getMetric(g))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </RankingSection>

      {/* Top Clubes */}
      <RankingSection title="Top Clubes" season={clubSeason} onSeasonChange={setClubSeason}>
        {clubStats.map((d) => (
          <div key={d.detentor} className="glass rounded-2xl overflow-hidden" style={{ minWidth: 240 }}>
            <DetentorHeader detentor={d.detentor} />
            <table className="w-full text-xs border-collapse">
              <tbody>
                {d.topClubs.map((c, idx) => {
                  const maxAvg = d.topClubs[0]?.avg ?? 1;
                  const pct = (c.avg / maxAvg) * 100;
                  return (
                    <tr key={c.team} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="pl-3 pr-1 py-1.5 text-white/20 tabular-nums w-5">{idx + 1}</td>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <TeamLogo team={c.team} size={13} />
                          <div>
                            <div className="text-white/65">{c.team}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="w-14 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DETENTOR_COLORS[d.detentor] || "#3b82f6" }} />
                              </div>
                              <span className="text-white/20 text-[9px]">{c.count}j</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="pr-3 py-1.5 text-right font-bold text-white tabular-nums">
                        {formatMetric(d.detentor, c.avg)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </RankingSection>

      {/* Top Slots */}
      <RankingSection title="Top Slots" season={slotSeason} onSeasonChange={setSlotSeason}>
        {slotStats.map((d) => (
          <div key={d.detentor} className="glass rounded-2xl overflow-hidden" style={{ minWidth: 220 }}>
            <DetentorHeader detentor={d.detentor} />
            <table className="w-full text-xs border-collapse">
              <tbody>
                {d.topSlots.map((s, idx) => (
                  <tr key={`${s.dia}|${s.horario}`} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="pl-3 pr-1 py-1.5 text-white/20 tabular-nums w-5">{idx + 1}</td>
                    <td className="py-1.5">
                      <span className="text-white/65 capitalize">{DIA_LABELS[s.dia]?.slice(0, 3) ?? s.dia}</span>
                      <span className="text-white/25 mx-1">·</span>
                      <span className="text-white/50 tabular-nums">{s.horario}</span>
                      <div className="text-[9px] text-white/20 mt-0.5">{s.count} {s.count === 1 ? "jogo" : "jogos"}</div>
                    </td>
                    <td className="pr-3 py-1.5 text-right font-bold text-white tabular-nums">
                      {formatMetric(d.detentor, s.avg)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </RankingSection>
    </div>
  );
}
