import type { IPool, Poolable } from '../types';

/**
 * Fixed-capacity, allocation-free object pool with O(1) acquire and swap-remove release.
 */
export class ObjectPool<T extends Poolable> implements IPool<T> {
  readonly items: readonly T[];
  readonly activeIndices: number[];

  private readonly capacity: number;
  private readonly resetItem: (item: T) => void;
  private readonly indexInActive: Int32Array;
  private readonly freeStack: Int32Array;
  private freeTop: number;
  private _activeCount = 0;

  constructor(
    capacity: number,
    factory: (poolIndex: number) => T,
    reset: (item: T) => void
  ) {
    const cap = Math.max(0, Math.floor(capacity));
    this.capacity = cap;
    this.resetItem = reset;

    const items = new Array<T>(cap);
    const activeIndices = new Array<number>(cap);
    const indexInActive = new Int32Array(cap);
    indexInActive.fill(-1);
    const freeStack = new Int32Array(cap);

    for (let i = 0; i < cap; i++) {
      const item = factory(i);
      item.active = false;
      item.poolIndex = i;
      items[i] = item;
      activeIndices[i] = 0;
      freeStack[i] = cap - 1 - i;
    }
    // Keep pre-allocated backing store while exposing length 0.
    activeIndices.length = 0;

    this.items = items;
    this.activeIndices = activeIndices;
    this.indexInActive = indexInActive;
    this.freeStack = freeStack;
    this.freeTop = cap;
  }

  get activeCount(): number {
    return this._activeCount;
  }

  /** Acquires an inactive item from the pool, or returns null if at capacity. */
  acquire(): T | null {
    if (this._activeCount >= this.capacity) {
      return null;
    }

    const poolIndex = this.freeStack[--this.freeTop];
    const item = this.items[poolIndex];
    this.resetItem(item);
    item.active = true;
    item.poolIndex = poolIndex;

    const slot = this._activeCount;
    this.activeIndices[slot] = poolIndex;
    this.indexInActive[poolIndex] = slot;
    this._activeCount = slot + 1;

    return item;
  }

  /** Releases an active item back to the pool in O(1) time. */
  release(item: T): void {
    if (!item.active) return;
    const poolIndex = item.poolIndex;
    if (poolIndex < 0 || poolIndex >= this.capacity || this.items[poolIndex] !== item) {
      return;
    }
    this.releaseByIndex(poolIndex);
  }

  /** Releases an active item by its poolIndex in O(1) time via swap-remove. */
  releaseByIndex(poolIndex: number): void {
    if (poolIndex < 0 || poolIndex >= this.capacity) return;
    const item = this.items[poolIndex];
    if (!item.active) return;

    const slot = this.indexInActive[poolIndex];
    const lastSlot = this._activeCount - 1;
    if (slot !== lastSlot) {
      const movedIndex = this.activeIndices[lastSlot];
      this.activeIndices[slot] = movedIndex;
      this.indexInActive[movedIndex] = slot;
    }

    this.activeIndices.length = lastSlot;
    this._activeCount = lastSlot;
    this.indexInActive[poolIndex] = -1;
    this.freeStack[this.freeTop++] = poolIndex;

    this.resetItem(item);
    item.active = false;
    item.poolIndex = poolIndex;
  }

  /** Resets all currently active items and empties the active list. */
  clear(): void {
    const count = this._activeCount;
    for (let i = 0; i < count; i++) {
      const poolIndex = this.activeIndices[i];
      const item = this.items[poolIndex];
      this.resetItem(item);
      item.active = false;
      item.poolIndex = poolIndex;
      this.indexInActive[poolIndex] = -1;
      this.freeStack[this.freeTop++] = poolIndex;
    }
    this._activeCount = 0;
    this.activeIndices.length = 0;
  }
}
