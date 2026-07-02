"use client";
import { useState } from "react";
import { Game, SEASON_COLORS } from "@/data/games";
import { getMetric, formatMetric, avg } from "@/lib/stats";

interface Props {
  games: Game[];
  detentor: string;
}

const ANOS = [2025, 2026];
const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];

type SortCol = "geral" | number;
type SortDir = "desc" | "asc";

interface TableRow { key: string; geral: number | null; vals: Record<number, number | null> }

function buildRows(
  games: Game[],
  keyFn: (g: Game) => string,
  sortKeys?: (a: string, b: string) => number
): TableRow[] {
  const keys = Array.from(new Set(games.map(keyFn))).sort(sortKeys);
  return keys.map((k) => {
    const subset = games.filter((g) => keyFn(g) === k);
    const allMetrics = subset.map(getMetric).filter((v): v is number => v !== null);
    const geral = allMetrics.length ? avg(allMetrics) : null;
    const vals: Record<number, number | null> = {};
    for (const ano of ANOS) {
      const m = subset.filter((g) => g.ano === ano).map(getMetric).filter((v): v is number => v !== null);
      vals[ano] = m.length ? avg(m) : null;
    }
    return { key: k, geral, vals };
  });
}

function sortRows(rows: TableRow[], col: SortCol, dir: SortDir): TableRow[] {
  return [...rows].sort((a, b) => {
    const va = col === "geral" ? a.geral : a.vals[col as number];
    const vb = col === "geral" ? b.geral : b.vals[col as number];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir === "desc" ? vb - va : va - vb;
  });
}

function BreakdownTable({ title, rows, detentor }: {
  title: string; rows: TableRow[]; detentor: string;
}) {
  const [sortCol, setSortCol] = useState<SortCol>("geral");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleColClick(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  const sorted = sortRows(rows, sortCol, sortDir);
  const hasMore = sorted.length > 10;

  const ColHeader = ({ col, label, color }: { col: SortCol; label: string; color?: string }) => {
    const active = sortCol === col;
    return (
      <th
        onClick={() => handleColClick(col)}
        className="px-3 py-2.5 text-right font-medium cursor-pointer select-none transition-colors"
        style={{ color: active ? (color || "#ffffff") : "rgba(255,255,255,0.25)" }}>
        {label}
        <span className="ml-1 text-xs opacity-60">{active ? (sortDir === "desc" ? "↓" : "↑") : ""}</span>
      </th>
    );
  };

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">{title}</p>
      </div>
      <div style={{ maxHeight: hasMore ? 320 : undefined, overflowY: hasMore ? "auto" : undefined }}>
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: "rgba(12,14,24,0.95)", backdropFilter: "blur(8px)" }}>
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-white/25"></th>
              <ColHeader col="geral" label="Geral" />
              {ANOS.map((a) => (
                <ColHeader key={a} col={a} label={String(a)} color={SEASON_COLORS[a]} />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ key, geral, vals }) => (
              <tr key={key} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-2.5 text-white/60 font-medium capitalize whitespace-nowrap">{key}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap"
                  style={{ color: sortCol === "geral" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)" }}>
                  {geral !== null ? formatMetric(detentor, geral) : <span className="text-white/15">—</span>}
                </td>
                {ANOS.map((a) => (
                  <td key={a} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap"
                    style={{ color: vals[a] !== null ? (sortCol === a ? SEASON_COLORS[a] : "rgba(255,255,255,0.55)") : "rgba(255,255,255,0.12)" }}>
                    <span className="font-bold">
                      {vals[a] !== null ? formatMetric(detentor, vals[a]) : "—"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BreakdownTables({ games, detentor }: Props) {
  const byDia = buildRows(games, (g) => g.dia, (a, b) => DIA_ORDER.indexOf(a) - DIA_ORDER.indexOf(b));
  const byHorario = buildRows(games, (g) => g.horario.substring(0, 5));
  const byDiaHorario = buildRows(
    games,
    (g) => `${g.dia} ${g.horario.substring(0, 5)}`,
    (a, b) => {
      const [da, ha] = a.split(" ");
      const [db, hb] = b.split(" ");
      const di = DIA_ORDER.indexOf(da) - DIA_ORDER.indexOf(db);
      return di !== 0 ? di : ha.localeCompare(hb);
    }
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <BreakdownTable title="Por Dia" rows={byDia} detentor={detentor} />
      <BreakdownTable title="Por Horário" rows={byHorario} detentor={detentor} />
      <BreakdownTable title="Dia + Horário" rows={byDiaHorario} detentor={detentor} />
    </div>
  );
}
