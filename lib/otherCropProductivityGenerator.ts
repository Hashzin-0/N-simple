import type { StudyAnswer, StudyDifficulty, StudyValue } from '@/lib/agronomyStudy';

export type OtherCropId = 'sorghum' | 'wheat' | 'rice' | 'common-bean' | 'sunflower';
export type CropGenerationMode = 'basic' | 'intermediate' | 'advanced' | 'balanced';

export interface CropProductivityExercise {
  id: string;
  crop: OtherCropId;
  cropName: string;
  difficulty: StudyDifficulty;
  title: string;
  context: string;
  data: StudyValue[];
  prompt: string;
  answers: StudyAnswer[];
  solution: string[];
  source: string[];
}

export interface CropGenerationOptions {
  crop: OtherCropId;
  mode: CropGenerationMode;
  count: number;
  random?: () => number;
}

export const OTHER_CROP_OPTIONS: Array<{ value: OtherCropId; label: string }> = [
  { value: 'sorghum', label: 'Sorgo granífero' },
  { value: 'wheat', label: 'Trigo' },
  { value: 'rice', label: 'Arroz (grãos)' },
  { value: 'common-bean', label: 'Feijão (grãos secos)' },
  { value: 'sunflower', label: 'Girassol (aquênios)' },
];

interface CropDefinition {
  name: string;
  minYield: number;
  maxYield: number;
  yieldTargets: number[];
  source: string[];
  componentDescription: string;
}

const CROP_DEFINITIONS: Record<OtherCropId, CropDefinition> = {
  sorghum: {
    name: 'Sorgo granífero',
    minYield: 2200,
    maxYield: 7500,
    yieldTargets: [2500, 2800, 3200, 3600, 4000, 4400, 4800, 5200, 5600, 6000, 6400, 6800, 7200],
    source: [
      'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1177156/1/Situacao-atual-e-perspectivas-para-o-sorgo-granifero.pdf',
      'https://apct.sede.embrapa.br/pab/pt_BR/article/view/13486',
    ],
    componentDescription: 'população final, panículas por planta, grãos por panícula e massa de mil grãos',
  },
  wheat: {
    name: 'Trigo',
    minYield: 2000,
    maxYield: 7500,
    yieldTargets: [2200, 2600, 3000, 3400, 3800, 4200, 4600, 5000, 5400, 5800, 6200, 6600, 7000],
    source: [
      'https://www.alice.cnptia.embrapa.br/alice/handle/doc/914301',
      'https://apct.sede.embrapa.br/pab/pt_BR/article/view/19626',
    ],
    componentDescription: 'espigas por metro quadrado, grãos por espiga e massa de mil grãos',
  },
  rice: {
    name: 'Arroz (grãos)',
    minYield: 2500,
    maxYield: 9000,
    yieldTargets: [2800, 3200, 3600, 4000, 4400, 4800, 5200, 5600, 6000, 6400, 6800, 7200, 7600, 8000, 8400, 8800],
    source: [
      'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/941339/1/asp1.pdf',
      'https://www.embrapa.br/en/web/agencia-de-informacao-tecnologica/cultivos/arroz/producao/sistema-de-cultivo/arroz-irrigado-na-regiao-subtropical/manejo-do-solo-e-sistema-de-plantio',
    ],
    componentDescription: 'panículas por metro quadrado, espiguetas por panícula, fertilidade das espiguetas e massa de mil grãos',
  },
  'common-bean': {
    name: 'Feijão (grãos secos)',
    minYield: 800,
    maxYield: 4000,
    yieldTargets: [900, 1100, 1300, 1500, 1700, 1900, 2100, 2300, 2500, 2700, 2900, 3100, 3300, 3500, 3700, 3900],
    source: [
      'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1023574/1/Nutricao-mineral-do-feijoeiro-2015.pdf',
      'https://www.embrapa.br/en/web/agencia-de-informacao-tecnologica/cultivos/feijao/pre-producao/fisiologia',
    ],
    componentDescription: 'vagens por metro quadrado, grãos por vagem e massa de mil sementes',
  },
  sunflower: {
    name: 'Girassol (aquênios)',
    minYield: 900,
    maxYield: 3500,
    yieldTargets: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3200, 3300, 3400],
    source: [
      'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1106985/1/Marchesini.pdf',
      'https://www.alice.cnptia.embrapa.br/alice/handle/doc/1028046',
    ],
    componentDescription: 'plantas por hectare, capítulos por planta, aquênios por capítulo e massa de mil aquênios',
  },
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const pick = <T,>(values: readonly T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(random() * values.length))];

function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

interface ComponentSample {
  yieldKgPerHa: number;
  data: StudyValue[];
  formula: string;
}

function getComponentSample(crop: OtherCropId, random: () => number): ComponentSample {
  const definition = CROP_DEFINITIONS[crop];

  for (let attempt = 0; attempt < 500; attempt += 1) {
    let yieldKgPerHa = 0;
    let data: StudyValue[] = [];
    let formula = '';

    if (crop === 'sorghum') {
      const population = pick([120000, 140000, 160000, 180000, 200000], random);
      const paniclesPerPlant = pick([0.9, 1, 1.05, 1.1], random);
      const grainsPerPanicle = pick([900, 1100, 1300, 1500], random);
      const thousandGrainWeight = pick([25, 28, 30, 32, 34], random);
      yieldKgPerHa = population * paniclesPerPlant * grainsPerPanicle * thousandGrainWeight / 1_000_000;
      data = [
        { label: 'População final', value: population.toLocaleString('pt-BR'), unit: 'plantas/ha' },
        { label: 'Panículas por planta', value: paniclesPerPlant, unit: 'panículas/planta' },
        { label: 'Grãos por panícula', value: grainsPerPanicle.toLocaleString('pt-BR'), unit: 'grãos' },
        { label: 'Massa de mil grãos', value: thousandGrainWeight, unit: 'g' },
      ];
      formula = 'Produtividade (kg/ha) = plantas/ha × panículas/planta × grãos/panícula × MMG (g) ÷ 1.000.000.';
    } else if (crop === 'wheat') {
      const spikesPerM2 = pick([250, 300, 350, 400, 450, 500], random);
      const grainsPerSpike = pick([25, 30, 35, 40, 45], random);
      const thousandGrainWeight = pick([28, 30, 32, 35, 38, 40, 42], random);
      yieldKgPerHa = spikesPerM2 * grainsPerSpike * thousandGrainWeight / 100;
      data = [
        { label: 'Espigas', value: spikesPerM2, unit: 'espigas/m²' },
        { label: 'Grãos por espiga', value: grainsPerSpike, unit: 'grãos' },
        { label: 'Massa de mil grãos', value: thousandGrainWeight, unit: 'g' },
      ];
      formula = 'Produtividade (kg/ha) = espigas/m² × grãos/espiga × MMG (g) ÷ 100.';
    } else if (crop === 'rice') {
      const paniclesPerM2 = pick([200, 240, 280, 320, 360, 400], random);
      const spikeletsPerPanicle = pick([80, 90, 100, 110, 120, 130, 140], random);
      const spikeletFertility = pick([70, 75, 80, 85, 90], random);
      const thousandGrainWeight = pick([20, 22, 24, 26, 28], random);
      yieldKgPerHa = paniclesPerM2 * spikeletsPerPanicle * (spikeletFertility / 100) * thousandGrainWeight / 100;
      data = [
        { label: 'Panículas', value: paniclesPerM2, unit: 'panículas/m²' },
        { label: 'Espiguetas por panícula', value: spikeletsPerPanicle, unit: 'espiguetas' },
        { label: 'Fertilidade das espiguetas', value: spikeletFertility, unit: '%' },
        { label: 'Massa de mil grãos', value: thousandGrainWeight, unit: 'g' },
      ];
      formula = 'Produtividade (kg/ha) = panículas/m² × espiguetas/panícula × fertilidade (%) × MMG (g) ÷ 100.';
    } else if (crop === 'common-bean') {
      const podsPerM2 = pick([100, 130, 160, 190, 220, 250, 280, 300], random);
      const grainsPerPod = pick([3, 4, 5, 6], random);
      const thousandGrainWeight = pick([180, 200, 220, 240, 260, 280, 300, 320], random);
      yieldKgPerHa = podsPerM2 * grainsPerPod * thousandGrainWeight / 100;
      data = [
        { label: 'Vagens', value: podsPerM2, unit: 'vagens/m²' },
        { label: 'Grãos por vagem', value: grainsPerPod, unit: 'grãos' },
        { label: 'Massa de mil sementes', value: thousandGrainWeight, unit: 'g' },
      ];
      formula = 'Produtividade (kg/ha) = vagens/m² × grãos/vagem × M1000 (g) ÷ 100.';
    } else {
      const population = pick([35000, 40000, 45000, 50000, 55000], random);
      const headsPerPlant = pick([0.9, 1, 1.05], random);
      const achenesPerHead = pick([600, 700, 800, 900, 1000], random);
      const thousandAcheneWeight = pick([40, 45, 50, 55, 60, 65, 70], random);
      yieldKgPerHa = population * headsPerPlant * achenesPerHead * thousandAcheneWeight / 1_000_000;
      data = [
        { label: 'População final', value: population.toLocaleString('pt-BR'), unit: 'plantas/ha' },
        { label: 'Capítulos por planta', value: headsPerPlant, unit: 'capítulos/planta' },
        { label: 'Aquênios por capítulo', value: achenesPerHead.toLocaleString('pt-BR'), unit: 'aquênios' },
        { label: 'Massa de mil aquênios', value: thousandAcheneWeight, unit: 'g' },
      ];
      formula = 'Produtividade (kg/ha) = plantas/ha × capítulos/planta × aquênios/capítulo × MMA (g) ÷ 1.000.000.';
    }

    if (yieldKgPerHa >= definition.minYield && yieldKgPerHa <= definition.maxYield) {
      return { yieldKgPerHa, data, formula };
    }
  }

  throw new Error('Não foi possível gerar uma combinação coerente para ' + definition.name + '. Tente gerar novamente.');
}

function makeComponentExercise(
  id: string,
  crop: OtherCropId,
  difficulty: StudyDifficulty,
  random: () => number,
): CropProductivityExercise {
  const definition = CROP_DEFINITIONS[crop];
  const sample = getComponentSample(crop, random);
  const grossKg = sample.yieldKgPerHa;
  const lossPercent = pick([2, 3, 4, 5, 6, 7, 8, 9, 10], random);
  const lossKg = grossKg * lossPercent / 100;
  const netKg = grossKg - lossKg;
  const area = pick([5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100], random);
  const answers: StudyAnswer[] = [
    { key: 'grossKg', label: 'Produtividade bruta estimada', unit: 'kg/ha', value: round(grossKg), tolerance: 2 },
  ];
  if (difficulty >= 2) {
    answers.push(
      { key: 'lossKg', label: 'Perda estimada', unit: 'kg/ha', value: round(lossKg), tolerance: 1 },
      { key: 'netKg', label: 'Produtividade líquida', unit: 'kg/ha', value: round(netKg), tolerance: 2 },
    );
  }
  if (difficulty >= 3) {
    answers.push({ key: 'totalTons', label: 'Produção líquida do talhão', unit: 't', value: round(netKg * area / 1000), tolerance: 0.15 });
  }

  return {
    id,
    crop,
    cropName: definition.name,
    difficulty,
    title: difficulty === 1 ? 'Estimativa pelos componentes de rendimento' : difficulty === 2 ? 'Produtividade bruta e líquida' : 'Projeção da produção comercial do talhão',
    context: 'A equipe avaliou uma amostra representativa de ' + definition.name.toLowerCase() + '. Os componentes informados representam a média da lavoura. A estimativa é teórica e não substitui a pesagem de parcelas nem considera, por si só, todas as perdas de campo.',
    data: [
      ...sample.data,
      ...(difficulty >= 2 ? [{ label: 'Perdas estimadas', value: lossPercent, unit: '%' }] : []),
      ...(difficulty >= 3 ? [{ label: 'Área do talhão', value: area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Calcule a produtividade bruta estimada em kg/ha.'
      : difficulty === 2
        ? 'Calcule a produtividade bruta, a perda em kg/ha e a produtividade líquida em kg/ha.'
        : 'Calcule a produtividade bruta, desconte as perdas e estime a produção líquida total do talhão em toneladas.',
    answers,
    solution: [
      sample.formula,
      'Substituindo os valores, a produtividade bruta estimada é ' + round(grossKg) + ' kg/ha.',
      ...(difficulty >= 2 ? [
        'Perda = ' + round(grossKg) + ' × ' + lossPercent + '% = ' + round(lossKg) + ' kg/ha.',
        'Produtividade líquida = ' + round(grossKg) + ' − ' + round(lossKg) + ' = ' + round(netKg) + ' kg/ha.',
      ] : []),
      ...(difficulty >= 3 ? [
        'Produção total = ' + round(netKg) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(netKg * area / 1000) + ' t.',
      ] : []),
      'A estimativa por componentes pressupõe amostragem representativa e não substitui a aferição da produção colhida, corrigida para a umidade e padrão comercial aplicáveis.',
    ],
    source: definition.source,
  };
}

function makePlotSampleExercise(
  id: string,
  crop: OtherCropId,
  difficulty: StudyDifficulty,
  random: () => number,
): CropProductivityExercise {
  const definition = CROP_DEFINITIONS[crop];
  const targetKg = pick(definition.yieldTargets, random);
  const sampleArea = pick([2, 2.5, 4, 5, 10], random);
  const sampleMassGrams = round(targetKg * sampleArea / 10, 1);
  const lossPercent = pick([2, 3, 4, 5, 6, 7, 8], random);
  const lossKg = targetKg * lossPercent / 100;
  const netKg = targetKg - lossKg;
  const area = pick([5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100], random);
  const answers: StudyAnswer[] = [
    { key: 'grossKg', label: 'Produtividade bruta estimada', unit: 'kg/ha', value: round(targetKg), tolerance: 2 },
  ];
  if (difficulty >= 2) {
    answers.push(
      { key: 'lossKg', label: 'Perda estimada', unit: 'kg/ha', value: round(lossKg), tolerance: 1 },
      { key: 'netKg', label: 'Produtividade líquida', unit: 'kg/ha', value: round(netKg), tolerance: 2 },
    );
  }
  if (difficulty >= 3) {
    answers.push({ key: 'totalTons', label: 'Produção líquida do talhão', unit: 't', value: round(netKg * area / 1000), tolerance: 0.15 });
  }

  return {
    id,
    crop,
    cropName: definition.name,
    difficulty,
    title: difficulty === 1 ? 'Extrapolação de parcela amostrada' : difficulty === 2 ? 'Amostragem com desconto de perdas' : 'Projeção da produção por área',
    context: 'Uma parcela de ' + definition.name.toLowerCase() + ' foi colhida e pesada. Considere que a massa apresentada já está limpa e corrigida para a umidade de referência do exercício; extrapole proporcionalmente para um hectare.',
    data: [
      { label: 'Área da parcela', value: sampleArea, unit: 'm²' },
      { label: 'Massa colhida', value: sampleMassGrams, unit: 'g' },
      ...(difficulty >= 2 ? [{ label: 'Perdas estimadas', value: lossPercent, unit: '%' }] : []),
      ...(difficulty >= 3 ? [{ label: 'Área do talhão', value: area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Converta a massa colhida na parcela para produtividade em kg/ha.'
      : difficulty === 2
        ? 'Calcule a produtividade bruta, a perda e a produtividade líquida em kg/ha.'
        : 'Calcule a produtividade bruta, desconte as perdas e estime a produção líquida do talhão em toneladas.',
    answers,
    solution: [
      'Massa por metro quadrado = ' + sampleMassGrams + ' g ÷ ' + sampleArea + ' m² = ' + round(sampleMassGrams / sampleArea) + ' g/m².',
      'Como 1 g/m² equivale a 10 kg/ha, produtividade bruta = ' + round(sampleMassGrams / sampleArea * 10) + ' kg/ha.',
      ...(difficulty >= 2 ? [
        'Perda = ' + round(targetKg) + ' × ' + lossPercent + '% = ' + round(lossKg) + ' kg/ha.',
        'Produtividade líquida = ' + round(targetKg) + ' − ' + round(lossKg) + ' = ' + round(netKg) + ' kg/ha.',
      ] : []),
      ...(difficulty >= 3 ? [
        'Produção total = ' + round(netKg) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(netKg * area / 1000) + ' t.',
      ] : []),
      'A extrapolação exige parcela e pontos de amostragem representativos da variabilidade do talhão.',
    ],
    source: definition.source,
  };
}

function makeHarvestLossExercise(
  id: string,
  crop: OtherCropId,
  difficulty: StudyDifficulty,
  random: () => number,
): CropProductivityExercise {
  const definition = CROP_DEFINITIONS[crop];
  const grossKg = pick(definition.yieldTargets, random);
  const sampleArea = pick([2, 2.5, 4, 5], random);
  const lossPercent = pick([2, 3, 4, 5, 6, 7, 8, 9, 10], random);
  const lossKg = grossKg * lossPercent / 100;
  const collectedGrams = round(lossKg * sampleArea / 10, 1);
  const netKg = grossKg - lossKg;
  const area = pick([5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100], random);
  const answers: StudyAnswer[] = [
    { key: 'lossKg', label: 'Perda estimada', unit: 'kg/ha', value: round(lossKg), tolerance: 1 },
  ];
  if (difficulty >= 2) {
    answers.push(
      { key: 'grossKg', label: 'Produtividade bruta', unit: 'kg/ha', value: round(grossKg), tolerance: 2 },
      { key: 'netKg', label: 'Produtividade líquida', unit: 'kg/ha', value: round(netKg), tolerance: 2 },
    );
  }
  if (difficulty >= 3) {
    answers.push({ key: 'totalLossTons', label: 'Perda total no talhão', unit: 't', value: round(lossKg * area / 1000), tolerance: 0.15 });
    answers.push({ key: 'netTons', label: 'Produção líquida do talhão', unit: 't', value: round(netKg * area / 1000), tolerance: 0.15 });
  }

  return {
    id,
    crop,
    cropName: definition.name,
    difficulty,
    title: difficulty === 1 ? 'Quantificação das perdas na colheita' : difficulty === 2 ? 'Perdas e produtividade líquida' : 'Impacto das perdas na produção total',
    context: 'Após a colheita de ' + definition.name.toLowerCase() + ', foram recolhidos grãos ou aquênios remanescentes em uma área delimitada. Considere que a amostra representa exclusivamente perdas de colheita e que a produtividade bruta foi estimada antes desse desconto.',
    data: [
      { label: 'Área de coleta', value: sampleArea, unit: 'm²' },
      { label: 'Massa perdida', value: collectedGrams, unit: 'g' },
      ...(difficulty >= 2 ? [{ label: 'Produtividade bruta', value: grossKg.toLocaleString('pt-BR'), unit: 'kg/ha' }] : []),
      ...(difficulty >= 2 ? [{ label: 'Perdas estimadas', value: lossPercent, unit: '%' }] : []),
      ...(difficulty >= 3 ? [{ label: 'Área colhida', value: area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Estime a perda operacional em kg/ha a partir da massa recolhida.'
      : difficulty === 2
        ? 'Calcule a perda em kg/ha e determine a produtividade líquida em kg/ha.'
        : 'Calcule a perda em kg/ha, a massa total perdida e a produção líquida do talhão em toneladas.',
    answers,
    solution: [
      'Massa por metro quadrado = ' + collectedGrams + ' g ÷ ' + sampleArea + ' m² = ' + round(collectedGrams / sampleArea) + ' g/m².',
      'Perda em kg/ha = ' + round(collectedGrams / sampleArea) + ' × 10 = ' + round(lossKg) + ' kg/ha.',
      ...(difficulty >= 2 ? [
        'Produtividade líquida = ' + round(grossKg) + ' − ' + round(lossKg) + ' = ' + round(netKg) + ' kg/ha.',
      ] : []),
      ...(difficulty >= 3 ? [
        'Perda total = ' + round(lossKg) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(lossKg * area / 1000) + ' t.',
        'Produção líquida = ' + round(netKg) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(netKg * area / 1000) + ' t.',
      ] : []),
      'Diferencie perdas naturais, pré-colheita e perdas atribuíveis à máquina. Faça amostragens em pontos distribuídos no talhão.',
    ],
    source: definition.source,
  };
}

function fingerprint(exercise: CropProductivityExercise): string {
  return JSON.stringify({ ...exercise, id: undefined });
}

export function createOtherCropProductivityActivities({
  crop,
  mode,
  count,
  random = Math.random,
}: CropGenerationOptions): CropProductivityExercise[] {
  if (!Object.prototype.hasOwnProperty.call(CROP_DEFINITIONS, crop)) {
    throw new RangeError('Selecione uma cultura disponível para geração de atividades.');
  }
  if (!['basic', 'intermediate', 'advanced', 'balanced'].includes(mode)) {
    throw new RangeError('Selecione um modo de dificuldade válido.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new RangeError('A quantidade deve ser um número inteiro entre 1 e 100.');
  }

  const difficulties: StudyDifficulty[] = mode === 'basic'
    ? Array<StudyDifficulty>(count).fill(1)
    : mode === 'intermediate'
      ? Array<StudyDifficulty>(count).fill(2)
      : mode === 'advanced'
        ? Array<StudyDifficulty>(count).fill(3)
        : Array.from({ length: count }, (_, index) => ([1, 2, 3] as StudyDifficulty[])[index % 3]);

  if (mode === 'balanced') shuffle(difficulties, random);

  const result: CropProductivityExercise[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  const maxAttempts = Math.max(300, count * 100);

  while (result.length < count && attempts < maxAttempts) {
    attempts += 1;
    const difficulty = difficulties[result.length];
    const id = 'cropgen-' + crop + '-' + (result.length + 1) + '-' + attempts;
    const kind = Math.floor(random() * 3);
    const exercise = kind === 0
      ? makeComponentExercise(id, crop, difficulty, random)
      : kind === 1
        ? makePlotSampleExercise(id, crop, difficulty, random)
        : makeHarvestLossExercise(id, crop, difficulty, random);
    const key = fingerprint(exercise);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(exercise);
  }

  if (result.length !== count) {
    throw new Error('Não foi possível gerar atividades distintas com os parâmetros disponíveis. Tente uma quantidade menor.');
  }

  return result;
}
