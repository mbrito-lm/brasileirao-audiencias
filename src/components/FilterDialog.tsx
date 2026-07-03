"use client";
import { useEffect, useRef, useState } from "react";
import TeamLogo from "./TeamLogo";
import { LOGOS } from "@/data/logos";

export interface FilterState {
  anos: number[];
  dias: string[];
  horarios: string[];
  rodadas: number[];
  times: string[];
  detentores?: string[];  // optional; single-select when used in Comparações
  concorrencia: number[]; // concurrent game counts to include
}

interface FilterDialogProps {
  state: FilterState;
  onChange: (s: FilterState) => void;
  options: {
    anos: number[];
    dias: string[];
    horarios: string[];
    rodadas: number[];
    times: string[];
    detentores?: string[];
    concorrencia: number[];
  };
  singleDetentor?: boolean;
}

const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];
const DIA_LABELS: Record<string, string> = {
  "seg.": "Segunda", "ter.": "Terça", "qua.": "Quarta",
  "qui.": "Quinta", "sex.": "Sexta", "sáb.": "Sábado", "dom.": "Domingo",
};

const DIA_LABELS_SHORT: Record<string, string> = {
  "seg.": "Seg", "ter.": "Ter", "qua.": "Qua",
  "qui.": "Qui", "sex.": "Sex", "sáb.": "Sáb", "dom.": "Dom",
};

export function filterSummaryText(filters: FilterState): string | null {
  const parts: string[] = [];
  if (filters.detentores?.length) parts.push(filters.detentores.join(" · "));
  if (filters.anos.length) parts.push(filters.anos.join(" · "));
  if (filters.dias.length) parts.push(filters.dias.map((d) => DIA_LABELS_SHORT[d] ?? d).join(" · "));
  if (filters.horarios.length) parts.push(filters.horarios.join(" · "));
  if (filters.rodadas.length) {
    if (filters.rodadas.length <= 5) parts.push("Rod. " + filters.rodadas.join(" · "));
    else parts.push(`${filters.rodadas.length} rodadas`);
  }
  if (filters.times.length) {
    if (filters.times.length <= 3) parts.push(filters.times.join(" · "));
    else parts.push(`${filters.times.length} times`);
  }
  if (filters.concorrencia.length) parts.push(`${filters.concorrencia.join("/")} concorr.`);
  return parts.length ? parts.join("  |  ") : null;
}

export default function FilterDialog({ state, onChange, options, singleDetentor }: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  // Drag state
  const isDragging = useRef(false);
  const dragKey = useRef<keyof FilterState | null>(null);
  const dragStartIdx = useRef<number>(-1);
  const dragAddMode = useRef(true);
  const dragSnapshot = useRef<FilterState | null>(null);
  const dragDisplayItems = useRef<any[]>([]);

  useEffect(() => {
    const up = () => { isDragging.current = false; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const totalActive = state.anos.length + state.dias.length + state.horarios.length +
    state.rodadas.length + state.times.length + (state.detentores?.length ?? 0) + state.concorrencia.length;

  function startDrag(key: keyof FilterState, idx: number, displayItems: any[]) {
    const arr = state[key] as any[];
    const val = displayItems[idx];
    isDragging.current = true;
    dragKey.current = key;
    dragStartIdx.current = idx;
    dragSnapshot.current = { ...state, [key]: [...arr] };
    dragDisplayItems.current = [...displayItems];
    dragAddMode.current = !arr.includes(val);

    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    onChange({ ...state, [key]: next });
  }

  function enterDrag(key: keyof FilterState, idx: number) {
    if (!isDragging.current || dragKey.current !== key || !dragSnapshot.current) return;
    const snap = dragSnapshot.current;
    const items = dragDisplayItems.current;
    const lo = Math.min(dragStartIdx.current, idx);
    const hi = Math.max(dragStartIdx.current, idx);
    const range = items.slice(lo, hi + 1);

    const base = snap[key] as any[];
    let next: any[];
    if (dragAddMode.current) {
      const s = new Set(base);
      range.forEach((item) => s.add(item));
      next = Array.from(s);
    } else {
      const rm = new Set(range);
      next = base.filter((x) => !rm.has(x));
    }
    onChange({ ...snap, [key]: next });
  }

  function clearKey(key: keyof FilterState) {
    onChange({ ...state, [key]: [] });
  }

  function clearAll() {
    onChange({ anos: [], dias: [], horarios: [], rodadas: [], times: [], detentores: [], concorrencia: [] });
  }

  function toggleDetentor(d: string) {
    const cur = state.detentores ?? [];
    if (singleDetentor) {
      // single-select: toggle off if already selected, otherwise replace
      onChange({ ...state, detentores: cur.includes(d) ? [] : [d] });
    } else {
      onChange({ ...state, detentores: cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d] });
    }
  }

  const filteredTeams = options.times.filter((t) =>
    !teamSearch.trim() || t.toLowerCase().includes(teamSearch.trim().toLowerCase())
  );

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
          totalActive > 0
            ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
            : "bg-white/[0.05] text-white/50 border-white/[0.08] hover:text-white/70 hover:bg-white/[0.08]"
        }`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        Filtros
        {totalActive > 0 && (
          <span className="ml-0.5 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {totalActive}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.70)", backdropFilter: "blur(8px)" }}
          onClick={() => setOpen(false)}>
          <div className="glass-strong rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: "82vh" }}
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
              <h2 className="text-base font-semibold text-white">Filtros</h2>
              <div className="flex items-center gap-3">
                {totalActive > 0 && (
                  <button onClick={clearAll} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    Limpar tudo ({totalActive})
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors text-white/50 hover:text-white">
                  ✕
                </button>
              </div>
            </div>

            {/* Detentor strip — only shown when options.detentores is provided */}
            {options.detentores && options.detentores.length > 0 && (
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-white/40 uppercase tracking-widest mr-2">Detentor</span>
                {options.detentores.map((d) => {
                  const active = (state.detentores ?? []).includes(d);
                  return (
                    <button key={d} onClick={() => toggleDetentor(d)}
                      title={d}
                      className={`h-9 px-3 flex items-center rounded-xl transition-all border ${
                        active
                          ? "bg-blue-600/25 border-blue-500/40"
                          : "bg-white/[0.04] border-white/[0.07] hover:bg-white/[0.08]"
                      }`}>
                      {LOGOS[d]
                        ? <img src={LOGOS[d]} alt={d} className="h-5 w-auto object-contain"
                            style={{ filter: active ? "none" : "grayscale(1) opacity(0.45)" }} />
                        : <span className={`text-xs font-medium ${active ? "text-blue-200" : "text-white/40"}`}>{d}</span>
                      }
                    </button>
                  );
                })}
                {(state.detentores?.length ?? 0) > 0 && (
                  <button onClick={() => onChange({ ...state, detentores: [] })}
                    className="text-xs text-blue-400/70 hover:text-blue-300 transition-colors ml-1">
                    Limpar
                  </button>
                )}
                {singleDetentor && (
                  <span className="ml-auto text-[10px] text-white/20 uppercase tracking-widest">seleção única</span>
                )}
              </div>
            )}

            {/* Columns — flex-1 fills remaining modal height, overflow hidden so each column scrolls independently */}
            <div className="grid grid-cols-6 divide-x divide-white/[0.06] flex-1 min-h-0" style={{ overflow: "hidden" }}>
              {/* Temporada */}
              <ColSection title="Temporada" count={state.anos.length} onClear={() => clearKey("anos")}>
                <div className="space-y-1 px-4 py-3">
                  {options.anos.map((a, i) => (
                    <DragItem
                      key={a}
                      active={state.anos.includes(a)}
                      onPointerDown={() => startDrag("anos", i, options.anos)}
                      onPointerEnter={() => enterDrag("anos", i)}>
                      <span className="text-sm font-semibold">{a}</span>
                    </DragItem>
                  ))}
                </div>
              </ColSection>

              {/* Dia */}
              <ColSection title="Dia" count={state.dias.length} onClear={() => clearKey("dias")}>
                <div className="space-y-1 px-4 py-3">
                  {options.dias.map((d, i) => (
                    <DragItem
                      key={d}
                      active={state.dias.includes(d)}
                      onPointerDown={() => startDrag("dias", i, options.dias)}
                      onPointerEnter={() => enterDrag("dias", i)}>
                      <span className="text-sm font-medium">{DIA_LABELS[d] || d}</span>
                    </DragItem>
                  ))}
                </div>
              </ColSection>

              {/* Horário */}
              <ColSection title="Horário" count={state.horarios.length} onClear={() => clearKey("horarios")}>
                <div className="space-y-1 px-4 py-3">
                  {options.horarios.map((h, i) => (
                    <DragItem
                      key={h}
                      active={state.horarios.includes(h)}
                      onPointerDown={() => startDrag("horarios", i, options.horarios)}
                      onPointerEnter={() => enterDrag("horarios", i)}>
                      <span className="text-sm font-medium tabular-nums">{h}</span>
                    </DragItem>
                  ))}
                </div>
              </ColSection>

              {/* Rodada */}
              <ColSection title="Rodada" count={state.rodadas.length} onClear={() => clearKey("rodadas")}>
                <div className="px-4 py-3 flex flex-wrap gap-1.5">
                  {options.rodadas.map((r, i) => (
                    <div
                      key={r}
                      onPointerDown={(e) => { e.preventDefault(); startDrag("rodadas", i, options.rodadas); }}
                      onPointerEnter={() => enterDrag("rodadas", i)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold cursor-pointer select-none transition-all ${
                        state.rodadas.includes(r)
                          ? "bg-blue-600 text-white"
                          : "bg-white/[0.05] text-white/50 hover:text-white/80 hover:bg-white/10"
                      }`}>
                      {r}
                    </div>
                  ))}
                </div>
              </ColSection>

              {/* Concorrência */}
              <ColSection title="Concorrência" count={state.concorrencia.length} onClear={() => clearKey("concorrencia")}>
                <div className="space-y-1 px-4 py-3">
                  {options.concorrencia.map((n, i) => (
                    <DragItem
                      key={n}
                      active={state.concorrencia.includes(n)}
                      onPointerDown={() => startDrag("concorrencia", i, options.concorrencia)}
                      onPointerEnter={() => enterDrag("concorrencia", i)}>
                      <span className="text-sm font-semibold tabular-nums w-4 text-right">{n}</span>
                      <span className="text-sm text-white/50">{n === 1 ? "concorrente" : "concorrentes"}</span>
                    </DragItem>
                  ))}
                  {options.concorrencia.length === 0 && (
                    <p className="text-xs text-white/25 py-4 text-center">Sem dados</p>
                  )}
                </div>
              </ColSection>

              {/* Times */}
              <ColSection title="Time" count={state.times.length} onClear={() => clearKey("times")}>
                <div className="px-4 pb-1">
                  <input
                    type="text"
                    placeholder="Buscar time..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div className="space-y-0.5 px-4 py-2 overflow-y-auto" style={{ maxHeight: "calc(65vh - 100px)" }}>
                  {filteredTeams.map((t, i) => (
                    <DragItem
                      key={t}
                      active={state.times.includes(t)}
                      onPointerDown={() => startDrag("times", i, filteredTeams)}
                      onPointerEnter={() => enterDrag("times", i)}>
                      <TeamLogo team={t} size={20} className="flex-shrink-0" />
                      <span className="text-sm font-medium">{t}</span>
                    </DragItem>
                  ))}
                  {filteredTeams.length === 0 && (
                    <p className="text-xs text-white/25 py-4 text-center">Nenhum time encontrado</p>
                  )}
                </div>
              </ColSection>
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-white/[0.07]">
              <button onClick={() => setOpen(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ColSection({ title, count, onClear, children }: {
  title: string; count: number; onClear: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
        <p className="text-xs font-semibold text-white/45 uppercase tracking-widest">{title}</p>
        {count > 0 && (
          <button onClick={onClear} className="text-xs text-blue-400/80 hover:text-blue-300 transition-colors ml-2 flex-shrink-0">
            Limpar
          </button>
        )}
      </div>
      <div className="overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  );
}

function DragItem({ active, onPointerDown, onPointerEnter, children }: {
  active: boolean;
  onPointerDown: () => void;
  onPointerEnter: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); onPointerDown(); }}
      onPointerEnter={onPointerEnter}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer select-none transition-all ${
        active
          ? "bg-blue-600/25 text-blue-100 border border-blue-500/35"
          : "text-white/50 hover:text-white/75 hover:bg-white/[0.05] border border-transparent"
      }`}>
      {children}
    </div>
  );
}
