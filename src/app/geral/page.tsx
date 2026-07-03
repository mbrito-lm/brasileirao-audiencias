"use client";
import { useRef, useEffect, useMemo, useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS, Game } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, avg, normalizeHorario, parseDate } from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";

const WEEK_DAYS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const DIA_LABELS: Record<string, string> = {
  "seg.": "Segunda", "ter.": "Terça", "qua.": "Quarta",
  "qui.": "Quinta", "sex.": "Sexta", "sáb.": "Sábado", "dom.": "Domingo",
};

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

function SeasonFilter({ value, onChange, nullLabel = "Todas" }: {
  value: number | null; onChange: (v: number | null) => void; nullLabel?: string;
}) {
  return (
    <div className="flex gap-1">
      {([null, 2025, 2026] as (number | null)[]).map((v) => (
        <button key={v ?? "all"} onClick={() => onChange(v)}
          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
            value === v ? "border-white/25 bg-white/10 text-white" : "border-white/[0.07] text-white/30 hover:text-white/50"
          }`}>
          {v == null ? nullLabel : v}
        </button>
      ))}
    </div>
  );
}

// Season toggle pill (2025 ↔ 2026)
function SeasonToggle({ value, onChange }: { value: 2025 | 2026; onChange: (s: 2025 | 2026) => void }) {
  return (
    <div className="flex items-center bg-white/[0.06] border border-white/[0.08] rounded-full p-0.5">
      {([2025, 2026] as const).map((yr) => (
        <button key={yr} onClick={() => onChange(yr)}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
          style={value === yr
            ? { background: SEASON_COLORS[yr] + "35", color: SEASON_COLORS[yr], boxShadow: `0 0 10px ${SEASON_COLORS[yr]}30` }
            : { color: "rgba(255,255,255,0.3)" }}>
          {yr}
        </button>
      ))}
    </div>
  );
}

// ─── Detentor Avg Bar ──────────────────────────────────────────────────────────

function DetentorAvgBar({ season, onSeasonChange }: { season: number | null; onSeasonChange: (s: number | null) => void }) {
  const stats = useMemo(() => {
    const filtered = season ? games.filter((g) => g.ano === season) : games;
    return DETENTORES.flatMap((d) => {
      const dGames = filtered.filter((g) => g.detentor === d && getMetric(g) !== null);
      if (!dGames.length) return [];
      return [{ detentor: d, avgVal: avg(dGames.map((g) => getMetric(g) as number)) }];
    });
  }, [season]);

  return (
    <div className="mb-2">
      <div className="flex items-center gap-3 mb-3">
        <SeasonFilter value={season} onChange={onSeasonChange} nullLabel="Geral" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 8 }}>
        {stats.map(({ detentor: d, avgVal }) => (
          <div key={d} className="glass rounded-xl px-3 py-3 border border-white/[0.07] flex flex-col items-center gap-1.5">
            {LOGOS[d] ? (
              <img src={LOGOS[d]} alt={d} className="h-6 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)", opacity: 0.75, maxWidth: 80 }} />
            ) : (
              <span className="text-sm font-semibold" style={{ color: DETENTOR_COLORS[d] || "#9ca3af" }}>{d}</span>
            )}
            <div className="w-full h-px bg-white/[0.07]" />
            <span className="text-sm font-bold text-white tabular-nums">{formatMetric(d, avgVal)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

type BroadcasterInfo = { detentor: string; metric: number | null };
type MatchInDay = {
  rodada: number; ano: number;
  mandante: string; visitante: string;
  horario: string;
  broadcasters: BroadcasterInfo[];
  key: string;
};
type DayCol = { date: string; display: string; weekday: string; matches: MatchInDay[] };

function buildTimeline(season: 2025 | 2026): DayCol[] {
  const filtered = games.filter((g) => g.ano === season);
  const dayMap = new Map<string, Game[]>();
  filtered.forEach((g) => {
    if (!dayMap.has(g.data)) dayMap.set(g.data, []);
    dayMap.get(g.data)!.push(g);
  });
  const sortedDates = Array.from(dayMap.entries()).sort(([a], [b]) => parseDate(b) - parseDate(a));

  return sortedDates.map(([dateStr, dayGames]) => {
    const dateObj = parseDateObj(dateStr);
    const display = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    const weekday = WEEK_DAYS[dateObj.getDay()];

    const matchMap = new Map<string, MatchInDay>();
    dayGames.forEach((g) => {
      const mKey = `${g.rodada}|${g.mandante}|${g.visitante}`;
      if (!matchMap.has(mKey)) {
        matchMap.set(mKey, {
          rodada: g.rodada, ano: g.ano,
          mandante: g.mandante, visitante: g.visitante,
          horario: normalizeHorario(g.horario.substring(0, 5)),
          broadcasters: [], key: `${dateStr}|${mKey}`,
        });
      }
      matchMap.get(mKey)!.broadcasters.push({ detentor: g.detentor, metric: getMetric(g) });
    });

    const matches = Array.from(matchMap.values()).sort((a, b) => {
      if (b.rodada !== a.rodada) return b.rodada - a.rodada;
      return a.horario.localeCompare(b.horario);
    });

    return { date: dateStr, display, weekday, matches };
  });
}

function MatchCard({ match, isPinned, onPin }: { match: MatchInDay; isPinned: boolean; onPin: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isElevated = hovered || isPinned;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPin}
      style={{
        transform: isElevated ? "scale(1.35)" : "scale(1)",
        transformOrigin: "top center",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        boxShadow: isPinned
          ? "0 0 0 1.5px rgba(96,165,250,0.8), 0 0 20px rgba(60,100,255,0.4)"
          : isElevated
          ? "0 10px 32px rgba(0,0,0,0.7)"
          : undefined,
        cursor: "pointer",
        zIndex: isElevated ? 20 : 1,
        position: "relative",
        background: isPinned ? "rgba(10,14,30,0.85)" : undefined,
      }}
      className={`rounded-lg px-2.5 py-2 border glass ${isPinned ? "border-blue-400/70" : isElevated ? "border-white/25" : "border-white/[0.07]"}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          <TeamLogo team={match.mandante} size={18} />
          <span className="text-white/15 text-[10px] mx-0.5">×</span>
          <TeamLogo team={match.visitante} size={18} />
        </div>
        <span className="text-[10px] text-white/35 tabular-nums ml-2">{match.horario}</span>
      </div>
      {match.broadcasters.map((b) => (
        <div key={b.detentor} className="flex items-center justify-between gap-1.5 mt-1">
          <div className="h-3.5 flex items-center">
            {LOGOS[b.detentor] ? (
              <img src={LOGOS[b.detentor]} alt={b.detentor}
                className="h-3.5 w-auto object-contain max-w-[60px]"
                style={{ filter: "brightness(0) invert(1)", opacity: 0.7 }} />
            ) : (
              <span className="text-[10px] font-semibold" style={{ color: DETENTOR_COLORS[b.detentor] || "#9ca3af" }}>
                {b.detentor}
              </span>
            )}
          </div>
          <span className="text-xs font-bold text-white tabular-nums shrink-0">
            {formatMetric(b.detentor, b.metric)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Timeline({ season, onSeasonChange }: { season: 2025 | 2026; onSeasonChange: (s: 2025 | 2026) => void }) {
  const dayCols = useMemo(() => buildTimeline(season), [season]);
  const [pinnedMatches, setPinnedMatches] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      const isVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX);
      if (isVertical) {
        e.preventDefault();
        // scroll up (negative deltaY) = scroll left, scroll down = scroll right
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handlePin = (key: string) => {
    setPinnedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else if (next.size < 5) { next.add(key); }
      return next;
    });
  };

  return (
    <div className="mb-4">
      {pinnedMatches.size > 0 && (
        <div className="flex justify-end mb-2">
          <button onClick={() => setPinnedMatches(new Set())}
            className="text-[11px] text-white/30 hover:text-white/55 transition-colors border border-white/[0.07] rounded-lg px-2.5 py-1">
            Limpar {pinnedMatches.size} fixado{pinnedMatches.size > 1 ? "s" : ""}
          </button>
        </div>
      )}

      <div ref={scrollRef}
        style={{ overflowX: "auto", overflowY: "visible", scrollbarWidth: "none" } as React.CSSProperties}
        className="pb-6">
        <div style={{ display: "flex", gap: "0", minWidth: "max-content", paddingBottom: 32 }}>
          {dayCols.map((day, colIdx) => {
            const rodadaKeys = Array.from(new Set(day.matches.map((m) => `${m.rodada}-${m.ano}`)));
            const hasMultipleRodadas = rodadaKeys.length > 1;
            const rodadaGroups = new Map<string, { rodada: number; ano: number; matches: MatchInDay[] }>();
            day.matches.forEach((m) => {
              const k = `${m.rodada}-${m.ano}`;
              if (!rodadaGroups.has(k)) rodadaGroups.set(k, { rodada: m.rodada, ano: m.ano, matches: [] });
              rodadaGroups.get(k)!.matches.push(m);
            });

            return (
              <div key={day.date}
                style={{
                  width: 148, flexShrink: 0,
                  paddingRight: 14,
                  marginRight: 4,
                  borderRight: colIdx < dayCols.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  overflow: "visible",
                }}>
                <div className="text-[11px] text-white/30 px-1 mb-2 tabular-nums">
                  <span className="capitalize">{day.weekday.slice(0, 3)}</span>
                  <span className="ml-1">{day.display}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflow: "visible" }}>
                  {Array.from(rodadaGroups.values()).map((rg) => (
                    <div key={`${rg.rodada}-${rg.ano}`} style={{ overflow: "visible" }}>
                      {hasMultipleRodadas && (
                        <div className="text-[10px] text-white/20 px-1 mb-1 uppercase tracking-wider">
                          Rod. {rg.rodada}
                        </div>
                      )}
                      {rg.matches.map((match) => (
                        <div key={match.key} style={{ marginBottom: 5, position: "relative", overflow: "visible", zIndex: pinnedMatches.has(match.key) ? 20 : 1 }}>
                          <MatchCard
                            match={match}
                            isPinned={pinnedMatches.has(match.key)}
                            onPin={() => handlePin(match.key)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
        const c = clubMap.get(t)!; c.metrics.push(m); c.gc++;
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
    <div className="flex gap-1.5 flex-wrap mt-2">
      {available.map((d) => {
        const logo = LOGOS[d];
        const isActive = d === selected;
        return (
          <button key={d} onClick={() => onSelect(d)} title={d}
            className="flex items-center justify-center px-3 py-2 rounded-xl transition-all duration-200"
            style={isActive ? {
              background: "rgba(18, 55, 215, 0.70)",
              border: "1px solid rgba(60, 100, 255, 0.55)",
              boxShadow: "0 0 16px rgba(30, 70, 255, 0.35)",
            } : { border: "1px solid rgba(255,255,255,0.06)" }}>
            {logo ? (
              <img src={logo} alt={d} className="h-6 w-auto object-contain"
                style={{ filter: isActive ? "brightness(0) invert(1)" : "grayscale(1) opacity(0.4)", maxWidth: 64 }} />
            ) : (
              <span className="text-xs font-semibold" style={{ color: isActive ? "white" : (DETENTOR_COLORS[d] || "#9ca3af") + "99" }}>{d}</span>
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
  const accent = DETENTOR_COLORS[effectiveDetentor] || "#3b82f6";

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">{title}</h3>
          <SeasonFilter value={season} onChange={setSeason} />
        </div>
        <DetentorTabs available={available} selected={effectiveDetentor} onSelect={setSelectedDetentor} />
        {data && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-white/30">Média</span>
            <span className="text-lg font-bold text-white">{formatMetric(data.detentor, data.avgVal)}</span>
            <span className="text-xs text-white/25">{data.count} jogos</span>
          </div>
        )}
      </div>

      {!data ? (
        <p className="p-4 text-sm text-white/25">Sem dados para os filtros selecionados</p>
      ) : type === "top10" ? (
        <table className="w-full border-collapse">
          <tbody>
            {data.top10.map((g, idx) => (
              <tr key={idx} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="pl-4 pr-2 py-3 text-white/25 tabular-nums text-sm w-6">{idx + 1}</td>
                <td className="py-3 pr-2">
                  <div className="flex items-center gap-1.5">
                    <TeamLogo team={g.mandante} size={22} />
                    <span className="text-white/20 text-xs shrink-0">×</span>
                    <TeamLogo team={g.visitante} size={22} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-white/25">Rod. {g.rodada}</span>
                    <SeasonPill ano={g.ano} />
                  </div>
                </td>
                <td className="pr-4 py-3 text-right font-bold text-white tabular-nums whitespace-nowrap text-base">
                  {formatMetric(g.detentor, getMetric(g))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : type === "clubs" ? (
        <div>
          {data.topClubs.map((c, idx) => {
            const pct = data.topClubs[0]?.avg ? (c.avg / data.topClubs[0].avg) * 100 : 0;
            return (
              <div key={c.team} className="flex items-center border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors px-4 py-3 gap-3">
                <span className="text-sm text-white/25 tabular-nums w-5 shrink-0">{idx + 1}</span>
                <div className="w-36 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <TeamLogo team={c.team} size={16} />
                    <span className="text-sm text-white/65 truncate">{c.team}</span>
                  </div>
                  <div className="text-xs text-white/35 mt-0.5 pl-0.5">{c.count} jogos</div>
                </div>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
                </div>
                <span className="text-base font-bold text-white tabular-nums whitespace-nowrap shrink-0">
                  {formatMetric(data.detentor, c.avg)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <table className="w-full border-collapse">
          <tbody>
            {data.topSlots.map((s, idx) => (
              <tr key={`${s.dia}|${s.horario}`} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="pl-4 pr-2 py-3 text-white/25 tabular-nums text-sm w-6">{idx + 1}</td>
                <td className="py-3 pr-4">
                  <div>
                    <span className="text-sm text-white/65 capitalize">{DIA_LABELS[s.dia]?.slice(0, 3) ?? s.dia}</span>
                    <span className="text-white/25 mx-1.5">·</span>
                    <span className="text-sm text-white/50 tabular-nums">{s.horario}</span>
                  </div>
                  <div className="text-xs text-white/35 mt-0.5">{s.count} {s.count === 1 ? "jogo" : "jogos"}</div>
                </td>
                <td className="pr-4 py-3 text-right font-bold text-white tabular-nums whitespace-nowrap text-base">
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
  const [avgSeason, setAvgSeason] = useState<number | null>(null);

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Geral</h1>
        <p className="text-white/40 text-sm mt-1.5">Calendário e rankings por detentor — Brasileirão 2025 e 2026</p>
      </div>

      <DetentorAvgBar season={avgSeason} onSeasonChange={setAvgSeason} />

      <div className="mt-10 mb-4 flex items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Calendário</h2>
        <SeasonToggle value={calendarSeason} onChange={setCalendarSeason} />
        <p className="text-white/30 text-sm">Scroll vertical: ↑ esquerda · ↓ direita</p>
      </div>

      <Timeline season={calendarSeason} onSeasonChange={setCalendarSeason} />

      <div className="mt-10 pt-8 border-t border-white/[0.08] mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Rankings</h2>
        <p className="text-white/35 text-sm mb-6">Escolha o detentor dentro de cada ranking</p>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <RankingCard title="Top 10 Audiências" type="top10" />
          <RankingCard title="Top Clubes" type="clubs" />
          <RankingCard title="Top Slots" type="slots" />
        </div>
      </div>
    </div>
  );
}
