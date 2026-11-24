// Master TypeScript Contracts for OVERTONE: Chladni Survivor

export const ARENA_WIDTH = 1100;
export const ARENA_HEIGHT = 1600;
export const STORAGE_KEY = 'overtone_chladni_v1_save';
export const MAX_ACTIVE_INSTRUMENTS = 4;

export type GamePhase = 'title' | 'playing' | 'levelup' | 'paused' | 'gameover';

export type InstrumentId =
  | 'strike_ping'
  | 'chladni_orbitals'
  | 'arc_tessitura'
  | 'sub_bass_mortar'
  | 'standing_lance';

export type ModulatorId =
  | 'split_octave'
  | 'overdrive_tempo'
  | 'heavy_brass'
  | 'wide_aperture'
  | 'sympathetic_echo'
  | 'crit_transients'
  | 'shatter_resonance'
  | 'grounded_focus'
  | 'harmonic_siphon';

export type EvolutionId =
  | 'evo_tesla_philharmonic'
  | 'evo_aegis_mandala'
  | 'evo_storm_conductor'
  | 'evo_tectonic_drop'
  | 'evo_prism_singularity';

export type RelicId =
  | 'relic_glass_octave'
  | 'relic_perpetual_feedback'
  | 'relic_anchor_chladni';

export type BonusUpgradeId = 'bonus_harmonic_polish' | 'bonus_field_mend';

export type UpgradeId =
  | InstrumentId
  | ModulatorId
  | EvolutionId
  | RelicId
  | BonusUpgradeId;

export type UpgradeCategory =
  | 'instrument'
  | 'modulator'
  | 'evolution'
  | 'relic'
  | 'bonus';

export type UpgradeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  category: UpgradeCategory;
  rarity: UpgradeRarity;
  maxRank: number;
  icon: string; // Inline SVG path or symbolic key rendered by UI
  tagline: string;
  descriptions: string[]; // Length == maxRank (index 0 = Rank 1 description)
  requiresInstrument?: InstrumentId;
  requiresModulator?: ModulatorId;
  evolvesInstrument?: InstrumentId;
}

export type MetaUpgradeId =
  | 'tempered_alloy'
  | 'keen_striker'
  | 'magnetic_core'
  | 'harmonic_memory'
  | 'overclocked_coil';

export interface MetaUpgradeDef {
  id: MetaUpgradeId;
  name: string;
  icon: string;
  maxRank: number;
  baseCost: number;
  costStep: number;
  effectPerRank: string;
  description: string;
}

export interface MetaBonuses {
  maxHpFlat: number;
  damageMult: number;
  moveSpeedMult: number;
  pickupRadiusMult: number;
  xpMult: number;
  startingRerolls: number;
  fireRateMult: number;
  critChanceBonus: number;
}

export type EnemyTypeId =
  | 'static_mite'
  | 'hum_drone'
  | 'phase_skitter'
  | 'siren_node'
  | 'null_dampener'
  | 'splitter_chord'
  | 'micro_tick'
  | 'boss_wolf_tone'
  | 'boss_anechoic_monolith';

export type EliteAffix = 'none' | 'hasted' | 'twin_shot' | 'bulwark';

export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  isBoss: boolean;
  baseHp: number;
  baseSpeed: number;
  baseDamage: number;
  radius: number;
  xpValue: number;
  brassChance: number;
  color: string;
  accentColor: string;
  knockbackResist: number; // 0.0 (none) to 0.95 (boss)
  preferredRange?: number;
  fireInterval?: number;
}

export type AcousticModifierId =
  | 'none'
  | 'doppler_surge'
  | 'dense_choir'
  | 'blood_octave'
  | 'sub_harmonic_armor';

export interface WaveConfig {
  wave: number;
  frequencyHz: number;
  chladniN: number;
  chladniM: number;
  duration: number;
  isBossWave: boolean;
  bossId?: 'boss_wolf_tone' | 'boss_anechoic_monolith';
  spawnBudget: number;
  hpMult: number;
  damageMult: number;
  speedMult: number;
  eliteChance: number;
  weights: Partial<Record<EnemyTypeId, number>>;
  modifier: AcousticModifierId;
  modifierLabel: string;
  accentColor: string;
}

export interface Poolable {
  active: boolean;
  poolIndex: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldRegenTimer: number;
  xp: number;
  xpToNext: number;
  level: number;
  invulnTimer: number;
  hurtFlash: number;
  isAnchored: boolean;
  anchorTimer: number;
  overdriveCharge: number; // 0..100
  rerollsLeft: number;
  feedbackStacks: number;
  feedbackTimer: number;
  facingAngle: number;
  orbitalAngle: number;
}

export interface EnemyEntity extends Poolable {
  type: EnemyTypeId;
  isBoss: boolean;
  isElite: boolean;
  affix: EliteAffix;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpValue: number;
  brassChance: number;
  knockbackResist: number;
  color: string;
  accentColor: string;
  hitFlash: number;
  dampened: boolean;
  aiTimer: number;
  aiPhase: number;
  fireTimer: number;
  dashVx: number;
  dashVy: number;
  dashTimer: number;
  telegraphTimer: number;
  telegraphDuration: number;
  telegraphX: number;
  telegraphY: number;
  telegraphAngle: number;
  telegraphKind: 'none' | 'dash' | 'slam' | 'laser' | 'ring';
  laserActiveTimer: number;
  armorAngle: number;
  stunTimer: number;
}

export interface ProjectileEntity extends Poolable {
  isEnemy: boolean;
  sourceId: InstrumentId | 'shrapnel' | 'overdrive' | 'enemy_orb';
  evolved: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isCrit: boolean;
  pierceLeft: number;
  bouncesLeft: number;
  bounceDamageBonus: number;
  homingStrength: number;
  life: number;
  maxLife: number;
  aoeRadius: number;
  leavesFaultZone: boolean;
  knockback: number;
  color: string;
  lastHitEnemyIndex: number;
}

export interface FaultZoneEntity extends Poolable {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  damagePerTick: number;
  tickTimer: number;
  pullStrength: number;
  megaQuakeDone: boolean;
  evolved: boolean;
}

export interface PickupEntity extends Poolable {
  kind: 'xp' | 'brass' | 'heal_fork' | 'chest';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  magnetized: boolean;
  bobPhase: number;
  life: number;
}

export interface OrbitalNode {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  damage: number;
  evolved: boolean;
  ringIndex: number;
}

export interface RunUpgrades {
  ranks: Partial<Record<UpgradeId, number>>;
  activeInstruments: InstrumentId[];
  evolutions: EvolutionId[];
  relics: RelicId[];
  bonusDamageStacks: number;
}

export interface ComputedStats {
  damageMult: number;
  fireRateMult: number;
  moveSpeed: number;
  maxHp: number;
  maxShield: number;
  pickupRadius: number;
  aoeMult: number;
  extraProjectiles: number;
  extraPierce: number;
  extraBounces: number;
  critChance: number;
  critMultiplier: number;
  knockbackMult: number;
  xpMult: number;
  shatterRank: number;
  siphonRank: number;
  anchorFireRateBonus: number;
  anchorShockwave: boolean;
  glassOctave: boolean;
  perpetualFeedback: boolean;
}

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  magnitude: number;
  isMoving: boolean;
  joystickActive: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
  stillDuration: number;
  isAnchored: boolean;
  overdrivePressed: boolean;
}

export interface IRng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  shuffleInPlace<T>(items: T[]): T[];
}

export interface IPool<T extends Poolable> {
  readonly items: readonly T[];
  readonly activeIndices: readonly number[];
  readonly activeCount: number;
  acquire(): T | null;
  release(item: T): void;
  releaseByIndex(poolIndex: number): void;
  clear(): void;
}

export interface ISpatialGrid {
  clear(): void;
  insert(entityIndex: number, x: number, y: number): void;
  queryRadius(x: number, y: number, radius: number, outIndices: Int32Array): number;
}

export interface IAudio {
  unlock(): void;
  setSuspended(suspended: boolean): void;
  setSettings(sfxEnabled: boolean, musicEnabled: boolean): void;
  startMusic(frequencyHz?: number): void;
  stopMusic(): void;
  playShoot(instrument: InstrumentId, evolved: boolean): void;
  playHit(isCrit: boolean): void;
  playKill(isEliteOrBoss: boolean): void;
  playPickup(kind: PickupEntity['kind'], comboStep: number): void;
  playAnchorLock(): void;
  playOverdrive(): void;
  playLevelUp(): void;
  playEvolution(): void;
  playPlayerHurt(): void;
  playBossWarning(): void;
  playButton(): void;
}

export interface BeamVisual {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  color: string;
  life: number;
  maxLife: number;
  isLightning: boolean;
}

export interface ShockwaveVisual {
  active: boolean;
  x: number;
  y: number;
  startRadius: number;
  endRadius: number;
  color: string;
  life: number;
  maxLife: number;
  lineWidth: number;
}

export interface DamageNumberVisual {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface ParticleVisual {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  drag: number;
}

export interface IParticleSystem {
  readonly particles: readonly ParticleVisual[];
  readonly shockwaves: readonly ShockwaveVisual[];
  readonly beams: readonly BeamVisual[];
  readonly damageNumbers: readonly DamageNumberVisual[];
  readonly shakeOffsetX: number;
  readonly shakeOffsetY: number;
  readonly flashAlpha: number;
  readonly flashColor: string;
  readonly isHitStopped: boolean;
  update(rawDt: number): void;
  clear(): void;
  emitBurst(x: number, y: number, count: number, color: string, speed?: number, size?: number, life?: number): void;
  emitDirectional(x: number, y: number, angle: number, spread: number, count: number, color: string, speed?: number): void;
  emitShockwave(x: number, y: number, endRadius: number, color: string, duration?: number, lineWidth?: number): void;
  emitBeam(x1: number, y1: number, x2: number, y2: number, color: string, width?: number, duration?: number, isLightning?: boolean): void;
  spawnDamageNumber(x: number, y: number, amount: number | string, kind: 'normal' | 'crit' | 'heal' | 'status' | 'player_hurt'): void;
  addShake(intensity: number): void;
  triggerHitStop(durationSec: number): void;
  triggerFlash(color: string, alpha?: number): void;
}

export interface RenderState {
  player: PlayerState;
  enemies: IPool<EnemyEntity>;
  projectiles: IPool<ProjectileEntity>;
  faultZones: IPool<FaultZoneEntity>;
  pickups: IPool<PickupEntity>;
  orbitals: readonly OrbitalNode[];
  particles: IParticleSystem;
  input: InputSnapshot;
  wave: WaveConfig;
  stats: ComputedStats;
  time: number;
}

export interface SaveSettings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
}

export interface SaveRecords {
  bestWave: number;
  peakFrequencyHz: number;
  highScore: number;
  totalKills: number;
  totalRuns: number;
  bossesSilenced: number;
  discoveredEvolutions: EvolutionId[];
}

export interface SaveData {
  version: number;
  brass: number; // Meta-currency ("Hz Brass")
  metaRanks: Record<MetaUpgradeId, number>;
  records: SaveRecords;
  settings: SaveSettings;
}

export interface RunSummary {
  wave: number;
  frequencyHz: number;
  score: number;
  timeSurvivedSec: number;
  kills: number;
  bossesKilled: number;
  brassEarned: number;
  isNewBestWave: boolean;
  isNewHighScore: boolean;
  upgrades: RunUpgrades;
  seed: number;
}

export interface HUDState {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  xp: number;
  xpToNext: number;
  level: number;
  wave: number;
  waveTimeRemaining: number;
  isBossWave: boolean;
  frequencyHz: number;
  chladniN: number;
  chladniM: number;
  modifierLabel: string;
  score: number;
  brassThisRun: number;
  kills: number;
  overdriveCharge: number;
  isAnchored: boolean;
  feedbackStacks: number;
  activeBossName: string | null;
  activeBossHp: number;
  activeBossMaxHp: number;
  fps: number;
}

export interface UpgradeDraftOption {
  def: UpgradeDef;
  currentRank: number;
  nextRank: number;
  synergyHint?: string;
}

export interface UICallbacks {
  onStartRun: () => void;
  onSelectUpgrade: (id: UpgradeId) => void;
  onRerollUpgrades: () => void;
  onTriggerOverdrive: () => void;
  onPauseToggle: () => void;
  onResume: () => void;
  onAbandonRun: () => void;
  onBuyMetaUpgrade: (id: MetaUpgradeId) => boolean;
  onToggleSetting: (key: keyof SaveSettings) => void;
}
