import type { TabId } from '@/components/GooeyTabPanel';

export const TOOL_ROUTES: Record<TabId, string> = {
  nitrogen: '/adubacao-nitrogenada',
  productivity: '/produtividade',
  soja: '/produtividade-soja',
  itr: '/itr',
  abnt: '/abnt',
  pesquisador: '/pesquisador-agro',
  libras: '/libras-no-agro',
  redacao: '/redacao',
  tutor: '/tutor',
  tratorista: '/mecanizacao-agricola',
  professor: '/professor',
};

export const TAB_BY_TOOL_ROUTE: Record<string, TabId> = Object.fromEntries(
  Object.entries(TOOL_ROUTES).map(([tab, route]) => [route.slice(1), tab as TabId]),
) as Record<string, TabId>;

export function toolRouteForTab(tab: TabId): string {
  return TOOL_ROUTES[tab];
}
