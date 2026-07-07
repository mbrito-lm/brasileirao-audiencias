// Reconciliação de audiência: converte pontos por praça em pontos PNT
// (audiência domiciliar consolidada) e em espectadores absolutos (indivíduos).
//
// Método validado contra os números do dashboard: erro máximo de 0,04% em 28
// jogos da Globo de 2025.
//   - Pontos PNT (domiciliar) = Σ (pts_domiciliar_praça × peso_praça)
//   - Espectadores (indivíduos) = Σ (pts_individual_praça × valor_individuo_praça)
//   - peso_praça = domicílios_por_ponto_praça ÷ domicílios_por_ponto_PNT
//
// Fonte dos valores: tabela oficial "Valores do ponto no IBOPE" (Kantar), por ano.

export const PRACAS = [
  "SP", "CAM", "RJ", "BH", "VIT", "POA", "CUR", "FLO", "GOI", "DF", "SAL", "FOR", "REC", "BEL", "MAN",
] as const;
export type Praca = (typeof PRACAS)[number];

export interface PontoValor {
  /** Pessoas por ponto na audiência domiciliar (domicílios). */
  domicilio: number;
  /** Pessoas por ponto na audiência individual (espectadores). */
  individuo: number;
}

// Valor do ponto por praça e por ano. "PNT" = consolidado nacional (15 regiões).
export const PONTO_VALOR: Record<number, Record<Praca | "PNT", PontoValor>> = {
  2025: {
    PNT: { domicilio: 270631, individuo: 692281 },
    SP:  { domicilio: 77488,  individuo: 199313 },
    CAM: { domicilio: 8497,   individuo: 21982 },
    RJ:  { domicilio: 48836,  individuo: 120893 },
    BH:  { domicilio: 21482,  individuo: 54854 },
    VIT: { domicilio: 7203,   individuo: 18142 },
    POA: { domicilio: 15584,  individuo: 37647 },
    CUR: { domicilio: 12352,  individuo: 31671 },
    FLO: { domicilio: 5182,   individuo: 12734 },
    GOI: { domicilio: 9639,   individuo: 24639 },
    DF:  { domicilio: 9994,   individuo: 26385 },
    SAL: { domicilio: 13231,  individuo: 31896 },
    FOR: { domicilio: 13232,  individuo: 35119 },
    REC: { domicilio: 13768,  individuo: 35202 },
    BEL: { domicilio: 7412,   individuo: 21687 },
    MAN: { domicilio: 6729,   individuo: 20117 },
  },
  2026: {
    PNT: { domicilio: 277669, individuo: 699961 },
    SP:  { domicilio: 78780,  individuo: 199632 },
    CAM: { domicilio: 8760,   individuo: 22271 },
    RJ:  { domicilio: 49778,  individuo: 122053 },
    BH:  { domicilio: 22184,  individuo: 55330 },
    VIT: { domicilio: 7310,   individuo: 18461 },
    POA: { domicilio: 15960,  individuo: 37513 },
    CUR: { domicilio: 12511,  individuo: 32039 },
    FLO: { domicilio: 5672,   individuo: 13640 },
    GOI: { domicilio: 10109,  individuo: 25019 },
    DF:  { domicilio: 10033,  individuo: 26505 },
    SAL: { domicilio: 13793,  individuo: 32968 },
    FOR: { domicilio: 13722,  individuo: 35676 },
    REC: { domicilio: 14117,  individuo: 35792 },
    BEL: { domicilio: 7765,   individuo: 22460 },
    MAN: { domicilio: 7168,   individuo: 20595 },
  },
};

/** Audiência de um jogo por praça, em pontos (domiciliar e individual). */
export type PracaAudiencia = Partial<Record<Praca, { dom: number; ind: number }>>;

/** Peso da praça no PNT = participação dela nos domicílios do painel. */
export function pesoPraca(ano: number, praca: Praca): number {
  const t = PONTO_VALOR[ano];
  if (!t) return 0;
  return t[praca].domicilio / t.PNT.domicilio;
}

/** Pontos PNT (audiência domiciliar consolidada) de um jogo. */
export function pontosPNT(ano: number, aud: PracaAudiencia): number {
  const t = PONTO_VALOR[ano];
  if (!t) return 0;
  let soma = 0;
  for (const p of PRACAS) {
    const a = aud[p];
    if (a) soma += a.dom * pesoPraca(ano, p);
  }
  return soma;
}

/** Espectadores (indivíduos) de um jogo = Σ pts_individual_praça × valor_individuo_praça. */
export function espectadores(ano: number, aud: PracaAudiencia): number {
  const t = PONTO_VALOR[ano];
  if (!t) return 0;
  let soma = 0;
  for (const p of PRACAS) {
    const a = aud[p];
    if (a) soma += a.ind * t[p].individuo;
  }
  return Math.round(soma);
}

/**
 * Espectadores para emissoras sem breakdown por praça (SporTV, Premiere):
 * aproxima por pontos PNT × valor do ponto individual nacional.
 */
export function espectadoresDePontos(ano: number, pontos: number): number {
  const t = PONTO_VALOR[ano];
  if (!t) return 0;
  return Math.round(pontos * t.PNT.individuo);
}
