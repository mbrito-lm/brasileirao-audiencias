import { Game } from "@/data/games";

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
    .filter((g) => g.detentor === detentor && g.audiencia !== null)
    .map((g) => g.audiencia as number);
  return avg(vals);
}

export function mediaDiaHorario(
  games: Game[],
  detentor: string,
  dia: string,
  horario: string
): number {
  const norm = (h: string) => h.substring(0, 5);
  const vals = games
    .filter(
      (g) =>
        g.detentor === detentor &&
        g.dia === dia &&
        norm(g.horario) === norm(horario) &&
        g.audiencia !== null
    )
    .map((g) => g.audiencia as number);
  return avg(vals);
}

export function mediaTime(games: Game[], detentor: string, time: string): number {
  const vals = games
    .filter((g) => g.detentor === detentor && (g.mandante === time || g.visitante === time) && g.audiencia !== null)
    .map((g) => g.audiencia as number);
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

export function getChartData(
  games: Game[],
  detentor: string | null
): {
  rodada: number;
  "2025": number | null;
  "2026": number | null;
  avg2025: number;
  avg2026: number;
}[] {
  const filtered = detentor ? games.filter((g) => g.detentor === detentor) : games;
  const maxRodada = Math.max(...filtered.map((g) => g.rodada));

  const all2025 = filtered.filter((g) => g.ano === 2025 && g.audiencia !== null).map((g) => g.audiencia as number);
  const all2026 = filtered.filter((g) => g.ano === 2026 && g.audiencia !== null).map((g) => g.audiencia as number);
  const avg2025 = avg(all2025);
  const avg2026 = avg(all2026);

  const result = [];
  for (let r = 1; r <= maxRodada; r++) {
    const g25 = filtered.filter((g) => g.rodada === r && g.ano === 2025 && g.audiencia !== null);
    const g26 = filtered.filter((g) => g.rodada === r && g.ano === 2026 && g.audiencia !== null);
    const v25 = g25.length ? avg(g25.map((g) => g.audiencia as number)) : null;
    const v26 = g26.length ? avg(g26.map((g) => g.audiencia as number)) : null;
    if (v25 !== null || v26 !== null) {
      result.push({ rodada: r, "2025": v25, "2026": v26, avg2025, avg2026 });
    }
  }
  return result;
}

export function getAllTeams(games: Game[]): string[] {
  const teams = new Set<string>();
  games.forEach((g) => { teams.add(g.mandante); teams.add(g.visitante); });
  return Array.from(teams).sort();
}
