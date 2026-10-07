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
export function getTractor(id:string){return TRACTORS.find(t=>t.id===id) ?? TRACTORS[0];}
