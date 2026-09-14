/**
 * Configuração central do Motor Semântico Local (LLM-Free).
 *
 * Inspirado no LiteSemRAG (arXiv:2604.16350) — "Lightweight LLM-Free
 * Semantic-Aware Graph Retrieval for Robust RAG": entendimento de
 * relevância via embeddings contextuais (token-level -> chunk-level),
 * sem depender de nenhuma chamada a LLM para indexar ou julgar fontes.
 *
 * Este arquivo é a ÚNICA fonte de verdade para o corte de relevância.
 * Antes existiam dois limiares desconectados (logit do cross-encoder e
 * coverageScore da decisão de reuso). Agora existe um único score
 * semântico 0-100 e uma única regra de descarte.
 */

/** Fontes com score semântico <= a este valor são descartadas (nunca salvas). */
export const SEMANTIC_DISCARD_THRESHOLD = 45;

/** Modelo de embeddings bi-encoder, multilíngue (cobre PT-BR nativamente). */
export const EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/** Dimensão do vetor de saída do modelo acima. */
export const EMBEDDING_DIM = 384;

/** Cross-encoder já existente no projeto, usado como sinal secundário de reranqueamento. */
export const CROSS_ENCODER_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2';

/** Tamanho alvo de cada chunk de texto completo, em caracteres (~ half token ratio p/ PT-BR). */
export const CHUNK_TARGET_CHARS = 900;

/** Sobreposição entre chunks consecutivos, em caracteres. */
export const CHUNK_OVERLAP_CHARS = 150;

/** Máximo de chunks avaliados por fonte (limita custo computacional por documento). */
export const MAX_CHUNKS_PER_SOURCE = 24;

/** Timeout ao buscar o texto completo da página/PDF de uma fonte. */
export const FULL_TEXT_FETCH_TIMEOUT_MS = 12000;

/** Tamanho máximo de texto completo capturado por fonte (protege memória/latência). */
export const MAX_FULL_TEXT_CHARS = 40000;

/** Quantas fontes são processadas em paralelo pelo motor (ler + entender). */
export const ENGINE_CONCURRENCY = 4;

/** Quantos chunks de maior similaridade entram na média ponderada do score final. */
export const TOP_K_CHUNKS_FOR_SCORE = 3;

/** Peso do bi-encoder (embeddings densos) vs. cross-encoder no score combinado. */
export const BI_ENCODER_WEIGHT = 0.7;
export const CROSS_ENCODER_WEIGHT = 0.3;

/** Quantas categorias semânticas (índice de assunto) extrair por fonte. */
export const MAX_CATEGORIES_PER_SOURCE = 8;

/**
 * Relevância de DOMÍNIO (agronegócio/agropecuária em geral) — eixo
 * diferente da relevância à consulta atual. Uma fonte pode ser irrelevante
 * para a busca de hoje (semanticScore <= 45) mas ainda ser sobre agro e
 * valer a pena guardar para reuso futuro. Fontes fora do domínio inteiro
 * (ex.: futebol, política) nunca são salvas, mesmo com score baixo.
 */
export const AGRO_DOMAIN_RELEVANCE_THRESHOLD = 40;

/** Texto-âncora usado para medir, por embedding, se uma fonte pertence ao domínio agro. */
export const AGRO_DOMAIN_DESCRIPTOR = [
  'Agronegócio e agropecuária: agricultura, pecuária, produção de grãos e',
  'commodities agrícolas, manejo do solo, adubação e fertilizantes,',
  'nutrição de plantas, irrigação, sanidade animal e vegetal, controle',
  'de pragas e doenças, sementes e melhoramento genético, maquinário',
  'agrícola, cadeias produtivas rurais, economia rural, sustentabilidade',
  'na produção agrícola, culturas como soja, milho, cana-de-açúcar,',
  'café e pecuária de corte e leite.',
].join(' ');
