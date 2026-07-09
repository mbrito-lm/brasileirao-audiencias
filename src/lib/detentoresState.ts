// Estado de UI da página Detentores mantido em memória para sobreviver à
// navegação (ex: abrir um jogo e voltar). Zera no reload/F5.
import type { MetricMode } from "@/lib/stats";

let activeTab: string | null = null;
let mode: MetricMode | null = null;

export const detentoresState = {
  getTab: () => activeTab,
  setTab: (t: string) => { activeTab = t; },
  getMode: () => mode,
  setMode: (m: MetricMode) => { mode = m; },
};
