/**
 * Dynamic Time Warping (DTW) for Libras gesture recognition.
 * O(n*m) implementation with Sakoe-Chiba band constraint.
 */

import type { DTWResult } from './libras-types';

/**
 * Compute DTW distance between two sequences.
 * Uses Sakoe-Chiba band to limit the warping path.
 */
export function dtwDistance(
  seqA: number[][],
  seqB: number[][],
  bandWidthPercent: number = 0.15
): DTWResult {
  const T1 = seqA.length;
  const T2 = seqB.length;

  if (T1 === 0 || T2 === 0) {
    return { distance: Infinity, path: [], normalizedDistance: Infinity };
  }

  const F = seqA[0].length;
  const bandWidth = Math.floor(bandWidthPercent * Math.max(T1, T2));

  // Initialize cost matrix
  const INF = Infinity;
  const cost: number[][] = Array.from({ length: T1 + 1 }, () => Array(T2 + 1).fill(INF));
  cost[0][0] = 0;

  // Fill cost matrix
  for (let i = 1; i <= T1; i++) {
    // Sakoe-Chiba band constraint
    const jMin = Math.max(1, Math.floor((i / T1) * T2) - bandWidth);
    const jMax = Math.min(T2, Math.floor((i / T1) * T2) + bandWidth);

    for (let j = jMin; j <= jMax; j++) {
      // Euclidean distance between frames
      let d = 0;
      for (let k = 0; k < F; k++) {
        d += (seqA[i - 1][k] - seqB[j - 1][k]) ** 2;
      }
      d = Math.sqrt(d);

      cost[i][j] = d + Math.min(cost[i - 1][j], cost[i][j - 1], cost[i - 1][j - 1]);
    }
  }

  // Backtrack to find path
  const path: [number, number][] = [];
  let i = T1;
  let j = T2;

  while (i > 0 || j > 0) {
    path.push([i - 1, j - 1]);

    if (i === 0) {
      j--;
    } else if (j === 0) {
      i--;
    } else {
      const candidates = [
        { val: cost[i - 1][j - 1], move: [-1, -1] as [number, number] },
        { val: cost[i - 1][j], move: [-1, 0] as [number, number] },
        { val: cost[i][j - 1], move: [0, -1] as [number, number] },
      ];
      candidates.sort((a, b) => a.val - b.val);
      const best = candidates[0];
      i += best.move[0];
      j += best.move[1];
    }
  }

  path.reverse();

  const distance = cost[T1][T2];
  const normalizedDistance = path.length > 0 ? distance / path.length : Infinity;

  return { distance, path, normalizedDistance };
}

/**
 * Compare student sequence against ALL examples of a template.
 * Returns the best match (lowest distance).
 */
export function compareWithTemplate(
  studentSequence: number[][],
  templateExamples: number[][][]
): { bestDistance: number; bestExampleIndex: number; allDistances: number[] } {
  if (templateExamples.length === 0) {
    return { bestDistance: Infinity, bestExampleIndex: -1, allDistances: [] };
  }

  const allDistances = templateExamples.map((ex) =>
    dtwDistance(studentSequence, ex).normalizedDistance
  );

  const bestIndex = allDistances.indexOf(Math.min(...allDistances));

  return {
    bestDistance: allDistances[bestIndex],
    bestExampleIndex: bestIndex,
    allDistances,
  };
}
