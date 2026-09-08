import { Calculations } from './types';

export function computeCalculations(inputs: {
  yieldGoal: number;
  nRequirementPerBag: number;
  mosNContribution: number;
  soyNContribution: number;
  efficiency: number;
  baseDose: number;
  baseDose2: number;
  baseDoseMode: 'single' | 'range';
  v4v6Percent: number;
  v4v6Percent2: number;
  v8v10Percent: number;
  v8v10Percent2: number;
  splitBase: 'dose_perdas' | 'necessidade_liquida';
}): Calculations {
  const {
    yieldGoal,
    nRequirementPerBag,
    mosNContribution,
    soyNContribution,
    efficiency,
    baseDose,
    baseDose2,
    baseDoseMode,
    v4v6Percent,
    v4v6Percent2,
    v8v10Percent,
    v8v10Percent2,
    splitBase,
  } = inputs;

  const totalExtraction = Number((yieldGoal * nRequirementPerBag).toFixed(2));
  const liquidNeed = Number((totalExtraction - mosNContribution - soyNContribution).toFixed(2));

  const effDecimal = efficiency / 100;
  const recommendedDose = Number((liquidNeed / effDecimal).toFixed(2));

  const targetSplitTotal = splitBase === 'dose_perdas' ? recommendedDose : liquidNeed;

  const base1 = baseDose;
  const base2 = baseDoseMode === 'range' ? baseDose2 : 0;
  const base1_kg = base1;
  const base2_kg = base2;

  const v4v6_1 = v4v6Percent;
  const v4v6_2 = baseDoseMode === 'range' ? v4v6Percent2 : 0;
  const v4v6_1_kg = Number((targetSplitTotal * (v4v6_1 / 100)).toFixed(2));
  const v4v6_2_kg = v4v6_2 > 0 ? Number((targetSplitTotal * (v4v6_2 / 100)).toFixed(2)) : 0;

  const v8v10_1 = v8v10Percent;
  const v8v10_2 = baseDoseMode === 'range' ? v8v10Percent2 : 0;

  const v8v10_1_kg_direct = Number(Math.max(0, targetSplitTotal - base1_kg - v4v6_1_kg).toFixed(2));
  const v8v10_2_kg_direct = (v8v10_2 > 0 && v4v6_2 > 0)
    ? Number(Math.max(0, targetSplitTotal - base2_kg - v4v6_2_kg).toFixed(2))
    : 0;

  const v8v10_1_auto = targetSplitTotal > 0
    ? Number(((v8v10_1_kg_direct / targetSplitTotal) * 100).toFixed(1))
    : 0;
  const v8v10_2_auto = (v8v10_2 > 0 && v4v6_2 > 0 && targetSplitTotal > 0)
    ? Number(((v8v10_2_kg_direct / targetSplitTotal) * 100).toFixed(1))
    : 0;

  const v8v10_1_final = v8v10_1 > 0 ? v8v10_1 : v8v10_1_auto;
  const v8v10_2_final = v8v10_2 > 0 ? v8v10_2 : v8v10_2_auto;

  const v8v10_1_kg = v8v10_1 > 0
    ? Number((targetSplitTotal * (v8v10_1_final / 100)).toFixed(2))
    : v8v10_1_kg_direct;
  const v8v10_2_kg = v8v10_2 > 0
    ? Number((targetSplitTotal * (v8v10_2_final / 100)).toFixed(2))
    : v8v10_2_kg_direct;

  const v4v6_50 = Number((targetSplitTotal * 0.50).toFixed(2));
  const v4v6_60 = Number((targetSplitTotal * 0.60).toFixed(2));
  const v8v10_20 = Number((targetSplitTotal * 0.20).toFixed(2));
  const v8v10_30 = Number((targetSplitTotal * 0.30).toFixed(2));

  const sumOfSplits = Number((base1_kg + v4v6_1_kg + v8v10_1_kg).toFixed(2));

  const sumOfSplitsRange = (baseDoseMode === 'range' && base2_kg > 0)
    ? Number((base2_kg + v4v6_2_kg + v8v10_2_kg).toFixed(2))
    : 0;

  const splitDiscrepancy = Number((sumOfSplits - targetSplitTotal).toFixed(2));
  const splitDifference = Number(Math.abs(v4v6_1_kg - v8v10_1_kg).toFixed(2));

  return {
    totalExtraction,
    liquidNeed,
    recommendedDose,
    targetSplitTotal,
    base1_kg,
    base2_kg,
    v4v6_1,
    v4v6_2,
    v4v6_1_kg,
    v4v6_2_kg,
    v4v6_50,
    v4v6_60,
    v8v10_1_final,
    v8v10_2_final,
    v8v10_1_kg,
    v8v10_2_kg,
    v8v10_20,
    v8v10_30,
    v8v10_1_auto,
    v8v10_2_auto,
    sumOfSplits,
    sumOfSplitsRange,
    splitDiscrepancy,
    splitDifference,
  };
}
