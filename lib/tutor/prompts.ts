export const TUTOR_PROMPT_VERSION = '1.0.0';

export interface EvaluateAnswerArgs {
  enunciado: string;
  respostaAluno: string;
  gabarito?: string | null;
  explicacao?: string | null;
  contextoFontes?: string;
  dificuldade?: string;
}

/**
 * Prompt de avaliação semântica e conceitual da resposta oral/escrita do aluno.
 * Não compara por igualdade de texto nem por percentual de similaridade.
 * Retorna 4 dimensões + status geral + feedback para melhoria da formulação.
 */
export function buildEvaluatePrompt(args: EvaluateAnswerArgs): string {
  const gabarito = args.gabarito?.trim()
    ? args.gabarito.trim()
    : 'Não informado (questão aberta avaliada por conceitos).';
  const explicacao = args.explicacao?.trim() || 'Não informada.';
  const contexto = args.contextoFontes?.trim()
    ? args.contextoFontes.trim()
    : 'Nenhuma fonte adicional disponível. Use seu conhecimento agronômico padrão.';
  const dificuldade = args.dificuldade || 'desconhecida';

  return `Você é um tutor oral de agronomia (revisão para provas, ENEM, vestibulares e disciplinas de Agronegócio).
Avalie a resposta do aluno de forma SEMÂNTICA e CONCEITUAL — nunca por igualdade de texto nem por similaridade percentual crua.

DIFICULDADE DA QUESTÃO: ${dificuldade}

ENUNCIADO DA QUESTÃO:
${args.enunciado}

GABARITO / RESPOSTA ESPERADA:
${gabarito}

EXPLICAÇÃO PEDAGÓGICA (se houver):
${explicacao}

CONTEXTO CIENTÍFICO DAS FONTES PESQUISADAS:
${contexto}

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
  "feedbackOral": "string"
}`;
}

export interface ExtractQuestionsArgs {
  tema: string;
  subtema?: string;
  fontesContext: string;
  origemPadrao?: 'pesquisada' | 'gerada';
}

/**
 * Prompt de extração de questões estruturadas a partir de fontes acadêmicas
 * (ENEM, vestibulares, universidades, materiais de Agronegócio).
 */
export function buildExtractQuestionsPrompt(args: ExtractQuestionsArgs): string {
  const assunto = args.subtema ? `${args.tema} — ${args.subtema}` : args.tema;
  const origem = args.origemPadrao || 'pesquisada';

  return `Você é um especialista em elaboração e curadoria de questões de prova em agronomia e ciências agrárias.

TEMA: ${assunto}

FONTES ACADÊMICAS PESQUISADAS:
${args.fontesContext}

---

TAREFA: Extraia ou elabore questões de prova sobre o tema acima, usando o conteúdo das fontes.

Para cada questão, defina:
- enunciado: texto completo da questão (aberta ou com alternativas)
- alternativas: objeto com chaves "A".."E" quando houver múltipla escolha; null para questão aberta
- gabarito: letra ("A".."E") ou resposta esperada; null se for discursiva sem gabarito fechado
- explicacao: explicação pedagógica curta da resposta
- assunto: tema geral (ex: "Fertilidade do Solo")
- subassunto: subtema específico (ex: "Calagem")
- disciplina: ex: "Solo", "Nutrição de Plantas", "Adubação"
- instituicao: origem real se identificável nas fontes (ENEM, UFRJ, UFV, Escola de Agronegócio...); senão null
- ano: ano da prova se identificado; senão null
- tipo_prova: ex: "ENEM", "vestibular", "avaliação universitária", "concurso educacional"; senão "questão didática"
- fonte: nome curto da fonte de onde veio o conteúdo
- fonte_url: URL da fonte se disponível; senão null
- origem: "${origem}" se extraída de fonte real com dados identificáveis; "gerada" se você elaborou a partir do conteúdo
- dificuldade: "basica" | "aplicacao" | "detalhamento"

REGRAS:
1. Gere de 4 a 8 questões, misturando dificuldades (pelo menos 1 de cada).
2. Pelo menos 2 questões devem ser de aplicação prática (contexto de campo/fazenda).
3. Não invente instituição/ano — se não estiver nas fontes, use null.
4. Questões de múltipla escolha devem ter 4 ou 5 alternativas plausíveis, com apenas uma correta.
5. Prefira questões cujo conteúdo apareça nas fontes (origem "pesquisada").
6. Seja fiel à ciência agronômica brasileira (Embrapa, normas técnicas, terminologia pt-BR).

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
      "origem": "pesquisada" | "gerada",
      "dificuldade": "basica" | "aplicacao" | "detalhamento"
    }
  ]
}`;
}
