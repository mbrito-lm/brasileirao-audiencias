"use client";
import { useRef, useEffect, useMemo, useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS, Game } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, avg, normalizeHorario, parseDate } from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";

const WEEK_DAYS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex: string, amount = 0.3): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1,3),16) + (255 - parseInt(hex.slice(1,3),16)) * amount));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3,5),16) + (255 - parseInt(hex.slice(3,5),16)) * amount));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5,7),16) + (255 - parseInt(hex.slice(5,7),16)) * amount));
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

function detentorBoxStyle(color: string) {
  return {
    background: color,
    border: `1px solid ${lighten(color, 0.30)}`,
    borderRadius: 10,
    padding: "5px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties;
}
function BrandedLogo({ detentor, src, className, imgStyle }: {
  detentor: string; src: string; className?: string; imgStyle?: React.CSSProperties;
}) {
  return <img src={src} alt={detentor} className={className} style={imgStyle} />;
}

const DIA_LABELS: Record<string, string> = {
  "seg.": "Segunda", "ter.": "Terça", "qua.": "Quarta",
  "qui.": "Quinta", "sex.": "Sexta", "sáb.": "Sábado", "dom.": "Domingo",
};
const ROW_H = 56; // consistent row height across all ranking cards

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
      <div style={{ display: "flex", gap: 8 }}>
        {stats.map(({ detentor: d, avgVal }) => (
          <div key={d} className="glass rounded-xl border border-white/[0.07] flex items-center gap-3 flex-1 px-3 py-3">
            <div style={detentorBoxStyle(DETENTOR_COLORS[d] || "#666")} className="shrink-0">
              {LOGOS[d] ? (
                <BrandedLogo detentor={d} src={LOGOS[d]} className="h-7 w-auto object-contain"
                  imgStyle={{ filter: "brightness(0) invert(1)", opacity: 0.9, maxWidth: 80 }} />
              ) : (
                <span className="text-sm font-semibold" style={{ color: DETENTOR_COLORS[d] || "#9ca3af" }}>{d}</span>
              )}
            </div>
            <div className="w-px h-5 bg-white/[0.10] shrink-0" />
            <span className="text-base font-bold text-white tabular-nums">{formatMetric(d, avgVal)}</span>
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
type DayWithRodada = DayCol & { primaryRodada: number | null };
type DayGroup = { rodada: number | null; days: DayWithRodada[] };

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
        transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease",
        boxShadow: isPinned
          ? "0 0 0 1.5px rgba(96,165,250,0.85), 0 0 24px rgba(60,100,255,0.4)"
          : isElevated
          ? "0 10px 32px rgba(0,0,0,0.75)"
          : undefined,
        background: isElevated ? "rgba(10, 13, 28, 0.98)" : "rgba(18, 22, 42, 0.50)",
        backdropFilter: isElevated ? "none" : "blur(12px)",
        cursor: "pointer",
        zIndex: isElevated ? 20 : 1,
        position: "relative",
        borderRadius: 8,
        padding: "8px 10px",
        border: isPinned ? "1px solid rgba(96,165,250,0.7)" : isElevated ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          <TeamLogo team={match.mandante} size={18} />
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, margin: "0 2px" }}>×</span>
          <TeamLogo team={match.visitante} size={18} />
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums", marginLeft: 6 }}>{match.horario}</span>
      </div>
      {match.broadcasters.map((b) => (
        <div key={b.detentor} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 4 }}>
          <div style={{ height: 14, display: "flex", alignItems: "center" }}>
            {LOGOS[b.detentor] ? (
              <img src={LOGOS[b.detentor]} alt={b.detentor}
                style={{ height: 14, width: "auto", objectFit: "contain", maxWidth: 60, filter: "brightness(0) invert(1)", opacity: 0.7 }} />
            ) : (
              <span style={{ fontSize: 10, fontWeight: 600, color: DETENTOR_COLORS[b.detentor] || "#9ca3af" }}>{b.detentor}</span>
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>
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

  // Group consecutive days with the same single rodada
  const dayGroups: DayGroup[] = useMemo(() => {
    const withRodada: DayWithRodada[] = dayCols.map((day) => {
      const rodadas = new Set(day.matches.map((m) => m.rodada));
      return { ...day, primaryRodada: rodadas.size === 1 ? [...rodadas][0] : null };
    });
    const groups: DayGroup[] = [];
    withRodada.forEach((day) => {
      const last = groups[groups.length - 1];
      if (last && last.rodada !== null && last.rodada === day.primaryRodada) {
        last.days.push(day);
      } else {
        groups.push({ rodada: day.primaryRodada, days: [day] });
      }
    });
    return groups;
  }, [dayCols]);

  // Smooth scroll: RAF easing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let target = el.scrollLeft;
    let rafId: number | null = null;

    const tick = () => {
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) < 0.5) { el.scrollLeft = target; rafId = null; return; }
      el.scrollLeft += diff * 0.14;
      rafId = requestAnimationFrame(tick);
    };

    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, target + e.deltaY * 1.1));
        if (rafId === null) rafId = requestAnimationFrame(tick);
      }
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
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
        {/* paddingLeft/right gives scaled boxes room at the edges */}
        <div style={{ display: "flex", gap: 0, minWidth: "max-content", paddingLeft: 40, paddingRight: 40, paddingBottom: 40 }}>
          {dayGroups.map((group, gi) => {
            const isLastGroup = gi === dayGroups.length - 1;
            return (
              <div key={gi} style={{ display: "flex", flexDirection: "column", flexShrink: 0, paddingRight: 14, marginRight: 4, borderRight: !isLastGroup ? "1px solid rgba(255,255,255,0.08)" : "none", overflow: "visible" }}>
                {/* Rodada header spanning all days in this group */}
                <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  {group.rodada !== null ? (
                    <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.50)", textTransform: "uppercase", letterSpacing: "0.10em" }}>
                      Rodada {group.rodada}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>—</span>
                  )}
                </div>
                {/* Days in this group side by side */}
                <div style={{ display: "flex", gap: 0, overflow: "visible" }}>
                  {group.days.map((day, di) => {
                    const isLastDay = di === group.days.length - 1;
                    // When multiple rodadas in this day, group matches by rodada
                    const rodadas = new Set(day.matches.map((m) => m.rodada));
                    const hasMultipleRodadas = rodadas.size > 1;
                    const matchesByRodada = new Map<number, MatchInDay[]>();
                    day.matches.forEach((m) => {
                      if (!matchesByRodada.has(m.rodada)) matchesByRodada.set(m.rodada, []);
                      matchesByRodada.get(m.rodada)!.push(m);
                    });

                    return (
                      <div key={day.date} style={{ width: 148, flexShrink: 0, paddingRight: !isLastDay ? 10 : 0, borderRight: !isLastDay ? "1px solid rgba(255,255,255,0.04)" : "none", overflow: "visible" }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", paddingLeft: 4, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
                          <span style={{ textTransform: "capitalize" }}>{day.weekday.slice(0, 3)}</span>
                          <span style={{ marginLeft: 4 }}>{day.display}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "visible" }}>
                          {hasMultipleRodadas
                            ? Array.from(matchesByRodada.entries()).map(([rod, matches]) => (
                                <div key={rod} style={{ overflow: "visible" }}>
                                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.20)", paddingLeft: 4, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    Rod. {rod}
                                  </div>
                                  {matches.map((match) => (
                                    <div key={match.key} style={{ marginBottom: 4, overflow: "visible", position: "relative", zIndex: pinnedMatches.has(match.key) ? 20 : 1 }}>
                                      <MatchCard match={match} isPinned={pinnedMatches.has(match.key)} onPin={() => handlePin(match.key)} />
                                    </div>
                                  ))}
                                </div>
                              ))
                            : day.matches.map((match) => (
                                <div key={match.key} style={{ marginBottom: 4, overflow: "visible", position: "relative", zIndex: pinnedMatches.has(match.key) ? 20 : 1 }}>
                                  <MatchCard match={match} isPinned={pinnedMatches.has(match.key)} onPin={() => handlePin(match.key)} />
                                </div>
                              ))
                          }
                        </div>
                      </div>
                    );
                  })}
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
      .sort((a, b) => b.avg - a.avg);

    const slotMap = new Map<string, { dia: string; horario: string; metrics: number[] }>();
    dGames.forEach((g) => {
      const h = normalizeHorario(g.horario.substring(0, 5));
      const k = `${g.dia}|${h}`;
      if (!slotMap.has(k)) slotMap.set(k, { dia: g.dia, horario: h, metrics: [] });
      slotMap.get(k)!.metrics.push(getMetric(g) as number);
    });
    const topSlots = Array.from(slotMap.values())
      .map((s) => ({ ...s, avg: avg(s.metrics), count: s.metrics.length }))
      .sort((a, b) => b.avg - a.avg);

    return [{ detentor: d, count: dGames.length, avgVal: avg(dGames.map((g) => getMetric(g) as number)), top10: sorted, topClubs, topSlots }];
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
            className="flex items-center justify-center rounded-xl transition-all duration-200"
            style={isActive
              ? { ...detentorBoxStyle(DETENTOR_COLORS[d] || "#3b82f6"), boxShadow: `0 0 18px ${hexToRgba(DETENTOR_COLORS[d] || "#3b82f6", 0.40)}` }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "5px 10px" }}>
            {logo ? (
              isActive
                ? <BrandedLogo detentor={d} src={logo} className="h-6 w-auto object-contain"
                    imgStyle={{ filter: "brightness(0) invert(1)", maxWidth: 64 }} />
                : <img src={logo} alt={d} className="h-6 w-auto object-contain"
                    style={{ filter: "grayscale(1) opacity(0.4)", maxWidth: 64 }} />
            ) : (
              <span className="text-xs font-semibold" style={{ color: isActive ? "white" : (DETENTOR_COLORS[d] || "#9ca3af") + "99" }}>{d}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Scrollable content wrapper: shows 10 rows, user can scroll for more
function ScrollableRows({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxHeight: ROW_H * 10, overflowY: "auto", scrollbarWidth: "none" } as React.CSSProperties}>
      {children}
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
  const maxAvg = data?.topClubs[0]?.avg ?? 1;

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">{title}</h3>
          <SeasonFilter value={season} onChange={setSeason} />
        </div>
        <DetentorTabs available={available} selected={effectiveDetentor} onSelect={setSelectedDetentor} />
      </div>

      {!data ? (
        <p className="p-4 text-sm text-white/25">Sem dados para os filtros selecionados</p>
      ) : type === "top10" ? (
        <ScrollableRows>
          {data.top10.map((g, idx) => (
            <div key={idx} className="flex items-center border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors px-4 gap-3"
              style={{ minHeight: ROW_H }}>
              <span className="text-sm text-white/25 tabular-nums w-5 shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <TeamLogo team={g.mandante} size={22} />
                  <span className="text-white/20 text-xs shrink-0">×</span>
                  <TeamLogo team={g.visitante} size={22} />
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-white/25">Rod. {g.rodada}</span>
                  <SeasonPill ano={g.ano} />
                </div>
              </div>
              <span className="text-base font-bold text-white tabular-nums whitespace-nowrap shrink-0">
                {formatMetric(g.detentor, getMetric(g))}
              </span>
            </div>
          ))}
        </ScrollableRows>
      ) : type === "clubs" ? (
        <ScrollableRows>
          {data.topClubs.map((c, idx) => {
            const pct = maxAvg ? (c.avg / maxAvg) * 100 : 0;
            return (
              <div key={c.team} className="flex items-center border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors px-4 gap-3"
                style={{ minHeight: ROW_H }}>
                <span className="text-sm text-white/25 tabular-nums w-5 shrink-0">{idx + 1}</span>
                <div style={{ width: 132, flexShrink: 0 }}>
                  <div className="flex items-center gap-1.5">
                    <TeamLogo team={c.team} size={16} />
                    <span className="text-sm text-white/65 truncate">{c.team}</span>
                  </div>
                  <div className="text-xs text-white/35 mt-0.5 pl-0.5">{c.count} jogos</div>
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ background: hexToRgba(accent, 0.12), border: `1px solid ${lighten(accent, 0.25)}` }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }} />
                </div>
                <span className="text-base font-bold text-white tabular-nums whitespace-nowrap shrink-0">
                  {formatMetric(data.detentor, c.avg)}
                </span>
              </div>
            );
          })}
        </ScrollableRows>
      ) : (
        <ScrollableRows>
          {data.topSlots.map((s, idx) => (
            <div key={`${s.dia}|${s.horario}`} className="flex items-center border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors px-4 gap-3"
              style={{ minHeight: ROW_H }}>
              <span className="text-sm text-white/25 tabular-nums w-5 shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div>
                  <span className="text-sm text-white/65 capitalize">{DIA_LABELS[s.dia]?.slice(0, 3) ?? s.dia}</span>
                  <span className="text-white/25 mx-1.5">·</span>
                  <span className="text-sm text-white/50 tabular-nums">{s.horario}</span>
                </div>
                <div className="text-xs text-white/35 mt-0.5">{s.count} {s.count === 1 ? "jogo" : "jogos"}</div>
              </div>
              <span className="text-base font-bold text-white tabular-nums whitespace-nowrap shrink-0">
                {formatMetric(data.detentor, s.avg)}
              </span>
            </div>
          ))}
        </ScrollableRows>
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
      </div>

      <Timeline season={calendarSeason} onSeasonChange={setCalendarSeason} />

      <div className="mt-6 pt-8 border-t border-white/[0.08] mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Rankings</h2>
        <p className="text-white/35 text-sm mb-6">Escolha o detentor dentro de cada ranking — scroll para ver mais</p>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <RankingCard title="Top 10 Audiências" type="top10" />
          <RankingCard title="Top Clubes" type="clubs" />
          <RankingCard title="Top Slots" type="slots" />
        </div>
      </div>
    </div>
  );
}
