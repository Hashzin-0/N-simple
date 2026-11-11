export interface SoybeanYieldInputs {
  populationPerHa: number;
  evaluatedPlants: number;
  totalPods: number;
  totalGrains: number;
  thousandGrainWeight: number;
  lossPercent: number;
}

export interface SoybeanYieldResults {
  podsPerPlant: number;
  grainsPerPod: number;
  grossKgPerHa: number;
  grossBagsPerHa: number;
  lossKgPerHa: number;
  lossBagsPerHa: number;
  finalKgPerHa: number;
  finalBagsPerHa: number;
}

const round = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * Estima a produtividade de soja a partir da população final e da amostragem.
 * PMG deve estar em gramas por 1.000 grãos; a quebra deve estar em percentual.
 * A saca padrão considerada é de 60 kg.
 */
export function calculateSoybeanYield(inputs: SoybeanYieldInputs): SoybeanYieldResults | null {
  const {
    populationPerHa,
    evaluatedPlants,
    totalPods,
    totalGrains,
    thousandGrainWeight,
    lossPercent,
  } = inputs;

  const values = [populationPerHa, evaluatedPlants, totalPods, totalGrains, thousandGrainWeight, lossPercent];
  if (!values.every(Number.isFinite)) return null;
  if (populationPerHa <= 0 || evaluatedPlants <= 0 || totalPods <= 0 || totalGrains <= 0 || thousandGrainWeight <= 0) return null;
  if (lossPercent < 0 || lossPercent > 100) return null;

  const podsPerPlant = totalPods / evaluatedPlants;
  const grainsPerPod = totalGrains / totalPods;
  const grossKgPerHa = (populationPerHa * podsPerPlant * grainsPerPod * thousandGrainWeight) / 1_000_000;
  const grossBagsPerHa = grossKgPerHa / 60;
  const lossKgPerHa = grossKgPerHa * (lossPercent / 100);
  const lossBagsPerHa = lossKgPerHa / 60;
  const finalKgPerHa = grossKgPerHa - lossKgPerHa;
  const finalBagsPerHa = finalKgPerHa / 60;

  return {
    podsPerPlant: round(podsPerPlant, 2),
    grainsPerPod: round(grainsPerPod, 2),
    grossKgPerHa: round(grossKgPerHa, 1),
    grossBagsPerHa: round(grossBagsPerHa, 2),
    lossKgPerHa: round(lossKgPerHa, 1),
    lossBagsPerHa: round(lossBagsPerHa, 2),
    finalKgPerHa: round(finalKgPerHa, 1),
    finalBagsPerHa: round(finalBagsPerHa, 2),
  };
}
