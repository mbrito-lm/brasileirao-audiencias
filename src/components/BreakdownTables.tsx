"use client";
import { Game } from "@/data/games";
import { getMetric, formatMetric, avg } from "@/lib/stats";

interface Props {
  games: Game[];
  detentor: string;
}

const ANOS = [2025, 2026];

function buildTable(
  games: Game[],
  detentor: string,
  keyFn: (g: Game) => string,
  sortFn?: (a: string, b: string) => number
): { key: string; vals: Record<number, number | null> }[] {
  const keys = Array.from(new Set(games.map(keyFn))).sort(sortFn);
  return keys.map((k) => {
    const vals: Record<number, number | null> = {};
    for (const ano of ANOS) {
      const subset = games.filter((g) => keyFn(g) === k && g.ano === ano);
      const metrics = subset.map(getMetric).filter((v): v is number => v !== null);
      vals[ano] = metrics.length ? avg(metrics) : null;
    }
    return { key: k, vals };
  });
}

const DIA_ORDER = ["seg.", "ter.", "qua.", "qui.", "sex.", "sáb.", "dom."];
function sortDia(a: string, b: string) {
  return DIA_ORDER.indexOf(a) - DIA_ORDER.indexOf(b);
}

export default function BreakdownTables({ games, detentor }: Props) {
  const byDia = buildTable(games, detentor, (g) => g.dia, sortDia);
  const byHorario = buildTable(games, detentor, (g) => g.horario.substring(0, 5));
  const byDiaHorario = buildTable(
    games,
    detentor,
    (g) => `${g.dia} ${g.horario.substring(0, 5)}`,
    (a, b) => {
      const [da, ha] = a.split(" ");
      const [db, hb] = b.split(" ");
      const di = DIA_ORDER.indexOf(da) - DIA_ORDER.indexOf(db);
      return di !== 0 ? di : ha.localeCompare(hb);
    }
  );

  const tables = [
    { title: "Por Dia", rows: byDia },
    { title: "Por Horário", rows: byHorario },
    { title: "Dia + Horário", rows: byDiaHorario },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      {tables.map(({ title, rows }) => (
        <div key={title} className="glass rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">{title}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-white/25 uppercase tracking-wider">
                  <th className="px-4 py-2 text-left font-medium"></th>
                  {ANOS.map((a) => (
                    <th key={a} className="px-3 py-2 text-right font-medium">{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ key, vals }) => (
                  <tr key={key} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-white/60 font-medium capitalize whitespace-nowrap">{key}</td>
                    {ANOS.map((a) => (
                      <td key={a} className="px-3 py-2.5 text-right font-bold text-white tabular-nums whitespace-nowrap">
                        {vals[a] !== null ? formatMetric(detentor, vals[a]) : <span className="text-white/20">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
