import type { ISpatialGrid } from '../types';

/**
 * Allocation-free uniform spatial hash grid backed by flat Int32Array intrusive linked lists.
 */
export class SpatialGrid implements ISpatialGrid {
  private readonly width: number;
  private readonly height: number;
  private readonly invCellSize: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly maxEntities: number;
  private readonly cellHeads: Int32Array;
  private readonly nextEntity: Int32Array;

  constructor(width: number, height: number, cellSize = 96, maxEntities = 1024) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const safeCellSize = Math.max(1, cellSize);
    this.invCellSize = 1 / safeCellSize;
    this.cols = Math.max(1, Math.ceil(this.width / safeCellSize));
    this.rows = Math.max(1, Math.ceil(this.height / safeCellSize));
    this.maxEntities = Math.max(1, Math.floor(maxEntities));

    this.cellHeads = new Int32Array(this.cols * this.rows);
    this.cellHeads.fill(-1);
    this.nextEntity = new Int32Array(this.maxEntities);
    this.nextEntity.fill(-1);
  }

  /** Clears all grid cells in O(cells) without allocating. */
  clear(): void {
    this.cellHeads.fill(-1);
  }

  /** Inserts an entity index at clamped world coordinates (x, y). */
  insert(entityIndex: number, x: number, y: number): void {
    if (entityIndex < 0 || entityIndex >= this.maxEntities) return;

    const maxX = this.width - 1;
    const maxY = this.height - 1;
    const cx = x < 0 ? 0 : x > maxX ? maxX : x;
    const cy = y < 0 ? 0 : y > maxY ? maxY : y;

    let col = (cx * this.invCellSize) | 0;
    let row = (cy * this.invCellSize) | 0;
    if (col < 0) col = 0;
    else if (col >= this.cols) col = this.cols - 1;
    if (row < 0) row = 0;
    else if (row >= this.rows) row = this.rows - 1;

    const cellIdx = row * this.cols + col;
    this.nextEntity[entityIndex] = this.cellHeads[cellIdx];
    this.cellHeads[cellIdx] = entityIndex;
  }

  /**
   * Collects entity indices from all grid cells overlapping
   * [x - radius, x + radius] x [y - radius, y + radius] into outIndices.
   */
  queryRadius(x: number, y: number, radius: number, outIndices: Int32Array): number {
    const maxOut = outIndices.length;
    if (maxOut === 0 || radius < 0 || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(radius)) {
      return 0;
    }

    const inv = this.invCellSize;
    let minCol = Math.floor((x - radius) * inv);
    let maxCol = Math.floor((x + radius) * inv);
    let minRow = Math.floor((y - radius) * inv);
    let maxRow = Math.floor((y + radius) * inv);

    if (maxCol < 0 || minCol >= this.cols || maxRow < 0 || minRow >= this.rows) {
      return 0;
    }

    if (minCol < 0) minCol = 0;
    if (maxCol >= this.cols) maxCol = this.cols - 1;
    if (minRow < 0) minRow = 0;
    if (maxRow >= this.rows) maxRow = this.rows - 1;

    let count = 0;
    const cols = this.cols;
    const cellHeads = this.cellHeads;
    const nextEntity = this.nextEntity;

    for (let row = minRow; row <= maxRow; row++) {
      const rowOffset = row * cols;
      for (let col = minCol; col <= maxCol; col++) {
        let entity = cellHeads[rowOffset + col];
        while (entity !== -1) {
          outIndices[count++] = entity;
          if (count >= maxOut) {
            return count;
          }
          entity = nextEntity[entity];
        }
      }
    }

    return count;
  }
}
