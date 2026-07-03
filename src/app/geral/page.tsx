"use client";
import { useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getChartData, mediaDetentor, formatMetric, metricLabel, getMetric, PNT_DETENTORES, normalizeHorario } from "@/lib/stats";
import AudienciaBarChart, { LockedDot } from "@/components/AudienciaBarChart";
import BreakdownTables from "@/components/BreakdownTables";
import GamesTable from "@/components/GamesTable";
import TeamLogo from "@/components/TeamLogo";

const TABS = ["Geral", ...DETENTORES] as const;

export default function GeralPage() {
  const [activeTab, setActiveTab] = useState<string>("Geral");
  const [hoveredDot, setHoveredDot] = useState<LockedDot | null>(null);
  const [lockedDots, setLockedDots] = useState<LockedDot[]>([]);
  const detentor = activeTab === "Geral" ? null : activeTab;
  const filteredGames = detentor ? games.filter((g) => g.detentor === detentor) : games;
  const chartData = getChartData(games, detentor);
  const isPnt = detentor ? PNT_DETENTORES.has(detentor) : false;

  const gamesWithMetric = filteredGames.filter((g) => getMetric(g) !== null);
  const globalAvg = detentor ? mediaDetentor(games, detentor) : 0;
  const maxGame = gamesWithMetric.reduce(
    (best, g) => (!best || (getMetric(g) ?? 0) > (getMetric(best) ?? 0) ? g : best),
    null as typeof gamesWithMetric[0] | null
  );

  const handleDotClick = (d: LockedDot) => {
    setLockedDots((prev) => {
      const alreadyIdx = prev.findIndex((ld) => ld.rodada === d.rodada && ld.season === d.season);
      if (alreadyIdx >= 0) return prev.filter((_, i) => i !== alreadyIdx);
      if (prev.length >= 2) return [prev[1], d];
      return [...prev, d];
    });
  };

  // Hovered dot card only shows if it's not already locked
  const isHoveredLocked = hoveredDot
    ? lockedDots.some((ld) => ld.rodada === hoveredDot.rodada && ld.season === hoveredDot.season)
    : false;
  const displayHovered = hoveredDot && !isHoveredLocked ? hoveredDot : null;

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Audiências</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Evolução por rodada — Brasileirão 2025 e 2026
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap mb-8 p-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03]"
        style={{ backdropFilter: "blur(12px)" }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const logo = tab !== "Geral" ? LOGOS[tab] : undefined;
          return (
            <button key={tab} onClick={() => { setActiveTab(tab); setLockedDots([]); setHoveredDot(null); }}
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
                <svg className={`w-5 h-5 ${isActive ? "text-white" : "text-white/35"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      {detentor && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
          <KpiCard label="Total de jogos" value={filteredGames.length.toString()}
            sub={`${gamesWithMetric.length} com dados`} accent="#3b82f6" />
          <KpiCard
            label={isPnt ? "PNT médio" : "Audiência média"}
            value={formatMetric(detentor, globalAvg || null)}
            sub={metricLabel(detentor)} accent={DETENTOR_COLORS[detentor]} />
          <KpiCard
            label="Recorde"
            value={maxGame ? formatMetric(detentor, getMetric(maxGame)) : "—"}
            sub={maxGame ? `${maxGame.mandante} × ${maxGame.visitante}` : undefined}
            sub2={maxGame ? `Rod. ${maxGame.rodada} · ${maxGame.dia} · ${normalizeHorario(maxGame.horario.substring(0, 5))} · ${maxGame.ano}` : undefined}
            accent="#f59e0b" />
        </div>
      )}

      {/* Chart */}
      <div className="glass rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest whitespace-nowrap">
                {detentor || "Visão Geral"} — por Rodada
              </h2>
            </div>
            {/* Cards area — always 2 rows tall (one per season) */}
            <div className="h-[56px] flex flex-col gap-1 justify-start mt-1.5">
              {lockedDots[0] ? (
                <GameCard dot={lockedDots[0]} detentor={detentor} locked
                  onUnlock={() => setLockedDots((prev) =>
                    prev.filter((_, i) => i !== 0)
                  )} />
              ) : displayHovered ? (
                <GameCard dot={displayHovered} detentor={detentor} />
              ) : (
                <div className="h-[26px]" />
              )}
              {lockedDots[1] ? (
                <GameCard dot={lockedDots[1]} detentor={detentor} locked
                  onUnlock={() => setLockedDots((prev) =>
                    prev.filter((_, i) => i !== 1)
                  )} />
              ) : (lockedDots[0] && displayHovered) ? (
                <GameCard dot={displayHovered} detentor={detentor} />
              ) : (
                <div className="h-[26px]" />
              )}
            </div>
            <p className="text-white/30 text-xs mt-0.5">
              {detentor
                ? (isPnt ? "Pontos PNT por rodada" : "Média de espectadores individuais")
                : "Média de espectadores — Amazon e CazéTV"}
            </p>
          </div>
          {detentor && LOGOS[detentor] && (
            <img src={LOGOS[detentor]} alt={detentor}
              className="h-14 w-auto object-contain flex-shrink-0 ml-4"
              style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }} />
          )}
        </div>
        <AudienciaBarChart
          data={chartData}
          isPnt={isPnt}
          onDotHover={setHoveredDot}
          onDotClick={handleDotClick}
          lockedDots={lockedDots}
        />
      </div>

      {/* Breakdown tables */}
      {detentor && <BreakdownTables games={filteredGames} detentor={detentor} />}

      {/* Games table */}
      <div className="glass rounded-2xl p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">
              Todos os Jogos
            </h2>
            <p className="text-white/30 text-xs mt-0.5">
              Clique nas colunas para ordenar · passe o mouse nos Δ para detalhes
            </p>
          </div>
        </div>
        <GamesTable games={filteredGames} allGames={games} detentor={detentor} />
      </div>
    </div>
  );
}

// Vertical separator with inset (doesn't touch top/bottom border of card)
function Sep() {
  return <div className="w-px self-stretch bg-white/[0.08] my-[5px] shrink-0" />;
}

// Fixed-width columns so all cards align perfectly when stacked
// Widths: lock(28) | rod(72) | season(44) | game(86) | audiencia(60) | outlier(56) | close(28)
function GameCard({ dot, detentor, locked, onUnlock }: {
  dot: LockedDot; detentor: string | null; locked?: boolean; onUnlock?: () => void;
}) {
  const color = SEASON_COLORS[dot.season];
  const team = dot.teams[0];
  return (
    <div className="flex items-center text-xs border border-white/[0.10] rounded-lg bg-white/[0.04] overflow-hidden">
      {/* Lock icon — always same width */}
      <div className="w-7 flex items-center justify-center shrink-0 text-white/25 py-1.5">
        {locked
          ? <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
            </svg>
          : null
        }
      </div>
      <Sep />
      {/* Rodada */}
      <div className="w-[72px] px-2.5 py-1.5 text-white/35 shrink-0">Rod. {dot.rodada}</div>
      <Sep />
      {/* Season */}
      <div className="w-11 px-2.5 py-1.5 font-bold shrink-0" style={{ color }}>{dot.season}</div>
      <Sep />
      {/* Game shields */}
      <div className="w-[86px] flex items-center gap-1 px-2.5 py-1 shrink-0">
        {team
          ? <><TeamLogo team={team.mandante} size={14} /><span className="text-white/20">vs</span><TeamLogo team={team.visitante} size={14} /></>
          : <span className="text-white/20">—</span>
        }
      </div>
      <Sep />
      {/* Audiencia — always white */}
      <div className="w-[60px] px-2.5 py-1.5 font-bold text-white shrink-0">
        {formatMetric(detentor || "CazéTV", dot.val)}
      </div>
      <Sep />
      {/* Outlier — season color or blank (always same width) */}
      <div className="w-[56px] px-2.5 py-1.5 font-semibold uppercase tracking-wide shrink-0"
        style={{ color, fontSize: 9 }}>
        {dot.isOutlier ? "outlier" : ""}
      </div>
      <Sep />
      {/* Close — always same width */}
      <div className="w-7 flex items-center justify-center shrink-0 py-1.5">
        {onUnlock
          ? <button onClick={onUnlock} className="text-white/25 hover:text-white/60 transition-colors leading-none">✕</button>
          : null
        }
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, sub2, accent, valueColor }: {
  label: string; value: string; sub?: string; sub2?: string; accent?: string; valueColor?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${accent || "#3b82f6"}, transparent 70%)` }} />
      <p className="text-white/35 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: valueColor || "#ffffff" }}>{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1 truncate">{sub}</p>}
      {sub2 && <p className="text-white/25 text-xs mt-0.5 truncate">{sub2}</p>}
    </div>
  );
}
