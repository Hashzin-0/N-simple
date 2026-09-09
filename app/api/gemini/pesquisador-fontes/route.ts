import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { ScientificSource } from '@/components/PesquisadorAgro/types';
import { CURATED_SCIENTIFIC_SOURCES } from '@/components/PesquisadorAgro/portalsData';
import { computeTrigonometricSimilarity } from '@/components/PesquisadorAgro/trigonometry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const cleanQuery = (query || '').trim();

    if (!cleanQuery) {
      return NextResponse.json(
        { error: 'Parâmetro query de busca é obrigatório.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Se a API key estiver disponível, busca dinamicamente com Gemini
    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Você é um pesquisador agronômico sênior especializado em indexação científica de ciências agrárias brasileiras e internacionais.
O usuário está pesquisando o seguinte termo ou tema no setor agropecuário:
"${cleanQuery}"

Sua tarefa é pesquisar e retornar uma lista completa, densa e abrangente de 10 a 18 fontes e publicações de alto impacto encontradas com ampla distribuição em TODOS os seguintes repositórios e portais confiáveis:
1. Google Acadêmico (Google Scholar) — artigos científicos de grande relevância e métricas de citação
2. Embrapa (Alice e Infoteca-e — boletins técnicos, comunicados técnicos e livros)
3. SciELO Brasil (Revistas Qualis A1/A2: Revista Brasileira de Ciência do Solo, Pesquisa Agropecuária Brasileira, Bragantia, Scientia Agricola)
4. Portal de Periódicos CAPES (Periódicos internacionais e nacionais indexados)
5. FAO AGRIS (Diretrizes e relatórios da Organização das Nações Unidas para a Alimentação e a Agricultura)
6. BDTD (Teses de Doutorado e Dissertações de Mestrado de ESALQ/USP, UFV, UFLA, UNESP, UFRGS)
7. YouTube Técnico / Científico (Palestras oficiais Embrapa, AgroAdvance, Fundação MT, ESALQ/USP, Canais Universitários)

DIRETRIZ DE ABRANGÊNCIA:
Não retorne apenas 2 ou 3 fontes. Traga uma pesquisa rica e variada, garantindo a presença do Google Acadêmico com artigos consagrados, juntamente com Embrapa, SciELO, CAPES e demais portais.

Para cada fonte encontrada, identifique e informe com rigor técnico:
- id: identificador único (ex: "scholar-caires-2021")
- title: Título real ou altamente representativo
- authors: Autores (ou canal / palestrante)
- year: Ano de publicação (ex: 2018 a 2024)
- publication: Publicação ou Revista / Canal com volume e páginas
- sourceName: Repositório exato (deve ser exatamente um destes: "Google Acadêmico", "Embrapa", "SciELO", "CAPES", "FAO AGRIS", "BDTD", "Universidade" ou "YouTube")
- sourceType: Tipo de fonte (deve ser um destes: "artigo_periodico", "boletim_tecnico", "ensaio_cientifico", "tese_dissertacao", "livro_manual", "video_tecnico")
- abstract: Resumo científico com síntese das descobertas
- keywords: Lista com 4 a 8 palavras-chave
- vantagens: Vantagens agronômicas, produtivas ou operacionais apontadas pela fonte
- desvantagens: Desvantagens, riscos operacionais, lixiviação ou limitações apontadas pela fonte
- caracteristicas: Fundamentos e características técnicas descritos pela fonte
- abntCitation: Citação ABNT NBR 6023 completa e formatada
- directUrl: Link direto plausível
- searchUrl: Link de busca exata no respectivo repositório

Retorne APENAS um array JSON de objetos correspondente à estrutura acima. Exemplo do formato:
[
  {
    "id": string,
    "title": string,
    "authors": string,
    "year": number,
    "publication": string,
    "sourceName": "Google Acadêmico" | "Embrapa" | "SciELO" | "CAPES" | "FAO AGRIS" | "BDTD" | "Universidade" | "YouTube",
    "sourceType": "artigo_periodico" | "boletim_tecnico" | "ensaio_cientifico" | "tese_dissertacao" | "livro_manual" | "video_tecnico",
    "abstract": string,
    "keywords": [string],
    "directUrl": string,
    "searchUrl": string,
    "abntCitation": string,
    "vantagens": [string],
    "desvantagens": [string],
    "caracteristicas": [string]
  }
]`;

      try {
        const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
        let text = '';

        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                responseMimeType: 'application/json',
              },
            });

            const candidateText = response.text?.trim() || '';
            if (candidateText) {
              text = candidateText;
              break;
            }
          } catch (modelErr: unknown) {
            const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
            console.warn(`[Gemini Fontes] Model ${modelName} call failed, trying next candidate:`, msg);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }

        if (text) {
          const parsedSources: ScientificSource[] = JSON.parse(text);
          if (Array.isArray(parsedSources) && parsedSources.length > 0) {
            // Calcula a Similaridade Trigonométrica para cada fonte encontrada
            const withTrigonometry = parsedSources.map((src, idx) => ({
              ...src,
              id: src.id || `api-src-${idx}`,
              trigonometricSimilarity: computeTrigonometricSimilarity(cleanQuery, src),
            }));

            // Ordena decrescente pelo cosseno trigonométrico
            withTrigonometry.sort(
              (a, b) =>
                (b.trigonometricSimilarity?.cosTheta ?? 0) -
                (a.trigonometricSimilarity?.cosTheta ?? 0)
            );

            return NextResponse.json({
              sources: withTrigonometry,
              query: cleanQuery,
              totalFound: withTrigonometry.length,
            });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini dynamic source search failed, using trigonometric ranking on local curated repository:', geminiError);
      }
    }

    // Fallback: busca no repositório curado com cálculo de similaridade trigonométrica
    const scoredSources = CURATED_SCIENTIFIC_SOURCES.map((src) => {
      const trig = computeTrigonometricSimilarity(cleanQuery, src);
      return {
        ...src,
        trigonometricSimilarity: trig,
      };
    });

    // Ordena decrescente pelo cosseno trigonométrico (cos θ)
    scoredSources.sort(
      (a, b) =>
        (b.trigonometricSimilarity?.cosTheta ?? 0) -
        (a.trigonometricSimilarity?.cosTheta ?? 0)
    );

    return NextResponse.json({
      sources: scoredSources,
      query: cleanQuery,
      totalFound: scoredSources.length,
    });
  } catch (error: unknown) {
    console.error('Error in pesquisador-fontes route:', error);
    return NextResponse.json(
      { error: 'Falha ao processar pesquisa de fontes científicas.' },
      { status: 500 }
    );
  }
}
