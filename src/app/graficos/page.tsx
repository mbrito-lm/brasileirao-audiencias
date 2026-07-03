"use client";
import { useState, useMemo, useCallback } from "react";
import { games, DETENTORES } from "@/data/games";
import { getMetric, formatMetric, avg, normalizeHorario, PNT_DETENTORES } from "@/lib/stats";
import FilterDialog, { FilterState, filterSummaryText } from "@/components/FilterDialog";
import TeamLogo from "@/components/TeamLogo";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Cell, LabelList,
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

function Sep() {
  return <div className="w-px self-stretch bg-white/[0.08] my-[5px] shrink-0" />;
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
      mandante: g.mandante, visitante: g.visitante, rodada: g.rodada,
      ano: g.ano, detentor: g.detentor, dia: g.dia, horario: g.horario,
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
  id: "s0", color: PALETTE[0], label: "CazéTV · 2026",
  filters: INITIAL_FILTERS, sortedGames: applyFilters(INITIAL_FILTERS),
};

function fmtY(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return Math.round(v / 1_000) + "k";
  return v.toFixed(1).replace(".", ",");
}

function SeriesFilterModal({ editId, initialFilters, onConfirm, onCancel }: {
  editId: string | null; initialFilters: FilterState;
  onConfirm: (filters: FilterState) => void; onCancel: () => void;
}) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const filterOptions = useMemo(() => buildOptions(games, filters), [filters]);
  const previewGames = useMemo(() => applyFilters(filters), [filters]);
  const summary = filterSummaryText(filters);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}>
      <div className="glass-strong rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col gap-0"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <h2 className="text-base font-semibold text-white">{editId ? "Editar Série" : "Configurar Série"}</h2>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors text-white/50 hover:text-white">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3 border-b border-white/[0.07]">
          <FilterDialog state={filters} onChange={setFilters} options={filterOptions} singleDetentor />
          {summary && <p className="text-xs text-white/40">{summary}</p>}
        </div>
        <div className="px-6 py-4 flex flex-col gap-2 border-b border-white/[0.07]">
          <p className="text-xs font-semibold text-white/35 uppercase tracking-widest">{previewGames.length} jogos selecionados</p>
          {previewGames.slice(0, 5).map((g, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/60 truncate">{g.mandante} × {g.visitante} · Rod.{g.rodada}</span>
              <span className="text-xs text-white/40 shrink-0">{formatMetric(g.detentor, g.metric)}</span>
            </div>
          ))}
          {previewGames.length === 0 && <p className="text-xs text-white/25">Nenhum jogo com os filtros selecionados</p>}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/70 transition-colors border border-white/10 hover:bg-white/5">Cancelar</button>
          <button onClick={() => onConfirm(filters)} disabled={previewGames.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function GraficosCard({ game, pos, locked, onUnlock }: {
  game: UnifiedGame; pos: number; locked: boolean; onUnlock?: () => void;
}) {
  return (
    <div className="h-[26px] flex items-center w-fit text-xs border border-white/[0.10] rounded-lg bg-white/[0.04] overflow-hidden">
      <div className="w-6 flex items-center justify-center shrink-0 text-white/25">
        {locked && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V6a3 3 0 0 1 3-3zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
          </svg>
        )}
      </div>
      <Sep />
      <div className="w-[36px] flex items-center justify-center shrink-0 text-white/30 tabular-nums">#{pos + 1}</div>
      <Sep />
      <div className="w-[52px] flex items-center justify-center shrink-0 text-white/35 tabular-nums">Rod. {game.rodada}</div>
      <Sep />
      <div className="flex items-center gap-1 px-2 shrink-0">
        <TeamLogo team={game.mandante} size={13} />
        <span className="text-white/20 text-[10px]">vs</span>
        <TeamLogo team={game.visitante} size={13} />
      </div>
      <Sep />
      <div className="w-[52px] flex items-center justify-end shrink-0 font-bold pr-2 tabular-nums" style={{ color: game.seriesColor }}>
        {formatMetric(game.detentor, game.metric)}
      </div>
      <Sep />
      <div className="w-6 flex items-center justify-center shrink-0">
        {onUnlock && <button onClick={onUnlock} className="text-white/25 hover:text-white/60 transition-colors leading-none">✕</button>}
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
  const [groupSeries, setGroupSeries] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showShields, setShowShields] = useState(false);
  const [hoveredPos, setHoveredPos] = useState<number | null>(null);
  const [lockedPositions, setLockedPositions] = useState<number[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelText, setEditingLabelText] = useState("");

  // All games merged and sorted desc by metric
  const unifiedGames = useMemo<UnifiedGame[]>(() => {
    const all = seriesList.flatMap((s) =>
      s.sortedGames.map((g) => ({ ...g, seriesId: s.id, seriesColor: s.color, seriesLabel: s.label }))
    );
    return all.sort((a, b) => b.metric - a.metric);
  }, [seriesList]);

  // Grouped mode: one point per series = series average
  const groupedGames = useMemo<UnifiedGame[]>(() => {
    return seriesList.map((s) => {
      const avgVal = s.sortedGames.length ? avg(s.sortedGames.map((g) => g.metric)) : 0;
      const best = s.sortedGames[0];
      return {
        mandante: best?.mandante ?? "", visitante: best?.visitante ?? "",
        rodada: 0, ano: 0, detentor: best?.detentor ?? "CazéTV",
        dia: "", horario: "", metric: avgVal,
        seriesId: s.id, seriesColor: s.color, seriesLabel: s.label,
      } as UnifiedGame;
    }).sort((a, b) => b.metric - a.metric);
  }, [seriesList]);

  const activeGames = groupSeries ? groupedGames : unifiedGames;

  // chartData: one entry per position
  const chartData = useMemo(() => {
    return activeGames.map((g, pos) => {
      const point: Record<string, any> = {
        pos, metric: g.metric,
        seriesId: g.seriesId, seriesColor: g.seriesColor, seriesLabel: g.seriesLabel,
        mandante: g.mandante, visitante: g.visitante, rodada: g.rodada, detentor: g.detentor,
      };
      seriesList.forEach((s) => { point[s.id] = g.seriesId === s.id ? g.metric : null; });
      return point;
    });
  }, [activeGames, seriesList]);

  const seriesAvgs = useMemo(() => {
    return seriesList.map((s) => ({
      id: s.id, color: s.color, label: s.label,
      avg: s.sortedGames.length ? avg(s.sortedGames.map((g) => g.metric)) : null,
    }));
  }, [seriesList]);

  // Mixed metrics warning
  const isMixed = useMemo(() => {
    const hasPnt = seriesList.some((s) => s.sortedGames.some((g) => PNT_DETENTORES.has(g.detentor)));
    const hasAud = seriesList.some((s) => s.sortedGames.some((g) => !PNT_DETENTORES.has(g.detentor)));
    return hasPnt && hasAud;
  }, [seriesList]);

  const allPnt = useMemo(() =>
    seriesList.length > 0 && seriesList.every((s) => s.sortedGames.every((g) => PNT_DETENTORES.has(g.detentor))),
    [seriesList]
  );

  const handleModalConfirm = useCallback((filters: FilterState) => {
    const filteredGames = applyFilters(filters);
    const newSeries: SeriesDef = {
      id: modalState.editId ?? `s${Date.now()}`,
      color: modalState.editId
        ? (seriesList.find((s) => s.id === modalState.editId)?.color ?? PALETTE[seriesList.length % PALETTE.length])
        : (PALETTE.find((c) => !seriesList.map((s) => s.color).includes(c)) ?? PALETTE[seriesList.length % PALETTE.length]),
      // Preserve custom label when editing; auto-generate when adding new
      label: modalState.editId
        ? (seriesList.find((s) => s.id === modalState.editId)?.label ?? autoLabel(filters))
        : autoLabel(filters),
      filters, sortedGames: filteredGames,
    };
    if (modalState.editId) {
      setSeriesList((prev) => prev.map((s) => s.id === modalState.editId ? newSeries : s));
    } else {
      setSeriesList((prev) => [...prev, newSeries]);
    }
    setLockedPositions([]);
    setModalState({ open: false, editId: null, filters: EMPTY_FILTERS });
  }, [modalState, seriesList]);

  // Slot logic: up to 2 locked positions; hovered fills the free slot
  const slot1Pos = lockedPositions.length > 0
    ? lockedPositions[0]
    : hoveredPos;
  const slot2Pos = lockedPositions.length >= 2
    ? lockedPositions[1]
    : (lockedPositions.length === 1 && hoveredPos !== null && !lockedPositions.includes(hoveredPos)
      ? hoveredPos
      : null);

  const slot1Game = slot1Pos !== null ? activeGames[slot1Pos] : null;
  const slot2Game = slot2Pos !== null ? activeGames[slot2Pos] : null;

  const handleMouseMove = useCallback((state: any) => {
    if (state?.activePayload?.length) {
      const pos = state.activePayload[0]?.payload?.pos;
      setHoveredPos(typeof pos === "number" ? pos : null);
    }
  }, []);
  const handleMouseLeave = useCallback(() => setHoveredPos(null), []);
  const handleClick = useCallback((state: any) => {
    if (state?.activePayload?.length) {
      const pos = state.activePayload[0]?.payload?.pos;
      if (typeof pos === "number") {
        setLockedPositions((prev) => {
          if (prev.includes(pos)) return prev.filter((p) => p !== pos);
          if (prev.length >= 2) return [prev[1], pos];
          return [...prev, pos];
        });
      }
    }
  }, []);

  const maxLen = activeGames.length;
  const ticks = useMemo(() => Array.from({ length: maxLen }, (_, i) => i), [maxLen]);
  const tickInterval = maxLen > 40 ? Math.ceil(maxLen / 30) - 1 : 0;

  // Adaptive sizing
  const dynamicShieldSize = maxLen <= 5 ? 16 : maxLen <= 15 ? 13 : maxLen <= 30 ? 11 : 9;
  const dynamicFontSize = maxLen <= 5 ? 11 : maxLen <= 15 ? 10 : 9;

  const ShieldsTick = useCallback((props: any) => {
    const { x, y, payload } = props;
    const pos = payload?.value;
    const entry = chartData[pos];
    const shieldH = dynamicShieldSize + 4;
    return (
      <g transform={`translate(${x},${y})`}>
        {showShields && entry?.mandante ? (
          <>
            <foreignObject x={-dynamicShieldSize} y={0} width={dynamicShieldSize * 2} height={shieldH}>
              <div style={{ display: "flex", gap: "1px", justifyContent: "center", alignItems: "center" }}>
                <TeamLogo team={entry.mandante} size={dynamicShieldSize} />
                <TeamLogo team={entry.visitante} size={dynamicShieldSize} />
              </div>
            </foreignObject>
            <text textAnchor="middle" dy={shieldH + 10} fill="rgba(255,255,255,0.15)" fontSize={8}>{pos + 1}</text>
          </>
        ) : (
          <text textAnchor="middle" dy={10} fill="rgba(255,255,255,0.20)" fontSize={9}>{pos + 1}</text>
        )}
      </g>
    );
  }, [chartData, showShields, dynamicShieldSize]);

  return (
    <div className="py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Gráficos</h1>
        <p className="text-white/40 text-sm mt-1.5">Compare séries com filtros personalizados, ordenadas por audiência</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col gap-4">
          {/* Series list */}
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">Séries</p>
            {seriesList.length === 0 ? (
              <p className="text-xs text-white/25">Nenhuma série adicionada</p>
            ) : (
              <div className="flex flex-col gap-2">
                {seriesList.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl border"
                    style={{ borderColor: s.color + "33", background: s.color + "10" }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    {editingLabelId === s.id ? (
                      <input
                        autoFocus
                        value={editingLabelText}
                        onChange={(e) => setEditingLabelText(e.target.value)}
                        onBlur={() => {
                          if (editingLabelText.trim()) {
                            setSeriesList((prev) => prev.map((x) => x.id === s.id ? { ...x, label: editingLabelText.trim() } : x));
                          }
                          setEditingLabelId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") { setEditingLabelId(null); }
                        }}
                        className="text-xs flex-1 bg-transparent border-b outline-none min-w-0 pb-px"
                        style={{ color: s.color, borderColor: s.color + "66" }}
                      />
                    ) : (
                      <span
                        className="text-xs flex-1 min-w-0 truncate"
                        style={{ color: s.color }}
                      >
                        {s.label}
                      </span>
                    )}
                    {editingLabelId !== s.id && (
                      <button
                        onClick={() => { setEditingLabelId(s.id); setEditingLabelText(s.label); }}
                        className="text-white/20 hover:text-white/50 transition-colors leading-none shrink-0 text-[11px]"
                        title="Renomear série"
                      >✎</button>
                    )}
                    <button onClick={() => setModalState({ open: true, editId: s.id, filters: s.filters })}
                      className="text-white/30 hover:text-white/60 transition-colors text-sm leading-none shrink-0" title="Editar filtros">⚙</button>
                    <button onClick={() => { setSeriesList((prev) => prev.filter((x) => x.id !== s.id)); setLockedPositions([]); }}
                      className="text-white/25 hover:text-red-400 transition-colors text-sm leading-none shrink-0" title="Remover">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setModalState({ open: true, editId: null, filters: EMPTY_FILTERS })}
            className="w-full py-2.5 rounded-2xl text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/35 hover:bg-blue-600/30 transition-colors">
            + Adicionar série
          </button>

          {/* Options */}
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-white/35 uppercase tracking-widest mb-3">Opções</p>
            <div className="flex flex-col gap-2">
              {([
                { key: "showAvgs", label: "Mostrar médias", value: showAvgs, set: setShowAvgs, disabled: false },
                { key: "groupSeries", label: "Agrupar séries", value: groupSeries, set: setGroupSeries, disabled: false },
                { key: "showLabels", label: "Mostrar audiências", value: showLabels, set: setShowLabels, disabled: false },
                { key: "showShields", label: "Mostrar jogos", value: showShields, set: setShowShields, disabled: groupSeries },
              ] as { key: string; label: string; value: boolean; set: (v: boolean) => void; disabled: boolean }[]).map(({ key, label, value, set, disabled }) => (
                <label key={key} className={`flex items-center gap-2 ${disabled ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}`}>
                  <input type="checkbox" checked={value} disabled={disabled}
                    onChange={(e) => !disabled && set(e.target.checked)} className="rounded accent-blue-500" />
                  <span className="text-xs text-white/50">{label}</span>
                </label>
              ))}
            </div>
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
                <div className="flex flex-wrap gap-4 items-center">
                  {seriesList.map((s) => {
                    const sa = seriesAvgs.find((x) => x.id === s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className="w-4 h-0.5 rounded" style={{ background: s.color }} />
                        <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
                        {sa?.avg != null && !groupSeries && (
                          <span className="text-[10px] text-white/25">({fmtY(sa.avg)} méd)</span>
                        )}
                      </div>
                    );
                  })}
                  {isMixed && (
                    <div className="flex items-center gap-1 bg-red-500/15 border border-red-500/30 rounded-md px-2 py-1">
                      <svg className="w-3 h-3 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <span className="text-[9px] font-semibold text-red-400 uppercase tracking-wide">Métricas mistas</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setChartMode((m) => m === "line" ? "bar" : "line")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white/70 transition-all ml-4 shrink-0">
                  {chartMode === "line" ? "▐▌ Barras" : "━━ Linha"}
                </button>
              </div>

              {/* Hover/lock cards */}
              <div style={{ height: 56, marginBottom: 10, display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
                {slot1Game
                  ? <GraficosCard game={slot1Game} pos={slot1Pos!} locked={lockedPositions.includes(slot1Pos!)}
                      onUnlock={lockedPositions.includes(slot1Pos!)
                        ? () => setLockedPositions((prev) => prev.filter((p) => p !== slot1Pos))
                        : undefined} />
                  : <div style={{ height: 26, flexShrink: 0 }} />
                }
                {slot2Game
                  ? <GraficosCard game={slot2Game} pos={slot2Pos!} locked={lockedPositions.includes(slot2Pos!)}
                      onUnlock={lockedPositions.includes(slot2Pos!)
                        ? () => setLockedPositions((prev) => prev.filter((p) => p !== slot2Pos))
                        : undefined} />
                  : <div style={{ height: 26, flexShrink: 0 }} />
                }
              </div>

              {/* Chart */}
              <ResponsiveContainer width="100%" height={330}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: showShields && !groupSeries ? 40 : 4 }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={handleClick}
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />

                  {hoveredPos !== null && !lockedPositions.includes(hoveredPos) && (
                    <ReferenceArea x1={hoveredPos - 0.45} x2={hoveredPos + 0.45} fill="rgba(255,255,255,0.05)" stroke="none" />
                  )}
                  {lockedPositions.map((lp) => (
                    <ReferenceArea key={lp} x1={lp - 0.45} x2={lp + 0.45} fill="rgba(255,255,255,0.07)" stroke="none" />
                  ))}

                  <XAxis
                    dataKey="pos"
                    type="number"
                    domain={[-0.5, Math.max(0, maxLen - 0.5)]}
                    ticks={ticks}
                    interval={tickInterval}
                    tick={ShieldsTick}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtY}
                    tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
                    axisLine={false} tickLine={false} width={52}
                    domain={[(d: number) => Math.max(0, d * 0.92), (d: number) => d * 1.08]}
                  />

                  {showAvgs && !groupSeries && seriesAvgs.map((sa) =>
                    sa.avg !== null ? (
                      <ReferenceLine key={`avg-${sa.id}`} y={sa.avg}
                        stroke={sa.color} strokeOpacity={0.3} strokeDasharray="4 4" strokeWidth={1} />
                    ) : null
                  )}

                  {chartMode === "bar" ? (
                    <Bar dataKey="metric" isAnimationActive={false} maxBarSize={30} radius={[3, 3, 0, 0]}>
                      {showLabels && (
                        <LabelList dataKey="metric" position="top"
                          formatter={fmtY}
                          style={{ fill: "rgba(255,255,255,0.90)", fontSize: dynamicFontSize, fontWeight: "bold" }} />
                      )}
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.seriesColor}
                          fillOpacity={lockedPositions.includes(i) ? 1 : hoveredPos === i ? 0.95 : 0.78} />
                      ))}
                    </Bar>
                  ) : (
                    seriesList.map((s) => (
                      <Line key={s.id} dataKey={s.id} stroke={s.color} strokeWidth={1.5}
                        type="monotone" connectNulls={false} isAnimationActive={false}
                        dot={(dotProps: any) => {
                          const { cx, cy, payload, key } = dotProps;
                          if (payload?.[s.id] == null) return <g key={key} />;
                          const pos = payload?.pos;
                          const isActive = pos === hoveredPos || lockedPositions.includes(pos);
                          return (
                            <g key={key}>
                              <circle cx={cx} cy={cy} r={isActive ? 5 : 3.5}
                                fill={isActive ? s.color : "#08090f"}
                                stroke={s.color} strokeWidth={isActive ? 2.5 : 2} />
                              {showLabels && (
                                <text x={cx} y={cy - 9} textAnchor="middle"
                                  fill="rgba(255,255,255,0.90)" fontSize={dynamicFontSize} fontWeight="bold">
                                  {fmtY(payload[s.id])}
                                </text>
                              )}
                            </g>
                          );
                        }}
                        activeDot={false}
                      />
                    ))
                  )}
                </ComposedChart>
              </ResponsiveContainer>

              {/* Disclaimer */}
              <p className="text-white/20 text-[10px] text-center mt-1">
                {allPnt ? "valores em pontos PNT" : "valores em espectadores individuais"}
              </p>
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
