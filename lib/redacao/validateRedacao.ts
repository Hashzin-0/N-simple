import { generateWithFallback } from '@/lib/llm-providers';
import { buildValidacaoPrompt } from '@/lib/prompts-redacao';
import { formatSourcesByTopic } from '@/lib/research/sourceFormatter';
import type { UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import type { ValidacaoResult, ValidacaoItem } from '@/components/PesquisadorRedacao/types';

/**
 * Padrões regex para detectar candidatos a afirmações factuais.
 * Estes são passados para o LLM classificar se precisam de fonte.
 */
const FACTUAL_PATTERNS = [
  /segundo\s+(?:o|a|os|as)\s+\w+/gi,
  /de\s+acordo\s+com\s+/gi,
  /estudo[s]?\s+(?:de|por|mostra[m]?)\s+/gi,
  /pesquisa[s]?\s+(?:de|por|indica[m]?)\s+/gi,
  /\d+[%º]/g,
  /em\s+\d{4}/g,
  /aproximadamente\s+\d+/g,
  /cerca\s+de\s+\d+/g,
];

/**
 * Detecta candidatos a afirmações factuais no texto via regex.
 * Retorna trechos que contenham padrões de afirmação factual.
 */
function detectFactualCandidates(text: string): string[] {
  const candidates: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  for (const sentence of sentences) {
    for (const pattern of FACTUAL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(sentence)) {
        candidates.push(sentence.trim());
        break;
      }
    }
  }

  return candidates;
}

/**
 * Valida uma redação de forma híbrida:
 * 1. Verificação estrutural (regras obrigatórias)
 * 2. Detecção regex de afirmações factuais
 * 3. Análise LLM de coerência, coesão, repertório e fontes
 */
export async function validateRedacao(
  redacao: string,
  tema: string,
  fontes: UnderstoodSource[],
  topics: string[] = [],
): Promise<ValidacaoResult> {
  const itens: ValidacaoItem[] = [];

  // ── FASE 1: Validação estrutural (regex) ──
  const paragrafos = redacao.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  // Estrutura
  itens.push({
    categoria: 'estrutura',
    tipo: 'estrutura',
    status: paragrafos.length >= 4 && paragrafos.length <= 5 ? 'ok' : 'error',
    explicacao: paragrafos.length < 4
      ? `Redação tem ${paragrafos.length} parágrafos (mínimo 4)`
      : paragrafos.length > 5
        ? `Redação tem ${paragrafos.length} parágrafos (máximo 5)`
        : `Estrutura OK: ${paragrafos.length} parágrafos`,
    sugestao: paragrafos.length < 4 ? 'Adicione desenvolvimentos para atingir o mínimo de 4 parágrafos' : undefined,
  });

  // ── FASE 2: Detecção de afirmações factuais via regex ──
  const factualCandidates = detectFactualCandidates(redacao);

  // ── FASE 3: Validação via LLM ──
  const fontesContext = fontes.length > 0
    ? formatSourcesByTopic(fontes, topics)
    : 'Nenhuma fonte foi utilizada na pesquisa.';

  const prompt = buildValidacaoPrompt({ redacao, tema, fontesContext });

  const result = await generateWithFallback({ prompt });

  let fullText = '';
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += value.text;
  }

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as ValidacaoResult;
      if (Array.isArray(parsed.itens)) {
        itens.push(...parsed.itens);
      }
    } catch {
      // Se o LLM não retornar JSON válido, usa apenas a validação estrutural
    }
  }

  // Adiciona candidatos factuais detectados via regex como warnings
  // (se o LLM não já os cobriu)
  const llmTrechos = new Set(itens.filter(i => i.trecho).map(i => i.trecho));
  for (const trecho of factualCandidates) {
    if (!llmTrechos.has(trecho)) {
      itens.push({
        categoria: 'fontes',
        tipo: 'factual',
        status: 'warning',
        trecho,
        explicacao: 'Afirmação factual detectada — verifique se possui fonte vinculada.',
        sugestao: 'Adicione a fonte ou reformule como argumento/opinião.',
      });
    }
  }

  // Contagem de resultados
  const resumo = {
    total: itens.length,
    ok: itens.filter(i => i.status === 'ok').length,
    warnings: itens.filter(i => i.status === 'warning').length,
    errors: itens.filter(i => i.status === 'error').length,
  };

  return { itens, resumo };
}
