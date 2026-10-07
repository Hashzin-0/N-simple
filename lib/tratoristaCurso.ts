export type CourseQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type CourseModule = {
  id: string;
  title: string;
  hours: number;
  source: string;
  objective: string;
  theory: string[];
  keyPoints: string[];
  activities: string[];
  practicalTask: string;
  assessment: CourseQuestion[];
};

export const COURSE_MODULES: CourseModule[] = [
  {
    id: 'm1',
    title: 'Fundamentos, responsabilidades e segurança',
    hours: 3,
    source: 'SENAR-PR — Prática Operacional; NR-31.12',
    objective: 'Reconhecer os riscos da operação, interpretar as responsabilidades do operador e preparar uma jornada de trabalho segura antes de ligar o trator.',
    theory: [
      'O operador é responsável por avaliar máquina, implemento, ambiente, rota, pessoas próximas e condições de trabalho antes da partida.',
      'EPI e EPC são barreiras de prevenção. A seleção deve considerar o risco real da atividade e as orientações do fabricante e das normas aplicáveis.',
      'A simbologia universal permite identificar comandos, advertências e riscos mesmo quando o painel ou manual utiliza poucos textos.',
      'Manual do fabricante, procedimentos da propriedade e capacitação compatível com a função são referências obrigatórias para uma operação segura.'
    ],
    keyPoints: [
      'Inspeção visual antes da partida',
      'Pontos de esmagamento, queda, tombamento e atropelamento',
      'EPI, EPC e sinalização',
      'Responsabilidades do operador',
      'Leitura do manual e identificação dos limites da máquina'
    ],
    activities: [
      'Monte um checklist pré-operacional com pelo menos 12 itens e classifique cada item como segurança, funcionamento ou manutenção.',
      'Analise uma situação hipotética de operação próxima a pessoas e identifique cinco riscos e cinco medidas preventivas.'
    ],
    practicalTask: 'Com o motor desligado, faça uma inspeção externa completa e explique em voz alta por que cada item verificado é importante.',
    assessment: [
      {
        question: 'Qual é a primeira prioridade antes de iniciar uma operação com trator?',
        options: ['Atingir a maior velocidade possível', 'Garantir condições seguras da máquina, implemento e ambiente', 'Aumentar a rotação do motor', 'Engatar a marcha mais alta'],
        answer: 1,
        explanation: 'A operação deve começar pela avaliação de riscos e pelas condições seguras da máquina, do implemento e do ambiente.'
      }
    ]
  },
  {
    id: 'm2',
    title: 'Comandos, controles e operação segura',
    hours: 4,
    source: 'SENAR-PR — Prática Operacional e NR-31.12',
    objective: 'Identificar os comandos da estação do operador e executar procedimentos seguros de partida, deslocamento, parada, engate e desengate.',
    theory: [
      'Antes de movimentar o trator, o operador deve conhecer pedais, alavancas, direção, freios, acelerador, controles hidráulicos, TDP, bloqueio do diferencial e TDA quando existentes.',
      'A partida e a parada devem seguir a sequência definida pelo fabricante. Não se deve presumir que tratores diferentes possuem a mesma lógica de comandos.',
      'Engate e desengate exigem controle de energia e prevenção contra movimento inesperado, esmagamento e queda de implementos.',
      'Deslocamento em aclives, declives, curvas, estradas e áreas de manobra requer velocidade compatível e atenção à estabilidade.'
    ],
    keyPoints: [
      'Partida e parada segura',
      'Pedais, direção e freios',
      'Comandos hidráulicos',
      'Engate e desengate',
      'Deslocamento e manobras'
    ],
    activities: [
      'Identifique no painel ou manual todos os símbolos de segurança e operação e registre a função de cada um.',
      'Simule uma sequência de engate e desengate sem aproximar partes do corpo entre o trator e o implemento.'
    ],
    practicalTask: 'Com instrutor ou responsável habilitado, execute a sequência de inspeção, partida, deslocamento lento, parada e estacionamento seguindo o manual do trator utilizado.',
    assessment: [
      {
        question: 'Por que o procedimento de engate não deve ser tratado apenas como uma sequência mecânica?',
        options: ['Porque o implemento sempre pesa menos que o trator', 'Porque há riscos de movimento inesperado, esmagamento e queda', 'Porque o motor deve estar acelerado', 'Porque a TDP deve estar ligada'],
        answer: 1,
        explanation: 'O engate envolve riscos mecânicos e de energia armazenada; o procedimento deve impedir movimentos inesperados e exposição do operador.'
      }
    ]
  },
  {
    id: 'm3',
    title: 'Motor diesel, transmissão e TDP',
    hours: 4,
    source: 'SENAR-PR — Operação de Tratores e Implementos',
    objective: 'Compreender o funcionamento básico do motor diesel e relacionar rotação, torque, transmissão, velocidade e tomada de potência.',
    theory: [
      'O motor ciclo Diesel converte a energia química do combustível em trabalho mecânico por meio dos processos de admissão, compressão, combustão/expansão e escape.',
      'Sistemas de alimentação de ar e combustível, lubrificação, arrefecimento e sistema elétrico trabalham de forma integrada; falhas em um deles alteram o desempenho do conjunto.',
      'A transmissão adapta torque e rotação do motor às necessidades de deslocamento. Marchas mais baixas favorecem força na roda; marchas mais altas favorecem velocidade.',
      'A TDP transmite potência rotacional ao implemento. A rotação exigida deve ser a indicada pelo fabricante do implemento e do trator.'
    ],
    keyPoints: [
      'Ciclo de quatro tempos',
      'Sistemas periféricos do motor',
      'Torque × rotação × potência',
      'Escalonamento da transmissão',
      'TDP 540, 540E e 1000 rpm quando disponíveis'
    ],
    activities: [
      'Desenhe o fluxo de energia desde a combustão até as rodas e, separadamente, até a TDP.',
      'Compare duas marchas do trator cadastrado e explique o que muda em velocidade, torque disponível e força requerida.'
    ],
    practicalTask: 'Localize os comandos de transmissão e TDP no manual do modelo utilizado e demonstre, com o motor desligado, a sequência correta para selecioná-los.',
    assessment: [
      {
        question: 'Qual é a relação fundamental entre potência, torque e rotação?',
        options: ['Potência depende apenas da massa do trator', 'Potência mecânica é proporcional ao produto entre torque e velocidade angular', 'Torque e rotação nunca se relacionam', 'A velocidade de deslocamento define diretamente a potência do motor'],
        answer: 1,
        explanation: 'Em termos mecânicos, potência é o produto do torque pela velocidade angular; a transmissão modifica a relação entre rotação e torque nas rodas.'
      }
    ]
  },
  {
    id: 'm4',
    title: 'Pneus, bitola, TDA, patinagem e lastreamento',
    hours: 4,
    source: 'SENAR-PR — Operação de Tratores e Implementos',
    objective: 'Preparar o conjunto trator-pneu para transferir força ao solo sem excesso de patinagem, compactação ou desgaste.',
    theory: [
      'Pneu, pressão, carga por eixo, tipo de solo e velocidade interferem na área de contato, deformação e capacidade de tração.',
      'A bitola deve ser ajustada conforme a cultura, o implemento e as recomendações do fabricante, mantendo alinhamento e estabilidade.',
      'Em tratores com TDA, o avanço entre os eixos deve permanecer dentro da faixa indicada pelo fabricante; configuração incorreta pode aumentar desgaste e comprometer a tração.',
      'Patinagem excessiva representa perda de energia e pode elevar o consumo e o dano ao solo. A solução pode envolver pressão, lastro, relação de marcha e condição do conjunto.',
      'O lastreamento deve ser dimensionado para a operação. Peso excessivo também pode aumentar compactação e resistência ao rolamento.'
    ],
    keyPoints: [
      'Nomenclatura e aplicação dos pneus',
      'Pressão e carga',
      'Bitola e alinhamento',
      'Avanço da TDA',
      'Medição de patinagem',
      'Lastro líquido e contrapesos'
    ],
    activities: [
      'Calcule a patinagem a partir de uma distância medida com e sem carga e interprete o resultado.',
      'Monte uma matriz de decisão: aumentar lastro, reduzir lastro, alterar pressão, reduzir velocidade ou trocar marcha.'
    ],
    practicalTask: 'Sob supervisão, meça a patinagem em uma condição de campo e registre solo, pneu, pressão, marcha, distância e número de voltas.',
    assessment: [
      {
        question: 'Qual situação normalmente indica perda de eficiência de tração?',
        options: ['Patinagem excessiva', 'Pressão sempre igual em qualquer solo', 'Uso do manual do fabricante', 'Velocidade compatível com o implemento'],
        answer: 0,
        explanation: 'Patinagem excessiva representa parte da energia disponível sendo dissipada no contato pneu-solo sem produzir avanço útil.'
      }
    ]
  },
  {
    id: 'm5',
    title: 'Implementos, engates e regulagem',
    hours: 4,
    source: 'SENAR-PR — Operação de Tratores e Implementos',
    objective: 'Selecionar, acoplar e regular implementos de acordo com potência, sistema de engate, condição do solo e objetivo agronômico.',
    theory: [
      'Implementos de preparo do solo apresentam diferentes resistências e profundidades de trabalho. Não existe uma potência universal para todos os solos e configurações.',
      'O engate de três pontos, a barra de tração e os sistemas hidráulicos possuem limites de carga e geometria que devem ser respeitados.',
      'A regulagem deve buscar a qualidade agronômica desejada com o menor esforço desnecessário: profundidade, nivelamento, largura, rotação e velocidade são interdependentes.',
      'O implemento deve ser compatível com a potência e capacidade hidráulica do trator, mas também com a capacidade estrutural e os limites de segurança do conjunto.'
    ],
    keyPoints: [
      'Barra de tração',
      'Engate de três pontos',
      'Sistema hidráulico',
      'Arado, grade, escarificador, subsolador e cultivador',
      'Profundidade e nivelamento',
      'Compatibilidade trator × implemento'
    ],
    activities: [
      'Escolha um implemento e faça uma ficha de regulagem contendo finalidade, profundidade, largura, velocidade, TDP quando aplicável e pontos de inspeção.',
      'Analise um caso em que o trator não consegue manter a velocidade e liste as variáveis que devem ser verificadas antes de simplesmente aumentar a rotação.'
    ],
    practicalTask: 'Faça, com supervisão, o acoplamento e a regulagem de um implemento disponível na propriedade, documentando as configurações antes da operação.',
    assessment: [
      {
        question: 'A potência nominal do trator, sozinha, determina se um implemento é adequado?',
        options: ['Sim, sempre', 'Não; também devem ser considerados resistência, solo, regulagem, sistema de engate e limites do conjunto', 'Somente a largura importa', 'Somente o peso do implemento importa'],
        answer: 1,
        explanation: 'O dimensionamento é multidimensional e depende da resistência requerida, condição do solo, regulagens, engate, hidráulico, velocidade e limites do conjunto.'
      }
    ]
  },
  {
    id: 'm6',
    title: 'Marcha, rotação e velocidade de trabalho',
    hours: 4,
    source: 'SENAR-PR + referências de desempenho de tratores',
    objective: 'Selecionar uma relação de marcha e rotação coerentes com a operação, diferenciando velocidade teórica de desempenho real em campo.',
    theory: [
      'A velocidade indicada em uma tabela de transmissão é uma condição de referência. A velocidade real pode variar com rotação, pneus, carga, patinagem e condições do terreno.',
      'A seleção de marcha deve considerar a força requerida, velocidade desejada, faixa de torque do motor, capacidade de tração e qualidade da operação.',
      'A mesma carga nominal pode exigir marchas diferentes em solo firme, solo solto, aclive ou declive.',
      'A calculadora desta plataforma cruza dados documentados de transmissão com parâmetros fornecidos pelo usuário. Ela não inventa uma marcha quando faltam dados de campo ou do manual.'
    ],
    keyPoints: [
      'Tabela de escalonamento',
      'Velocidade teórica × real',
      'Faixa de rotação',
      'Força requerida e força disponível',
      'Inclinação e resistência ao rolamento',
      'Validação em manual e campo'
    ],
    activities: [
      'Use a biblioteca de marchas para escolher três relações possíveis para uma velocidade-alvo e justifique a escolha.',
      'Compare a mesma marcha em duas condições de solo e explique por que a velocidade real e a patinagem podem mudar.'
    ],
    practicalTask: 'Registre velocidade indicada, velocidade medida, rotação, marcha e patinagem durante uma operação supervisionada e compare os valores.',
    assessment: [
      {
        question: 'Uma velocidade de tabela de transmissão deve ser interpretada como:',
        options: ['Garantia da velocidade real no campo', 'Referência para uma condição específica de rotação e rodado', 'Velocidade mínima obrigatória', 'Velocidade universal para qualquer implemento'],
        answer: 1,
        explanation: 'Tabelas de transmissão são referências condicionadas à rotação, configuração de pneus e demais condições indicadas pelo fabricante.'
      }
    ]
  },
  {
    id: 'm7',
    title: 'Manutenção preventiva e inspeção',
    hours: 4,
    source: 'SENAR Play — Manutenção de Tratores Agrícolas; SENAR-PR',
    objective: 'Estabelecer uma rotina de inspeção e manutenção preventiva capaz de detectar falhas antes que comprometam segurança, disponibilidade e custo operacional.',
    theory: [
      'Manutenção preventiva reduz a probabilidade de falhas e deve seguir o plano do fabricante para o modelo e a severidade de uso.',
      'Níveis, filtros, lubrificação, correias, pneus, freios, direção, sistema hidráulico, arrefecimento e sistema elétrico devem ser verificados conforme os intervalos prescritos.',
      'O intervalo correto não deve ser generalizado: horas de serviço, condições de poeira, carga, temperatura e recomendações do fabricante podem alterar o plano.',
      'Qualquer intervenção deve respeitar procedimentos de isolamento, motor desligado, implemento apoiado e eliminação de fontes de energia conforme o risco.'
    ],
    keyPoints: [
      'Checklist diário',
      'Lubrificação',
      'Filtros e fluidos',
      'Arrefecimento',
      'Hidráulico, freios e direção',
      'Registros de manutenção'
    ],
    activities: [
      'Crie uma ficha de manutenção com item, periodicidade, condição encontrada, ação executada e responsável.',
      'Classifique cinco falhas em: pode continuar monitorando, requer manutenção antes da próxima operação ou exige retirada imediata de serviço.'
    ],
    practicalTask: 'Execute uma inspeção diária seguindo o manual do trator e registre todas as anormalidades sem realizar intervenções para as quais você não esteja capacitado.',
    assessment: [
      {
        question: 'Qual é a melhor referência para os intervalos de manutenção?',
        options: ['Um intervalo universal para todos os tratores', 'O plano do fabricante, ajustado às condições de uso quando previsto', 'Somente a aparência do óleo', 'A experiência de qualquer operador'],
        answer: 1,
        explanation: 'Os intervalos dependem do modelo e das condições de uso; o manual do fabricante é a referência primária.'
      }
    ]
  },
  {
    id: 'm8',
    title: 'Eficiência, tração e decisão operacional',
    hours: 3,
    source: 'SENAR-PR + Embrapa',
    objective: 'Integrar segurança, tração, regulagem, desempenho e qualidade para tomar decisões operacionais justificadas.',
    theory: [
      'Eficiência operacional não é apenas velocidade. Deve considerar capacidade de campo, consumo, qualidade do trabalho, tempo improdutivo, desgaste e conservação do solo.',
      'A força disponível na barra é limitada pela potência transmitida e pela capacidade de interação pneu-solo. A condição de tração pode ser tão importante quanto a potência nominal.',
      'Uma decisão técnica deve ser validada por dados: marcha, rotação, patinagem, velocidade real, consumo quando disponível, profundidade e qualidade do implemento.',
      'Quando a estimativa da calculadora divergir do comportamento de campo, a prioridade é verificar dados, manual, regulagem, pneus, lastro e condições reais antes de concluir que o modelo está errado.'
    ],
    keyPoints: [
      'Diagnóstico de patinagem',
      'Força de tração',
      'Capacidade operacional',
      'Consumo e qualidade',
      'Conservação do solo',
      'Decisão baseada em medição'
    ],
    activities: [
      'Faça um diagnóstico completo de uma operação: problema observado → hipótese → medição → ajuste → nova medição.',
      'Compare duas estratégias de operação e escolha a melhor usando pelo menos quatro indicadores técnicos.'
    ],
    practicalTask: 'Realize uma operação supervisionada, registre os indicadores disponíveis e produza um relatório curto justificando a marcha, velocidade, regulagem e condição de tração escolhidas.',
    assessment: [
      {
        question: 'Qual é a melhor forma de validar uma decisão de operação?',
        options: ['Escolher a maior marcha disponível', 'Basear-se apenas na potência nominal', 'Combinar manual, dados medidos, condição de campo e qualidade do trabalho', 'Usar sempre a mesma marcha'],
        answer: 2,
        explanation: 'A decisão robusta combina documentação técnica com medições e observação da qualidade e segurança da operação.'
      }
    ]
  }
];

export const COURSE_TOTAL_HOURS = COURSE_MODULES.reduce((total, module) => total + module.hours, 0);
