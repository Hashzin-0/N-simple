export type QuestionType = 'multiple' | 'trueFalse' | 'discursive' | 'matching';

export type CourseQuestion =
  | { type: 'multiple' | 'trueFalse'; question: string; options: string[]; answer: number; explanation: string }
  | { type: 'discursive'; question: string; modelAnswer: string; evaluationCriteria: string[] }
  | { type: 'matching'; question: string; left: string[]; right: string[]; answer: number[]; explanation: string };

export type CourseModule = {
  id: string;
  title: string;
  hours: number;
  source: string;
  objective: string;
  theory: string[];
  keyPoints: string[];
  activities: string[];
  assessment: CourseQuestion[];
};

export const COURSE_MODULES: CourseModule[] = [
  {
    id:'m1', title:'Fundamentos, responsabilidades e segurança', hours:3,
    source:'SENAR-PR — Prática Operacional; NR-31.12',
    objective:'Compreender responsabilidades, riscos, EPI/EPC, limites de atuação e princípios de segurança sem transformar o curso em autorização para operação prática.',
    theory:[
      'O operador deve reconhecer riscos associados à máquina, implemento, ambiente, circulação de pessoas, terreno e energia mecânica antes de qualquer operação.',
      'EPI e EPC são medidas de prevenção e devem ser definidos conforme os riscos reais, a atividade, as normas aplicáveis e as orientações do fabricante.',
      'Capacitação teórica não equivale a habilitação ou autorização operacional. O curso do N-simple é material educacional e não substitui treinamento prático formal.',
      'Manual do fabricante, NR-31 e procedimentos de segurança da organização são referências essenciais para determinar limites e procedimentos.'
    ],
    keyPoints:['responsabilidade do operador','EPI/EPC','riscos de tombamento, esmagamento e atropelamento','manual do fabricante','limites entre conhecimento teórico e autorização operacional'],
    activities:[
      'Elabore um checklist teórico pré-operacional com 15 itens e classifique cada um em segurança, funcionamento ou manutenção.',
      'Analise um cenário hipotético de trator em área com pessoas, declive e implemento acoplado: identifique pelo menos seis perigos e seis medidas preventivas.',
      'Explique por escrito por que conhecer os comandos de uma máquina não significa estar autorizado a operá-la.'
    ],
    assessment:[
      {type:'multiple',question:'Qual deve ser a prioridade antes de uma operação?',options:['Atingir a maior velocidade','Garantir condições seguras da máquina, implemento e ambiente','Escolher a maior marcha','Aumentar a rotação'],answer:1,explanation:'A segurança e a avaliação das condições precedem o desempenho.'},
      {type:'trueFalse',question:'A leitura do manual do fabricante pode ser dispensada quando o operador já conhece outro modelo de trator.',options:['Verdadeiro','Falso'],answer:1,explanation:'Modelos diferentes podem ter comandos, limites e procedimentos diferentes.'},
      {type:'discursive',question:'Explique por que um curso on-line pode ensinar conceitos de operação sem autorizar o aluno a executar a operação.',modelAnswer:'Porque conhecimento teórico não comprova competência prática, domínio da máquina específica, avaliação de ambiente nem cumprimento dos requisitos de capacitação e supervisão aplicáveis.',evaluationCriteria:['diferenciar teoria de competência prática','mencionar máquina específica e ambiente','reconhecer limites de segurança e capacitação']},
      {type:'matching',question:'Relacione cada conceito ao significado correto.',left:['EPI','EPC','Manual do fabricante','NR-31'],right:['Equipamento de proteção individual','Medida/equipamento de proteção coletiva','Referência específica da máquina','Norma de segurança e saúde no trabalho rural'],answer:[0,1,2,3],explanation:'Cada item possui função distinta na gestão de segurança.'}
    ]
  },
  {
    id:'m2', title:'Simbologia de máquinas agrícolas: símbolos, botões e comandos', hours:4,
    source:'ISO 3767-1:2016 + Amd.1:2020; ISO 3767-2:2016 + Amd.1:2020; ISO 7000; SENAR-PR',
    objective:'Aprender a reconhecer símbolos padronizados, compreender o que representam, relacioná-los aos comandos/indicadores e diferenciar símbolo normatizado de ícone específico de fabricante.',
    theory:[
      'A ISO 3767-1 padroniza símbolos comuns para comandos e displays; a ISO 3767-2 trata especificamente de tratores e máquinas agrícolas. A família ISO 7000 fornece registros individuais de símbolos.',
      'Um botão ou comando pode ter um símbolo gráfico que identifica a função. O símbolo não deve ser interpretado por semelhança visual; deve ser associado à sua definição normativa e ao manual da máquina.',
      'Nem todo símbolo encontrado em um painel é universal. Fabricantes podem usar combinações, símbolos específicos de funções e telas proprietárias; nesses casos, o manual do modelo exato é a autoridade.',
      'Cores também têm significado em determinados displays. Na família ISO 3767, vermelho é associado a falha/avaria grave, amarelo/âmbar a condição fora dos limites normais e verde a condição normal; outras cores têm usos específicos.'
    ],
    keyPoints:['ISO 3767-1','ISO 3767-2','ISO 7000','símbolo × comando × indicador','cores de estado','símbolos específicos do fabricante'],
    activities:[
      'Estude o catálogo de símbolos abaixo e, para cada símbolo, escreva: nome, número ISO, função e situação em que pode aparecer.',
      'Escolha cinco símbolos e explique a diferença entre o significado do símbolo e a ação que o botão/comando efetivamente executa em um modelo específico.',
      'Compare um símbolo universal com um símbolo proprietário de fabricante e explique por que não se deve substituir um pelo outro.',
      'Monte uma tabela de memorização com 10 símbolos: símbolo → nome → número ISO → função → risco de interpretação incorreta.'
    ],
    assessment:[
      {type:'multiple',question:'Qual referência deve ser usada para interpretar com precisão um símbolo de comando de um trator?',options:['A semelhança visual com outro ícone','O manual do modelo e a simbologia normativa aplicável','A cor escolhida pelo usuário','A opinião de outro operador'],answer:1,explanation:'A norma padroniza símbolos, mas a função efetiva do comando no modelo específico deve ser confirmada no manual.'},
      {type:'trueFalse',question:'Todo símbolo exibido em um terminal agrícola é obrigatoriamente um símbolo ISO e possui exatamente a mesma função em qualquer marca.',options:['Verdadeiro','Falso'],answer:1,explanation:'Há símbolos normatizados e funções proprietárias; a função do modelo deve ser confirmada.'},
      {type:'discursive',question:'Explique por que o aluno deve aprender o número ISO/ISO 7000 junto com o desenho do símbolo.',modelAnswer:'O número permite identificar a referência normativa exata, reduzindo ambiguidade entre símbolos visualmente próximos e facilitando consulta técnica.',evaluationCriteria:['mencionar identificação normativa','redução de ambiguidade','consulta a fonte técnica']},
      {type:'matching',question:'Para cada função, selecione o símbolo gráfico correspondente.',left:['Motor','Freio','Freio de estacionamento/parada','Bloqueio do diferencial'],right:['engine','brake','parking-brake','diff-lock'],answer:[0,1,2,3],explanation:'O aluno deve reconhecer a função pelo símbolo gráfico. O número ISO 7000 e a denominação técnica são exibidos após a correção.'}
    ]
  },
  {
    id:'m3', title:'Comandos, controles e estação do operador', hours:4,
    source:'SENAR-PR — Operação de Tratores e Implementos; NR-31.12',
    objective:'Compreender a função dos principais comandos da estação do operador sem executar procedimentos em máquina real.',
    theory:[
      'Pedais, direção, freios, acelerador, alavancas, controles hidráulicos, TDP, bloqueio do diferencial, tração dianteira e instrumentos possuem funções distintas.',
      'A localização física varia entre modelos. O símbolo ajuda a identificar a função, mas a sequência e a lógica de acionamento devem ser confirmadas no manual.',
      'Comandos relacionados a energia, movimento e implementos exigem atenção especial porque um acionamento pode produzir movimento ou liberar energia.',
      'O treinamento teórico deve priorizar reconhecimento, interpretação e tomada de decisão segura.'
    ],
    keyPoints:['pedais e direção','freios','controles hidráulicos','TDP','TDA e diferencial','instrumentos do painel'],
    activities:[
      'Faça um mapa teórico da estação do operador, separando comandos de condução, transmissão, hidráulica, TDP e instrumentos.',
      'Explique o que pode acontecer se um comando for interpretado incorretamente e dê três exemplos.',
      'Crie cinco perguntas de identificação de comandos usando fotografias reais de um manual de trator.'
    ],
    assessment:[
      {type:'multiple',question:'Por que a posição de um comando não deve ser generalizada entre tratores?',options:['Porque todos os fabricantes escondem comandos','Porque layout e lógica de controle variam conforme o modelo','Porque símbolos não existem','Porque o motor muda de combustível'],answer:1,explanation:'A localização e a lógica dos controles dependem do projeto do modelo.'},
      {type:'trueFalse',question:'Um mesmo símbolo pode ser combinado com outros símbolos para representar uma função mais específica.',options:['Verdadeiro','Falso'],answer:0,explanation:'A ISO prevê símbolos e combinações para ampliar a especificidade da informação.'},
      {type:'discursive',question:'Descreva como você confirmaria a função de um botão desconhecido sem acioná-lo.',modelAnswer:'Identificaria o símbolo, consultaria o manual do modelo exato e verificaria a descrição do comando, estado e condições de uso.',evaluationCriteria:['identificação visual','manual do modelo','não acionar sem confirmação']},
      {type:'matching',question:'Relacione o sistema à função.',left:['TDP','Sistema hidráulico','Transmissão','Bloqueio do diferencial'],right:['Transmite potência rotacional ao implemento','Aciona atuadores/circuitos hidráulicos','Adapta torque e rotação para o deslocamento','Conecta a rotação das rodas do eixo conforme a função de bloqueio'],answer:[0,1,2,3],explanation:'São sistemas distintos e devem ser reconhecidos separadamente.'}
    ]
  },
  {
    id:'m4', title:'Motor diesel, transmissão e TDP', hours:4,
    source:'SENAR-PR — Operação de Tratores e Implementos',
    objective:'Compreender fundamentos de motor, torque, potência, transmissão e tomada de potência.',
    theory:[
      'O ciclo Diesel envolve admissão, compressão, combustão/expansão e escape.',
      'Alimentação de ar e combustível, lubrificação, arrefecimento e sistema elétrico trabalham de forma integrada.',
      'A transmissão adapta torque e rotação às necessidades de deslocamento.',
      'A TDP transmite potência rotacional ao implemento e deve operar segundo as especificações do conjunto.'
    ],
    keyPoints:['ciclo de quatro tempos','sistemas do motor','torque e potência','transmissão','TDP 540/540E/1000 quando disponíveis'],
    activities:[
      'Explique, em texto, o fluxo de energia do combustível até as rodas e até a TDP.',
      'Compare marcha baixa e alta em termos de torque e velocidade.',
      'Resolva três questões conceituais sobre potência, torque e rotação sem usar valores inventados de um trator.'
    ],
    assessment:[
      {type:'multiple',question:'A potência mecânica do motor é relacionada principalmente a:',options:['Torque e velocidade angular','Massa do pneu','Cor do trator','Largura da cabine'],answer:0,explanation:'Potência mecânica é torque multiplicado pela velocidade angular.'},
      {type:'trueFalse',question:'A TDP transmite potência rotacional para equipamentos que utilizam esse acionamento.',options:['Verdadeiro','Falso'],answer:0,explanation:'Essa é a finalidade fundamental da tomada de potência.'},
      {type:'discursive',question:'Explique por que uma marcha mais baixa pode aumentar a força disponível nas rodas sem aumentar a potência do motor.',modelAnswer:'A transmissão altera a relação entre rotação e torque; idealmente, reduzindo a velocidade de saída, aumenta-se o torque disponível, descontadas as perdas.',evaluationCriteria:['relação de transmissão','torque nas rodas','potência do motor não é criada']},
      {type:'matching',question:'Relacione sistema e função.',left:['Arrefecimento','Lubrificação','Alimentação de combustível','Transmissão'],right:['Controla temperatura','Reduz atrito e remove calor','Fornece combustível ao processo de combustão','Adapta torque e rotação'],answer:[0,1,2,3],explanation:'Cada sistema possui uma função específica.'}
    ]
  },
  {
    id:'m5', title:'Pneus, bitola, TDA, patinagem e lastreamento', hours:4,
    source:'SENAR-PR — Operação de Tratores e Implementos',
    objective:'Compreender os fatores que controlam tração, patinagem, estabilidade e compactação.',
    theory:[
      'Pneu, pressão, carga por eixo, solo e velocidade influenciam a interação pneu-solo.',
      'A bitola deve ser compatível com cultura, implemento e recomendações do fabricante.',
      'Em tratores com TDA, o avanço entre eixos deve respeitar a especificação do fabricante.',
      'Patinagem excessiva dissipa energia; lastro excessivo também pode aumentar compactação e resistência ao rolamento.'
    ],
    keyPoints:['pressão dos pneus','bitola','avanço da TDA','patinagem','lastro líquido e contrapesos','compactação'],
    activities:[
      'Explique cinco causas possíveis de patinagem excessiva sem assumir um único culpado.',
      'Analise três cenários teóricos e decida se a hipótese inicial deve ser pressão, lastro, marcha, solo ou combinação.',
      'Calcule conceitualmente a patinagem a partir de distâncias medidas, sem transformar o resultado em recomendação automática.'
    ],
    assessment:[
      {type:'multiple',question:'Patinagem excessiva normalmente representa:',options:['Aproveitamento perfeito da potência','Perda de energia no contato pneu-solo','Aumento obrigatório da produtividade','Ausência de resistência ao rolamento'],answer:1,explanation:'Parte da energia disponível é dissipada sem produzir avanço útil.'},
      {type:'trueFalse',question:'Mais lastro é sempre melhor para a tração.',options:['Verdadeiro','Falso'],answer:1,explanation:'Peso excessivo pode aumentar compactação e resistência ao rolamento.'},
      {type:'discursive',question:'Explique por que a mesma configuração de trator pode apresentar patinagem diferente em dois solos.',modelAnswer:'Porque a capacidade de interação pneu-solo depende das propriedades e condições do solo, além de umidade, carga, pressão e condição superficial.',evaluationCriteria:['interação pneu-solo','diferença entre solos','não atribuir tudo ao motor']},
      {type:'matching',question:'Relacione variável e efeito.',left:['Pressão dos pneus','Lastro','Bitola','Patinagem'],right:['Altera área de contato/deformação','Altera distribuição de massa e carga','Define largura entre rodas','Diferença entre avanço real e avanço associado à rotação'],answer:[0,1,2,3],explanation:'São variáveis diferentes, embora interdependentes.'}
    ]
  },
  {
    id:'m6', title:'Implementos, potência e regulagem', hours:4,
    source:'SENAR-PR — Operação de Tratores e Implementos; Embrapa',
    objective:'Entender compatibilidade entre trator e implemento, resistência, engates, hidráulica e qualidade de regulagem.',
    theory:[
      'A potência necessária depende do implemento, largura, profundidade, velocidade, condição do solo e resistência específica.',
      'Engate de três pontos, barra de tração e hidráulico têm limites estruturais e geométricos.',
      'Profundidade, nivelamento, largura, velocidade e rotação podem interagir e alterar a qualidade do trabalho.',
      'Não existe uma potência universal que garanta compatibilidade em qualquer solo.'
    ],
    keyPoints:['barra de tração','três pontos','hidráulico','resistência específica','profundidade','qualidade agronômica'],
    activities:[
      'Monte uma ficha teórica de compatibilidade para um implemento: finalidade, largura, profundidade, velocidade, potência e limites.',
      'Analise por que aumentar apenas a rotação pode não resolver perda de velocidade em um implemento de solo.',
      'Compare arado, grade, subsolador, cultivador e pulverizador quanto ao tipo de demanda sobre o trator.'
    ],
    assessment:[
      {type:'multiple',question:'Qual fator NÃO deve ser usado isoladamente para selecionar um implemento?',options:['Potência nominal','Condição do solo','Profundidade','Resistência requerida'],answer:0,explanation:'Potência nominal isolada não representa toda a demanda do conjunto.'},
      {type:'trueFalse',question:'A qualidade do trabalho deve ser considerada junto com produtividade e consumo.',options:['Verdadeiro','Falso'],answer:0,explanation:'Eficiência operacional é multidimensional.'},
      {type:'discursive',question:'Explique por que dois implementos da mesma largura podem exigir forças diferentes.',modelAnswer:'Porque geometria, profundidade, tipo de órgão ativo, velocidade e resistência do solo podem ser diferentes.',evaluationCriteria:['geometria','profundidade','solo/resistência']},
      {type:'matching',question:'Relacione implemento à demanda típica.',left:['Subsolador','Pulverizador','Grade de discos','Cultivador'],right:['Tração profunda e elevada resistência','Deslocamento com demanda de bombeamento','Corte/mobilização superficial e resistência variável','Trabalho entre linhas com controle de velocidade e profundidade'],answer:[0,1,2,3],explanation:'As demandas variam conforme configuração e operação.'}
    ]
  },
  {
    id:'m7', title:'Marcha, rotação e velocidade de trabalho', hours:4,
    source:'SENAR-PR + Embrapa + dados documentados dos tratores da plataforma',
    objective:'Interpretar velocidades de transmissão e compreender por que a marcha real depende de condições de operação.',
    theory:[
      'A velocidade de tabela é uma referência condicionada à rotação, pneus e configuração indicadas pelo fabricante.',
      'Velocidade real pode mudar por patinagem, carga, terreno, inclinação e condição do solo.',
      'A seleção de marcha deve considerar força requerida, faixa de torque, velocidade desejada e qualidade da operação.',
      'A calculadora da plataforma só produz estimativa quando os parâmetros reais são fornecidos e não usa faixas fictícias de velocidade por operação.'
    ],
    keyPoints:['velocidade teórica × real','rotação','força requerida','patinagem','dados de manual','limites da calculadora'],
    activities:[
      'Escolha três marchas documentadas para uma velocidade-alvo fornecida e justifique a comparação sem afirmar que alguma é automaticamente correta.',
      'Explique por que uma mesma marcha pode produzir velocidades reais diferentes em dois cenários.',
      'Analise um resultado hipotético da calculadora e liste quais dados de campo deveriam ser conferidos antes de usá-lo como referência.'
    ],
    assessment:[
      {type:'multiple',question:'Uma velocidade de tabela de transmissão é:',options:['Garantia de velocidade no campo','Referência sob condições especificadas','Velocidade universal','Limite legal de operação'],answer:1,explanation:'É uma referência condicionada à configuração documentada.'},
      {type:'trueFalse',question:'A carga sozinha determina a marcha correta de um trator.',options:['Verdadeiro','Falso'],answer:1,explanation:'Também entram implemento, solo, inclinação, tração, rotação, pneus e qualidade da operação.'},
      {type:'discursive',question:'Explique por que a calculadora não deve preencher automaticamente carga, inclinação, aderência ou eficiência.',modelAnswer:'Porque esses valores variam entre operações e sua invenção produziria uma falsa precisão e poderia induzir a uma decisão operacional inadequada.',evaluationCriteria:['variabilidade dos dados','falsa precisão','segurança técnica']},
      {type:'matching',question:'Relacione dado e efeito.',left:['Rotação do motor','Patinagem','Inclinação','Pneus'],right:['Altera velocidade de referência da transmissão','Reduz avanço real','Altera componente da força resistente','Afeta relação entre rotação e velocidade de deslocamento'],answer:[0,1,2,3],explanation:'Os quatro fatores interferem no desempenho de forma diferente.'}
    ]
  },
  {
    id:'m8', title:'Manutenção preventiva, diagnóstico e eficiência', hours:3,
    source:'SENAR Play — Manutenção de Tratores Agrícolas; SENAR-PR; Embrapa',
    objective:'Desenvolver raciocínio de inspeção, manutenção preventiva e diagnóstico sem orientar o aluno a executar intervenções perigosas.',
    theory:[
      'A manutenção preventiva deve seguir o plano do fabricante e considerar severidade de uso e condições ambientais quando previsto.',
      'Níveis, filtros, lubrificação, pneus, freios, direção, arrefecimento, hidráulica e sistema elétrico exigem inspeção conforme o plano específico.',
      'Diagnóstico técnico começa por sintoma, hipótese, evidência e documentação; não por troca aleatória de componentes.',
      'Intervenções mecânicas devem ser realizadas somente por pessoas capacitadas e conforme procedimentos seguros.'
    ],
    keyPoints:['plano de manutenção','horas de serviço','inspeção','diagnóstico por evidência','limites de atuação','eficiência operacional'],
    activities:[
      'Crie uma ficha de manutenção preventiva com item, periodicidade, condição encontrada e ação recomendada.',
      'Classifique cinco falhas hipotéticas em monitorar, programar manutenção ou retirar de serviço, justificando cada decisão.',
      'Monte um fluxograma de diagnóstico: sintoma → hipóteses → evidências → decisão.'
    ],
    assessment:[
      {type:'multiple',question:'Qual é a referência primária para intervalo de manutenção?',options:['Um intervalo universal','Manual/plano do fabricante','Apenas aparência do óleo','Opinião de outro operador'],answer:1,explanation:'O plano do fabricante é a referência primária do modelo.'},
      {type:'trueFalse',question:'Diagnóstico técnico deve partir de evidências e sintomas, não apenas de suposições.',options:['Verdadeiro','Falso'],answer:0,explanation:'O diagnóstico deve ser rastreável e baseado em evidências.'},
      {type:'discursive',question:'Explique por que trocar peças sem diagnosticar a causa pode aumentar o custo e não resolver a falha.',modelAnswer:'Porque a peça substituída pode não ser a causa; o defeito original pode permanecer e ainda gerar custo, tempo parado e novos danos.',evaluationCriteria:['causa raiz','custo','tempo de indisponibilidade']},
      {type:'matching',question:'Relacione atividade e finalidade.',left:['Lubrificação','Inspeção de pneus','Registro de manutenção','Manual'],right:['Reduzir atrito conforme especificação','Verificar condição e segurança do rodado','Rastrear serviços e ocorrências','Fonte específica de limites e procedimentos'],answer:[0,1,2,3],explanation:'Cada ação contribui para disponibilidade e segurança.'}
    ]
  }
];

export const COURSE_TOTAL_HOURS = COURSE_MODULES.reduce((total, module) => total + module.hours, 0);
