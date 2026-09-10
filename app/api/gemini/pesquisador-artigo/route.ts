import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { ScientificArticleABNT } from '@/components/PesquisadorAgro/types';
import { searchAllSources } from '@/lib/scrapers';
import { fetchUserDocuments, UserDocumentSource } from '@/lib/userDocuments';

export const dynamic = 'force-dynamic';

function formatSourcesByTopic(
  sources: Awaited<ReturnType<typeof searchAllSources>>['sources'],
  topics: string[]
): string {
  if (topics.length === 0) {
    return sources
      .slice(0, 30)
      .map(
        (src, idx) =>
          `[Fonte ${idx + 1}] CITAÇÃO ABNT: ${src.abntCitation}
Autores: ${src.authors}
Título: ${src.title}
Publicação: ${src.publication}
Ano: ${src.year}
Repositório: ${src.sourceName}
Tipo: ${src.sourceType}
URL Direta: ${src.directUrl || 'Não disponível'}
URL de Busca: ${src.searchUrl}
Resumo: ${src.abstract}
Palavras-chave: ${(src.keywords || []).join(', ')}
Vantagens: ${(src.vantagens || []).join('; ') || 'Consultar artigo completo'}
Desvantagens: ${(src.desvantagens || []).join('; ') || 'Consultar artigo completo'}
Características: ${(src.caracteristicas || []).join('; ') || 'Consultar artigo completo'}`
      )
      .join('\n\n');
  }

  const topicGroups: Record<string, typeof sources> = {};
  for (const topic of topics) {
    topicGroups[topic] = [];
  }
  const ungrouped: typeof sources = [];

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

  const lines: string[] = [];
  let fontIdx = 1;

  for (const topic of topics) {
    const group = topicGroups[topic];
    if (group.length === 0) continue;

    lines.push(`\n--- TÓPICO: ${topic} ---`);
    for (const src of group.slice(0, 8)) {
      lines.push(
        `[Fonte ${fontIdx}] CITAÇÃO ABNT: ${src.abntCitation}
Autores: ${src.authors}
Título: ${src.title}
Publicação: ${src.publication}
Ano: ${src.year}
Repositório: ${src.sourceName}
Tipo: ${src.sourceType}
URL Direta: ${src.directUrl || 'Não disponível'}
Resumo: ${src.abstract}
Palavras-chave: ${(src.keywords || []).join(', ')}`
      );
      fontIdx++;
    }
  }

  if (ungrouped.length > 0) {
    lines.push('\n--- FONTES GERAIS (contexto amplo) ---');
    for (const src of ungrouped.slice(0, 10)) {
      lines.push(
        `[Fonte ${fontIdx}] CITAÇÃO ABNT: ${src.abntCitation}
Autores: ${src.authors}
Título: ${src.title}
Publicação: ${src.publication}
Ano: ${src.year}
Repositório: ${src.sourceName}
Tipo: ${src.sourceType}
URL Direta: ${src.directUrl || 'Não disponível'}
Resumo: ${src.abstract}
Palavras-chave: ${(src.keywords || []).join(', ')}`
      );
      fontIdx++;
    }
  }

  return lines.join('\n\n');
}

function formatUserDocsSection(
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

export async function POST(req: NextRequest) {
  let themeInput = '';
  let userLinks: string[] = [];
  let customTopics: string[] = [];

  try {
    const body = await req.json();
    themeInput = (body?.theme || '').trim();
    if (Array.isArray(body?.userLinks)) {
      userLinks = body.userLinks
        .map((l: unknown) => (typeof l === 'string' ? l.trim() : ''))
        .filter((l: string) => l.length > 0);
    }
    if (Array.isArray(body?.customTopics)) {
      customTopics = body.customTopics
        .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t: string) => t.length > 0);
    }

    if (!themeInput) {
      return NextResponse.json(
        { error: 'O parâmetro tema/título da pesquisa é obrigatório.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'GEMINI_API_KEY não configurada. Não é possível gerar artigos sem a chave de API do Gemini.',
          theme: themeInput,
        },
        { status: 503 }
      );
    }

    const [searchResult, userDocuments] = await Promise.all([
      searchAllSources(themeInput, customTopics.length > 0 ? customTopics : undefined),
      fetchUserDocuments(userLinks, customTopics),
    ]);

    const sourcesContext = formatSourcesByTopic(searchResult.sources, customTopics);
    const userDocsSection = formatUserDocsSection(userDocuments, customTopics);

    const customTopicsSection =
      customTopics.length > 0
        ? `TÓPICOS EXIGIDOS PELO USUÁRIO:
${customTopics.map((top, idx) => `3.${idx + 1} ${top}`).join('\n')}
`
        : `TÓPICOS PADRÃO:
3.1 Definição e Características Fundamentais
3.2 Vantagens Agronômicas, Produtivas e Econômicas
3.3 Desvantagens, Riscos Operacionais e Limitações Práticas
3.4 Análise Comparativa Direta (Práticas Tradicionais vs. Contemporâneas)`;

    const prompt = `Você é um pesquisador agronômico sênior, doutor em Ciência do Solo e Fitotecnia.

TAREFA: Gerar um artigo científico completo nas normas ABNT (NBR 6022, NBR 6028, NBR 6023) sobre:
"${themeInput}"

${userDocsSection}

FONTES CIENTÍFICAS REAIS ENCONTRADAS PESQUISANDO EM GOOGLE ACADEMICO, EMBRAPA, SCIELO, CAPES, BDTD:
${sourcesContext || 'Nenhuma fonte encontrada nos repositórios. Use conhecimento técnico agronômico consolidado.'}

${customTopicsSection}

REGRAS OBRIGATÓRIAS:
1. DOCUMENTOS DO USUÁRIO têm PRIORIDADE MÁXIMA. Se um documento do usuário contém conteúdo relevante para um tópico, cite-o OBRIGATORIAMENTE como fonte principal. Use o campo "Citação ABNT" fornecido.
2. USE EXCLUSIVAMENTE as fontes listadas acima (documentos do usuário + fontes dos repositórios). CADA fonte já contém a CITAÇÃO ABNT pronta. Copie e use EXATAMENTE essa citação nas referências. NÃO INVENTE autores, periódicos ou dados.
3. CADA tópico deve citar no MÍNIMO 3 e no MÁXIMO 10 fontes reais em "fontesConsultadas". Priorize documentos do usuário quando disponíveis para o tópico.
4. O campo "referenciasABNT" DEVE conter TODAS as citações ABNT das fontes utilizadas no artigo, copiadas do campo "CITAÇÃO ABNT" fornecido. Ordene alfabeticamente por sobrenome do primeiro autor.
5. Para cada fonte citada, inclua no campo "contribution" uma descrição de como aquela fonte contribuiu para o tópico.
6. O artigo DEVE conter: título em CAIXA ALTA, 2 autores acadêmicos, resumo (NBR 6028), abstract em inglês, introdução, metodologia, desenvolvimento com tópicos numerados, considerações finais e referências ABNT NBR 6023.
7. NÃO use a expressão "cruzamento de dados". Use: "revisão sistemática", "síntese de evidências".
8. Formato de saída: APENAS JSON válido (sem markdown) com esta estrutura exata:

{
  "theme": "${themeInput}",
  "title": "TÍTULO EM CAIXA ALTA",
  "subtitle": "Subtítulo se houver",
  "titleEn": "English Title",
  "authors": [
    { "name": "SOBRENOME, Nome", "titulation": "Dr. em ...", "affiliation": "Universidade/Instituição", "email": "email@instituicao.br" }
  ],
  "resumo": "Resumo em parágrafo único com objetivo, metodologia e conclusões...",
  "palavrasChave": ["termo1", "termo2", "termo3"],
  "abstractEn": "Abstract...",
  "keywordsEn": ["term1", "term2", "term3"],
  "introducao": "Texto da introdução...",
  "metodologia": "Texto da metodologia...",
  "topicosDesenvolvimento": [
    {
      "number": "3.1",
      "title": "Título do Tópico",
      "content": "Conteúdo com citações...",
      "fontesConsultadas": [
        {
          "citationABNT": "Citação ABNT copiada EXATAMENTE do campo 'CITAÇÃO ABNT' da fonte",
          "authors": "Autores",
          "year": 2023,
          "title": "Título",
          "repository": "Nome do Repositório",
          "contribution": "Como esta fonte contribuiu para o tópico",
          "directUrl": "URL direta para acessar o documento"
        }
      ]
    }
  ],
  "analiseComparativaDireta": [
    {
      "praticaSuperadaOuTradicional": "Prática antiga",
      "praticaContemporaneaRecomendada": "Prática moderna",
      "parametroComparado": "Parâmetro",
      "impactoAgroeconomico": "Impacto",
      "evidenciaCientifica": "Autores (ano)"
    }
  ],
  "consideracoesFinais": "Texto das considerações finais...",
  "referenciasABNT": ["Referência 1 ABNT", "Referência 2 ABNT"],
  "generatedAt": "${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}"
}`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let responseText = '';

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || '';
        if (text) {
          responseText = text;
          break;
        }
      } catch (geminiError: unknown) {
        const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
        console.warn(`[Gemini Artigo] Model ${modelName} failed:`, msg);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (responseText) {
      try {
        const parsedData: ScientificArticleABNT = JSON.parse(responseText);
        if (
          parsedData.topicosDesenvolvimento &&
          Array.isArray(parsedData.topicosDesenvolvimento) &&
          parsedData.topicosDesenvolvimento.length > 0
        ) {
          return NextResponse.json(parsedData);
        }
      } catch (parseErr) {
        console.warn('Failed to parse Gemini JSON response:', parseErr);
      }
    }

    return NextResponse.json(
      {
        error: 'Falha ao gerar artigo. O Gemini não retornou uma resposta válida. Tente novamente.',
        theme: themeInput,
        sourcesFound: searchResult.totalFound,
      },
      { status: 500 }
    );
  } catch (err: unknown) {
    console.error('Error in pesquisador-artigo route:', err);
    return NextResponse.json(
      {
        error: 'Falha ao processar a geração do artigo científico.',
        theme: themeInput || '',
      },
      { status: 500 }
    );
  }
}
