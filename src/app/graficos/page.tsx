"use client";
import { useState, useMemo, useCallback } from "react";
import { games, DETENTORES } from "@/data/games";
import { getMetric, formatMetric, avg, normalizeHorario } from "@/lib/stats";
import FilterDialog, { FilterState, filterSummaryText } from "@/components/FilterDialog";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Cell,
} from "recharts";

const PALETTE = ["#3b82f6", "#a855f7", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#f97316", "#ec4899"];
const EMPTY_FILTERS: FilterState = { anos: [], dias: [], horarios: [], rodadas: [], times: [], detentores: [] };
const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];

interface EnrichedGame {
  mandante: string;
  visitante: string;
  rodada: number;
  ano: number;
  detentor: string;
  dia: string;
  horario: string;
  metric: number;
}

interface SeriesDef {
  id: string;
  color: string;
  label: string;
  filters: FilterState;
  sortedGames: EnrichedGame[];
}

interface UnifiedGame extends EnrichedGame {
  seriesId: string;
  seriesColor: string;
  seriesLabel: string;
}

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
  };
}

function applyFilters(filters: FilterState): EnrichedGame[] {
  let r = games;
  if (filters.detentores?.length) r = r.filter((g) => filters.detentores!.includes(g.detentor));
  if (filters.anos.length) r = r.filter((g) => filters.anos.includes(g.ano));
  if (filters.dias.length) r = r.filter((g) => filters.dias.includes(g.dia));
  if (filters.horarios.length) r = r.filter((g) => filters.horarios.includes(normalizeHorario(g.horario.substring(0, 5))));
  if (filters.rodadas.length) r = r.filter((g) => filters.rodadas.includes(g.rodada));
  if (filters.times.length) r = r.filter((g) => filters.times.some((t) => g.mandante === t || g.visitante === t));
  return r
    .filter((g) => getMetric(g) !== null)
    .map((g) => ({
      mandante: g.mandante,
      visitante: g.visitante,
      rodada: g.rodada,
      ano: g.ano,
      detentor: g.detentor,
      dia: g.dia,
      horario: g.horario,
      metric: getMetric(g) as number,
    }))
    .sort((a, b) => b.metric - a.metric);
}

function autoLabel(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.detentores?.length) parts.push(filters.detentores.join("+"));
  if (filters.anos.length) parts.push(filters.anos.join("+"));
  if (filters.dias.length) parts.push(filters.dias.join("+"));
  if (filters.times.length) {
    if (filters.times.length <= 2) parts.push(filters.times.join("+"));
    else parts.push(`${filters.times.length} times`);
  }
  return parts.length ? parts.join(" · ") : "Série";
}

const INITIAL_FILTERS: FilterState = { detentores: ["CazéTV"], anos: [2026], dias: [], horarios: [], rodadas: [], times: [] };
const INITIAL_SERIES: SeriesDef = {
  id: "s0",
  color: PALETTE[0],
  label: "CazéTV · 2026",
  filters: INITIAL_FILTERS,
  sortedGames: applyFilters(INITIAL_FILTERS),
};

function fmtY(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return v.toFixed(1).replace(".", ",");
}

function SeriesFilterModal({
  editId, initialFilters, onConfirm, onCancel,
}: {
  editId: string | null;
  initialFilters: FilterState;
  onConfirm: (filters: FilterState) => void;
  onCancel: () => void;
}) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const filterOptions = useMemo(() => buildOptions(games, filters), [filters]);
  const previewGames = useMemo(() => applyFilters(filters), [filters]);
  const summary = filterSummaryText(filters);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
    >
      <div
        className="glass-strong rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col gap-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <h2 className="text-base font-semibold text-white">
            {editId ? "Editar Série" : "Configurar Série"}
          </h2>
          <button onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-3 border-b border-white/[0.07]">
          <FilterDialog state={filters} onChange={setFilters} options={filterOptions} singleDetentor />
          {summary && <p className="text-xs text-white/40">{summary}</p>}
        </div>

        <div className="px-6 py-4 flex flex-col gap-2 border-b border-white/[0.07]">
          <p className="text-xs font-semibold text-white/35 uppercase tracking-widest">
            {previewGames.length} jogos selecionados
          </p>
          {previewGames.slice(0, 5).map((g, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/60 truncate">{g.mandante} × {g.visitante} · Rod.{g.rodada}</span>
              <span className="text-xs text-white/40 shrink-0">{formatMetric(g.detentor, g.metric)}</span>
            </div>
          ))}
          {previewGames.length === 0 && (
            <p className="text-xs text-white/25">Nenhum jogo com os filtros selecionados</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/70 transition-colors border border-white/10 hover:bg-white/5">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(filters)}
            disabled={previewGames.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GraficosPage() {
  const [seriesList, setSeriesList] = useState<SeriesDef[]>([INITIAL_SERIES]);
  const [modalState, setModalState] = useState<{ open: boolean; editId: string | null; filters: FilterState }>({
    open: false, editId: null, filters: EMPTY_FILTERS,
  });
  const [chartMode, setChartMode] = useState<"line" | "bar">("line");
  const [showAvgs, setShowAvgs] = useState(true);
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);
  const [lockedPos, setLockedPos] = useState<number | null>(null);

  // All games from all series merged and sorted descending by metric
  const unifiedGames = useMemo<UnifiedGame[]>(() => {
    const all = seriesList.flatMap((s) =>
      s.sortedGames.map((g) => ({ ...g, seriesId: s.id, seriesColor: s.color, seriesLabel: s.label }))
    );
    return all.sort((a, b) => b.metric - a.metric);
  }, [seriesList]);

  // One chart entry per unified rank position
  const chartData = useMemo(() => {
    return unifiedGames.map((g, pos) => {
      const point: Record<string, any> = {
        pos,
        metric: g.metric,
        seriesId: g.seriesId,
        seriesColor: g.seriesColor,
        seriesLabel: g.seriesLabel,
        game: `${g.mandante} × ${g.visitante}`,
        rodada: g.rodada,
        ano: g.ano,
        detentor: g.detentor,
      };
      // Per-series keys for line mode (null when position belongs to another series)
      seriesList.forEach((s) => {
        point[s.id] = g.seriesId === s.id ? g.metric : null;
      });
      return point;
    });
  }, [unifiedGames, seriesList]);

  const seriesAvgs = useMemo(() => {
    return seriesList.map((s) => ({
      id: s.id,
      color: s.color,
      label: s.label,
      avg: s.sortedGames.length ? avg(s.sortedGames.map((g) => g.metric)) : null,
    }));
  }, [seriesList]);

  const handleModalConfirm = useCallback((filters: FilterState) => {
    const filteredGames = applyFilters(filters);
    const newSeries: SeriesDef = {
      id: modalState.editId ?? `s${Date.now()}`,
      color: modalState.editId
        ? (seriesList.find((s) => s.id === modalState.editId)?.color ?? PALETTE[seriesList.length % PALETTE.length])
        : (PALETTE.find((c) => !seriesList.map((s) => s.color).includes(c)) ?? PALETTE[seriesList.length % PALETTE.length]),
      label: autoLabel(filters),
      filters,
      sortedGames: filteredGames,
    };
    if (modalState.editId) {
      setSeriesList((prev) => prev.map((s) => s.id === modalState.editId ? newSeries : s));
    } else {
      setSeriesList((prev) => [...prev, newSeries]);
    }
    setLockedPos(null);
    setModalState({ open: false, editId: null, filters: EMPTY_FILTERS });
  }, [modalState, seriesList]);

  const displayPos = lockedPos ?? hoveredPos;
  const displayGame = displayPos !== null ? unifiedGames[displayPos] : null;

  const handleMouseMove = useCallback((state: any) => {
    if (state?.activePayload?.length) {
      const pos = state.activePayload[0]?.payload?.pos;
      setHoveredPos(typeof pos === "number" ? pos : null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredPos(null);
  }, []);

  const handleClick = useCallback((state: any) => {
    if (state?.activePayload?.length) {
      const pos = state.activePayload[0]?.payload?.pos;
      if (typeof pos === "number") {
        setLockedPos((prev) => (prev === pos ? null : pos));
      }
    }
  }, []);

  const maxLen = unifiedGames.length;
  const ticks = useMemo(() => Array.from({ length: maxLen }, (_, i) => i), [maxLen]);
  const tickInterval = maxLen > 40 ? Math.ceil(maxLen / 30) - 1 : 0;

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Gráficos</h1>
        <p className="text-white/40 text-sm mt-1.5">
          Compare séries de jogos com filtros personalizados, ordenadas por audiência
        </p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col gap-4">
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">Séries</p>
            {seriesList.length === 0 ? (
              <p className="text-xs text-white/25">Nenhuma série adicionada</p>
            ) : (
              <div className="flex flex-col gap-2">
                {seriesList.map((s) => (
                  <div key={s.id}
                    className="flex items-center gap-2 p-2 rounded-xl border"
                    style={{ borderColor: s.color + "33", background: s.color + "10" }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-xs flex-1 min-w-0 truncate" style={{ color: s.color }}>{s.label}</span>
                    <button
                      onClick={() => setModalState({ open: true, editId: s.id, filters: s.filters })}
                      className="text-white/30 hover:text-white/60 transition-colors text-sm leading-none shrink-0"
                      title="Editar">
                      ✎
                    </button>
                    <button
                      onClick={() => { setSeriesList((prev) => prev.filter((x) => x.id !== s.id)); setLockedPos(null); }}
                      className="text-white/25 hover:text-red-400 transition-colors text-sm leading-none shrink-0"
                      title="Remover">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setModalState({ open: true, editId: null, filters: EMPTY_FILTERS })}
            className="w-full py-2.5 rounded-2xl text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/35 hover:bg-blue-600/30 transition-colors">
            + Adicionar série
          </button>

          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">Opções</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showAvgs} onChange={(e) => setShowAvgs(e.target.checked)}
                className="rounded accent-blue-500" />
              <span className="text-xs text-white/50">Mostrar médias</span>
            </label>
          </div>
        </aside>

        {/* Chart area */}
        <div className="flex-1 min-w-0">
          {seriesList.length === 0 ? (
            <div className="glass rounded-2xl p-6">
              <div className="h-80 flex flex-col items-center justify-center text-white/20 gap-3">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <p className="text-sm">Adicione pelo menos uma série para ver o gráfico</p>
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl p-6">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-wrap gap-4">
                  {seriesList.map((s) => {
                    const sa = seriesAvgs.find((x) => x.id === s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className="w-4 h-0.5 rounded" style={{ background: s.color }} />
                        <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
                        {sa?.avg != null && (
                          <span className="text-[10px] text-white/25">({fmtY(sa.avg)} méd)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setChartMode((m) => m === "line" ? "bar" : "line")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white/70 transition-all ml-4 shrink-0">
                  {chartMode === "line" ? "▐▌ Barras" : "━━ Linha"}
                </button>
              </div>

              {/* Hover / lock card */}
              <div style={{ height: 36, marginBottom: 10, display: "flex", alignItems: "center" }}>
                {displayGame ? (
                  <div
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border w-fit"
                    style={{ borderColor: displayGame.seriesColor + "44", background: displayGame.seriesColor + "0f" }}
                  >
                    {lockedPos !== null && (
                      <svg className="w-3 h-3 shrink-0" style={{ color: displayGame.seriesColor }}
                        viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1a5 5 0 00-5 5v3H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-2V6a5 5 0 00-5-5zm0 2a3 3 0 013 3v3H9V6a3 3 0 013-3zm0 9a2 2 0 110 4 2 2 0 010-4z" />
                      </svg>
                    )}
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: displayGame.seriesColor }} />
                    <span className="text-[10px] text-white/35 tabular-nums">#{displayPos! + 1}</span>
                    <span className="text-xs text-white/40 tabular-nums">Rod.{displayGame.rodada}</span>
                    <span className="text-xs text-white/75 font-medium">{displayGame.game}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: displayGame.seriesColor }}>
                      {formatMetric(displayGame.detentor, displayGame.metric)}
                    </span>
                    {lockedPos !== null && (
                      <button onClick={() => setLockedPos(null)}
                        className="text-white/25 hover:text-white/60 transition-colors ml-1 text-sm leading-none">
                        ✕
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Chart */}
              <ResponsiveContainer width="100%" height={330}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={handleClick}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />

                  {/* Column highlights */}
                  {hoveredPos !== null && (
                    <ReferenceArea x1={hoveredPos - 0.45} x2={hoveredPos + 0.45}
                      fill="rgba(255,255,255,0.05)" stroke="none" />
                  )}
                  {lockedPos !== null && lockedPos !== hoveredPos && (
                    <ReferenceArea x1={lockedPos - 0.45} x2={lockedPos + 0.45}
                      fill="rgba(255,255,255,0.07)" stroke="none" />
                  )}

                  <XAxis
                    dataKey="pos"
                    type="number"
                    domain={[-0.5, Math.max(0, maxLen - 0.5)]}
                    ticks={ticks}
                    interval={tickInterval}
                    tickFormatter={(v) => String(v + 1)}
                    tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtY}
                    tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    domain={[(d: number) => Math.max(0, d * 0.92), (d: number) => d * 1.08]}
                  />

                  {/* Series average reference lines */}
                  {showAvgs && seriesAvgs.map((sa) =>
                    sa.avg !== null ? (
                      <ReferenceLine key={`avg-${sa.id}`} y={sa.avg}
                        stroke={sa.color} strokeOpacity={0.3}
                        strokeDasharray="4 4" strokeWidth={1} />
                    ) : null
                  )}

                  {chartMode === "bar" ? (
                    <Bar dataKey="metric" isAnimationActive={false} maxBarSize={30} radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.seriesColor}
                          fillOpacity={lockedPos === i ? 1 : hoveredPos === i ? 0.95 : 0.78}
                        />
                      ))}
                    </Bar>
                  ) : (
                    seriesList.map((s) => (
                      <Line
                        key={s.id}
                        dataKey={s.id}
                        stroke={s.color}
                        strokeWidth={1.5}
                        type="monotone"
                        dot={(dotProps: any) => {
                          const { cx, cy, payload, key } = dotProps;
                          if (payload?.[s.id] == null) return <g key={key} />;
                          const pos = payload?.pos;
                          const isActive = pos === hoveredPos || pos === lockedPos;
                          return (
                            <circle key={key} cx={cx} cy={cy}
                              r={isActive ? 5 : 3.5}
                              fill={isActive ? s.color : "#08090f"}
                              stroke={s.color}
                              strokeWidth={isActive ? 2.5 : 2}
                            />
                          );
                        }}
                        activeDot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {modalState.open && (
        <SeriesFilterModal
          editId={modalState.editId}
          initialFilters={modalState.filters}
          onConfirm={handleModalConfirm}
          onCancel={() => setModalState({ open: false, editId: null, filters: EMPTY_FILTERS })}
        />
      )}
    </div>
  );
}
