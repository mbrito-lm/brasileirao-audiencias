"use client";
import { useState, useMemo, useEffect } from "react";
import { detentoresState } from "@/lib/detentoresState";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS, AMAZON_EXTRA_METRICS, YOUTUBE_EXTRA_METRICS, RECORD_EXTRA_METRICS, GLOBO_EXTRA_METRICS, globoKey } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getChartData, mediaDetentor, formatMetric, metricLabel, getMetric, PNT_DETENTORES, TOGGLE_DETENTORES, MetricMode, normalizeHorario } from "@/lib/stats";
import AudienciaBarChart, { LockedDot, RodadaHoverData } from "@/components/AudienciaBarChart";
import BreakdownTables from "@/components/BreakdownTables";
import GamesTable from "@/components/GamesTable";
import TeamLogo from "@/components/TeamLogo";
import { ALL_SCHEDULE } from "@/data/schedule";

const OUTLIER_THRESHOLD = 0.65;

function isOutlierVal(val: number, avg: number) {
  return avg > 0 && Math.abs((val - avg) / avg) > OUTLIER_THRESHOLD;
}

const LISTA_COMPLETA = "__lista__";

export default function DetentoresPage() {
  const [activeTab, setActiveTab] = useState<string>(() => detentoresState.getTab() ?? DETENTORES[0]);
  const [mode, setMode] = useState<MetricMode>(() => detentoresState.getMode() ?? "pontos");
  // Persiste aba/modo para o "voltar" restaurar a seleção (zera no F5).
  useEffect(() => { detentoresState.setTab(activeTab); }, [activeTab]);
  useEffect(() => { detentoresState.setMode(mode); }, [mode]);
  const [hoveredDot, setHoveredDot] = useState<LockedDot | null>(null);
  const [lockedDots, setLockedDots] = useState<LockedDot[]>([]);
  const [rodadaHover, setRodadaHover] = useState<RodadaHoverData | null>(null);

  const isListaCompleta = activeTab === LISTA_COMPLETA;
  const detentor = isListaCompleta ? null : activeTab;
  // Modo (pontos/espectadores) só se aplica às emissoras com toggle.
  const canToggle = detentor ? TOGGLE_DETENTORES.has(detentor) : false;
  const effMode: MetricMode | undefined = canToggle ? mode : undefined;
  const isPnt = canToggle ? mode === "pontos" : (detentor ? PNT_DETENTORES.has(detentor) : false);

  // Memoizados para não recalcular a cada hover no gráfico (evita travamento).
  const filteredGames = useMemo(() => detentor ? games.filter((g) => g.detentor === detentor) : games, [detentor]);
  const chartData = useMemo(() => detentor ? getChartData(games, detentor, effMode) : [], [detentor, effMode]);
  const gamesWithMetric = useMemo(() => filteredGames.filter((g) => getMetric(g, effMode) !== null), [filteredGames, effMode]);
  const globalAvg = useMemo(() => detentor ? mediaDetentor(games, detentor, effMode) : null, [detentor, effMode]);
  const maxGame = useMemo(() => gamesWithMetric.reduce(
    (best, g) => (!best || (getMetric(g, effMode) ?? 0) > (getMetric(best, effMode) ?? 0) ? g : best),
    null as typeof gamesWithMetric[0] | null
  ), [gamesWithMetric, effMode]);

  function getGameInfo(rodada: number, season: number, teams?: { mandante: string; visitante: string }[]) {
    const candidates = filteredGames.filter((g) => g.rodada === rodada && g.ano === season);
    const game = teams?.[0]
      ? candidates.find((g) => g.mandante === teams[0].mandante && g.visitante === teams[0].visitante) ?? candidates[0]
      : candidates[0];
    if (!game) return {};
    return { dia: game.dia, horario: normalizeHorario(game.horario.substring(0, 5)) };
  }

  const handleDotHover = (d: LockedDot | null) => {
    if (!d) { setHoveredDot(null); return; }
    setHoveredDot({ ...d, ...getGameInfo(d.rodada, d.season, d.teams) });
  };

  const handleDotClick = (d: LockedDot) => {
    const enriched: LockedDot = { ...d, ...getGameInfo(d.rodada, d.season, d.teams) };
    setLockedDots((prev) => {
      const alreadyIdx = prev.findIndex((ld) => ld.rodada === d.rodada && ld.season === d.season);
      if (alreadyIdx >= 0) return prev.filter((_, i) => i !== alreadyIdx);
      if (prev.length >= 2) return [prev[1], enriched];
      return [...prev, enriched];
    });
  };

  function mkRodadaCard(rh: RodadaHoverData, season: 2025 | 2026): LockedDot | null {
    const val = season === 2025 ? rh.v25 : rh.v26;
    const teams = season === 2025 ? rh.teams25 : rh.teams26;
    const avgV = season === 2025 ? rh.avg2025 : rh.avg2026;
    if (val === null) return null;
    return { rodada: rh.rodada, season, val, teams, isOutlier: isOutlierVal(val, avgV), ...getGameInfo(rh.rodada, season, teams) };
  }

  function exportListaCompleta() {
    function timeToMin(t: string) {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    }

    const rows = games.map((g) => {
      const metric = getMetric(g);
      const horNorm = normalizeHorario(g.horario.substring(0, 5));
      const gameMin = g.horario ? timeToMin(g.horario.substring(0, 5)) : null;

      const concorrentes = gameMin !== null
        ? ALL_SCHEDULE.filter(sg => {
            if (sg.data !== g.data) return false;
            if (sg.mandante === g.mandante && sg.visitante === g.visitante) return false;
            if (!sg.hora) return false;
            return Math.abs(timeToMin(sg.hora) - gameMin) < 120;
          }).map(sg => ({
            jogo: `${sg.mandante} × ${sg.visitante}`,
            horario: sg.hora,
            detentores: sg.detentores,
            liga: sg.liga,
          }))
        : [];

      const extraMetrics =
        g.detentor === "Amazon" ? (AMAZON_EXTRA_METRICS[g.data] ?? null)
        : g.detentor === "YouTube" ? (YOUTUBE_EXTRA_METRICS[g.data] ?? null)
        : g.detentor === "Record" ? (RECORD_EXTRA_METRICS[g.data] ?? null)
        : g.detentor === "Globo" ? (GLOBO_EXTRA_METRICS[globoKey(g)] ?? null)
        : null;

      return {
        temporada: g.ano,
        rodada: g.rodada,
        fase: g.fase,
        data: g.data,
        dia: g.dia,
        horario: horNorm,
        mandante: g.mandante,
        visitante: g.visitante,
        detentor: g.detentor,
        audiencia_raw: metric,
        audiencia_formatada: formatMetric(g.detentor, metric),
        audiencia_pessoas: g.audiencia,
        pnt_pontos: g.pnt,
        metrica_tipo: PNT_DETENTORES.has(g.detentor) ? "PNT (pontos)" : "Audiência (mil)",
        extra_metrics: extraMetrics,
        concorrentes_simultaneos: concorrentes,
        total_concorrentes: concorrentes.length,
      };
    });

    const sorted = [...rows].sort((a, b) => {
      if (a.temporada !== b.temporada) return a.temporada - b.temporada;
      if (a.rodada !== b.rodada) return a.rodada - b.rodada;
      return a.horario.localeCompare(b.horario);
    });

    const output = {
      descricao: "Dados completos de audiência do Brasileirão 2025 e 2026 por detentor, com jogos concorrentes em cada slot",
      total_jogos: sorted.length,
      detentores: DETENTORES,
      notas: [
        "audiencia_raw: métrica principal bruta (pontos PNT p/ TV, espectadores p/ streaming; null se indisponível)",
        "audiencia_pessoas: audiência absoluta em espectadores (quando disponível)",
        "pnt_pontos: pontos de audiência PNT (quando disponível)",
        "metrica_tipo: 'PNT (pontos)' para Record/Premiere/SporTV, 'Audiência (mil)' para os demais",
        "extra_metrics: métricas detalhadas por detentor — Amazon (peak/streams/liveMinutes/totalViewers), YouTube (peak/alcance), Record (pontos por praça), Globo (pontos domiciliar/individual por praça)",
        "concorrentes_simultaneos: jogos no mesmo dia com início dentro de 120 minutos de diferença",
        "detentores de cada concorrente refletem os direitos de transmissão conforme o calendário",
      ],
      jogos: sorted,
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brasileirao-audiencias-completo.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const isHoveredLocked = hoveredDot
    ? lockedDots.some((ld) => ld.rodada === hoveredDot.rodada && ld.season === hoveredDot.season)
    : false;
  const displayHovered = hoveredDot && !isHoveredLocked ? hoveredDot : null;

  let slot1: LockedDot | null = null;
  let slot2: LockedDot | null = null;

  if (lockedDots.length === 0) {
    if (hoveredDot) {
      slot1 = hoveredDot;
    } else if (rodadaHover) {
      slot1 = mkRodadaCard(rodadaHover, 2025);
      slot2 = mkRodadaCard(rodadaHover, 2026);
    }
  } else {
    slot1 = lockedDots[0] ?? null;
    slot2 = lockedDots[1] ?? null;
    if (displayHovered) {
      if (!slot1) slot1 = displayHovered;
      else if (!slot2) slot2 = displayHovered;
    } else if (rodadaHover && lockedDots.length === 1 && rodadaHover.rodada !== lockedDots[0].rodada) {
      const lockedSeason = lockedDots[0].season;
      const otherSeason: 2025 | 2026 = lockedSeason === 2025 ? 2026 : 2025;
      const freeCard = mkRodadaCard(rodadaHover, otherSeason) ?? mkRodadaCard(rodadaHover, lockedSeason);
      if (freeCard && !slot2) slot2 = freeCard;
    }
  }

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Detentores</h1>
        <p className="text-white/40 text-sm mt-1.5">Evolução por rodada — Brasileirão 2025 e 2026</p>
      </div>

      {/* Detentor tabs */}
      <div className="flex gap-1.5 flex-wrap mb-8 p-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03]"
        style={{ backdropFilter: "blur(12px)" }}>
        {[...DETENTORES].map((tab) => {
          const isActive = activeTab === tab;
          const logo = LOGOS[tab];
          return (
            <button key={tab} onClick={() => { setActiveTab(tab); setLockedDots([]); setHoveredDot(null); setRodadaHover(null); }}
              title={tab}
              className="flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200"
              style={isActive ? {
                background: "rgba(18, 55, 215, 0.70)",
                border: "1px solid rgba(60, 100, 255, 0.55)",
                boxShadow: "0 0 16px rgba(30, 70, 255, 0.35)"
              } : { border: "1px solid transparent" }}>
              {logo ? (
                <img src={logo} alt={tab} className="h-8 w-auto object-contain"
                  style={{ filter: isActive ? "brightness(0) invert(1)" : "grayscale(1) opacity(0.45)" }} />
              ) : (
                <span className={`text-xs font-semibold px-1 ${isActive ? "text-white" : "text-white/35"}`}>{tab}</span>
              )}
            </button>
          );
        })}
        <div className="w-px self-stretch bg-white/[0.08] mx-1 my-1" />
        <button onClick={() => { setActiveTab(LISTA_COMPLETA); setLockedDots([]); setHoveredDot(null); setRodadaHover(null); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold"
          style={isListaCompleta ? {
            background: "rgba(18, 55, 215, 0.70)",
            border: "1px solid rgba(60, 100, 255, 0.55)",
            color: "white",
          } : { border: "1px solid transparent", color: "rgba(255,255,255,0.35)" }}>
          Lista Completa
        </button>
      </div>

      {/* Lista Completa mode */}
      {isListaCompleta && (
        <div className="glass rounded-2xl p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Lista Completa</h2>
              <p className="text-white/30 text-xs mt-0.5">Todos os jogos · todas as temporadas · todos os detentores</p>
            </div>
            <button
              onClick={exportListaCompleta}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/[0.08] border border-white/[0.10] text-white/60 hover:text-white/90">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar JSON
            </button>
          </div>
          <GamesTable games={games} allGames={games} detentor={null} showDeltas={false} />
        </div>
      )}

      {/* KPI Cards + Chart + Breakdown + Games */}
      {!isListaCompleta && (<>
      {canToggle && (
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-white/30 uppercase tracking-widest mr-1">Visualização</span>
          <div className="relative grid grid-cols-2 rounded-full border border-white/[0.10] bg-white/[0.04] p-0.5 text-xs font-semibold">
            <span aria-hidden
              className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full transition-transform duration-200 ease-out"
              style={{ background: "rgba(18,55,215,0.85)", left: 2, transform: mode === "pontos" ? "translateX(0)" : "translateX(100%)" }} />
            <button onClick={() => setMode("pontos")}
              className={`relative z-10 px-3.5 py-1.5 rounded-full text-center transition-colors ${mode === "pontos" ? "text-white" : "text-white/45 hover:text-white/70"}`}>
              Pontos (PNT)
            </button>
            <button onClick={() => setMode("espectadores")}
              className={`relative z-10 px-3.5 py-1.5 rounded-full text-center transition-colors ${mode === "espectadores" ? "text-white" : "text-white/45 hover:text-white/70"}`}>
              Espectadores
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <KpiCard label="Total de jogos" value={filteredGames.length.toString()}
          sub={`${gamesWithMetric.length} com dados`} accent="#3b82f6" />
        <KpiCard
          label={isPnt ? "PNT médio" : "Audiência média"}
          value={formatMetric(detentor ?? "", globalAvg || null, effMode)}
          sub={metricLabel(detentor ?? "", effMode)} accent={DETENTOR_COLORS[detentor ?? ""] || "#3b82f6"} />
        <KpiCard
          label="Recorde"
          value={maxGame ? formatMetric(detentor ?? "", getMetric(maxGame, effMode), effMode) : "—"}
          sub={maxGame ? `${maxGame.mandante} × ${maxGame.visitante}` : undefined}
          sub2={maxGame ? `Rod. ${maxGame.rodada} · ${maxGame.dia} · ${normalizeHorario(maxGame.horario.substring(0, 5))} · ${maxGame.ano}` : undefined}
          accent="#f59e0b" />
      </div>

      {/* Chart */}
      <div className="glass rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest whitespace-nowrap">
                {detentor} — por Rodada
              </h2>
            </div>
            <div className="mt-1.5" style={{ height: 56, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
              {slot1
                ? <GameCard dot={slot1} detentor={detentor ?? ""} mode={effMode}
                    locked={lockedDots.some((ld) => ld.rodada === slot1!.rodada && ld.season === slot1!.season)}
                    onUnlock={lockedDots.some((ld) => ld.rodada === slot1!.rodada && ld.season === slot1!.season)
                      ? () => setLockedDots((prev) => prev.filter((ld) => !(ld.rodada === slot1!.rodada && ld.season === slot1!.season)))
                      : undefined}
                  />
                : <div style={{ height: 26, flexShrink: 0 }} />
              }
              {slot2
                ? <GameCard dot={slot2} detentor={detentor ?? ""} mode={effMode}
                    locked={lockedDots.some((ld) => ld.rodada === slot2!.rodada && ld.season === slot2!.season)}
                    onUnlock={lockedDots.some((ld) => ld.rodada === slot2!.rodada && ld.season === slot2!.season)
                      ? () => setLockedDots((prev) => prev.filter((ld) => !(ld.rodada === slot2!.rodada && ld.season === slot2!.season)))
                      : undefined}
                  />
                : <div style={{ height: 26, flexShrink: 0 }} />
              }
            </div>
            <p className="text-white/30 text-xs mt-0.5">
              {isPnt ? "Pontos PNT por rodada" : "Média de espectadores individuais"}
            </p>
          </div>
          {detentor && LOGOS[detentor] && (() => {
            const color = DETENTOR_COLORS[detentor] || "#3b82f6";
            const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
            const lr = Math.min(255, Math.round(r + (255-r)*0.30));
            const lg = Math.min(255, Math.round(g + (255-g)*0.30));
            const lb = Math.min(255, Math.round(b + (255-b)*0.30));
            const lighter = `#${lr.toString(16).padStart(2,"0")}${lg.toString(16).padStart(2,"0")}${lb.toString(16).padStart(2,"0")}`;
            return (
              <div className="flex-shrink-0 ml-4" style={{
                background: color,
                border: `1px solid ${lighter}`,
                borderRadius: 14,
                padding: "10px 16px",
              }}>
                <img src={LOGOS[detentor]} alt={detentor}
                  className="h-14 w-auto object-contain"
                  style={{ filter: "brightness(0) invert(1)", opacity: 0.95 }} />
              </div>
            );
          })()}
        </div>
        <AudienciaBarChart
          data={chartData}
          isPnt={isPnt}
          onDotHover={handleDotHover}
          onDotClick={handleDotClick}
          onRodadaHover={setRodadaHover}
          lockedDots={lockedDots}
        />
      </div>

      <BreakdownTables games={filteredGames} detentor={detentor ?? ""} mode={effMode} />

      <div className="glass rounded-2xl p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Todos os Jogos</h2>
            <p className="text-white/30 text-xs mt-0.5">
              Clique nas colunas para ordenar · passe o mouse nos Δ para detalhes
            </p>
          </div>
        </div>
        <GamesTable games={filteredGames} allGames={games} detentor={detentor} showDeltas={false} mode={effMode} />
      </div>
      </>)}
    </div>
  );
}

function Sep() {
  return <div className="w-px self-stretch bg-white/[0.08] my-[5px] shrink-0" />;
}

function GameCard({ dot, detentor, locked, onUnlock, mode }: {
  dot: LockedDot; detentor: string; locked?: boolean; onUnlock?: () => void; mode?: MetricMode;
}) {
  const color = SEASON_COLORS[dot.season];
  const team = dot.teams[0];
  const dayStr = dot.dia ? dot.dia.slice(0, 1).toUpperCase() + dot.dia.slice(1, 3) : null;
  const timeStr = dot.horario ?? null;

  return (
    <div className="h-[26px] flex items-center w-fit text-xs border border-white/[0.10] rounded-lg bg-white/[0.04] overflow-hidden">
      <div className="w-6 flex items-center justify-center shrink-0 text-white/25">
        {locked && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
          </svg>
        )}
      </div>
      <Sep />
      <div className="w-[52px] flex items-center justify-center shrink-0 text-white/35 tabular-nums">Rod. {dot.rodada}</div>
      <Sep />
      <div className="w-9 flex items-center justify-center shrink-0 font-bold" style={{ color }}>{dot.season}</div>
      <Sep />
      <div className="w-[82px] flex items-center shrink-0 px-2">
        {dayStr && timeStr ? (
          <><span className="w-[26px] text-right text-white/40">{dayStr}</span><span className="text-white/20 px-[5px]">·</span><span className="text-left text-white/40 tabular-nums">{timeStr}</span></>
        ) : timeStr ? (
          <span className="text-white/40 tabular-nums">{timeStr}</span>
        ) : (
          <span className="mx-auto text-white/15">—</span>
        )}
      </div>
      <Sep />
      <div className="flex items-center gap-1 px-2 py-1 shrink-0">
        {team
          ? <><TeamLogo team={team.mandante} size={14} /><span className="text-white/20 text-[10px]">vs</span><TeamLogo team={team.visitante} size={14} /></>
          : <span className="text-white/20">—</span>
        }
      </div>
      <Sep />
      <div className="min-w-[52px] flex items-center justify-end shrink-0 font-bold text-white py-1.5 px-2 whitespace-nowrap">
        {formatMetric(detentor, dot.val, mode)}
      </div>
      <Sep />
      <div className="w-[46px] flex items-center justify-center shrink-0 font-semibold uppercase tracking-wide py-1.5"
        style={{ color, fontSize: 9 }}>
        {dot.isOutlier ? "outlier" : ""}
      </div>
      <Sep />
      <div className="w-6 flex items-center justify-center shrink-0 py-1.5">
        {onUnlock ? <button onClick={onUnlock} className="text-white/25 hover:text-white/60 transition-colors leading-none">✕</button> : null}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, sub2, accent }: {
  label: string; value: string; sub?: string; sub2?: string; accent?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${accent || "#3b82f6"}, transparent 70%)` }} />
      <p className="text-white/35 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1 truncate">{sub}</p>}
      {sub2 && <p className="text-white/25 text-xs mt-0.5 truncate">{sub2}</p>}
    </div>
  );
}
