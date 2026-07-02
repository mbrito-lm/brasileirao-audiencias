import { Game } from "@/data/games";

export const PNT_DETENTORES = new Set(["Record", "Premiere", "SporTV"]);

export function normalizeHorario(h: string): string {
  const colon = h.indexOf(":");
  if (colon < 0) return h;
  const hh = parseInt(h.slice(0, colon), 10);
  const mm = parseInt(h.slice(colon + 1, colon + 3), 10);
  if (isNaN(hh) || isNaN(mm)) return h;
  if (mm < 15) return `${String(hh).padStart(2, "0")}:00`;
  if (mm < 45) return `${String(hh).padStart(2, "0")}:30`;
  return `${String((hh + 1) % 24).padStart(2, "0")}:00`;
}

export function getMetric(game: Game): number | null {
  if (PNT_DETENTORES.has(game.detentor)) {
    return game.pnt ?? game.audiencia;
  }
  return game.audiencia;
}

export function formatMetric(detentor: string, value: number | null): string {
  if (value === null) return "—";
  if (PNT_DETENTORES.has(detentor)) {
    return value.toFixed(1).replace(".", ",") + " pts";
  }
  return formatAudiencia(value);
}

export function metricLabel(detentor: string | null): string {
  if (detentor && PNT_DETENTORES.has(detentor)) return "Pontos (PNT)";
  return "Espectadores";
}

export function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function deltaPercent(value: number, mean: number): number | null {
  if (!mean) return null;
  return ((value - mean) / mean) * 100;
}

export function mediaDetentor(games: Game[], detentor: string): number {
  const vals = games
    .filter((g) => g.detentor === detentor && getMetric(g) !== null)
    .map((g) => getMetric(g) as number);
  return avg(vals);
}

export function mediaDiaHorario(games: Game[], detentor: string, dia: string, horario: string): number {
  const norm = (h: string) => normalizeHorario(h.substring(0, 5));
  const vals = games
    .filter((g) => g.detentor === detentor && g.dia === dia && norm(g.horario) === norm(horario) && getMetric(g) !== null)
    .map((g) => getMetric(g) as number);
  return avg(vals);
}

export function mediaTime(games: Game[], detentor: string, time: string): number {
  const vals = games
    .filter((g) => g.detentor === detentor && (g.mandante === time || g.visitante === time) && getMetric(g) !== null)
    .map((g) => getMetric(g) as number);
  return avg(vals);
}

export function mediaTimes(games: Game[], detentor: string, mandante: string, visitante: string): number {
  const m = mediaTime(games, detentor, mandante);
  const v = mediaTime(games, detentor, visitante);
  if (!m && !v) return 0;
  if (!m) return v;
  if (!v) return m;
  return (m + v) / 2;
}

export function formatAudiencia(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(".", ",") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return n.toString();
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

export function deltaClass(delta: number | null): string {
  if (delta === null) return "text-gray-600";
  if (delta > 10) return "text-emerald-400";
  if (delta > 0) return "text-emerald-500/70";
  if (delta < -10) return "text-red-400";
  return "text-red-500/70";
}

export function parseDate(dateStr: string): number {
  const [d, m, y] = dateStr.split("/");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
}

export interface ChartTeam { mandante: string; visitante: string }

export function getChartData(
  games: Game[],
  detentor: string | null
): { rodada: number; "2025": number | null; "2026": number | null; avg2025: number; avg2026: number; missing2025: boolean; missing2026: boolean; teams25: ChartTeam[]; teams26: ChartTeam[] }[] {
  const filtered = detentor ? games.filter((g) => g.detentor === detentor) : games.filter((g) => !PNT_DETENTORES.has(g.detentor));
  const maxRodada = filtered.length ? Math.max(...filtered.map((g) => g.rodada)) : 0;

  const all25 = filtered.filter((g) => g.ano === 2025 && getMetric(g) !== null).map((g) => getMetric(g) as number);
  const all26 = filtered.filter((g) => g.ano === 2026 && getMetric(g) !== null).map((g) => getMetric(g) as number);
  const avg2025 = avg(all25);
  const avg2026 = avg(all26);

  const minRodada = 1;

  const result = [];
  for (let r = minRodada; r <= maxRodada; r++) {
    const all25 = filtered.filter((g) => g.rodada === r && g.ano === 2025);
    const all26 = filtered.filter((g) => g.rodada === r && g.ano === 2026);
    const g25 = all25.filter((g) => getMetric(g) !== null);
    const g26 = all26.filter((g) => getMetric(g) !== null);
    const v25 = g25.length ? avg(g25.map((g) => getMetric(g) as number)) : null;
    const v26 = g26.length ? avg(g26.map((g) => getMetric(g) as number)) : null;
    const missing2025 = all25.length > 0 && g25.length === 0;
    const missing2026 = all26.length > 0 && g26.length === 0;
    const teams25: ChartTeam[] = g25.map((g) => ({ mandante: g.mandante, visitante: g.visitante }));
    const teams26: ChartTeam[] = g26.map((g) => ({ mandante: g.mandante, visitante: g.visitante }));

    if (detentor) {
      // In detentor view, include every rodada in range so gaps appear on the x-axis
      result.push({ rodada: r, "2025": v25, "2026": v26, avg2025, avg2026, missing2025, missing2026, teams25, teams26 });
    } else if (v25 !== null || v26 !== null || missing2025 || missing2026) {
      result.push({ rodada: r, "2025": v25, "2026": v26, avg2025, avg2026, missing2025, missing2026, teams25, teams26 });
    }
  }
  return result;
}

export function getAllTeams(games: Game[]): string[] {
  const teams = new Set<string>();
  games.forEach((g) => { teams.add(g.mandante); teams.add(g.visitante); });
  return Array.from(teams).sort();
}
