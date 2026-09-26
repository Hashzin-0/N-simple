import type { ClasseGramatical, Token } from './types';

type ClasseKey =
  | 'substantivo'
  | 'verbo'
  | 'adjetivo'
  | 'adverbio'
  | 'artigo'
  | 'numeral'
  | 'preposicao'
  | 'conjuncao'
  | 'pronome'
  | 'interjeicao';

const MAP: Record<ClasseKey, ClasseGramatical> = {
  substantivo: 'substantivo',
  verbo: 'verbo',
  adjetivo: 'adjetivo',
  adverbio: 'advérbio',
  artigo: 'artigo',
  numeral: 'numeral',
  preposicao: 'preposição',
  conjuncao: 'conjunção',
  pronome: 'pronome',
  interjeicao: 'interjeição',
};

const KEYS: ClasseKey[] = [
  'substantivo',
  'verbo',
  'adjetivo',
  'adverbio',
  'artigo',
  'numeral',
  'preposicao',
  'conjuncao',
  'pronome',
  'interjeicao',
];

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarClasse(raw: unknown): ClasseGramatical | null {
  if (typeof raw !== 'string') return null;
  const s = semAcento(raw.toLowerCase().trim());

  if (s === 'nome' || s === 'nomes') return 'substantivo';
  if (s === 'adverbio' || s === 'adverbial') return 'advérbio';

  const direto = KEYS.find((k) => s === k);
  if (direto) return MAP[direto];

  // Formas como "pronome pessoal", "conjunção coordenativa", "artigo definido"...
  const contido = KEYS.find((k) => s.includes(k));
  return contido ? MAP[contido] : null;
}

const PONT_EXTREMO_INICIO = /^[\s.,;:!?…—–"'“”«»()[\]]*/;
const PONT_EXTREMO_FIM = /[\s.,;:!?…—–"'“”«»()[\]]*$/;
const SO_PONTUACAO = /^[\s.,;:!?…—–"'“”«»()[\]]+$/;

function quebrarPalavra(palavra: string, classe: ClasseGramatical): Token[] {
  const bruto = palavra.trim();
  if (!bruto) return [];
  if (SO_PONTUACAO.test(bruto)) return [{ palavra: bruto, pontuacao: true }];

  const inicio = bruto.match(PONT_EXTREMO_INICIO)?.[0] ?? '';
  const fim = bruto.match(PONT_EXTREMO_FIM)?.[0] ?? '';
  const nucleo = bruto.slice(inicio.length, bruto.length - fim.length);

  const out: Token[] = [];
  if (inicio.trim()) out.push({ palavra: inicio.trim(), pontuacao: true });
  if (nucleo) out.push({ palavra: nucleo, classe });
  if (fim.trim()) out.push({ palavra: fim.trim(), pontuacao: true });
  return out.filter((t) => t.palavra.length > 0);
}

export function montarPromptIA(): string {
  return [
    'Você é um professor de Língua Portuguesa. Gere UMA frase em português do Brasil para um exercício interativo de análise morfológica.',
    '',
    'Responda SOMENTE com JSON válido (sem markdown, sem comentários), no formato:',
    '{"tokens":[{"palavra":"O","classe":"artigo"},{"palavra":"menina","classe":"substantivo"}]}',
    '',
    'Regras:',
    '1. A frase deve ter entre 6 e 9 palavras que possuem classe gramatical.',
    '2. Cada "palavra" é UM único token: sem espaços e sem pontuação (a pontuação é opcional e pode ser um token separado como "," ou "." com "classe": "pontuacao").',
    '3. "classe" deve ser EXATAMENTE um de: substantivo, verbo, adjetivo, advérbio, artigo, numeral, preposição, conjunção, pronome, interjeição.',
    '4. Inclua pelo menos um verbo, um advérbio e uma preposição ou conjunção, além de artigo ou pronome.',
    '5. Use apenas palavras cuja classe seja inequívoca no contexto (evite "que", "muito", "antes", "a" como preposição e "se" reflexivo).',
    '6. A frase deve ser gramaticalmente correta, natural e com sentido completo.',
    '7. Não use contrações (no, na, do, da, pelo, pela...): se houver preposição e artigo, separe em tokens distintos (ex.: "em" e "a").',
    '8. Sem palavras repetidas e sem nomes próprios.',
  ].join('\n');
}

/**
 * Valida e normaliza a frase vinda da IA.
 * Retorna null se o JSON estiver malformado ou fora dos padrões —
 * o chamador deve cair na geração local.
 */
export function parsearFraseIA(texto: string): Token[] | null {
  try {
    const limpo = texto.replace(/```(?:json)?/gi, '');
    const match = limpo.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const data = JSON.parse(match[0]) as { tokens?: unknown };
    const bruto = Array.isArray(data.tokens) ? data.tokens : null;
    if (!bruto || bruto.length === 0) return null;

    const tokens: Token[] = [];

    for (const item of bruto) {
      if (typeof item !== 'object' || item === null) return null;
      const { palavra, classe } = item as { palavra?: unknown; classe?: unknown };

      if (typeof palavra !== 'string') return null;
      const p = palavra.trim();
      if (!p) continue; // token vazio vindo da IA: ignora
      if (/\s/.test(p)) return null;

      // Pontuação vinda da IA (classe "pontuacao" ou palavra só de pontuação)
      const soPontuacao = /^[.,;:!?…—–]+$/.test(p);
      if (soPontuacao || semAcento(String(classe ?? '')).toLowerCase() === 'pontuacao') {
        tokens.push({ palavra: p, pontuacao: true });
        continue;
      }

      const classeNorm = normalizarClasse(classe);
      if (!classeNorm) return null;

      const quebrados = quebrarPalavra(p, classeNorm);
      if (quebrados.length === 0) return null;
      tokens.push(...quebrados);
    }

    const clicaveis = tokens.filter((t) => !t.pontuacao);
    if (clicaveis.length < 4 || clicaveis.length > 14) return null;
    if (tokens.length > 20) return null;
    if (clicaveis.some((t) => !t.classe)) return null;

    return tokens;
  } catch {
    return null;
  }
}
