import type { RepertorioItem, ExpressionGroup } from '@/components/PesquisadorRedacao/types';
import { formatSourceBlock, formatSourcesByTopic } from '@/lib/research/sourceFormatter';
import type { UnderstoodSource } from '@/lib/semantic/relevanceEngine';

export const PROMPT_VERSION = '1.0.0';

interface ExtractRepertorioArgs {
  tema: string;
  fontesContext: string;
}

/**
 * Prompt para extração de repertório a partir de fontes pesquisadas.
 * O LLM analisa cada fonte e extrai: conceitos, dados, autores,
 * fatos históricos, exemplos, argumentos, contrapontos, causas, consequências.
 */
export function buildRepertorioExtractionPrompt(args: ExtractRepertorioArgs): string {
  return `Você é um pesquisador acadêmico especializado em extrair repertório utilizável em redações dissertativo-argumentativas.

TEMA DA REDAÇÃO: ${args.tema}

FONTES PESQUISADAS:
${args.fontesContext}

---

TAREFA: Extraia repertório utilizável em uma redação sobre o tema acima.

Para cada item de repertório, retorne:
- tipo: "conceito" | "dado" | "autor" | "fato_historico" | "exemplo" | "argumento" | "contraponto" | "causa" | "consequencia"
- titulo: identificador curto do item
- conteudo: texto completo do repertório (1-3 frases)
- fonteTitulo: título da fonte de onde foi extraído (ou null se for conhecimento geral)
- aplicacoes: array de temas/argumentos onde este repertório pode ser usado
- argumentosRelacionados: quais argumentos da redação este repertório sustenta
- confianca: 0-1 (o quão confiável é esta informação com base na fonte)
- verificacao: { status: "verified" se tem fonte clara, "needs_review" se precisa verificação }

REGRAS:
1. Extraia no mínimo 8 itens, no máximo 20
2. Priorize dados numéricos com fonte, citações de autores, e fatos históricos
3. Cada item deve ser útil para uma redação argumentativa
4. Não invente informações — use apenas o que está nas fontes
5. Para dados estatísticos, inclua o período e a fonte exata
6. Para autores, inclua o nome completo e a obra/estudo referenciado

Retorne APENAS um JSON válido no formato:
{
  "repertorio": [
    {
      "id": "string",
      "tipo": "conceito|dado|autor|fato_historico|exemplo|argumento|contraponto|causa|consequencia",
      "titulo": "string",
      "conteudo": "string",
      "fonteTitulo": "string | null",
      "aplicacoes": ["string"],
      "argumentosRelacionados": ["string"],
      "confianca": 0-1,
      "verificacao": { "status": "verified|needs_review", "sourceId": "string | null" }
    }
  ]
}`;
}

interface GenerateExpressionsArgs {
  tema: string;
  repertorioResumo: string;
}

/**
 * Prompt para geração de expressões e conectivos organizados por finalidade.
 */
export function buildExpressionGenerationPrompt(args: GenerateExpressionsArgs): string {
  return `Você é um especialista em redação dissertativo-argumentativa e coesão textual.

TEMA DA REDAÇÃO: ${args.tema}

REPERTÓRIO DISPONÍVEL:
${args.repertorioResumo}

---

TAREFA: Gere expressões e conectivos para ajudar o redator a construir uma redação sobre o tema.

Para cada categoria, retorne a função da expressão e pelo menos 4 opções.

CATEGORIAS OBRIGATÓRIAS:

1. CONTEXTUALIZAÇÃO — introduzir o contexto histórico/social do tema
2. APRESENTAÇÃO DO PROBLEMA — introduzir a questão central
3. ARGUMENTO — apresentar e desenvolver argumentos
4. CONTRAPOSTO — apresentar contraste ou visão oposta
5. CONCLUSÃO — retomar a tese e fechar o texto

REGRAS:
1. Cada expressão deve ser adequada ao tema específico (não genérica demais)
2. Inclua variações de registro (formal, mais formal, técnico)
3. As expressões devem funcionar em uma redação dissertativo-argumentativa
4. Considere o repertório disponível ao gerar expressões de argumentação

Retorne APENAS um JSON válido no formato:
{
  "expressoes": [
    {
      "categoria": "contextualizacao|problema|argumento|contraposicao|conclusao",
      "funcao": "descrição da função desta categoria",
      "opcoes": ["expressão 1", "expressão 2", "expressão 3", "expressão 4"]
    }
  ]
}`;
}

interface BuildStructureArgs {
  tema: string;
  repertorioResumo: string;
}

/**
 * Prompt para geração da estrutura da redação (tese, argumentos, plano).
 * Separado da geração do texto para permitir validação antes de redigir.
 */
export function buildStructurePrompt(args: BuildStructureArgs): string {
  return `Você é um planejador de redações dissertativo-argumentativas, experiente em vestibulares e ENEM.

TEMA DA REDAÇÃO: ${args.tema}

REPERTÓRIO DISPONÍVEL:
${args.repertorioResumo}

---

TAREFA: Planeje a estrutura completa de uma redação sobre o tema.

A redação deve seguir a estrutura:
- INTRODUÇÃO: contextualização + apresentação do problema + tese
- DESENVOLVIMENTO 1: primeiro argumento (com tópico frasal, explicação, repertório, relação com tema)
- DESENVOLVIMENTO 2: segundo argumento (mesma estrutura)
- DESENVOLVIMENTO 3 (OPCIONAL): apenas se houver um terceiro eixo argumentativo relevante
- CONCLUSÃO: retomada da tese + síntese + fechamento

REGRAS OBRIGATÓRIAS:
1. Mínimo 4 parágrafos, máximo 5
2. A introdução DEVE preparar os argumentos dos desenvolvimentos
3. Cada desenvolvimento DEVE ter: tópico frasal, explicação, repertório/evidência, relação com o tema, conclusão parcial
4. O terceiro desenvolvimento SÓ deve existir se houver um terceiro eixo argumentativo genuinamente relevante
5. A conclusão DEVE retomar a tese introdução
6. Não inclua proposta de intervenção (será opcional futuramente)

Retorne APENAS um JSON válido no formato:
{
  "tema": "string",
  "introducao": {
    "contextualizacao": "string (1-2 frases)",
    "problema": "string (1-2 frases)",
    "tese": "string (1 frase)",
    "argumentos": ["argumento A resumido", "argumento B resumido"]
  },
  "desenvolvimentos": [
    {
      "numero": 1,
      "argumento": "string (tema do argumento)",
      "topicoFrasal": "string",
      "explicacao": "string (2-3 frases)",
      "repertorio": ["fonte/dado a ser usado"],
      "relacaoComTema": "string (1-2 frases)",
      "conclusaoParcial": "string (1 frase)"
    }
  ],
  "temTerceiroDesenvolvimento": false,
  "conclusao": {
    "retomadaTese": "string",
    "sintese": "string",
    "fechamento": "string"
  }
}`;
}

interface GenerateRedacaoArgs {
  tema: string;
  estrutura: string;
  repertorioSelecionado: string;
  expressoesSelecionadas: string;
  modo: 'automatico' | 'construir';
}

/**
 * Prompt para geração do texto completo da redação.
 */
export function buildRedacaoPrompt(args: GenerateRedacaoArgs): string {
  return `Você é um redator experiente em redações dissertativo-argumentativas para vestibulares e ENEM brasileiros.

TEMA: ${args.tema}

MODO: ${args.modo === 'automatico' ? 'Gere a redação completa seguindo a estrutura planejada.' : 'Use a estrutura e os elementos fornecidos pelo usuário para redigir.'}

ESTRUTURA PLANEJADA:
${args.estrutura}

REPERTÓRIO SELECIONADO:
${args.repertorioSelecionado}

EXPRESSÕES SELECIONADAS:
${args.expressoesSelecionadas}

---

REGRAS OBRIGATÓRIAS:

1. ESTRUTURA:
   - 4 a 5 parágrafos (introdução + 2 ou 3 desenvolvimentos + conclusão)
   - Cada parágrafo com 3-5 frases
   - Progressão lógica entre parágrafos

2. COESÃO:
   - Use conectivos variados (não repita os mesmos)
   - Transições fluidas entre ideias
   - Referências cruzadas entre parágrafos

3. REPERTÓRIO:
   - Use os dados, autores e fatos indicados na estrutura
   - Cite fontes de forma integrada ao texto (não como lista)
   - Não invente dados ou citações

4. ESTILO:
   - Formal, impessoal, objetivo
   - Vocabulary variado (não repita palavras-chave)
   - Frases com estrutura variada (simples, compostas, complexas)

5. NÃO FAÇA:
   - Não comece parágrafos com "Primeiramente", "Em segundo lugar", "Por fim"
   - Não use expressões coloquiais
   - Não repita a mesma ideia em parágrafos diferentes
   - Não inclua proposta de intervenção (a menos que solicitado)

Retorne APENAS o texto da redação, sem título, sem numeração de parágrafos, separados por linha em branco.`;
}

interface ValidateRedacaoArgs {
  redacao: string;
  tema: string;
  fontesContext: string;
}

/**
 * Prompt para validação da redação gerada.
 */
export function buildValidacaoPrompt(args: ValidateRedacaoArgs): string {
  return `Você é um avaliador de redações dissertativo-argumentativas, com experiência em correção de vestibulares e ENEM.

TEMA: ${args.tema}

REDAÇÃO AVALIAR:
${args.redacao}

FONTES UTILIZADAS NA PESQUISA:
${args.fontesContext}

---

TAREFA: Valide a redação e identifique problemas.

Para CADA problema encontrado, retorne um item com:
- categoria: "estrutura" | "coerencia" | "coesao" | "repertorio" | "fontes"
- tipo: "factual" | "citacao" | "estrutura" | "coesao"
- status: "ok" | "warning" | "error"
- trecho: trecho exato da redação com o problema (se aplicável)
- paragrafo: número do parágrafo (0 = introdução, 1 = dev1, etc.)
- explicacao: descrição clara do problema
- sugestao: como corrigir

CATEGORIAS DE VERIFICAÇÃO:

1. ESTRUTURA:
   - Introdução existe e tem contextualização + problema + tese
   - 2 desenvolvimentos no mínimo, 3 no máximo
   - Conclusão existe e retoma a tese
   - Cada desenvolvimento tem tópico frasal

2. COERÊNCIA:
   - Tese é clara e consistente
   - Argumentos correspondem à tese
   - Argumentos não se contradizem
   - Conclusão retoma o problema

3. COESÃO:
   - Conectivos variados e adequados
   - Progressão lógica entre parágrafos
   - Transições fluidas
   - Ausência de repetição excessiva

4. REPERTÓRIO:
   - Repertório é adequado ao argumento
   - Dados possuem fonte
   - Não há estatísticas inventadas
   - Autores são reais e citados corretamente

5. FONTES (verificação via regex + análise):
   - Afirmações factuais devem ter fonte vinculada
   - Citações devem ser verificáveis
   - Classifique cada afirmação factual:
     * "verificavel" → precisa de fonte
     * "conhecimento_geral" → não necessariamente
     * "interpretacao" → não precisa
     * "opiniao" → não precisa
     * "dado_especifico" → precisa de fonte

Retorne APENAS um JSON válido no formato:
{
  "itens": [
    {
      "categoria": "string",
      "tipo": "string",
      "status": "ok|warning|error",
      "trecho": "string | null",
      "paragrafo": number | null,
      "explicacao": "string",
      "sugestao": "string | null"
    }
  ],
  "resumo": {
    "total": number,
    "ok": number,
    "warnings": number,
    "errors": number
  }
}`;
}
