// Link/slug de um jogo (match): ano+rodada+mandante+visitante, com detentor
// opcional (5º segmento) para saber qual box/ranking abrir primeiro.
// Separador "~" (nomes de clubes/detentores não contêm ~).
interface MatchKey { ano: number; rodada: number; mandante: string; visitante: string }

export function matchSlug(g: MatchKey, detentor?: string): string {
  const base = `${g.ano}~${g.rodada}~${g.mandante}~${g.visitante}`;
  return encodeURIComponent(detentor ? `${base}~${detentor}` : base);
}

export function matchHref(g: MatchKey, detentor?: string): string {
  return `/jogo/${matchSlug(g, detentor)}`;
}

export function parseMatchSlug(id: string): (MatchKey & { detentor?: string }) | null {
  try {
    const parts = decodeURIComponent(id).split("~");
    if (parts.length < 4) return null;
    const ano = parseInt(parts[0], 10);
    const rodada = parseInt(parts[1], 10);
    if (isNaN(ano) || isNaN(rodada)) return null;
    return { ano, rodada, mandante: parts[2], visitante: parts[3], detentor: parts[4] || undefined };
  } catch {
    return null;
  }
}
