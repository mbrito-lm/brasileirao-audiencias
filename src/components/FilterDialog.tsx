"use client";
import { useEffect, useRef, useState } from "react";

export interface FilterState {
  anos: number[];
  dias: string[];
  horarios: string[];
  rodadas: number[];
  times: string[];
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
  };
}

const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];
const DIA_LABELS: Record<string, string> = {
  "seg.": "Seg", "ter.": "Ter", "qua.": "Qua",
  "qui.": "Qui", "sex.": "Sex", "sáb.": "Sáb", "dom.": "Dom",
};

export default function FilterDialog({ state, onChange, options }: FilterDialogProps) {
  const [open, setOpen] = useState(false);
  const dragging = useRef(false);
  const dragMode = useRef<"add" | "remove">("add");
  const dragKey = useRef<keyof FilterState | null>(null);

  useEffect(() => {
    const up = () => { dragging.current = false; dragKey.current = null; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const totalActive = state.anos.length + state.dias.length + state.horarios.length +
    state.rodadas.length + state.times.length;

  function toggleItem<T>(key: keyof FilterState, val: T) {
    const arr = state[key] as T[];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    onChange({ ...state, [key]: next });
  }

  function startDrag<T>(key: keyof FilterState, val: T) {
    dragging.current = true;
    dragKey.current = key;
    const arr = state[key] as T[];
    dragMode.current = arr.includes(val) ? "remove" : "add";
    toggleItem(key, val);
  }

  function enterDrag<T>(key: keyof FilterState, val: T) {
    if (!dragging.current || dragKey.current !== key) return;
    const arr = state[key] as T[];
    const has = arr.includes(val);
    if (dragMode.current === "add" && !has) toggleItem(key, val);
    if (dragMode.current === "remove" && has) toggleItem(key, val);
  }

  function clearKey(key: keyof FilterState) {
    onChange({ ...state, [key]: [] });
  }

  function clearAll() {
    onChange({ anos: [], dias: [], horarios: [], rodadas: [], times: [] });
  }

  return (
    <>
      {/* Trigger button */}
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

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
          <div className="glass-strong rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden"
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

            {/* Columns */}
            <div className="grid grid-cols-5 divide-x divide-white/[0.06] overflow-y-auto" style={{ maxHeight: "70vh" }}>
              {/* Temporada */}
              <FilterColumn
                title="Temporada"
                count={state.anos.length}
                onClear={() => clearKey("anos")}
              >
                {options.anos.map((a) => (
                  <DragOption
                    key={a}
                    label={String(a)}
                    active={state.anos.includes(a)}
                    onPointerDown={() => startDrag("anos", a)}
                    onPointerEnter={() => enterDrag("anos", a)}
                  />
                ))}
              </FilterColumn>

              {/* Dia */}
              <FilterColumn
                title="Dia"
                count={state.dias.length}
                onClear={() => clearKey("dias")}
              >
                {options.dias.map((d) => (
                  <DragOption
                    key={d}
                    label={DIA_LABELS[d] || d}
                    active={state.dias.includes(d)}
                    onPointerDown={() => startDrag("dias", d)}
                    onPointerEnter={() => enterDrag("dias", d)}
                  />
                ))}
              </FilterColumn>

              {/* Horário */}
              <FilterColumn
                title="Horário"
                count={state.horarios.length}
                onClear={() => clearKey("horarios")}
              >
                {options.horarios.map((h) => (
                  <DragOption
                    key={h}
                    label={h}
                    active={state.horarios.includes(h)}
                    onPointerDown={() => startDrag("horarios", h)}
                    onPointerEnter={() => enterDrag("horarios", h)}
                  />
                ))}
              </FilterColumn>

              {/* Rodada */}
              <FilterColumn
                title="Rodada"
                count={state.rodadas.length}
                onClear={() => clearKey("rodadas")}
              >
                <div className="flex flex-wrap gap-1.5 px-1">
                  {options.rodadas.map((r) => (
                    <DragOption
                      key={r}
                      label={String(r)}
                      active={state.rodadas.includes(r)}
                      onPointerDown={() => startDrag("rodadas", r)}
                      onPointerEnter={() => enterDrag("rodadas", r)}
                      compact
                    />
                  ))}
                </div>
              </FilterColumn>

              {/* Times */}
              <FilterColumn
                title="Time"
                count={state.times.length}
                onClear={() => clearKey("times")}
              >
                {options.times.map((t) => (
                  <DragOption
                    key={t}
                    label={t}
                    active={state.times.includes(t)}
                    onPointerDown={() => startDrag("times", t)}
                    onPointerEnter={() => enterDrag("times", t)}
                  />
                ))}
              </FilterColumn>
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

function FilterColumn({ title, count, onClear, children }: {
  title: string; count: number; onClear: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-0 px-4 py-4">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <p className="text-xs font-semibold text-white/45 uppercase tracking-widest">{title}</p>
        {count > 0 && (
          <button onClick={onClear} className="text-xs text-blue-400/70 hover:text-blue-300 transition-colors ml-2">
            Limpar
          </button>
        )}
      </div>
      <div className="space-y-1 select-none">
        {children}
      </div>
    </div>
  );
}

function DragOption({ label, active, onPointerDown, onPointerEnter, compact }: {
  label: string; active: boolean; compact?: boolean;
  onPointerDown: () => void; onPointerEnter: () => void;
}) {
  return (
    <div
      onPointerDown={(e) => { e.preventDefault(); onPointerDown(); }}
      onPointerEnter={onPointerEnter}
      className={`cursor-pointer rounded-lg text-xs font-medium transition-all select-none ${
        compact
          ? `w-8 h-7 flex items-center justify-center ${active ? "bg-blue-600 text-white" : "bg-white/[0.05] text-white/40 hover:text-white/65"}`
          : `px-3 py-2 ${active ? "bg-blue-600/25 text-blue-200 border border-blue-500/35" : "text-white/45 hover:text-white/70 hover:bg-white/[0.04] border border-transparent"}`
      }`}>
      {label}
    </div>
  );
}
