import type { QuestionOrigem } from './types';

export const TUTOR_PROMPT_VERSION = '1.2.0';

export interface EvaluateAnswerArgs {
  enunciado: string;
  respostaAluno: string;
  gabarito?: string | null;
  explicacao?: string | null;
  contextoFontes?: string;
  contextoDocumentos?: string;
  dificuldade?: string;
  modo?: 'sessao' | 'socratico' | 'revisar_erros' | 'rapida' | 'conversar';
  tentativa?: number;
  pistaAnterior?: string | null;
}

/**
 * Prompt de avaliação semântica e conceitual da resposta oral/escrita do aluno.
 * Não compara por igualdade de texto nem por percentual de similaridade.
 * Retorna 4 dimensões + status geral + feedback para melhoria da formulação.
 * No modo socrático, emite pista e não revela o gabarito até a 3ª tentativa.
 */
export function buildEvaluatePrompt(args: EvaluateAnswerArgs): string {
  const gabarito = args.gabarito?.trim()
    ? args.gabarito.trim()
    : 'Não informado (questão aberta avaliada por conceitos).';
  const explicacao = args.explicacao?.trim() || 'Não informada.';
  const contexto = args.contextoFontes?.trim()
    ? args.contextoFontes.trim()
    : 'Nenhuma fonte adicional disponível. Use seu conhecimento agronômico padrão.';
  const materialAluno = args.contextoDocumentos?.trim()
    ? `MATERIAL ENVIADO PELO ALUNO (PDFs/docs — use como fonte primária):\n${args.contextoDocumentos.trim()}`
    : '';
  const dificuldade = args.dificuldade || 'desconhecida';
  const modo = args.modo || 'sessao';
  const tentativa = Math.min(Math.max(args.tentativa ?? 1, 1), 3);
  const pistaAnterior = args.pistaAnterior?.trim() || 'Nenhuma.';

  const modoBloco =
    modo === 'socratico'
      ? `MODO DE AVALIAÇÃO: SOCRÁTICO (tentativa ${tentativa} de 3)
PISTA ANTERIOR FORNECIDA:
${pistaAnterior}

REGRAS SOCRÁTICAS:
- Não entregue o gabarito na resposta. Avalie o progresso do aluno em relação à tentativa.
- Se statusGeral !== "dominou" E tentativa < 3: preencha "pista" com uma pergunta-guia ou dica curta (máx 1 frase) que faça o aluno chegar sozinho ao próximo passo. Não copie o gabarito.
- Se tentativa === 3 ou statusGeral === "dominou": preencha "pista" com null e pode usar feedbackOral para fechar o conceito.
- Recompenense conceitos parciais corretos em "conceitosCorretos".`
      : `MODO DE AVALIAÇÃO: ${modo.toUpperCase()}
Preencha "pista" com null (ou uma dica opcional se achar útil).`;

  return `Você é um tutor oral de agronomia (revisão para provas, ENEM, vestibulares e disciplinas de Agronegócio).
Avalie a resposta do aluno de forma SEMÂNTICA e CONCEITUAL — nunca por igualdade de texto nem por similaridade percentual crua.

${modoBloco}

DIFICULDADE DA QUESTÃO: ${dificuldade}

ENUNCIADO DA QUESTÃO:
${args.enunciado}

GABARITO / RESPOSTA ESPERADA:
${gabarito}

EXPLICAÇÃO PEDAGÓGICA (se houver):
${explicacao}

CONTEXTO CIENTÍFICO DAS FONTES PESQUISADAS:
${contexto}

${materialAluno ? `${materialAluno}\n` : ''}
RESPOSTA DO ALUNO (transcrição):
"${args.respostaAluno}"

---

TAREFA:
Avalie em 4 dimensões e devolva UM JSON válido, sem markdown, sem comentários fora do JSON.

DIMENSÕES:
1. conteudo — os conceitos fundamentais estão corretos? (correto | parcial | errado)
2. completude — faltou informação importante? (correto = nada essencial faltou | parcial = omissões relevantes | errado = essencial ausente)
3. coerencia — a explicação possui lógica e encadeamento? (correto | parcial | errado)
4. formulacao — como o aluno poderia expressar melhor a ideia? (antes/depois/dica)

STATUS GERAL:
- "dominou": conceito correto e suficientemente completo (conteudo=correto e completude=correto ou quase)
- "parcial": entendeu a ideia principal mas deixou pontos importantes de fora
- "revisar": existe erro conceitual relevante

REGRAS:
1. Nunca diga apenas "errado/correto" — explique o que está certo, o que faltou e como melhorar.
2. Em "omissoes", liste conceitos que faltaram (ex: "síntese de proteínas e clorofila").
3. Em "errosConceituais", liste erros reais (vazio se não houver).
4. Em "conceitosCorretos", liste o que o aluno acertou.
5. "feedbackOral" deve ter no máximo 3 frases curtas, em pt-BR, como um tutor falaria por voz.
6. "formulacao.depois" deve ser uma reescrita profissional da ideia central do aluno.
7. Use o contexto de fontes quando houver; se contradisser o gabarito, prefira o gabarito+fontes e mencione a fonte.
8. Se a resposta for vazia, muito curta ou irrelevante: statusGeral="revisar", conteudo="errado".
9. No modo socrático, "pista" é obrigatória quando tentativa < 3 e statusGeral !== "dominou"; caso contrário null.
10. Se o enunciado impõe restrição de formato (ex.: "no máximo 2 parágrafos", "texto crítico", "com suas palavras", limite de palavras), avalie também o cumprimento dessa restrição em completude e coerencia — e registre o descumprimento em "omissoes".

Retorne APENAS JSON no formato:
{
  "statusGeral": "dominou" | "parcial" | "revisar",
  "dimensoes": {
    "conteudo": { "status": "correto" | "parcial" | "errado", "comentario": "string" },
    "completude": { "status": "correto" | "parcial" | "errado", "comentario": "string" },
    "coerencia": { "status": "correto" | "parcial" | "errado", "comentario": "string" },
    "formulacao": { "antes": "string", "depois": "string", "dica": "string" }
  },
  "conceitosCorretos": ["string"],
  "omissoes": ["string"],
  "errosConceituais": ["string"],
  "feedbackOral": "string",
  "pista": "string | null"
}`;
}

export interface ExtractQuestionsArgs {
  tema: string;
  subtema?: string;
  fontesContext: string;
  origemPadrao?: QuestionOrigem;
}

/**
 * Prompt de extração de questões estruturadas a partir de fontes acadêmicas
 * (ENEM, vestibulares, universidades, materiais de Agronegócio) ou artigos.
 */
export function buildExtractQuestionsPrompt(args: ExtractQuestionsArgs): string {
  const assunto = args.subtema ? `${args.tema} — ${args.subtema}` : args.tema;
  const origem = args.origemPadrao || 'pesquisada';

  return `Você é um especialista em elaboração e curadoria de questões de prova em agronomia e ciências agrárias.

TEMA: ${assunto}

FONTES / CONTEÚDO DE REFERÊNCIA:
${args.fontesContext}

---

TAREFA: Extraia ou elabore questões de prova sobre o tema acima, usando o conteúdo das fontes.
Misture os DOIS formatos de prova real de agronegócio:
- OBJETIVA: múltipla escolha com 4 ou 5 alternativas plausíveis e apenas uma correta.
- DISCURSIVA: pergunta aberta de prova real, com a restrição já escrita no enunciado
  (ex.: "Discorra com suas palavras...", "Desenvolva um texto crítico (de no máximo 2 parágrafos)",
  "Explique a relação entre X e Y"). Discursiva tem "alternativas": null e "gabarito" = RESPOSTA
  ESPERADA em tópicos (é a referência da rubrica de avaliação do aluno, não uma alternativa).

EXEMPLO DE FORMATO (apenas o formato — não copie o conteúdo):
{
  "enunciado": "Discorra com suas palavras a respeito dos conceitos X e Y (obs.: no máximo 2 parágrafos).",
  "alternativas": null,
  "gabarito": "X: ideia central em um tópico.\\nY: ideia central em um tópico.\\nContraste: como se relacionam.",
  "explicacao": "O que a banca espera no texto do candidato.",
  "assunto": "Tema geral", "subassunto": "Subtema", "disciplina": "Disciplina",
  "instituicao": null, "ano": null, "tipo_prova": "questão didática",
  "fonte": null, "fonte_url": null, "origem": "${origem}", "dificuldade": "detalhamento"
}

Para cada questão, defina:
- enunciado: texto completo da questão (aberta ou com alternativas)
- alternativas: objeto com chaves "A".."E" quando houver múltipla escolha; null para questão aberta
- gabarito: letra ("A".."E") para objetivas; para discursivas, a RESPOSTA ESPERADA em tópicos (não deixe null)
- explicacao: explicação pedagógica curta da resposta
- assunto: tema geral (ex: "Fertilidade do Solo")
- subassunto: subtema específico (ex: "Calagem")
- disciplina: ex: "Solo", "Nutrição de Plantas", "Adubação"
- instituicao: origem real se identificável nas fontes (ENEM, UFRJ, UFV, Escola de Agronegócio...); senão null
- ano: ano da prova se identificado; senão null
- tipo_prova: ex: "ENEM", "vestibular", "avaliação universitária", "concurso educacional"; senão "questão didática"
- fonte: nome curto da fonte de onde veio o conteúdo
- fonte_url: URL da fonte se disponível; senão null
- origem: "${origem}" se extraída de fonte real/artigo; "gerada" se você elaborou livremente
- dificuldade: "basica" | "aplicacao" | "detalhamento"

REGRAS:
1. Gere de 4 a 8 questões, misturando dificuldades (pelo menos 1 de cada).
2. Pelo menos 2 discursivas (com restrição de formato no enunciado) e pelo menos 2 objetivas.
3. Pelo menos 2 questões devem ser de aplicação prática (contexto de campo/fazenda).
4. Não invente instituição/ano — se não estiver nas fontes, use null.
5. Questões de múltipla escolha devem ter 4 ou 5 alternativas plausíveis, com apenas uma correta.
6. Discursivas: "alternativas": null e "gabarito" = resposta esperada em tópicos; em "explicacao", liste os pontos que a banca avalia no texto do candidato.
7. Prefira questões cujo conteúdo apareça nas fontes (origem conforme definida acima).
8. Seja fiel à ciência agronômica brasileira (Embrapa, normas técnicas, terminologia pt-BR).

Retorne APENAS JSON válido:
{
  "questions": [
    {
      "enunciado": "string",
      "alternativas": { "A": "string", "B": "string", "C": "string", "D": "string" } | null,
      "gabarito": "string | null",
      "explicacao": "string",
      "assunto": "string",
      "subassunto": "string | null",
      "disciplina": "string | null",
      "instituicao": "string | null",
      "ano": number | null,
      "tipo_prova": "string | null",
      "fonte": "string | null",
      "fonte_url": "string | null",
      "origem": "pesquisada" | "gerada" | "artigo" | "documento",
      "dificuldade": "basica" | "aplicacao" | "detalhamento"
    }
  ]
}`;
}
