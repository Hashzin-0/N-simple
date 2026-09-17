/**
 * Libras Feature Extraction
 * Extracts angular, extension, distance, and orientation features from hand landmarks.
 * Features are invariant to translation and scale (wrist-centered, angle-based).
 */

import type { HandLandmarks, FeatureVector, HandLabel } from './libras-types';

// MediaPipe hand landmark indices
const WRIST = 0;
const THUMB_CMC = 1;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_FINGER_MCP = 5;
const INDEX_FINGER_PIP = 6;
const INDEX_FINGER_DIP = 7;
const INDEX_FINGER_TIP = 8;
const MIDDLE_FINGER_MCP = 9;
const MIDDLE_FINGER_PIP = 10;
const MIDDLE_FINGER_DIP = 11;
const MIDDLE_FINGER_TIP = 12;
const RING_FINGER_MCP = 13;
const RING_FINGER_PIP = 14;
const RING_FINGER_DIP = 15;
const RING_FINGER_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_DIP = 19;
const PINKY_TIP = 20;

// ─── Math Helpers ───

function euclideanDistance(a: HandLandmarks, b: HandLandmarks): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function dot(a: HandLandmarks, b: HandLandmarks): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function magnitude(v: HandLandmarks): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
}

function subtract(a: HandLandmarks, b: HandLandmarks): HandLandmarks {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * Calculate angle in degrees between three points (vertex at b).
 */
function angleBetween(a: HandLandmarks, b: HandLandmarks, c: HandLandmarks): number {
  const u = subtract(a, b);
  const v = subtract(c, b);
  const dotUV = dot(u, v);
  const magU = magnitude(u);
  const magV = magnitude(v);
  if (magU === 0 || magV === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dotUV / (magU * magV)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// ─── Feature Groups ───

/**
 * Compute 20 inter-joint angles across 5 fingers.
 * Each finger contributes 3-4 angles (MCP→PIP, PIP→DIP, DIP→TIP + inter-finger).
 */
function computeInterJointAngles(norm: HandLandmarks[]): number[] {
  const angles: number[] = [];

  // Thumb: CMC→MCP, MCP→IP, IP→TIP
  angles.push(angleBetween(norm[WRIST], norm[THUMB_CMC], norm[THUMB_MCP]));
  angles.push(angleBetween(norm[THUMB_CMC], norm[THUMB_MCP], norm[THUMB_IP]));
  angles.push(angleBetween(norm[THUMB_MCP], norm[THUMB_IP], norm[THUMB_TIP]));

  // Index: MCP→PIP, PIP→DIP, DIP→TIP
  angles.push(angleBetween(norm[WRIST], norm[INDEX_FINGER_MCP], norm[INDEX_FINGER_PIP]));
  angles.push(angleBetween(norm[INDEX_FINGER_MCP], norm[INDEX_FINGER_PIP], norm[INDEX_FINGER_DIP]));
  angles.push(angleBetween(norm[INDEX_FINGER_PIP], norm[INDEX_FINGER_DIP], norm[INDEX_FINGER_TIP]));

  // Middle: MCP→PIP, PIP→DIP, DIP→TIP
  angles.push(angleBetween(norm[WRIST], norm[MIDDLE_FINGER_MCP], norm[MIDDLE_FINGER_PIP]));
  angles.push(angleBetween(norm[MIDDLE_FINGER_MCP], norm[MIDDLE_FINGER_PIP], norm[MIDDLE_FINGER_DIP]));
  angles.push(angleBetween(norm[MIDDLE_FINGER_PIP], norm[MIDDLE_FINGER_DIP], norm[MIDDLE_FINGER_TIP]));

  // Ring: MCP→PIP, PIP→DIP, DIP→TIP
  angles.push(angleBetween(norm[WRIST], norm[RING_FINGER_MCP], norm[RING_FINGER_PIP]));
  angles.push(angleBetween(norm[RING_FINGER_MCP], norm[RING_FINGER_PIP], norm[RING_FINGER_DIP]));
  angles.push(angleBetween(norm[RING_FINGER_PIP], norm[RING_FINGER_DIP], norm[RING_FINGER_TIP]));

  // Pinky: MCP→PIP, PIP→DIP, DIP→TIP
  angles.push(angleBetween(norm[WRIST], norm[PINKY_MCP], norm[PINKY_PIP]));
  angles.push(angleBetween(norm[PINKY_MCP], norm[PINKY_PIP], norm[PINKY_DIP]));
  angles.push(angleBetween(norm[PINKY_PIP], norm[PINKY_DIP], norm[PINKY_TIP]));

  // Inter-finger angles at MCP level
  angles.push(angleBetween(norm[THUMB_MCP], norm[INDEX_FINGER_MCP], norm[MIDDLE_FINGER_MCP]));
  angles.push(angleBetween(norm[INDEX_FINGER_MCP], norm[MIDDLE_FINGER_MCP], norm[RING_FINGER_MCP]));
  angles.push(angleBetween(norm[MIDDLE_FINGER_MCP], norm[RING_FINGER_MCP], norm[PINKY_MCP]));

  return angles;
}

/**
 * Compute relative extension of each finger (0 = fully curled, 1 = fully extended).
 */
function computeFingerExtensions(norm: HandLandmarks[]): number[] {
  const extensions: number[] = [];

  const maxDist = euclideanDistance(norm[WRIST], norm[MIDDLE_FINGER_MCP]);

  // Thumb extension
  const thumbDist = euclideanDistance(norm[THUMB_TIP], norm[THUMB_CMC]);
  extensions.push(maxDist > 0 ? Math.min(1, thumbDist / (maxDist * 1.5)) : 0);

  // Index extension
  const indexDist = euclideanDistance(norm[INDEX_FINGER_TIP], norm[INDEX_FINGER_MCP]);
  extensions.push(maxDist > 0 ? Math.min(1, indexDist / maxDist) : 0);

  // Middle extension
  const middleDist = euclideanDistance(norm[MIDDLE_FINGER_TIP], norm[MIDDLE_FINGER_MCP]);
  extensions.push(maxDist > 0 ? Math.min(1, middleDist / maxDist) : 0);

  // Ring extension
  const ringDist = euclideanDistance(norm[RING_FINGER_TIP], norm[RING_FINGER_MCP]);
  extensions.push(maxDist > 0 ? Math.min(1, ringDist / maxDist) : 0);

  // Pinky extension
  const pinkyDist = euclideanDistance(norm[PINKY_TIP], norm[PINKY_MCP]);
  extensions.push(maxDist > 0 ? Math.min(1, pinkyDist / maxDist) : 0);

  return extensions;
}

/**
 * Compute distances between adjacent fingertips (normalized by hand size).
 */
function computeTipDistances(norm: HandLandmarks[]): number[] {
  const maxDist = euclideanDistance(norm[WRIST], norm[MIDDLE_FINGER_MCP]);
  if (maxDist === 0) return [0, 0, 0, 0];

  return [
    euclideanDistance(norm[THUMB_TIP], norm[INDEX_FINGER_TIP]) / maxDist,
    euclideanDistance(norm[INDEX_FINGER_TIP], norm[MIDDLE_FINGER_TIP]) / maxDist,
    euclideanDistance(norm[MIDDLE_FINGER_TIP], norm[RING_FINGER_TIP]) / maxDist,
    euclideanDistance(norm[RING_FINGER_TIP], norm[PINKY_TIP]) / maxDist,
  ];
}

/**
 * Compute palm orientation angles (3 planes: XY, XZ, YZ).
 */
function computePalmOrientation(norm: HandLandmarks[]): number[] {
  // Vector from wrist to middle finger MCP
  const wristToMCP = subtract(norm[MIDDLE_FINGER_MCP], norm[WRIST]);
  // Vector from wrist to index finger MCP
  const wristToIndex = subtract(norm[INDEX_FINGER_MCP], norm[WRIST]);
  // Normal to palm plane
  const palmNormal = {
    x: wristToMCP.y * wristToIndex.z - wristToMCP.z * wristToIndex.y,
    y: wristToMCP.z * wristToIndex.x - wristToMCP.x * wristToIndex.z,
    z: wristToMCP.x * wristToIndex.y - wristToMCP.y * wristToIndex.x,
  };

  const mag = magnitude(palmNormal);
  if (mag === 0) return [0, 0, 0];

  // Normalize
  const n = { x: palmNormal.x / mag, y: palmNormal.y / mag, z: palmNormal.z / mag };

  // Angle with each axis (in degrees)
  const angleX = Math.acos(Math.min(1, Math.abs(n.x))) * (180 / Math.PI);
  const angleY = Math.acos(Math.min(1, Math.abs(n.y))) * (180 / Math.PI);
  const angleZ = Math.acos(Math.min(1, Math.abs(n.z))) * (180 / Math.PI);

  return [angleX, angleY, angleZ];
}

// ─── Main Feature Extraction ───

/**
 * Extract feature vector from hand landmarks.
 * Returns ~30 features: angles(20) + extensions(5) + tipDistances(4) + palmOrientation(3) + handCount(1)
 */
export function extractSingleHandFeatures(landmarks: HandLandmarks[]): number[] {
  if (!landmarks || landmarks.length !== 21) {
    return new Array(33).fill(0);
  }

  // Wrist-center normalization
  const wrist = landmarks[WRIST];
  const norm = landmarks.map((l) => ({
    x: l.x - wrist.x,
    y: l.y - wrist.y,
    z: l.z - wrist.z,
  }));

  const angles = computeInterJointAngles(norm);
  const extensions = computeFingerExtensions(norm);
  const tipDistances = computeTipDistances(norm);
  const palmOrientation = computePalmOrientation(norm);

  return [...angles, ...extensions, ...tipDistances, ...palmOrientation];
}

/**
 * Extract features from one or two hands.
 * If only one hand, pads the other with zeros.
 * Adds handCount as final feature.
 */
export function extractFeatures(
  leftLandmarks: HandLandmarks[] | null,
  rightLandmarks: HandLandmarks[] | null
): FeatureVector {
  const leftFeatures = leftLandmarks ? extractSingleHandFeatures(leftLandmarks) : new Array(32).fill(0);
  const rightFeatures = rightLandmarks ? extractSingleHandFeatures(rightLandmarks) : new Array(32).fill(0);

  const handedness: HandLabel = leftLandmarks && rightLandmarks
    ? 'both'
    : leftLandmarks
    ? 'left'
    : rightLandmarks
    ? 'right'
    : 'unknown';

  const handCount = (leftLandmarks ? 1 : 0) + (rightLandmarks ? 1 : 0);

  return {
    angles: [...leftFeatures.slice(0, 20), ...rightFeatures.slice(0, 20)],
    extensions: [...leftFeatures.slice(20, 25), ...rightFeatures.slice(20, 25)],
    tipDistances: [...leftFeatures.slice(25, 29), ...rightFeatures.slice(25, 29)],
    palmOrientation: [...leftFeatures.slice(29, 32), ...rightFeatures.slice(29, 32)],
    handedness,
    handCount,
  };
}

/**
 * Flatten feature vector into a single number array for DTW.
 */
export function flattenFeatures(fv: FeatureVector): number[] {
  return [
    ...fv.angles,
    ...fv.extensions,
    ...fv.tipDistances,
    ...fv.palmOrientation,
    fv.handCount,
    fv.handedness === 'left' ? 1 : 0,
    fv.handedness === 'right' ? 1 : 0,
  ];
}

/**
 * Euclidean distance between two flat feature vectors.
 */
export function featureDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}
