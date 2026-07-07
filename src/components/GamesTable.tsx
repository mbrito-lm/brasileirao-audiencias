"use client";
import { useState, useMemo, useRef } from "react";
import { Game } from "@/data/games";
import {
  mediaDetentor, mediaDiaHorario, mediaTimes,
  getMetric, formatMetric, deltaPercent, formatDelta, deltaClass, parseDate, avg, normalizeHorario, MetricMode,
} from "@/lib/stats";
import { SEASON_COLORS, AMAZON_EXTRA_METRICS, YOUTUBE_EXTRA_METRICS, RECORD_EXTRA_METRICS, RECORD_PRACAS, RecordPraca, GLOBO_EXTRA_METRICS, GLOBO_PRACAS, globoKey, DETENTORES } from "@/data/games";
import FilterDialog, { FilterState, filterSummaryText } from "./FilterDialog";
import TeamLogo from "./TeamLogo";
import { ALL_SCHEDULE, ScheduleGameTagged, getConcurrentCount } from "@/data/schedule";
import { LOGOS, } from "@/data/logos";
import { DETENTOR_COLORS } from "@/data/games";

type SortKey = "data" | "rodada" | "metric" | "concorrentes" | "deltaDet" | "deltaSlot" | "deltaTimes" | "peak" | "streams" | "liveMinutes" | "totalViewers" | "ytPeak" | "ytAlcance" | "recordPraca" | "globoPraca" | "globoNPracas" | "detentor" | "ano" | "dia" | "horario" | "jogo";

type GloboPraca = (typeof GLOBO_PRACAS)[number];

function timeToMin(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

function findConcurrent(game: Game): ScheduleGameTagged[] {
  if (!game.horario) return [];
  const gameMin = timeToMin(game.horario.substring(0, 5));
  return ALL_SCHEDULE.filter(sg => {
    if (sg.data !== game.data) return false;
    if (sg.mandante === game.mandante && sg.visitante === game.visitante) return false;
    if (!sg.hora) return false;
    return Math.abs(timeToMin(sg.hora) - gameMin) < 120;
  });
}

const DELTA_TIPS: Record<string, string> = {
  deltaDet: "Diferença % em relação à média de todos os jogos deste detentor",
  deltaSlot: "Diferença % em relação à média deste detentor no mesmo dia e horário",
  deltaTimes: "Diferença % em relação à média histórica combinada dos dois times envolvidos neste detentor",
};

const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];

interface Props { games: Game[]; allGames: Game[]; detentor: string | null; showDeltas?: boolean; mode?: MetricMode }

export default function GamesTable({ games, allGames, detentor, showDeltas = true, mode }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    anos: [], dias: [], horarios: [], rodadas: [], times: [], detentores: [], concorrencia: [],
  });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tooltip, setTooltip] = useState<{ key: string; x: number; y: number } | null>(null);
  const [concPopup, setConcPopup] = useState<{ games: ScheduleGameTagged[]; x: number; y: number } | null>(null);
  const [showAmazonExtras, setShowAmazonExtras] = useState(false);
  const [showYoutubeExtras, setShowYoutubeExtras] = useState(false);
  const [showRecordExtras, setShowRecordExtras] = useState(false);
  const [sortRecordPraca, setSortRecordPraca] = useState<RecordPraca>("GSP");
  const [showGloboExtras, setShowGloboExtras] = useState(false);
  const [sortGloboPraca, setSortGloboPraca] = useState<GloboPraca>("SP");
  const isAmazon = detentor === "Amazon";
  const isYoutube = detentor === "YouTube";
  const isRecord = detentor === "Record";
  const isGlobo = detentor === "Globo";
  // valor por praça da Globo conforme o modo (domiciliar em pontos, individual em espectadores)
  const globoPracaVal = (g: Game, praca: GloboPraca): number | null => {
    const cell = GLOBO_EXTRA_METRICS[globoKey(g)]?.[praca];
    if (!cell) return null;
    return mode === "espectadores" ? cell.ind : cell.dom;
  };
  // quantidade de praças em que o jogo passou (Globo)
  const globoNPracas = (g: Game): number | null => {
    const c = GLOBO_EXTRA_METRICS[globoKey(g)];
    return c ? Object.keys(c).length : null;
  };

  const filterOptions = useMemo(() => {
    function cross(exclude: keyof FilterState) {
      let r = games;
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
      if (exclude !== "detentores" && filters.detentores?.length)
        r = r.filter((g) => filters.detentores!.includes(g.detentor));
      return r;
    }
    return {
      detentores: detentor ? undefined : Array.from(new Set(cross("detentores").map((g) => g.detentor)))
        .sort((a, b) => DETENTORES.indexOf(a as typeof DETENTORES[number]) - DETENTORES.indexOf(b as typeof DETENTORES[number])),
      anos: Array.from(new Set(cross("anos").map((g) => g.ano))).sort(),
      dias: DIA_ORDER.filter((d) => cross("dias").some((g) => g.dia === d)),
      horarios: Array.from(new Set(cross("horarios").map((g) => normalizeHorario(g.horario.substring(0, 5))))).sort(),
      rodadas: Array.from(new Set(cross("rodadas").map((g) => g.rodada))).sort((a, b) => a - b),
      times: (() => {
        const subset = cross("times").filter((g) => getMetric(g, mode) !== null);
        const s = new Set<string>();
        subset.forEach((g) => { s.add(g.mandante); s.add(g.visitante); });
        return Array.from(s).sort();
      })(),
      concorrencia: Array.from(new Set(cross("concorrencia").map((g) => getConcurrentCount(g.data, g.horario)))).sort((a, b) => a - b),
    };
  }, [games, filters, mode, detentor]);

  const enriched = useMemo(() => {
    return games.map((g) => {
      const metric = getMetric(g, mode);
      const medDet = mediaDetentor(allGames, g.detentor, mode);
      const medSlot = mediaDiaHorario(allGames, g.detentor, g.dia, g.horario, mode);
      const medTms = mediaTimes(allGames, g.detentor, g.mandante, g.visitante, mode);
      return {
        ...g,
        _metric: metric,
        deltaDet: metric !== null ? deltaPercent(metric, medDet) : null,
        deltaSlot: metric !== null ? deltaPercent(metric, medSlot) : null,
        deltaTimes: metric !== null ? deltaPercent(metric, medTms) : null,
        _date: parseDate(g.data),
        _concCount: findConcurrent(g).length,
      };
    });
  }, [games, allGames, mode]);

  const filtered = useMemo(() => {
    let base = enriched;

    const { anos, dias, horarios, rodadas, times } = filters;
    if (anos.length) base = base.filter((g) => anos.includes(g.ano));
    if (dias.length) base = base.filter((g) => dias.includes(g.dia));
    if (horarios.length) base = base.filter((g) => horarios.includes(normalizeHorario(g.horario.substring(0, 5))));
    if (rodadas.length) base = base.filter((g) => rodadas.includes(g.rodada));
    if (times.length) base = base.filter((g) => times.some((t) => g.mandante === t || g.visitante === t));
    if (filters.concorrencia.length) base = base.filter((g) => filters.concorrencia.includes(getConcurrentCount(g.data, g.horario)));

    if (!detentor) {
      if (filters.detentores?.length) base = base.filter((g) => filters.detentores!.includes(g.detentor));
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
      // Colunas de texto — comparação alfabética.
      if (sortKey === "detentor" || sortKey === "jogo") {
        const sa = sortKey === "detentor" ? a.detentor : `${a.mandante} ${a.visitante}`;
        const sb = sortKey === "detentor" ? b.detentor : `${b.mandante} ${b.visitante}`;
        const c = sa.localeCompare(sb, "pt-BR");
        return sortDir === "asc" ? c : -c;
      }
      let va: number | null, vb: number | null;
      if (sortKey === "data") { va = a._date; vb = b._date; }
      else if (sortKey === "ano") { va = a.ano; vb = b.ano; }
      else if (sortKey === "dia") { va = DIA_ORDER.indexOf(a.dia); vb = DIA_ORDER.indexOf(b.dia); }
      else if (sortKey === "horario") { va = timeToMin(normalizeHorario(a.horario.substring(0, 5))); vb = timeToMin(normalizeHorario(b.horario.substring(0, 5))); }
      else if (sortKey === "rodada") { va = a.rodada; vb = b.rodada; }
      else if (sortKey === "metric") { va = a._metric; vb = b._metric; }
      else if (sortKey === "concorrentes") { va = a._concCount; vb = b._concCount; }
      else if (sortKey === "peak" || sortKey === "streams" || sortKey === "liveMinutes" || sortKey === "totalViewers") {
        const ea = AMAZON_EXTRA_METRICS[a.data]; const eb = AMAZON_EXTRA_METRICS[b.data];
        va = ea ? ea[sortKey] : null; vb = eb ? eb[sortKey] : null;
      }
      else if (sortKey === "ytPeak") {
        va = YOUTUBE_EXTRA_METRICS[a.data]?.peak ?? null;
        vb = YOUTUBE_EXTRA_METRICS[b.data]?.peak ?? null;
      }
      else if (sortKey === "ytAlcance") {
        va = YOUTUBE_EXTRA_METRICS[a.data]?.alcance ?? null;
        vb = YOUTUBE_EXTRA_METRICS[b.data]?.alcance ?? null;
      }
      else if (sortKey === "recordPraca") {
        va = RECORD_EXTRA_METRICS[a.data]?.[sortRecordPraca] ?? null;
        vb = RECORD_EXTRA_METRICS[b.data]?.[sortRecordPraca] ?? null;
      }
      else if (sortKey === "globoPraca") {
        va = globoPracaVal(a, sortGloboPraca);
        vb = globoPracaVal(b, sortGloboPraca);
      }
      else if (sortKey === "globoNPracas") {
        va = globoNPracas(a);
        vb = globoNPracas(b);
      }
      else { va = a[sortKey]; vb = b[sortKey]; }
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [enriched, detentor, filters, search, sortKey, sortDir, sortRecordPraca, sortGloboPraca, mode]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Summary per season (detentor mode)
  const summary = useMemo(() => {
    if (!detentor) return null;
    return [2025, 2026].map((ano) => {
      const subset = filtered.filter((g) => g.ano === ano && g._metric !== null);
      const vals = subset.map((g) => g._metric as number);
      const peak = subset.reduce(
        (best, g) => (!best || (g._metric ?? 0) > (best._metric ?? 0) ? g : best),
        null as typeof subset[0] | null
      );
      return {
        ano,
        count: filtered.filter((g) => g.ano === ano).length,
        avgVal: vals.length ? avg(vals) : null,
        peakVal: peak ? peak._metric : null,
        peakGame: peak ? `${peak.mandante} × ${peak.visitante}` : null,
      };
    }).filter((s) => s.count > 0);
  }, [filtered, detentor]);

  const totalActive = filters.anos.length + filters.dias.length + filters.horarios.length +
    filters.rodadas.length + filters.times.length + (filters.detentores?.length ?? 0) + filters.concorrencia.length;

  return (
    <div onClick={() => setTooltip(null)}>
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <FilterDialog state={filters} onChange={setFilters} options={filterOptions} />
        {totalActive > 0 && (
          <button onClick={() => setFilters({ anos: [], dias: [], horarios: [], rodadas: [], times: [], detentores: [], concorrencia: [] })}
            className="text-xs text-white/30 hover:text-white/50 transition-colors">
            Limpar filtros
          </button>
        )}
        {!detentor && (
          <div className="relative flex-1 max-w-sm min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Buscar por time, detentor, rodada, data..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-colors" />
          </div>
        )}
        <span className="text-xs text-white/25 tabular-nums ml-auto">
          {filtered.length} jogo{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Season summary (detentor mode) */}
      {detentor && summary && summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {summary.map((s) => {
            const summary_text = filterSummaryText(filters);
            return (
            <div key={s.ano} className="glass rounded-xl p-4 relative">
              {summary_text && (
                <p className="absolute top-3 right-3 text-[9px] text-white/20 text-right leading-tight max-w-[55%] truncate" title={summary_text}>
                  {summary_text}
                </p>
              )}
              <p className="text-xs uppercase tracking-widest mb-3">
                <span className="font-bold" style={{ color: SEASON_COLORS[s.ano] }}>{s.ano}</span>
                <span className="text-white/35"> · {s.count} jogo{s.count !== 1 ? "s" : ""}</span>
              </p>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-white/30 mb-0.5">Média</p>
                  <p className="text-xl font-bold text-white tabular-nums">
                    {s.avgVal !== null ? formatMetric(detentor, s.avgVal, mode) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/30 mb-0.5">Pico</p>
                  <p className="text-xl font-bold text-white tabular-nums">
                    {s.peakVal !== null ? formatMetric(detentor, s.peakVal, mode) : "—"}
                  </p>
                  {s.peakGame && <p className="text-xs text-white/25 mt-0.5">{s.peakGame}</p>}
                </div>
              </div>
            </div>
          );})}
        </div>
      )}

      {/* Table */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07]">
        <div className="overflow-x-auto">
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10" style={{ background: "rgba(12,14,24,0.95)", backdropFilter: "blur(12px)" }}>
                <tr className="text-white/30 text-xs uppercase tracking-wider">
                  {!detentor && <SortTh label="Detentor" sortKey="detentor" current={sortKey} dir={sortDir} onSort={handleSort} />}
                  <SortTh label="Temp." sortKey="ano" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Rod." sortKey="rodada" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Data" sortKey="data" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Dia" sortKey="dia" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Horário" sortKey="horario" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortTh label="Jogo" sortKey="jogo" current={sortKey} dir={sortDir} onSort={handleSort} center />
                  <SortTh label="Audiência" sortKey="metric" current={sortKey} dir={sortDir} onSort={handleSort} right />
                  <SortTh label="Conc." sortKey="concorrentes" current={sortKey} dir={sortDir} onSort={handleSort} />
                  {isAmazon && (
                    <th className="pl-4 pr-1 py-3 text-center" style={{ width: 28, minWidth: 28 }}>
                      <button
                        onClick={() => setShowAmazonExtras((v) => !v)}
                        title={showAmazonExtras ? "Ocultar métricas" : "Ver métricas Amazon"}
                        className="w-5 h-5 flex items-center justify-center mx-auto transition-colors"
                        style={{ color: "rgba(255,255,255,0.70)" }}>
                        <svg viewBox="0 0 10 14" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showAmazonExtras
                            ? <polyline points="8,2 2,7 8,12" />
                            : <polyline points="2,2 8,7 2,12" />}
                        </svg>
                      </button>
                    </th>
                  )}
                  {isAmazon && showAmazonExtras && <>
                    <SortTh label="Peak" sortKey="peak" current={sortKey} dir={sortDir} onSort={handleSort} right accent="#60a5fa" />
                    <SortTh label="Streams" sortKey="streams" current={sortKey} dir={sortDir} onSort={handleSort} right accent="#60a5fa" />
                    <SortTh label="Min./Stream" sortKey="liveMinutes" current={sortKey} dir={sortDir} onSort={handleSort} right accent="#60a5fa" />
                    <SortTh label="Total Viewers" sortKey="totalViewers" current={sortKey} dir={sortDir} onSort={handleSort} right accent="#60a5fa" />
                  </>}
                  {isYoutube && (
                    <th className="pl-4 pr-1 py-3 text-center" style={{ width: 28, minWidth: 28 }}>
                      <button
                        onClick={() => setShowYoutubeExtras((v) => !v)}
                        title={showYoutubeExtras ? "Ocultar pico" : "Ver pico individual"}
                        className="w-5 h-5 flex items-center justify-center mx-auto transition-colors"
                        style={{ color: "rgba(255,255,255,0.70)" }}>
                        <svg viewBox="0 0 10 14" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showYoutubeExtras
                            ? <polyline points="8,2 2,7 8,12" />
                            : <polyline points="2,2 8,7 2,12" />}
                        </svg>
                      </button>
                    </th>
                  )}
                  {isYoutube && showYoutubeExtras && <>
                    <SortTh label="Pico" sortKey="ytPeak" current={sortKey} dir={sortDir} onSort={handleSort} right accent="#f87171" />
                    <SortTh label="Alcance" sortKey="ytAlcance" current={sortKey} dir={sortDir} onSort={handleSort} right accent="#f87171" />
                  </>}
                  {isRecord && (
                    <th className="pl-4 pr-1 py-3 text-center" style={{ width: 28, minWidth: 28 }}>
                      <button
                        onClick={() => setShowRecordExtras((v) => !v)}
                        title={showRecordExtras ? "Ocultar praças" : "Ver por praça"}
                        className="w-5 h-5 flex items-center justify-center mx-auto transition-colors"
                        style={{ color: "rgba(255,255,255,0.70)" }}>
                        <svg viewBox="0 0 10 14" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showRecordExtras ? <polyline points="8,2 2,7 8,12" /> : <polyline points="2,2 8,7 2,12" />}
                        </svg>
                      </button>
                    </th>
                  )}
                  {isRecord && showRecordExtras && RECORD_PRACAS.map(praca => {
                    const isActive = sortKey === "recordPraca" && sortRecordPraca === praca;
                    return (
                      <th key={praca}
                        className="px-3 py-3 text-right font-medium cursor-pointer select-none transition-colors whitespace-nowrap"
                        style={{ color: isActive ? "#8fa3cc" : "rgba(143,163,204,0.50)" }}
                        onClick={() => {
                          if (sortKey === "recordPraca" && sortRecordPraca === praca) {
                            setSortDir(d => d === "desc" ? "asc" : "desc");
                          } else {
                            setSortRecordPraca(praca); setSortKey("recordPraca"); setSortDir("desc");
                          }
                        }}>
                        {praca}
                        {isActive
                          ? <span className="ml-1" style={{ color: "#8fa3cc" }}>{sortDir === "desc" ? "↓" : "↑"}</span>
                          : <span className="ml-1 text-white/15">↕</span>}
                      </th>
                    );
                  })}
                  {isGlobo && <SortTh label="Praças" sortKey="globoNPracas" current={sortKey} dir={sortDir} onSort={handleSort} right />}
                  {isGlobo && (
                    <th className="pl-4 pr-1 py-3 text-center" style={{ width: 28, minWidth: 28 }}>
                      <button
                        onClick={() => setShowGloboExtras((v) => !v)}
                        title={showGloboExtras ? "Ocultar praças" : "Ver por praça"}
                        className="w-5 h-5 flex items-center justify-center mx-auto transition-colors"
                        style={{ color: "rgba(255,255,255,0.70)" }}>
                        <svg viewBox="0 0 10 14" width="8" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {showGloboExtras ? <polyline points="8,2 2,7 8,12" /> : <polyline points="2,2 8,7 2,12" />}
                        </svg>
                      </button>
                    </th>
                  )}
                  {isGlobo && showGloboExtras && GLOBO_PRACAS.map(praca => {
                    const isActive = sortKey === "globoPraca" && sortGloboPraca === praca;
                    return (
                      <th key={praca}
                        className="px-3 py-3 text-right font-medium cursor-pointer select-none transition-colors whitespace-nowrap"
                        style={{ color: isActive ? "#5bb8e6" : "rgba(91,184,230,0.50)" }}
                        onClick={() => {
                          if (sortKey === "globoPraca" && sortGloboPraca === praca) {
                            setSortDir(d => d === "desc" ? "asc" : "desc");
                          } else {
                            setSortGloboPraca(praca); setSortKey("globoPraca"); setSortDir("desc");
                          }
                        }}>
                        {praca}
                        {isActive
                          ? <span className="ml-1" style={{ color: "#5bb8e6" }}>{sortDir === "desc" ? "↓" : "↑"}</span>
                          : <span className="ml-1 text-white/15">↕</span>}
                      </th>
                    );
                  })}
                  {showDeltas && <DeltaTh label="Δ Detentor" tipKey="deltaDet" sortKey="deltaDet" current={sortKey} dir={sortDir} onSort={handleSort} onTip={setTooltip} />}
                  {showDeltas && <DeltaTh label="Δ Slot" tipKey="deltaSlot" sortKey="deltaSlot" current={sortKey} dir={sortDir} onSort={handleSort} onTip={setTooltip} />}
                  {showDeltas && <DeltaTh label="Δ Times" tipKey="deltaTimes" sortKey="deltaTimes" current={sortKey} dir={sortDir} onSort={handleSort} onTip={setTooltip} />}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={(!detentor ? 1 : 0) + 9 + (showDeltas ? 3 : 0)} className="px-4 py-12 text-center text-white/20">
                      Nenhum jogo encontrado
                    </td>
                  </tr>
                ) : (
                  filtered.map((g, i) => (
                    <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      {!detentor && (
                        <td className="px-4 py-3 text-xs text-white/40 font-medium">
                          <div className="flex items-center gap-2">
                            {LOGOS[g.detentor] && (
                              <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                style={{ background: DETENTOR_COLORS[g.detentor] || "#444" }}>
                                <img src={LOGOS[g.detentor]} alt={g.detentor}
                                  style={{ width: 12, height: 12, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
                              </span>
                            )}
                            <span>{g.detentor}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs font-semibold tabular-nums" style={{ color: SEASON_COLORS[g.ano] || "rgba(255,255,255,0.30)" }}>{g.ano}</td>
                      <td className="px-4 py-3 text-xs text-white/40 tabular-nums">{g.rodada}</td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs tabular-nums">{g.data.substring(0, 5)}</td>
                      <td className="px-4 py-3 text-white/40 text-xs capitalize">{g.dia}</td>
                      <td className="px-4 py-3 text-white/40 text-xs tabular-nums">{normalizeHorario(g.horario.substring(0, 5))}</td>
                      {/* Jogo cell — centered by "vs" */}
                      <td className="px-4 py-3" style={{ minWidth: isRecord && showRecordExtras ? 60 : 200 }}>
                        {isRecord && showRecordExtras ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <TeamLogo team={g.mandante} size={18} />
                            <span className="text-white/20 text-xs font-normal flex-shrink-0">vs</span>
                            <TeamLogo team={g.visitante} size={18} />
                          </div>
                        ) : (
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
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white tabular-nums text-base">
                        {formatMetric(g.detentor, g._metric, mode)}
                      </td>
                      <ConcurrentCell game={g} onHover={setConcPopup} />
                      {isAmazon && <td style={{ width: 24, minWidth: 24 }} />}
                      {isYoutube && <td style={{ width: 24, minWidth: 24 }} />}
                      {isYoutube && showYoutubeExtras && (() => {
                        const ex = YOUTUBE_EXTRA_METRICS[g.data];
                        const fmt = (n: number) => n.toLocaleString("pt-BR");
                        return ex ? <>
                          <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: "#fca5a5" }}>{fmt(ex.peak)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: "#fca5a5" }}>{ex.alcance != null ? fmt(ex.alcance) : <span className="text-white/15">—</span>}</td>
                        </> : <>
                          <td className="px-4 py-3 text-right text-xs text-white/15">—</td>
                          <td className="px-4 py-3 text-right text-xs text-white/15">—</td>
                        </>;
                      })()}
                      {isAmazon && showAmazonExtras && (() => {
                        const ex = AMAZON_EXTRA_METRICS[g.data];
                        const fmt = (n: number) => n.toLocaleString("pt-BR");
                        return ex ? <>
                          <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: "#93c5fd" }}>{fmt(ex.peak)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: "#93c5fd" }}>{fmt(ex.streams)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: "#93c5fd" }}>{ex.liveMinutes.toFixed(2).replace(".", ",")}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-xs" style={{ color: "#93c5fd" }}>{fmt(ex.totalViewers)}</td>
                        </> : <>
                          <td className="px-4 py-3 text-right text-xs text-white/15">—</td>
                          <td className="px-4 py-3 text-right text-xs text-white/15">—</td>
                          <td className="px-4 py-3 text-right text-xs text-white/15">—</td>
                          <td className="px-4 py-3 text-right text-xs text-white/15">—</td>
                        </>;
                      })()}
                      {isRecord && <td style={{ width: 24, minWidth: 24 }} />}
                      {isRecord && showRecordExtras && (() => {
                        const ex = RECORD_EXTRA_METRICS[g.data];
                        return RECORD_PRACAS.map(praca => {
                          const val = ex?.[praca];
                          const isActive = sortKey === "recordPraca" && sortRecordPraca === praca;
                          return val != null
                            ? <td key={praca} className="px-3 py-3 text-right tabular-nums text-xs"
                                style={{ color: isActive ? "#8fa3cc" : "rgba(143,163,204,0.55)" }}>
                                {val.toFixed(1).replace(".", ",")}
                              </td>
                            : <td key={praca} className="px-3 py-3 text-right text-xs text-white/15">—</td>;
                        });
                      })()}
                      {isGlobo && (() => {
                        const n = globoNPracas(g);
                        return <td className="px-4 py-3 text-right tabular-nums text-xs text-white/50">{n ?? <span className="text-white/15">—</span>}</td>;
                      })()}
                      {isGlobo && <td style={{ width: 24, minWidth: 24 }} />}
                      {isGlobo && showGloboExtras && GLOBO_PRACAS.map(praca => {
                        const val = globoPracaVal(g, praca);
                        const isActive = sortKey === "globoPraca" && sortGloboPraca === praca;
                        return val != null
                          ? <td key={praca} className="px-3 py-3 text-right tabular-nums text-xs"
                              style={{ color: isActive ? "#5bb8e6" : "rgba(91,184,230,0.55)" }}>
                              {val.toFixed(1).replace(".", ",")}
                            </td>
                          : <td key={praca} className="px-3 py-3 text-right text-xs text-white/15">—</td>;
                      })}
                      {showDeltas && <DeltaCell value={g.deltaDet} />}
                      {showDeltas && <DeltaCell value={g.deltaSlot} />}
                      {showDeltas && <DeltaCell value={g.deltaTimes} />}
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
      {concPopup && (
        <div
          className="fixed z-50 rounded-xl p-3 shadow-2xl pointer-events-none"
          style={{ left: concPopup.x, top: concPopup.y - 8, transform: "translate(-50%, -100%)", minWidth: 280, maxWidth: 380, background: "rgb(12,14,28)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2.5">Concorrentes</p>
          <div className="flex flex-col gap-2">
            {concPopup.games.map((sg, i) => (
              <div key={i} className="grid items-center gap-x-2" style={{ gridTemplateColumns: "40px 16px 14px 16px 40px 1fr" }}>
                {/* liga */}
                <span className={`text-[9px] font-bold text-center py-0.5 rounded ${sg.liga === "FFU" ? "bg-blue-500/25 text-blue-300" : "bg-white/10 text-white/45"}`}>
                  {sg.liga}
                </span>
                {/* mandante */}
                <TeamLogo team={sg.mandante} size={16} />
                <span className="text-white/20 text-[10px] text-center">vs</span>
                {/* visitante */}
                <TeamLogo team={sg.visitante} size={16} />
                {/* horário — sempre na mesma coluna */}
                <span className="text-white/40 tabular-nums text-xs text-center">{sg.hora}</span>
                {/* logos detentores */}
                <div className="flex gap-1">
                  {sg.detentores.map(det =>
                    LOGOS[det]
                      ? <div key={det} className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          style={{ background: DETENTOR_COLORS[det] || "#444" }}>
                          <img src={LOGOS[det]} alt={det} style={{ width: 13, height: 13, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
                        </div>
                      : <span key={det} className="text-[9px] text-white/40">{det}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortTh({ label, sortKey, current, dir, onSort, right, center, accent }: {
  label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void; right?: boolean; center?: boolean; accent?: string;
}) {
  const isActive = current === sortKey;
  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none transition-colors whitespace-nowrap ${center ? "text-center" : right ? "text-right" : "text-left"}`}
      style={{ color: accent ?? undefined }}
      onClick={() => onSort(sortKey)}>
      {label}
      {isActive ? (
        <span className="ml-1" style={{ color: accent ?? "#60a5fa" }}>{dir === "desc" ? "↓" : "↑"}</span>
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

function ConcurrentCell({ game, onHover }: {
  game: Game;
  onHover: (p: { games: ScheduleGameTagged[]; x: number; y: number } | null) => void;
}) {
  const concurrent = useMemo(() => findConcurrent(game), [game]);
  if (concurrent.length === 0) return <td className="px-2 py-3 text-center text-white/15 text-xs" style={{ width: 80, minWidth: 80 }}>—</td>;
  return (
    <td className="px-2 py-3 text-center" style={{ width: 80, minWidth: 80 }}>
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/[0.07] text-white/60 text-xs font-semibold cursor-default hover:bg-white/[0.13] transition-colors"
        onMouseEnter={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onHover({ games: concurrent, x: r.left + r.width / 2, y: r.top });
        }}
        onMouseLeave={() => onHover(null)}
      >
        {concurrent.length}
      </span>
    </td>
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
