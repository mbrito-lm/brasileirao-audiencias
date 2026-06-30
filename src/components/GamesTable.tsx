"use client";
import { useState, useMemo } from "react";
import { Game } from "@/data/games";
import {
  mediaDetentor, mediaDiaHorario, mediaTimes,
  deltaPercent, formatAudiencia, formatDelta, deltaClass, parseDate,
} from "@/lib/stats";

type SortKey = "data" | "rodada" | "audiencia" | "deltaDet" | "deltaSlot" | "deltaTimes";

const DELTA_TIPS: Record<string, string> = {
  deltaDet: "Diferença % em relação à audiência média de todos os jogos deste detentor",
  deltaSlot: "Diferença % em relação à média deste detentor no mesmo dia e horário",
  deltaTimes: "Diferença % em relação à média histórica combinada dos dois times envolvidos neste detentor",
};

interface Props { games: Game[]; allGames: Game[]; detentor: string | null }

export default function GamesTable({ games, allGames, detentor }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tooltip, setTooltip] = useState<{ key: string; x: number; y: number } | null>(null);

  const enriched = useMemo(() => {
    return games.map((g) => {
      const aud = g.audiencia;
      const det = g.detentor;
      const medDet = mediaDetentor(allGames, det);
      const medSlot = mediaDiaHorario(allGames, det, g.dia, g.horario);
      const medTms = mediaTimes(allGames, det, g.mandante, g.visitante);
      return {
        ...g,
        deltaDet: aud !== null ? deltaPercent(aud, medDet) : null,
        deltaSlot: aud !== null ? deltaPercent(aud, medSlot) : null,
        deltaTimes: aud !== null ? deltaPercent(aud, medTms) : null,
        _date: parseDate(g.data),
      };
    });
  }, [games, allGames]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? enriched.filter(
          (g) =>
            g.mandante.toLowerCase().includes(q) ||
            g.visitante.toLowerCase().includes(q) ||
            g.data.includes(q) ||
            g.detentor.toLowerCase().includes(q) ||
            g.rodada.toString() === q
        )
      : enriched;

    return [...base].sort((a, b) => {
      let va: number | null, vb: number | null;
      if (sortKey === "data") { va = a._date; vb = b._date; }
      else if (sortKey === "rodada") { va = a.rodada; vb = b.rodada; }
      else if (sortKey === "audiencia") { va = a.audiencia; vb = b.audiencia; }
      else { va = a[sortKey]; vb = b[sortKey]; }

      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [enriched, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="ml-1 text-blue-400">{sortDir === "desc" ? "↓" : "↑"}</span>
    ) : (
      <span className="ml-1 text-white/15">↕</span>
    );

  return (
    <div onClick={() => setTooltip(null)}>
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Buscar por time, rodada, data..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-colors" />
        </div>
        <span className="text-xs text-white/25 tabular-nums">
          {filtered.length} jogo{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table with fixed scroll */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07]">
        <div className="overflow-x-auto">
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: "rgba(12,14,24,0.95)", backdropFilter: "blur(12px)" }}>
                <tr className="text-white/30 text-xs uppercase tracking-wider">
                  {!detentor && <th className="px-4 py-3 text-left font-medium">Detentor</th>}
                  <th className="px-4 py-3 text-left font-medium">Temporada</th>
                  <SortTh label="Rod." sortKey="rodada" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium">Jogo</th>
                  <SortTh label="Data" sortKey="data" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium">Dia</th>
                  <th className="px-4 py-3 text-left font-medium">Horário</th>
                  <SortTh label="Audiência" sortKey="audiencia" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <DeltaTh label="Δ Detentor" tipKey="deltaDet" sortKey="deltaDet" current={sortKey} dir={sortDir} onSort={handleSort} onTip={setTooltip} />
                  <DeltaTh label="Δ Slot" tipKey="deltaSlot" sortKey="deltaSlot" current={sortKey} dir={sortDir} onSort={handleSort} onTip={setTooltip} />
                  <DeltaTh label="Δ Times" tipKey="deltaTimes" sortKey="deltaTimes" current={sortKey} dir={sortDir} onSort={handleSort} onTip={setTooltip} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={detentor ? 10 : 11} className="px-4 py-12 text-center text-white/20">
                      Nenhum jogo encontrado
                    </td>
                  </tr>
                ) : (
                  filtered.map((g, i) => (
                    <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      {!detentor && (
                        <td className="px-4 py-3 text-xs text-white/40 font-medium">{g.detentor}</td>
                      )}
                      <td className="px-4 py-3 text-xs text-white/30">{g.ano}</td>
                      <td className="px-4 py-3 text-xs text-white/40 tabular-nums">{g.rodada}</td>
                      <td className="px-4 py-3 font-medium text-white/90 whitespace-nowrap">
                        {g.mandante} <span className="text-white/25 font-normal text-xs">vs</span> {g.visitante}
                      </td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs tabular-nums">{g.data}</td>
                      <td className="px-4 py-3 text-white/40 text-xs capitalize">{g.dia}</td>
                      <td className="px-4 py-3 text-white/40 text-xs tabular-nums">{g.horario}</td>
                      <td className="px-4 py-3 text-right font-bold text-white tabular-nums">
                        {formatAudiencia(g.audiencia)}
                      </td>
                      <DeltaCell value={g.deltaDet} />
                      <DeltaCell value={g.deltaSlot} />
                      <DeltaCell value={g.deltaTimes} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="fixed z-50 max-w-xs glass rounded-xl px-4 py-3 text-xs shadow-2xl pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: "translate(-50%, -100%)" }}
        >
          <p className="text-white/80 leading-relaxed">{DELTA_TIPS[tooltip.key]}</p>
        </div>
      )}
    </div>
  );
}

function SortTh({ label, sortKey, current, dir, onSort, right }: {
  label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void; right?: boolean;
}) {
  return (
    <th className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-white/60 transition-colors ${right ? "text-right" : "text-left"}`}
      onClick={() => onSort(sortKey)}>
      {label}
      {current === sortKey ? (
        <span className="ml-1 text-blue-400">{dir === "desc" ? "↓" : "↑"}</span>
      ) : (
        <span className="ml-1 text-white/15">↕</span>
      )}
    </th>
  );
}

function DeltaTh({ label, tipKey, sortKey, current, dir, onSort, onTip }: {
  label: string; tipKey: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  onTip: (t: { key: string; x: number; y: number } | null) => void;
}) {
  return (
    <th className="px-4 py-3 text-right font-medium cursor-pointer select-none hover:text-white/60 transition-colors"
      onClick={(e) => { e.stopPropagation(); onSort(sortKey); }}
      onMouseEnter={(e) => {
        const r = (e.target as HTMLElement).getBoundingClientRect();
        onTip({ key: tipKey, x: r.left + r.width / 2, y: r.top + window.scrollY });
      }}
      onMouseLeave={() => onTip(null)}>
      <span className="border-b border-dashed border-white/20">{label}</span>
      {current === sortKey ? (
        <span className="ml-1 text-blue-400">{dir === "desc" ? "↓" : "↑"}</span>
      ) : (
        <span className="ml-1 text-white/15">↕</span>
      )}
    </th>
  );
}

function DeltaCell({ value }: { value: number | null }) {
  const cls = deltaClass(value);
  const bg = value === null ? "" : value > 5 ? "bg-emerald-500/10" : value < -5 ? "bg-red-500/10" : "";
  return (
    <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold">
      <span className={`${cls} ${bg} px-2 py-0.5 rounded-md`}>{formatDelta(value)}</span>
    </td>
  );
}
