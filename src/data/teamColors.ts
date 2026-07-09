// Cor de destaque por clube (aproximação da identidade, ajustada para ser
// visível no tema escuro). Clubes preto-e-branco usam um tom claro.
export const TEAM_COLORS: Record<string, string> = {
  "Flamengo": "#E5091E",
  "Palmeiras": "#1CA24A",
  "Corinthians": "#E8E8E8",
  "São Paulo": "#FE0000",
  "Vasco": "#E8E8E8",
  "Cruzeiro": "#2E5BBA",
  "Grêmio": "#2AA1DB",
  "Atlético-MG": "#D1D5DB",
  "Botafogo": "#E8E8E8",
  "Fluminense": "#9E1B32",
  "Bahia": "#1E74D4",
  "Internacional": "#E5050F",
  "Santos": "#E8E8E8",
  "Vitória": "#E10600",
  "Ceará": "#D1D5DB",
  "Fortaleza": "#2360C9",
  "Juventude": "#1DA85A",
  "Mirassol": "#F2C200",
  "Red Bull Bragantino": "#E5091E",
  "Sport": "#E10600",
  "Coritiba": "#12A05C",
  "Athletico": "#E5091E",
  "Athletico-PR": "#E5091E",
  "Chapecoense": "#12A150",
  "Remo": "#1E63C7",
  "Atlético-GO": "#E5091E",
  "Athletic": "#12A150",
  "Athletic Club": "#12A150",
};

export function teamColor(name: string): string {
  return TEAM_COLORS[name] ?? "#3b82f6";
}
