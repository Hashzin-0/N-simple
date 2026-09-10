import { NextRequest, NextResponse } from 'next/server';
import { searchAllSources } from '@/lib/scrapers';
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

    const result = await searchAllSources(cleanQuery);

    const withTrigonometry = result.sources.map((src) => ({
      ...src,
      trigonometricSimilarity: computeTrigonometricSimilarity(cleanQuery, src),
    }));

    withTrigonometry.sort(
      (a, b) =>
        (b.trigonometricSimilarity?.cosTheta ?? 0) -
        (a.trigonometricSimilarity?.cosTheta ?? 0)
    );

    return NextResponse.json({
      sources: withTrigonometry,
      query: cleanQuery,
      totalFound: withTrigonometry.length,
      errors: result.errors,
    });
  } catch (error: unknown) {
    console.error('Error in pesquisador-fontes route:', error);
    return NextResponse.json(
      { error: 'Falha ao processar pesquisa de fontes científicas.' },
      { status: 500 }
    );
  }
}
