export type Gear = { id: string; label: string; speedKmh: number; group?: string };
export type TractorSpec = {
  id: string; brand: string; model: string; label: string; powerCv: number; nominalRpm: number;
  massKg: number; traction: '4x2' | '4x4' | '4x2/TDA'; gears: Gear[]; source: string; sourceLabel: string; notes: string;
};
const gear = (label: string, speedKmh: number): Gear => ({ id: label, label, speedKmh });
export const TRACTORS: TractorSpec[] = [
  {
    id:'valtra-bh180', brand:'Valtra', model:'BH 180', label:'Valtra BH 180', powerCv:189, nominalRpm:2300, massKg:7290, traction:'4x4',
    gears:[gear('L1',3.1),gear('L2',4.3),gear('L3',5.1),gear('M1',6.1),gear('L4',7.2),gear('M2',8.6),gear('M3',10.2),gear('H1',12),gear('M4',14.2),gear('H2',17),gear('H3',20.2),gear('H4',28.1),gear('R1',5.4),gear('R2',7.7),gear('R3',9.1),gear('R4',12.7)],
    source:'https://www.sistemafaep.org.br/wp-content/uploads/2026/01/PR.0387-Tratorista-Pratica-Operacional_web.pdf',
    sourceLabel:'SENAR-PR, Tratorista: Prática Operacional, Quadro 3 + especificações Valtra',
    notes:'Velocidades teóricas a 2300 rpm, rodado 24.5-32 R1. TDP: 540 rpm a 1747 rpm do motor e 1000 rpm a 2272 rpm.'
  },
  {
    id:'john-deere-5705', brand:'John Deere', model:'5705', label:'John Deere 5705 4×4', powerCv:85, nominalRpm:2400, massKg:2900, traction:'4x4',
    gears:[gear('A1',2.3),gear('A2',3.3),gear('A3',4.5),gear('B1',5.4),gear('B2',7.8),gear('B3',10.6),gear('C1',14.8),gear('C2',21.1),gear('C3',28.8),gear('R1',3.2),gear('R2',7.4),gear('R3',20.4)],
    source:'https://www.sistemafaep.org.br/wp-content/uploads/2026/01/PR.0387-Tratorista-Pratica-Operacional_web.pdf',
    sourceLabel:'SENAR-PR, Quadro 3 + manual John Deere 5700/5705',
    notes:'Velocidades de avanço a 2400 rpm com pneu traseiro 18.4-30 R1. A configuração de rodado altera a velocidade.'
  },
  {
    id:'new-holland-7630', brand:'New Holland', model:'7630 MAR-I', label:'New Holland 7630 MAR-I', powerCv:110, nominalRpm:2200, massKg:3886, traction:'4x4',
    gears:[gear('L1',4),gear('L2',5),gear('L3',6),gear('L4',7),gear('H1',8),gear('H2',9.5),gear('H3',10.8),gear('H4',12)],
    source:'https://assets.cnhindustrial.com/nhag/lar/pt-br/Documents/B3-0108-18%20FOLHETERIA%20TRATOR_30-v2%20-%20Em%20Baixa%20%281%29.pdf',
    sourceLabel:'New Holland, Série 30 7630/8030 MAR-I + SENAR-PR Quadro 3',
    notes:'A ficha oficial informa transmissão 16x4 e oito velocidades de trabalho entre 4 e 12 km/h. Os valores individuais são uma representação operacional do diagrama.'
  }
];
export const COURSE_MODULES = [
  {id:'m1',title:'Fundamentos e responsabilidade do operador',hours:2,source:'SENAR-PR + NR-31',lessons:['Função do operador e planejamento da jornada','Responsabilidades trabalhista, civil, penal e ambiental','Leitura do manual do fabricante','Identificação do trator, implemento e riscos antes da partida']},
  {id:'m2',title:'Segurança, EPI/EPC e operação',hours:4,source:'SENAR-PR + NR-31.12',lessons:['Inspeção antes do trabalho','Deslocamento, manobras, reboque e obstáculos','Engate e desengate seguro','Parada, abastecimento, manutenção e emergência','Primeiros socorros e sinalização']},
  {id:'m3',title:'Comandos, transmissão e TDP',hours:4,source:'SENAR-PR',lessons:['Painel, pedais, aceleradores e freios','Tração dianteira auxiliar e bloqueio do diferencial','Caixa de câmbio, grupos, reversor e tipos de transmissão','TDP/TDF 540, 540E e 1000 rpm','Relação entre rotação, torque e velocidade']},
  {id:'m4',title:'Preparação do trator para o trabalho',hours:4,source:'SENAR-PR',lessons:['Pneus, nomenclatura e pressão','Bitola e alinhamento','Índice de avanço da TDA','Patinagem e métodos de medição','Lastreamento e distribuição de peso']},
  {id:'m5',title:'Implementos e dimensionamento',hours:4,source:'SENAR-PR',lessons:['Barra de tração e engate de três pontos','Tipos e finalidades de implementos','Compatibilidade implemento × potência','Regulagem de profundidade e hidráulico','Força de tração e resistência ao rolamento']},
  {id:'m6',title:'Marcha, rotação e velocidade de trabalho',hours:4,source:'SENAR-PR + literatura técnica',lessons:['Como ler tabelas de escalonamento','Velocidade teórica × velocidade real','Seleção de marcha conforme carga e condição','Relação entre força, velocidade e potência','Efeito de inclinação, solo, pneus e carga']},
  {id:'m7',title:'Manutenção preventiva',hours:4,source:'SENAR Play',lessons:['Motor diesel e sistemas periféricos','Transmissão, direção, lubrificação e arrefecimento','Rodados, freios, hidráulico, elétrico e TDP','Checklist diário e intervalos de 10, 50, 250 e 500 horas']},
  {id:'m8',title:'Eficiência, tração e decisão operacional',hours:4,source:'SENAR-PR + Embrapa',lessons:['Diagnóstico de patinagem','Ajuste de lastro e pressão dos pneus','Força de tração disponível e requerida','Consumo, capacidade operacional e qualidade','Validação no manual e no campo']}
];
export const OPERATION_SPEEDS: Record<string,{label:string;min:number;max:number}> = {
  transporte:{label:'Transporte',min:12,max:25},preparo:{label:'Preparo do solo',min:5,max:8},
  plantio:{label:'Plantio/semeadura',min:4,max:7},cultivo:{label:'Cultivo entre linhas',min:4,max:7},
  pulverizacao:{label:'Pulverização',min:5,max:12},distribuicao:{label:'Distribuição',min:5,max:10},
  personalizada:{label:'Velocidade definida pelo operador',min:0.5,max:30}
};
export function getTractor(id:string){return TRACTORS.find(t=>t.id===id) ?? TRACTORS[0];}
