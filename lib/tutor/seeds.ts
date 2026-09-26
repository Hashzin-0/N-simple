import type { QuestionOrigem, TutorQuestion } from './types';

/**
 * Questões-semente extraídas de PROVAS REAIS de agronegócio.
 *
 * - `origem: 'prova_real'` (exige supabase/migration-tutor-prova-real.sql).
 * - Enunciados são reproduzidos literalmente (provas reais).
 * - `gabarito` guarda a RESPOSTA ESPERADA (referência da rubrica do avaliador),
 *   não uma alternativa — são questões discursivas (`alternativas: null`).
 * - `similarity` alto para entrarem cedo na sessão quando o tema casar.
 */
type SeedQuestion = Omit<TutorQuestion, 'id' | 'similarity'>;

const ORIGEM: QuestionOrigem = 'prova_real';

export const SEED_QUESTIONS: SeedQuestion[] = [
  {
    enunciado:
      'A partir dos debates e discussões em sala de aula no decorrer do nosso curso de ética profissional, desenvolva um texto crítico (de no máximo 2 parágrafos) abordando a distinção ou a relação entre moral e ética. Para tal, pense nas aulas sobre moral e sobre ética ministradas neste 1° bimestre.',
    alternativas: null,
    gabarito: [
      'Moral: conjunto de valores, normas e costumes que orientam o agir de um indivíduo ou de um grupo; varia no tempo e no espaço, é vivida como "o que se deve fazer".',
      'Ética: reflexão crítica, sistemática e argumentada sobre esses valores — disciplina filosófica que tem a moral como objeto de estudo.',
      'Distinção: a moral é prática/concreta (costume); a ética é teórica/reflexiva (fundamentação).',
      'Relação: a ética estuda a moral; a moral fornece o material que a ética examina criticamente.',
      'Forma esperada: texto crítico, no máximo 2 parágrafos, com distinção clara e a relação entre as duas noções.',
    ].join('\n'),
    explicacao:
      'Moral é o costume que orienta a ação; ética é a reflexão crítica sobre esse costume. A prova cobra distinguir as duas noções E articulá-las, em texto argumentativo limitado a 2 parágrafos.',
    assunto: 'Ética Profissional',
    subassunto: 'Moral e Ética',
    disciplina: 'Filosofia / Ética',
    instituicao: null,
    ano: null,
    tipo_prova: 'avaliação de curso de Agronegócio',
    fonte: 'Prova real — curso de Agronegócio',
    fonte_url: null,
    origem: ORIGEM,
    dificuldade: 'detalhamento',
  },
  {
    enunciado:
      'Discorra com suas palavras a respeito dos conceitos moral conversadora e moral revolucionária (obs.: no máximo 2 parágrafos).',
    alternativas: null,
    gabarito: [
      'Moral conversadora: ética do pedido de mudança sem ação — fala-se, queixa-se e pede-se que algo mude, mas nada é feito; admita-se a injustiça e se espera que ela mude por conta dos outros.',
      'Moral revolucionária: ética da ação transformadora — quem reconhece a injustiça age para transformá-la, assumindo compromisso, risco e responsabilidade pelas consequências.',
      'Contraste central: discurso/queixa × ação/compromisso; adaptação ao que existe × transformação do que existe.',
      'Forma esperada: texto com as duas noções explicadas com as próprias palavras, no máximo 2 parágrafos.',
    ].join('\n'),
    explicacao:
      'Os conceitos vêm de Paulo Freire (Pedagogia do Oprimido): a moral conversadora limita-se a pedir mudança; a moral revolucionária exige ação. A prova espera o contraste entre as duas, em até 2 parágrafos.',
    assunto: 'Ética Profissional',
    subassunto: 'Moral conversadora e moral revolucionária',
    disciplina: 'Filosofia / Ética',
    instituicao: null,
    ano: null,
    tipo_prova: 'avaliação de curso de Agronegócio',
    fonte: 'Prova real — curso de Agronegócio',
    fonte_url: null,
    origem: ORIGEM,
    dificuldade: 'detalhamento',
  },
];

/** Temas que ativam as seeds de prova real. */
const SEED_MATCHERS = ['ética', 'etica', 'moral', 'profissional'];

/**
 * Retorna as seeds aplicáveis ao tema da sessão.
 * Sem correspondência → lista vazia (não injeta nada).
 */
export function seedsForTema(tema?: string, subtema?: string): SeedQuestion[] {
  const alvo = `${tema ?? ''} ${subtema ?? ''}`.toLowerCase();
  if (!alvo.trim()) return [];
  const bate = SEED_MATCHERS.some((m) => alvo.includes(m));
  return bate ? SEED_QUESTIONS : [];
}

/** Similaridade alta: as seeds entram cedo na fila da sessão. */
export const SEED_SIMILARITY = 0.95;
