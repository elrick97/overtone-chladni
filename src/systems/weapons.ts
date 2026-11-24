import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type AcousticModifierId,
  type ComputedStats,
  type EnemyEntity,
  type EvolutionId,
  type FaultZoneEntity,
  type IAudio,
  type IParticleSystem,
  type IPool,
  type IRng,
  type ISpatialGrid,
  type InstrumentId,
  type MetaBonuses,
  type OrbitalNode,
  type PlayerState,
  type ProjectileEntity,
  type RelicId,
  type RunUpgrades,
} from '../types';

export interface WeaponUpdateContext {
  player: PlayerState;
  stats: ComputedStats;
  upgrades: RunUpgrades;
  enemies: IPool<EnemyEntity>;
  projectiles: IPool<ProjectileEntity>;
  faultZones: IPool<FaultZoneEntity>;
  grid: ISpatialGrid;
  rng: IRng;
  audio: IAudio;
  particles: IParticleSystem;
  damageEnemy: (
    enemy: EnemyEntity,
    amount: number,
    isCrit: boolean,
    knockbackX: number,
    knockbackY: number,
    sourceId: string
  ) => void;
}

const MAX_ORBITAL_NODES = 8;
const ORBITAL_COOLDOWN_CAPACITY = 512;
const ORBITAL_HIT_INTERVAL = 0.22;
const MAX_CHAIN_VISITED = 32;
const TWO_PI = Math.PI * 2;

export class WeaponSystem {
  private readonly queryBuf = new Int32Array(128);
  private readonly orbitalHitCooldowns = new Float32Array(ORBITAL_COOLDOWN_CAPACITY);
  private readonly chainVisited = new Int32Array(MAX_CHAIN_VISITED);
  private readonly orbitals: OrbitalNode[];

  private strikeTimer = 0;
  private arcTimer = 0;
  private arcCastCount = 0;
  private mortarTimer = 0;
  private lanceTimer = 0;
  private anchorShockwaveTimer = 0;

  constructor() {
    this.orbitals = new Array<OrbitalNode>(MAX_ORBITAL_NODES);
    for (let i = 0; i < MAX_ORBITAL_NODES; i++) {
      this.orbitals[i] = {
        active: false,
        x: 0,
        y: 0,
        radius: 10,
        damage: 0,
        evolved: false,
        ringIndex: 0,
      };
    }
  }

  reset(): void {
    this.strikeTimer = 0;
    this.arcTimer = 0;
    this.arcCastCount = 0;
    this.mortarTimer = 0;
    this.lanceTimer = 0;
    this.anchorShockwaveTimer = 0;
    this.orbitalHitCooldowns.fill(0);
    for (let i = 0; i < MAX_ORBITAL_NODES; i++) {
      this.orbitals[i].active = false;
    }
  }

  getOrbitals(): readonly OrbitalNode[] {
    return this.orbitals;
  }

  computeStats(
    meta: MetaBonuses,
    upgrades: RunUpgrades,
    player: PlayerState,
    modifier: AcousticModifierId
  ): ComputedStats {
    const ranks = upgrades.ranks;
    const heavyRank = ranks.heavy_brass ?? 0;
    const tempoRank = ranks.overdrive_tempo ?? 0;
    const groundedRank = ranks.grounded_focus ?? 0;
    const splitRank = ranks.split_octave ?? 0;
    const wideRank = ranks.wide_aperture ?? 0;
    const echoRank = ranks.sympathetic_echo ?? 0;
    const critRank = ranks.crit_transients ?? 0;
    const shatterRank = ranks.shatter_resonance ?? 0;
    const siphonRank = ranks.harmonic_siphon ?? 0;

    const hasGlassOctave = this.hasRelic(upgrades, 'relic_glass_octave');
    const hasPerpetualFeedback = this.hasRelic(upgrades, 'relic_perpetual_feedback');
    const hasAnchorRelic = this.hasRelic(upgrades, 'relic_anchor_chladni');
    const hasAegisMandala = this.hasEvolution(upgrades, 'evo_aegis_mandala');

    const moveSpeed =
      245 * meta.moveSpeedMult * (modifier === 'doppler_surge' ? 1.2 : 1.0);
    const maxHpBase = 100 + meta.maxHpFlat + siphonRank * 25;
    const maxHp = hasGlassOctave
      ? Math.max(25, Math.floor(maxHpBase * 0.5))
      : maxHpBase;

    let damageMult =
      meta.damageMult *
      (1 + heavyRank * 0.22 + upgrades.bonusDamageStacks * 0.12) *
      (modifier === 'blood_octave' ? 1.25 : 1.0);
    if (hasGlassOctave) {
      damageMult *= 2.0;
    }

    const maxShield = groundedRank === 0 ? 0 : groundedRank * 24;
    const anchorFireRateBonus =
      0.28 + groundedRank * 0.22 + (hasAnchorRelic ? 0.5 : 0);

    let fireRateMult = meta.fireRateMult * (1 + tempoRank * 0.16);
    if (player.isAnchored) {
      fireRateMult *= 1 + anchorFireRateBonus;
    }
    if (hasPerpetualFeedback) {
      fireRateMult *= 1 + player.feedbackStacks * 0.03;
    }

    const aoeMult = 1 + wideRank * 0.2;
    const pickupRadius =
      92 *
      meta.pickupRadiusMult *
      (1 + wideRank * 0.3) *
      (hasAegisMandala ? 1.45 : 1.0);

    const critChance = Math.min(
      0.85,
      0.06 + meta.critChanceBonus + critRank * 0.09
    );
    const critMultiplier = 1.75 + critRank * 0.25;
    const knockbackMult = 1 + heavyRank * 0.2;
    const xpMult = meta.xpMult * (modifier === 'dense_choir' ? 1.35 : 1.0);

    return {
      damageMult,
      fireRateMult,
      moveSpeed,
      maxHp,
      maxShield,
      pickupRadius,
      aoeMult,
      extraProjectiles: splitRank,
      extraPierce: echoRank,
      extraBounces: echoRank,
      critChance,
      critMultiplier,
      knockbackMult,
      xpMult,
      shatterRank,
      siphonRank,
      anchorFireRateBonus,
      anchorShockwave: hasAnchorRelic,
      glassOctave: hasGlassOctave,
      perpetualFeedback: hasPerpetualFeedback,
    };
  }

  update(dt: number, ctx: WeaponUpdateContext): void {
    if (dt <= 0) return;

    this.updateAnchorShockwave(dt, ctx);
    this.updateFaultZones(dt, ctx);
    this.updateOrbitals(dt, ctx);
    this.updateStrikePing(dt, ctx);
    this.updateArcTessitura(dt, ctx);
    this.updateSubBassMortar(dt, ctx);
    this.updateStandingLance(dt, ctx);
  }

  triggerOverdrive(ctx: WeaponUpdateContext): boolean {
    const { player, stats, projectiles, enemies, audio, particles, rng } = ctx;
    if (player.overdriveCharge < 100) {
      return false;
    }

    player.overdriveCharge = 0;
    player.invulnTimer = Math.max(player.invulnTimer, 0.6);

    const clearRadiusSq = 420 * 420;
    const projActive = projectiles.activeIndices;
    for (let i = projActive.length - 1; i >= 0; i--) {
      if (i >= projActive.length) continue;
      const proj = projectiles.items[projActive[i]];
      if (!proj || !proj.active || !proj.isEnemy) continue;
      const dx = proj.x - player.x;
      const dy = proj.y - player.y;
      if (dx * dx + dy * dy <= clearRadiusSq) {
        particles.emitBurst(proj.x, proj.y, 5, '#F5C451', 160, 3, 0.25);
        projectiles.release(proj);
      }
    }

    const waveRadiusSq = 340 * 340;
    const baseDmg = 110 * stats.damageMult * (1 + player.level * 0.12);
    const enemyActive = enemies.activeIndices;
    for (let i = enemyActive.length - 1; i >= 0; i--) {
      if (i >= enemyActive.length) continue;
      const enemy = enemies.items[enemyActive[i]];
      if (!enemy || !enemy.active) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= waveRadiusSq) {
        const dist = Math.sqrt(distSq) || 1;
        const isCrit = rng.chance(stats.critChance);
        const dmg = baseDmg * (isCrit ? stats.critMultiplier : 1);
        const kb = 360 * stats.knockbackMult;
        ctx.damageEnemy(
          enemy,
          dmg,
          isCrit,
          (dx / dist) * kb,
          (dy / dist) * kb,
          'overdrive'
        );
      }
    }

    audio.playOverdrive();
    particles.emitShockwave(player.x, player.y, 360, '#F5C451', 0.45, 6);
    particles.addShake(12);
    particles.triggerFlash('#F5C451', 0.28);
    particles.triggerHitStop(0.05);

    return true;
  }

  onEnemyKilled(enemy: EnemyEntity, ctx: WeaponUpdateContext): void {
    const { player, stats, upgrades, projectiles, particles, rng } = ctx;

    const tempoRank = upgrades.ranks.overdrive_tempo ?? 0;
    const baseGain = enemy.isBoss ? 35 : enemy.isElite ? 10 : 1.8;
    const gain = baseGain * (1 + tempoRank * 0.12);
    player.overdriveCharge = Math.min(100, player.overdriveCharge + gain);

    if (stats.perpetualFeedback) {
      player.feedbackStacks = Math.min(40, player.feedbackStacks + 1);
      player.feedbackTimer = 3.5;
    }

    if (stats.shatterRank > 0) {
      const shardCount = 2 + stats.shatterRank;
      const baseAngle = rng.next() * TWO_PI;
      const baseDmg = (18 + stats.shatterRank * 10) * stats.damageMult;
      const speed = 560;

      for (let i = 0; i < shardCount; i++) {
        const proj = projectiles.acquire();
        if (!proj) break;

        const angle = baseAngle + (i * TWO_PI) / shardCount;
        const isCrit = rng.chance(stats.critChance);
        const dmg = baseDmg * (isCrit ? stats.critMultiplier : 1);

        proj.isEnemy = false;
        proj.sourceId = 'shrapnel';
        proj.evolved = false;
        proj.x = enemy.x;
        proj.y = enemy.y;
        proj.vx = Math.cos(angle) * speed;
        proj.vy = Math.sin(angle) * speed;
        proj.radius = 4.5;
        proj.damage = dmg;
        proj.isCrit = isCrit;
        proj.pierceLeft = 1;
        proj.bouncesLeft = 0;
        proj.bounceDamageBonus = 0;
        proj.homingStrength = 0;
        proj.life = 0.65;
        proj.maxLife = 0.65;
        proj.aoeRadius = 0;
        proj.leavesFaultZone = false;
        proj.knockback = 70 * stats.knockbackMult;
        proj.color = '#FB7185';
        proj.lastHitEnemyIndex = enemy.poolIndex;
      }

      particles.emitBurst(enemy.x, enemy.y, 8, '#FB7185', 200, 3, 0.26);
    }
  }

  private updateAnchorShockwave(dt: number, ctx: WeaponUpdateContext): void {
    if (this.anchorShockwaveTimer > 0) {
      this.anchorShockwaveTimer -= dt;
    }

    const { player, stats, enemies, grid, audio, particles, rng } = ctx;
    if (!player.isAnchored || !stats.anchorShockwave) {
      return;
    }
    if (this.anchorShockwaveTimer > 0) {
      return;
    }

    this.anchorShockwaveTimer = 1.0;
    const radius = 185 * stats.aoeMult;
    const radiusSq = radius * radius;
    const baseDmg = (38 + player.level * 5) * stats.damageMult;

    audio.playAnchorLock();
    particles.emitShockwave(player.x, player.y, radius, '#F5C451', 0.35, 4);
    particles.emitBurst(player.x, player.y, 12, '#F5C451', 210, 3, 0.28);

    const count = grid.queryRadius(player.x, player.y, radius, this.queryBuf);
    for (let i = 0; i < count; i++) {
      const idx = this.queryBuf[i];
      if (idx < 0 || idx >= enemies.items.length) continue;
      const enemy = enemies.items[idx];
      if (!enemy || !enemy.active) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= radiusSq) {
        const dist = Math.sqrt(distSq) || 1;
        const isCrit = rng.chance(stats.critChance);
        const dmg = baseDmg * (isCrit ? stats.critMultiplier : 1);
        const kb = 250 * stats.knockbackMult;
        ctx.damageEnemy(
          enemy,
          dmg,
          isCrit,
          (dx / dist) * kb,
          (dy / dist) * kb,
          'relic_anchor_chladni'
        );
      }
    }
  }

  private updateStrikePing(dt: number, ctx: WeaponUpdateContext): void {
    const rank = this.getInstrumentRank(ctx.upgrades, 'strike_ping');
    if (rank <= 0) return;

    if (this.strikeTimer > 0) {
      this.strikeTimer -= dt;
    }
    if (this.strikeTimer > 0) return;

    const { player, stats, upgrades, projectiles, rng, audio, particles } = ctx;
    const evolved = this.hasEvolution(upgrades, 'evo_tesla_philharmonic');
    const interval = Math.max(0.06, (0.38 - rank * 0.04) / stats.fireRateMult);
    this.strikeTimer = interval;

    const target = this.findNearestEnemy(player.x, player.y, 820, ctx);
    const baseAngle = target
      ? Math.atan2(target.y - player.y, target.x - player.x)
      : player.facingAngle;

    const count = 1 + stats.extraProjectiles + (evolved ? 2 : 0);
    const spacing = 0.13;
    const speed = evolved ? 720 : 620;
    const baseDmg =
      (18 + rank * 7) * stats.damageMult * (evolved ? 1.25 : 1.0);
    const color = evolved ? '#FDE047' : '#F5C451';

    for (let i = 0; i < count; i++) {
      const proj = projectiles.acquire();
      if (!proj) break;

      const angle = baseAngle + (i - (count - 1) * 0.5) * spacing;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const isCrit = rng.chance(stats.critChance);
      const dmg = baseDmg * (isCrit ? stats.critMultiplier : 1);

      proj.isEnemy = false;
      proj.sourceId = 'strike_ping';
      proj.evolved = evolved;
      proj.x = player.x + cos * 14;
      proj.y = player.y + sin * 14;
      proj.vx = cos * speed;
      proj.vy = sin * speed;
      proj.radius = evolved ? 7 : 5;
      proj.damage = dmg;
      proj.isCrit = isCrit;
      proj.pierceLeft = stats.extraPierce;
      proj.bouncesLeft = evolved
        ? 2 + stats.extraBounces
        : stats.extraBounces;
      proj.bounceDamageBonus = evolved ? 0.15 : 0;
      proj.homingStrength = evolved ? 6.5 : 0;
      proj.life = evolved ? 1.65 : 1.25;
      proj.maxLife = proj.life;
      proj.aoeRadius = 0;
      proj.leavesFaultZone = false;
      proj.knockback = (evolved ? 115 : 85) * stats.knockbackMult;
      proj.color = color;
      proj.lastHitEnemyIndex = -1;
    }

    audio.playShoot('strike_ping', evolved);
    particles.emitDirectional(
      player.x,
      player.y,
      baseAngle,
      0.35,
      evolved ? 5 : 3,
      color,
      180
    );
  }

  private updateOrbitals(dt: number, ctx: WeaponUpdateContext): void {
    const cooldowns = this.orbitalHitCooldowns;
    for (let i = 0; i < ORBITAL_COOLDOWN_CAPACITY; i++) {
      if (cooldowns[i] > 0) {
        cooldowns[i] = cooldowns[i] > dt ? cooldowns[i] - dt : 0;
      }
    }

    const rank = this.getInstrumentRank(ctx.upgrades, 'chladni_orbitals');
    if (rank <= 0) {
      for (let i = 0; i < MAX_ORBITAL_NODES; i++) {
        this.orbitals[i].active = false;
      }
      return;
    }

    const { player, stats, upgrades, enemies, projectiles, grid, rng, particles } =
      ctx;
    const evolved = this.hasEvolution(upgrades, 'evo_aegis_mandala');
    const angularSpeed = evolved ? 5.6 : 3.2;
    player.orbitalAngle = (player.orbitalAngle + angularSpeed * dt) % TWO_PI;

    const clampedAoe = Math.min(2.2, stats.aoeMult);
    const nodeRadius = (evolved ? 14 : 11) * clampedAoe;
    const baseDmg = evolved
      ? (34 + rank * 8) * stats.damageMult
      : (16 + rank * 6) * stats.damageMult;

    let activeCount = 0;
    if (evolved) {
      activeCount = 6;
      const innerR = 74 * stats.aoeMult;
      const outerR = 118 * stats.aoeMult;
      const innerAngleBase = player.orbitalAngle;
      const outerAngleBase = -player.orbitalAngle * 1.15;

      for (let i = 0; i < 3; i++) {
        const a0 = innerAngleBase + (i * TWO_PI) / 3;
        const n0 = this.orbitals[i];
        n0.active = true;
        n0.x = player.x + Math.cos(a0) * innerR;
        n0.y = player.y + Math.sin(a0) * innerR;
        n0.radius = nodeRadius;
        n0.damage = baseDmg;
        n0.evolved = true;
        n0.ringIndex = 0;

        const a1 = outerAngleBase + (i * TWO_PI) / 3;
        const n1 = this.orbitals[i + 3];
        n1.active = true;
        n1.x = player.x + Math.cos(a1) * outerR;
        n1.y = player.y + Math.sin(a1) * outerR;
        n1.radius = nodeRadius;
        n1.damage = baseDmg;
        n1.evolved = true;
        n1.ringIndex = 1;
      }
    } else {
      activeCount = Math.min(MAX_ORBITAL_NODES, 1 + rank);
      const orbitR = 78 * stats.aoeMult;
      for (let i = 0; i < activeCount; i++) {
        const a = player.orbitalAngle + (i * TWO_PI) / activeCount;
        const node = this.orbitals[i];
        node.active = true;
        node.x = player.x + Math.cos(a) * orbitR;
        node.y = player.y + Math.sin(a) * orbitR;
        node.radius = nodeRadius;
        node.damage = baseDmg;
        node.evolved = false;
        node.ringIndex = 0;
      }
    }

    for (let i = activeCount; i < MAX_ORBITAL_NODES; i++) {
      this.orbitals[i].active = false;
    }

    const kbMag = (evolved ? 150 : 105) * stats.knockbackMult;
    for (let n = 0; n < activeCount; n++) {
      const node = this.orbitals[n];
      const count = grid.queryRadius(
        node.x,
        node.y,
        node.radius + 48,
        this.queryBuf
      );

      for (let i = 0; i < count; i++) {
        const idx = this.queryBuf[i];
        if (idx < 0 || idx >= enemies.items.length) continue;
        if (idx < ORBITAL_COOLDOWN_CAPACITY && cooldowns[idx] > 0) continue;

        const enemy = enemies.items[idx];
        if (!enemy || !enemy.active) continue;

        const dx = enemy.x - node.x;
        const dy = enemy.y - node.y;
        const hitR = node.radius + enemy.radius;
        if (dx * dx + dy * dy <= hitR * hitR) {
          if (idx < ORBITAL_COOLDOWN_CAPACITY) {
            cooldowns[idx] = ORBITAL_HIT_INTERVAL;
          }

          const isCrit = rng.chance(stats.critChance);
          const dmg = node.damage * (isCrit ? stats.critMultiplier : 1);
          let kx = enemy.x - player.x;
          let ky = enemy.y - player.y;
          const kLen = Math.hypot(kx, ky);
          if (kLen > 0.001) {
            kx = (kx / kLen) * kbMag;
            ky = (ky / kLen) * kbMag;
          } else {
            kx = 0;
            ky = 0;
          }

          ctx.damageEnemy(enemy, dmg, isCrit, kx, ky, 'chladni_orbitals');
          particles.emitBurst(
            enemy.x,
            enemy.y,
            evolved ? 5 : 3,
            evolved ? '#FDE047' : '#38BDF8',
            150,
            3,
            0.22
          );
        }
      }
    }

    if (evolved) {
      const projActive = projectiles.activeIndices;
      for (let i = projActive.length - 1; i >= 0; i--) {
        if (i >= projActive.length) continue;
        const proj = projectiles.items[projActive[i]];
        if (!proj || !proj.active || !proj.isEnemy) continue;

        for (let n = 0; n < activeCount; n++) {
          const node = this.orbitals[n];
          const r = node.radius + proj.radius + 8;
          const dx = proj.x - node.x;
          const dy = proj.y - node.y;
          if (dx * dx + dy * dy <= r * r) {
            particles.emitBurst(proj.x, proj.y, 5, '#38BDF8', 140, 3, 0.25);
            particles.emitBurst(proj.x, proj.y, 3, '#FDE047', 110, 2.5, 0.2);
            projectiles.release(proj);
            break;
          }
        }
      }
    }
  }

  private updateArcTessitura(dt: number, ctx: WeaponUpdateContext): void {
    const rank = this.getInstrumentRank(ctx.upgrades, 'arc_tessitura');
    if (rank <= 0) return;

    if (this.arcTimer > 0) {
      this.arcTimer -= dt;
    }
    if (this.arcTimer > 0) return;

    const { player, stats, upgrades, enemies, grid, audio, particles, rng } = ctx;
    const primary = this.findNearestEnemy(player.x, player.y, 360, ctx);
    if (!primary) return;

    const evolved = this.hasEvolution(upgrades, 'evo_storm_conductor');
    this.arcTimer = Math.max(0.2, (1.25 - rank * 0.1) / stats.fireRateMult);

    const baseDmg = (26 + rank * 10) * stats.damageMult;
    const maxJumps = Math.min(
      MAX_CHAIN_VISITED - 2,
      2 + rank + stats.extraProjectiles
    );
    let visitedCount = 0;
    this.chainVisited[visitedCount++] = primary.poolIndex;

    const px = primary.x;
    const py = primary.y;
    this.applyArcHit(primary, player.x, player.y, baseDmg, evolved, ctx);

    if (evolved) {
      const fork1 = this.findNextChainEnemy(px, py, 190, visitedCount, ctx);
      if (fork1) {
        this.chainVisited[visitedCount++] = fork1.poolIndex;
      }
      const fork2 = this.findNextChainEnemy(px, py, 190, visitedCount, ctx);
      if (fork2) {
        this.chainVisited[visitedCount++] = fork2.poolIndex;
      }

      if (fork1) {
        visitedCount = this.runArcBranch(
          fork1,
          px,
          py,
          baseDmg * 0.94,
          maxJumps - 1,
          visitedCount,
          true,
          ctx
        );
      }
      if (fork2) {
        visitedCount = this.runArcBranch(
          fork2,
          px,
          py,
          baseDmg * 0.94,
          maxJumps - 1,
          visitedCount,
          true,
          ctx
        );
      }

      this.arcCastCount++;
      if (this.arcCastCount % 5 === 0) {
        const zenithRadius = 135 * stats.aoeMult;
        const zenithRadiusSq = zenithRadius * zenithRadius;
        const topY = Math.max(0, py - 520);

        particles.emitBeam(px, topY, px, py, '#FDE047', 14, 0.28, true);
        particles.emitBeam(px, topY, px, py, '#FFFFFF', 6, 0.24, true);
        particles.emitShockwave(px, py, zenithRadius, '#38BDF8', 0.35, 5);
        particles.emitBurst(px, py, 16, '#FDE047', 260, 4, 0.35);
        particles.addShake(6);
        particles.triggerHitStop(0.03);

        const zenithDmg = baseDmg * 2.5 * 1.8;
        const count = grid.queryRadius(px, py, zenithRadius, this.queryBuf);
        for (let i = 0; i < count; i++) {
          const idx = this.queryBuf[i];
          if (idx < 0 || idx >= enemies.items.length) continue;
          const enemy = enemies.items[idx];
          if (!enemy || !enemy.active) continue;
          const dx = enemy.x - px;
          const dy = enemy.y - py;
          const dSq = dx * dx + dy * dy;
          if (dSq <= zenithRadiusSq) {
            const d = Math.sqrt(dSq) || 1;
            const kb = 190 * stats.knockbackMult;
            ctx.damageEnemy(
              enemy,
              zenithDmg,
              true,
              (dx / d) * kb,
              (dy / d) * kb,
              'arc_tessitura'
            );
          }
        }
      }
    } else {
      let curX = px;
      let curY = py;
      let curDmg = baseDmg * 0.92;
      for (let j = 0; j < maxJumps; j++) {
        if (visitedCount >= MAX_CHAIN_VISITED) break;
        const next = this.findNextChainEnemy(
          curX,
          curY,
          190,
          visitedCount,
          ctx
        );
        if (!next) break;
        this.chainVisited[visitedCount++] = next.poolIndex;
        const nx = next.x;
        const ny = next.y;
        this.applyArcHit(next, curX, curY, curDmg, false, ctx);
        curX = nx;
        curY = ny;
        curDmg *= 0.94;
      }
    }

    void rng;
    audio.playShoot('arc_tessitura', evolved);
  }

  private runArcBranch(
    first: EnemyEntity,
    originX: number,
    originY: number,
    startDmg: number,
    remainingJumps: number,
    visitedCount: number,
    evolved: boolean,
    ctx: WeaponUpdateContext
  ): number {
    let curX = first.x;
    let curY = first.y;
    let curDmg = startDmg;
    this.applyArcHit(first, originX, originY, curDmg, evolved, ctx);

    for (let j = 0; j < remainingJumps; j++) {
      if (visitedCount >= MAX_CHAIN_VISITED) break;
      const next = this.findNextChainEnemy(curX, curY, 190, visitedCount, ctx);
      if (!next) break;
      this.chainVisited[visitedCount++] = next.poolIndex;
      const nx = next.x;
      const ny = next.y;
      curDmg *= 0.94;
      this.applyArcHit(next, curX, curY, curDmg, evolved, ctx);
      curX = nx;
      curY = ny;
    }
    return visitedCount;
  }

  private applyArcHit(
    enemy: EnemyEntity,
    fromX: number,
    fromY: number,
    baseDmg: number,
    evolved: boolean,
    ctx: WeaponUpdateContext
  ): void {
    const { stats, rng, particles } = ctx;
    const isCrit = evolved ? true : rng.chance(stats.critChance);
    const dmg = evolved
      ? baseDmg * 2.5
      : baseDmg * (isCrit ? stats.critMultiplier : 1.0);

    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const kb = 60 * stats.knockbackMult;

    particles.emitBeam(
      fromX,
      fromY,
      enemy.x,
      enemy.y,
      evolved ? '#67E8F9' : '#38BDF8',
      evolved ? 4.2 : 2.8,
      0.16,
      true
    );
    particles.emitBurst(enemy.x, enemy.y, evolved ? 5 : 3, '#38BDF8', 130, 2.5, 0.2);

    ctx.damageEnemy(
      enemy,
      dmg,
      isCrit,
      (dx / dist) * kb,
      (dy / dist) * kb,
      'arc_tessitura'
    );

    if (evolved && enemy.active && !enemy.isBoss) {
      enemy.stunTimer = Math.max(enemy.stunTimer, 0.18);
    }
  }

  private findNextChainEnemy(
    x: number,
    y: number,
    range: number,
    visitedCount: number,
    ctx: WeaponUpdateContext
  ): EnemyEntity | null {
    const { enemies, grid } = ctx;
    const count = grid.queryRadius(x, y, range, this.queryBuf);
    const rangeSq = range * range;
    let best: EnemyEntity | null = null;
    let bestDistSq = rangeSq;

    for (let i = 0; i < count; i++) {
      const idx = this.queryBuf[i];
      if (idx < 0 || idx >= enemies.items.length) continue;
      const enemy = enemies.items[idx];
      if (!enemy || !enemy.active) continue;
      if (this.isChainVisited(enemy.poolIndex, visitedCount)) continue;

      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = enemy;
      }
    }

    return best;
  }

  private isChainVisited(poolIndex: number, count: number): boolean {
    for (let i = 0; i < count; i++) {
      if (this.chainVisited[i] === poolIndex) return true;
    }
    return false;
  }

  private updateSubBassMortar(dt: number, ctx: WeaponUpdateContext): void {
    const rank = this.getInstrumentRank(ctx.upgrades, 'sub_bass_mortar');
    if (rank <= 0) return;

    if (this.mortarTimer > 0) {
      this.mortarTimer -= dt;
    }
    if (this.mortarTimer > 0) return;

    const { player, stats, upgrades, projectiles, rng, audio, particles } = ctx;
    const evolved = this.hasEvolution(upgrades, 'evo_tectonic_drop');
    this.mortarTimer = Math.max(
      0.45,
      (1.85 - rank * 0.14) / stats.fireRateMult
    );

    const target = this.findClusterTarget(player.x, player.y, 480, ctx);
    let targetX: number;
    let targetY: number;
    if (target) {
      targetX = target.x;
      targetY = target.y;
    } else {
      targetX = player.x + Math.cos(player.facingAngle) * 220;
      targetY = player.y + Math.sin(player.facingAngle) * 220;
    }

    const baseAngle = Math.atan2(targetY - player.y, targetX - player.x);
    const dist = Math.min(
      480,
      Math.max(85, Math.hypot(targetX - player.x, targetY - player.y))
    );
    const count = 1 + stats.extraProjectiles;
    const speed = evolved ? 420 : 360;
    const travelLife = dist / speed;
    const aoeRadius = (75 + rank * 14) * stats.aoeMult;
    const baseDmg =
      (44 + rank * 14) * stats.damageMult * (evolved ? 1.3 : 1.0);
    const color = evolved ? '#F59E0B' : '#FB923C';

    for (let i = 0; i < count; i++) {
      const proj = projectiles.acquire();
      if (!proj) break;

      const angle = baseAngle + (i - (count - 1) * 0.5) * 0.24;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const isCrit = rng.chance(stats.critChance);
      const dmg = baseDmg * (isCrit ? stats.critMultiplier : 1);

      proj.isEnemy = false;
      proj.sourceId = 'sub_bass_mortar';
      proj.evolved = evolved;
      proj.x = player.x + cos * 16;
      proj.y = player.y + sin * 16;
      proj.vx = cos * speed;
      proj.vy = sin * speed;
      proj.radius = evolved ? 12 : 9;
      proj.damage = dmg;
      proj.isCrit = isCrit;
      proj.pierceLeft = 0;
      proj.bouncesLeft = 0;
      proj.bounceDamageBonus = 0;
      proj.homingStrength = 0;
      proj.life = travelLife;
      proj.maxLife = travelLife;
      proj.aoeRadius = aoeRadius;
      proj.leavesFaultZone = evolved;
      proj.knockback = (evolved ? 220 : 170) * stats.knockbackMult;
      proj.color = color;
      proj.lastHitEnemyIndex = -1;
    }

    audio.playShoot('sub_bass_mortar', evolved);
    particles.emitDirectional(player.x, player.y, baseAngle, 0.4, 5, color, 160);
  }

  private updateFaultZones(dt: number, ctx: WeaponUpdateContext): void {
    const { faultZones, enemies, grid, stats, rng, particles, audio, upgrades } =
      ctx;
    const active = faultZones.activeIndices;
    if (active.length === 0) return;

    const mortarRank = Math.max(
      1,
      this.getInstrumentRank(upgrades, 'sub_bass_mortar')
    );
    const mortarRefDamage = (44 + mortarRank * 14) * stats.damageMult * 1.3;

    for (let i = active.length - 1; i >= 0; i--) {
      if (i >= active.length) continue;
      const zone = faultZones.items[active[i]];
      if (!zone || !zone.active) continue;

      zone.life -= dt;
      zone.tickTimer -= dt;
      const doTick = zone.tickTimer <= 0;
      if (doTick) {
        zone.tickTimer += 0.3;
      }

      const pullRadius = zone.radius * 1.25;
      const pullRadiusSq = pullRadius * pullRadius;
      const zoneRadiusSq = zone.radius * zone.radius;
      const count = grid.queryRadius(zone.x, zone.y, pullRadius, this.queryBuf);

      for (let k = 0; k < count; k++) {
        const idx = this.queryBuf[k];
        if (idx < 0 || idx >= enemies.items.length) continue;
        const enemy = enemies.items[idx];
        if (!enemy || !enemy.active) continue;

        const dx = zone.x - enemy.x;
        const dy = zone.y - enemy.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= pullRadiusSq && distSq > 4) {
          const dist = Math.sqrt(distSq);
          const pull =
            zone.pullStrength * (1 - enemy.knockbackResist * 0.75) * dt;
          enemy.x += (dx / dist) * pull;
          enemy.y += (dy / dist) * pull;
        }

        if (doTick && distSq <= zoneRadiusSq) {
          const isCrit = rng.chance(stats.critChance);
          const dmg = zone.damagePerTick * (isCrit ? stats.critMultiplier : 1);
          ctx.damageEnemy(enemy, dmg, isCrit, 0, 0, 'sub_bass_mortar');
        }
      }

      if (zone.life <= 0.05 && !zone.megaQuakeDone) {
        zone.megaQuakeDone = true;
        const quakeRadius = zone.radius * 1.35;
        const quakeRadiusSq = quakeRadius * quakeRadius;
        const quakeBase =
          Math.max(zone.damagePerTick * 3.0, mortarRefDamage) * 2.2;

        particles.emitShockwave(
          zone.x,
          zone.y,
          quakeRadius,
          '#F5C451',
          0.38,
          5
        );
        particles.emitBurst(zone.x, zone.y, 18, '#FB923C', 240, 4, 0.35);
        particles.addShake(8);
        audio.playHit(true);

        const qCount = grid.queryRadius(
          zone.x,
          zone.y,
          quakeRadius,
          this.queryBuf
        );
        for (let k = 0; k < qCount; k++) {
          const idx = this.queryBuf[k];
          if (idx < 0 || idx >= enemies.items.length) continue;
          const enemy = enemies.items[idx];
          if (!enemy || !enemy.active) continue;

          const dx = enemy.x - zone.x;
          const dy = enemy.y - zone.y;
          const distSq = dx * dx + dy * dy;
          if (distSq <= quakeRadiusSq) {
            const dist = Math.sqrt(distSq) || 1;
            const isCrit = rng.chance(stats.critChance);
            const dmg = quakeBase * (isCrit ? stats.critMultiplier : 1);
            const kb = 210 * stats.knockbackMult;
            ctx.damageEnemy(
              enemy,
              dmg,
              isCrit,
              (dx / dist) * kb,
              (dy / dist) * kb,
              'sub_bass_mortar'
            );
          }
        }
      }

      if (zone.life <= 0) {
        faultZones.release(zone);
      }
    }
  }

  private updateStandingLance(dt: number, ctx: WeaponUpdateContext): void {
    const rank = this.getInstrumentRank(ctx.upgrades, 'standing_lance');
    if (rank <= 0) return;

    if (this.lanceTimer > 0) {
      this.lanceTimer -= dt;
    }
    if (this.lanceTimer > 0) return;

    const { player, stats, upgrades, audio, particles } = ctx;
    const evolved = this.hasEvolution(upgrades, 'evo_prism_singularity');
    this.lanceTimer = Math.max(0.35, (2.1 - rank * 0.15) / stats.fireRateMult);

    const target = this.findLanceTarget(player.x, player.y, 560, ctx);
    const baseAngle = target
      ? Math.atan2(target.y - player.y, target.x - player.x)
      : player.facingAngle;

    const beamWidth = 16 * stats.aoeMult;
    const halfWidth = beamWidth * 0.5;
    const range = 560;
    const baseDmg =
      (48 + rank * 16) * stats.damageMult * (evolved ? 1.25 : 1.0);

    if (evolved) {
      const count = 3 + stats.extraProjectiles;
      const spread = 0.24;
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i - (count - 1) * 0.5) * spread;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        const hit = this.raycastArenaWall(player.x, player.y, dx, dy);
        const hx = player.x + dx * hit.t;
        const hy = player.y + dy * hit.t;

        particles.emitBeam(player.x, player.y, hx, hy, '#C084FC', beamWidth, 0.24, false);
        particles.emitBeam(player.x, player.y, hx, hy, '#FDE047', beamWidth * 0.45, 0.22, false);
        this.damageEnemiesAlongSegment(
          player.x,
          player.y,
          hx,
          hy,
          halfWidth,
          baseDmg,
          true,
          ctx
        );

        const rdx = hit.hitX ? -dx : dx;
        const rdy = hit.hitY ? -dy : dy;
        const bounceHit = this.raycastArenaWall(hx, hy, rdx, rdy);
        const seg2Len = Math.min(900, bounceHit.t);
        const x2 = hx + rdx * seg2Len;
        const y2 = hy + rdy * seg2Len;

        particles.emitBurst(hx, hy, 5, '#FDE047', 160, 3, 0.22);
        particles.emitBeam(hx, hy, x2, y2, '#C084FC', beamWidth * 0.85, 0.24, false);
        particles.emitBeam(hx, hy, x2, y2, '#FDE047', beamWidth * 0.4, 0.22, false);
        this.damageEnemiesAlongSegment(
          hx,
          hy,
          x2,
          y2,
          halfWidth,
          baseDmg * 0.9,
          true,
          ctx
        );
      }
    } else {
      const count = 1 + stats.extraProjectiles;
      const spread = 0.14;
      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i - (count - 1) * 0.5) * spread;
        const x2 = player.x + Math.cos(angle) * range;
        const y2 = player.y + Math.sin(angle) * range;

        particles.emitBeam(player.x, player.y, x2, y2, '#38BDF8', beamWidth, 0.2, false);
        particles.emitBeam(player.x, player.y, x2, y2, '#E0F2FE', beamWidth * 0.4, 0.18, false);
        this.damageEnemiesAlongSegment(
          player.x,
          player.y,
          x2,
          y2,
          halfWidth,
          baseDmg,
          false,
          ctx
        );
      }
    }

    audio.playShoot('standing_lance', evolved);
  }

  private raycastArenaWall(
    x: number,
    y: number,
    dx: number,
    dy: number
  ): { t: number; hitX: boolean; hitY: boolean } {
    const tx =
      dx > 1e-6
        ? (ARENA_WIDTH - x) / dx
        : dx < -1e-6
          ? (0 - x) / dx
          : Infinity;
    const ty =
      dy > 1e-6
        ? (ARENA_HEIGHT - y) / dy
        : dy < -1e-6
          ? (0 - y) / dy
          : Infinity;

    const hitX = tx <= ty + 1e-3;
    const hitY = ty <= tx + 1e-3;
    const rawT = Math.min(tx, ty);
    const t = Number.isFinite(rawT) ? Math.max(1, rawT) : 560;
    return { t, hitX, hitY };
  }

  private damageEnemiesAlongSegment(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    halfWidth: number,
    baseDamage: number,
    evolved: boolean,
    ctx: WeaponUpdateContext
  ): void {
    const abx = bx - ax;
    const aby = by - ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq < 1e-4) return;

    const invAbLenSq = 1 / abLenSq;
    const abLen = Math.sqrt(abLenSq);
    const dirX = abx / abLen;
    const dirY = aby / abLen;
    const { enemies, stats, rng, particles } = ctx;
    const kb = (evolved ? 95 : 75) * stats.knockbackMult;
    const active = enemies.activeIndices;

    for (let i = active.length - 1; i >= 0; i--) {
      if (i >= active.length) continue;
      const enemy = enemies.items[active[i]];
      if (!enemy || !enemy.active) continue;

      const apx = enemy.x - ax;
      const apy = enemy.y - ay;
      let t = (apx * abx + apy * aby) * invAbLenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;

      const cx = ax + abx * t;
      const cy = ay + aby * t;
      const dx = enemy.x - cx;
      const dy = enemy.y - cy;
      const hitR = halfWidth + enemy.radius;
      if (dx * dx + dy * dy <= hitR * hitR) {
        const isCrit = rng.chance(stats.critChance);
        const dmg = baseDamage * (isCrit ? stats.critMultiplier : 1);
        ctx.damageEnemy(
          enemy,
          dmg,
          isCrit,
          dirX * kb,
          dirY * kb,
          'standing_lance'
        );
        particles.emitBurst(
          enemy.x,
          enemy.y,
          4,
          evolved ? '#FDE047' : '#38BDF8',
          130,
          2.5,
          0.2
        );
      }
    }
  }

  private findNearestEnemy(
    x: number,
    y: number,
    maxRange: number,
    ctx: WeaponUpdateContext
  ): EnemyEntity | null {
    const { enemies, grid } = ctx;
    const maxRangeSq = maxRange * maxRange;
    const queryRange = Math.min(maxRange, 420);
    const count = grid.queryRadius(x, y, queryRange, this.queryBuf);

    let best: EnemyEntity | null = null;
    let bestDistSq = maxRangeSq;

    for (let i = 0; i < count; i++) {
      const idx = this.queryBuf[i];
      if (idx < 0 || idx >= enemies.items.length) continue;
      const enemy = enemies.items[idx];
      if (!enemy || !enemy.active) continue;

      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = enemy;
      }
    }

    if (best && count < this.queryBuf.length) {
      return best;
    }

    if (!best && maxRange <= queryRange) {
      return null;
    }

    const active = enemies.activeIndices;
    for (let i = 0; i < active.length; i++) {
      const enemy = enemies.items[active[i]];
      if (!enemy || !enemy.active) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = enemy;
      }
    }

    return best;
  }

  private findClusterTarget(
    x: number,
    y: number,
    range: number,
    ctx: WeaponUpdateContext
  ): EnemyEntity | null {
    const { enemies, grid } = ctx;
    const count = grid.queryRadius(x, y, range, this.queryBuf);
    if (count === 0) {
      return this.findNearestEnemy(x, y, 1600, ctx);
    }

    const sampleCount = Math.min(count, 16);
    const clusterRadiusSq = 115 * 115;
    let best: EnemyEntity | null = null;
    let bestScore = -1;

    for (let i = 0; i < sampleCount; i++) {
      const idx = this.queryBuf[i];
      if (idx < 0 || idx >= enemies.items.length) continue;
      const cand = enemies.items[idx];
      if (!cand || !cand.active) continue;

      let neighbors = 0;
      for (let j = 0; j < sampleCount; j++) {
        if (i === j) continue;
        const other = enemies.items[this.queryBuf[j]];
        if (!other || !other.active) continue;
        const dx = other.x - cand.x;
        const dy = other.y - cand.y;
        if (dx * dx + dy * dy <= clusterRadiusSq) {
          neighbors++;
        }
      }

      const dist = Math.hypot(cand.x - x, cand.y - y);
      const score = neighbors * 100 - dist * 0.1;
      if (!best || score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    return best ?? this.findNearestEnemy(x, y, 1600, ctx);
  }

  private findLanceTarget(
    x: number,
    y: number,
    range: number,
    ctx: WeaponUpdateContext
  ): EnemyEntity | null {
    const { enemies } = ctx;
    const rangeSq = range * range;
    const active = enemies.activeIndices;

    let bestInRange: EnemyEntity | null = null;
    let bestHp = -1;
    let bestDistSq = Infinity;

    for (let i = 0; i < active.length; i++) {
      const enemy = enemies.items[active[i]];
      if (!enemy || !enemy.active) continue;

      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= rangeSq) {
        if (
          enemy.hp > bestHp ||
          (enemy.hp === bestHp && distSq < bestDistSq)
        ) {
          bestHp = enemy.hp;
          bestDistSq = distSq;
          bestInRange = enemy;
        }
      }
    }

    if (bestInRange) return bestInRange;
    return this.findNearestEnemy(x, y, 1600, ctx);
  }

  private getInstrumentRank(upgrades: RunUpgrades, id: InstrumentId): number {
    const rank = upgrades.ranks[id] ?? 0;
    if (rank > 0) return rank;
    for (let i = 0; i < upgrades.activeInstruments.length; i++) {
      if (upgrades.activeInstruments[i] === id) return 1;
    }
    return 0;
  }

  private hasEvolution(upgrades: RunUpgrades, id: EvolutionId): boolean {
    for (let i = 0; i < upgrades.evolutions.length; i++) {
      if (upgrades.evolutions[i] === id) return true;
    }
    return false;
  }

  private hasRelic(upgrades: RunUpgrades, id: RelicId): boolean {
    for (let i = 0; i < upgrades.relics.length; i++) {
      if (upgrades.relics[i] === id) return true;
    }
    return false;
  }
}
