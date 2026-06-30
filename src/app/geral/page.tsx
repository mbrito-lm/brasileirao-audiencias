"use client";
import { useState } from "react";
import { games, DETENTORES, DETENTOR_COLORS } from "@/data/games";
import { getChartData, mediaDetentor, formatAudiencia } from "@/lib/stats";
import AudienciaBarChart from "@/components/AudienciaBarChart";
import GamesTable from "@/components/GamesTable";

const TABS = ["Geral", ...DETENTORES] as const;

export default function GeralPage() {
  const [activeTab, setActiveTab] = useState<string>("Geral");

  const detentor = activeTab === "Geral" ? null : activeTab;
  const filteredGames = detentor ? games.filter((g) => g.detentor === detentor) : games;
  const chartData = getChartData(games, detentor);

  const gamesWithAud = filteredGames.filter((g) => g.audiencia !== null);
  const totalGames = gamesWithAud.length;
  const globalAvg = detentor ? mediaDetentor(games, detentor) : 0;
  const maxGame = gamesWithAud.reduce(
    (best, g) => (!best || (g.audiencia ?? 0) > (best.audiencia ?? 0) ? g : best),
    null as typeof gamesWithAud[0] | null
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audiências</h1>
        <p className="text-gray-400 text-sm mt-1">
          Evolução das audiências por rodada — Brasileirão 2025 e 2026
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-6 bg-[#111827] rounded-xl p-1 border border-[#1f2937]">
        {TABS.map((tab) => {
          const color = tab === "Geral" ? undefined : DETENTOR_COLORS[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#1f2937] text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {color && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}
              {tab}
            </button>
          );
        })}
      </div>

      {/* KPI cards */}
      {detentor && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total de jogos" value={totalGames.toString()} />
          <KpiCard label="Média geral" value={formatAudiencia(globalAvg)} />
          <KpiCard
            label="Maior audiência"
            value={maxGame ? formatAudiencia(maxGame.audiencia) : "—"}
            sub={maxGame ? `${maxGame.mandante} vs ${maxGame.visitante}` : undefined}
          />
          <KpiCard
            label="Temporada atual"
            value={filteredGames.some((g) => g.ano === 2026) ? "2026 em andamento" : "2025"}
          />
        </div>
      )}

      {/* Chart */}
      <div className="bg-[#111827] rounded-xl border border-[#1f2937] p-5 mb-2">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          Audiência média por rodada
        </h2>
        <AudienciaBarChart data={chartData} />
        {detentor && filteredGames.some((g) => g.ano === 2026 && g.audiencia === null) && (
          <p className="text-xs text-gray-500 mt-2">
            * Jogos de 2026 do {detentor} sem dados de audiência individual não são exibidos no gráfico
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#111827] rounded-xl border border-[#1f2937] p-5 mt-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          Todos os jogos
        </h2>
        <GamesTable games={filteredGames} allGames={games} detentor={detentor} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
