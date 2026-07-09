"use client";
import { useState, useMemo, useEffect } from "react";
import { getStoredFilters, saveFilters } from "@/lib/filterStore";
import { games, DETENTORES, DETENTOR_COLORS, SEASON_COLORS } from "@/data/games";
import { LOGOS } from "@/data/logos";
import { getMetric, formatMetric, formatAudiencia, parseDate, avg, normalizeHorario, PNT_DETENTORES } from "@/lib/stats";
import FilterDialog, { FilterState, filterSummaryText } from "@/components/FilterDialog";
import TeamLogo from "@/components/TeamLogo";
import { getConcurrentCount } from "@/data/schedule";

type SortKey = "rodada" | "metric" | "data";

const EMPTY_FILTERS: FilterState = { anos: [], dias: [], horarios: [], rodadas: [], times: [], detentores: [], concorrencia: [] };
const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];

function buildOptions(base: typeof games, filters: FilterState) {
  function cross(exclude: keyof FilterState) {
    let r = base;
    if (exclude !== "detentores" && (filters.detentores?.length ?? 0) > 0)
      r = r.filter((g) => filters.detentores!.includes(g.detentor));
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
    if (exclude !== "concorrencia" && filters.concorrencia.length)
      r = r.filter((g) => filters.concorrencia.includes(getConcurrentCount(g.data, g.horario)));
    return r;
  }
  return {
    detentores: [...DETENTORES],
    anos: Array.from(new Set(cross("anos").map((g) => g.ano))).sort(),
    dias: DIA_ORDER.filter((d) => cross("dias").some((g) => g.dia === d)),
    horarios: Array.from(new Set(cross("horarios").map((g) => normalizeHorario(g.horario.substring(0, 5))))).sort(),
    rodadas: Array.from(new Set(cross("rodadas").map((g) => g.rodada))).sort((a, b) => a - b),
    times: (() => {
      const s = new Set<string>();
      cross("times").filter((g) => getMetric(g) !== null).forEach((g) => { s.add(g.mandante); s.add(g.visitante); });
      return Array.from(s).sort();
    })(),
    concorrencia: Array.from(new Set(cross("concorrencia").map((g) => getConcurrentCount(g.data, g.horario)))).sort((a, b) => a - b),
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
      <div className="flex gap-0 items-start">
        <div className="flex-1 min-w-0">
          <ComparePanel label="Lista A" accentColor="#3b82f6" />
        </div>
        {/* Thin vertical separator */}
        <div className="w-px self-stretch mx-6" style={{ background: "rgba(var(--ink-c),0.06)" }} />
        <div className="flex-1 min-w-0">
          <ComparePanel label="Lista B" accentColor="#a855f7" />
        </div>
      </div>
    </div>
  );
}

function ComparePanel({ label, accentColor }: { label: string; accentColor: string }) {
  const [filters, setFilters] = useState<FilterState>(() => getStoredFilters("comparacoes") ?? EMPTY_FILTERS);
  useEffect(() => { saveFilters("comparacoes", filters); }, [filters]);
  const [sortKey, setSortKey] = useState<SortKey>("metric");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filterOptions = useMemo(() => buildOptions(games, filters), [filters]);

  const filtered = useMemo(() => {
    let r = games;
    if ((filters.detentores?.length ?? 0) > 0) r = r.filter((g) => filters.detentores!.includes(g.detentor));
    if (filters.anos.length) r = r.filter((g) => filters.anos.includes(g.ano));
    if (filters.dias.length) r = r.filter((g) => filters.dias.includes(g.dia));
    if (filters.horarios.length) r = r.filter((g) => filters.horarios.includes(normalizeHorario(g.horario.substring(0, 5))));
    if (filters.rodadas.length) r = r.filter((g) => filters.rodadas.includes(g.rodada));
    if (filters.times.length) r = r.filter((g) => filters.times.some((t) => g.mandante === t || g.visitante === t));
    if (filters.concorrencia.length) r = r.filter((g) => filters.concorrencia.includes(getConcurrentCount(g.data, g.horario)));

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

  const firstDet = withMetric[0]?.detentor ?? "YouTube";
  const avgAll = withMetric.length ? avg(withMetric.map((g) => g._metric as number)) : null;
  const avgAllFmt = avgAll !== null ? (isMixed ? formatAudiencia(avgAll) : formatMetric(firstDet, avgAll)) : "—";

  const statsBySeason = [2025, 2026].map((ano) => {
    const subset = withMetric.filter((g) => g.ano === ano);
    const det = subset[0]?.detentor ?? "YouTube";
    const avgVal = subset.length ? avg(subset.map((g) => g._metric as number)) : null;
    return {
      ano,
      count: filtered.filter((g) => g.ano === ano).length,
      avgFmt: avgVal !== null ? (isMixed ? formatAudiencia(avgVal) : formatMetric(det, avgVal)) : "—",
    };
  }).filter((s) => s.count > 0);

  const totalActive = (filters.detentores?.length ?? 0) + filters.anos.length + filters.dias.length +
    filters.horarios.length + filters.rodadas.length + filters.times.length + filters.concorrencia.length;

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg"
          style={{ background: accentColor + "22", color: accentColor, border: `1px solid ${accentColor}44` }}>
          {label}
        </span>
        <FilterDialog
          state={filters}
          onChange={setFilters}
          options={filterOptions}
          singleDetentor
        />
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
        {withMetric.length === 0 ? (
          <p className="text-white/25 text-xs">Nenhum jogo com dados</p>
        ) : (
          <>
            {/* Top row: label + filter summary + mixed alert */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-[10px] text-white/35 uppercase tracking-widest shrink-0">Média geral</p>
              <div className="flex items-center gap-2 min-w-0">
                {filterSummaryText(filters) && (
                  <p className="text-[9px] text-white/20 text-right leading-tight truncate" title={filterSummaryText(filters) ?? undefined}>
                    {filterSummaryText(filters)}
                  </p>
                )}
                {isMixed && (
                  <div className="flex items-center gap-1 bg-red-500/15 border border-red-500/30 rounded-md px-2 py-1 shrink-0">
                    <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <span className="text-[9px] font-semibold text-red-400 uppercase tracking-wide whitespace-nowrap">Métricas mistas</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-3xl font-bold text-white tabular-nums mb-3">{avgAllFmt}</p>

            {/* Secondary: per-season breakdown */}
            {statsBySeason.length > 0 && (
              <div className="flex items-center gap-5 pt-3 border-t border-white/[0.06]">
                {statsBySeason.map((s) => (
                  <div key={s.ano} className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: SEASON_COLORS[s.ano] }}>{s.ano}</span>
                    <span className="text-sm font-bold text-white/80 tabular-nums">{s.avgFmt}</span>
                    <span className="text-[10px] text-white/25">{s.count} jogo{s.count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07]">
        <div className="overflow-x-auto">
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10"
                style={{ background: "var(--panel-bg)", backdropFilter: "blur(12px)" }}>
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
                    <td className="px-3 py-2.5">
                      {LOGOS[g.detentor]
                        ? <img src={LOGOS[g.detentor]} alt={g.detentor} className="h-4 w-auto object-contain" />
                        : <span className="text-xs" style={{ color: DETENTOR_COLORS[g.detentor] || "#9ca3af" }}>{g.detentor}</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold tabular-nums"
                      style={{ color: SEASON_COLORS[g.ano] || "rgba(var(--ink-c),0.30)" }}>
                      {g.ano}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-white/40 tabular-nums">{g.rodada}</td>
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
                    <td className="px-3 py-2.5 text-white/40 text-xs capitalize">{g.dia}</td>
                    <td className="px-3 py-2.5 text-white/40 text-xs tabular-nums">
                      {normalizeHorario(g.horario.substring(0, 5))}
                    </td>
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
