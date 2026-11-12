import type { StudyAnswer, StudyDifficulty, StudyExercise } from '@/lib/agronomyStudy';

export type SoybeanGenerationMode = 'basic' | 'intermediate' | 'advanced' | 'balanced';

export interface SoybeanGenerationOptions {
  mode: SoybeanGenerationMode;
  count: number;
  random?: () => number;
}

const SOY_YIELD_SOURCE = 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1122295/1/BOLETIM-PD-24-ol.pdf';
const SOY_HARVEST_SOURCE = 'https://www.embrapa.br/web/agencia-de-informacao-tecnologica/cultivos/soja/producao/colheita/fatores-que-afetam-a-colheita';

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const pick = <T,>(values: readonly T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(random() * values.length))];
const randomInt = (min: number, max: number, random: () => number) =>
  min + Math.floor(random() * (max - min + 1));

function componentYieldExercise(
  id: string,
  difficulty: StudyDifficulty,
  random: () => number,
): StudyExercise {
  const targetBags = pick([42, 46, 50, 54, 58, 62, 66, 70, 74, 78, 82, 86], random);
  const grossKg = targetBags * 60;
  let population = 0;
  let podsPerPlant = 0;
  let grainsPerPod = 0;
  let pmg = 0;
  for (let sample = 0; sample < 120; sample += 1) {
    const candidatePopulation = pick([180000, 200000, 220000, 240000, 260000, 280000, 300000, 320000], random);
    const candidatePods = pick([28, 32, 36, 40, 44, 48], random);
    const candidateGrains = pick([1.8, 2, 2.1, 2.2, 2.3, 2.4], random);
    const candidatePmg = round(grossKg * 1_000_000 / (candidatePopulation * candidatePods * candidateGrains), 1);
    if (candidatePmg >= 140 && candidatePmg <= 220) {
      population = candidatePopulation;
      podsPerPlant = candidatePods;
      grainsPerPod = candidateGrains;
      pmg = candidatePmg;
      break;
    }
  }
  if (pmg === 0) throw new Error('Não foi possível montar uma combinação coerente de componentes do rendimento.');
  const lossPercent = pick([2, 3, 4, 5, 6, 7, 8, 9, 10], random);
  const lossKg = grossKg * lossPercent / 100;
  const finalKg = grossKg - lossKg;
  const area = pick([8, 10, 12, 15, 20, 25, 30, 40, 50], random);
  const answers: StudyAnswer[] = [
    { key: 'grossBags', label: 'Produtividade bruta estimada', unit: 'sc/ha', value: round(grossKg / 60), tolerance: 0.04 },
  ];
  if (difficulty >= 2) {
    answers.push({ key: 'lossBags', label: 'Perda estimada', unit: 'sc/ha', value: round(lossKg / 60), tolerance: 0.03 });
    answers.push({ key: 'finalBags', label: 'Produtividade líquida', unit: 'sc/ha', value: round(finalKg / 60), tolerance: 0.04 });
  }
  if (difficulty >= 3) {
    answers.push({ key: 'finalKg', label: 'Produção líquida por hectare', unit: 'kg/ha', value: round(finalKg), tolerance: 2 });
    answers.push({ key: 'totalTons', label: 'Produção líquida do talhão', unit: 't', value: round(finalKg * area / 1000), tolerance: 0.15 });
  }
  return {
    id,
    topic: 'soja',
    difficulty,
    title: difficulty === 1 ? 'Estimativa pelos componentes de rendimento' : difficulty === 2 ? 'Produtividade com desconto de perdas' : 'Estimativa completa da produção comercial',
    context: 'Uma equipe realizou a amostragem de uma lavoura de soja antes da colheita. Para este exercício, considere distribuição uniforme das plantas e que os componentes medidos representam a média do talhão. A saca comercial contém 60 kg.',
    data: [
      { label: 'População final', value: population.toLocaleString('pt-BR'), unit: 'plantas/ha' },
      { label: 'Legumes por planta', value: podsPerPlant, unit: 'legumes/planta' },
      { label: 'Grãos por legume', value: grainsPerPod, unit: 'grãos/legume' },
      { label: 'PMG', value: pmg, unit: 'g/1.000 grãos' },
      ...(difficulty >= 2 ? [{ label: 'Perdas estimadas', value: lossPercent, unit: '%' }] : []),
      ...(difficulty >= 3 ? [{ label: 'Área do talhão', value: area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Estime a produtividade bruta em sacas de 60 kg por hectare.'
      : difficulty === 2
        ? 'Calcule a produtividade bruta, a perda em sc/ha e a produtividade líquida em sc/ha.'
        : 'Calcule a produtividade bruta, desconte as perdas, informe a produção líquida em kg/ha e estime a produção total do talhão em toneladas.',
    answers,
    solution: [
      'Grãos por hectare = população × legumes por planta × grãos por legume.',
      'Massa de grãos (kg/ha) = grãos por hectare × PMG (g) ÷ 1.000.000 = ' + round(grossKg) + ' kg/ha.',
      'Produtividade bruta = ' + round(grossKg) + ' ÷ 60 = ' + round(grossKg / 60) + ' sc/ha.',
      ...(difficulty >= 2 ? [
        'Perdas = ' + round(grossKg / 60) + ' × ' + lossPercent + '% = ' + round(lossKg / 60) + ' sc/ha.',
        'Produtividade líquida = ' + round(grossKg / 60) + ' − ' + round(lossKg / 60) + ' = ' + round(finalKg / 60) + ' sc/ha.',
      ] : []),
      ...(difficulty >= 3 ? [
        'Produção líquida por hectare = ' + round(grossKg) + ' − ' + round(lossKg) + ' = ' + round(finalKg) + ' kg/ha.',
        'Produção total = ' + round(finalKg) + ' × ' + area + ' ÷ 1.000 = ' + round(finalKg * area / 1000) + ' t.',
      ] : []),
      'A estimativa por componentes pressupõe que a amostragem represente o talhão. A produtividade efetiva pode variar com abortamento, enchimento, sanidade, ambiente e perdas de colheita.',
    ],
    source: [SOY_YIELD_SOURCE, SOY_HARVEST_SOURCE],
  };
}

function plotSampleExercise(
  id: string,
  difficulty: StudyDifficulty,
  random: () => number,
): StudyExercise {
  const targetBags = pick([40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84], random);
  const grossKgPerHa = targetBags * 60;
  const sampleArea = pick([1, 2, 2.5, 3, 4, 5], random);
  const sampleMass = round(grossKgPerHa * sampleArea / 10, 1);
  const area = pick([5, 8, 10, 15, 20, 25, 35, 50], random);
  const answers: StudyAnswer[] = [
    { key: 'kgPerHa', label: 'Produtividade estimada', unit: 'kg/ha', value: round(grossKgPerHa), tolerance: 1 },
  ];
  if (difficulty >= 2) answers.push({ key: 'bagsPerHa', label: 'Produtividade estimada', unit: 'sc/ha', value: round(targetBags), tolerance: 0.03 });
  if (difficulty >= 3) answers.push({ key: 'totalTons', label: 'Produção estimada do talhão', unit: 't', value: round(grossKgPerHa * area / 1000), tolerance: 0.15 });
  return {
    id,
    topic: 'soja',
    difficulty,
    title: difficulty === 1 ? 'Estimativa por área amostrada' : difficulty === 2 ? 'Conversão da amostra em sacas por hectare' : 'Projeção da produção da área',
    context: 'Em uma área representativa, os grãos de soja foram colhidos e pesados em uma parcela delimitada. Considere a massa informada como grãos limpos, sem impurezas, e extrapole proporcionalmente para um hectare.',
    data: [
      { label: 'Área da amostra', value: sampleArea, unit: 'm²' },
      { label: 'Massa de grãos', value: sampleMass, unit: 'g' },
      ...(difficulty >= 3 ? [{ label: 'Área total', value: area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Converta a massa coletada para produtividade em kg/ha.'
      : difficulty === 2
        ? 'Determine a produtividade em kg/ha e converta para sacas de 60 kg por hectare.'
        : 'Determine kg/ha, sc/ha e a produção total estimada para a área do talhão, em toneladas.',
    answers,
    solution: [
      'Massa por metro quadrado = ' + sampleMass + ' g ÷ ' + sampleArea + ' m² = ' + round(sampleMass / sampleArea) + ' g/m².',
      'Como 1 g/m² equivale a 10 kg/ha, produtividade = ' + round(sampleMass / sampleArea * 10) + ' kg/ha.',
      ...(difficulty >= 2 ? ['Sacas por hectare = ' + round(grossKgPerHa) + ' ÷ 60 = ' + round(targetBags) + ' sc/ha.'] : []),
      ...(difficulty >= 3 ? ['Produção total = ' + round(grossKgPerHa) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(grossKgPerHa * area / 1000) + ' t.'] : []),
      'A extrapolação só é representativa quando a parcela e os pontos de amostragem refletem a variabilidade do talhão.',
    ],
    source: [SOY_YIELD_SOURCE],
  };
}

function harvestLossExercise(
  id: string,
  difficulty: StudyDifficulty,
  random: () => number,
): StudyExercise {
  const grossBags = pick([48, 52, 56, 60, 64, 68, 72, 76, 80], random);
  const grossKg = grossBags * 60;
  const sampleArea = pick([1, 2, 2.5, 3, 4, 5], random);
  const lossKgPerHa = pick([30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160], random);
  const collectedGrams = round(lossKgPerHa * sampleArea / 10, 1);
  const lossBags = lossKgPerHa / 60;
  const netKg = grossKg - lossKgPerHa;
  const area = pick([5, 8, 10, 15, 20, 25, 35, 50], random);
  const answers: StudyAnswer[] = [
    { key: 'lossKg', label: 'Perda estimada', unit: 'kg/ha', value: round(lossKgPerHa), tolerance: 0.2 },
  ];
  if (difficulty >= 2) {
    answers.push({ key: 'lossBags', label: 'Perda estimada', unit: 'sc/ha', value: round(lossBags), tolerance: 0.02 });
    answers.push({ key: 'netBags', label: 'Produtividade líquida', unit: 'sc/ha', value: round(netKg / 60), tolerance: 0.04 });
  }
  if (difficulty >= 3) {
    answers.push({ key: 'totalLoss', label: 'Perda total no talhão', unit: 't', value: round(lossKgPerHa * area / 1000), tolerance: 0.1 });
    answers.push({ key: 'netTons', label: 'Produção líquida do talhão', unit: 't', value: round(netKg * area / 1000), tolerance: 0.15 });
  }
  return {
    id,
    topic: 'soja',
    difficulty,
    title: difficulty === 1 ? 'Quantificação das perdas na colheita' : difficulty === 2 ? 'Perdas e produtividade líquida' : 'Impacto econômico-físico das perdas na área',
    context: 'Após a passagem da colhedora, a equipe recolheu grãos e vagens perdidos em uma área delimitada. Considere que a massa coletada representa exclusivamente perdas operacionais e que a produtividade bruta estimada antes do desconto foi obtida por amostragem.',
    data: [
      { label: 'Área de coleta', value: sampleArea, unit: 'm²' },
      { label: 'Massa recolhida', value: collectedGrams, unit: 'g' },
      ...(difficulty >= 2 ? [{ label: 'Produtividade bruta', value: grossBags, unit: 'sc/ha' }] : []),
      ...(difficulty >= 3 ? [{ label: 'Área colhida', value: area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Estime a perda operacional em kg/ha.'
      : difficulty === 2
        ? 'Calcule a perda em kg/ha e sc/ha e determine a produtividade líquida em sc/ha.'
        : 'Calcule a perda em kg/ha, sc/ha, a massa total perdida e a produção líquida total do talhão em toneladas.',
    answers,
    solution: [
      'Massa por m² = ' + collectedGrams + ' g ÷ ' + sampleArea + ' m² = ' + round(collectedGrams / sampleArea) + ' g/m².',
      'Perda em kg/ha = ' + round(collectedGrams / sampleArea) + ' × 10 = ' + round(lossKgPerHa) + ' kg/ha.',
      ...(difficulty >= 2 ? [
        'Perda em sacas = ' + round(lossKgPerHa) + ' ÷ 60 = ' + round(lossBags) + ' sc/ha.',
        'Produtividade líquida = ' + grossBags + ' − ' + round(lossBags) + ' = ' + round(netKg / 60) + ' sc/ha.',
      ] : []),
      ...(difficulty >= 3 ? [
        'Perda total = ' + round(lossKgPerHa) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(lossKgPerHa * area / 1000) + ' t.',
        'Produção líquida = (' + round(grossKg) + ' − ' + round(lossKgPerHa) + ') kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(netKg * area / 1000) + ' t.',
      ] : []),
      'Repita a amostragem em pontos distribuídos no talhão e diferencie perdas naturais, pré-colheita e perdas atribuíveis à máquina.',
    ],
    source: [SOY_HARVEST_SOURCE, SOY_YIELD_SOURCE],
  };
}

function generateOne(id: string, difficulty: StudyDifficulty, random: () => number): StudyExercise {
  const kind = Math.floor(random() * 3);
  if (kind === 0) return componentYieldExercise(id, difficulty, random);
  if (kind === 1) return plotSampleExercise(id, difficulty, random);
  return harvestLossExercise(id, difficulty, random);
}

function contentFingerprint(exercise: StudyExercise): string {
  return JSON.stringify({ ...exercise, id: undefined });
}

export function createSoybeanProductivityActivities({
  mode,
  count,
  random = Math.random,
}: SoybeanGenerationOptions): StudyExercise[] {
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

  if (mode === 'balanced') {
    for (let index = difficulties.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [difficulties[index], difficulties[swapIndex]] = [difficulties[swapIndex], difficulties[index]];
    }
  }

  const result: StudyExercise[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  const maxAttempts = Math.max(200, count * 80);

  while (result.length < count && attempts < maxAttempts) {
    attempts += 1;
    const difficulty = difficulties[result.length];
    const exercise = generateOne('soygen-' + (result.length + 1) + '-' + attempts, difficulty, random);
    const fingerprint = contentFingerprint(exercise);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    result.push(exercise);
  }

  if (result.length !== count) {
    throw new Error('Não foi possível gerar atividades distintas com os parâmetros disponíveis. Tente uma quantidade menor.');
  }

  return result;
}
