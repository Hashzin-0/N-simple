'use client';

// Page automation helper for Gemini Live Voice Agent
// Manages smooth automated scrolling and visual spotlight highlights

export type PageSection = 
  | 'topo'
  | 'abnt'
  | 'presets'
  | 'parametros'
  | 'produtividade'
  | 'solo'
  | 'eficiencia'
  | 'resultados'
  | 'dose_total'
  | 'parcelamento'
  | 'balanco'
  | 'adubos'
  | 'estimativa_milho'
  | 'itr';

const SECTION_ELEMENT_MAP: Record<PageSection, string> = {
  topo: 'app_header',
  abnt: 'abnt_section',
  presets: 'preset_selector',
  parametros: 'form_section',
  produtividade: 'input_group_yield_goal',
  solo: 'input_group_soil',
  eficiencia: 'input_group_efficiency',
  resultados: 'results_section',
  dose_total: 'card_dose_total',
  parcelamento: 'parceling_section',
  balanco: 'balanco_section',
  adubos: 'fertilizer_equivalent_section',
  estimativa_milho: 'corn_yield_calculator_section',
  itr: 'itr_section',
};

// Global active highlight tracker
let currentHighlightedElement: HTMLElement | null = null;
let currentHighlightTimeout: NodeJS.Timeout | null = null;

export function smoothScrollToSection(section: PageSection | string, label?: string): boolean {
  if (typeof window === 'undefined') return false;

  const elementId = SECTION_ELEMENT_MAP[section as PageSection] || section;
  let targetEl = document.getElementById(elementId);

  // Fallbacks if specific element ID is not found
  if (!targetEl) {
    if (section === 'resultados' || section === 'dose_total') {
      targetEl = document.getElementById('card_dose_total') || document.getElementById('results_section');
    } else if (section === 'parametros' || section === 'produtividade') {
      targetEl = document.getElementById('form_section');
    } else if (section === 'parcelamento') {
      targetEl = document.getElementById('parceling_section');
    } else if (section === 'estimativa_milho') {
      targetEl = document.getElementById('corn_yield_calculator_section');
    } else if (section === 'itr') {
      targetEl = document.getElementById('itr_section');
    }
  }

  if (!targetEl) {
    console.warn(`[PageAutomator] Target element not found for section: ${section}`);
    return false;
  }

  // Calculate position with offset so headers don't obscure the element
  const rect = targetEl.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top;
  const offset = 80; // Margin from top viewport
  const scrollTarget = Math.max(0, absoluteTop - offset);

  window.scrollTo({
    top: scrollTarget,
    behavior: 'smooth',
  });

  // Apply visual spotlight effect
  highlightElementWithAura(targetEl, label);

  return true;
}

export function highlightElementWithAura(element: HTMLElement, label?: string): void {
  // Clear previous highlight
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('voice-agent-spotlight-active');
    const existingBadge = currentHighlightedElement.querySelector('.voice-agent-badge');
    if (existingBadge) existingBadge.remove();
  }
  if (currentHighlightTimeout) {
    clearTimeout(currentHighlightTimeout);
  }

  element.classList.add('voice-agent-spotlight-active');

  // Inject a small animated badge showing Puck is adjusting / looking at this
  if (label) {
    const badge = document.createElement('div');
    badge.className = 'voice-agent-badge text-[11px] font-bold bg-[#5A5A40] text-white px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 absolute -top-3 right-4 z-30 animate-bounce pointer-events-none border border-white/30';
    badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-[#82C341] animate-ping"></span><span>Puck: ${label}</span>`;
    element.style.position = element.style.position || 'relative';
    element.appendChild(badge);
  }

  currentHighlightedElement = element;

  currentHighlightTimeout = setTimeout(() => {
    if (element) {
      element.classList.remove('voice-agent-spotlight-active');
      const badge = element.querySelector('.voice-agent-badge');
      if (badge) badge.remove();
    }
    currentHighlightedElement = null;
  }, 4000);
}
