import type { StudyAnswer, StudyDifficulty, StudyValue } from '@/lib/agronomyStudy';

export type CornGenerationMode = 'basic' | 'intermediate' | 'advanced' | 'balanced';
export interface CornProductivityExercise {
  id: string; difficulty: StudyDifficulty; title: string; context: string;
  data: StudyValue[]; prompt: string; answers: StudyAnswer[]; solution: string[]; source: string[];
}
export interface CornGenerationOptions { mode: CornGenerationMode; count: number; random?: () => number; }

const SOURCES = ['https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/486917/1/Sistema-de-Producao-Cultivo-do-Milho.pdf', 'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/476137/1/Colheitamilho.pdf'];
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const pick = <T,>(values: readonly T[], random: () => number): T => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
function shuffle<T>(values: T[], random: () => number): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1)); [values[index], values[swap]] = [values[swap], values[index]];
  }
}
function balancedDifficulties(count: number, random: () => number): StudyDifficulty[] {
  const result: StudyDifficulty[] = [];
  while (result.length < count) { const batch: StudyDifficulty[] = [1, 2, 3]; shuffle(batch, random); result.push(...batch.slice(0, count - result.length)); }
  return result;
}
function componentExercise(id: string, difficulty: StudyDifficulty, random: () => number): CornProductivityExercise {
  let sample: { plantsPerMeter: number; rowSpacing: number; earsPerPlant: number; rowsPerEar: number; grainsPerRow: number; pmg: number; grossKg: number } | null = null;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const plantsPerMeter = pick([3.5, 4, 4.5], random);
    const rowSpacing = pick([0.5, 0.55, 0.6], random);
    const earsPerPlant = pick([0.9, 1, 1.05], random);
    const rowsPerEar = pick([14, 16, 18], random);
    const grainsPerRow = pick([28, 30, 32, 35, 38], random);
    const pmg = pick([260, 280, 300, 320, 340], random);
    const population = plantsPerMeter / rowSpacing * 10000;
    const grossKg = population * earsPerPlant * rowsPerEar * grainsPerRow * pmg / 1_000_000;
    if (grossKg >= 6500 && grossKg <= 18000) { sample = { plantsPerMeter, rowSpacing, earsPerPlant, rowsPerEar, grainsPerRow, pmg, grossKg }; break; }
  }
  if (!sample) throw new Error('Não foi possível gerar componentes coerentes para milho.');
  const lossPercent = pick([2, 3, 4, 5, 6, 7, 8, 9, 10], random);
  const lossKg = sample.grossKg * lossPercent / 100;
  const netKg = sample.grossKg - lossKg;
  const area = pick([5, 8, 10, 15, 20, 25, 30, 40, 50], random);
  const grossBags = sample.grossKg / 60;
  const answers: StudyAnswer[] = [{ key: 'grossBags', label: 'Produtividade bruta', unit: 'sc/ha', value: round(grossBags), tolerance: 0.04 }];
  if (difficulty >= 2) answers.push({ key: 'lossBags', label: 'Perdas estimadas', unit: 'sc/ha', value: round(lossKg / 60), tolerance: 0.03 }, { key: 'netBags', label: 'Produtividade líquida', unit: 'sc/ha', value: round(netKg / 60), tolerance: 0.04 });
  if (difficulty >= 3) answers.push({ key: 'netKg', label: 'Produtividade líquida', unit: 'kg/ha', value: round(netKg), tolerance: 2 }, { key: 'totalTons', label: 'Produção do talhão', unit: 't', value: round(netKg * area / 1000), tolerance: 0.15 });
  return {
    id, difficulty,
    title: difficulty === 1 ? 'Componentes de rendimento do milho' : difficulty === 2 ? 'Produtividade e perdas de colheita' : 'Estimativa completa da produção do talhão',
    context: 'Uma equipe avaliou plantas e espigas em pontos representativos da lavoura. Considere que a amostra representa a população final e que a massa de mil grãos está expressa em gramas. A saca comercial considerada neste exercício contém 60 kg.',
    data: [
      { label: 'Plantas por metro', value: sample.plantsPerMeter, unit: 'plantas/m' },
      { label: 'Espaçamento', value: sample.rowSpacing, unit: 'm' },
      { label: 'Espigas por planta', value: sample.earsPerPlant, unit: 'espigas/planta' },
      { label: 'Fileiras por espiga', value: sample.rowsPerEar, unit: 'fileiras' },
      { label: 'Grãos por fileira', value: sample.grainsPerRow, unit: 'grãos' },
      { label: 'PMG', value: sample.pmg, unit: 'g/1.000 grãos' },
      ...(difficulty >= 2 ? [{ label: 'Perdas estimadas', value: lossPercent, unit: '%' }] : []),
      ...(difficulty >= 3 ? [{ label: 'Área do talhão', value: area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1 ? 'Calcule o estande, a produtividade bruta em kg/ha e converta para sacas de 60 kg por hectare.' : difficulty === 2 ? 'Calcule a produtividade bruta, as perdas e a produtividade líquida em sc/ha.' : 'Calcule a produtividade bruta, desconte as perdas e informe kg/ha e a produção líquida do talhão em toneladas.',
    answers: difficulty === 1 ? [
      { key: 'population', label: 'Estande', unit: 'plantas/ha', value: round(sample.plantsPerMeter / sample.rowSpacing * 10000), tolerance: 2 },
      { key: 'grossKg', label: 'Produtividade bruta', unit: 'kg/ha', value: round(sample.grossKg), tolerance: 2 },
      { key: 'grossBags', label: 'Produtividade bruta', unit: 'sc/ha', value: round(grossBags), tolerance: 0.04 },
    ] : answers,
    solution: [
      'Estande = plantas por metro ÷ espaçamento entre linhas × 10.000 = ' + round(sample.plantsPerMeter / sample.rowSpacing * 10000) + ' plantas/ha.',
      'Grãos por espiga = fileiras × grãos por fileira = ' + sample.rowsPerEar + ' × ' + sample.grainsPerRow + ' = ' + sample.rowsPerEar * sample.grainsPerRow + ' grãos.',
      'Produtividade bruta (kg/ha) = estande × espigas/planta × grãos/espiga × PMG ÷ 1.000.000 = ' + round(sample.grossKg) + ' kg/ha.',
      'Produtividade bruta (sc/ha) = ' + round(sample.grossKg) + ' ÷ 60 = ' + round(grossBags) + ' sc/ha.',
      ...(difficulty >= 2 ? ['Perdas = ' + round(grossBags) + ' × ' + lossPercent + '% = ' + round(lossKg / 60) + ' sc/ha.', 'Produtividade líquida = ' + round(grossBags) + ' − ' + round(lossKg / 60) + ' = ' + round(netKg / 60) + ' sc/ha.'] : []),
      ...(difficulty >= 3 ? ['Produção líquida = ' + round(netKg) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(netKg * area / 1000) + ' t.'] : []),
      'A estimativa por componentes pressupõe amostragem representativa e não substitui a pesagem de parcelas nem a aferição das perdas reais.',
    ],
    source: SOURCES,
  };
}
function plotExercise(id: string, difficulty: StudyDifficulty, random: () => number): CornProductivityExercise {
  const grossBags = pick([90, 100, 110, 120, 130, 140, 150, 160, 170, 180], random);
  const grossKg = grossBags * 60;
  const sampleArea = pick([2, 2.5, 3, 4, 5], random);
  const sampleMass = round(grossKg * sampleArea / 10, 1);
  const area = pick([5, 8, 10, 15, 20, 25, 30, 40, 50], random);
  const answers: StudyAnswer[] = [{ key: 'grossKg', label: 'Produtividade estimada', unit: 'kg/ha', value: round(grossKg), tolerance: 2 }];
  if (difficulty >= 2) answers.push({ key: 'grossBags', label: 'Produtividade estimada', unit: 'sc/ha', value: grossBags, tolerance: 0.03 });
  if (difficulty >= 3) answers.push({ key: 'totalTons', label: 'Produção do talhão', unit: 't', value: round(grossKg * area / 1000), tolerance: 0.15 });
  return {
    id, difficulty, title: difficulty === 1 ? 'Extrapolação de parcela amostrada' : difficulty === 2 ? 'Conversão da amostra em sacas' : 'Projeção da produção do talhão',
    context: 'Após a debulha e limpeza de uma amostra de milho, os grãos foram pesados. Considere a massa informada como grãos limpos e a parcela como representativa da área.',
    data: [{ label: 'Área da parcela', value: sampleArea, unit: 'm²' }, { label: 'Massa de grãos', value: sampleMass, unit: 'g' }, ...(difficulty >= 3 ? [{ label: 'Área total', value: area, unit: 'ha' }] : [])],
    prompt: difficulty === 1 ? 'Converta a massa da parcela para produtividade em kg/ha.' : difficulty === 2 ? 'Calcule a produtividade em kg/ha e converta para sacas de 60 kg por hectare.' : 'Calcule kg/ha, sc/ha e a produção total estimada em toneladas.',
    answers,
    solution: [
      'Massa por metro quadrado = ' + sampleMass + ' ÷ ' + sampleArea + ' = ' + round(sampleMass / sampleArea) + ' g/m².',
      'Produtividade = g/m² × 10 = ' + round(sampleMass / sampleArea * 10) + ' kg/ha.',
      ...(difficulty >= 2 ? ['Sacas por hectare = ' + round(grossKg) + ' ÷ 60 = ' + grossBags + ' sc/ha.'] : []),
      ...(difficulty >= 3 ? ['Produção total = ' + round(grossKg) + ' × ' + area + ' ÷ 1.000 = ' + round(grossKg * area / 1000) + ' t.'] : []),
      'A conversão exige que a área e a massa coletada sejam medidas corretamente e que a parcela represente a variabilidade do talhão.',
    ],
    source: SOURCES,
  };
}
function harvestLossExercise(id: string, difficulty: StudyDifficulty, random: () => number): CornProductivityExercise {
  const grossBags = pick([90, 100, 110, 120, 130, 140, 150, 160, 170, 180], random);
  const grossKg = grossBags * 60;
  const sampleArea = pick([2, 2.5, 3, 4, 5], random);
  const lossPercent = pick([2, 3, 4, 5, 6, 7, 8, 9, 10], random);
  const lossKg = grossKg * lossPercent / 100;
  const collectedGrams = round(lossKg * sampleArea / 10, 1);
  const area = pick([5, 8, 10, 15, 20, 25, 30, 40, 50], random);
  const netKg = grossKg - lossKg;
  const answers: StudyAnswer[] = [{ key: 'lossKg', label: 'Perda estimada', unit: 'kg/ha', value: round(lossKg), tolerance: 2 }];
  if (difficulty >= 2) answers.push({ key: 'grossBags', label: 'Produtividade bruta', unit: 'sc/ha', value: grossBags, tolerance: 0.03 }, { key: 'netBags', label: 'Produtividade líquida', unit: 'sc/ha', value: round(netKg / 60), tolerance: 0.04 });
  if (difficulty >= 3) answers.push({ key: 'totalLoss', label: 'Perda total', unit: 't', value: round(lossKg * area / 1000), tolerance: 0.15 }, { key: 'netProduction', label: 'Produção líquida', unit: 't', value: round(netKg * area / 1000), tolerance: 0.15 });
  return {
    id, difficulty, title: difficulty === 1 ? 'Quantificação das perdas de colheita' : difficulty === 2 ? 'Perdas e produtividade líquida' : 'Impacto das perdas no talhão',
    context: 'A equipe recolheu grãos que permaneceram no solo após a passagem da colhedora em uma área delimitada. A produtividade bruta foi estimada antes do desconto das perdas.',
    data: [{ label: 'Área de coleta', value: sampleArea, unit: 'm²' }, { label: 'Massa recolhida', value: collectedGrams, unit: 'g' }, ...(difficulty >= 2 ? [{ label: 'Produtividade bruta', value: grossBags, unit: 'sc/ha' }, { label: 'Perdas', value: lossPercent, unit: '%' }] : []), ...(difficulty >= 3 ? [{ label: 'Área do talhão', value: area, unit: 'ha' }] : [])],
    prompt: difficulty === 1 ? 'Estime as perdas em kg/ha a partir da massa recolhida.' : difficulty === 2 ? 'Calcule as perdas em kg/ha, a produtividade bruta e a produtividade líquida em sc/ha.' : 'Calcule a perda por hectare, a massa total perdida e a produção líquida do talhão em toneladas.',
    answers,
    solution: [
      'Perda por metro quadrado = ' + collectedGrams + ' ÷ ' + sampleArea + ' = ' + round(collectedGrams / sampleArea) + ' g/m².',
      'Perda por hectare = g/m² × 10 = ' + round(lossKg) + ' kg/ha.',
      ...(difficulty >= 2 ? ['Produtividade líquida = ' + grossBags + ' − (' + grossBags + ' × ' + lossPercent + '%) = ' + round(netKg / 60) + ' sc/ha.'] : []),
      ...(difficulty >= 3 ? ['Perda total = ' + round(lossKg) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(lossKg * area / 1000) + ' t.', 'Produção líquida = ' + round(netKg) + ' kg/ha × ' + area + ' ha ÷ 1.000 = ' + round(netKg * area / 1000) + ' t.'] : []),
      'Separe perdas naturais e pré-colheita das perdas atribuíveis à plataforma, trilha e limpeza da colhedora.',
    ],
    source: SOURCES,
  };
}
function fingerprint(exercise: CornProductivityExercise): string { return JSON.stringify({ ...exercise, id: undefined }); }

export function createCornProductivityActivities({ mode, count, random = Math.random }: CornGenerationOptions): CornProductivityExercise[] {
  if (!['basic', 'intermediate', 'advanced', 'balanced'].includes(mode)) throw new RangeError('Selecione um nível de dificuldade válido.');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new RangeError('A quantidade deve ser um número inteiro entre 1 e 100.');
  const difficulties = mode === 'balanced' ? balancedDifficulties(count, random) : Array<StudyDifficulty>(count).fill(mode === 'basic' ? 1 : mode === 'intermediate' ? 2 : 3);
  const result: CornProductivityExercise[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  const maxAttempts = Math.max(300, count * 100);
  while (result.length < count && attempts < maxAttempts) {
    attempts += 1;
    const difficulty = difficulties[result.length];
    const id = 'corn-yield-' + (result.length + 1) + '-' + attempts;
    const kind = Math.floor(random() * 3);
    const exercise = kind === 0 ? componentExercise(id, difficulty, random) : kind === 1 ? plotExercise(id, difficulty, random) : harvestLossExercise(id, difficulty, random);
    const key = fingerprint(exercise);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(exercise);
  }
  if (result.length !== count) throw new Error('Não foi possível gerar atividades distintas. Tente uma quantidade menor.');
  return result;
}
