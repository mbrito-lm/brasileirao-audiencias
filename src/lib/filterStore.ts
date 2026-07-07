// Store de filtros em memória (escopo de módulo). Persiste enquanto a aba está
// aberta — sobrevive à navegação entre páginas (SPA), mas zera no reload/F5 ou
// ao fechar a aba, pois o módulo é recarregado do zero.
import type { FilterState } from "@/components/FilterDialog";

const filters = new Map<string, FilterState>();
const searches = new Map<string, string>();

export function getStoredFilters(key: string): FilterState | undefined {
  return filters.get(key);
}
export function saveFilters(key: string, value: FilterState): void {
  filters.set(key, value);
}
export function getStoredSearch(key: string): string {
  return searches.get(key) ?? "";
}
export function saveSearch(key: string, value: string): void {
  searches.set(key, value);
}
