export type StudyTopic = 'soja' | 'calagem' | 'gessagem';
export type StudyDifficulty = 1 | 2 | 3;

export interface StudyValue {
  label: string;
  value: string | number;
  unit?: string;
}

export interface StudyAnswer {
  key: string;
  label: string;
  unit: string;
  value: string | number;
  tolerance?: number;
  type?: 'number' | 'choice';
  choices?: string[];
}

export interface StudyExercise {
  id: string;
  topic: StudyTopic;
  difficulty: StudyDifficulty;
  title: string;
  context: string;
  data: StudyValue[];
  prompt: string;
  answers: StudyAnswer[];
  solution: string[];
  source: string[];
}

const SOY_SOURCE = 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1122295/1/BOLETIM-PD-24-ol.pdf';
const SOIL_SOURCE = 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1127264/1/LV-RecomendacaoSolo-2020-261-264.pdf';

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const choose = <T,>(values: T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(random() * values.length))];

function soybeanExercise(
  id: string,
  difficulty: StudyDifficulty,
  values: { population: number; plants: number; pods: number; grains: number; pmg: number; loss: number },
): StudyExercise {
  const podsPerPlant = values.pods / values.plants;
  const grainsPerPod = values.grains / values.pods;
  const grossKg = values.population * podsPerPlant * grainsPerPod * values.pmg / 1_000_000;
  const grossBags = grossKg / 60;
  const lossBags = grossBags * values.loss / 100;
  const finalBags = grossBags - lossBags;

  const answers: StudyAnswer[] = [
    { key: 'podsPerPlant', label: 'Legumes por planta', unit: 'legumes/planta', value: round(podsPerPlant), tolerance: 0.03 },
    { key: 'grainsPerPod', label: 'Grãos por legume', unit: 'grãos/legume', value: round(grainsPerPod), tolerance: 0.03 },
  ];
  if (difficulty >= 2) {
    answers.push(
      { key: 'grossBags', label: 'Produtividade bruta', unit: 'sc/ha', value: round(grossBags), tolerance: 0.04 },
      { key: 'lossBags', label: 'Quebra', unit: 'sc/ha', value: round(lossBags), tolerance: 0.04 },
    );
  }
  if (difficulty >= 3) {
    answers.push({ key: 'finalBags', label: 'Produtividade final', unit: 'sc/ha', value: round(finalBags), tolerance: 0.04 });
  }

  const solution = [
    'Legumes por planta = ' + values.pods + ' ÷ ' + values.plants + ' = ' + round(podsPerPlant) + '.',
    'Grãos por legume = ' + values.grains + ' ÷ ' + values.pods + ' = ' + round(grainsPerPod) + '.',
  ];
  if (difficulty >= 2) {
    solution.push(
      'Produtividade bruta = população × legumes/planta × grãos/legume × PMG ÷ 1.000.000 ÷ 60 = ' + round(grossBags) + ' sc/ha.',
      'Quebra = ' + round(grossBags) + ' × ' + values.loss + '% = ' + round(lossBags) + ' sc/ha.',
    );
  }
  if (difficulty >= 3) {
    solution.push('Produtividade final = ' + round(grossBags) + ' − ' + round(lossBags) + ' = ' + round(finalBags) + ' sc/ha.');
  }

  return {
    id, topic: 'soja', difficulty,
    title: difficulty === 1 ? 'Componentes do rendimento' : difficulty === 2 ? 'Produtividade e quebra' : 'Estimativa completa da lavoura',
    context: 'Uma lavoura de soja foi amostrada para estimar seus componentes de rendimento. Considere PMG em gramas por mil grãos e saca comercial de 60 kg.',
    data: [
      { label: 'População final', value: values.population.toLocaleString('pt-BR'), unit: 'plantas/ha' },
      { label: 'Plantas avaliadas', value: values.plants, unit: 'plantas' },
      { label: 'Legumes contados', value: values.pods, unit: 'legumes' },
      { label: 'Grãos contados', value: values.grains, unit: 'grãos' },
      { label: 'PMG', value: values.pmg, unit: 'g/1.000 grãos' },
      { label: 'Quebra estimada', value: values.loss, unit: '%' },
    ],
    prompt: difficulty === 1
      ? 'Calcule as médias de legumes por planta e grãos por legume.'
      : difficulty === 2
        ? 'Calcule os componentes do rendimento, a produtividade bruta em sacas e a quebra em sc/ha.'
        : 'Resolva a estimativa completa: componentes do rendimento, produtividade bruta, quebra e produtividade final em sc/ha.',
    answers, solution, source: [SOY_SOURCE],
  };
}

function limingExercise(
  id: string,
  difficulty: StudyDifficulty,
  values: { sb: number; ctc: number; v2: number; prnt: number; area: number },
): StudyExercise {
  const v1 = values.sb / values.ctc * 100;
  const nc = Math.max(0, values.ctc * (values.v2 - v1) / 100 * (100 / values.prnt));
  const total = nc * values.area;
  const answers: StudyAnswer[] = [
    { key: 'v1', label: 'Saturação por bases atual (V₁)', unit: '%', value: round(v1), tolerance: 0.15 },
  ];
  if (difficulty >= 2) {
    answers.push({ key: 'nc', label: 'Necessidade de calcário', unit: 't/ha', value: round(nc), tolerance: 0.03 });
  }
  if (difficulty >= 3) {
    answers.push({ key: 'total', label: 'Calcário para toda a área', unit: 't', value: round(total), tolerance: 0.15 });
  }
  return {
    id, topic: 'calagem', difficulty,
    title: difficulty === 1 ? 'Saturação por bases' : difficulty === 2 ? 'Necessidade de calagem' : 'Calagem em área comercial',
    context: 'A análise química representa a camada de 0–20 cm. Para este exercício didático de soja, adote V₂ = 60% e o método da saturação por bases.',
    data: [
      { label: 'Soma de bases (SB)', value: values.sb, unit: 'cmolc/dm³' },
      { label: 'CTC a pH 7 (T)', value: values.ctc, unit: 'cmolc/dm³' },
      { label: 'V₂ desejado', value: values.v2, unit: '%' },
      { label: 'PRNT do calcário', value: values.prnt, unit: '%' },
      { label: 'Área', value: values.area, unit: 'ha' },
    ],
    prompt: difficulty === 1
      ? 'Determine a saturação por bases atual (V₁).'
      : difficulty === 2
        ? 'Determine V₁ e calcule a necessidade de calcário corrigida pelo PRNT, em t/ha.'
        : 'Determine V₁, a necessidade de calcário em t/ha e a quantidade total para a área informada.',
    answers,
    solution: [
      'V₁ = (SB ÷ CTC) × 100 = (' + values.sb + ' ÷ ' + values.ctc + ') × 100 = ' + round(v1) + '%.',
      'NC = CTC × (V₂ − V₁) ÷ 100 × (100 ÷ PRNT) = ' + round(nc) + ' t/ha.',
      'Quantidade total = ' + round(nc) + ' × ' + values.area + ' ha = ' + round(total) + ' t.',
      'Se V₁ já for igual ou superior a V₂, este exercício considera NC igual a zero; a recomendação real deve seguir o sistema de cultivo e a interpretação técnica da análise.',
    ],
    source: [SOIL_SOURCE, 'https://www.iac.sp.gov.br/publicacoes/boletim100.php'],
  };
}

function gypsumExercise(
  id: string,
  difficulty: StudyDifficulty,
  values: { clay: number; aluminum: number; calcium: number; area: number },
): StudyExercise {
  const needed = values.aluminum > 20 || values.calcium < 0.5;
  const dose = needed ? values.clay * 50 : 0;
  const total = dose * values.area / 1000;
  const answers: StudyAnswer[] = [
    { key: 'needed', label: 'Há indicação pelos critérios do exercício?', unit: '', value: needed ? 'Sim' : 'Não', type: 'choice', choices: ['Sim', 'Não'] },
  ];
  if (difficulty >= 2) {
    answers.push({ key: 'dose', label: 'Dose estimada de gesso', unit: 'kg/ha', value: round(dose), tolerance: 1 });
  }
  if (difficulty >= 3) {
    answers.push({ key: 'total', label: 'Quantidade total para a área', unit: 't', value: round(total), tolerance: 0.05 });
  }
  return {
    id, topic: 'gessagem', difficulty,
    title: difficulty === 1 ? 'Diagnóstico da subsuperfície' : difficulty === 2 ? 'Dose pelo teor de argila' : 'Gessagem em área comercial',
    context: 'Considere a análise da camada de 20–40 cm. Para soja, o material técnico da Embrapa indica avaliar saturação por Al acima de 20% e/ou Ca abaixo de 0,5 cmolc/dm³. Quando indicada neste exercício, a dose é estimada pelo teor de argila × 50.',
    data: [
      { label: 'Argila', value: values.clay, unit: '%' },
      { label: 'Saturação por Al (m)', value: values.aluminum, unit: '%' },
      { label: 'Cálcio trocável (Ca²⁺)', value: values.calcium, unit: 'cmolc/dm³' },
      { label: 'Área', value: values.area, unit: 'ha' },
    ],
    prompt: difficulty === 1
      ? 'Com base nos dois indicadores de subsuperfície, informe se há indicação de gessagem.'
      : difficulty === 2
        ? 'Avalie a indicação e, se aplicável, estime a dose de gesso em kg/ha.'
        : 'Avalie a indicação, estime a dose em kg/ha e calcule a quantidade total necessária para a área.',
    answers,
    solution: [
      'Critério de indicação: saturação por Al > 20% OU Ca²⁺ < 0,5 cmolc/dm³ na camada de 20–40 cm.',
      'Resultado: ' + (needed ? 'há indicação pelos critérios didáticos adotados.' : 'não há indicação pelos critérios didáticos adotados.'),
      'Dose = argila (%) × 50 = ' + values.clay + ' × 50 = ' + round(dose) + ' kg/ha.',
      'Quantidade total = ' + round(dose) + ' kg/ha × ' + values.area + ' ha ÷ 1.000 = ' + round(total) + ' t.',
      'O gesso não substitui o calcário: atua como condicionador da subsuperfície e deve ser recomendado após diagnóstico adequado.',
    ],
    source: [SOIL_SOURCE, 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1123928/1/SP-17-2020-online-1.pdf'],
  };
}

export function getIndividualStudyExercises(): StudyExercise[] {
  return [
    soybeanExercise('soja-basico-01', 1, { population: 230000, plants: 24, pods: 670, grains: 1230, pmg: 175, loss: 15 }),
    soybeanExercise('soja-intermediario-01', 2, { population: 250000, plants: 25, pods: 750, grains: 1650, pmg: 180, loss: 8 }),
    soybeanExercise('soja-avancado-01', 3, { population: 310000, plants: 30, pods: 930, grains: 2140, pmg: 185, loss: 12 }),
    limingExercise('calagem-basico-01', 1, { sb: 3, ctc: 8, v2: 60, prnt: 80, area: 1 }),
    limingExercise('calagem-intermediario-01', 2, { sb: 3.6, ctc: 9, v2: 60, prnt: 90, area: 50 }),
    limingExercise('calagem-avancado-01', 3, { sb: 4.4, ctc: 11, v2: 60, prnt: 75, area: 48 }),
    gypsumExercise('gesso-basico-01', 1, { clay: 24, aluminum: 24, calcium: 0.7, area: 1 }),
    gypsumExercise('gesso-intermediario-01', 2, { clay: 38, aluminum: 14, calcium: 0.42, area: 1 }),
    gypsumExercise('gesso-avancado-01', 3, { clay: 52, aluminum: 18, calcium: 0.72, area: 35 }),
  ];
}

export function createRandomStudyPlan(random: () => number = Math.random): StudyExercise[] {
  const topics: StudyTopic[] = ['soja', 'calagem', 'gessagem'];
  const plan: StudyExercise[] = [];
  for (const difficulty of [1, 2, 3] as StudyDifficulty[]) {
    const order = [...topics].sort(() => random() - 0.5);
    for (const topic of order) {
      const suffix = 'plano-' + difficulty + '-' + topic + '-' + Math.floor(random() * 1_000_000);
      if (topic === 'soja') {
        plan.push(soybeanExercise(suffix, difficulty, {
          population: choose([180000, 200000, 220000, 230000, 250000, 280000, 300000, 320000, 340000], random),
          plants: choose([20, 24, 25, 30], random),
          pods: choose([480, 540, 600, 670, 720, 780, 840, 900], random),
          grains: choose([1050, 1180, 1230, 1350, 1480, 1620, 1750, 1900, 2100], random),
          pmg: choose([160, 165, 170, 175, 180, 185, 190], random),
          loss: choose([5, 7, 8, 10, 12, 15], random),
        }));
      } else if (topic === 'calagem') {
        const ctc = choose([6, 7, 8, 9, 10, 11, 12], random);
        const v1 = choose([25, 30, 35, 40, 45, 50, 55], random);
        const sb = round(ctc * v1 / 100, 2);
        plan.push(limingExercise(suffix, difficulty, {
          sb, ctc, v2: 60, prnt: choose([70, 75, 80, 85, 90], random),
          area: choose([10, 20, 25, 35, 50], random),
        }));
      } else {
        plan.push(gypsumExercise(suffix, difficulty, {
          clay: choose([18, 22, 25, 28, 32, 36, 40, 45, 50, 55], random),
          aluminum: choose([12, 16, 19, 21, 24, 28, 32, 38], random),
          calcium: choose([0.35, 0.42, 0.48, 0.52, 0.6, 0.72], random),
          area: choose([10, 20, 25, 35, 50], random),
        }));
      }
    }
  }
  return plan;
}
