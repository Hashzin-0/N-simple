export type TractorTechnicalField = { label: string; value: string };
export type TractorTechnicalProfile = {
  tractorId: string;
  manufacturer: string;
  model: string;
  document: string;
  documentDate?: string;
  sourceUrl: string;
  sourceKind: 'manufacturer' | 'uploaded-reference' | 'technical-training';
  disclaimer: string;
  sections: { title: string; fields: TractorTechnicalField[] }[];
  speedTable?: {
    transmission: string;
    engineRpm: number;
    rearTyre: string;
    forward: { gear: string; speedKmh: number }[];
    reverse: { gear: string; speedKmh: number }[];
  };
};

export const TRACTOR_TECHNICAL_PROFILES: TractorTechnicalProfile[] = [
  {
    tractorId: 'massey-ferguson-275',
    manufacturer: 'Massey Ferguson',
    model: 'MF 275 — versões 4x2 e 4x4',
    document: 'Ficha técnica MF 275 — FOPMF275',
    documentDate: 'Maio de 2007',
    sourceKind: 'uploaded-reference',
    sourceUrl: 'https://www.masseyferguson.com/',
    disclaimer: 'Dados transcritos da ficha técnica de referência fornecida nesta conversa. A própria publicação alerta que especificações podem mudar e devem ser confirmadas com a concessionária. As velocidades referem-se exclusivamente à transmissão deslizante 8x2, motor a 2.200 rpm e pneu traseiro 18.4-30 R1.',
    sections: [
      { title: 'Motor e desempenho', fields: [
        { label: 'Modelo / fabricante', value: 'A4-4.1 / MWM International' },
        { label: 'Cilindros', value: '4' },
        { label: 'Cilindrada', value: '4.100 cm³' },
        { label: 'Aspiração', value: 'Natural' },
        { label: 'Potência nominal', value: '56 kW (75 cv)' },
        { label: 'Rotação nominal', value: '2.200 rpm' },
        { label: 'Torque máximo', value: '289 Nm a 1.400 rpm' },
        { label: 'Potência máxima na TDP', value: '49,3 kW (67 cv)' }
      ]},
      { title: 'Transmissão e tomada de potência', fields: [
        { label: 'Transmissão básica — plataformado', value: '8x2 deslizante' },
        { label: 'Opções informadas', value: '12x4 C.M. ou sincronizada / 8x8 sincronizada' },
        { label: 'Cabinado — básico', value: '12x4 sincronizada' },
        { label: 'TDP', value: '540 rpm ou 540/1.000 rpm (conforme configuração)' },
        { label: 'Rotação do motor indicada para TDP', value: '1.900 rpm' }
      ]},
      { title: 'Sistema hidráulico e controle remoto', fields: [
        { label: 'Capacidade de levante na rótula', value: '2.500 kgf (opção: 2.100 kgf)' },
        { label: 'Vazão hidráulica máxima', value: '17 ou 27 L/min' },
        { label: 'Pressão máxima', value: '210 bar (214 kgf/cm²)' },
        { label: 'Categoria do engate', value: 'II' },
        { label: 'Controle remoto', value: 'Independente; 2 ou 3 válvulas conforme configuração' }
      ]},
      { title: 'Capacidades, rodagem e dimensões', fields: [
        { label: 'Tanque de combustível', value: '75 L (opcional: 100 L)' },
        { label: 'Cárter do motor', value: '8 L' },
        { label: 'Transmissão / hidráulico', value: '38 / 42 L' },
        { label: 'Pneus traseiros associados à tabela', value: '18.4-30 R1' },
        { label: 'Peso máximo com lastro', value: '3.750 kg (4x2) / 4.050 kg (4x4)' },
        { label: 'Comprimento total', value: '3.975 mm (4x2) / 4.170 mm (4x4)' },
        { label: 'Entre-eixos', value: '2.135 mm (4x2) / 2.370 mm (4x4)' }
      ]}
    ],
    speedTable: {
      transmission: 'Deslizante — 8 marchas à frente e 2 à ré',
      engineRpm: 2200,
      rearTyre: '18.4-30 R1',
      forward: [
        { gear: '1ª', speedKmh: 2.3 }, { gear: '2ª', speedKmh: 3.4 },
        { gear: '3ª', speedKmh: 6.2 }, { gear: '4ª', speedKmh: 7.6 },
        { gear: '5ª', speedKmh: 9.2 }, { gear: '6ª', speedKmh: 13.5 },
        { gear: '7ª', speedKmh: 24.8 }, { gear: '8ª', speedKmh: 30.4 }
      ],
      reverse: [
        { gear: 'Ré 1', speedKmh: 3.1 }, { gear: 'Ré 2', speedKmh: 12.6 }
      ]
    }
  }
];

export function getTechnicalProfile(tractorId: string) {
  return TRACTOR_TECHNICAL_PROFILES.find(profile => profile.tractorId === tractorId);
}
