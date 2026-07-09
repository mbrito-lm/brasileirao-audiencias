"use client";
import Link from "next/link";
import { useMemo } from "react";
import { games, SEASON_COLORS } from "@/data/games";
import { teamColor } from "@/data/teamColors";
import TeamLogo from "@/components/TeamLogo";

export default function ClubesPage() {
  // Clubes por temporada, em ordem alfabética; temporada mais recente primeiro.
  const seasons = useMemo(() => {
    const bySeason = new Map<number, Set<string>>();
    for (const g of games) {
      if (!bySeason.has(g.ano)) bySeason.set(g.ano, new Set());
      const s = bySeason.get(g.ano)!;
      s.add(g.mandante);
      s.add(g.visitante);
    }
    return Array.from(bySeason.entries())
      .map(([ano, set]) => ({ ano, clubs: Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR")) }))
      .sort((a, b) => b.ano - a.ano);
  }, []);

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Clubes</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Escolha um clube para ver o resumo de audiências e todos os seus jogos.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {seasons.map(({ ano, clubs }) => (
          <div key={ano} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-lg font-bold tabular-nums" style={{ color: SEASON_COLORS[ano] }}>{ano}</span>
              <span className="text-xs text-white/30">· {clubs.length} clubes</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {clubs.map((club) => {
                const col = teamColor(club);
                return (
                  <Link key={club} href={`/clubes/${encodeURIComponent(club)}`}
                    className="glass rounded-xl px-3 py-3 flex items-center gap-2.5 hover:bg-white/[0.06] transition-colors border-l-2 min-w-0"
                    style={{ borderLeftColor: col }}>
                    <TeamLogo team={club} size={26} />
                    <span className="text-sm font-semibold text-white/85 truncate">{club}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
