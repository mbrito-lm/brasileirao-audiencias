// Link/slug de um jogo (match), identificado por ano+rodada+mandante+visitante.
// Usa "~" como separador (nomes de clubes não contêm ~) e encoda para a URL.
interface MatchKey { ano: number; rodada: number; mandante: string; visitante: string }

export function matchSlug(g: MatchKey): string {
  return encodeURIComponent(`${g.ano}~${g.rodada}~${g.mandante}~${g.visitante}`);
}

export function matchHref(g: MatchKey): string {
  return `/jogo/${matchSlug(g)}`;
}

export function parseMatchSlug(id: string): MatchKey | null {
  try {
    const parts = decodeURIComponent(id).split("~");
    if (parts.length !== 4) return null;
    const ano = parseInt(parts[0], 10);
    const rodada = parseInt(parts[1], 10);
    if (isNaN(ano) || isNaN(rodada)) return null;
    return { ano, rodada, mandante: parts[2], visitante: parts[3] };
  } catch {
    return null;
  }
}
