"use client";
import { useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getChartData, mediaDetentor, formatMetric, metricLabel, getMetric, PNT_DETENTORES } from "@/lib/stats";
import AudienciaBarChart from "@/components/AudienciaBarChart";
import BreakdownTables from "@/components/BreakdownTables";
import GamesTable from "@/components/GamesTable";

const TABS = ["Geral", ...DETENTORES] as const;

export default function GeralPage() {
  const [activeTab, setActiveTab] = useState<string>("Geral");
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
            <button key={tab} onClick={() => setActiveTab(tab)}
              title={tab}
              className={`flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-white/10 shadow-sm border border-white/10"
                  : "hover:bg-white/[0.04]"
              }`}>
              {logo ? (
                <img src={logo} alt={tab}
                  className="h-8 w-auto object-contain"
                  style={{ filter: isActive ? "none" : "grayscale(1) opacity(0.45)" }} />
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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
            accent="#f59e0b"
          />
          <KpiCard
            label="Temporada"
            value={has2026 ? "2026" : "2025"}
            sub={has2026 ? "Em andamento" : "Encerrado"}
            accent="#10b981"
          />
        </div>
      )}

      {/* Chart */}
      <div className="glass rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-widest">
              {detentor || "Visão Geral"} — por Rodada
            </h2>
            <p className="text-white/30 text-xs mt-0.5">
              {detentor
                ? (isPnt ? "Pontos PNT por rodada" : "Média de espectadores individuais")
                : "Média de espectadores — Amazon e CazéTV"}
            </p>
          </div>
          {detentor && LOGOS[detentor] && (
            <img src={LOGOS[detentor]} alt={detentor} className="h-8 object-contain opacity-70" />
          )}
        </div>
        <AudienciaBarChart data={chartData} isPnt={isPnt} />
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

function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${accent || "#3b82f6"}, transparent 70%)` }} />
      <p className="text-white/35 text-xs font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1 truncate">{sub}</p>}
    </div>
  );
}
