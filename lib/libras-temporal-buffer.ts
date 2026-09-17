/**
 * Libras Temporal Buffer
 * Sliding window buffer for gesture sequences with automatic start/end detection.
 */

import type { TemporalBufferConfig, GestureState } from './libras-types';

const DEFAULT_CONFIG: TemporalBufferConfig = {
  minFrames: 10,
  maxFrames: 60,
  motionThreshold: 0.005,
  stabilityFrames: 5,
};

export class TemporalBuffer {
  private frames: number[][] = [];
  private config: TemporalBufferConfig;

  constructor(config?: Partial<TemporalBufferConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  pushFrame(features: number[]): void {
    this.frames.push(features);
    if (this.frames.length > this.config.maxFrames) {
      this.frames.shift();
    }
  }

  isReady(): boolean {
    return this.frames.length >= this.config.minFrames;
  }

  getFrameCount(): number {
    return this.frames.length;
  }

  /**
   * Detect if motion has started by comparing recent frames with earlier ones.
   */
  hasMotionStarted(): boolean {
    if (this.frames.length < 6) return false;

    const recent = this.frames.slice(-3);
    const earlier = this.frames.slice(-6, -3);

    const avgRecent = recent.reduce((a, b) => a.map((v, i) => v + b[i]), new Array(recent[0].length).fill(0)).map((v) => v / recent.length);
    const avgEarlier = earlier.reduce((a, b) => a.map((v, i) => v + b[i]), new Array(earlier[0].length).fill(0)).map((v) => v / earlier.length);

    let totalDiff = 0;
    for (let i = 0; i < avgRecent.length; i++) {
      totalDiff += Math.abs(avgRecent[i] - avgEarlier[i]);
    }

    return totalDiff > this.config.motionThreshold * avgRecent.length;
  }

  /**
   * Detect if motion has ended by checking stability over recent frames.
   */
  hasMotionEnded(): boolean {
    if (this.frames.length < this.config.stabilityFrames + 3) return false;

    const recent = this.frames.slice(-this.config.stabilityFrames);

    // Calculate variance between consecutive frames
    let totalVariance = 0;
    for (let i = 1; i < recent.length; i++) {
      for (let j = 0; j < recent[i].length; j++) {
        totalVariance += Math.abs(recent[i][j] - recent[i - 1][j]);
      }
    }

    const avgVariance = totalVariance / ((recent.length - 1) * (recent[0]?.length || 1));

    // Stable if variance is very low
    return avgVariance < this.config.motionThreshold * 0.5;
  }

  /**
   * Get the active gesture state based on buffer contents.
   */
  getGestureState(): GestureState {
    if (this.frames.length < this.config.minFrames) return 'waiting';
    if (!this.hasMotionStarted()) return 'waiting';
    if (this.hasMotionEnded()) return 'done';
    return 'active';
  }

  /**
   * Get the active sequence (frames where motion was detected).
   * Falls back to all frames if motion detection hasn't triggered.
   */
  getActiveSequence(): number[][] {
    if (this.frames.length === 0) return [];

    // Simple approach: return the most recent portion of the buffer
    // that has enough frames for DTW comparison
    const state = this.getGestureState();

    if (state === 'done') {
      // Return all frames as the gesture is complete
      return [...this.frames];
    }

    if (state === 'active') {
      // Return frames from the start of motion
      // Heuristic: start from 3 frames before current to capture initial pose
      const startIdx = Math.max(0, this.frames.length - 10);
      return this.frames.slice(startIdx);
    }

    // waiting: return what we have
    return [...this.frames];
  }

  /**
   * Get the full buffer contents.
   */
  getAllFrames(): number[][] {
    return [...this.frames];
  }

  /**
   * Get the last N frames.
   */
  getRecentFrames(n: number): number[][] {
    return this.frames.slice(-n);
  }

  /**
   * Get the motion magnitude (total variation across the sequence).
   */
  getMotionMagnitude(): number {
    if (this.frames.length < 2) return 0;

    let totalMotion = 0;
    for (let i = 1; i < this.frames.length; i++) {
      for (let j = 0; j < this.frames[i].length; j++) {
        totalMotion += Math.abs(this.frames[i][j] - this.frames[i - 1][j]);
      }
    }

    return totalMotion / (this.frames.length - 1);
  }

  clear(): void {
    this.frames = [];
  }
}
