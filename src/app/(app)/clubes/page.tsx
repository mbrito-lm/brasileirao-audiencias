"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { games, SEASON_COLORS } from "@/data/games";
import { teamColor } from "@/data/teamColors";
import TeamLogo from "@/components/TeamLogo";

const TILE = 52; // px — lado do quadrado do clube
const COLS = 4;
const GAP = 8;

export default function ClubesPage() {
  // Clubes por temporada, em ordem alfabética; temporada mais antiga à esquerda.
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
      .sort((a, b) => a.ano - b.ano);
  }, []);

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Clubes</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Escolha um clube para ver o resumo de audiências e todos os seus jogos.
        </p>
      </div>

      <div className="flex flex-wrap gap-5 items-start">
        {seasons.map(({ ano, clubs }) => (
          <div key={ano} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-bold tabular-nums" style={{ color: SEASON_COLORS[ano] }}>{ano}</span>
              <span className="text-[11px] text-white/30">· {clubs.length} clubes</span>
            </div>
            <div className="flex flex-wrap" style={{ gap: GAP, width: COLS * TILE + (COLS - 1) * GAP }}>
              {clubs.map((club) => <ClubButton key={club} club={club} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClubButton({ club }: { club: string }) {
  const [hover, setHover] = useState(false);
  const col = teamColor(club);
  return (
    <Link href={`/clubes/${encodeURIComponent(club)}`}
      title={club}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="rounded-lg border flex items-center justify-center shrink-0 transition-colors"
      style={{
        width: TILE, height: TILE,
        borderColor: hover ? col + "cc" : "rgba(var(--ink-c),0.12)",
        background: hover ? col + "22" : "transparent",
      }}>
      <TeamLogo team={club} size={32} />
    </Link>
  );
}
