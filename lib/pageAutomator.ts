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
  | 'fonte_nitrogenada'
  | 'parcelamento'
  | 'balanco'
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
  fonte_nitrogenada: 'fonte_nitrogenada_section',
  parcelamento: 'parceling_section',
  balanco: 'balanco_section',
  estimativa_milho: 'corn_yield_calculator_section',
  itr: 'itr_section',
};

/** Id do DOM de uma seção (alias legado → id real; id do nav → ele mesmo). */
export function resolveSectionElementId(section: PageSection | string): string {
  return SECTION_ELEMENT_MAP[section as PageSection] || section;
}

/** true se a seção é um alias legado válido (PageSection). */
export function isPageSection(section: string): boolean {
  return section in SECTION_ELEMENT_MAP;
}

// Global active highlight tracker
let currentHighlightedElement: HTMLElement | null = null;
let currentHighlightTimeout: NodeJS.Timeout | null = null;

/**
 * Espera o elemento existir no DOM (usado após troca de aba — o conteúdo
 * da aba destino só monta depois do re-render). Polling leve por rAF com
 * fallback de timer; sem delay fixo: rola no primeiro frame em que a
 * seção aparece.
 */
export function waitForElement(elementId: string, timeoutMs = 2000): Promise<HTMLElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const existing = document.getElementById(elementId);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const start = performance.now();
    let rafId = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const finish = (el: HTMLElement | null) => {
      if (rafId) cancelAnimationFrame(rafId);
      if (timerId) clearTimeout(timerId);
      resolve(el);
    };

    const tick = () => {
      const el = document.getElementById(elementId);
      if (el) return finish(el);
      if (performance.now() - start >= timeoutMs) return finish(null);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    // Fallback caso o browser pause rAF (aba em background).
    timerId = setTimeout(() => {
      finish(document.getElementById(elementId));
    }, timeoutMs + 50);
  });
}

export function smoothScrollToSection(section: PageSection | string, label?: string): boolean {
  if (typeof window === 'undefined') return false;

  const elementId = resolveSectionElementId(section);
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
