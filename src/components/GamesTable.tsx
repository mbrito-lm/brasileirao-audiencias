"use client";
import { useState, useMemo } from "react";
import { Game } from "@/data/games";
import {
  mediaDetentor, mediaDiaHorario, mediaTimes,
  getMetric, formatMetric, deltaPercent, formatDelta, deltaClass, parseDate, avg,
} from "@/lib/stats";

type SortKey = "data" | "rodada" | "metric" | "deltaDet" | "deltaSlot" | "deltaTimes";

const DELTA_TIPS: Record<string, string> = {
  deltaDet: "Diferença % em relação à média de todos os jogos deste detentor",
  deltaSlot: "Diferença % em relação à média deste detentor no mesmo dia e horário",
  deltaTimes: "Diferença % em relação à média histórica combinada dos dois times envolvidos neste detentor",
};

const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];

interface Props { games: Game[]; allGames: Game[]; detentor: string | null }

export default function GamesTable({ games, allGames, detentor }: Props) {
  // Filter state (used in detentor mode)
  const [selTimes, setSelTimes] = useState<string[]>([]);
  const [selRodadas, setSelRodadas] = useState<number[]>([]);
  const [selDias, setSelDias] = useState<string[]>([]);
  const [selHorarios, setSelHorarios] = useState<string[]>([]);
  const [selAnos, setSelAnos] = useState<number[]>([]);

  // Search (used in geral mode)
  const [search, setSearch] = useState("");

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tooltip, setTooltip] = useState<{ key: string; x: number; y: number } | null>(null);

  // Derived filter options
  const times = useMemo(() => {
    const s = new Set<string>();
    games.forEach((g) => { s.add(g.mandante); s.add(g.visitante); });
    return Array.from(s).sort();
  }, [games]);
  const rodadas = useMemo(() => Array.from(new Set(games.map((g) => g.rodada))).sort((a, b) => a - b), [games]);
  const dias = useMemo(() => {
    const s = new Set(games.map((g) => g.dia));
    return DIA_ORDER.filter((d) => s.has(d));
  }, [games]);
  const horarios = useMemo(() => Array.from(new Set(games.map((g) => g.horario.substring(0, 5)))).sort(), [games]);
  const anos = useMemo(() => Array.from(new Set(games.map((g) => g.ano))).sort(), [games]);

  function toggle<T>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  const enriched = useMemo(() => {
    return games.map((g) => {
      const metric = getMetric(g);
      const medDet = mediaDetentor(allGames, g.detentor);
      const medSlot = mediaDiaHorario(allGames, g.detentor, g.dia, g.horario);
      const medTms = mediaTimes(allGames, g.detentor, g.mandante, g.visitante);
      return {
        ...g,
        _metric: metric,
        deltaDet: metric !== null ? deltaPercent(metric, medDet) : null,
        deltaSlot: metric !== null ? deltaPercent(metric, medSlot) : null,
        deltaTimes: metric !== null ? deltaPercent(metric, medTms) : null,
        _date: parseDate(g.data),
      };
    });
  }, [games, allGames]);

  const filtered = useMemo(() => {
    let base = enriched;

    if (detentor) {
      // filter mode
      if (selTimes.length) base = base.filter((g) => selTimes.some((t) => g.mandante === t || g.visitante === t));
      if (selRodadas.length) base = base.filter((g) => selRodadas.includes(g.rodada));
      if (selDias.length) base = base.filter((g) => selDias.includes(g.dia));
      if (selHorarios.length) base = base.filter((g) => selHorarios.includes(g.horario.substring(0, 5)));
      if (selAnos.length) base = base.filter((g) => selAnos.includes(g.ano));
    } else {
      // search mode
      const q = search.trim().toLowerCase();
      if (q) base = base.filter((g) =>
        g.mandante.toLowerCase().includes(q) ||
        g.visitante.toLowerCase().includes(q) ||
        g.data.includes(q) ||
        g.detentor.toLowerCase().includes(q) ||
        g.rodada.toString() === q
      );
    }

    return [...base].sort((a, b) => {
      let va: number | null, vb: number | null;
      if (sortKey === "data") { va = a._date; vb = b._date; }
      else if (sortKey === "rodada") { va = a.rodada; vb = b.rodada; }
      else if (sortKey === "metric") { va = a._metric; vb = b._metric; }
      else { va = a[sortKey]; vb = b[sortKey]; }
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [enriched, detentor, selTimes, selRodadas, selDias, selHorarios, selAnos, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Summary per season (only in detentor mode)
  const summary = useMemo(() => {
    if (!detentor) return null;
    return [2025, 2026].map((ano) => {
      const subset = filtered.filter((g) => g.ano === ano && g._metric !== null);
      const vals = subset.map((g) => g._metric as number);
      const peak = subset.reduce((best, g) => (!best || (g._metric ?? 0) > (best._metric ?? 0) ? g : best), null as typeof subset[0] | null);
      return {
        ano,
        count: filtered.filter((g) => g.ano === ano).length,
        avgVal: vals.length ? avg(vals) : null,
        peakVal: peak ? peak._metric : null,
        peakGame: peak ? `${peak.mandante} × ${peak.visitante}` : null,
      };
    }).filter((s) => s.count > 0);
  }, [filtered, detentor]);

  const anyFilter = selTimes.length + selRodadas.length + selDias.length + selHorarios.length + selAnos.length;

  return (
    <div onClick={() => setTooltip(null)}>
      {detentor ? (
        /* ── Filter mode ── */
        <div className="space-y-4 mb-5">
          {/* Filter chips */}
          <div className="space-y-3">
            {/* Temporada */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/30 uppercase tracking-widest w-16 flex-shrink-0">Temp.</span>
              {anos.map((a) => (
                <ChipBtn key={a} label={String(a)} active={selAnos.includes(a)} onClick={() => toggle(selAnos, a, setSelAnos)} />
              ))}
            </div>
            {/* Dia */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/30 uppercase tracking-widest w-16 flex-shrink-0">Dia</span>
              {dias.map((d) => (
                <ChipBtn key={d} label={d} active={selDias.includes(d)} onClick={() => toggle(selDias, d, setSelDias)} />
              ))}
            </div>
            {/* Horário */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/30 uppercase tracking-widest w-16 flex-shrink-0">Horário</span>
              {horarios.map((h) => (
                <ChipBtn key={h} label={h} active={selHorarios.includes(h)} onClick={() => toggle(selHorarios, h, setSelHorarios)} />
              ))}
            </div>
            {/* Rodada */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/30 uppercase tracking-widest w-16 flex-shrink-0">Rodada</span>
              {rodadas.map((r) => (
                <button key={r} onClick={() => toggle(selRodadas, r, setSelRodadas)}
                  className={`w-8 h-7 text-xs rounded-lg font-medium transition-all ${
                    selRodadas.includes(r) ? "bg-blue-600 text-white" : "bg-white/[0.05] text-white/35 hover:text-white/55"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            {/* Times */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/30 uppercase tracking-widest w-16 flex-shrink-0">Time</span>
              <div className="flex flex-wrap gap-1.5">
                {times.map((t) => (
                  <ChipBtn key={t} label={t} active={selTimes.includes(t)} onClick={() => toggle(selTimes, t, setSelTimes)} />
                ))}
              </div>
            </div>
          </div>

          {/* Clear + count */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/25 tabular-nums">{filtered.length} jogo{filtered.length !== 1 ? "s" : ""}</span>
            {anyFilter > 0 && (
              <button onClick={() => { setSelTimes([]); setSelRodadas([]); setSelDias([]); setSelHorarios([]); setSelAnos([]); }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Limpar filtros ({anyFilter})
              </button>
            )}
          </div>

          {/* Summary cards */}
          {summary && summary.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {summary.map((s) => (
                <div key={s.ano} className="glass rounded-xl p-4">
                  <p className="text-xs text-white/35 uppercase tracking-widest mb-3">{s.ano} · {s.count} jogo{s.count !== 1 ? "s" : ""}</p>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-white/30 mb-0.5">Média</p>
                      <p className="text-lg font-bold text-white tabular-nums">
                        {s.avgVal !== null ? formatMetric(detentor, s.avgVal) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30 mb-0.5">Pico</p>
                      <p className="text-lg font-bold text-white tabular-nums">
                        {s.peakVal !== null ? formatMetric(detentor, s.peakVal) : "—"}
                      </p>
                      {s.peakGame && <p className="text-xs text-white/25 mt-0.5 truncate max-w-[140px]">{s.peakGame}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Search mode ── */
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
      )}

      {/* Table */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07]">
        <div className="overflow-x-auto">
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: "rgba(12,14,24,0.95)", backdropFilter: "blur(12px)" }}>
                <tr className="text-white/30 text-xs uppercase tracking-wider">
                  {!detentor && <th className="px-4 py-3 text-left font-medium">Detentor</th>}
                  <th className="px-4 py-3 text-left font-medium">Temp.</th>
                  <SortTh label="Rod." sortKey="rodada" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium">Jogo</th>
                  <SortTh label="Data" sortKey="data" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left font-medium">Dia</th>
                  <th className="px-4 py-3 text-left font-medium">Horário</th>
                  <SortTh label="Audiência" sortKey="metric" current={sortKey} dir={sortDir} onSort={handleSort} right />
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
                        {formatMetric(g.detentor, g._metric)}
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

function ChipBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
        active
          ? "bg-blue-600/30 text-blue-300 border-blue-500/40"
          : "bg-white/[0.04] text-white/40 border-white/[0.06] hover:text-white/65 hover:bg-white/[0.07]"
      }`}>
      {label}
    </button>
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
