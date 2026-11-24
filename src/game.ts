import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ComputedStats,
  type EnemyEntity,
  type FaultZoneEntity,
  type GamePhase,
  type HUDState,
  type MetaBonuses,
  type MetaUpgradeId,
  type PickupEntity,
  type PlayerState,
  type ProjectileEntity,
  type RenderState,
  type RunSummary,
  type RunUpgrades,
  type SaveSettings,
  type UpgradeDraftOption,
  type UpgradeId,
  type WaveConfig,
} from './types';
import { SeededRNG } from './core/rng';
import { ObjectPool } from './core/pool';
import { SpatialGrid } from './core/spatial-grid';
import { StorageManager } from './core/storage';
import {
  UPGRADE_DEFS,
  META_UPGRADE_DEFS,
  rollUpgradeChoices,
  applyUpgradePick,
} from './data/upgrades';
import { ENEMY_DEFS } from './data/enemies';
import { getWaveConfig } from './data/waves';
import { InputController } from './systems/input';
import { SynthAudio } from './systems/audio';
import { WeaponSystem, type WeaponUpdateContext } from './systems/weapons';
import { EnemySystem, type EnemyUpdateContext } from './systems/enemies';
import { JuiceAndParticles } from './systems/particles';
import { CymaticRenderer } from './systems/renderer';
import { GameUI } from './ui/hud';

const MAX_ENEMIES = 360;
const MAX_PROJECTILES = 560;
const MAX_FAULT_ZONES = 24;
const MAX_PICKUPS = 280;
const PICKUP_MERGE_THRESHOLD = 230;
const GRID_CELL_SIZE = 96;
const GRID_MAX_ENTITIES = 512;
const COLLISION_BUF_SIZE = 96;

const PLAYER_RADIUS = 15;
const ARENA_PADDING = 12;
const SHIELD_REGEN_DELAY = 3.5;
const PICKUP_COMBO_WINDOW = 0.7;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function computeXpToNext(level: number): number {
  return Math.floor(22 + level * 14 + Math.pow(level, 1.55) * 4.5);
}

function createEnemy(poolIndex: number): EnemyEntity {
  return {
    active: false,
    poolIndex,
    type: 'static_mite',
    isBoss: false,
    isElite: false,
    affix: 'none',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 12,
    hp: 0,
    maxHp: 0,
    speed: 0,
    damage: 0,
    xpValue: 0,
    brassChance: 0,
    knockbackResist: 0,
    color: '#38BDF8',
    accentColor: '#BAE6FD',
    hitFlash: 0,
    dampened: false,
    aiTimer: 0,
    aiPhase: 0,
    fireTimer: 0,
    dashVx: 0,
    dashVy: 0,
    dashTimer: 0,
    telegraphTimer: 0,
    telegraphDuration: 0,
    telegraphX: 0,
    telegraphY: 0,
    telegraphAngle: 0,
    telegraphKind: 'none',
    laserActiveTimer: 0,
    armorAngle: 0,
    stunTimer: 0,
  };
}

function resetEnemy(e: EnemyEntity): void {
  e.type = 'static_mite';
  e.isBoss = false;
  e.isElite = false;
  e.affix = 'none';
  e.x = 0;
  e.y = 0;
  e.vx = 0;
  e.vy = 0;
  e.radius = 12;
  e.hp = 0;
  e.maxHp = 0;
  e.speed = 0;
  e.damage = 0;
  e.xpValue = 0;
  e.brassChance = 0;
  e.knockbackResist = 0;
  e.hitFlash = 0;
  e.dampened = false;
  e.aiTimer = 0;
  e.aiPhase = 0;
  e.fireTimer = 0;
  e.dashVx = 0;
  e.dashVy = 0;
  e.dashTimer = 0;
  e.telegraphTimer = 0;
  e.telegraphDuration = 0;
  e.telegraphX = 0;
  e.telegraphY = 0;
  e.telegraphAngle = 0;
  e.telegraphKind = 'none';
  e.laserActiveTimer = 0;
  e.armorAngle = 0;
  e.stunTimer = 0;
}

function createProjectile(poolIndex: number): ProjectileEntity {
  return {
    active: false,
    poolIndex,
    isEnemy: false,
    sourceId: 'strike_ping',
    evolved: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 5,
    damage: 0,
    isCrit: false,
    pierceLeft: 0,
    bouncesLeft: 0,
    bounceDamageBonus: 0,
    homingStrength: 0,
    life: 0,
    maxLife: 1,
    aoeRadius: 0,
    leavesFaultZone: false,
    knockback: 0,
    color: '#F5C451',
    lastHitEnemyIndex: -1,
  };
}

function resetProjectile(p: ProjectileEntity): void {
  p.isEnemy = false;
  p.sourceId = 'strike_ping';
  p.evolved = false;
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.radius = 5;
  p.damage = 0;
  p.isCrit = false;
  p.pierceLeft = 0;
  p.bouncesLeft = 0;
  p.bounceDamageBonus = 0;
  p.homingStrength = 0;
  p.life = 0;
  p.maxLife = 1;
  p.aoeRadius = 0;
  p.leavesFaultZone = false;
  p.knockback = 0;
  p.color = '#F5C451';
  p.lastHitEnemyIndex = -1;
}

function createFaultZone(poolIndex: number): FaultZoneEntity {
  return {
    active: false,
    poolIndex,
    x: 0,
    y: 0,
    radius: 80,
    life: 0,
    maxLife: 1,
    damagePerTick: 0,
    tickTimer: 0,
    pullStrength: 0,
    megaQuakeDone: false,
    evolved: true,
  };
}

function resetFaultZone(z: FaultZoneEntity): void {
  z.x = 0;
  z.y = 0;
  z.radius = 80;
  z.life = 0;
  z.maxLife = 1;
  z.damagePerTick = 0;
  z.tickTimer = 0;
  z.pullStrength = 0;
  z.megaQuakeDone = false;
  z.evolved = true;
}

function createPickup(poolIndex: number): PickupEntity {
  return {
    active: false,
    poolIndex,
    kind: 'xp',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    value: 0,
    magnetized: false,
    bobPhase: 0,
    life: 0,
  };
}

function resetPickup(p: PickupEntity): void {
  p.kind = 'xp';
  p.x = 0;
  p.y = 0;
  p.vx = 0;
  p.vy = 0;
  p.value = 0;
  p.magnetized = false;
  p.bobPhase = 0;
  p.life = 0;
}

/**
 * Top-level game coordinator owning pools, simulation, collisions, waves, and lifecycle.
 */
export class Game {
  private readonly enemies = new ObjectPool<EnemyEntity>(
    MAX_ENEMIES,
    createEnemy,
    resetEnemy
  );
  private readonly projectiles = new ObjectPool<ProjectileEntity>(
    MAX_PROJECTILES,
    createProjectile,
    resetProjectile
  );
  private readonly faultZones = new ObjectPool<FaultZoneEntity>(
    MAX_FAULT_ZONES,
    createFaultZone,
    resetFaultZone
  );
  private readonly pickups = new ObjectPool<PickupEntity>(
    MAX_PICKUPS,
    createPickup,
    resetPickup
  );
  private readonly grid = new SpatialGrid(
    ARENA_WIDTH,
    ARENA_HEIGHT,
    GRID_CELL_SIZE,
    GRID_MAX_ENTITIES
  );
  private readonly collisionBuf = new Int32Array(COLLISION_BUF_SIZE);
  private readonly queryBuf = new Int32Array(COLLISION_BUF_SIZE);

  private readonly storage: StorageManager;
  private readonly audio: SynthAudio;
  private readonly particles: JuiceAndParticles;
  private readonly weaponSystem: WeaponSystem;
  private readonly enemySystem: EnemySystem;
  private readonly renderer: CymaticRenderer;
  private readonly input: InputController;
  private readonly ui: GameUI;

  private rng = new SeededRNG();
  private phase: GamePhase = 'title';
  private metaBonuses: MetaBonuses;
  private runUpgrades: RunUpgrades = {
    ranks: { strike_ping: 1 },
    activeInstruments: ['strike_ping'],
    evolutions: [],
    relics: [],
    bonusDamageStacks: 0,
  };
  private wave: WaveConfig;
  private stats: ComputedStats;
  private readonly player: PlayerState;

  private score = 0;
  private kills = 0;
  private bossesKilled = 0;
  private brassCollected = 0;
  private timeSurvivedSec = 0;
  private waveElapsed = 0;
  private elapsedTime = 0;
  private smoothedFps = 60;
  private pendingLevelUps = 0;
  private currentChoices: UpgradeDraftOption[] = [];
  private pickupComboStep = 0;
  private pickupComboTimer = 0;
  private wasAnchored = false;
  private activeBoss: EnemyEntity | null = null;

  private rafId: number | null = null;
  private lastTime = 0;
  private destroyed = false;

  private readonly weaponCtx: WeaponUpdateContext;
  private readonly enemyCtx: EnemyUpdateContext;
  private readonly renderState: RenderState;
  private readonly hudState: HUDState;

  private readonly onResizeBound: () => void;
  private readonly onVisibilityChangeBound: () => void;
  private readonly onFrameBound: (now: number) => void;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.storage = new StorageManager(META_UPGRADE_DEFS);
    this.audio = new SynthAudio();
    this.particles = new JuiceAndParticles();
    this.weaponSystem = new WeaponSystem();
    this.enemySystem = new EnemySystem(ENEMY_DEFS);
    this.renderer = new CymaticRenderer(canvas);

    this.metaBonuses = this.storage.computeBonuses();
    this.wave = getWaveConfig(1, this.rng);

    this.player = {
      x: ARENA_WIDTH * 0.5,
      y: ARENA_HEIGHT * 0.5,
      vx: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 0,
      shieldRegenTimer: 0,
      xp: 0,
      xpToNext: computeXpToNext(1),
      level: 1,
      invulnTimer: 0,
      hurtFlash: 0,
      isAnchored: false,
      anchorTimer: 0,
      overdriveCharge: 35,
      rerollsLeft: 0,
      feedbackStacks: 0,
      feedbackTimer: 0,
      facingAngle: -Math.PI * 0.5,
      orbitalAngle: 0,
    };

    this.stats = this.weaponSystem.computeStats(
      this.metaBonuses,
      this.runUpgrades,
      this.player,
      this.wave.modifier
    );

    this.input = new InputController(canvas, {
      onFirstGesture: () => {
        this.audio.unlock();
      },
      onPauseRequest: () => {
        this.handlePauseToggle();
      },
      onQuickPickUpgrade: (index) => {
        if (this.phase === 'levelup' && index < this.currentChoices.length) {
          this.handleSelectUpgrade(this.currentChoices[index].def.id);
        }
      },
      onOverdriveKey: () => {
        this.handleTriggerOverdrive();
      },
      onVisibilityHidden: () => {
        this.handleVisibilityHidden();
      },
    });
    this.input.setGameplayActive(false);

    this.ui = new GameUI(
      uiRoot,
      {
        onStartRun: () => {
          this.audio.unlock();
          this.audio.playButton();
          this.startRun();
        },
        onSelectUpgrade: (id) => {
          this.handleSelectUpgrade(id);
        },
        onRerollUpgrades: () => {
          this.handleRerollUpgrades();
        },
        onTriggerOverdrive: () => {
          this.handleTriggerOverdrive();
        },
        onPauseToggle: () => {
          this.handlePauseToggle();
        },
        onResume: () => {
          this.audio.unlock();
          this.audio.playButton();
          this.resumeGame();
        },
        onAbandonRun: () => {
          this.audio.playButton();
          this.finishRun();
        },
        onBuyMetaUpgrade: (id) => this.handleBuyMetaUpgrade(id),
        onToggleSetting: (key) => {
          this.handleToggleSetting(key);
        },
      },
      META_UPGRADE_DEFS,
      UPGRADE_DEFS,
      (id) => this.storage.getUpgradeCost(id)
    );

    this.weaponCtx = {
      player: this.player,
      stats: this.stats,
      upgrades: this.runUpgrades,
      enemies: this.enemies,
      projectiles: this.projectiles,
      faultZones: this.faultZones,
      grid: this.grid,
      rng: this.rng,
      audio: this.audio,
      particles: this.particles,
      damageEnemy: this.damageEnemy,
    };

    this.enemyCtx = {
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      grid: this.grid,
      wave: this.wave,
      rng: this.rng,
      audio: this.audio,
      particles: this.particles,
      damagePlayer: this.damagePlayer,
    };

    const initialInput = this.input.update(0);
    this.renderState = {
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      faultZones: this.faultZones,
      pickups: this.pickups,
      orbitals: this.weaponSystem.getOrbitals(),
      particles: this.particles,
      input: initialInput,
      wave: this.wave,
      stats: this.stats,
      time: 0,
    };

    this.hudState = {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      maxShield: this.player.maxShield,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      level: this.player.level,
      wave: this.wave.wave,
      waveTimeRemaining: this.wave.duration,
      isBossWave: this.wave.isBossWave,
      frequencyHz: this.wave.frequencyHz,
      chladniN: this.wave.chladniN,
      chladniM: this.wave.chladniM,
      modifierLabel: this.wave.modifierLabel,
      score: 0,
      brassThisRun: 0,
      kills: 0,
      overdriveCharge: this.player.overdriveCharge,
      isAnchored: false,
      feedbackStacks: 0,
      activeBossName: null,
      activeBossHp: 0,
      activeBossMaxHp: 0,
      fps: 60,
    };

    const saveData = this.storage.getData();
    this.audio.setSettings(saveData.settings.sfx, saveData.settings.music);
    this.ui.showTitle(saveData);

    this.onResizeBound = () => {
      this.renderer.resize();
    };
    this.onVisibilityChangeBound = () => {
      this.handleVisibilityChange();
    };
    this.onFrameBound = (now: number) => {
      this.tick(now);
    };

    window.addEventListener('resize', this.onResizeBound);
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);

    this.lastTime = performance.now();
    if (!document.hidden) {
      this.ensureLoopRunning();
    }
  }

  public setOfflineReady(ready: boolean): void {
    this.ui.setOfflineReady(ready);
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public startRun(seed?: number): void {
    this.rng = new SeededRNG(seed);
    this.metaBonuses = this.storage.computeBonuses();

    this.enemies.clear();
    this.projectiles.clear();
    this.faultZones.clear();
    this.pickups.clear();
    this.grid.clear();
    this.particles.clear();
    this.weaponSystem.reset();

    this.runUpgrades = {
      ranks: { strike_ping: 1 },
      activeInstruments: ['strike_ping'],
      evolutions: [],
      relics: [],
      bonusDamageStacks: 0,
    };

    this.score = 0;
    this.kills = 0;
    this.bossesKilled = 0;
    this.brassCollected = 0;
    this.timeSurvivedSec = 0;
    this.waveElapsed = 0;
    this.pendingLevelUps = 0;
    this.currentChoices = [];
    this.pickupComboStep = 0;
    this.pickupComboTimer = 0;
    this.wasAnchored = false;
    this.activeBoss = null;

    this.wave = getWaveConfig(1, this.rng);

    this.player.x = ARENA_WIDTH * 0.5;
    this.player.y = ARENA_HEIGHT * 0.5;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.radius = PLAYER_RADIUS;
    this.player.xp = 0;
    this.player.level = 1;
    this.player.xpToNext = computeXpToNext(1);
    this.player.invulnTimer = 0.5;
    this.player.hurtFlash = 0;
    this.player.isAnchored = false;
    this.player.anchorTimer = 0;
    this.player.overdriveCharge = 35;
    this.player.rerollsLeft = this.metaBonuses.startingRerolls;
    this.player.feedbackStacks = 0;
    this.player.feedbackTimer = 0;
    this.player.shieldRegenTimer = 0;
    this.player.facingAngle = -Math.PI * 0.5;
    this.player.orbitalAngle = 0;

    this.stats = this.weaponSystem.computeStats(
      this.metaBonuses,
      this.runUpgrades,
      this.player,
      this.wave.modifier
    );
    this.player.maxHp = this.stats.maxHp;
    this.player.hp = this.stats.maxHp;
    this.player.maxShield = this.stats.maxShield;
    this.player.shield = this.stats.maxShield;

    this.syncContexts();
    this.enemySystem.resetForWave(this.wave);
    this.renderer.bakeChladniPlate(
      this.wave.chladniN,
      this.wave.chladniM,
      this.wave.accentColor
    );

    this.phase = 'playing';
    this.input.setGameplayActive(true);
    this.audio.setSuspended(false);
    this.ui.setPhase('playing', this.storage.getData(), this.runUpgrades);
    this.ui.showWaveBanner(this.wave);
    this.audio.startMusic(this.wave.frequencyHz);
    this.updateHUD();
    this.ensureLoopRunning();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.audio.stopMusic();
    this.input.destroy();
    window.removeEventListener('resize', this.onResizeBound);
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  private ensureLoopRunning(): void {
    if (this.destroyed || document.hidden || this.rafId !== null) return;
    this.lastTime = performance.now();
    this.rafId = window.requestAnimationFrame(this.onFrameBound);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleVisibilityHidden(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.input.setGameplayActive(false);
      this.ui.setPhase('paused', this.storage.getData(), this.runUpgrades);
    }
    this.audio.setSuspended(true);
    if (document.hidden) {
      this.stopLoop();
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden || document.visibilityState === 'hidden') {
      this.handleVisibilityHidden();
    } else {
      if (this.phase !== 'paused') {
        this.audio.setSuspended(false);
      }
      this.ensureLoopRunning();
    }
  }

  private tick(now: number): void {
    this.rafId = null;
    if (this.destroyed || document.hidden) return;

    const rawDeltaSec = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const rawDt = Math.min(0.05, rawDeltaSec);

    if (rawDeltaSec > 0.0005 && rawDeltaSec < 0.25) {
      const instFps = 1 / rawDeltaSec;
      this.smoothedFps = this.smoothedFps * 0.9 + instFps * 0.1;
    }

    this.elapsedTime += rawDt;

    if (this.phase === 'playing') {
      this.particles.update(rawDt);
      if (!this.particles.isHitStopped && rawDt > 0) {
        this.updatePlaying(rawDt);
      }
      this.updateHUD();
      this.syncRenderState();
      this.renderer.render(this.renderState);
    } else if (this.phase === 'title') {
      this.renderer.renderTitleBackground(this.elapsedTime);
    } else {
      this.syncRenderState();
      this.renderer.render(this.renderState);
    }

    this.ensureLoopRunning();
  }

  private syncContexts(): void {
    this.weaponCtx.stats = this.stats;
    this.weaponCtx.upgrades = this.runUpgrades;
    this.weaponCtx.rng = this.rng;

    this.enemyCtx.wave = this.wave;
    this.enemyCtx.rng = this.rng;
  }

  private syncRenderState(): void {
    this.renderState.wave = this.wave;
    this.renderState.stats = this.stats;
    this.renderState.time = this.timeSurvivedSec;
  }

  private updatePlaying(dt: number): void {
    this.timeSurvivedSec += dt;
    this.waveElapsed += dt;

    const inputSnap = this.input.update(dt);
    const anchorThreshold = this.stats.anchorShockwave ? 0.11 : 0.22;
    const isAnchored = !inputSnap.isMoving && inputSnap.stillDuration >= anchorThreshold;
    inputSnap.isAnchored = isAnchored;
    this.player.isAnchored = isAnchored;
    this.player.anchorTimer = inputSnap.stillDuration;

    if (isAnchored && !this.wasAnchored) {
      this.audio.playAnchorLock();
      this.particles.emitShockwave(this.player.x, this.player.y, 46, '#38BDF8', 0.26, 2.5);
    }
    this.wasAnchored = isAnchored;
    this.renderState.input = inputSnap;

    // Recompute stats so Anchor Stance & Feedback stacks immediately affect cadence
    this.stats = this.weaponSystem.computeStats(
      this.metaBonuses,
      this.runUpgrades,
      this.player,
      this.wave.modifier
    );
    this.syncContexts();

    // Player timers
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer = Math.max(0, this.player.invulnTimer - dt);
    }
    if (this.player.hurtFlash > 0) {
      this.player.hurtFlash = Math.max(0, this.player.hurtFlash - dt);
    }
    if (this.player.feedbackStacks > 0) {
      this.player.feedbackTimer -= dt;
      if (this.player.feedbackTimer <= 0) {
        this.player.feedbackStacks = Math.max(0, this.player.feedbackStacks - 1);
        this.player.feedbackTimer = this.player.feedbackStacks > 0 ? 0.45 : 0;
      }
    }

    // Quartz Barrier regeneration
    if (this.stats.maxShield > 0) {
      if (this.player.shieldRegenTimer > 0) {
        this.player.shieldRegenTimer = Math.max(0, this.player.shieldRegenTimer - dt);
      } else if (this.player.shield < this.stats.maxShield) {
        const regenRate = Math.max(8, this.stats.maxShield * 0.35);
        this.player.shield = Math.min(
          this.stats.maxShield,
          this.player.shield + regenRate * dt
        );
      }
    }

    // Player movement clamped within brass boundary rails
    const moveVx = inputSnap.moveX * this.stats.moveSpeed;
    const moveVy = inputSnap.moveY * this.stats.moveSpeed;
    this.player.vx = moveVx;
    this.player.vy = moveVy;

    const minBound = this.player.radius + ARENA_PADDING;
    const maxBoundX = ARENA_WIDTH - this.player.radius - ARENA_PADDING;
    const maxBoundY = ARENA_HEIGHT - this.player.radius - ARENA_PADDING;
    this.player.x = clamp(this.player.x + moveVx * dt, minBound, maxBoundX);
    this.player.y = clamp(this.player.y + moveVy * dt, minBound, maxBoundY);

    if (inputSnap.isMoving) {
      this.player.facingAngle = Math.atan2(moveVy, moveVx);
    }

    if (this.input.consumeOverdrivePress()) {
      this.handleTriggerOverdrive();
    }

    // Rebuild spatial grid for current enemy positions
    this.grid.clear();
    const enemyIndices = this.enemies.activeIndices;
    const enemyCount = this.enemies.activeCount;
    const enemyItems = this.enemies.items;
    for (let i = 0; i < enemyCount; i++) {
      const idx = enemyIndices[i];
      const e = enemyItems[idx];
      if (e.active) {
        this.grid.insert(idx, e.x, e.y);
      }
    }

    this.weaponSystem.update(dt, this.weaponCtx);
    const enemyResult = this.enemySystem.update(dt, this.enemyCtx);
    this.activeBoss = enemyResult.activeBoss;

    if (this.phase !== 'playing') {
      return;
    }

    this.updateProjectiles(dt);
    this.updatePickups(dt);

    if (this.phase !== 'playing') {
      return;
    }

    if (this.pendingLevelUps > 0 || this.player.xp >= this.player.xpToNext) {
      this.consumePendingXpLevels();
      if (this.pendingLevelUps > 0) {
        this.openNextLevelUpDraft();
        return;
      }
    }

    if (enemyResult.waveCleared) {
      this.advanceWave();
    }
  }

  private updateProjectiles(dt: number): void {
    const active = this.projectiles.activeIndices;
    const items = this.projectiles.items;

    for (let i = active.length - 1; i >= 0; i--) {
      if (i >= active.length) continue;
      const proj = items[active[i]];
      if (!proj || !proj.active) continue;

      proj.life -= dt;

      if (!proj.isEnemy && proj.aoeRadius > 0 && proj.life <= 0.04) {
        this.detonateMortar(proj);
        this.projectiles.releaseByIndex(proj.poolIndex);
        continue;
      }

      if (proj.life <= 0) {
        this.projectiles.releaseByIndex(proj.poolIndex);
        continue;
      }

      if (!proj.isEnemy && proj.homingStrength > 0) {
        this.applyProjectileHoming(proj, dt);
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Arena rail collision / bounce
      let hitWallX = false;
      let hitWallY = false;
      if (proj.x < proj.radius) {
        proj.x = proj.radius;
        hitWallX = true;
      } else if (proj.x > ARENA_WIDTH - proj.radius) {
        proj.x = ARENA_WIDTH - proj.radius;
        hitWallX = true;
      }
      if (proj.y < proj.radius) {
        proj.y = proj.radius;
        hitWallY = true;
      } else if (proj.y > ARENA_HEIGHT - proj.radius) {
        proj.y = ARENA_HEIGHT - proj.radius;
        hitWallY = true;
      }

      if (hitWallX || hitWallY) {
        if (!proj.isEnemy && proj.bouncesLeft > 0) {
          if (hitWallX) proj.vx = -proj.vx;
          if (hitWallY) proj.vy = -proj.vy;
          proj.bouncesLeft--;
          proj.damage *= 1 + proj.bounceDamageBonus;
          proj.lastHitEnemyIndex = -1;
          this.particles.emitBurst(proj.x, proj.y, 4, '#F5C451', 120, 2.5, 0.16);
        } else {
          if (!proj.isEnemy && proj.aoeRadius > 0) {
            this.detonateMortar(proj);
          }
          this.projectiles.releaseByIndex(proj.poolIndex);
          continue;
        }
      }

      if (proj.isEnemy) {
        const dx = this.player.x - proj.x;
        const dy = this.player.y - proj.y;
        const hitR = this.player.radius + proj.radius - 2;
        if (dx * dx + dy * dy <= hitR * hitR) {
          this.damagePlayer(proj.damage, proj.x, proj.y);
          this.projectiles.releaseByIndex(proj.poolIndex);
        }
        continue;
      }

      // Player projectile collision against enemies via spatial grid
      const hitCount = this.grid.queryRadius(
        proj.x,
        proj.y,
        proj.radius + 54,
        this.collisionBuf
      );

      for (let k = 0; k < hitCount; k++) {
        const eIdx = this.collisionBuf[k];
        if (eIdx < 0 || eIdx >= this.enemies.items.length) continue;
        const enemy = this.enemies.items[eIdx];
        if (!enemy || !enemy.active || enemy.hp <= 0) continue;
        if (enemy.poolIndex === proj.lastHitEnemyIndex) continue;

        const dx = enemy.x - proj.x;
        const dy = enemy.y - proj.y;
        const hitR = enemy.radius + proj.radius;
        if (dx * dx + dy * dy > hitR * hitR) continue;

        if (proj.aoeRadius > 0) {
          this.detonateMortar(proj);
          this.projectiles.releaseByIndex(proj.poolIndex);
          break;
        }

        const spd = Math.hypot(proj.vx, proj.vy) || 1;
        const kbX = (proj.vx / spd) * proj.knockback;
        const kbY = (proj.vy / spd) * proj.knockback;
        this.damageEnemy(
          enemy,
          proj.damage,
          proj.isCrit,
          kbX,
          kbY,
          proj.sourceId
        );

        if (proj.bouncesLeft > 0) {
          proj.bouncesLeft--;
          proj.damage *= 1 + proj.bounceDamageBonus;
          proj.lastHitEnemyIndex = enemy.poolIndex;
          this.ricochetProjectile(proj, enemy);
          break;
        }

        if (proj.pierceLeft > 0) {
          proj.pierceLeft--;
          proj.lastHitEnemyIndex = enemy.poolIndex;
          break;
        }

        this.projectiles.releaseByIndex(proj.poolIndex);
        break;
      }
    }
  }

  private applyProjectileHoming(proj: ProjectileEntity, dt: number): void {
    const searchRange = 340;
    const count = this.grid.queryRadius(proj.x, proj.y, searchRange, this.queryBuf);
    let best: EnemyEntity | null = null;
    let bestDistSq = searchRange * searchRange;

    for (let i = 0; i < count; i++) {
      const idx = this.queryBuf[i];
      if (idx < 0 || idx >= this.enemies.items.length) continue;
      const e = this.enemies.items[idx];
      if (!e || !e.active || e.hp <= 0 || e.poolIndex === proj.lastHitEnemyIndex) {
        continue;
      }
      const dx = e.x - proj.x;
      const dy = e.y - proj.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = e;
      }
    }

    if (!best) return;

    const speed = Math.hypot(proj.vx, proj.vy);
    if (speed <= 0.001) return;

    const currentAngle = Math.atan2(proj.vy, proj.vx);
    const targetAngle = Math.atan2(best.y - proj.y, best.x - proj.x);
    let diff = targetAngle - currentAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = proj.homingStrength * dt;
    const nextAngle =
      currentAngle + clamp(diff, -maxTurn, maxTurn);
    proj.vx = Math.cos(nextAngle) * speed;
    proj.vy = Math.sin(nextAngle) * speed;
  }

  private ricochetProjectile(proj: ProjectileEntity, hitEnemy: EnemyEntity): void {
    const range = 240;
    const count = this.grid.queryRadius(proj.x, proj.y, range, this.queryBuf);
    let best: EnemyEntity | null = null;
    let bestDistSq = range * range;

    for (let i = 0; i < count; i++) {
      const idx = this.queryBuf[i];
      if (idx < 0 || idx >= this.enemies.items.length) continue;
      const cand = this.enemies.items[idx];
      if (!cand || !cand.active || cand.hp <= 0 || cand.poolIndex === hitEnemy.poolIndex) {
        continue;
      }
      const dx = cand.x - proj.x;
      const dy = cand.y - proj.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = cand;
      }
    }

    const speed = Math.hypot(proj.vx, proj.vy) || 600;
    if (best) {
      const angle = Math.atan2(best.y - proj.y, best.x - proj.x);
      proj.vx = Math.cos(angle) * speed;
      proj.vy = Math.sin(angle) * speed;
    } else {
      const baseAngle = Math.atan2(proj.vy, proj.vx) + Math.PI * 0.75;
      proj.vx = Math.cos(baseAngle) * speed;
      proj.vy = Math.sin(baseAngle) * speed;
    }
    this.particles.emitBurst(proj.x, proj.y, 4, '#FDE047', 130, 2.5, 0.16);
  }

  private detonateMortar(proj: ProjectileEntity): void {
    const color = proj.evolved ? '#FDE047' : '#F59E0B';
    this.particles.emitShockwave(proj.x, proj.y, proj.aoeRadius, color, 0.28, 4);
    this.particles.emitBurst(proj.x, proj.y, 16, '#F5C451', 180, 3.8, 0.32);
    this.particles.addShake(4.5);
    this.audio.playHit(proj.isCrit);

    const count = this.grid.queryRadius(
      proj.x,
      proj.y,
      proj.aoeRadius + 52,
      this.queryBuf
    );
    for (let i = 0; i < count; i++) {
      const idx = this.queryBuf[i];
      if (idx < 0 || idx >= this.enemies.items.length) continue;
      const enemy = this.enemies.items[idx];
      if (!enemy || !enemy.active || enemy.hp <= 0) continue;

      const dx = enemy.x - proj.x;
      const dy = enemy.y - proj.y;
      const hitR = proj.aoeRadius + enemy.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 <= hitR * hitR) {
        const dist = Math.sqrt(d2) || 1;
        const kbX = (dx / dist) * proj.knockback;
        const kbY = (dy / dist) * proj.knockback;
        this.damageEnemy(
          enemy,
          proj.damage,
          proj.isCrit,
          kbX,
          kbY,
          proj.sourceId
        );
      }
    }

    if (proj.leavesFaultZone) {
      const zone = this.faultZones.acquire();
      if (zone) {
        zone.x = proj.x;
        zone.y = proj.y;
        zone.radius = proj.aoeRadius * 0.95;
        zone.life = 3.6;
        zone.maxLife = 3.6;
        zone.damagePerTick = proj.damage * 0.28;
        zone.tickTimer = 0.25;
        zone.pullStrength = 95;
        zone.megaQuakeDone = false;
        zone.evolved = true;
      }
    }
  }

  private damageEnemy = (
    enemy: EnemyEntity,
    amount: number,
    isCrit: boolean,
    knockbackX: number,
    knockbackY: number,
    _sourceId: string
  ): void => {
    if (!enemy.active || enemy.hp <= 0) return;

    let finalDamage = amount;
    let actualCrit = isCrit;
    if (!actualCrit && this.rng.chance(this.stats.critChance)) {
      finalDamage *= this.stats.critMultiplier;
      actualCrit = true;
    }

    if (enemy.dampened) {
      finalDamage *= 0.65;
    }

    if (enemy.type === 'boss_wolf_tone') {
      const angleToPlayer = Math.atan2(
        this.player.y - enemy.y,
        this.player.x - enemy.x
      );
      let diff = angleToPlayer - enemy.armorAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.65) {
        finalDamage *= 0.8;
      }
    }

    enemy.hp -= finalDamage;
    enemy.hitFlash = 0.11;

    const resistScale = Math.max(0, 1 - enemy.knockbackResist);
    if (resistScale > 0 && (knockbackX !== 0 || knockbackY !== 0)) {
      enemy.vx += knockbackX * resistScale;
      enemy.vy += knockbackY * resistScale;
      enemy.x = clamp(
        enemy.x + knockbackX * resistScale * 0.035,
        enemy.radius,
        ARENA_WIDTH - enemy.radius
      );
      enemy.y = clamp(
        enemy.y + knockbackY * resistScale * 0.035,
        enemy.radius,
        ARENA_HEIGHT - enemy.radius
      );
    }

    const displayDmg = Math.max(1, Math.round(finalDamage));
    this.particles.spawnDamageNumber(
      enemy.x,
      enemy.y - enemy.radius,
      displayDmg,
      actualCrit ? 'crit' : 'normal'
    );

    const sparkAngle =
      knockbackX !== 0 || knockbackY !== 0
        ? Math.atan2(knockbackY, knockbackX)
        : Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
    this.particles.emitDirectional(
      enemy.x,
      enemy.y,
      sparkAngle,
      0.9,
      actualCrit ? 5 : 3,
      actualCrit ? '#FDE047' : enemy.accentColor,
      200
    );

    this.audio.playHit(actualCrit);
    if (actualCrit) {
      this.particles.triggerHitStop(0.024);
    }

    if (enemy.hp <= 0) {
      this.handleEnemyKilled(enemy);
    }
  };

  private handleEnemyKilled(enemy: EnemyEntity): void {
    this.kills += 1;
    if (enemy.isBoss) {
      this.bossesKilled += 1;
    }
    this.score += Math.round(enemy.xpValue * 25 * this.wave.wave);

    this.audio.playKill(enemy.isElite || enemy.isBoss);
    this.particles.emitBurst(
      enemy.x,
      enemy.y,
      enemy.isBoss ? 48 : enemy.isElite ? 24 : 10,
      enemy.color,
      enemy.isBoss ? 260 : 160
    );
    this.particles.addShake(enemy.isBoss ? 14 : enemy.isElite ? 5 : 1.2);
    if (enemy.isBoss || enemy.isElite) {
      this.particles.triggerHitStop(enemy.isBoss ? 0.06 : 0.032);
    }

    this.weaponSystem.onEnemyKilled(enemy, this.weaponCtx);

    if (
      'onEnemyDeath' in this.enemySystem &&
      typeof this.enemySystem.onEnemyDeath === 'function'
    ) {
      this.enemySystem.onEnemyDeath(enemy, this.wave, this.enemies, this.rng);
    } else if (enemy.type === 'splitter_chord') {
      const baseAngle = this.rng.range(0, Math.PI * 2);
      for (let i = 0; i < 2; i++) {
        const a = baseAngle + i * Math.PI;
        const child = this.enemySystem.spawnEnemy(
          'micro_tick',
          enemy.x + Math.cos(a) * 16,
          enemy.y + Math.sin(a) * 16,
          this.wave,
          this.enemies,
          this.rng,
          false
        );
        if (child) {
          child.vx = Math.cos(a) * 145;
          child.vy = Math.sin(a) * 145;
        }
      }
    }

    // Loot drops
    if (enemy.isBoss) {
      for (let i = 0; i < 5; i++) {
        this.spawnPickup('xp', enemy.x, enemy.y, Math.max(4, Math.round(enemy.xpValue / 5)));
      }
      for (let i = 0; i < 6; i++) {
        this.spawnPickup('brass', enemy.x, enemy.y, 3);
      }
      this.spawnPickup('chest', enemy.x, enemy.y, 1);
    } else if (enemy.isElite) {
      for (let i = 0; i < 2; i++) {
        this.spawnPickup('xp', enemy.x, enemy.y, Math.max(2, Math.round(enemy.xpValue / 2)));
        this.spawnPickup('brass', enemy.x, enemy.y, 2);
      }
      const forkChance =
        0.25 +
        this.stats.siphonRank * 0.12 +
        (this.wave.modifier === 'sub_harmonic_armor' ? 0.2 : 0);
      if (this.rng.chance(forkChance)) {
        this.spawnPickup('heal_fork', enemy.x, enemy.y, 1);
      }
    } else {
      this.spawnPickup('xp', enemy.x, enemy.y, enemy.xpValue);
      const brassMult = this.wave.modifier === 'blood_octave' ? 1.35 : 1.0;
      if (this.rng.chance(enemy.brassChance * brassMult)) {
        this.spawnPickup('brass', enemy.x, enemy.y, 1);
      }
    }

    this.enemies.releaseByIndex(enemy.poolIndex);
  }

  private spawnPickup(
    kind: PickupEntity['kind'],
    x: number,
    y: number,
    value: number
  ): void {
    if (kind === 'xp' && this.pickups.activeCount > PICKUP_MERGE_THRESHOLD) {
      const active = this.pickups.activeIndices;
      const items = this.pickups.items;
      let mergeTarget: PickupEntity | null = null;
      let bestDistSq = 220 * 220;

      for (let i = 0; i < active.length; i++) {
        const cand = items[active[i]];
        if (!cand.active || cand.kind !== 'xp') continue;
        const dx = cand.x - x;
        const dy = cand.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          mergeTarget = cand;
        }
      }

      if (!mergeTarget) {
        for (let i = 0; i < active.length; i++) {
          const cand = items[active[i]];
          if (cand.active && cand.kind === 'xp') {
            mergeTarget = cand;
            break;
          }
        }
      }

      if (mergeTarget) {
        mergeTarget.value += value;
        return;
      }
    }

    const p = this.pickups.acquire();
    if (!p) return;

    const angle = this.rng.range(0, Math.PI * 2);
    const scatterSpeed = kind === 'chest' ? 40 : this.rng.range(55, 135);
    p.kind = kind;
    p.x = clamp(x, 20, ARENA_WIDTH - 20);
    p.y = clamp(y, 20, ARENA_HEIGHT - 20);
    p.vx = Math.cos(angle) * scatterSpeed;
    p.vy = Math.sin(angle) * scatterSpeed;
    p.value = value;
    p.magnetized = false;
    p.bobPhase = this.rng.range(0, Math.PI * 2);
    p.life = kind === 'xp' ? 45 : 90;
  }

  private updatePickups(dt: number): void {
    if (this.pickupComboTimer > 0) {
      this.pickupComboTimer = Math.max(0, this.pickupComboTimer - dt);
      if (this.pickupComboTimer <= 0) {
        this.pickupComboStep = 0;
      }
    }

    const active = this.pickups.activeIndices;
    const items = this.pickups.items;
    const magnetRadiusSq = this.stats.pickupRadius * this.stats.pickupRadius;
    const collectRadius = this.player.radius + 16;
    const collectRadiusSq = collectRadius * collectRadius;
    const damp = Math.exp(-7 * dt);

    for (let i = active.length - 1; i >= 0; i--) {
      if (i >= active.length) continue;
      const p = items[active[i]];
      if (!p || !p.active) continue;

      p.bobPhase += dt * 4.5;
      p.life -= dt;
      if (p.life <= 0) {
        this.pickups.releaseByIndex(p.poolIndex);
        continue;
      }

      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      const d2 = dx * dx + dy * dy;

      if (!p.magnetized && d2 <= magnetRadiusSq) {
        p.magnetized = true;
      }

      if (p.magnetized) {
        const dist = Math.sqrt(d2) || 1;
        const curSpeed = Math.hypot(p.vx, p.vy);
        const targetSpeed = Math.min(880, Math.max(540, curSpeed + 1100 * dt));
        p.vx = (dx / dist) * targetSpeed;
        p.vy = (dy / dist) * targetSpeed;
      } else {
        p.vx *= damp;
        p.vy *= damp;
      }

      p.x = clamp(p.x + p.vx * dt, 16, ARENA_WIDTH - 16);
      p.y = clamp(p.y + p.vy * dt, 16, ARENA_HEIGHT - 16);

      const ndx = this.player.x - p.x;
      const ndy = this.player.y - p.y;
      if (ndx * ndx + ndy * ndy <= collectRadiusSq) {
        this.collectPickup(p);
        this.pickups.releaseByIndex(p.poolIndex);
      }
    }
  }

  private collectPickup(p: PickupEntity): void {
    this.pickupComboTimer = PICKUP_COMBO_WINDOW;
    this.audio.playPickup(p.kind, this.pickupComboStep);
    this.pickupComboStep = (this.pickupComboStep + 1) % 14;

    if (p.kind === 'xp') {
      const gained = Math.max(1, Math.round(p.value * this.stats.xpMult));
      this.player.xp += gained;
      this.consumePendingXpLevels();
    } else if (p.kind === 'brass') {
      const gained = Math.max(1, Math.round(p.value));
      this.brassCollected += gained;
      this.particles.spawnDamageNumber(p.x, p.y - 10, `+${gained} Hz`, 'status');
    } else if (p.kind === 'heal_fork') {
      const healAmt = Math.max(10, Math.round(this.player.maxHp * 0.25));
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
      this.particles.spawnDamageNumber(this.player.x, this.player.y - 22, healAmt, 'heal');
      this.particles.emitBurst(this.player.x, this.player.y, 10, '#34D399', 150, 3, 0.3);
    } else if (p.kind === 'chest') {
      this.player.hp = this.player.maxHp;
      this.player.shield = this.player.maxShield;
      this.brassCollected += 18;
      this.pendingLevelUps += 1;
      this.particles.spawnDamageNumber(
        this.player.x,
        this.player.y - 26,
        'CHEST +18 Hz',
        'crit'
      );
      this.particles.emitShockwave(this.player.x, this.player.y, 220, '#F5C451', 0.35, 4);
      this.particles.emitBurst(this.player.x, this.player.y, 20, '#FDE047', 210, 3.5, 0.35);
    }
  }

  private consumePendingXpLevels(): void {
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext;
      this.player.level += 1;
      this.player.xpToNext = computeXpToNext(this.player.level);
      this.pendingLevelUps += 1;
    }
  }

  private openNextLevelUpDraft(): void {
    if (this.pendingLevelUps <= 0) return;
    this.pendingLevelUps -= 1;

    this.phase = 'levelup';
    this.input.setGameplayActive(false);

    this.audio.playLevelUp();
    this.particles.emitShockwave(this.player.x, this.player.y, 260, '#38BDF8', 0.4, 5);
    this.particles.triggerFlash('#38BDF8', 0.18);
    this.input.vibrate(25, this.storage.getData().settings.haptics);

    this.currentChoices = rollUpgradeChoices(this.rng, this.runUpgrades);
    this.ui.showLevelUpDraft(
      this.currentChoices,
      this.player.rerollsLeft,
      this.player.level
    );
  }

  private handleSelectUpgrade(id: UpgradeId): void {
    if (this.phase !== 'levelup') return;

    const prevMaxHp = this.player.maxHp;
    const prevMaxShield = this.player.maxShield;
    const res = applyUpgradePick(this.runUpgrades, id);

    this.stats = this.weaponSystem.computeStats(
      this.metaBonuses,
      this.runUpgrades,
      this.player,
      this.wave.modifier
    );
    this.syncContexts();

    const newMaxHp = this.stats.maxHp;
    this.player.maxHp = newMaxHp;
    if (newMaxHp > prevMaxHp) {
      this.player.hp += newMaxHp - prevMaxHp;
    }
    this.player.hp = Math.min(newMaxHp, this.player.hp);

    if (res.healFraction > 0) {
      const healAmt = Math.max(1, Math.round(newMaxHp * res.healFraction));
      this.player.hp = Math.min(newMaxHp, this.player.hp + healAmt);
      this.particles.spawnDamageNumber(
        this.player.x,
        this.player.y - 22,
        healAmt,
        'heal'
      );
    }

    if (id === 'bonus_field_mend') {
      this.player.overdriveCharge = Math.min(100, this.player.overdriveCharge + 50);
    }

    this.player.maxShield = this.stats.maxShield;
    if (this.stats.maxShield > prevMaxShield) {
      this.player.shield += this.stats.maxShield - prevMaxShield;
    }
    this.player.shield = Math.min(this.player.maxShield, this.player.shield);

    if (res.isEvolution) {
      this.audio.playEvolution();
      this.particles.emitShockwave(this.player.x, this.player.y, 420, '#FDE047', 0.55, 7);
      this.particles.triggerFlash('#FDE047', 0.32);
    } else {
      this.audio.playButton();
    }

    if (this.pendingLevelUps > 0) {
      this.openNextLevelUpDraft();
      return;
    }

    this.phase = 'playing';
    this.input.setGameplayActive(true);
    this.ui.setPhase('playing', this.storage.getData(), this.runUpgrades);
  }

  private handleRerollUpgrades(): void {
    if (this.phase !== 'levelup' || this.player.rerollsLeft <= 0) return;
    this.player.rerollsLeft -= 1;
    this.audio.playButton();
    this.currentChoices = rollUpgradeChoices(this.rng, this.runUpgrades);
    this.ui.showLevelUpDraft(
      this.currentChoices,
      this.player.rerollsLeft,
      this.player.level
    );
  }

  private handleTriggerOverdrive(): void {
    if (this.phase !== 'playing') return;
    this.syncContexts();
    if (this.weaponSystem.triggerOverdrive(this.weaponCtx)) {
      this.input.vibrate(35, this.storage.getData().settings.haptics);
      this.updateHUD();
    }
  }

  private handlePauseToggle(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.input.setGameplayActive(false);
      this.audio.setSuspended(true);
      this.ui.setPhase('paused', this.storage.getData(), this.runUpgrades);
    } else if (this.phase === 'paused') {
      this.resumeGame();
    }
  }

  private resumeGame(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.audio.setSuspended(false);
    this.input.setGameplayActive(true);
    this.ui.setPhase('playing', this.storage.getData(), this.runUpgrades);
    this.lastTime = performance.now();
    this.ensureLoopRunning();
  }

  private handleBuyMetaUpgrade(id: MetaUpgradeId): boolean {
    const ok = this.storage.buyMetaUpgrade(id);
    if (ok) {
      this.audio.unlock();
      this.audio.playButton();
      this.metaBonuses = this.storage.computeBonuses();
      this.ui.refreshShop(this.storage.getData());
    }
    return ok;
  }

  private handleToggleSetting(key: keyof SaveSettings): void {
    const nextSettings = this.storage.toggleSetting(key);
    this.audio.unlock();
    this.audio.setSettings(nextSettings.sfx, nextSettings.music);
    this.audio.playButton();
  }

  private advanceWave(): void {
    const waveHeal = Math.max(1, Math.round(this.player.maxHp * 0.12));
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + waveHeal);
    this.score += this.wave.wave * 250;
    this.brassCollected += 2;

    const nextWaveNum = this.wave.wave + 1;
    this.wave = getWaveConfig(nextWaveNum, this.rng);
    this.waveElapsed = 0;

    this.stats = this.weaponSystem.computeStats(
      this.metaBonuses,
      this.runUpgrades,
      this.player,
      this.wave.modifier
    );
    this.syncContexts();

    this.enemySystem.resetForWave(this.wave);
    this.renderer.bakeChladniPlate(
      this.wave.chladniN,
      this.wave.chladniM,
      this.wave.accentColor
    );
    this.ui.showWaveBanner(this.wave);
    this.audio.startMusic(this.wave.frequencyHz);
  }

  private damagePlayer = (
    amount: number,
    _sourceX?: number,
    _sourceY?: number
  ): void => {
    if (this.player.invulnTimer > 0 || this.phase !== 'playing') return;

    const rawDmg = Math.max(1, Math.round(amount));
    let remaining = rawDmg;
    this.player.shieldRegenTimer = SHIELD_REGEN_DELAY;

    if (this.player.shield > 0) {
      const absorbed = Math.min(this.player.shield, remaining);
      this.player.shield -= absorbed;
      remaining -= absorbed;
    }

    if (remaining > 0) {
      this.player.hp -= remaining;
      this.player.feedbackStacks = 0;
      this.player.feedbackTimer = 0;
    }

    this.player.invulnTimer = 0.55;
    this.player.hurtFlash = 0.25;

    this.audio.playPlayerHurt();
    this.particles.addShake(8);
    this.particles.spawnDamageNumber(
      this.player.x,
      this.player.y - 22,
      rawDmg,
      'player_hurt'
    );
    this.input.vibrate(40, this.storage.getData().settings.haptics);

    if (this.player.hp <= 0) {
      this.finishRun();
    }
  };

  private finishRun(): void {
    if (this.phase === 'gameover') return;

    this.player.hp = Math.max(0, this.player.hp);
    this.phase = 'gameover';
    this.input.setGameplayActive(false);
    this.audio.stopMusic();
    this.audio.setSuspended(false);

    const brassEarned = Math.max(
      4,
      this.brassCollected + Math.floor(this.wave.wave * 2.5) + this.bossesKilled * 15
    );
    const records = this.storage.recordRun({
      wave: this.wave.wave,
      frequencyHz: this.wave.frequencyHz,
      score: this.score,
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      brassEarned,
      evolutions: this.runUpgrades.evolutions,
    });

    const summary: RunSummary = {
      wave: this.wave.wave,
      frequencyHz: this.wave.frequencyHz,
      score: this.score,
      timeSurvivedSec: this.timeSurvivedSec,
      kills: this.kills,
      bossesKilled: this.bossesKilled,
      brassEarned,
      isNewBestWave: records.isNewBestWave,
      isNewHighScore: records.isNewHighScore,
      upgrades: this.runUpgrades,
      seed: this.rng.seed,
    };

    this.ui.showGameOver(summary, this.storage.getData());
  }

  private updateHUD(): void {
    const hud = this.hudState;
    hud.hp = this.player.hp;
    hud.maxHp = this.player.maxHp;
    hud.shield = this.player.shield;
    hud.maxShield = this.player.maxShield;
    hud.xp = this.player.xp;
    hud.xpToNext = this.player.xpToNext;
    hud.level = this.player.level;
    hud.wave = this.wave.wave;
    hud.waveTimeRemaining = this.wave.isBossWave
      ? 0
      : Math.max(0, this.wave.duration - this.waveElapsed);
    hud.isBossWave = this.wave.isBossWave;
    hud.frequencyHz = this.wave.frequencyHz;
    hud.chladniN = this.wave.chladniN;
    hud.chladniM = this.wave.chladniM;
    hud.modifierLabel = this.wave.modifierLabel;
    hud.score = this.score;
    hud.brassThisRun = this.brassCollected;
    hud.kills = this.kills;
    hud.overdriveCharge = this.player.overdriveCharge;
    hud.isAnchored = this.player.isAnchored;
    hud.feedbackStacks = this.player.feedbackStacks;
    if (this.activeBoss && this.activeBoss.active) {
      hud.activeBossName = ENEMY_DEFS[this.activeBoss.type].name;
      hud.activeBossHp = Math.max(0, this.activeBoss.hp);
      hud.activeBossMaxHp = this.activeBoss.maxHp;
    } else {
      hud.activeBossName = null;
      hud.activeBossHp = 0;
      hud.activeBossMaxHp = 0;
    }
    hud.fps = Math.round(this.smoothedFps);

    this.ui.updateHUD(hud);
  }
}
