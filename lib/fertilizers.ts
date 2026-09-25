export interface PresetFertilizer {
  id: string;
  name: string;
  teorN: number; // percentage
}

export const PRESET_FERTILIZERS: PresetFertilizer[] = [
  { id: 'ureia', name: 'Ureia', teorN: 45 },
  { id: 'ureia_abpt', name: 'Ureia + ABPT', teorN: 41 },
  { id: 'sulfato_amonio', name: 'Sulfato de Amônio', teorN: 21 },
  { id: 'cloreto_amonio', name: 'Cloreto de Amônio', teorN: 26 },
  { id: 'nitrato_amonio', name: 'Nitrato de Amônio', teorN: 34 },
  { id: 'custom', name: 'Personalizado', teorN: 0 },
];

/** Resolve um nome/id falado ("ureia", "sulfato de amônio") para o id do preset. */
export function resolveFertilizerId(input: string): string | null {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const target = norm(input);
  if (!target) return null;
  const match = PRESET_FERTILIZERS.find(
    (f) => norm(f.id) === target || norm(f.name) === target
  );
  return match ? match.id : null;
}
