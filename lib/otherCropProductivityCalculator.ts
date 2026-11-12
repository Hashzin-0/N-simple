export type OtherCropCalculatorId = 'sorghum' | 'wheat' | 'rice' | 'common-bean' | 'sunflower' | 'peanut' | 'sugarcane';

export interface CropCalculatorField {
  key: string; label: string; unit: string; step: number; max: number; hint: string;
}
export interface CropCalculatorDefinition {
  id: OtherCropCalculatorId; name: string; shortName: string; description: string;
  formula: string; yieldUnit: 'kg/ha' | 't/ha'; fields: CropCalculatorField[]; source: string[];
}
export interface OtherCropYieldResult {
  crop: OtherCropCalculatorId; grossYieldPerHa: number; lossPerHa: number;
  netYieldPerHa: number; yieldUnit: 'kg/ha' | 't/ha'; totalProductionTons: number | null;
  formula: string; steps: string[];
}

const SOURCES = {
  sorghum: ['https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1177156/1/Situacao-atual-e-perspectivas-para-o-sorgo-granifero.pdf', 'https://apct.sede.embrapa.br/pab/pt_BR/article/view/13486'],
  wheat: ['https://www.alice.cnptia.embrapa.br/alice/handle/doc/914301', 'https://apct.sede.embrapa.br/pab/pt_BR/article/view/19626'],
  rice: ['https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/941339/1/asp1.pdf'],
  bean: ['https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1023574/1/Nutricao-mineral-do-feijoeiro-2015.pdf'],
  sunflower: ['https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1106985/1/Marchesini.pdf', 'https://www.alice.cnptia.embrapa.br/alice/handle/doc/1028046'],
  peanut: ['https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/578407/1/500perguntasamendoim.pdf', 'https://www.infoteca.cnptia.embrapa.br/bitstream/doc/956886/1/BOLPES93.pdf'],
  sugarcane: ['https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1166988/1/LV-Inovacao-desenvolvimento-2024.pdf', 'https://www.embrapa.br/web/agencia-de-informacao-tecnologica/cultivos/cana-de-acucar/producao'],
};
const field = (key: string, label: string, unit: string, step: number, max: number, hint: string): CropCalculatorField => ({ key, label, unit, step, max, hint });

export const OTHER_CROP_CALCULATORS: Record<OtherCropCalculatorId, CropCalculatorDefinition> = {
  sorghum: {
    id: 'sorghum', name: 'Sorgo granífero', shortName: 'Sorgo',
    description: 'Estimativa por população final, panículas, grãos e massa de mil grãos.',
    formula: 'kg/ha = plantas/ha × panículas/planta × grãos/panícula × MMG (g) ÷ 1.000.000',
    yieldUnit: 'kg/ha', source: SOURCES.sorghum,
    fields: [
      field('populationPerHa', 'População final', 'plantas/ha', 1000, 500000, 'Estande final de plantas por hectare.'),
      field('paniclesPerPlant', 'Panículas por planta', 'panículas/planta', 0.05, 3, 'Média de panículas produtivas por planta.'),
      field('grainsPerPanicle', 'Grãos por panícula', 'grãos', 10, 5000, 'Média de grãos formados em cada panícula.'),
      field('thousandGrainWeight', 'Massa de mil grãos', 'g', 0.1, 100, 'Massa de 1.000 grãos, em gramas.'),
    ],
  },
  wheat: {
    id: 'wheat', name: 'Trigo', shortName: 'Trigo',
    description: 'Estimativa pelos componentes de rendimento da espiga.',
    formula: 'kg/ha = espigas/m² × grãos/espiga × MMG (g) ÷ 100',
    yieldUnit: 'kg/ha', source: SOURCES.wheat,
    fields: [
      field('earsPerM2', 'Espigas por área', 'espigas/m²', 1, 1500, 'Número médio de espigas por metro quadrado.'),
      field('grainsPerEar', 'Grãos por espiga', 'grãos/espiga', 1, 100, 'Número médio de grãos por espiga.'),
      field('thousandGrainWeight', 'Massa de mil grãos', 'g', 0.1, 100, 'Massa de 1.000 grãos, em gramas.'),
    ],
  },
  rice: {
    id: 'rice', name: 'Arroz (grãos)', shortName: 'Arroz',
    description: 'Considera panículas, espiguetas, fertilidade e massa de mil grãos.',
    formula: 'kg/ha = panículas/m² × espiguetas/panícula × fertilidade (%) × MMG (g) ÷ 100',
    yieldUnit: 'kg/ha', source: SOURCES.rice,
    fields: [
      field('paniclesPerM2', 'Panículas por área', 'panículas/m²', 1, 1500, 'Número médio de panículas por metro quadrado.'),
      field('spikeletsPerPanicle', 'Espiguetas por panícula', 'espiguetas', 1, 400, 'Total médio de espiguetas por panícula.'),
      field('fertilityPercent', 'Fertilidade das espiguetas', '%', 0.1, 100, 'Percentual de espiguetas férteis e com grãos formados.'),
      field('thousandGrainWeight', 'Massa de mil grãos', 'g', 0.1, 100, 'Massa de 1.000 grãos, em gramas.'),
    ],
  },
  'common-bean': {
    id: 'common-bean', name: 'Feijão (grãos secos)', shortName: 'Feijão',
    description: 'Estimativa por vagens por área, grãos por vagem e massa de mil sementes.',
    formula: 'kg/ha = vagens/m² × grãos/vagem × M1000 (g) ÷ 100',
    yieldUnit: 'kg/ha', source: SOURCES.bean,
    fields: [
      field('podsPerM2', 'Vagens por área', 'vagens/m²', 1, 1500, 'Número médio de vagens por metro quadrado.'),
      field('grainsPerPod', 'Grãos por vagem', 'grãos/vagem', 0.1, 12, 'Número médio de grãos por vagem.'),
      field('thousandGrainWeight', 'Massa de mil sementes', 'g', 0.1, 1000, 'Massa de 1.000 sementes, em gramas.'),
    ],
  },
  sunflower: {
    id: 'sunflower', name: 'Girassol (aquênios)', shortName: 'Girassol',
    description: 'Estimativa por população, capítulos, aquênios e massa de mil aquênios.',
    formula: 'kg/ha = plantas/ha × capítulos/planta × aquênios/capítulo × MMA (g) ÷ 1.000.000',
    yieldUnit: 'kg/ha', source: SOURCES.sunflower,
    fields: [
      field('populationPerHa', 'População final', 'plantas/ha', 1000, 250000, 'Estande final de plantas por hectare.'),
      field('headsPerPlant', 'Capítulos por planta', 'capítulos/planta', 0.05, 5, 'Média de capítulos produtivos por planta.'),
      field('achenesPerHead', 'Aquênios por capítulo', 'aquênios', 10, 5000, 'Número médio de aquênios formados por capítulo.'),
      field('thousandAcheneWeight', 'Massa de mil aquênios', 'g', 0.1, 300, 'Massa de 1.000 aquênios, em gramas.'),
    ],
  },
  peanut: {
    id: 'peanut', name: 'Amendoim (em casca)', shortName: 'Amendoim',
    description: 'Estimativa da produção em casca por população, vagens e massa de 100 vagens.',
    formula: 'kg/ha = plantas/m² × vagens/planta × massa de 100 vagens (g) ÷ 10',
    yieldUnit: 'kg/ha', source: SOURCES.peanut,
    fields: [
      field('plantsPerM2', 'População final', 'plantas/m²', 0.1, 100, 'Número médio de plantas por metro quadrado.'),
      field('podsPerPlant', 'Vagens por planta', 'vagens/planta', 0.1, 300, 'Número médio de vagens por planta.'),
      field('hundredPodWeight', 'Massa de 100 vagens', 'g', 0.1, 1000, 'Massa de cem vagens com casca, em gramas.'),
    ],
  },
  sugarcane: {
    id: 'sugarcane', name: 'Cana-de-açúcar', shortName: 'Cana',
    description: 'Estimativa biométrica de toneladas de colmos por hectare (TCH).',
    formula: 'TCH (t/ha) = diâmetro² (cm) × colmos/m × altura (cm) × 0,007854 ÷ espaçamento (m)',
    yieldUnit: 't/ha', source: SOURCES.sugarcane,
    fields: [
      field('stalkDiameterCm', 'Diâmetro médio do colmo', 'cm', 0.1, 10, 'Diâmetro médio medido em colmos representativos.'),
      field('stalksPerMeter', 'Colmos por metro', 'colmos/m', 0.1, 40, 'Número médio de colmos industrializáveis por metro linear.'),
      field('stalkHeightCm', 'Altura média do colmo', 'cm', 1, 500, 'Altura média dos colmos considerada na biometria.'),
      field('rowSpacingM', 'Espaçamento entre sulcos', 'm', 0.05, 3, 'Distância entre os centros das linhas de plantio.'),
    ],
  },
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function calculateOtherCropYield(crop: OtherCropCalculatorId, inputs: Record<string, number>, lossPercent: number, areaHa: number): OtherCropYieldResult | null {
  const definition = OTHER_CROP_CALCULATORS[crop];
  if (!definition || !Number.isFinite(lossPercent) || lossPercent < 0 || lossPercent > 100) return null;
  if (!Number.isFinite(areaHa) || areaHa < 0) return null;
  if (!definition.fields.every((item) => Number.isFinite(inputs[item.key]) && inputs[item.key] > 0 && inputs[item.key] <= item.max)) return null;

  let grossYieldPerHa = 0;
  switch (crop) {
    case 'sorghum':
      grossYieldPerHa = inputs.populationPerHa * inputs.paniclesPerPlant * inputs.grainsPerPanicle * inputs.thousandGrainWeight / 1_000_000;
      break;
    case 'wheat':
      grossYieldPerHa = inputs.earsPerM2 * inputs.grainsPerEar * inputs.thousandGrainWeight / 100;
      break;
    case 'rice':
      grossYieldPerHa = inputs.paniclesPerM2 * inputs.spikeletsPerPanicle * (inputs.fertilityPercent / 100) * inputs.thousandGrainWeight / 100;
      break;
    case 'common-bean':
      grossYieldPerHa = inputs.podsPerM2 * inputs.grainsPerPod * inputs.thousandGrainWeight / 100;
      break;
    case 'sunflower':
      grossYieldPerHa = inputs.populationPerHa * inputs.headsPerPlant * inputs.achenesPerHead * inputs.thousandAcheneWeight / 1_000_000;
      break;
    case 'peanut':
      grossYieldPerHa = inputs.plantsPerM2 * inputs.podsPerPlant * inputs.hundredPodWeight / 10;
      break;
    case 'sugarcane':
      grossYieldPerHa = inputs.stalkDiameterCm ** 2 * inputs.stalksPerMeter * inputs.stalkHeightCm * 0.007854 / inputs.rowSpacingM;
      break;
  }
  if (!Number.isFinite(grossYieldPerHa) || grossYieldPerHa <= 0) return null;

  const lossPerHa = grossYieldPerHa * lossPercent / 100;
  const netYieldPerHa = grossYieldPerHa - lossPerHa;
  const netTonsPerHa = definition.yieldUnit === 't/ha' ? netYieldPerHa : netYieldPerHa / 1000;
  const totalProductionTons = areaHa > 0 ? round(netTonsPerHa * areaHa) : null;
  const steps = [
    definition.formula,
    'Produtividade bruta = ' + round(grossYieldPerHa) + ' ' + definition.yieldUnit + '.',
    'Perda = ' + round(lossPercent, 2) + '% × produtividade bruta = ' + round(lossPerHa) + ' ' + definition.yieldUnit + '.',
    'Produtividade líquida = ' + round(grossYieldPerHa) + ' − ' + round(lossPerHa) + ' = ' + round(netYieldPerHa) + ' ' + definition.yieldUnit + '.',
    ...(totalProductionTons === null ? [] : ['Produção líquida do talhão = ' + round(netTonsPerHa) + ' t/ha × ' + round(areaHa, 2) + ' ha = ' + totalProductionTons + ' t.']),
  ];
  return { crop, grossYieldPerHa: round(grossYieldPerHa), lossPerHa: round(lossPerHa), netYieldPerHa: round(netYieldPerHa), yieldUnit: definition.yieldUnit, totalProductionTons, formula: definition.formula, steps };
}
