import type { Frase, Token } from './types';
import { BANCOS } from './bancos';
import { TEMPLATES, type Template } from './templates';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fingerprint(templateId: string, tokens: Token[]): string {
  return (
    templateId +
    '|' +
    tokens
      .filter((t) => !t.pontuacao)
      .map((t) => t.palavra.toLowerCase())
      .join(' ')
  );
}

/** Fingerprints das frases já sorteadas (evita repetição imediata). */
export function fingerprintFrase(frase: Frase): string {
  return fingerprint(frase.id, frase.tokens);
}

function montarTokens(tpl: Template): Token[] {
  const usadosPorBanco = new Map<string, Set<string>>();

  return tpl.slots.map((slot) => {
    if (slot.t === 'pont') {
      return { palavra: slot.p, pontuacao: true };
    }
    if (slot.t === 'fixo') {
      return { palavra: slot.p, classe: slot.c };
    }

    const banco = BANCOS[slot.b];
    if (!banco) {
      console.warn(`[analiseMorfologica] banco inexistente: "${slot.b}"`);
      return { palavra: slot.b, classe: 'substantivo' as const };
    }

    let usados = usadosPorBanco.get(slot.b);
    if (!usados) {
      usados = new Set();
      usadosPorBanco.set(slot.b, usados);
    }

    // Se o mesmo banco aparece duas vezes no template, evita repetir a palavra.
    const livres = banco.palavras.filter((p) => !usados.has(p));
    const pool = livres.length > 0 ? livres : banco.palavras;
    const escolhida = pool[Math.floor(Math.random() * pool.length)];
    usados.add(escolhida);

    return { palavra: escolhida, classe: banco.classe };
  });
}

/**
 * Monta uma frase nova na hora a partir dos templates.
 * `recentes` recebe os fingerprints das últimas frases para evitar repetição.
 */
export function gerarFraseLocal(recentes: string[] = []): Frase {
  const recentesSet = new Set(recentes);
  const ordenados = shuffle(TEMPLATES);

  let ultimo: { tpl: Template; tokens: Token[] } | null = null;

  for (const tpl of ordenados) {
    const tokens = montarTokens(tpl);
    ultimo = { tpl, tokens };
    if (!recentesSet.has(fingerprint(tpl.id, tokens))) {
      return { id: tpl.id, tokens, origem: 'local' };
    }
  }

  // Todos os sorteios recentes — devolve o último mesmo assim.
  return { id: ultimo!.tpl.id, tokens: ultimo!.tokens, origem: 'local' };
}
