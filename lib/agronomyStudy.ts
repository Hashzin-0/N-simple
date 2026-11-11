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
  type?: 'number' | 'choice' | 'text';
  choices?: string[];
  acceptedConcepts?: string[][];
  explanation?: string;
  minimumConcepts?: number;
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
      ...(difficulty >= 2 ? [
        { label: 'PMG', value: values.pmg, unit: 'g/1.000 grãos' },
        { label: 'Quebra estimada', value: values.loss, unit: '%' },
      ] : []),
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
      ...(difficulty >= 2 ? [
        { label: 'V₂ desejado', value: values.v2, unit: '%' },
        { label: 'PRNT do calcário', value: values.prnt, unit: '%' },
      ] : []),
      ...(difficulty >= 3 ? [{ label: 'Área', value: values.area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Determine a saturação por bases atual (V₁).'
      : difficulty === 2
        ? 'Determine V₁ e calcule a necessidade de calcário corrigida pelo PRNT, em t/ha.'
        : 'Determine V₁, a necessidade de calcário em t/ha e a quantidade total para a área informada.',
    answers,
    solution: [
      'V₁ = (SB ÷ CTC) × 100 = (' + values.sb + ' ÷ ' + values.ctc + ') × 100 = ' + round(v1) + '%.',
      ...(difficulty >= 2 ? ['NC = CTC × (V₂ − V₁) ÷ 100 × (100 ÷ PRNT) = ' + round(nc) + ' t/ha.'] : []),
      ...(difficulty >= 3 ? ['Quantidade total = ' + round(nc) + ' × ' + values.area + ' ha = ' + round(total) + ' t.'] : []),
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
      ...(difficulty >= 3 ? [{ label: 'Área', value: values.area, unit: 'ha' }] : []),
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
      ...(difficulty >= 2 ? ['Dose = argila (%) × 50 = ' + values.clay + ' × 50 = ' + round(dose) + ' kg/ha.'] : []),
      ...(difficulty >= 3 ? ['Quantidade total = ' + round(dose) + ' kg/ha × ' + values.area + ' ha ÷ 1.000 = ' + round(total) + ' t.'] : []),
      'Na referência consultada para soja, o gesso é aplicado na superfície após a calagem, sem incorporação. Ele não substitui o calcário.',
    ],
    source: [SOIL_SOURCE, 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1123928/1/SP-17-2020-online-1.pdf'],
  };
}

function conceptExercise(
  id: string,
  topic: StudyTopic,
  difficulty: StudyDifficulty,
  title: string,
  context: string,
  prompt: string,
  acceptedConcepts: string[][],
  explanation: string,
  choices?: string[],
): StudyExercise {
  return {
    id, topic, difficulty, title, context,
    data: [],
    prompt,
    answers: [{
      key: 'concept',
      label: choices ? 'Selecione a alternativa' : 'Explique com suas palavras',
      unit: '',
      value: choices?.[0] ?? 'Resposta conceitual',
      type: choices ? 'choice' : 'text',
      choices,
      acceptedConcepts,
      minimumConcepts: Math.max(1, acceptedConcepts.length - 1),
      explanation,
    }],
    solution: [explanation],
    source: topic === 'soja' ? [SOY_SOURCE] : [SOIL_SOURCE, 'https://www.iac.sp.gov.br/publicacoes/boletim100.php'],
  };
}

function getConceptStudyExercises(): StudyExercise[] {
  return [
    conceptExercise(
      'conceito-soja-multipla-01', 'soja', 1,
      'O que representa o PMG?',
      'Na estimativa da produtividade, além da população e dos componentes de rendimento, é necessário considerar a massa dos grãos.',
      'O que significa PMG na avaliação da produtividade da soja?',
      [['massa de mil graos', 'peso de mil graos', 'massa de 1000 graos']],
      'PMG é a massa (ou peso) de mil grãos, normalmente expressa em gramas. Esse parâmetro representa o tamanho/massa média dos grãos e participa da estimativa de produtividade.',
      ['Massa ou peso de mil grãos', 'População de plantas por metro', 'Número de legumes por planta'],
    ),
    conceptExercise(
      'conceito-soja-aberta-01', 'soja', 2,
      'Por que contar os componentes de rendimento?',
      'Uma amostragem de campo registra população final, legumes por planta, grãos por legume e PMG.',
      'Explique como esses componentes ajudam a estimar a produtividade da lavoura.',
      [['populacao de plantas', 'plantas por hectare', 'estande'], ['legumes por planta', 'vagens por planta'], ['graos por legume', 'graos por vagem'], ['massa de mil graos', 'peso de mil graos', 'pmg']],
      'A produtividade estimada relaciona a população de plantas por área, a quantidade de legumes por planta, os grãos por legume e a massa de mil grãos. A amostragem permite estimar o rendimento antes da colheita.',
    ),
    conceptExercise(
      'conceito-calagem-multipla-01', 'calagem', 1,
      'Função principal da calagem',
      'Considere uma área com solo ácido e análise química indicando necessidade de correção.',
      'A calagem é utilizada principalmente para corrigir a acidez do solo e elevar o pH?',
      [['sim']],
      'Sim. A calagem neutraliza parte da acidez, eleva o pH conforme a dose e o poder de neutralização do corretivo, fornece cálcio e magnésio e reduz a atividade tóxica do alumínio.',
      ['Sim. Corrige a acidez, eleva o pH e pode fornecer cálcio e magnésio.', 'Não. Sua função é somente fornecer enxofre.', 'Não. É aplicada exclusivamente para aumentar a matéria orgânica.'],
    ),
    conceptExercise(
      'conceito-calagem-aberta-01', 'calagem', 1,
      'Como a calagem corrige a acidez?',
      'Uma análise de solo indica acidez elevada e necessidade de aplicação de calcário.',
      'Explique, com suas palavras, como a calagem melhora as condições químicas de um solo ácido.',
      [['neutraliza acidez', 'neutraliza a acidez', 'corrige a acidez', 'corrige acidez', 'eleva ph', 'eleva o ph', 'aumenta ph', 'aumenta o ph'], ['fornece calcio', 'fornece calcio e magnesio', 'calcio e magnesio', 'magnesio'], ['reduz aluminio', 'reduz o aluminio', 'diminui o aluminio', 'aluminio toxico', 'toxicidade do aluminio']],
      'A calagem neutraliza parte da acidez, eleva o pH, fornece cálcio e magnésio e reduz a atividade tóxica do alumínio. A dose deve ser calculada com base na análise do solo e nas características do corretivo.',
    ),
    conceptExercise(
      'conceito-calagem-aberta-02', 'calagem', 2,
      'Por que o PRNT altera a dose?',
      'Dois calcários podem apresentar PRNT diferentes, mesmo quando a necessidade de calagem calculada é a mesma.',
      'Explique por que o PRNT precisa ser considerado no cálculo da quantidade de calcário.',
      [['poder relativo de neutralizacao', 'prnt'], ['eficiencia', 'reatividade', 'neutralizacao'], ['dose', 'quantidade', 'corrigir']],
      'O PRNT expressa o poder relativo de neutralização total do corretivo. Quanto menor o PRNT, menor a eficiência relativa considerada no cálculo e maior tende a ser a quantidade necessária para fornecer o mesmo efeito corretivo.',
    ),
    conceptExercise(
      'conceito-gessagem-multipla-01', 'gessagem', 1,
      'Gesso substitui o calcário?',
      'O gesso agrícola e o calcário possuem composição e funções agronômicas diferentes.',
      'O gesso agrícola substitui o calcário na correção da acidez da camada superficial?',
      [['nao']],
      'Não. O gesso não substitui o calcário e não tem a mesma função de elevar o pH da camada superficial. É utilizado como condicionador, especialmente para melhorar o ambiente químico em subsuperfície, fornecendo cálcio e enxofre e reduzindo limitações associadas ao alumínio.',
      ['Não. São insumos com funções diferentes; o gesso pode melhorar a subsuperfície.', 'Sim, porque eleva o pH da mesma forma que o calcário.', 'Sim, desde que aplicado em dose dobrada.'],
    ),
    conceptExercise(
      'conceito-gessagem-aberta-03', 'gessagem', 3,
      'Quando avaliar a necessidade de gessagem?',
      'A decisão deve considerar a análise química de subsuperfície, e não apenas a análise superficial.',
      'Explique quais indicadores da camada de 20–40 cm podem sinalizar a necessidade de gessagem para soja.',
      [['20 40 cm', '20-40 cm', 'subsuperficie', 'camada de 20'], ['aluminio', 'saturacao por aluminio', 'm > 20', 'acima de 20'], ['calcio', 'ca < 0,5', 'abaixo de 0,5']],
      'Na referência técnica consultada para soja, avalia-se a camada de 20–40 cm. Saturação por alumínio acima de 20% e/ou cálcio trocável abaixo de 0,5 cmolc/dm³ são critérios que podem indicar a necessidade de gessagem, conforme a recomendação regional.',
    ),
  ];
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
    ...getConceptStudyExercises(),
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
        const pods = choose([480, 540, 600, 670, 720, 780, 840, 900], random);
        const grainsPerPod = choose([1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4], random);
        plan.push(soybeanExercise(suffix, difficulty, {
          population: choose([180000, 200000, 220000, 230000, 250000, 280000, 300000, 320000, 340000], random),
          plants: choose([20, 24, 25, 30], random),
          pods,
          grains: Math.round(pods * grainsPerPod),
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
  const availableConcepts = getConceptStudyExercises().filter((exercise) => exercise.answers[0].type === 'text');
  const concepts = (['soja', 'calagem', 'gessagem'] as StudyTopic[]).map((topic) =>
    choose(availableConcepts.filter((exercise) => exercise.topic === topic), random),
  );
  plan.push(...concepts);

  const ordered = plan.sort((a, b) => a.difficulty - b.difficulty);
  let start = 0;
  while (start < ordered.length) {
    let end = start + 1;
    while (end < ordered.length && ordered[end].difficulty === ordered[start].difficulty) end += 1;
    for (let index = end - 1; index > start; index -= 1) {
      const swapIndex = start + Math.floor(random() * (index - start + 1));
      [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
    }
    start = end;
  }
  return ordered;
}
