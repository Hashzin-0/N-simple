import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { ScientificArticleABNT } from '@/components/PesquisadorAgro/types';
import { searchAllSources } from '@/lib/scrapers';

export const dynamic = 'force-dynamic';

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

    const searchResult = await searchAllSources(themeInput);

    const sourcesContext = searchResult.sources
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

    const userLinksSection =
      userLinks.length > 0
        ? `
LINKS/DOCUMENTOS DO USUÁRIO (extraia dados exclusivamente destes):
${userLinks.map((l, idx) => `[Documento ${idx + 1}]: ${l}`).join('\n')}
`
        : '';

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

FONTES CIENTÍFICAS REAIS ENCONTRADAS PESQUISANDO EM GOOGLE ACADEMICO, EMBRAPA, SCIELO, CAPES, BDTD:
${sourcesContext || 'Nenhuma fonte encontrada nos repositórios. Use conhecimento técnico agronômico consolidado.'}

${userLinksSection}

${customTopicsSection}

REGRAS OBRIGATÓRIAS:
1. USE EXCLUSIVAMENTE as fontes listadas acima. CADA fonte já contém a CITAÇÃO ABNT pronta (campo "CITAÇÃO ABNT"). Copie e use EXATAMENTE essa citação nas referências. NÃO INVENTE autores, periódicos ou dados.
2. CADA tópico deve citar no MÍNIMO 3 e no MÁXIMO 10 fontes reais em "fontesConsultadas". Use o campo "CITAÇÃO ABNT" de cada fonte.
3. O campo "referenciasABNT" DEVE conter TODAS as citações ABNT das fontes utilizadas no artigo, copiadas do campo "CITAÇÃO ABNT" fornecido. Ordene alfabeticamente por sobrenome do primeiro autor.
4. Para cada fonte citada, inclua no campo "contribution" uma descrição de como aquela fonte contribuiu para o tópico.
5. O artigo DEVE conter: título em CAIXA ALTA, 2 autores acadêmicos, resumo (NBR 6028), abstract em inglês, introdução, metodologia, desenvolvimento com tópicos numerados, considerações finais e referências ABNT NBR 6023.
6. NÃO use a expressão "cruzamento de dados". Use: "revisão sistemática", "síntese de evidências".
7. Formato de saída: APENAS JSON válido (sem markdown) com esta estrutura exata:

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
