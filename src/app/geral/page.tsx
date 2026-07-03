"use client";
import { useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getChartData, mediaDetentor, formatMetric, metricLabel, getMetric, PNT_DETENTORES, normalizeHorario } from "@/lib/stats";
import AudienciaBarChart, { HoverData, LockedDot } from "@/components/AudienciaBarChart";
import BreakdownTables from "@/components/BreakdownTables";
import GamesTable from "@/components/GamesTable";
import TeamLogo from "@/components/TeamLogo";

const TABS = ["Geral", ...DETENTORES] as const;

export default function GeralPage() {
  const [activeTab, setActiveTab] = useState<string>("Geral");
  const [chartHover, setChartHover] = useState<HoverData | null>(null);
  const [lockedDot, setLockedDot] = useState<LockedDot | null>(null);
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
  const has2026 = filteredGames.some((g) => g.ano === 2026);

  const handleDotClick = (d: LockedDot) => {
    setLockedDot((prev) =>
      prev?.rodada === d.rodada && prev?.season === d.season ? null : d
    );
  };

  const displayHover = chartHover;

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Audiências</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Evolução por rodada — Brasileirão 2025 e 2026
        </p>
      </div>

      {/* Tabs — logo only, no text */}
      <div className="flex gap-1.5 flex-wrap mb-8 p-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03]"
        style={{ backdropFilter: "blur(12px)" }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const logo = tab !== "Geral" ? LOGOS[tab] : undefined;
          return (
            <button key={tab} onClick={() => { setActiveTab(tab); setLockedDot(null); }}
              title={tab}
              className="flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200"
              style={isActive ? {
                background: "rgba(18, 55, 215, 0.70)",
                border: "1px solid rgba(60, 100, 255, 0.55)",
                boxShadow: "0 0 16px rgba(30, 70, 255, 0.35)"
              } : { border: "1px solid transparent" }}>
              {logo ? (
                <img src={logo} alt={tab}
                  className="h-8 w-auto object-contain"
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
          <KpiCard
            label="Total de jogos"
            value={filteredGames.length.toString()}
            sub={`${gamesWithMetric.length} com dados`}
            accent="#3b82f6"
          />
          <KpiCard
            label={isPnt ? "PNT médio" : "Audiência média"}
            value={formatMetric(detentor, globalAvg || null)}
            sub={metricLabel(detentor)}
            accent={DETENTOR_COLORS[detentor]}
          />
          <KpiCard
            label="Recorde"
            value={maxGame ? formatMetric(detentor, getMetric(maxGame)) : "—"}
            sub={maxGame ? `${maxGame.mandante} × ${maxGame.visitante}` : undefined}
            sub2={maxGame ? `Rod. ${maxGame.rodada} · ${maxGame.dia} · ${normalizeHorario(maxGame.horario.substring(0, 5))} · ${maxGame.ano}` : undefined}
            accent="#f59e0b"
          />
        </div>
      )}

      {/* Chart */}
      <div className="glass rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex-1 min-w-0">
            {/* Title row — hover box sits immediately to the right of the title text */}
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest whitespace-nowrap">
                {detentor || "Visão Geral"} — por Rodada
              </h2>

              {/* Locked dot card (pinned) */}
              {lockedDot && (
                <LockedDotCard
                  dot={lockedDot}
                  detentor={detentor}
                  onUnlock={() => setLockedDot(null)}
                />
              )}

              {/* Live hover card */}
              {displayHover && (
                <HoverCard data={displayHover} detentor={detentor} />
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
              className="h-14 w-auto object-contain flex-shrink-0"
              style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }} />
          )}
        </div>
        <AudienciaBarChart
          data={chartData}
          isPnt={isPnt}
          onHoverChange={setChartHover}
          onDotClick={handleDotClick}
          lockedDot={lockedDot}
        />
      </div>

      {/* Breakdown tables — only for specific detentor */}
      {detentor && (
        <BreakdownTables games={filteredGames} detentor={detentor} />
      )}

      {/* Table */}
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

function LockedDotCard({ dot, detentor, onUnlock }: {
  dot: LockedDot; detentor: string | null; onUnlock: () => void;
}) {
  const color = SEASON_COLORS[dot.season];
  return (
    <div className="flex items-center gap-2.5 px-3 py-1 rounded-lg border border-white/15 bg-white/[0.06] text-xs">
      <svg className="w-3 h-3 text-white/30 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
      </svg>
      <span className="text-white/35">Rod. {dot.rodada}</span>
      <span className="font-bold" style={{ color }}>
        {dot.season} · {formatMetric(detentor || "CazéTV", dot.val)}
      </span>
      {dot.teams.slice(0, 1).map((t, i) => (
        <div key={i} className="flex items-center gap-1 border-l border-white/10 pl-2.5">
          {dot.isOutlier && (
            <span className="font-semibold uppercase tracking-wide mr-0.5" style={{ color, fontSize: 9 }}>outlier</span>
          )}
          <TeamLogo team={t.mandante} size={14} />
          <span className="text-white/20">vs</span>
          <TeamLogo team={t.visitante} size={14} />
        </div>
      ))}
      <button onClick={onUnlock} className="ml-1 text-white/25 hover:text-white/50 transition-colors text-xs leading-none">✕</button>
    </div>
  );
}

function HoverCard({ data, detentor, locked, onUnlock }: {
  data: HoverData; detentor: string | null; locked?: boolean; onUnlock?: () => void;
}) {
  const fmt = (v: number | null) => v !== null ? formatMetric(detentor || "CazéTV", v) : null;
  const outlierSeason = data.isOutlier25 ? 2025 : data.isOutlier26 ? 2026 : null;
  const outlierTeams = data.isOutlier25 ? data.teams25 : data.isOutlier26 ? data.teams26 : [];
  return (
    <div className={`flex items-center gap-2.5 px-3 py-1 rounded-lg border text-xs ${
      locked
        ? "border-white/15 bg-white/[0.06]"
        : "border-white/[0.08] bg-white/[0.04]"
    }`}>
      {locked && (
        <svg className="w-3 h-3 text-white/30 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
        </svg>
      )}
      <span className="text-white/35">Rod. {data.rodada}</span>
      {data.v25 !== null && fmt(data.v25) && (
        <span className="font-bold" style={{ color: SEASON_COLORS[2025] }}>
          2025 · {fmt(data.v25)}
        </span>
      )}
      {data.v26 !== null && fmt(data.v26) && (
        <span className="font-bold" style={{ color: SEASON_COLORS[2026] }}>
          2026 · {fmt(data.v26)}
        </span>
      )}
      {outlierSeason && (
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-2.5">
          <span className="font-semibold uppercase tracking-wide" style={{ color: SEASON_COLORS[outlierSeason], fontSize: 9 }}>outlier</span>
          {outlierTeams.slice(0, 1).map((t, i) => (
            <div key={i} className="flex items-center gap-1">
              <TeamLogo team={t.mandante} size={14} />
              <span className="text-white/20">vs</span>
              <TeamLogo team={t.visitante} size={14} />
            </div>
          ))}
        </div>
      )}
      {locked && onUnlock && (
        <button onClick={onUnlock} className="ml-1 text-white/25 hover:text-white/50 transition-colors text-xs leading-none">✕</button>
      )}
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
