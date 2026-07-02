"use client";
import { useState, useMemo } from "react";
import { games, DETENTORES, DETENTOR_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import {
  mediaDetentor, mediaDiaHorario, mediaTimes,
  getMetric, formatMetric,
  deltaPercent, formatDelta, deltaClass, parseDate,
} from "@/lib/stats";
import TeamLogo from "@/components/TeamLogo";

type SortKey = "data" | "rodada" | "metric" | "deltaDet" | "deltaSlot" | "deltaTimes";

const DIAS = ["dom.", "sáb.", "sex.", "qui.", "qua.", "ter.", "seg."];
const HORARIOS = Array.from(new Set(games.map((g) => g.horario.substring(0, 5)))).sort();
const RODADAS = Array.from(new Set(games.map((g) => g.rodada))).sort((a, b) => a - b);
const ANOS = [2025, 2026];
// Only teams that have at least one game with metric data
const ALL_TEAMS = (() => {
  const s = new Set<string>();
  games.filter((g) => getMetric(g) !== null).forEach((g) => { s.add(g.mandante); s.add(g.visitante); });
  return Array.from(s).sort();
})();

export default function ComparacoesPage() {
  const [selDetentores, setSelDetentores] = useState<string[]>([]);
  const [selAnos, setSelAnos] = useState<number[]>([]);
  const [selDias, setSelDias] = useState<string[]>([]);
  const [selHorarios, setSelHorarios] = useState<string[]>([]);
  const [selRodadas, setSelRodadas] = useState<number[]>([]);
  const [selTimes, setSelTimes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("metric");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    return games
      .filter((g) => !selDetentores.length || selDetentores.includes(g.detentor))
      .filter((g) => !selAnos.length || selAnos.includes(g.ano))
      .filter((g) => !selDias.length || selDias.includes(g.dia))
      .filter((g) => !selHorarios.length || selHorarios.includes(g.horario.substring(0, 5)))
      .filter((g) => !selRodadas.length || selRodadas.includes(g.rodada))
      .filter((g) => !selTimes.length || selTimes.some((t) => g.mandante === t || g.visitante === t))
      .filter((g) => !search.trim() || g.mandante.toLowerCase().includes(search.toLowerCase()) || g.visitante.toLowerCase().includes(search.toLowerCase()))
      .map((g) => {
        const metric = getMetric(g);
        const medDet = mediaDetentor(games, g.detentor);
        const medSlot = mediaDiaHorario(games, g.detentor, g.dia, g.horario);
        const medTms = mediaTimes(games, g.detentor, g.mandante, g.visitante);
        return {
          ...g,
          _metric: metric,
          deltaDet: metric !== null ? deltaPercent(metric, medDet) : null,
          deltaSlot: metric !== null ? deltaPercent(metric, medSlot) : null,
          deltaTimes: metric !== null ? deltaPercent(metric, medTms) : null,
          _date: parseDate(g.data),
        };
      })
      .sort((a, b) => {
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
  }, [selDetentores, selAnos, selDias, selHorarios, selRodadas, selTimes, search, sortKey, sortDir]);

  function toggle<T>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  const activeFilters = selDetentores.length + selAnos.length + selDias.length +
    selHorarios.length + selRodadas.length + selTimes.length;

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Comparações</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Compare audiências cruzando detentores, temporadas, times e horários
        </p>
      </div>

      <div className="flex gap-5">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0">
          <div className="glass rounded-2xl p-5 sticky top-20">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-widest">Filtros</h3>
              {activeFilters > 0 && (
                <button onClick={() => { setSelDetentores([]); setSelAnos([]); setSelDias([]); setSelHorarios([]); setSelRodadas([]); setSelTimes([]); setSearch(""); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Limpar ({activeFilters})
                </button>
              )}
            </div>

            <FilterSection title="Detentor">
              <div className="flex flex-wrap gap-2">
                {DETENTORES.map((d) => {
                  const active = selDetentores.includes(d);
                  return (
                    <button key={d} onClick={() => toggle(selDetentores, d, setSelDetentores)}
                      title={d}
                      className={`p-2 rounded-xl transition-all border ${
                        active ? "bg-white/10 border-white/15" : "border-transparent hover:bg-white/[0.05]"
                      }`}>
                      {LOGOS[d] ? (
                        <img src={LOGOS[d]} alt={d}
                          className="h-7 w-auto object-contain"
                          style={{ filter: active ? "none" : "grayscale(1) opacity(0.45)" }} />
                      ) : (
                        <span className="text-xs text-white/50">{d}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            <FilterSection title="Temporada">
              <div className="flex gap-2">
                {ANOS.map((a) => (
                  <ChipBtn key={a} label={String(a)} active={selAnos.includes(a)} onClick={() => toggle(selAnos, a, setSelAnos)} />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Dia">
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d) => (
                  <ChipBtn key={d} label={d} active={selDias.includes(d)} onClick={() => toggle(selDias, d, setSelDias)} />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Horário">
              <div className="flex flex-wrap gap-1.5">
                {HORARIOS.map((h) => (
                  <ChipBtn key={h} label={h} active={selHorarios.includes(h)} onClick={() => toggle(selHorarios, h, setSelHorarios)} />
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Rodada">
              <div className="flex flex-wrap gap-1">
                {RODADAS.map((r) => (
                  <button key={r} onClick={() => toggle(selRodadas, r, setSelRodadas)}
                    className={`w-8 h-7 text-xs rounded-lg font-medium transition-all ${
                      selRodadas.includes(r) ? "bg-blue-600 text-white" : "bg-white/[0.05] text-white/35 hover:text-white/60"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Time" last>
              <select multiple value={selTimes}
                onChange={(e) => setSelTimes(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="w-full h-28 bg-white/[0.05] border border-white/[0.08] rounded-xl text-sm text-white/60 p-2 focus:outline-none focus:border-blue-500/50">
                {ALL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {selTimes.length > 0 && (
                <button onClick={() => setSelTimes([])} className="text-xs text-white/30 hover:text-white/50 mt-1.5 transition-colors">
                  Limpar times
                </button>
              )}
            </FilterSection>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Buscar por time..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-colors" />
            </div>
            <span className="text-sm text-white/25 tabular-nums">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10" style={{ background: "rgba(12,14,24,0.95)", backdropFilter: "blur(12px)" }}>
                    <tr className="text-white/30 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left font-medium">Detentor</th>
                      <SortTh label="Ano" k="rodada" cur={sortKey} dir={sortDir} onSort={() => handleSort("rodada")} />
                      <SortTh label="Rod." k="rodada" cur={sortKey} dir={sortDir} onSort={() => handleSort("rodada")} />
                      <th className="px-4 py-3 text-center font-medium">Jogo</th>
                      <SortTh label="Data" k="data" cur={sortKey} dir={sortDir} onSort={() => handleSort("data")} />
                      <th className="px-4 py-3 text-left font-medium">Dia</th>
                      <th className="px-4 py-3 text-left font-medium">Horário</th>
                      <SortTh label="Audiência" k="metric" cur={sortKey} dir={sortDir} onSort={() => handleSort("metric")} right />
                      <SortTh label="Δ Detentor" k="deltaDet" cur={sortKey} dir={sortDir} onSort={() => handleSort("deltaDet")} right />
                      <SortTh label="Δ Slot" k="deltaSlot" cur={sortKey} dir={sortDir} onSort={() => handleSort("deltaSlot")} right />
                      <SortTh label="Δ Times" k="deltaTimes" cur={sortKey} dir={sortDir} onSort={() => handleSort("deltaTimes")} right />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-12 text-center text-white/20">Nenhum resultado</td></tr>
                    ) : filtered.map((g, i) => (
                      <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {LOGOS[g.detentor] && <img src={LOGOS[g.detentor]} alt={g.detentor} className="h-5 w-auto object-contain" />}
                            <span className="text-xs font-medium" style={{ color: DETENTOR_COLORS[g.detentor] || "#9ca3af" }}>{g.detentor}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/30 tabular-nums">{g.ano}</td>
                        <td className="px-4 py-3 text-xs text-white/40 tabular-nums">{g.rodada}</td>
                        {/* Jogo — centered by vs */}
                        <td className="px-4 py-3">
                          <div className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                            <div className="flex items-center gap-1.5 justify-end min-w-0">
                              <span className="text-white/90 font-medium truncate text-right text-xs">{g.mandante}</span>
                              <TeamLogo team={g.mandante} size={18} />
                            </div>
                            <span className="text-white/20 text-xs font-normal px-1 flex-shrink-0">vs</span>
                            <div className="flex items-center gap-1.5 justify-start min-w-0">
                              <TeamLogo team={g.visitante} size={18} />
                              <span className="text-white/90 font-medium truncate text-xs">{g.visitante}</span>
                            </div>
                          </div>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`${last ? "" : "border-b border-white/[0.06] pb-4 mb-4"}`}>
      <p className="text-xs font-medium text-white/30 uppercase tracking-widest mb-2.5">{title}</p>
      {children}
    </div>
  );
}

function ChipBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
        active ? "bg-blue-600/30 text-blue-300 border-blue-500/40" : "bg-white/[0.04] text-white/35 border-white/[0.06] hover:text-white/60"
      }`}>
      {label}
    </button>
  );
}

function SortTh({ label, k, cur, dir, onSort, right }: { label: string; k: SortKey; cur: SortKey; dir: "asc" | "desc"; onSort: () => void; right?: boolean }) {
  return (
    <th className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-white/60 transition-colors ${right ? "text-right" : "text-left"}`} onClick={onSort}>
      {label}
      {cur === k ? <span className="ml-1 text-blue-400">{dir === "desc" ? "↓" : "↑"}</span> : <span className="ml-1 text-white/15">↕</span>}
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
