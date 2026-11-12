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


const SOY_PHENOLOGY_SOURCE = 'https://www.embrapa.br/web/agencia-de-informacao-tecnologica/cultivos/soja/pre-producao/caracteristicas-da-especie-e-relacoes-com-o-ambiente/estadios-de-desenvolvimento';
const SOY_SEEDING_SOURCE = 'https://www.embrapa.br/en/web/agencia-de-informacao-tecnologica/cultivos/soja/pre-producao/instalacao-da-lavoura/aspectos-a-serem-considerados';
const SOY_FBN_SOURCE = 'https://www.embrapa.br/en/web/agencia-de-informacao-tecnologica/cultivos/soja/producao/inoculacao-e-inoculante';
const SOY_PEST_SOURCE = 'https://www.embrapa.br/web/agencia-de-informacao-tecnologica/cultivos/soja/producao/manejo-integrado-de-pragas';
const SOY_WEED_SOURCE = 'https://www.embrapa.br/en/web/agencia-de-informacao-tecnologica/cultivos/soja/producao/manejo-de-plantas-daninhas/manejo-de-plantas-daninhas-na-soja';
const SOY_RUST_SOURCE = 'https://www.embrapa.br/web/soja/ferrugem';
const SOY_ROTATION_SOURCE = 'https://www.embrapa.br/web/agencia-de-informacao-tecnologica/cultivos/soja/producao/manejo-do-solo/rotacao-de-culturas';
const SOY_HARVEST_SOURCE = 'https://www.embrapa.br/web/agencia-de-informacao-tecnologica/cultivos/soja/producao/colheita/fatores-que-afetam-a-colheita';
const SOY_WATER_SOURCE = 'https://www.infoteca.cnptia.embrapa.br/bitstream/doc/468943/1/SistemasdeProducao9.pdf';
const SOY_NUTRIENT_SOURCE = 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1160226/1/Doc-458-OL-versao-5.pdf';
const SOY_MIP_RESULTS_SOURCE = 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1157428/1/DOC-455-final.pdf';
const SOY_500_QUESTIONS_SOURCE = 'https://www.infoteca.cnptia.embrapa.br/bitstream/doc/1118408/2/500PERGUNTASSojaed012019.pdf';

function soybeanPopulationExercise(
  id: string,
  difficulty: StudyDifficulty,
  values: { targetPopulation: number; rowSpacing: number; germination: number; fieldEmergence: number },
): StudyExercise {
  const plantsPerMeter = values.targetPopulation * values.rowSpacing / 10000;
  const seedPerMeter = plantsPerMeter / (values.germination / 100) / (values.fieldEmergence / 100);
  const seedsPerHa = values.targetPopulation / (values.germination / 100) / (values.fieldEmergence / 100);
  const answers: StudyAnswer[] = [
    { key: 'plantsPerMeter', label: 'Plantas desejadas por metro', unit: 'plantas/m', value: round(plantsPerMeter), tolerance: 0.05 },
  ];
  if (difficulty >= 2) answers.push({ key: 'seedPerMeter', label: 'Sementes a distribuir por metro', unit: 'sementes/m', value: round(seedPerMeter), tolerance: 0.08 });
  if (difficulty >= 3) answers.push({ key: 'seedsPerHa', label: 'Sementes necessárias por hectare', unit: 'sementes/ha', value: round(seedsPerHa), tolerance: Math.max(100, round(seedsPerHa * 0.002)) });
  return {
    id, topic: 'soja', difficulty,
    title: difficulty === 1 ? 'População na linha de semeadura' : difficulty === 2 ? 'Regulagem de sementes por metro' : 'Dimensionamento do estande e sementes',
    context: 'A recomendação de população depende da cultivar, época, ambiente e orientação regional. Neste exercício, a população-alvo e os índices de estabelecimento já foram definidos para o talhão.',
    data: [
      { label: 'População final desejada', value: values.targetPopulation.toLocaleString('pt-BR'), unit: 'plantas/ha' },
      { label: 'Espaçamento entre linhas', value: values.rowSpacing * 100, unit: 'cm' },
      ...(difficulty >= 2 ? [
        { label: 'Germinação do lote', value: values.germination, unit: '%' },
        { label: 'Emergência em campo estimada', value: values.fieldEmergence, unit: '%' },
      ] : []),
    ],
    prompt: difficulty === 1
      ? 'Quantas plantas devem permanecer, em média, por metro linear de fileira?'
      : difficulty === 2
        ? 'Calcule plantas desejadas por metro e quantas sementes devem ser distribuídas por metro, considerando germinação e emergência em campo.'
        : 'Calcule plantas por metro, sementes por metro e sementes necessárias por hectare.',
    answers,
    solution: [
      'Plantas por metro = população-alvo × espaçamento (m) ÷ 10.000 = ' + values.targetPopulation + ' × ' + values.rowSpacing + ' ÷ 10.000 = ' + round(plantsPerMeter) + '.',
      ...(difficulty >= 2 ? ['Sementes por metro = plantas desejadas ÷ (germinação × emergência em campo) = ' + round(plantsPerMeter) + ' ÷ (' + values.germination / 100 + ' × ' + values.fieldEmergence / 100 + ') = ' + round(seedPerMeter) + '.'] : []),
      ...(difficulty >= 3 ? ['Sementes/ha = população-alvo ÷ (' + values.germination / 100 + ' × ' + values.fieldEmergence / 100 + ') = ' + Math.round(seedsPerHa).toLocaleString('pt-BR') + '.'] : []),
      'Os percentuais foram tratados como frações multiplicativas. Na prática, use dados de germinação, vigor, qualidade do lote e emergência observada no próprio sistema.',
    ],
    source: [SOY_SEEDING_SOURCE, SOY_500_QUESTIONS_SOURCE],
  };
}

function soybeanSeedRateExercise(
  id: string,
  difficulty: StudyDifficulty,
  values: { targetPopulation: number; germination: number; fieldEmergence: number; pmg: number; area: number },
): StudyExercise {
  const seedsPerHa = values.targetPopulation / (values.germination / 100) / (values.fieldEmergence / 100);
  const kgPerHa = seedsPerHa * values.pmg / 1_000_000;
  const totalKg = kgPerHa * values.area;
  const answers: StudyAnswer[] = [
    { key: 'seedsPerHa', label: 'Sementes necessárias', unit: 'sementes/ha', value: Math.round(seedsPerHa), tolerance: Math.max(100, round(seedsPerHa * 0.002)) },
  ];
  if (difficulty >= 2) answers.push({ key: 'kgPerHa', label: 'Taxa de semeadura', unit: 'kg/ha', value: round(kgPerHa), tolerance: 0.08 });
  if (difficulty >= 3) answers.push({ key: 'totalKg', label: 'Quantidade para o talhão', unit: 'kg', value: round(totalKg), tolerance: 0.2 });
  return {
    id, topic: 'soja', difficulty,
    title: difficulty === 1 ? 'Correção pelo poder germinativo' : difficulty === 2 ? 'Cálculo da taxa de semeadura' : 'Planejamento de sementes por talhão',
    context: 'A população informada é o estande final desejado. Germinação e emergência em campo são índices separados; não confunda porcentagem de germinação do laboratório com estabelecimento real no talhão.',
    data: [
      { label: 'Estande desejado', value: values.targetPopulation.toLocaleString('pt-BR'), unit: 'plantas/ha' },
      { label: 'Germinação', value: values.germination, unit: '%' },
      { label: 'Emergência em campo', value: values.fieldEmergence, unit: '%' },
      ...(difficulty >= 2 ? [{ label: 'PMG', value: values.pmg, unit: 'g/1.000 sementes' }] : []),
      ...(difficulty >= 3 ? [{ label: 'Área do talhão', value: values.area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Quantas sementes devem ser semeadas por hectare para compensar os índices de germinação e emergência?'
      : difficulty === 2
        ? 'Calcule o número de sementes por hectare e converta em kg/ha usando o PMG informado.'
        : 'Calcule sementes/ha, kg/ha e a quantidade total de sementes necessária para o talhão.',
    answers,
    solution: [
      'Fator de estabelecimento = (' + values.germination + ' ÷ 100) × (' + values.fieldEmergence + ' ÷ 100) = ' + round(values.germination / 100 * values.fieldEmergence / 100, 4) + '.',
      'Sementes/ha = ' + values.targetPopulation + ' ÷ fator de estabelecimento = ' + Math.round(seedsPerHa).toLocaleString('pt-BR') + '.',
      ...(difficulty >= 2 ? ['kg/ha = sementes/ha × PMG (g) ÷ 1.000.000 = ' + round(kgPerHa) + ' kg/ha.'] : []),
      ...(difficulty >= 3 ? ['Total = ' + round(kgPerHa) + ' kg/ha × ' + values.area + ' ha = ' + round(totalKg) + ' kg.'] : []),
      'É um cálculo didático. A taxa real deve considerar também pureza física, vigor, danos mecânicos, tratamento, condições de solo e regulagem da semeadora.',
    ],
    source: [SOY_SEEDING_SOURCE, SOY_500_QUESTIONS_SOURCE],
  };
}

function soybeanHarvestLossExercise(
  id: string,
  difficulty: StudyDifficulty,
  values: { sampleArea: number; collectedGrams: number; area: number },
): StudyExercise {
  const kgPerHa = values.collectedGrams / values.sampleArea * 10;
  const bagsPerHa = kgPerHa / 60;
  const totalKg = kgPerHa * values.area;
  const answers: StudyAnswer[] = [
    { key: 'kgPerHa', label: 'Perda estimada', unit: 'kg/ha', value: round(kgPerHa), tolerance: 0.2 },
  ];
  if (difficulty >= 2) answers.push({ key: 'bagsPerHa', label: 'Perda em sacas', unit: 'sc/ha', value: round(bagsPerHa), tolerance: 0.02 });
  if (difficulty >= 3) answers.push({ key: 'totalKg', label: 'Perda total no talhão', unit: 'kg', value: round(totalKg), tolerance: 2 });
  return {
    id, topic: 'soja', difficulty,
    title: difficulty === 1 ? 'Amostragem de perdas na colheita' : difficulty === 2 ? 'Perdas em kg e sacas por hectare' : 'Impacto das perdas na área colhida',
    context: 'Após a passagem da colhedora, foram recolhidos grãos soltos e vagens não colhidas em uma área delimitada. Para este exercício, considere que toda a massa coletada representa perda atribuível à operação.',
    data: [
      { label: 'Área amostrada', value: values.sampleArea, unit: 'm²' },
      { label: 'Massa recolhida', value: values.collectedGrams, unit: 'g' },
      ...(difficulty >= 3 ? [{ label: 'Área colhida', value: values.area, unit: 'ha' }] : []),
    ],
    prompt: difficulty === 1
      ? 'Estime a perda em kg/ha.'
      : difficulty === 2
        ? 'Converta a perda amostrada em kg/ha e em sacas de 60 kg por hectare.'
        : 'Calcule kg/ha, sc/ha e a massa total perdida em todo o talhão.',
    answers,
    solution: [
      'Massa por m² = ' + values.collectedGrams + ' g ÷ ' + values.sampleArea + ' m² = ' + round(values.collectedGrams / values.sampleArea) + ' g/m².',
      'Conversão: 1 g/m² equivale a 10 kg/ha. Perda = ' + round(kgPerHa) + ' kg/ha.',
      ...(difficulty >= 2 ? ['Perda em sacas = ' + round(kgPerHa) + ' ÷ 60 = ' + round(bagsPerHa) + ' sc/ha.'] : []),
      ...(difficulty >= 3 ? ['Perda total = ' + round(kgPerHa) + ' kg/ha × ' + values.area + ' ha = ' + round(totalKg) + ' kg.'] : []),
      'A amostragem deve ser repetida em pontos representativos e padronizada. Separe perdas naturais, perdas de pré-colheita e perdas da plataforma/trilha quando o objetivo for diagnosticar a máquina.',
    ],
    source: [SOY_HARVEST_SOURCE, SOY_500_QUESTIONS_SOURCE],
  };
}

function soybeanConceptExercises(): StudyExercise[] {
  const items: StudyExercise[] = [
    conceptExercise('soja-fenologia-ve', 'soja', 1, 'Identificação do estádio VE',
      'Após a semeadura, os cotilédones acabam de aparecer acima da superfície do solo.',
      'Qual estádio fenológico representa essa situação?',
      [['ve', 'emergencia']], 'VE é o estádio de emergência, caracterizado pela presença dos cotilédones acima da superfície do solo.',
      ['VE — emergência', 'VC — cotilédone aberto', 'V1 — primeiro nó', 'R1 — início do florescimento']),
    conceptExercise('soja-fenologia-v1', 'soja', 1, 'Reconhecimento do estádio V1',
      'A primeira folha unifoliolada está completamente desenvolvida.',
      'Qual é a interpretação correta do estádio V1?',
      [['v1', 'primeiro no', 'unifoliolada']], 'V1 corresponde ao primeiro nó foliar com as folhas unifolioladas completamente desenvolvidas.',
      ['V1 — primeiro nó, folhas unifolioladas desenvolvidas', 'V2 — primeira trifoliolada desenvolvida', 'R1 — primeira flor aberta']),
    conceptExercise('soja-fenologia-r1', 'soja', 1, 'Início do florescimento',
      'Foi observada pelo menos uma flor aberta em qualquer nó da haste principal.',
      'Qual estádio reprodutivo descreve esse início do florescimento?',
      [['r1', 'inicio do florescimento', 'uma flor aberta']], 'R1 marca o início do florescimento, com pelo menos uma flor aberta em qualquer nó da haste principal.',
      ['R1 — início do florescimento', 'R3 — início da formação de vagens', 'R5 — início do enchimento de grãos']),
    conceptExercise('soja-fenologia-r3', 'soja', 1, 'Início da formação de vagens',
      'Uma vagem de aproximadamente 5 mm é observada em um dos nós superiores considerados na escala.',
      'Qual estádio representa o início da formação da vagem?',
      [['r3', 'inicio da formacao da vagem', 'vagem de 5 mm']], 'R3 representa o início da formação da vagem, com vagem de cerca de 5 mm nos nós definidos pela escala.',
      ['R2 — florescimento pleno', 'R3 — início da formação da vagem', 'R4 — vagem completamente desenvolvida']),
    conceptExercise('soja-fenologia-r5', 'soja', 2, 'Início do enchimento dos grãos',
      'Em uma vagem dos nós superiores, há grão perceptível com cerca de 3 mm.',
      'Qual estádio reprodutivo está sendo identificado?',
      [['r5', 'inicio do enchimento', 'grao de 3 mm']], 'R5 é o início do enchimento de grãos. É uma fase importante para a formação do rendimento.',
      ['R4 — vagem completamente desenvolvida', 'R5 — início do enchimento do grão', 'R7 — início da maturação']),
    conceptExercise('soja-fenologia-r6', 'soja', 2, 'Grão cheio',
      'As vagens apresentam grãos verdes que preenchem as cavidades.',
      'Qual estádio descreve o grão cheio ou completo?',
      [['r6', 'grao cheio', 'cavidades preenchidas']], 'R6 representa o estádio de grão cheio ou completo.',
      ['R5 — início do enchimento', 'R6 — grão cheio', 'R8 — maturação plena']),
    conceptExercise('soja-fenologia-r8', 'soja', 2, 'Maturação plena',
      'Aproximadamente 95% das vagens da planta apresentam coloração de maduras.',
      'Qual estádio representa a maturação plena?',
      [['r8', '95%', 'noventa e cinco']], 'R8 corresponde à maturação plena, definida na escala por cerca de 95% das vagens com coloração de madura.',
      ['R6 — grão cheio', 'R7 — início da maturação', 'R8 — maturação plena']),
    conceptExercise('soja-semeadura-profundidade', 'soja', 1, 'Profundidade de semeadura',
      'A equipe está regulando a semeadora e precisa evitar emergência irregular.',
      'Qual faixa de profundidade é indicada como referência geral pela Embrapa para a semeadura da soja?',
      [['3 a 5 cm', '3-5 cm']], 'A referência técnica consultada indica, em geral, 3 a 5 cm. A profundidade deve ser ajustada à textura, umidade e condição física do solo.',
      ['3 a 5 cm', '1 a 2 cm', '8 a 10 cm']),
    conceptExercise('soja-semente-agua', 'soja', 2, 'Água para germinação',
      'O lote foi semeado em solo seco e a emergência ficou desuniforme.',
      'Explique por que a disponibilidade de água no início do ciclo é essencial para a germinação e emergência.',
      [['embebicao', 'absorver agua', 'absorção de agua'], ['germinacao', 'ativar metabolismo', 'metabolismo'], ['emergencia uniforme', 'estande uniforme', 'emergencia']], 'A semente precisa absorver água para iniciar a embebição e os processos metabólicos da germinação. Déficit ou excesso de água pode comprometer a emergência e a uniformidade do estande.',
      undefined),
    conceptExercise('soja-espacamento', 'soja', 2, 'Espaçamento entre fileiras',
      'Duas áreas usam espaçamentos distintos, mas mantêm a mesma população final por hectare.',
      'O espaçamento entre linhas deve ser definido isoladamente, sem considerar cultivar, época e arquitetura das plantas?',
      [['nao']], 'Não. A escolha do espaçamento deve considerar cultivar, arquitetura, época de semeadura, população, ambiente e operações de manejo. Não existe um único arranjo universal.',
      ['Não. Deve considerar cultivar, ambiente, época e sistema de produção.', 'Sim. O espaçamento é igual para todas as cultivares e regiões.']),
    conceptExercise('soja-estande-falhas', 'soja', 2, 'Falhas no estande',
      'A contagem após a emergência revela trechos sem plantas e grande variação entre linhas.',
      'Cite dois efeitos agronômicos possíveis de uma emergência desuniforme ou de falhas no estande.',
      [['competicao', 'distribuicao espacial', 'plantas vizinhas'], ['fechamento entrelinhas', 'fechamento das entrelinhas', 'luz'], ['produtividade', 'rendimento', 'maturacao desuniforme']], 'Falhas e desuniformidade alteram a distribuição espacial, a competição entre plantas, o fechamento das entrelinhas e podem aumentar a variabilidade de maturação e rendimento.',
      undefined),
    conceptExercise('soja-fbn', 'soja', 1, 'Fixação biológica de nitrogênio',
      'As raízes apresentam nódulos formados pela associação entre a planta e bactérias compatíveis.',
      'Qual é a função da simbiose entre Bradyrhizobium e a soja?',
      [['nitrogenio', 'nitrogenio atmosferico', 'n2', 'fixacao biologica']], 'As bactérias estabelecem simbiose nos nódulos radiculares e convertem o N₂ atmosférico em formas assimiláveis pela planta, contribuindo para suprir a demanda de nitrogênio.',
      ['Fixar nitrogênio atmosférico nos nódulos radiculares', 'Produzir fósforo para a planta', 'Substituir a necessidade de água']),
    conceptExercise('soja-inoculacao', 'soja', 2, 'Por que reinocular a soja?',
      'A área já recebeu soja em safras anteriores e o produtor questiona a inoculação anual.',
      'Explique por que a Embrapa recomenda atenção à inoculação mesmo em áreas já cultivadas com soja.',
      [['reinoculacao', 'inoculacao anual', 'inocular anualmente'], ['estirpes eficientes', 'bacterias eficientes', 'bradyrhizobium'], ['nodulacao', 'fixacao biologica', 'nitrogenio']], 'A reinoculação pode reintroduzir estirpes eficientes, favorecer a nodulação e a fixação biológica de nitrogênio. Deve-se seguir a recomendação técnica e as instruções do inoculante.',
      undefined),
    conceptExercise('soja-nodulos', 'soja', 2, 'Avaliação de nódulos',
      'Na avaliação de raízes, o técnico encontra nódulos em diferentes tamanhos e cores.',
      'Além de contar nódulos, que aspecto deve ser observado para avaliar a atividade de fixação biológica?',
      [['cor interna', 'interior rosado', 'rosa', 'avermelhado'], ['distribuicao', 'localizacao', 'raiz principal', 'raizes laterais'], ['tamanho', 'quantidade', 'nodulos']], 'A avaliação deve considerar quantidade, distribuição, tamanho e atividade dos nódulos. A coloração interna rosada ou avermelhada pode indicar presença de leghemoglobina e atividade, mas deve ser interpretada junto ao desenvolvimento da planta e às condições de campo.',
      undefined),
    conceptExercise('soja-fbn-compatibilidade', 'soja', 3, 'Compatibilidade de inoculante e tratamento de sementes',
      'O tratamento químico das sementes será realizado junto com a inoculação.',
      'Por que é necessário verificar a compatibilidade entre inoculante, tratamento de sementes e modo de aplicação?',
      [['viabilidade', 'sobrevivencia das bacterias', 'sobrevivencia bacteriana'], ['compatibilidade', 'produto', 'formulacao'], ['orientacao fabricante', 'instrucoes do fabricante', 'sulco']], 'Alguns produtos e condições de armazenamento podem reduzir a sobrevivência das bactérias. É necessário seguir as instruções do fabricante, respeitar compatibilidades, sequência e intervalo entre operações ou optar por aplicação no sulco quando recomendada.',
      undefined),
    conceptExercise('soja-nutrientes-pk', 'soja', 2, 'Fósforo e potássio',
      'O planejamento da adubação considera análise de solo, exportação pelos grãos e histórico de fertilidade.',
      'Por que fósforo e potássio merecem atenção no manejo nutricional da soja?',
      [['analise de solo', 'disponibilidade no solo'], ['exportacao', 'exportados pelos graos', 'balanco de nutrientes'], ['dose', 'fonte', 'epoca', 'forma de aplicacao']], 'Fósforo e potássio têm grande importância na fertilidade e parte relevante é exportada pelos grãos. A recomendação deve considerar análise de solo, fonte, dose, forma e época de aplicação.',
      undefined),
    conceptExercise('soja-nitrogenio-fbn', 'soja', 2, 'Nitrogênio mineral e FBN',
      'Um planejamento de adubação considera aplicar nitrogênio mineral em área inoculada.',
      'Por que a decisão sobre fertilizante nitrogenado na soja deve considerar a eficiência da FBN e a recomendação técnica?',
      [['fixacao biologica', 'nodulacao', 'bradyrhizobium'], ['inoculante', 'inoculacao'], ['recomendacao tecnica', 'pesquisa', 'custo', 'eficiencia']], 'A FBN pode suprir grande parte da demanda de nitrogênio quando a inoculação e a nodulação são eficientes. A decisão não deve ser baseada em aplicação automática; deve seguir pesquisa e recomendação técnica para o sistema.',
      undefined),
    conceptExercise('soja-agua-fases', 'soja', 2, 'Fases críticas para água',
      'O talhão enfrenta período de estiagem durante o ciclo.',
      'Em quais fases do ciclo a disponibilidade hídrica é especialmente importante para a soja?',
      [['germinacao', 'emergencia'], ['florescimento', 'enchimento de graos', 'formacao de vagens'], ['deficit hidrico', 'abortamento', 'queda de flores', 'reducao rendimento']], 'A água é importante na germinação-emergência e no período reprodutivo, especialmente floração e enchimento de grãos. Déficits podem causar abortamento de flores e vagens e reduzir o rendimento.',
      undefined),
    conceptExercise('soja-deficit-hidrico', 'soja', 3, 'Diagnóstico de déficit hídrico',
      'Durante o florescimento e enchimento de grãos, as plantas apresentam enrolamento foliar e abortamento de estruturas reprodutivas.',
      'Relacione os sintomas observados com os efeitos do déficit hídrico sobre o rendimento.',
      [['fechamento estomatico', 'estomatos'], ['queda de flores', 'abortamento de vagens', 'abortamento'], ['enchimento de graos', 'reducao rendimento', 'menor produtividade']], 'O déficit hídrico induz respostas fisiológicas como fechamento estomático e enrolamento foliar, podendo provocar queda de flores, abortamento de vagens e redução do enchimento e rendimento.',
      undefined),
    conceptExercise('soja-plantas-daninhas', 'soja', 1, 'Competição com plantas daninhas',
      'Uma área apresenta infestação de plantas daninhas desde o início do desenvolvimento da soja.',
      'Quais recursos as plantas daninhas disputam com a cultura e como essa competição pode afetar a produção?',
      [['agua', 'luz', 'nutrientes'], ['competicao', 'competem'], ['rendimento', 'produtividade', 'qualidade']], 'Plantas daninhas competem por água, luz e nutrientes, podendo reduzir o crescimento, o rendimento e a qualidade, além de dificultar operações e colheita.',
      undefined),
    conceptExercise('soja-manejo-herbicidas', 'soja', 3, 'Prevenção da resistência de plantas daninhas',
      'Uma propriedade utiliza repetidamente herbicidas com o mesmo mecanismo de ação.',
      'Cite medidas de manejo para reduzir a seleção e disseminação de plantas daninhas resistentes.',
      [['rotacao de mecanismos', 'mecanismos de acao', 'rotacao de herbicidas'], ['rotacao de culturas', 'cobertura do solo'], ['limpeza de maquinas', 'sementes limpas', 'evitar disseminacao']], 'O manejo integrado combina rotação de culturas e de mecanismos de ação, controle antes da produção de sementes, sementes limpas, monitoramento da flora e limpeza de máquinas e implementos.',
      undefined),
    conceptExercise('soja-mip-pano', 'soja', 1, 'Pano-de-batida',
      'O técnico precisa monitorar lagartas e percevejos em vários pontos do talhão.',
      'Qual é a finalidade do pano-de-batida no manejo integrado de pragas da soja?',
      [['monitorar', 'amostrar', 'contar insetos'], ['lagartas', 'percevejos', 'inimigos naturais'], ['nivel de acao', 'decisao de controle']], 'O pano-de-batida é um método de amostragem para quantificar insetos e apoiar a decisão de controle com base no nível de ação, no estádio da cultura e na presença de inimigos naturais.',
      ['Contar insetos e apoiar decisões pelo nível de ação', 'Aplicar inseticida preventivamente', 'Medir a umidade do solo']),
    conceptExercise('soja-mip-preventivo', 'soja', 2, 'Aplicação preventiva de inseticidas',
      'Um consultor encontra poucos insetos e vários inimigos naturais no talhão.',
      'Por que o MIP não recomenda aplicações automáticas de inseticidas sem monitoramento e avaliação do nível de ação?',
      [['nivel de acao', 'nivel economico'], ['inimigos naturais', 'predadores', 'parasitoides'], ['custo', 'resistencia', 'impacto ambiental']], 'O MIP considera densidade de pragas, estádio da cultura, danos, nível de ação e inimigos naturais. Aplicações desnecessárias elevam custos, podem eliminar organismos benéficos e acelerar a seleção de resistência.',
      undefined),
    conceptExercise('soja-mip-desfolha', 'soja', 3, 'Interpretação de desfolha',
      'Em um levantamento didático, a desfolha estimada é de 18% no estádio vegetativo e 18% no reprodutivo.',
      'Por que não se deve interpretar a mesma porcentagem de desfolha sem considerar o estádio fenológico?',
      [['estadio fenologico', 'fase da cultura', 'vegetativo', 'reprodutivo'], ['tolerancia', 'nivel de acao', 'limiar'], ['monitoramento', 'decisao de controle']], 'A tolerância à desfolha e os níveis de ação mudam conforme a fase da cultura. Valores de referência devem ser os adotados pela recomendação técnica regional e atual, e a decisão deve integrar monitoramento e identificação da praga.',
      undefined),
    conceptExercise('soja-percevejo', 'soja', 2, 'Percevejos e qualidade dos grãos',
      'Há presença de percevejos sugadores durante o desenvolvimento das vagens e dos grãos.',
      'Por que o monitoramento de percevejos é importante na fase reprodutiva?',
      [['vagens', 'graos', 'sementes'], ['dano direto', 'sugam', 'chochamento'], ['qualidade', 'germinacao', 'vigor', 'rendimento']], 'Percevejos podem danificar vagens e grãos, afetando rendimento, qualidade e vigor de sementes. A tomada de decisão deve considerar amostragem e nível de ação.',
      undefined),
    conceptExercise('soja-ferrugem', 'soja', 2, 'Ferrugem-asiática',
      'O planejamento fitossanitário considera a ferrugem-asiática e a presença de plantas voluntárias na entressafra.',
      'Quais medidas fazem parte do manejo integrado da ferrugem-asiática da soja?',
      [['vazio sanitario', 'eliminar plantas voluntarias', 'plantas guaxas'], ['calendarizacao', 'epoca de semeadura', 'semeadura'], ['cultivar resistente', 'cultivar precoce', 'monitoramento', 'fungicida']], 'O manejo combina vazio sanitário e eliminação de plantas voluntárias, calendário de semeadura, cultivares adaptadas/precoces e com resistência quando disponíveis, monitoramento e uso criterioso de fungicidas conforme orientação técnica.',
      undefined),
    conceptExercise('soja-vazio-sanitario', 'soja', 2, 'Objetivo do vazio sanitário',
      'No período de entressafra, plantas voluntárias de soja permanecem vivas na área.',
      'Qual é o objetivo fitossanitário do vazio sanitário para a ferrugem-asiática?',
      [['reduzir inoculo', 'reduzir a quantidade do fungo', 'sobrevivencia do fungo'], ['plantas voluntarias', 'plantas guaxas', 'eliminar'], ['atrasar epidemia', 'safra seguinte', 'ferrugem']], 'O vazio sanitário busca reduzir a presença de hospedeiros vivos e o inóculo do fungo na entressafra, atrasando a ocorrência da doença na safra seguinte. Os períodos e calendários são definidos por normas oficiais vigentes.',
      undefined),
    conceptExercise('soja-rotacao', 'soja', 2, 'Rotação de culturas',
      'Uma propriedade mantém soja continuamente na mesma área por várias safras.',
      'Explique dois benefícios agronômicos da rotação de culturas para o sistema de produção de soja.',
      [['diversidade', 'alternancia de especies', 'diferentes familias'], ['pragas', 'doencas', 'plantas daninhas'], ['materia organica', 'estrutura do solo', 'fertilidade', 'erosao']], 'A rotação diversifica espécies e sistemas radiculares, ajuda a quebrar ciclos de pragas, doenças e plantas daninhas, contribui para estrutura e cobertura do solo e pode melhorar a ciclagem de nutrientes.',
      undefined),
    conceptExercise('soja-cobertura', 'soja', 2, 'Plantas de cobertura',
      'Após a colheita, o solo fica exposto à chuva e à radiação solar.',
      'Como plantas de cobertura podem beneficiar o solo e a cultura de soja subsequente?',
      [['cobertura do solo', 'palhada', 'biomassa'], ['infiltracao', 'erosao', 'evaporacao'], ['materia organica', 'ciclagem de nutrientes', 'plantas daninhas']], 'Coberturas protegem a superfície, reduzem erosão e evaporação, favorecem infiltração, adicionam biomassa e podem reciclar nutrientes e suprimir plantas daninhas.',
      undefined),
    conceptExercise('soja-colheita-ponto', 'soja', 1, 'Ponto de colheita',
      'A lavoura apresenta vagens maduras e grãos próximos da umidade adequada para operação.',
      'Por que a colheita deve ser realizada com regulagem e umidade adequadas, evitando atrasos excessivos?',
      [['perdas', 'deiscencia', 'acamamento'], ['dano mecanico', 'quebra de graos', 'trilha'], ['umidade', 'qualidade', 'armazenamento']], 'A operação deve equilibrar umidade, perdas na plataforma e trilha, danos mecânicos e condições do talhão. Atrasos e regulagem inadequada aumentam perdas e deterioração da qualidade.',
      undefined),
    conceptExercise('soja-colheita-regulagem', 'soja', 3, 'Diagnóstico de perdas na colhedora',
      'A amostragem após a colhedora mostra muitas vagens presas e grãos no solo.',
      'Quais pontos da máquina e da operação devem ser inspecionados para reduzir as perdas?',
      [['barra de corte', 'plataforma', 'altura de corte'], ['velocidade', 'deslocamento'], ['cilindro', 'rotor', 'trilha', 'ventilador', 'peneiras', 'regulagem']], 'Inspecione plataforma e barra de corte, altura de corte, velocidade de deslocamento, regulagem de trilha, ventilação e peneiras. A regulagem deve ser ajustada às condições da lavoura e acompanhada por amostragens de perdas.',
      undefined),
    conceptExercise('soja-rr-bt', 'soja', 2, 'Tecnologias RR e Bt',
      'O produtor confunde tolerância a herbicida com resistência a doenças.',
      'A tecnologia RR ou Bt torna automaticamente a cultivar resistente a doenças da soja?',
      [['nao']], 'Não. RR está relacionada à tolerância a determinados herbicidas; Bt confere proteção contra determinados insetos-alvo. Resistência a doenças é característica específica da cultivar e deve ser consultada no catálogo do obtentor.',
      ['Não. RR e Bt não significam resistência automática a doenças.', 'Sim. Toda cultivar RR é resistente à ferrugem.', 'Sim. Bt protege contra todas as doenças e pragas.']),
    conceptExercise('soja-compactacao', 'soja', 3, 'Compactação e desenvolvimento radicular',
      'O talhão apresenta camada compactada, raízes superficiais e dificuldade de infiltração.',
      'Explique como a compactação pode limitar o desenvolvimento da soja e quais avaliações devem anteceder uma intervenção.',
      [['resistencia mecanica', 'impedimento radicular', 'raizes superficiais'], ['infiltracao', 'agua', 'aeracao'], ['perfil do solo', 'trincheira', 'penetracao', 'diagnostico']], 'A compactação pode aumentar a resistência mecânica, restringir raízes e reduzir infiltração e aeração. Antes de intervir, avalie o perfil, umidade, distribuição da camada e histórico; a operação deve ser baseada em diagnóstico.',
      undefined),
  ];
  const sourceById: Record<string, string[]> = {
    'soja-fenologia-ve': [SOY_PHENOLOGY_SOURCE],
    'soja-fenologia-v1': [SOY_PHENOLOGY_SOURCE],
    'soja-fenologia-r1': [SOY_PHENOLOGY_SOURCE],
    'soja-fenologia-r3': [SOY_PHENOLOGY_SOURCE],
    'soja-fenologia-r5': [SOY_PHENOLOGY_SOURCE],
    'soja-fenologia-r6': [SOY_PHENOLOGY_SOURCE],
    'soja-fenologia-r8': [SOY_PHENOLOGY_SOURCE],
    'soja-semeadura-profundidade': [SOY_SEEDING_SOURCE],
    'soja-semente-agua': [SOY_WATER_SOURCE],
    'soja-espacamento': [SOY_SEEDING_SOURCE],
    'soja-estande-falhas': [SOY_SEEDING_SOURCE],
    'soja-fbn': [SOY_FBN_SOURCE],
    'soja-inoculacao': [SOY_FBN_SOURCE],
    'soja-nodulos': [SOY_FBN_SOURCE],
    'soja-fbn-compatibilidade': [SOY_FBN_SOURCE],
    'soja-nutrientes-pk': [SOY_NUTRIENT_SOURCE],
    'soja-nitrogenio-fbn': [SOY_FBN_SOURCE, SOY_NUTRIENT_SOURCE],
    'soja-agua-fases': [SOY_WATER_SOURCE],
    'soja-deficit-hidrico': [SOY_WATER_SOURCE],
    'soja-plantas-daninhas': [SOY_WEED_SOURCE],
    'soja-manejo-herbicidas': [SOY_WEED_SOURCE],
    'soja-mip-pano': [SOY_PEST_SOURCE],
    'soja-mip-preventivo': [SOY_PEST_SOURCE],
    'soja-mip-desfolha': [SOY_MIP_RESULTS_SOURCE],
    'soja-percevejo': [SOY_PEST_SOURCE],
    'soja-ferrugem': [SOY_RUST_SOURCE],
    'soja-vazio-sanitario': [SOY_RUST_SOURCE],
    'soja-rotacao': [SOY_ROTATION_SOURCE],
    'soja-cobertura': [SOY_ROTATION_SOURCE],
    'soja-colheita-ponto': [SOY_HARVEST_SOURCE],
    'soja-colheita-regulagem': [SOY_HARVEST_SOURCE],
    'soja-rr-bt': [SOY_500_QUESTIONS_SOURCE],
    'soja-compactacao': [SOY_ROTATION_SOURCE],
  };
  return items.map((item) => ({ ...item, source: [SOY_SOURCE, ...(sourceById[item.id] ?? [SOY_500_QUESTIONS_SOURCE])] }));
}

function createRandomSoybeanExercise(
  id: string,
  difficulty: StudyDifficulty,
  index: number,
  random: () => number,
): StudyExercise {
  const kind = index % 5;
  if (kind === 0 || kind === 1) {
    const pods = choose([480, 540, 600, 670, 720, 780, 840, 900], random);
    const grainsPerPod = choose([1.8, 1.9, 2, 2.1, 2.2, 2.3, 2.4], random);
    return soybeanExercise(id, difficulty, {
      population: choose([180000, 200000, 220000, 230000, 250000, 280000, 300000, 320000, 340000], random),
      plants: choose([20, 24, 25, 30], random),
      pods,
      grains: Math.round(pods * grainsPerPod),
      pmg: choose([160, 165, 170, 175, 180, 185, 190], random),
      loss: choose([5, 7, 8, 10, 12, 15], random),
    });
  }
  if (kind === 2) return soybeanPopulationExercise(id, difficulty, {
    targetPopulation: choose([180000, 200000, 220000, 240000, 260000, 280000, 300000], random),
    rowSpacing: choose([0.4, 0.45, 0.5], random),
    germination: choose([85, 88, 90, 92, 95, 98], random),
    fieldEmergence: choose([75, 80, 82, 85, 88, 90], random),
  });
  if (kind === 3) return soybeanSeedRateExercise(id, difficulty, {
    targetPopulation: choose([180000, 200000, 220000, 240000, 260000, 280000, 300000], random),
    germination: choose([85, 88, 90, 92, 95, 98], random),
    fieldEmergence: choose([75, 80, 82, 85, 88, 90], random),
    pmg: choose([150, 160, 170, 180, 190, 200], random),
    area: choose([10, 15, 20, 25, 35, 50], random),
  });
  return soybeanHarvestLossExercise(id, difficulty, {
    sampleArea: choose([1, 2, 3, 4, 5], random),
    collectedGrams: choose([5, 8, 10, 12, 15, 18, 20, 24, 30], random),
    area: choose([10, 15, 20, 25, 35, 50], random),
  });
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
      [['neutraliza acidez', 'neutraliza a acidez', 'corrige a acidez', 'corrige acidez', 'eleva ph', 'eleva o ph', 'aumenta ph', 'aumenta o ph'], ['fornece calcio', 'fornece calcio e magnesio', 'calcio e magnesio', 'calcio', 'magnesio'], ['reduz aluminio', 'reduz o aluminio', 'diminui o aluminio', 'aluminio toxico', 'toxicidade do aluminio']],
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
    ...soybeanConceptExercises(),
    soybeanPopulationExercise('soja-populacao-linha-01', 1, { targetPopulation: 240000, rowSpacing: 0.45, germination: 90, fieldEmergence: 85 }),
    soybeanSeedRateExercise('soja-sementes-kg-01', 2, { targetPopulation: 260000, germination: 92, fieldEmergence: 85, pmg: 180, area: 25 }),
    soybeanHarvestLossExercise('soja-perdas-colheita-01', 3, { sampleArea: 4, collectedGrams: 28, area: 50 }),
  ];
}

export function createRandomStudyPlan(random: () => number = Math.random): StudyExercise[] {
  const plan: StudyExercise[] = [];
  for (const difficulty of [1, 2, 3] as StudyDifficulty[]) {
    for (let index = 0; index < 5; index += 1) {
      const suffix = 'plano-' + difficulty + '-soja-' + index + '-' + Math.floor(random() * 1_000_000);
      plan.push(createRandomSoybeanExercise(suffix, difficulty, index, random));
    }

    const ctc = choose([6, 7, 8, 9, 10, 11, 12], random);
    const v1 = choose([25, 30, 35, 40, 45, 50, 55], random);
    plan.push(limingExercise('plano-' + difficulty + '-calagem-' + Math.floor(random() * 1_000_000), difficulty, {
      sb: round(ctc * v1 / 100, 2), ctc, v2: 60,
      prnt: choose([70, 75, 80, 85, 90], random),
      area: choose([10, 20, 25, 35, 50], random),
    }));
    plan.push(gypsumExercise('plano-' + difficulty + '-gessagem-' + Math.floor(random() * 1_000_000), difficulty, {
      clay: choose([18, 22, 25, 28, 32, 36, 40, 45, 50, 55], random),
      aluminum: choose([12, 16, 19, 21, 24, 28, 32, 38], random),
      calcium: choose([0.35, 0.42, 0.48, 0.52, 0.6, 0.72], random),
      area: choose([10, 20, 25, 35, 50], random),
    }));
  }

  const availableConcepts = [...getConceptStudyExercises(), ...soybeanConceptExercises()]
    .filter((exercise) => exercise.answers[0].type === 'text');
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
