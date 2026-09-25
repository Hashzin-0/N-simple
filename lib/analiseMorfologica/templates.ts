import type { ClasseGramatical } from './types';
import { DICT } from './bancos';

export type Slot =
  | { t: 'fixo'; p: string; c: ClasseGramatical }
  | { t: 'banco'; b: string }
  | { t: 'pont'; p: string };

export interface Template {
  id: string;
  slots: Slot[];
}

function f(p: string): Slot {
  const c = DICT[p.toLowerCase()];
  if (!c) console.warn(`[analiseMorfologica] palavra fixa sem classe no DICT: "${p}"`);
  return { t: 'fixo', p, c: c ?? 'substantivo' };
}

function b(banco: string): Slot {
  return { t: 'banco', b: banco };
}

function pt(p: string): Slot {
  return { t: 'pont', p };
}

/**
 * Templates de frases montadas na hora.
 * Regras de curadoria:
 * - sem contrações (no/na/do/da/pelo...), para não gerar resposta disputada;
 * - slots de banco só usam palavras gramaticais e semânticamente compatíveis
 *   com o contexto do template;
 * - palavra fixa só sai de DICT (classe única incontestável);
 * - pontuação (, . ! ? ;) é renderizada, mas não é clicável.
 */
export const TEMPLATES: Template[] = [
  {
    id: 't01',
    slots: [f('O'), b('S_M_ANIM'), b('V_3S_MOVE'), f('entre'), f('os'), b('S_M_P_OBJ'), pt('.')],
  },
  {
    id: 't02',
    slots: [f('A'), b('S_F_INAN'), f('é'), b('A_F_S_FIS'), f('e'), b('A_F_S_FIS'), pt('.')],
  },
  {
    id: 't03',
    slots: [f('Eu'), b('V_1S_COM'), b('ADV_TEMPO'), f('para'), f('você'), pt('.')],
  },
  {
    id: 't04',
    slots: [b('INT'), pt('!'), f('A'), b('S_F_ANIM'), b('V_3S_CHEGOU'), b('ADV_TEMPO'), pt('!')],
  },
  {
    id: 't05',
    slots: [
      f('O'), b('S_M_ANIM'), b('V_3S_REST'), b('C_CAUSAL'), f('ele'), b('V_3S_STATE'), pt('.'),
    ],
  },
  {
    id: 't06',
    slots: [f('Alguém'), b('V_3S_TRAGA'), f('o'), b('S_M_OBJ'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't07',
    slots: [b('INT'), pt('!'), f('A'), b('S_F_EVENTO'), b('V_3S_EVENTO'), b('ADV_TEMPO'), pt('!')],
  },
  {
    id: 't08',
    slots: [f('Os'), b('S_M_P_ANIM'), b('A_M_P'), b('V_3P'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't09',
    slots: [f('Ela'), b('V_COMP'), f('com'), f('a'), b('S_F_ANIM'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't10',
    slots: [b('INT'), pt('!'), f('Nós'), b('V_1P'), b('PRON_DEMO'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't11',
    slots: [
      b('C_COND'), f('a'), b('S_F_ANIM'), b('V_3S_PRES'), b('ADV_TEMPO'), pt(','),
      f('a'), b('S_F_EVENTO'), b('V_3S_EVENTO_PRES'), pt('.'),
    ],
  },
  {
    id: 't12',
    slots: [f('O'), b('S_M_ANIM'), b('V_3S_MOVE'), b('ADV_MODO'), b('ADV_LUG'), pt('.')],
  },
  {
    id: 't13',
    slots: [b('INT'), pt('!'), f('O'), b('S_M_ABST'), b('V_3S_ABST'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't14',
    slots: [f('A'), b('S_F_INAN'), f('está'), b('A_F_S_FIS'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't15',
    slots: [
      f('A'), b('S_F_ANIM'), b('V_3S_PAS'), pt(','), b('C_CONTRAST'), f('ele'), b('V_3S_PAS_EMOT'), pt('.'),
    ],
  },
  {
    id: 't16',
    slots: [f('As'), b('S_F_P_ANIM'), b('A_F_P'), b('V_3P'), b('ADV_LUG'), pt('.')],
  },
  {
    id: 't17',
    slots: [
      f('O'), b('S_M_ANIM'), b('V_3S_MOVE'), b('ADV_LUG'), pt(','), f('e'), f('um'), b('S_M_ANIM'), b('V_3S_INTRA'), pt('.'),
    ],
  },
  {
    id: 't18',
    slots: [f('A'), b('S_F_ANIM'), b('V_COMP'), f('com'), f('a'), b('S_F_ANIM'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't19',
    slots: [f('Ninguém'), b('V_3S_INTRA'), b('ADV_LUG'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't20',
    slots: [f('O'), b('S_M_ABST'), f('foi'), b('A_M_S_ABST'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't21',
    slots: [b('INT'), pt('!'), f('Ele'), b('V_3S_VER'), b('PRON_DEMO'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't22',
    slots: [f('Um'), b('S_M_ANIM'), b('V_3S_MOVE'), f('de'), b('S_F_ABST'), pt('.')],
  },
  {
    id: 't23',
    slots: [f('Nós'), b('V_1P'), b('ADV_LUG'), b('C_COORD'), b('ADV_LUG'), pt('.')],
  },
  {
    id: 't24',
    slots: [f('A'), b('S_F_INAN'), b('V_3S_COISA'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't25',
    slots: [f('Um'), b('S_M_ANIM'), b('A_M_S'), b('V_3S_PRES'), b('ADV_TEMPO'), pt('.')],
  },
  {
    id: 't26',
    slots: [f('As'), b('S_F_P_OBJ'), f('são'), b('A_F_P'), pt('.')],
  },
  {
    id: 't27',
    slots: [f('A'), b('S_F_ABST'), f('está'), b('A_F_S_ABST'), b('ADV_TEMPO'), pt('.')],
  },
];
