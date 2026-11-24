import type { IRng } from '../types';

/**
 * Deterministic 32-bit mulberry32 PRNG implementing IRng.
 */
export class SeededRNG implements IRng {
  readonly seed: number;
  private state: number;

  constructor(seed?: number) {
    const raw =
      seed !== undefined
        ? seed >>> 0
        : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    const normalized = raw === 0 ? 0x6d2b79f5 : raw;
    this.seed = normalized;
    this.state = normalized | 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Returns an integer in [min, maxInclusive]. */
  int(min: number, maxInclusive: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(maxInclusive);
    if (hi <= lo) return lo;
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** Returns true with the given probability in [0, 1]. */
  chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  /** Picks a uniformly random element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRNG.pick: cannot pick from an empty array');
    }
    return items[Math.floor(this.next() * items.length)];
  }

  /** Shuffles an array in-place using Fisher-Yates and returns it. */
  shuffleInPlace<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }
}
