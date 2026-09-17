import { UnderstoodSource } from '@/lib/semantic/relevanceEngine';
import { UserDocumentSource } from '@/lib/userDocuments';

/**
 * Formata uma única fonte para inclusion em prompts de LLM.
 */
export function formatSourceBlock(src: UnderstoodSource, idx: number): string {
  const lines = [
    `[Fonte ${idx}] CITAÇÃO ABNT: ${src.abntCitation}`,
    `Autores: ${src.authors}`,
    `Título: ${src.title}`,
    `Publicação: ${src.publication}`,
    `Ano: ${src.year}`,
    `Repositório: ${src.sourceName}`,
    `Tipo: ${src.sourceType}`,
    `URL Direta: ${src.directUrl || 'Não disponível'}`,
    `Resumo: ${src.abstract}`,
    `Palavras-chave: ${(src.keywords || []).join(', ')}`,
  ];
  if (src.vantagens?.length) lines.push(`Vantagens: ${src.vantagens.join('; ')}`);
  if (src.desvantagens?.length) lines.push(`Desvantagens: ${src.desvantagens.join('; ')}`);
  if (src.caracteristicas?.length) lines.push(`Características: ${src.caracteristicas.join('; ')}`);
  if (src.bestExcerpt) {
    lines.push(`Trecho mais relevante do texto completo: "${src.bestExcerpt}"`);
  }
  return lines.join('\n');
}

/**
 * Formata fontes agrupadas por tópico para inclusion em prompts de LLM.
 */
export function formatSourcesByTopic(
  sources: UnderstoodSource[],
  topics: string[],
  originLabel?: string
): string {
  const header = originLabel ? `\n=== ${originLabel} ===` : '';

  if (topics.length === 0) {
    return header + '\n\n' + sources.slice(0, 30).map((src, idx) => formatSourceBlock(src, idx + 1)).join('\n\n');
  }

  const topicGroups: Record<string, UnderstoodSource[]> = {};
  for (const topic of topics) topicGroups[topic] = [];
  const ungrouped: UnderstoodSource[] = [];

  for (const src of sources) {
    if (src.matchedTopics && src.matchedTopics.length > 0) {
      let placed = false;
      for (const t of src.matchedTopics) {
        if (topicGroups[t]) {
          topicGroups[t].push(src);
          placed = true;
        }
      }
      if (!placed) ungrouped.push(src);
    } else {
      ungrouped.push(src);
    }
  }

  const lines: string[] = [header];
  let fontIdx = 1;

  for (const topic of topics) {
    const group = topicGroups[topic];
    if (group.length === 0) continue;
    lines.push(`\n--- TÓPICO: ${topic} ---`);
    for (const src of group.slice(0, 8)) {
      lines.push(formatSourceBlock(src, fontIdx));
      fontIdx++;
    }
  }

  if (ungrouped.length > 0) {
    lines.push('\n--- FONTES GERAIS (contexto amplo) ---');
    for (const src of ungrouped.slice(0, 10)) {
      lines.push(formatSourceBlock(src, fontIdx));
      fontIdx++;
    }
  }

  return lines.join('\n\n');
}

/**
 * Formata documentos fornecidos pelo usuário para inclusion em prompts de LLM.
 */
export function formatUserDocsSection(
  documents: UserDocumentSource[],
  topics: string[]
): string {
  if (documents.length === 0) return '';

  const lines: string[] = [
    '\nDOCUMENTOS FORNECIDOS PELO USUÁRIO (PRIORIDADE MÁXIMA - use como fonte principal):',
  ];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    lines.push(`\n[Documento ${i + 1}]: ${doc.url}`);
    lines.push(`Título: "${doc.title}"`);
    lines.push(`Tipo: ${doc.contentType === 'pdf' ? 'PDF' : 'Página Web'}`);
    lines.push(`Citação ABNT: ${doc.abntCitation}`);

    if (doc.topicSections.length > 0) {
      lines.push('Trechos relevantes por tópico:');
      for (const section of doc.topicSections) {
        const truncated = section.relevantText.length > 800
          ? section.relevantText.slice(0, 800) + '...'
          : section.relevantText;
        lines.push(`  - Tópico "${section.topic}": ${truncated}`);
      }
    } else {
      const preview = doc.fullText.length > 500
        ? doc.fullText.slice(0, 500) + '...'
        : doc.fullText;
      lines.push(`Conteúdo extraído: ${preview}`);
    }
  }

  return lines.join('\n');
}
