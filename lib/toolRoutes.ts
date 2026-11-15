import type { TabId } from '@/components/GooeyTabPanel';

// A produtividade é uma ferramenta única; a estimativa de soja é um modo dela.
export const TOOL_ROUTES: Record<TabId, string> = {
  nitrogen: '/adubacao-nitrogenada',
  productivity: '/produtividade',
  soja: '/produtividade?cultura=soja',
  itr: '/itr',
  abnt: '/abnt',
  pesquisador: '/pesquisador-agro',
  libras: '/libras-no-agro',
  redacao: '/redacao',
  tutor: '/tutor',
  tratorista: '/mecanizacao-agricola',
  professor: '/professor',
};

export const TAB_BY_TOOL_ROUTE: Record<string, TabId> = {
  'adubacao-nitrogenada': 'nitrogen',
  produtividade: 'productivity',
  itr: 'itr',
  abnt: 'abnt',
  'pesquisador-agro': 'pesquisador',
  'libras-no-agro': 'libras',
  redacao: 'redacao',
  tutor: 'tutor',
  'mecanizacao-agricola': 'tratorista',
  professor: 'professor',
};

export function toolRouteForTab(tab: TabId): string {
  return TOOL_ROUTES[tab];
}
