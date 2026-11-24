import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  EliteAffix,
  EnemyDef,
  EnemyEntity,
  EnemyTypeId,
  IAudio,
  IParticleSystem,
  IPool,
  IRng,
  ISpatialGrid,
  PlayerState,
  ProjectileEntity,
  WaveConfig,
} from '../types';

export interface EnemyUpdateContext {
  player: PlayerState;
  enemies: IPool<EnemyEntity>;
  projectiles: IPool<ProjectileEntity>;
  grid: ISpatialGrid;
  wave: WaveConfig;
  rng: IRng;
  audio: IAudio;
  particles: IParticleSystem;
  damagePlayer: (amount: number, sourceX: number, sourceY: number) => void;
}

const ELITE_AFFIXES: readonly EliteAffix[] = ['hasted', 'twin_shot', 'bulwark'];
const ENEMY_ORB_SPEED = 235;
const ENEMY_ORB_RADIUS = 7;
const ENEMY_ORB_COLOR = '#EC4899';
const ENEMY_ORB_LIFE = 3.8;

const DAMPENER_AURA_RADIUS = 145;
const DAMPENER_AURA_RADIUS_SQ = DAMPENER_AURA_RADIUS * DAMPENER_AURA_RADIUS;

const SPAWN_MARGIN = 36;
const SPAWN_MIN_PLAYER_DIST = 240;
const SPAWN_MIN_DIST = 360;
const SPAWN_MAX_DIST = 480;

const MONOLITH_LASER_LENGTH = 680;
const MONOLITH_LASER_HALF_WIDTH = 9;
const MONOLITH_LASER_SWEEP_SPEED = 0.45;
const MONOLITH_MAX_DAMPENERS = 3;

const WOLF_SLAM_AOE_RADIUS = 110;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.0001) {
    const dx = px - ax;
    const dy = py - ay;
    return dx * dx + dy * dy;
  }
  const apx = px - ax;
  const apy = py - ay;
  const t = clamp((apx * abx + apy * aby) / lenSq, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

/**
 * Manages wave pacing, Detuned Elites, 6 enemy faction AIs, soft crowd separation,
 * Null Dampener auras, and both multi-phase Boss encounters.
 */
export class EnemySystem {
  private readonly enemyDefs: Record<EnemyTypeId, EnemyDef>;
  private readonly neighborBuf = new Int32Array(64);

  // Pre-allocated weighted-pick table populated once per wave in resetForWave
  private readonly waveTypes: EnemyTypeId[] = [];
  private readonly waveCumWeights: number[] = [];
  private waveTypeCount = 0;
  private waveTotalWeight = 0;

  // Wave pacing state
  private waveElapsed = 0;
  private spawnedCount = 0;
  private spawnAccumulator = 0;
  private bossSpawned = false;
  private openingClusterCount = 5;

  // Scratch coordinates for zero-allocation spawn positioning
  private tmpSpawnX = 0;
  private tmpSpawnY = 0;

  constructor(enemyDefs: Record<EnemyTypeId, EnemyDef>) {
    this.enemyDefs = enemyDefs;
  }

  resetForWave(wave: WaveConfig): void {
    this.waveElapsed = 0;
    this.spawnedCount = 0;
    // Slight initial charge so the opening cluster begins immediately at wave start
    this.spawnAccumulator = 1.0;
    this.bossSpawned = false;
    this.openingClusterCount = 4 + (wave.wave % 3); // 4..6 enemies

    this.waveTypeCount = 0;
    this.waveTotalWeight = 0;
    const weights = wave.weights;
    for (const key in weights) {
      const typeId = key as EnemyTypeId;
      const w = weights[typeId];
      if (w !== undefined && w > 0) {
        this.waveTotalWeight += w;
        this.waveTypes[this.waveTypeCount] = typeId;
        this.waveCumWeights[this.waveTypeCount] = this.waveTotalWeight;
        this.waveTypeCount++;
      }
    }
  }

  spawnEnemy(
    type: EnemyTypeId,
    x: number,
    y: number,
    wave: WaveConfig,
    enemies: IPool<EnemyEntity>,
    rng: IRng,
    forceElite?: boolean
  ): EnemyEntity | null {
    const enemy = enemies.acquire();
    if (!enemy) {
      return null;
    }

    const def = this.enemyDefs[type];
    let maxHp = def.baseHp * wave.hpMult;
    let speed = def.baseSpeed * wave.speedMult;
    let damage = def.baseDamage * wave.damageMult;
    let radius = def.radius;
    let xpValue = def.xpValue;
    let brassChance = def.brassChance;
    let knockbackResist = def.knockbackResist;

    // Acoustic Modifiers
    if (wave.modifier === 'doppler_surge') {
      speed *= 1.2;
    } else if (wave.modifier === 'sub_harmonic_armor') {
      maxHp *= 1.25;
    } else if (wave.modifier === 'blood_octave') {
      damage *= 1.25;
    }

    // Detuned Elites (non-bosses, excluding micro_tick)
    let isElite = false;
    let affix: EliteAffix = 'none';
    const canBeElite = !def.isBoss && type !== 'micro_tick';
    if (canBeElite && (forceElite === true || rng.chance(wave.eliteChance))) {
      isElite = true;
      radius *= 1.28;
      maxHp *= 4.0;
      damage *= 1.35;
      xpValue = Math.round(xpValue * 4);
      brassChance = 1.0;

      affix = rng.pick(ELITE_AFFIXES);
      if (affix === 'hasted') {
        speed *= 1.35;
      } else if (affix === 'bulwark') {
        maxHp *= 1.5;
        knockbackResist = Math.min(0.9, knockbackResist + 0.3);
      }
    }

    enemy.type = type;
    enemy.isBoss = def.isBoss;
    enemy.isElite = isElite;
    enemy.affix = affix;
    enemy.x = clamp(x, radius, ARENA_WIDTH - radius);
    enemy.y = clamp(y, radius, ARENA_HEIGHT - radius);
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.radius = radius;
    enemy.hp = maxHp;
    enemy.maxHp = maxHp;
    enemy.speed = speed;
    enemy.damage = damage;
    enemy.xpValue = xpValue;
    enemy.brassChance = brassChance;
    enemy.knockbackResist = knockbackResist;
    enemy.color = def.color;
    enemy.accentColor = def.accentColor;

    enemy.hitFlash = 0;
    enemy.dampened = false;
    enemy.aiPhase = 0;
    enemy.dashVx = 0;
    enemy.dashVy = 0;
    enemy.dashTimer = 0;
    enemy.telegraphTimer = 0;
    enemy.telegraphDuration = 0;
    enemy.telegraphX = enemy.x;
    enemy.telegraphY = enemy.y;
    enemy.telegraphAngle = 0;
    enemy.telegraphKind = 'none';
    enemy.laserActiveTimer = 0;
    enemy.armorAngle = 0;
    enemy.stunTimer = 0;

    if (def.isBoss) {
      enemy.aiTimer = 1.8;
      enemy.fireTimer = 0;
    } else if (type === 'phase_skitter') {
      enemy.aiTimer = rng.range(0.5, 1.3);
      enemy.fireTimer = 0;
    } else {
      enemy.aiTimer = 0;
      if (type === 'siren_node' || affix === 'twin_shot') {
        const interval = def.fireInterval ?? 2.5;
        enemy.fireTimer = rng.range(0.7, interval);
      } else {
        enemy.fireTimer = 0;
      }
    }

    return enemy;
  }

  /**
   * Handles death-split behavior (e.g. Splitter Chord fracturing into 2 Micro-Ticks).
   */
  onEnemyDeath(
    enemy: EnemyEntity,
    wave: WaveConfig,
    enemies: IPool<EnemyEntity>,
    rng: IRng
  ): void {
    if (enemy.type !== 'splitter_chord') {
      return;
    }
    const baseAngle = rng.range(0, Math.PI * 2);
    for (let i = 0; i < 2; i++) {
      const a = baseAngle + i * Math.PI;
      const offset = 16;
      const child = this.spawnEnemy(
        'micro_tick',
        enemy.x + Math.cos(a) * offset,
        enemy.y + Math.sin(a) * offset,
        wave,
        enemies,
        rng,
        false
      );
      if (child) {
        child.vx = Math.cos(a) * 145;
        child.vy = Math.sin(a) * 145;
      }
    }
  }

  update(
    dt: number,
    ctx: EnemyUpdateContext
  ): {
    waveCleared: boolean;
    activeBoss: EnemyEntity | null;
  } {
    this.waveElapsed += dt;

    // 1. Wave Spawning & Boss Entrance
    this.updateSpawning(dt, ctx);

    const { enemies, grid } = ctx;
    const activeIndices = enemies.activeIndices;
    const activeCount = enemies.activeCount;
    const items = enemies.items;

    // 2. Null Dampener Aura Pass: reset all, then mark allies within 145px of any null_dampener
    for (let i = 0; i < activeCount; i++) {
      items[activeIndices[i]].dampened = false;
    }
    for (let i = 0; i < activeCount; i++) {
      const dampener = items[activeIndices[i]];
      if (dampener.type !== 'null_dampener') {
        continue;
      }
      const nCount = grid.queryRadius(
        dampener.x,
        dampener.y,
        DAMPENER_AURA_RADIUS,
        this.neighborBuf
      );
      for (let j = 0; j < nCount; j++) {
        const ally = items[this.neighborBuf[j]];
        if (!ally || !ally.active || ally.type === 'null_dampener') {
          continue;
        }
        const dx = ally.x - dampener.x;
        const dy = ally.y - dampener.y;
        if (dx * dx + dy * dy <= DAMPENER_AURA_RADIUS_SQ) {
          ally.dampened = true;
        }
      }
    }

    // 3. Per-Enemy AI, Soft Separation, Movement, Projectiles & Contact Damage
    let activeBoss: EnemyEntity | null = null;
    for (let i = 0; i < activeCount; i++) {
      const enemy = items[activeIndices[i]];
      if (!enemy.active) {
        continue;
      }
      if (enemy.isBoss) {
        activeBoss = enemy;
      }

      if (enemy.hitFlash > 0) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      }
      if (enemy.stunTimer > 0) {
        enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
        continue;
      }

      if (enemy.type === 'boss_wolf_tone') {
        this.updateWolfTone(enemy, dt, ctx);
      } else if (enemy.type === 'boss_anechoic_monolith') {
        this.updateAnechoicMonolith(enemy, dt, ctx);
      } else {
        this.updateRegularEnemy(enemy, dt, ctx);
      }

      // Clamp position cleanly inside arena bounds
      enemy.x = clamp(enemy.x, enemy.radius, ARENA_WIDTH - enemy.radius);
      enemy.y = clamp(enemy.y, enemy.radius, ARENA_HEIGHT - enemy.radius);

      // Contact Damage check
      const pdx = ctx.player.x - enemy.x;
      const pdy = ctx.player.y - enemy.y;
      const contactThreshold = Math.max(2, enemy.radius + ctx.player.radius - 4);
      if (pdx * pdx + pdy * pdy < contactThreshold * contactThreshold) {
        ctx.damagePlayer(enemy.damage, enemy.x, enemy.y);
      }
    }

    const waveCleared =
      ctx.wave.isBossWave && ctx.wave.bossId
        ? this.bossSpawned && activeBoss === null
        : this.waveElapsed >= ctx.wave.duration;

    return {
      waveCleared,
      activeBoss,
    };
  }

  private updateSpawning(dt: number, ctx: EnemyUpdateContext): void {
    const { wave, enemies, rng, player } = ctx;
    const densityMult = wave.modifier === 'dense_choir' ? 1.35 : 1.0;

    if (wave.isBossWave && wave.bossId) {
      if (!this.bossSpawned && this.waveElapsed >= 1.2) {
        const bossDef = this.enemyDefs[wave.bossId];
        this.pickSafeSpawnPosition(player.x, player.y, bossDef.radius, rng);
        let boss = this.spawnEnemy(
          wave.bossId,
          this.tmpSpawnX,
          this.tmpSpawnY,
          wave,
          enemies,
          rng,
          false
        );
        // If pool was saturated, free one non-boss, non-elite enemy so boss always spawns
        if (!boss) {
          this.evictOneFodder(enemies, player);
          boss = this.spawnEnemy(
            wave.bossId,
            this.tmpSpawnX,
            this.tmpSpawnY,
            wave,
            enemies,
            rng,
            false
          );
        }
        if (boss) {
          this.bossSpawned = true;
          ctx.audio.playBossWarning();
          ctx.particles.addShake(10);
          ctx.particles.emitShockwave(
            boss.x,
            boss.y,
            260,
            boss.accentColor || '#F43F5E',
            0.65,
            5
          );
        }
      }

      // Steady trickle support adds (spawnBudget * 0.45)
      const supportBudget = Math.max(
        1,
        Math.round(wave.spawnBudget * 0.45 * densityMult)
      );
      if (this.spawnedCount < supportBudget) {
        const rate = supportBudget / Math.max(1, wave.duration);
        this.spawnAccumulator += rate * dt;
        while (this.spawnAccumulator >= 1 && this.spawnedCount < supportBudget) {
          const type = this.pickWeightedType(rng);
          const def = this.enemyDefs[type];
          this.pickSafeSpawnPosition(player.x, player.y, def.radius, rng);
          if (!this.spawnEnemy(type, this.tmpSpawnX, this.tmpSpawnY, wave, enemies, rng)) {
            this.spawnAccumulator = Math.min(this.spawnAccumulator, 1);
            break;
          }
          this.spawnAccumulator -= 1;
          this.spawnedCount++;
        }
      }
      return;
    }

    // Non-boss wave pacing: opening cluster in first 0.8s + smooth pacing across duration
    const totalBudget = Math.max(1, Math.round(wave.spawnBudget * densityMult));
    if (this.spawnedCount >= totalBudget) {
      return;
    }

    const openingTarget = Math.min(totalBudget, this.openingClusterCount);
    let rate: number;
    if (this.waveElapsed < 0.8 && this.spawnedCount < openingTarget) {
      rate = openingTarget / 0.8;
    } else {
      const remainingBudget = Math.max(0, totalBudget - this.spawnedCount);
      const remainingTime = Math.max(0.5, wave.duration - this.waveElapsed);
      rate = remainingBudget / remainingTime;
    }

    this.spawnAccumulator += rate * dt;
    while (this.spawnAccumulator >= 1 && this.spawnedCount < totalBudget) {
      const type = this.pickWeightedType(rng);
      const def = this.enemyDefs[type];
      this.pickSafeSpawnPosition(player.x, player.y, def.radius, rng);
      if (!this.spawnEnemy(type, this.tmpSpawnX, this.tmpSpawnY, wave, enemies, rng)) {
        this.spawnAccumulator = Math.min(this.spawnAccumulator, 1);
        break;
      }
      this.spawnAccumulator -= 1;
      this.spawnedCount++;
    }
  }

  private pickWeightedType(rng: IRng): EnemyTypeId {
    if (this.waveTypeCount <= 0 || this.waveTotalWeight <= 0) {
      return 'static_mite';
    }
    const roll = rng.range(0, this.waveTotalWeight);
    for (let i = 0; i < this.waveTypeCount; i++) {
      if (roll <= this.waveCumWeights[i]) {
        return this.waveTypes[i];
      }
    }
    return this.waveTypes[this.waveTypeCount - 1];
  }

  private pickSafeSpawnPosition(
    px: number,
    py: number,
    radius: number,
    rng: IRng
  ): void {
    const minBound = Math.max(SPAWN_MARGIN, radius);
    const maxX = ARENA_WIDTH - minBound;
    const maxY = ARENA_HEIGHT - minBound;
    const minDistSq = SPAWN_MIN_PLAYER_DIST * SPAWN_MIN_PLAYER_DIST;

    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(SPAWN_MIN_DIST, SPAWN_MAX_DIST);

    let sx = clamp(px + Math.cos(angle) * dist, minBound, maxX);
    let sy = clamp(py + Math.sin(angle) * dist, minBound, maxY);
    let dx = sx - px;
    let dy = sy - py;

    if (dx * dx + dy * dy < minDistSq) {
      // Clamping pushed too close to player: flip to opposite side
      const oppAngle = angle + Math.PI;
      sx = clamp(px + Math.cos(oppAngle) * dist, minBound, maxX);
      sy = clamp(py + Math.sin(oppAngle) * dist, minBound, maxY);
      dx = sx - px;
      dy = sy - py;

      if (dx * dx + dy * dy < minDistSq) {
        // Fallback toward arena center
        const centerAngle = Math.atan2(ARENA_HEIGHT * 0.5 - py, ARENA_WIDTH * 0.5 - px);
        sx = clamp(px + Math.cos(centerAngle) * dist, minBound, maxX);
        sy = clamp(py + Math.sin(centerAngle) * dist, minBound, maxY);
      }
    }

    this.tmpSpawnX = sx;
    this.tmpSpawnY = sy;
  }

  private evictOneFodder(enemies: IPool<EnemyEntity>, player: PlayerState): void {
    const active = enemies.activeIndices;
    const count = enemies.activeCount;
    let victim: EnemyEntity | null = null;
    let bestDistSq = -1;
    for (let i = 0; i < count; i++) {
      const e = enemies.items[active[i]];
      if (!e.active || e.isBoss || e.isElite) {
        continue;
      }
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > bestDistSq) {
        bestDistSq = d2;
        victim = e;
      }
    }
    if (victim) {
      enemies.release(victim);
    }
  }

  private updateRegularEnemy(
    enemy: EnemyEntity,
    dt: number,
    ctx: EnemyUpdateContext
  ): void {
    const { player, enemies, grid } = ctx;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distSq = dx * dx + dy * dy;
    const dist = distSq > 0.0001 ? Math.sqrt(distSq) : 0.001;
    const dirX = dx / dist;
    const dirY = dy / dist;

    let targetVx = 0;
    let targetVy = 0;
    let isDashing = false;

    if (enemy.type === 'static_mite' || enemy.type === 'micro_tick') {
      const baseAngle = Math.atan2(dirY, dirX);
      const weaveAngle =
        baseAngle + Math.sin(this.waveElapsed * 6 + enemy.poolIndex) * 0.22;
      targetVx = Math.cos(weaveAngle) * enemy.speed;
      targetVy = Math.sin(weaveAngle) * enemy.speed;
    } else if (enemy.type === 'hum_drone' || enemy.type === 'splitter_chord') {
      targetVx = dirX * enemy.speed;
      targetVy = dirY * enemy.speed;
    } else if (enemy.type === 'phase_skitter') {
      if (enemy.telegraphKind === 'dash') {
        enemy.telegraphTimer -= dt;
        targetVx = 0;
        targetVy = 0;
        if (enemy.telegraphTimer <= 0) {
          enemy.telegraphKind = 'none';
          enemy.telegraphTimer = 0;
          enemy.dashTimer = 0.32;
        }
      } else if (enemy.dashTimer > 0) {
        isDashing = true;
        enemy.dashTimer -= dt;
        targetVx = enemy.dashVx;
        targetVy = enemy.dashVy;
        if (enemy.dashTimer <= 0) {
          enemy.dashTimer = 0;
          enemy.aiTimer = 2.2;
        }
      } else {
        if (enemy.aiTimer > 0) {
          enemy.aiTimer = Math.max(0, enemy.aiTimer - dt);
        }
        if (dist <= 290 && enemy.aiTimer <= 0) {
          enemy.telegraphKind = 'dash';
          enemy.telegraphDuration = 0.48;
          enemy.telegraphTimer = 0.48;
          const dashSpeed = enemy.speed * 3.4;
          enemy.dashVx = dirX * dashSpeed;
          enemy.dashVy = dirY * dashSpeed;
          enemy.telegraphAngle = Math.atan2(dirY, dirX);
          const dashSpan = dashSpeed * 0.32;
          enemy.telegraphX = clamp(
            enemy.x + dirX * dashSpan,
            enemy.radius,
            ARENA_WIDTH - enemy.radius
          );
          enemy.telegraphY = clamp(
            enemy.y + dirY * dashSpan,
            enemy.radius,
            ARENA_HEIGHT - enemy.radius
          );
        } else {
          targetVx = dirX * enemy.speed;
          targetVy = dirY * enemy.speed;
        }
      }
    } else if (enemy.type === 'siren_node') {
      const def = this.enemyDefs[enemy.type];
      const preferredRange = def.preferredRange ?? 265;
      const orbitDir = (enemy.poolIndex & 1) === 0 ? 1 : -1;
      const tanX = -dirY * orbitDir;
      const tanY = dirX * orbitDir;

      if (dist > preferredRange + 25) {
        targetVx = dirX * enemy.speed;
        targetVy = dirY * enemy.speed;
      } else if (dist < 180) {
        targetVx = (-dirX * 0.65 + tanX * 0.45) * enemy.speed;
        targetVy = (-dirY * 0.65 + tanY * 0.45) * enemy.speed;
      } else {
        const radialAdjust = clamp((dist - preferredRange) * 0.015, -0.35, 0.35);
        targetVx = (tanX * 0.85 + dirX * radialAdjust) * enemy.speed;
        targetVy = (tanY * 0.85 + dirY * radialAdjust) * enemy.speed;
      }
    } else if (enemy.type === 'null_dampener') {
      // Hover purposefully near nearby enemy packs (~190px from player)
      const orbitDir = (enemy.poolIndex & 1) === 0 ? 1 : -1;
      const tanX = -dirY * orbitDir;
      const tanY = dirX * orbitDir;

      if (dist > 235) {
        targetVx = dirX * enemy.speed;
        targetVy = dirY * enemy.speed;
      } else if (dist < 145) {
        targetVx = (-dirX * 0.55 + tanX * 0.5) * enemy.speed;
        targetVy = (-dirY * 0.55 + tanY * 0.5) * enemy.speed;
      } else {
        targetVx = tanX * enemy.speed * 0.7;
        targetVy = tanY * enemy.speed * 0.7;
      }

      // Bias gently toward nearby non-dampener pack centroid
      const packCount = grid.queryRadius(enemy.x, enemy.y, 240, this.neighborBuf);
      let sumX = 0;
      let sumY = 0;
      let allies = 0;
      for (let j = 0; j < packCount; j++) {
        const other = enemies.items[this.neighborBuf[j]];
        if (!other || !other.active || other.type === 'null_dampener') {
          continue;
        }
        sumX += other.x;
        sumY += other.y;
        allies++;
      }
      if (allies > 0) {
        const cx = sumX / allies - enemy.x;
        const cy = sumY / allies - enemy.y;
        const cLen = Math.sqrt(cx * cx + cy * cy);
        if (cLen > 24) {
          targetVx = targetVx * 0.55 + (cx / cLen) * enemy.speed * 0.55;
          targetVy = targetVy * 0.55 + (cy / cLen) * enemy.speed * 0.55;
        }
      }
    }

    // Ranged orb firing for Siren Node & Twin-Shot Elites
    if (enemy.type === 'siren_node' || enemy.affix === 'twin_shot') {
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        const def = this.enemyDefs[enemy.type];
        enemy.fireTimer = def.fireInterval ?? 2.4;
        const aimAngle = Math.atan2(dirY, dirX);
        if (enemy.affix === 'twin_shot') {
          this.spawnEnemyOrb(enemy, aimAngle - 0.16, ENEMY_ORB_SPEED, ctx.projectiles);
          this.spawnEnemyOrb(enemy, aimAngle + 0.16, ENEMY_ORB_SPEED, ctx.projectiles);
        } else {
          this.spawnEnemyOrb(enemy, aimAngle, ENEMY_ORB_SPEED, ctx.projectiles);
        }
      }
    }

    // Soft crowd-separation via spatial grid
    let sepX = 0;
    let sepY = 0;
    const nCount = grid.queryRadius(enemy.x, enemy.y, enemy.radius + 52, this.neighborBuf);
    for (let j = 0; j < nCount; j++) {
      const otherIdx = this.neighborBuf[j];
      if (otherIdx === enemy.poolIndex) {
        continue;
      }
      const other = enemies.items[otherIdx];
      if (!other || !other.active) {
        continue;
      }
      const sdx = enemy.x - other.x;
      const sdy = enemy.y - other.y;
      const sd2 = sdx * sdx + sdy * sdy;
      const minSep = enemy.radius + other.radius + 4;
      if (sd2 < minSep * minSep) {
        if (sd2 < 0.0001) {
          const fallbackAngle = enemy.poolIndex * 2.399963;
          sepX += Math.cos(fallbackAngle);
          sepY += Math.sin(fallbackAngle);
        } else {
          const sd = Math.sqrt(sd2);
          const overlap = (minSep - sd) / minSep;
          sepX += (sdx / sd) * overlap;
          sepY += (sdy / sd) * overlap;
        }
      }
    }

    const sepStrength = isDashing ? 45 : 190;
    const desiredVx = targetVx + sepX * sepStrength;
    const desiredVy = targetVy + sepY * sepStrength;

    if (isDashing) {
      enemy.vx = desiredVx;
      enemy.vy = desiredVy;
    } else {
      const blend = Math.min(1, dt * 14);
      enemy.vx += (desiredVx - enemy.vx) * blend;
      enemy.vy += (desiredVy - enemy.vy) * blend;
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }

  private updateWolfTone(
    enemy: EnemyEntity,
    dt: number,
    ctx: EnemyUpdateContext
  ): void {
    const enraged = enemy.hp < enemy.maxHp * 0.5;
    enemy.armorAngle += dt * (enraged ? 2.1 : 1.3);

    if (enemy.aiTimer > 0) {
      enemy.aiTimer = Math.max(0, enemy.aiTimer - dt);
    }

    const dx = ctx.player.x - enemy.x;
    const dy = ctx.player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Active telegraph handling
    if (enemy.telegraphKind === 'ring') {
      enemy.telegraphTimer -= dt;
      enemy.vx *= Math.max(0, 1 - dt * 10);
      enemy.vy *= Math.max(0, 1 - dt * 10);
      if (enemy.telegraphTimer <= 0) {
        enemy.telegraphKind = 'none';
        enemy.telegraphTimer = 0;

        // Fire 10 (14 enraged) enemy orbs in 2 arcs leaving 2 wide dodge lanes
        const orbsPerArc = enraged ? 7 : 5;
        const arcSpan = (Math.PI * 115) / 180;
        const baseAngle = enemy.telegraphAngle;
        for (let arc = 0; arc < 2; arc++) {
          const arcCenter = baseAngle + arc * Math.PI + Math.PI * 0.5;
          for (let k = 0; k < orbsPerArc; k++) {
            const frac = orbsPerArc > 1 ? k / (orbsPerArc - 1) - 0.5 : 0;
            const orbAngle = arcCenter + frac * arcSpan;
            this.spawnEnemyOrb(enemy, orbAngle, ENEMY_ORB_SPEED, ctx.projectiles);
          }
        }
        ctx.particles.emitShockwave(enemy.x, enemy.y, 130, '#F5C451', 0.35, 3);
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      return;
    }

    if (enemy.telegraphKind === 'slam') {
      enemy.telegraphTimer -= dt;
      enemy.vx *= Math.max(0, 1 - dt * 10);
      enemy.vy *= Math.max(0, 1 - dt * 10);
      if (enemy.telegraphTimer <= 0) {
        enemy.telegraphKind = 'none';
        enemy.telegraphTimer = 0;

        const ldx = enemy.telegraphX - enemy.x;
        const ldy = enemy.telegraphY - enemy.y;
        const lDist = Math.sqrt(ldx * ldx + ldy * ldy);
        const lungeTime = clamp(lDist / 720, 0.2, 0.36);
        enemy.dashTimer = lungeTime;
        enemy.dashVx = lDist > 1 ? ldx / lungeTime : 0;
        enemy.dashVy = lDist > 1 ? ldy / lungeTime : 0;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      return;
    }

    // Active slam lunge
    if (enemy.dashTimer > 0) {
      enemy.dashTimer -= dt;
      enemy.vx = enemy.dashVx;
      enemy.vy = enemy.dashVy;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      if (enemy.dashTimer <= 0) {
        enemy.dashTimer = 0;
        enemy.vx = 0;
        enemy.vy = 0;
        ctx.particles.emitShockwave(
          enemy.x,
          enemy.y,
          WOLF_SLAM_AOE_RADIUS + 14,
          '#F43F5E',
          0.48,
          5
        );
        ctx.particles.emitBurst(enemy.x, enemy.y, 18, '#F5C451', 210, 4, 0.4);
        ctx.particles.addShake(9);

        const pDistSq =
          (ctx.player.x - enemy.x) * (ctx.player.x - enemy.x) +
          (ctx.player.y - enemy.y) * (ctx.player.y - enemy.y);
        if (pDistSq <= WOLF_SLAM_AOE_RADIUS * WOLF_SLAM_AOE_RADIUS) {
          ctx.damagePlayer(enemy.damage * 1.2, enemy.x, enemy.y);
        }
      }
      return;
    }

    // Trigger next attack on 3.2s (2.4s enraged) cycle
    if (enemy.aiTimer <= 0) {
      const cycle = enemy.aiPhase % 3;
      enemy.aiPhase++;
      enemy.aiTimer = enraged ? 2.4 : 3.2;

      if (cycle === 0) {
        // 1. Radial Dissonance Ring
        enemy.telegraphKind = 'ring';
        enemy.telegraphDuration = 0.55;
        enemy.telegraphTimer = 0.55;
        enemy.telegraphAngle = Math.atan2(dirY, dirX);
        return;
      } else if (cycle === 1) {
        // 2. Sub-Bass Slam Lunge
        enemy.telegraphKind = 'slam';
        enemy.telegraphDuration = 0.8;
        enemy.telegraphTimer = 0.8;
        enemy.telegraphX = clamp(
          ctx.player.x,
          enemy.radius + 8,
          ARENA_WIDTH - enemy.radius - 8
        );
        enemy.telegraphY = clamp(
          ctx.player.y,
          enemy.radius + 8,
          ARENA_HEIGHT - enemy.radius - 8
        );
        return;
      } else {
        // 3. Static Choir: summon 4-6 static_mite swarmers with crimson shockwave
        const summonCount = enraged ? 6 : ctx.rng.int(4, 5);
        ctx.particles.emitShockwave(enemy.x, enemy.y, 165, '#F43F5E', 0.45, 4);
        ctx.particles.emitBurst(enemy.x, enemy.y, 14, '#F43F5E', 170, 3.5, 0.35);
        const startAngle = ctx.rng.range(0, Math.PI * 2);
        const step = (Math.PI * 2) / summonCount;
        const spawnR = enemy.radius + 28;
        for (let k = 0; k < summonCount; k++) {
          const a = startAngle + step * k;
          const mite = this.spawnEnemy(
            'static_mite',
            enemy.x + Math.cos(a) * spawnR,
            enemy.y + Math.sin(a) * spawnR,
            ctx.wave,
            ctx.enemies,
            ctx.rng,
            false
          );
          if (mite) {
            mite.vx = Math.cos(a) * 110;
            mite.vy = Math.sin(a) * 110;
          }
        }
      }
    }

    // Relentless pursuit between attacks
    const moveSpeed = enemy.speed * (enraged ? 1.2 : 1.0);
    const blend = Math.min(1, dt * 8);
    enemy.vx += (dirX * moveSpeed - enemy.vx) * blend;
    enemy.vy += (dirY * moveSpeed - enemy.vy) * blend;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }

  private updateAnechoicMonolith(
    enemy: EnemyEntity,
    dt: number,
    ctx: EnemyUpdateContext
  ): void {
    const enraged = enemy.hp < enemy.maxHp * 0.5;
    enemy.armorAngle += dt * (enraged ? 1.15 : 0.7);

    if (enemy.aiTimer > 0) {
      enemy.aiTimer = Math.max(0, enemy.aiTimer - dt);
    }

    const dx = ctx.player.x - enemy.x;
    const dy = ctx.player.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // 1a. Laser telegraph
    if (enemy.telegraphKind === 'laser') {
      enemy.telegraphTimer -= dt;
      enemy.vx *= Math.max(0, 1 - dt * 10);
      enemy.vy *= Math.max(0, 1 - dt * 10);
      if (enemy.telegraphTimer <= 0) {
        enemy.telegraphKind = 'none';
        enemy.telegraphTimer = 0;
        enemy.laserActiveTimer = 0.65;
        ctx.particles.addShake(4);
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      return;
    }

    // 1b. Active sweeping Standing-Wave Laser Beam
    if (enemy.laserActiveTimer > 0) {
      enemy.laserActiveTimer = Math.max(0, enemy.laserActiveTimer - dt);
      const sweepDir = (enemy.aiPhase & 1) === 0 ? 1 : -1;
      enemy.telegraphAngle += sweepDir * MONOLITH_LASER_SWEEP_SPEED * dt;

      const endX = enemy.x + Math.cos(enemy.telegraphAngle) * MONOLITH_LASER_LENGTH;
      const endY = enemy.y + Math.sin(enemy.telegraphAngle) * MONOLITH_LASER_LENGTH;
      enemy.telegraphX = endX;
      enemy.telegraphY = endY;

      const hitDistSq = pointToSegmentDistSq(
        ctx.player.x,
        ctx.player.y,
        enemy.x,
        enemy.y,
        endX,
        endY
      );
      const hitRadius = MONOLITH_LASER_HALF_WIDTH + ctx.player.radius * 0.85;
      if (hitDistSq <= hitRadius * hitRadius) {
        ctx.damagePlayer(enemy.damage * 1.15, enemy.x, enemy.y);
      }

      enemy.vx *= Math.max(0, 1 - dt * 10);
      enemy.vy *= Math.max(0, 1 - dt * 10);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      return;
    }

    // 2. Active Phase Spiral Barrage (2-arm rotating spiral over 1.2s)
    if (enemy.fireTimer > 0) {
      const prevBucket = Math.floor(enemy.fireTimer / 0.14);
      enemy.fireTimer = Math.max(0, enemy.fireTimer - dt);
      const nextBucket = Math.floor(enemy.fireTimer / 0.14);
      if (nextBucket < prevBucket) {
        enemy.telegraphAngle += 0.36;
        const spiralSpeed = enraged ? 235 : 215;
        this.spawnEnemyOrb(enemy, enemy.telegraphAngle, spiralSpeed, ctx.projectiles);
        this.spawnEnemyOrb(
          enemy,
          enemy.telegraphAngle + Math.PI,
          spiralSpeed,
          ctx.projectiles
        );
      }
    }

    // Cycle across 3 signature attacks when idle
    if (enemy.aiTimer <= 0 && enemy.fireTimer <= 0) {
      const cycle = enemy.aiPhase % 3;
      enemy.aiPhase++;
      enemy.aiTimer = enraged ? 2.7 : 3.5;

      if (cycle === 0) {
        // Standing-Wave Laser Beam
        enemy.telegraphKind = 'laser';
        enemy.telegraphDuration = 0.85;
        enemy.telegraphTimer = 0.85;
        enemy.telegraphAngle = Math.atan2(dirY, dirX);
        enemy.telegraphX =
          enemy.x + Math.cos(enemy.telegraphAngle) * MONOLITH_LASER_LENGTH;
        enemy.telegraphY =
          enemy.y + Math.sin(enemy.telegraphAngle) * MONOLITH_LASER_LENGTH;
        return;
      } else if (cycle === 1) {
        // Phase Spiral Barrage
        enemy.fireTimer = 1.2;
        enemy.telegraphAngle = Math.atan2(dirY, dirX);
        this.spawnEnemyOrb(enemy, enemy.telegraphAngle, 220, ctx.projectiles);
        this.spawnEnemyOrb(
          enemy,
          enemy.telegraphAngle + Math.PI,
          220,
          ctx.projectiles
        );
      } else {
        // Dampener Pylons (capped at 3 active null_dampeners)
        let activeDampeners = 0;
        const active = ctx.enemies.activeIndices;
        const activeCount = ctx.enemies.activeCount;
        for (let j = 0; j < activeCount; j++) {
          if (ctx.enemies.items[active[j]].type === 'null_dampener') {
            activeDampeners++;
          }
        }
        const available = Math.max(0, MONOLITH_MAX_DAMPENERS - activeDampeners);
        const wanted = enraged ? 2 : ctx.rng.int(1, 2);
        const toSpawn = Math.min(available, wanted);

        ctx.particles.emitShockwave(enemy.x, enemy.y, 150, '#C084FC', 0.45, 3.5);
        if (toSpawn > 0) {
          const baseA = ctx.rng.range(0, Math.PI * 2);
          for (let k = 0; k < toSpawn; k++) {
            const a = baseA + k * Math.PI;
            this.spawnEnemy(
              'null_dampener',
              enemy.x + Math.cos(a) * (enemy.radius + 36),
              enemy.y + Math.sin(a) * (enemy.radius + 36),
              ctx.wave,
              ctx.enemies,
              ctx.rng,
              false
            );
          }
        } else {
          // Fallback 6-orb mandala pulse if dampener cap is already reached
          const baseA = enemy.armorAngle;
          for (let k = 0; k < 6; k++) {
            this.spawnEnemyOrb(
              enemy,
              baseA + (k * Math.PI) / 3,
              ENEMY_ORB_SPEED,
              ctx.projectiles
            );
          }
        }
      }
    }

    // Stately hovering orbit around mid-range (~240px from player)
    const preferred = 240;
    const tanX = -dirY;
    const tanY = dirX;
    let targetVx = tanX * enemy.speed * 0.7;
    let targetVy = tanY * enemy.speed * 0.7;
    if (dist > preferred + 35) {
      targetVx += dirX * enemy.speed * 0.75;
      targetVy += dirY * enemy.speed * 0.75;
    } else if (dist < 160) {
      targetVx -= dirX * enemy.speed * 0.55;
      targetVy -= dirY * enemy.speed * 0.55;
    }

    const blend = Math.min(1, dt * 6);
    enemy.vx += (targetVx - enemy.vx) * blend;
    enemy.vy += (targetVy - enemy.vy) * blend;
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }

  private spawnEnemyOrb(
    source: EnemyEntity,
    angle: number,
    speed: number,
    projectiles: IPool<ProjectileEntity>
  ): void {
    const proj = projectiles.acquire();
    if (!proj) {
      return;
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const offset = source.radius + 6;

    proj.isEnemy = true;
    proj.sourceId = 'enemy_orb';
    proj.evolved = false;
    proj.x = source.x + cos * offset;
    proj.y = source.y + sin * offset;
    proj.vx = cos * speed;
    proj.vy = sin * speed;
    proj.radius = ENEMY_ORB_RADIUS;
    proj.damage = source.damage;
    proj.isCrit = false;
    proj.pierceLeft = 0;
    proj.bouncesLeft = 0;
    proj.bounceDamageBonus = 0;
    proj.homingStrength = 0;
    proj.life = ENEMY_ORB_LIFE;
    proj.maxLife = ENEMY_ORB_LIFE;
    proj.aoeRadius = 0;
    proj.leavesFaultZone = false;
    proj.knockback = 0;
    proj.color = ENEMY_ORB_COLOR;
    proj.lastHitEnemyIndex = -1;
  }
}
