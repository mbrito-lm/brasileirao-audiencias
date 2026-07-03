"use client";
import { useMemo, useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS, Game } from "@/data/games";
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
    <span className="tabular-nums font-semibold text-[10px]" style={{ color: SEASON_COLORS[ano] }}>
      {ano}
    </span>
  );
}

function SeasonFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1">
      {([null, 2025, 2026] as (number | null)[]).map((v) => (
        <button key={v ?? "all"} onClick={() => onChange(v)}
          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
            value === v ? "border-white/25 bg-white/10 text-white" : "border-white/[0.07] text-white/30 hover:text-white/50"
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

function buildTimeline(season: 2025 | 2026): RodadaGroup[] {
  const filtered = games.filter((g) => g.ano === season);

  const rodadaMap = new Map<string, { rodada: number; ano: number; dates: Map<string, Game[]> }>();
  filtered.forEach((g) => {
    const key = `${g.rodada}-${g.ano}`;
    if (!rodadaMap.has(key)) rodadaMap.set(key, { rodada: g.rodada, ano: g.ano, dates: new Map() });
    const rg = rodadaMap.get(key)!;
    if (!rg.dates.has(g.data)) rg.dates.set(g.data, []);
    rg.dates.get(g.data)!.push(g);
  });

  const sorted = Array.from(rodadaMap.entries()).sort(([, a], [, b]) => {
    const aTs = Math.max(...Array.from(a.dates.keys()).map((d) => parseDate(d)));
    const bTs = Math.max(...Array.from(b.dates.keys()).map((d) => parseDate(d)));
    return bTs - aTs;
  });

  return sorted.map(([key, { rodada, ano, dates }]) => {
    const sortedDates = Array.from(dates.entries()).sort(([a], [b]) => parseDate(a) - parseDate(b));

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

      return {
        date: dateStr, display, weekday,
        matches: Array.from(matchMap.values()).sort((a, b) => a.horario.localeCompare(b.horario)),
      };
    });

    return { rodada, ano, key, days };
  });
}

function Timeline({ season, onSeasonChange }: { season: 2025 | 2026; onSeasonChange: (s: 2025 | 2026) => void }) {
  const rodadaGroups = useMemo(() => buildTimeline(season), [season]);

  return (
    <div className="mb-10">
      <div className="flex items-center gap-4 mb-3">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Calendário</h2>
        <div className="flex gap-1">
          {([2025, 2026] as const).map((yr) => (
            <button key={yr} onClick={() => onSeasonChange(yr)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                season === yr
                  ? "border-white/25 text-white"
                  : "border-white/[0.07] text-white/30 hover:text-white/50"
              }`}
              style={season === yr ? { borderColor: SEASON_COLORS[yr] + "80", background: SEASON_COLORS[yr] + "20", color: SEASON_COLORS[yr] } : {}}>
              {yr}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          overflowX: "auto",
          overflowY: "visible",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaX === 0) {
            // purely vertical — let page scroll, don't capture
            return;
          }
        }}
        className="pb-2">
        <style>{`.geral-timeline::-webkit-scrollbar{display:none}`}</style>
        <div style={{ display: "flex", gap: "0", minWidth: "max-content" }}>
          {rodadaGroups.map((rg, rgIdx) => (
            <div key={rg.key}
              style={{
                display: "flex", flexDirection: "column", gap: "4px",
                paddingRight: 12,
                marginRight: 4,
                borderRight: rgIdx < rodadaGroups.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}>
              {/* Rodada header */}
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1 mb-0.5">
                Rod. {rg.rodada}
              </div>
              {/* Day columns */}
              <div style={{ display: "flex", gap: "4px" }}>
                {rg.days.map((day) => (
                  <div key={day.date} style={{ width: 118, flexShrink: 0 }}>
                    <div className="text-[10px] text-white/25 px-1 mb-1">
                      <span className="capitalize">{day.weekday.slice(0, 3)}</span>
                      <span className="ml-1">{day.display}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {day.matches.map((match) => (
                        <div key={`${match.mandante}|${match.visitante}`}
                          className="glass rounded-lg px-2 py-1.5 border border-white/[0.06]">
                          {/* Line 1: shields + horario */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-0.5">
                              <TeamLogo team={match.mandante} size={14} />
                              <span className="text-white/15 text-[9px] mx-0.5">×</span>
                              <TeamLogo team={match.visitante} size={14} />
                            </div>
                            <span className="text-[9px] text-white/30 tabular-nums">{match.horario}</span>
                          </div>
                          {/* Lines per broadcaster */}
                          {match.broadcasters.map((b) => (
                            <div key={b.detentor} className="flex items-center justify-between gap-1 mt-0.5">
                              <div className="h-3 flex items-center">
                                {LOGOS[b.detentor] ? (
                                  <img src={LOGOS[b.detentor]} alt={b.detentor}
                                    className="h-3 w-auto object-contain max-w-[56px]"
                                    style={{ filter: "brightness(0) invert(1)", opacity: 0.65 }} />
                                ) : (
                                  <span className="text-[9px] font-semibold" style={{ color: DETENTOR_COLORS[b.detentor] || "#9ca3af" }}>
                                    {b.detentor}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-white tabular-nums shrink-0">
                                {formatMetric(b.detentor, b.metric)}
                              </span>
                            </div>
                          ))}
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

type DetentorStat = {
  detentor: string;
  count: number;
  avgVal: number;
  top10: Game[];
  topClubs: { team: string; avg: number; count: number }[];
  topSlots: { dia: string; horario: string; avg: number; count: number }[];
};

function computeDetentorStats(season: number | null): DetentorStat[] {
  const filtered = season ? games.filter((g) => g.ano === season) : games;
  return [...DETENTORES].flatMap((d): DetentorStat[] => {
    const dGames = filtered.filter((g) => g.detentor === d && getMetric(g) !== null);
    if (!dGames.length) return [];
    const sorted = [...dGames].sort((a, b) => (getMetric(b) ?? 0) - (getMetric(a) ?? 0));

    const clubMap = new Map<string, { metrics: number[]; gc: number }>();
    dGames.forEach((g) => {
      const m = getMetric(g) as number;
      [g.mandante, g.visitante].forEach((t) => {
        if (!clubMap.has(t)) clubMap.set(t, { metrics: [], gc: 0 });
        const c = clubMap.get(t)!;
        c.metrics.push(m);
        c.gc++;
      });
    });
    const topClubs = Array.from(clubMap.entries())
      .map(([team, { metrics, gc }]) => ({ team, avg: avg(metrics), count: gc }))
      .sort((a, b) => b.avg - a.avg).slice(0, 10);

    const slotMap = new Map<string, { dia: string; horario: string; metrics: number[] }>();
    dGames.forEach((g) => {
      const h = normalizeHorario(g.horario.substring(0, 5));
      const k = `${g.dia}|${h}`;
      if (!slotMap.has(k)) slotMap.set(k, { dia: g.dia, horario: h, metrics: [] });
      slotMap.get(k)!.metrics.push(getMetric(g) as number);
    });
    const topSlots = Array.from(slotMap.values())
      .map((s) => ({ ...s, avg: avg(s.metrics), count: s.metrics.length }))
      .sort((a, b) => b.avg - a.avg).slice(0, 8);

    return [{ detentor: d, count: dGames.length, avgVal: avg(dGames.map((g) => getMetric(g) as number)), top10: sorted.slice(0, 10), topClubs, topSlots }];
  });
}

function DetentorTabs({ available, selected, onSelect }: {
  available: string[]; selected: string; onSelect: (d: string) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap mt-2">
      {available.map((d) => {
        const logo = LOGOS[d];
        const isActive = d === selected;
        return (
          <button key={d} onClick={() => onSelect(d)} title={d}
            className={`flex items-center justify-center px-2 py-1 rounded-lg transition-all border ${
              isActive ? "border-white/20 bg-white/10" : "border-white/[0.06] hover:bg-white/[0.04]"
            }`}>
            {logo ? (
              <img src={logo} alt={d} className="h-3.5 w-auto object-contain"
                style={{ filter: isActive ? "brightness(0) invert(1)" : "grayscale(1) opacity(0.4)", maxWidth: 48 }} />
            ) : (
              <span className="text-[9px] font-semibold" style={{ color: isActive ? "white" : (DETENTOR_COLORS[d] || "#9ca3af") + "99" }}>{d}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RankingCard({ title, type }: { title: string; type: "top10" | "clubs" | "slots" }) {
  const [season, setSeason] = useState<number | null>(null);
  const [selectedDetentor, setSelectedDetentor] = useState<string>(DETENTORES[0]);

  const allStats = useMemo(() => computeDetentorStats(season), [season]);
  const available = allStats.map((d) => d.detentor);
  const effectiveDetentor = available.includes(selectedDetentor) ? selectedDetentor : (available[0] ?? "");
  const data = allStats.find((d) => d.detentor === effectiveDetentor);

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">{title}</h2>
          <SeasonFilter value={season} onChange={setSeason} />
        </div>
        <DetentorTabs available={available} selected={effectiveDetentor} onSelect={setSelectedDetentor} />
        {data && (
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-white/25">Média</span>
            <span className="text-sm font-bold text-white">{formatMetric(data.detentor, data.avgVal)}</span>
            <span className="text-[10px] text-white/20">{data.count} jogos</span>
          </div>
        )}
      </div>

      {!data ? (
        <p className="p-4 text-xs text-white/25">Sem dados para os filtros selecionados</p>
      ) : type === "top10" ? (
        <table className="w-full text-xs border-collapse">
          <tbody>
            {data.top10.map((g, idx) => (
              <tr key={idx} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="pl-3 pr-1 py-1.5 text-white/20 tabular-nums w-5">{idx + 1}</td>
                <td className="py-1.5 pr-1">
                  <div className="flex items-center gap-1">
                    <TeamLogo team={g.mandante} size={12} />
                    <span className="text-white/55 truncate max-w-[65px]">{g.mandante}</span>
                    <span className="text-white/20 text-[9px] shrink-0">×</span>
                    <span className="text-white/55 truncate max-w-[65px]">{g.visitante}</span>
                    <TeamLogo team={g.visitante} size={12} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-white/25">Rod. {g.rodada}</span>
                    <SeasonPill ano={g.ano} />
                  </div>
                </td>
                <td className="pr-3 py-1.5 text-right font-bold text-white tabular-nums whitespace-nowrap">
                  {formatMetric(g.detentor, getMetric(g))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : type === "clubs" ? (
        <table className="w-full text-xs border-collapse">
          <tbody>
            {data.topClubs.map((c, idx) => {
              const pct = data.topClubs[0]?.avg ? (c.avg / data.topClubs[0].avg) * 100 : 0;
              return (
                <tr key={c.team} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="pl-3 pr-1 py-1.5 text-white/20 tabular-nums w-5">{idx + 1}</td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <TeamLogo team={c.team} size={14} />
                      <div>
                        <div className="text-white/65">{c.team}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-16 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: DETENTOR_COLORS[data.detentor] || "#3b82f6" }} />
                          </div>
                          <span className="text-white/20 text-[9px]">{c.count}j</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="pr-3 py-1.5 text-right font-bold text-white tabular-nums whitespace-nowrap">
                    {formatMetric(data.detentor, c.avg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-xs border-collapse">
          <tbody>
            {data.topSlots.map((s, idx) => (
              <tr key={`${s.dia}|${s.horario}`} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="pl-3 pr-1 py-1.5 text-white/20 tabular-nums w-5">{idx + 1}</td>
                <td className="py-1.5">
                  <span className="text-white/65 capitalize">{DIA_LABELS[s.dia]?.slice(0, 3) ?? s.dia}</span>
                  <span className="text-white/25 mx-1">·</span>
                  <span className="text-white/50 tabular-nums">{s.horario}</span>
                  <div className="text-[9px] text-white/20 mt-0.5">{s.count} {s.count === 1 ? "jogo" : "jogos"}</div>
                </td>
                <td className="pr-3 py-1.5 text-right font-bold text-white tabular-nums whitespace-nowrap">
                  {formatMetric(data.detentor, s.avg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeralPage() {
  const [calendarSeason, setCalendarSeason] = useState<2025 | 2026>(2026);

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Geral</h1>
        <p className="text-white/40 text-sm mt-1.5">Calendário e rankings por detentor — Brasileirão 2025 e 2026</p>
      </div>

      <Timeline season={calendarSeason} onSeasonChange={setCalendarSeason} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RankingCard title="Top 10 Audiências" type="top10" />
        <RankingCard title="Top Clubes" type="clubs" />
        <RankingCard title="Top Slots" type="slots" />
      </div>
    </div>
  );
}
