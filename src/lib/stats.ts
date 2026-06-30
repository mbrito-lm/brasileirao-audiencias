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
  const normalizeHorario = (h: string) => h.substring(0, 5);
  const vals = games
    .filter(
      (g) =>
        g.detentor === detentor &&
        g.dia === dia &&
        normalizeHorario(g.horario) === normalizeHorario(horario) &&
        g.audiencia !== null
    )
    .map((g) => g.audiencia as number);
  return avg(vals);
}

export function mediaTime(games: Game[], detentor: string, time: string): number {
  const vals = games
    .filter(
      (g) =>
        g.detentor === detentor &&
        (g.mandante === time || g.visitante === time) &&
        g.audiencia !== null
    )
    .map((g) => g.audiencia as number);
  return avg(vals);
}

export function mediaTimes(
  games: Game[],
  detentor: string,
  mandante: string,
  visitante: string
): number {
  const mMedia = mediaTime(games, detentor, mandante);
  const vMedia = mediaTime(games, detentor, visitante);
  if (!mMedia && !vMedia) return 0;
  if (!mMedia) return vMedia;
  if (!vMedia) return mMedia;
  return (mMedia + vMedia) / 2;
}

export function formatAudiencia(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(".", ",") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toString();
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

export function deltaClass(delta: number | null): string {
  if (delta === null) return "text-gray-500";
  if (delta > 5) return "text-green-400";
  if (delta < -5) return "text-red-400";
  return "text-yellow-400";
}

export function getChartData(
  games: Game[],
  detentor: string | null
): { rodada: number; "2025": number | null; "2026": number | null }[] {
  const filteredGames = detentor
    ? games.filter((g) => g.detentor === detentor)
    : games;

  const maxRodada = Math.max(...filteredGames.map((g) => g.rodada));
  const result = [];

  for (let r = 1; r <= maxRodada; r++) {
    const games2025 = filteredGames.filter(
      (g) => g.rodada === r && g.ano === 2025 && g.audiencia !== null
    );
    const games2026 = filteredGames.filter(
      (g) => g.rodada === r && g.ano === 2026 && g.audiencia !== null
    );

    const val2025 = games2025.length ? avg(games2025.map((g) => g.audiencia as number)) : null;
    const val2026 = games2026.length ? avg(games2026.map((g) => g.audiencia as number)) : null;

    if (val2025 !== null || val2026 !== null) {
      result.push({ rodada: r, "2025": val2025, "2026": val2026 });
    }
  }

  return result;
}

export function getAllTeams(games: Game[]): string[] {
  const teams = new Set<string>();
  games.forEach((g) => {
    teams.add(g.mandante);
    teams.add(g.visitante);
  });
  return Array.from(teams).sort();
}
