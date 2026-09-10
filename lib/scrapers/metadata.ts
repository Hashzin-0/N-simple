export interface ScraperMetadata {
  name: string;
  max: number;
  maxAllowed: number;
  description: string;
  limitations: string;
}

export const SCRAPERS_METADATA: ScraperMetadata[] = [
  { 
    name: 'Google Acadêmico', 
    max: 25, 
    maxAllowed: 100, 
    description: 'Artigos científicos indexados',
    limitations: 'Sem limite oficial, mas bloqueia requisições automatizadas. Máximo recomendado: 100 por busca.'
  },
  { 
    name: 'Embrapa', 
    max: 15, 
    maxAllowed: 50, 
    description: 'Boletins técnicos da Embrapa',
    limitations: 'Repositório limitado a publicações da Embrapa. Máximo recomendado: 50 por busca.'
  },
  { 
    name: 'SciELO', 
    max: 15, 
    maxAllowed: 50, 
    description: 'Periódicos científicos latino-americanos',
    limitations: 'Focado em periódicos latino-americanos. Máximo recomendado: 50 por busca.'
  },
  { 
    name: 'CAPES', 
    max: 12, 
    maxAllowed: 50, 
    description: 'Periódicos via Portal CAPES',
    limitations: 'Requer acesso institucional para artigos completos. Máximo recomendado: 50 por busca.'
  },
  { 
    name: 'BDTD', 
    max: 12, 
    maxAllowed: 50, 
    description: 'Teses e dissertações brasileiras',
    limitations: 'Focado em teses e dissertações. Máximo recomendado: 50 por busca.'
  },
  { 
    name: 'YouTube', 
    max: 20, 
    maxAllowed: 50, 
    description: 'Vídeos técnicos e palestras',
    limitations: 'YouTube Data API v3: 10.000 unidades/dia (100 por busca = ~100 buscas/dia). Máximo por requisição: 50.'
  },
  { 
    name: 'CNPEM', 
    max: 10, 
    maxAllowed: 30, 
    description: 'Centro Nacional de Pesquisa em Energia e Materiais',
    limitations: 'Repositório limitado a pesquisas do CNPEM/LNLS. Máximo recomendado: 30 por busca.'
  },
  { 
    name: 'INPA', 
    max: 10, 
    maxAllowed: 30, 
    description: 'Instituto Nacional de Pesquisas da Amazônia',
    limitations: 'Focado em pesquisas amazônicas. Máximo recomendado: 30 por busca.'
  },
  { 
    name: 'IPEA', 
    max: 10, 
    maxAllowed: 30, 
    description: 'Instituto de Pesquisa Econômica Aplicada',
    limitations: 'Focado em economia aplicada. Máximo recomendado: 30 por busca.'
  },
];
