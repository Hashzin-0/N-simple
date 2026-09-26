import type { ComponentType, CSSProperties } from 'react';
import type { TabId } from '@/components/GooeyTabPanel';
import {
  FolderGit2,
  Sliders,
  Sparkles,
  Layers,
  Scale,
  Calculator,
  LayoutDashboard,
  AlertTriangle,
  Eye,
  Trophy,
  Landmark,
  FileText,
  BookOpen,
  ScanSearch,
  Search,
  Globe,
  Hand,
  Camera,
  PenTool,
  GraduationCap,
  MessagesSquare,
  Library,
  Languages,
} from 'lucide-react';

export interface SectionConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color: string;
  colorDark: string;
}

/**
 * Catálogo único das seções do SectionNavGooey.
 * Fonte de verdade para o nav lateral/topo E para a tool de voz
 * `scrollToSection` (Global e Tutor) — id = âncora no DOM.
 */
export const SECTIONS_BY_TAB: Record<TabId, SectionConfig[]> = {
  nitrogen: [
    { id: 'preset_selector', label: 'Cenários', shortLabel: 'Cenários', icon: FolderGit2, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'form_section', label: 'Parâmetros', shortLabel: 'Parâmetros', icon: Sliders, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'results_section', label: 'Resultados', shortLabel: 'Resultados', icon: Sparkles, color: '#2E6F40', colorDark: '#86efac' },
    { id: 'parceling_section', label: 'Parcelamento', shortLabel: 'Parcelamento', icon: Layers, color: '#D4A373', colorDark: '#D4A373' },
    { id: 'balanco_section', label: 'Balanço', shortLabel: 'Balanço', icon: Scale, color: '#2E6F40', colorDark: '#86efac' },
    { id: 'detailed_math_panel', label: 'Fórmulas', shortLabel: 'Fórmulas', icon: Calculator, color: '#8D6E63', colorDark: '#CBB5A1' },
  ],
  productivity: [
    { id: 'corn_yield_header', label: 'Visão Geral', shortLabel: 'Visão', icon: LayoutDashboard, color: '#C19262', colorDark: '#D4A373' },
    { id: 'corn_yield_params', label: 'Parâmetros', shortLabel: 'Parâmetros', icon: Sliders, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'corn_yield_visual', label: 'Visual 3D', shortLabel: 'Visual', icon: Eye, color: '#C19262', colorDark: '#D4A373' },
    { id: 'corn_yield_results', label: 'Resultados', shortLabel: 'Resultados', icon: Trophy, color: '#2E6F40', colorDark: '#86efac' },
  ],
  itr: [
    { id: 'itr_section', label: 'Cálculo ITR', shortLabel: 'ITR', icon: Landmark, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'itr_params_section', label: 'Parâmetros VTN', shortLabel: 'Parâmetros', icon: Sliders, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'itr_results_section', label: 'Demonstrativo', shortLabel: 'Demonstrativo', icon: FileText, color: '#2E6F40', colorDark: '#86efac' },
  ],
  abnt: [
    { id: 'abnt_section', label: 'Referências ABNT', shortLabel: 'ABNT', icon: BookOpen, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'bibliography_autodetect', label: 'Detector Fontes', shortLabel: 'Detector', icon: ScanSearch, color: '#2E6F40', colorDark: '#86efac' },
    { id: 'analise_morfologica', label: 'Análise Morfológica', shortLabel: 'Morfologia', icon: Languages, color: '#D4A373', colorDark: '#D4A373' },
  ],
  pesquisador: [
    { id: 'pesquisador_fontes', label: 'Pesquisador de Fontes', shortLabel: 'Fontes', icon: Search, color: '#2E6F40', colorDark: '#86efac' },
    { id: 'pesquisador_portais', label: 'Portais Confiáveis', shortLabel: 'Portais', icon: Globe, color: '#D4A373', colorDark: '#D4A373' },
    { id: 'pesquisador_automatico', label: 'Pesquisador Automático', shortLabel: 'Artigo ABNT', icon: Sparkles, color: '#5A5A40', colorDark: '#9CB386' },
  ],
  libras: [
    { id: 'libras_search', label: 'Buscar Sinais', shortLabel: 'Buscar', icon: Search, color: '#2E6F40', colorDark: '#86efac' },
    { id: 'librascurso', label: 'Mini-Curso', shortLabel: 'Curso', icon: BookOpen, color: '#D4A373', colorDark: '#D4A373' },
    { id: 'libras_practice', label: 'Praticar', shortLabel: 'Praticar', icon: Hand, color: '#9CB386', colorDark: '#86efac' },
    { id: 'libras_tutor', label: 'Tutor', shortLabel: 'Tutor', icon: Sparkles, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'libras_capture_test', label: 'Teste Câmera', shortLabel: 'Câmera', icon: Camera, color: '#5A5A40', colorDark: '#9CB386' },
  ],
  redacao: [
    { id: 'redacao_tema', label: 'Tema', shortLabel: 'Tema', icon: PenTool, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'redacao_repertorio', label: 'Repertório', shortLabel: 'Repertório', icon: BookOpen, color: '#2E6F40', colorDark: '#86efac' },
    { id: 'redacao_expressoes', label: 'Expressões', shortLabel: 'Expressões', icon: Sparkles, color: '#D4A373', colorDark: '#D4A373' },
    { id: 'redacao_estrutura', label: 'Estrutura', shortLabel: 'Estrutura', icon: Layers, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'redacao_resultado', label: 'Resultado', shortLabel: 'Resultado', icon: FileText, color: '#2E6F40', colorDark: '#86efac' },
  ],
  tutor: [
    { id: 'tutor_tema', label: 'Sessão', shortLabel: 'Sessão', icon: GraduationCap, color: '#2E6F40', colorDark: '#86efac' },
    { id: 'tutor_session', label: 'Progresso', shortLabel: 'Progresso', icon: Trophy, color: '#5A5A40', colorDark: '#9CB386' },
    { id: 'tutor_research', label: 'Questões', shortLabel: 'Questões', icon: Library, color: '#D4A373', colorDark: '#D4A373' },
    { id: 'tutor_progress', label: 'Desempenho', shortLabel: 'Desempenho', icon: MessagesSquare, color: '#2E6F40', colorDark: '#9CB386' },
  ],
};

export const ALL_NAV_SECTIONS: SectionConfig[] = Object.values(SECTIONS_BY_TAB).flat();

/** Mapa id da seção → aba que a contém. */
export const NAV_SECTION_TAB: Record<string, TabId> = Object.fromEntries(
  (Object.entries(SECTIONS_BY_TAB) as Array<[TabId, SectionConfig[]]>).flatMap(([tab, sections]) =>
    sections.map((s) => [s.id, tab])
  )
);

/** Aliases legados (PageSection) → aba; null = elemento de página (sem troca). */
export const LEGACY_SECTION_TAB: Record<string, TabId | null> = {
  topo: null,
  estimativa_milho: 'productivity',
  itr: 'itr',
  abnt: 'abnt',
};

/** Aba de uma seção (id do nav ou alias legado). Padrão: nitrogen. */
export function tabForSection(section: string): TabId | null {
  if (section in LEGACY_SECTION_TAB) return LEGACY_SECTION_TAB[section];
  return NAV_SECTION_TAB[section] ?? 'nitrogen';
}

const TAB_LABELS_PT: Record<TabId, string> = {
  nitrogen: 'Adubação Nitrogenada',
  productivity: 'Produtividade de Milho',
  itr: 'Calculadora ITR',
  abnt: 'Referências ABNT',
  pesquisador: 'Pesquisador Agro',
  libras: 'Libras no Agro',
  redacao: 'Pesquisador de Redação',
  tutor: 'Tutor Inteligente',
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export interface ResolvedSection {
  id: string;
  label: string;
  tab: TabId;
}

/**
 * Resolve uma entrada vinda da voz (id, label, label sem acento...)
 * para a seção canônica do catálogo. Retorna null se não existir —
 * incluindo nomes de aba ("tutor", "libras"...), que não são seções:
 * o caller responde com a lista de seções / opção de trocar de aba.
 */
export function resolveSection(input: string): ResolvedSection | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const n = norm(raw);

  const tabNames = new Set(
    [...Object.keys(SECTIONS_BY_TAB), ...Object.values(TAB_LABELS_PT)].map(norm)
  );
  if (tabNames.has(n)) return null;

  const all = (Object.entries(SECTIONS_BY_TAB) as Array<[TabId, SectionConfig[]]>).flatMap(
    ([tab, sections]) => sections.map((s) => ({ s, tab }))
  );

  // 1ª passada: id (exato ou normalizado) — tem precedência sobre labels.
  for (const { s, tab } of all) {
    if (s.id === raw || norm(s.id) === n) return { id: s.id, label: s.label, tab };
  }
  // 2ª passada: label / shortLabel.
  for (const { s, tab } of all) {
    if (norm(s.label) === n || norm(s.shortLabel) === n) return { id: s.id, label: s.label, tab };
  }
  return null;
}

/** Lista "aba: id (label)" para a descrição da tool de voz. */
export function describeSections(): string {
  return (Object.entries(SECTIONS_BY_TAB) as Array<[TabId, SectionConfig[]]>)
    .map(([tab, sections]) =>
      `${TAB_LABELS_PT[tab]}: ${sections.map((s) => `${s.id} (${s.label})`).join(', ')}`
    )
    .join('; ');
}
