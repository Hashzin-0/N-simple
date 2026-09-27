import { getLibrasSettings, setWidgetEnabled } from '@/hooks/useLibrasSettings';

/**
 * Automação do widget VLibras para a tool de voz `mostrarSinalVLibras`.
 *
 * O VLibras (v7.12.2) expõe `window.VLibrasWidget.open()` (loader) e monta
 * `#vlibras-app-root` com shadow root aberto. Dentro dele: botão de menu
 * `#header-menu-button` → item "Tradutor" → `<textarea id="translator-text">`
 * + botão "Traduzir" (desabilitado com <3 caracteres; debounce de 300 ms).
 * A tradução dispara o player (iframe Unity) e o diálogo fecha sozinho.
 */

declare global {
  interface Window {
    VLibrasWidget?: { path?: string; open?: () => void };
  }
}

export interface VLibrasResult {
  ok: boolean;
  /** Mensagem pronta para a fala do agente. */
  message: string;
  etapa?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let running = false;

async function waitFor<T>(
  fn: () => T | null | undefined | false,
  timeoutMs: number,
  deadline: number,
  stepMs = 100
): Promise<T | null> {
  const limit = Math.min(timeoutMs, Math.max(0, deadline - Date.now()));
  const end = Date.now() + limit;
  for (;;) {
    let v: T | null | undefined | false = null;
    try {
      v = fn();
    } catch {
      /* DOM ainda montando */
    }
    if (v) return v;
    if (Date.now() >= end) return null;
    await sleep(stepMs);
  }
}

function isRendered(el: Element): boolean {
  return el.getClientRects().length > 0;
}

/** Busca em profundidade atravessando shadow roots. */
function deepQueryAll(root: Document | ShadowRoot): Element[] {
  const out: Element[] = [];
  const visit = (r: Document | ShadowRoot) => {
    for (const el of Array.from(r.querySelectorAll('*'))) {
      out.push(el);
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  visit(root);
  return out;
}

function findInShadow(
  root: Document | ShadowRoot | null,
  predicate: (el: HTMLElement) => boolean
): HTMLElement | null {
  if (!root) return null;
  for (const el of deepQueryAll(root)) {
    if (el instanceof HTMLElement && predicate(el)) return el;
  }
  return null;
}

/**
 * Escopos de busca: a raiz pedida (caso esteja destacada do documento) +
 * `document` — `deepQueryAll` já atravessa os shadow roots anexados.
 */
function scopes(root?: Document | ShadowRoot | null): (Document | ShadowRoot)[] {
  const list: (Document | ShadowRoot)[] = [];
  if (root) list.push(root);
  if (root !== document) list.push(document);
  return list;
}

function byId(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (el instanceof HTMLElement) return el;
  for (const scope of scopes(appShadow())) {
    const found = findInShadow(scope, (h) => h.id === id);
    if (found) return found;
  }
  return null;
}

function byText(root: Document | ShadowRoot | null, re: RegExp): HTMLElement | null {
  // prioriza elementos clicáveis
  const clickables = ['button', '[role="button"]', 'a', 'li'];
  for (const scope of scopes(root)) {
    for (const sel of clickables) {
      const found = findInShadow(
        scope,
        (h) => isRendered(h) && h.matches(sel) && re.test((h.textContent || '').trim())
      );
      if (found) return found;
    }
    const any = findInShadow(scope, (h) => isRendered(h) && re.test((h.textContent || '').trim()));
    if (any) return any;
  }
  return null;
}

function byAriaLabel(label: string, root?: Document | ShadowRoot | null): HTMLElement | null {
  for (const scope of scopes(root)) {
    const found = findInShadow(scope, (h) => isRendered(h) && h.getAttribute('aria-label') === label);
    if (found) return found;
  }
  return null;
}

function appShadow(): ShadowRoot | null {
  const root = document.getElementById('vlibras-app-root');
  if (root?.shadowRoot) return root.shadowRoot;
  const wrapper = document.getElementById('vlibras-access-wrapper');
  return wrapper?.shadowRoot ?? null;
}

/** Define valor em <textarea>/<input> respeitando o setter do React. */
function setNativeValue(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Fecha diálogos de boas-vindas/consentimento do widget (melhor esforço). */
function dismissOverlay(root: ShadowRoot | null): boolean {
  // deliberadamente estreito: nunca clicar em "fechar"/"x" (fecharia o widget)
  const btn = byText(root, /^(entendi|ok|ok, entendi|continuar|começar|iniciar|aceitar|concordo)$/i);
  if (!btn) return false;
  btn.click();
  return true;
}

export async function mostrarSinalNoVLibras(palavra: string): Promise<VLibrasResult> {
  const word = palavra.trim();
  if (running) {
    return { ok: false, message: 'Já há uma tradução do VLibras em andamento.', etapa: 'busy' };
  }
  if (word.length < 3) {
    return {
      ok: false,
      message:
        'O tradutor do VLibras precisa de pelo menos 3 letras. Escreva a palavra inteira, por exemplo "adubação".',
      etapa: 'validacao',
    };
  }

  running = true;
  const deadline = Date.now() + 16000;
  try {
    // 1) garante widget ligado
    if (!getLibrasSettings().widgetEnabled) {
      setWidgetEnabled(true);
    }
    await waitFor(
      () => document.getElementById('vlibras-access-wrapper') || window.VLibrasWidget?.open,
      4000,
      deadline
    );
    if (!window.VLibras && !(await waitFor(() => window.VLibras, 5000, deadline))) {
      return {
        ok: false,
        message:
          'O VLibras ainda não carregou no navegador. Tente de novo em alguns segundos.',
        etapa: 'loader',
      };
    }

    // 2) abre a janela do widget
    if (!document.getElementById('vlibras-app-root')) {
      if (window.VLibrasWidget?.open) {
        try {
          window.VLibrasWidget.open();
        } catch {
          /* já aberto */
        }
      } else {
        const initBtn = byId('vlibras-button') || document.querySelector('#vlibras-access-wrapper button');
        if (initBtn instanceof HTMLElement) initBtn.click();
      }
      const opened = await waitFor(
        () => document.getElementById('vlibras-app-root')?.shadowRoot,
        8000,
        deadline,
        150
      );
      if (!opened) {
        return {
          ok: false,
          message: 'Não consegui abrir a janela do VLibras. Clique no ícone VLibras e tente de novo.',
          etapa: 'open',
        };
      }
    }
    await waitFor(() => appShadow(), 3000, deadline);

    let shadow = appShadow();

    // 3) diálogo de boas-vindas (melhor esforço)
    if (!byId('translator-text')) {
      dismissOverlay(shadow);
      await sleep(300);
      shadow = appShadow();
    }

    // 4) menu → Tradutor
    if (!byId('translator-text')) {
      const menu = await waitFor(
        () => byId('header-menu-button') ?? byAriaLabel('Menu de opções', appShadow()),
        4000,
        deadline,
        150
      );
      if (!menu) {
        return {
          ok: false,
          message:
            'Abri o VLibras, mas o botão de menu não apareceu. Abra o VLibras manualmente e escolha "Tradutor".',
          etapa: 'menu',
        };
      }
      // menu já aberto? clicaria de novo e fecharia
      let item = byText(appShadow(), /^tradutor$/i);
      if (!item) {
        menu.click();
        item = await waitFor(() => byText(appShadow(), /^tradutor$/i), 2500, deadline, 150);
      }
      if (item) {
        item.click();
      }
      const ta = await waitFor(() => byId('translator-text'), 6000, deadline, 120);
      if (!ta) {
        return {
          ok: false,
          message:
            'A opção Tradutor do VLibras não abriu. Abra o VLibras e escolha "Tradutor" na tela.',
          etapa: 'tradutor',
        };
      }
    }

    // 5) preenche o campo (debounce de 300 ms → espera 450 ms)
    const textarea = byId('translator-text') as HTMLTextAreaElement | null;
    if (!textarea) {
      return { ok: false, message: 'O campo Tradutor do VLibras sumiu da tela.', etapa: 'textarea' };
    }
    setNativeValue(textarea, word);
    await sleep(450);

    // 6) clica em "Traduzir" (disabled enquanto o debounce de 300 ms roda)
    shadow = appShadow();
    const isDisabled = (b: HTMLElement | null) =>
      b instanceof HTMLButtonElement ? b.disabled : false;
    let traduzir = byText(shadow, /^traduzir$/i);
    if (!traduzir || isDisabled(traduzir)) {
      traduzir = await waitFor(() => {
        const b = byText(appShadow(), /^traduzir$/i);
        return b && !isDisabled(b) ? b : null;
      }, 2500, deadline, 150);
    }
    if (!traduzir) {
      return {
        ok: false,
        message: `Não consegui acionar o VLibras: verifique a palavra "${word}" (mínimo de 3 letras).`,
        etapa: 'traduzir-btn',
      };
    }
    traduzir.click();

    // 7) aguarda o diálogo fechar (tradução disparada)
    const closed = await waitFor(() => (byId('translator-text') ? null : true), 12000, deadline, 200);
    if (!closed) {
      return {
        ok: false,
        message:
          'Cliquei em Traduzir, mas o diálogo continuou aberto. Confira se o VLibras está traduzindo a palavra.',
        etapa: 'submit',
      };
    }

    return {
      ok: true,
      etapa: 'ok',
      message: `Tradutor do VLibras aberto com o sinal de "${word}" — o vídeo já está na tela.`,
    };
  } catch {
    return {
      ok: false,
      message:
        'Algo deu errado ao automatizar o VLibras. Abra o VLibras e escolha "Tradutor" manualmente.',
      etapa: 'erro',
    };
  } finally {
    running = false;
  }
}
