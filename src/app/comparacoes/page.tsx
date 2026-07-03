"use client";
import { useState, useMemo } from "react";
import { games, DETENTOR_COLORS, SEASON_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, formatAudiencia, parseDate, avg, normalizeHorario, PNT_DETENTORES } from "@/lib/stats";
import FilterDialog, { FilterState } from "@/components/FilterDialog";
import TeamLogo from "@/components/TeamLogo";

type SortKey = "rodada" | "metric" | "data";

const EMPTY_FILTERS: FilterState = { anos: [], dias: [], horarios: [], rodadas: [], times: [] };
const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];

function buildOptions(base: typeof games, filters: FilterState) {
  function cross(exclude: keyof FilterState) {
    let r = base;
    if (exclude !== "anos" && filters.anos.length)
      r = r.filter((g) => filters.anos.includes(g.ano));
    if (exclude !== "dias" && filters.dias.length)
      r = r.filter((g) => filters.dias.includes(g.dia));
    if (exclude !== "horarios" && filters.horarios.length)
      r = r.filter((g) => filters.horarios.includes(normalizeHorario(g.horario.substring(0, 5))));
    if (exclude !== "rodadas" && filters.rodadas.length)
      r = r.filter((g) => filters.rodadas.includes(g.rodada));
    if (exclude !== "times" && filters.times.length)
      r = r.filter((g) => filters.times.some((t) => g.mandante === t || g.visitante === t));
    return r;
  }
  return {
    anos: Array.from(new Set(cross("anos").map((g) => g.ano))).sort(),
    dias: DIA_ORDER.filter((d) => cross("dias").some((g) => g.dia === d)),
    horarios: Array.from(new Set(cross("horarios").map((g) => normalizeHorario(g.horario.substring(0, 5))))).sort(),
    rodadas: Array.from(new Set(cross("rodadas").map((g) => g.rodada))).sort((a, b) => a - b),
    times: (() => {
      const s = new Set<string>();
      cross("times").filter((g) => getMetric(g) !== null).forEach((g) => { s.add(g.mandante); s.add(g.visitante); });
      return Array.from(s).sort();
    })(),
  };
}

export default function ComparacoesPage() {
  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Comparações</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Compare dois conjuntos de jogos com filtros independentes
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6 items-start">
        <ComparePanel label="Lista A" accentColor="#3b82f6" />
        <ComparePanel label="Lista B" accentColor="#a855f7" />
      </div>
    </div>
  );
}

function ComparePanel({ label, accentColor }: { label: string; accentColor: string }) {
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("metric");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filterOptions = useMemo(() => buildOptions(games, filters), [filters]);

  const filtered = useMemo(() => {
    let r = games;
    if (filters.anos.length) r = r.filter((g) => filters.anos.includes(g.ano));
    if (filters.dias.length) r = r.filter((g) => filters.dias.includes(g.dia));
    if (filters.horarios.length) r = r.filter((g) => filters.horarios.includes(normalizeHorario(g.horario.substring(0, 5))));
    if (filters.rodadas.length) r = r.filter((g) => filters.rodadas.includes(g.rodada));
    if (filters.times.length) r = r.filter((g) => filters.times.some((t) => g.mandante === t || g.visitante === t));

    const enriched = r.map((g) => ({ ...g, _metric: getMetric(g), _date: parseDate(g.data) }));

    return [...enriched].sort((a, b) => {
      const va = sortKey === "rodada" ? a.rodada : sortKey === "data" ? a._date : a._metric;
      const vb = sortKey === "rodada" ? b.rodada : sortKey === "data" ? b._date : b._metric;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [filters, sortKey, sortDir]);

  const withMetric = filtered.filter((g) => g._metric !== null);
  const isPntOnly = withMetric.length > 0 && withMetric.every((g) => PNT_DETENTORES.has(g.detentor));
  const isAudOnly = withMetric.length > 0 && withMetric.every((g) => !PNT_DETENTORES.has(g.detentor));
  const isMixed = withMetric.length > 0 && !isPntOnly && !isAudOnly;

  function fmtAvg(vals: number[], detentor: string) {
    if (!vals.length) return "—";
    const a = avg(vals);
    return isMixed ? formatAudiencia(a) : formatMetric(detentor, a);
  }

  const stats = [2025, 2026].map((ano) => {
    const subset = filtered.filter((g) => g.ano === ano && g._metric !== null);
    const firstDet = subset[0]?.detentor ?? "CazéTV";
    return {
      ano,
      count: filtered.filter((g) => g.ano === ano).length,
      avgVal: subset.length ? fmtAvg(subset.map((g) => g._metric as number), firstDet) : "—",
    };
  }).filter((s) => s.count > 0);

  const totalActive = filters.anos.length + filters.dias.length + filters.horarios.length +
    filters.rodadas.length + filters.times.length;

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg"
          style={{ background: accentColor + "22", color: accentColor, border: `1px solid ${accentColor}44` }}>
          {label}
        </span>
        <FilterDialog state={filters} onChange={setFilters} options={filterOptions} />
        {totalActive > 0 && (
          <button onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-white/30 hover:text-white/50 transition-colors">
            Limpar
          </button>
        )}
        <span className="ml-auto text-xs text-white/25 tabular-nums">
          {filtered.length} jogo{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stats box */}
      <div className="glass rounded-2xl p-4">
        {stats.length === 0 ? (
          <p className="text-white/25 text-xs">Nenhum jogo selecionado</p>
        ) : (
          <div className="flex items-stretch gap-6">
            {stats.map((s) => (
              <div key={s.ano}>
                <p className="text-xs mb-1.5">
                  <span className="font-bold" style={{ color: SEASON_COLORS[s.ano] }}>{s.ano}</span>
                  <span className="text-white/30"> · {s.count} jogo{s.count !== 1 ? "s" : ""}</span>
                </p>
                <p className="text-xl font-bold text-white tabular-nums">{s.avgVal}</p>
                <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">Média</p>
              </div>
            ))}
            {isMixed && (
              <p className="text-[10px] text-white/25 self-end pb-0.5">* Métricas mistas (pts + espectadores)</p>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07]">
        <div className="overflow-x-auto">
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10"
                style={{ background: "rgba(12,14,24,0.95)", backdropFilter: "blur(12px)" }}>
                <tr className="text-white/30 text-xs uppercase tracking-wider">
                  <th className="px-3 py-3 text-left font-medium">Detentor</th>
                  <th className="px-3 py-3 text-left font-medium">Temp.</th>
                  <SortTh label="Rod." k="rodada" cur={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-3 text-center font-medium">Jogo</th>
                  <th className="px-3 py-3 text-left font-medium">Dia</th>
                  <th className="px-3 py-3 text-left font-medium">Horário</th>
                  <SortTh label="Audiência" k="metric" cur={sortKey} dir={sortDir} onSort={handleSort} right />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-white/20">
                      Nenhum jogo encontrado
                    </td>
                  </tr>
                ) : filtered.map((g, i) => (
                  <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                    {/* Detentor */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {LOGOS[g.detentor]
                          ? <img src={LOGOS[g.detentor]} alt={g.detentor} className="h-4 w-auto object-contain" />
                          : <span className="text-xs" style={{ color: DETENTOR_COLORS[g.detentor] || "#9ca3af" }}>{g.detentor}</span>
                        }
                      </div>
                    </td>
                    {/* Temporada */}
                    <td className="px-3 py-2.5 text-xs font-semibold tabular-nums"
                      style={{ color: SEASON_COLORS[g.ano] || "rgba(255,255,255,0.30)" }}>
                      {g.ano}
                    </td>
                    {/* Rodada */}
                    <td className="px-3 py-2.5 text-xs text-white/40 tabular-nums">{g.rodada}</td>
                    {/* Jogo */}
                    <td className="px-3 py-2.5">
                      <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                        <div className="flex items-center gap-1 justify-end min-w-0">
                          <span className="text-white/85 font-medium truncate text-right text-xs">{g.mandante}</span>
                          <TeamLogo team={g.mandante} size={16} />
                        </div>
                        <span className="text-white/20 text-xs px-0.5 flex-shrink-0">vs</span>
                        <div className="flex items-center gap-1 justify-start min-w-0">
                          <TeamLogo team={g.visitante} size={16} />
                          <span className="text-white/85 font-medium truncate text-xs">{g.visitante}</span>
                        </div>
                      </div>
                    </td>
                    {/* Dia da semana (sem data específica) */}
                    <td className="px-3 py-2.5 text-white/40 text-xs capitalize">{g.dia}</td>
                    {/* Horário */}
                    <td className="px-3 py-2.5 text-white/40 text-xs tabular-nums">
                      {normalizeHorario(g.horario.substring(0, 5))}
                    </td>
                    {/* Audiência */}
                    <td className="px-3 py-2.5 text-right font-bold text-white tabular-nums text-xs">
                      {formatMetric(g.detentor, g._metric)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortTh({ label, k, cur, dir, onSort, right }: {
  label: string; k: SortKey; cur: SortKey; dir: "asc" | "desc"; onSort: (k: SortKey) => void; right?: boolean;
}) {
  return (
    <th
      className={`px-3 py-3 font-medium cursor-pointer select-none hover:text-white/60 transition-colors ${right ? "text-right" : "text-left"}`}
      onClick={() => onSort(k)}>
      {label}
      {cur === k
        ? <span className="ml-1 text-blue-400">{dir === "desc" ? "↓" : "↑"}</span>
        : <span className="ml-1 text-white/15">↕</span>}
    </th>
  );
}
