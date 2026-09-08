export interface Preset {
  id: string;
  name: string;
  description: string;
  yieldGoal: number; // sc/ha
  nRequirementPerBag: number; // kg N/sc
  mosNContribution: number; // kg N/ha
  soyNContribution: number; // kg N/ha
  efficiency: number; // 0.80 standard
  baseDose: number; // kg N/ha in base (typically 30-40)
  baseDose2: number; // 2nd value for range (0 = single value)
  v4v6Percent: number; // default 50 or 60
  v4v6Percent2: number; // 2nd % value for range (0 = single value)
  v8v10Percent: number; // default 20 or 30
  v8v10Percent2: number; // 2nd % value for range (0 = single value)
}

export interface Calculations {
  totalExtraction: number;
  liquidNeed: number;
  recommendedDose: number;
  targetSplitTotal: number;
  base1_kg: number;
  base2_kg: number;
  v4v6_1: number;
  v4v6_2: number;
  v4v6_1_kg: number;
  v4v6_2_kg: number;
  v4v6_50: number;
  v4v6_60: number;
  v8v10_1_final: number;
  v8v10_2_final: number;
  v8v10_1_kg: number;
  v8v10_2_kg: number;
  v8v10_20: number;
  v8v10_30: number;
  v8v10_1_auto: number;
  v8v10_2_auto: number;
  sumOfSplits: number;
  sumOfSplitsRange: number;
  splitDiscrepancy: number;
  splitDifference: number;
}

export interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  formulaSummary: string;
  isDark: boolean;
  accentColor?: string;
  darkAccentColor?: string;
  variant?: 'default' | 'hero';
  saveAction?: { label: string; onClick: () => void };
  animKey?: string | number;
  children: React.ReactNode;
}

export interface AgronomicValidationIssue {
  field: string;
  label: string;
  currentValue: number | string;
  typicalRange: string;
  severity: 'warning' | 'critical';
  message: string;
  recommendedValue: number;
}
