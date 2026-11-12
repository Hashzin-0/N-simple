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
    id:'john-deere-5078e', brand:'John Deere', model:'5078E (9x3 TSS)', label:'John Deere 5078E cabinado', powerCv:78, nominalRpm:2400, massKg:4140, traction:'4x2/TDA',
    gears:[gear('A1',2.19),gear('A2',3.04),gear('A3',4.23),gear('B1',5.1),gear('B2',7.41),gear('B3',10.15),gear('C1',14.16),gear('C2',20.15),gear('C3',27.48),gear('R1',2.93),gear('R2',7.06),gear('R3',19.44)],
    source:'https://www.deere.com.br/pt/tratores/s%C3%A9rie-5e-pequenos/5078e-cabinado-70cv/',
    sourceLabel:'John Deere 5078E — ficha oficial + velocidades da transmissão sincronizada 9F/3R do manual do operador',
    notes:'78 cv e 2400 rpm conforme ficha oficial da Série 5E. Velocidades A1–C3/R1–R3 referem-se à transmissão sincronizada 9F/3R e pneu 16.9-30 R1 do manual 5075E/5078E/5085E; não aplicar à opção PowrReverser 12x12 nem a outra configuração de pneus.'
  },
  {
    id:'new-holland-7630', brand:'New Holland', model:'7630 MAR-I', label:'New Holland 7630 MAR-I', powerCv:110, nominalRpm:2200, massKg:3886, traction:'4x4',
    gears:[gear('L1',4),gear('L2',5),gear('L3',6),gear('L4',7),gear('H1',8),gear('H2',9.5),gear('H3',10.8),gear('H4',12)],
    source:'https://assets.cnhindustrial.com/nhag/lar/pt-br/Documents/B3-0108-18%20FOLHETERIA%20TRATOR_30-v2%20-%20Em%20Baixa%20%281%29.pdf',
    sourceLabel:'New Holland, Série 30 7630/8030 MAR-I + SENAR-PR Quadro 3',
    notes:'A ficha oficial informa transmissão 16x4 e oito velocidades de trabalho entre 4 e 12 km/h. Os valores individuais são uma representação operacional do diagrama.'
  },
  {
    id:'massey-ferguson-275', brand:'Massey Ferguson', model:'MF 275', label:'Massey Ferguson MF 275 4×4',
    powerCv:75, nominalRpm:2200, massKg:4050, traction:'4x4',
    gears:[
      gear('1ª',2.3),gear('2ª',3.4),gear('3ª',6.2),gear('4ª',7.6),
      gear('5ª',9.2),gear('6ª',13.5),gear('7ª',24.8),gear('8ª',30.4),
      gear('R1',3.1),gear('R2',12.6)
    ],
    source:'https://www.masseyferguson.com/',
    sourceLabel:'Ficha técnica MF 275 FOPMF275 (maio/2007), fornecida como referência',
    notes:'Tabela deslizante 8x2 a 2.200 rpm com pneu traseiro 18.4-30 R1. Massa de 4.050 kg corresponde ao peso máximo com lastro indicado para a versão 4x4; confirme a configuração real.'
  }
];
export function getTractor(id:string){return TRACTORS.find(t=>t.id===id) ?? TRACTORS[0];}
