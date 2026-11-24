import type {
  BeamVisual,
  DamageNumberVisual,
  IParticleSystem,
  ParticleVisual,
  ShockwaveVisual,
} from '../types';

const PARTICLE_POOL_SIZE = 360;
const SHOCKWAVE_POOL_SIZE = 48;
const BEAM_POOL_SIZE = 48;
const DAMAGE_NUMBER_POOL_SIZE = 80;

const HIT_STOP_MAX_SEC = 0.065;
const HIT_STOP_COOLDOWN_SEC = 0.14;
const MAX_SHAKE_TRAUMA = 22;
const FLASH_DURATION_SEC = 0.18;

export class JuiceAndParticles implements IParticleSystem {
  readonly particles: ParticleVisual[];
  readonly shockwaves: ShockwaveVisual[];
  readonly beams: BeamVisual[];
  readonly damageNumbers: DamageNumberVisual[];

  shakeOffsetX = 0;
  shakeOffsetY = 0;
  flashAlpha = 0;
  flashColor = '#FFFFFF';

  private hitStopTimer = 0;
  private hitStopCooldown = 0;
  private shakeTrauma = 0;
  private shakePhase = 0;
  private flashPeak = 0;

  private particleCursor = 0;
  private shockwaveCursor = 0;
  private beamCursor = 0;
  private damageNumberCursor = 0;

  constructor() {
    this.particles = new Array<ParticleVisual>(PARTICLE_POOL_SIZE);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        color: '#F5C451',
        life: 0,
        maxLife: 1,
        drag: 4,
      };
    }

    this.shockwaves = new Array<ShockwaveVisual>(SHOCKWAVE_POOL_SIZE);
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      this.shockwaves[i] = {
        active: false,
        x: 0,
        y: 0,
        startRadius: 4,
        endRadius: 64,
        color: '#F5C451',
        life: 0,
        maxLife: 1,
        lineWidth: 3,
      };
    }

    this.beams = new Array<BeamVisual>(BEAM_POOL_SIZE);
    for (let i = 0; i < BEAM_POOL_SIZE; i++) {
      this.beams[i] = {
        active: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        width: 4,
        color: '#38BDF8',
        life: 0,
        maxLife: 1,
        isLightning: false,
      };
    }

    this.damageNumbers = new Array<DamageNumberVisual>(DAMAGE_NUMBER_POOL_SIZE);
    for (let i = 0; i < DAMAGE_NUMBER_POOL_SIZE; i++) {
      this.damageNumbers[i] = {
        active: false,
        x: 0,
        y: 0,
        vy: 0,
        text: '',
        color: '#F8FAFC',
        scale: 1,
        life: 0,
        maxLife: 1,
      };
    }
  }

  get isHitStopped(): boolean {
    return this.hitStopTimer > 0;
  }

  clear(): void {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles[i].active = false;
    }
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      this.shockwaves[i].active = false;
    }
    for (let i = 0; i < BEAM_POOL_SIZE; i++) {
      this.beams[i].active = false;
    }
    for (let i = 0; i < DAMAGE_NUMBER_POOL_SIZE; i++) {
      this.damageNumbers[i].active = false;
    }

    this.particleCursor = 0;
    this.shockwaveCursor = 0;
    this.beamCursor = 0;
    this.damageNumberCursor = 0;

    this.hitStopTimer = 0;
    this.hitStopCooldown = 0;
    this.shakeTrauma = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.flashAlpha = 0;
    this.flashPeak = 0;
  }

  update(rawDt: number): void {
    const dt = rawDt > 0 ? Math.min(rawDt, 0.1) : 0;
    if (dt === 0) return;

    // Hit-stop & refractory cooldown
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
    } else if (this.hitStopCooldown > 0) {
      this.hitStopCooldown = Math.max(0, this.hitStopCooldown - dt);
    }

    // Damped screen shake
    if (this.shakeTrauma > 0) {
      this.shakeTrauma *= Math.exp(-9 * dt);
      if (this.shakeTrauma < 0.05) {
        this.shakeTrauma = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      } else {
        this.shakePhase += dt * 96;
        const jx = Math.cos(this.shakePhase) * 0.6 + (Math.random() * 2 - 1) * 0.4;
        const jy = Math.sin(this.shakePhase * 1.37) * 0.6 + (Math.random() * 2 - 1) * 0.4;
        this.shakeOffsetX = jx * this.shakeTrauma;
        this.shakeOffsetY = jy * this.shakeTrauma;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    // Smooth screen flash decay (~0.18s)
    if (this.flashAlpha > 0) {
      const rate = this.flashPeak > 0 ? this.flashPeak / FLASH_DURATION_SEC : 1.25;
      this.flashAlpha = Math.max(0, this.flashAlpha - rate * dt);
      if (this.flashAlpha <= 0) {
        this.flashPeak = 0;
      }
    }

    // Update particles
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Update shockwaves
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      const s = this.shockwaves[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
      }
    }

    // Update beams
    for (let i = 0; i < BEAM_POOL_SIZE; i++) {
      const b = this.beams[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
      }
    }

    // Update floating damage numbers
    for (let i = 0; i < DAMAGE_NUMBER_POOL_SIZE; i++) {
      const d = this.damageNumbers[i];
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        continue;
      }
      d.y += d.vy * dt;
      d.vy *= Math.exp(-4.2 * dt);
    }
  }

  emitBurst(
    x: number,
    y: number,
    count: number,
    color: string,
    speed = 180,
    size = 3.5,
    life = 0.36
  ): void {
    const n = count | 0;
    for (let i = 0; i < n; i++) {
      const p = this.acquireParticle();
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      const dur = life * (0.65 + Math.random() * 0.6);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.size = size * (0.7 + Math.random() * 0.65);
      p.color = color;
      p.life = dur;
      p.maxLife = dur;
      p.drag = 4.6;
    }
  }

  emitDirectional(
    x: number,
    y: number,
    angle: number,
    spread: number,
    count: number,
    color: string,
    speed = 240
  ): void {
    const n = count | 0;
    for (let i = 0; i < n; i++) {
      const p = this.acquireParticle();
      const a = angle + (Math.random() - 0.5) * spread;
      const spd = speed * (0.55 + Math.random() * 0.7);
      const dur = 0.2 + Math.random() * 0.18;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.size = 2.2 + Math.random() * 2.2;
      p.color = color;
      p.life = dur;
      p.maxLife = dur;
      p.drag = 5.5;
    }
  }

  emitShockwave(
    x: number,
    y: number,
    endRadius: number,
    color: string,
    duration = 0.3,
    lineWidth = 4
  ): void {
    const s = this.acquireShockwave();
    s.active = true;
    s.x = x;
    s.y = y;
    s.startRadius = Math.min(14, endRadius * 0.18);
    s.endRadius = endRadius;
    s.color = color;
    s.life = duration;
    s.maxLife = duration;
    s.lineWidth = lineWidth;
  }

  emitBeam(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 4,
    duration = 0.16,
    isLightning = false
  ): void {
    const b = this.acquireBeam();
    b.active = true;
    b.x1 = x1;
    b.y1 = y1;
    b.x2 = x2;
    b.y2 = y2;
    b.color = color;
    b.width = width;
    b.life = duration;
    b.maxLife = duration;
    b.isLightning = isLightning;
  }

  spawnDamageNumber(
    x: number,
    y: number,
    amount: number | string,
    kind: 'normal' | 'crit' | 'heal' | 'status' | 'player_hurt'
  ): void {
    const d = this.acquireDamageNumber();
    const valStr = typeof amount === 'number' ? String(Math.round(amount)) : amount;

    let text = valStr;
    let color = '#F8FAFC';
    let scale = 1.0;

    switch (kind) {
      case 'crit':
        text = `${valStr}!`;
        color = '#FDE047';
        scale = 1.42;
        break;
      case 'heal':
        text = `+${valStr}`;
        color = '#34D399';
        scale = 1.15;
        break;
      case 'status':
        text = valStr;
        color = '#E879F9';
        scale = 1.15;
        break;
      case 'player_hurt':
        text = `-${valStr}`;
        color = '#FB7185';
        scale = 1.25;
        break;
      case 'normal':
      default:
        text = valStr;
        color = '#F8FAFC';
        scale = 1.0;
        break;
    }

    const dur = kind === 'crit' ? 0.76 : 0.64;
    d.active = true;
    d.x = x + (Math.random() * 2 - 1) * 14;
    d.y = y - 10;
    d.vy = -78;
    d.text = text;
    d.color = color;
    d.scale = scale;
    d.life = dur;
    d.maxLife = dur;
  }

  addShake(intensity: number): void {
    if (intensity <= 0) return;
    this.shakeTrauma = Math.min(MAX_SHAKE_TRAUMA, this.shakeTrauma + intensity);
  }

  triggerHitStop(durationSec: number): void {
    if (durationSec <= 0) return;
    const clamped = Math.min(durationSec, HIT_STOP_MAX_SEC);
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(this.hitStopTimer, clamped);
      this.hitStopCooldown = HIT_STOP_COOLDOWN_SEC;
    } else if (this.hitStopCooldown <= 0) {
      this.hitStopTimer = clamped;
      this.hitStopCooldown = HIT_STOP_COOLDOWN_SEC;
    }
  }

  triggerFlash(color: string, alpha = 0.22): void {
    if (alpha <= 0) return;
    const clamped = Math.min(1, alpha);
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, clamped);
    this.flashPeak = this.flashAlpha;
  }

  private acquireParticle(): ParticleVisual {
    const pool = this.particles;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const idx = (this.particleCursor + i) % PARTICLE_POOL_SIZE;
      if (!pool[idx].active) {
        this.particleCursor = (idx + 1) % PARTICLE_POOL_SIZE;
        return pool[idx];
      }
    }
    const slot = pool[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
    return slot;
  }

  private acquireShockwave(): ShockwaveVisual {
    const pool = this.shockwaves;
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      const idx = (this.shockwaveCursor + i) % SHOCKWAVE_POOL_SIZE;
      if (!pool[idx].active) {
        this.shockwaveCursor = (idx + 1) % SHOCKWAVE_POOL_SIZE;
        return pool[idx];
      }
    }
    const slot = pool[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % SHOCKWAVE_POOL_SIZE;
    return slot;
  }

  private acquireBeam(): BeamVisual {
    const pool = this.beams;
    for (let i = 0; i < BEAM_POOL_SIZE; i++) {
      const idx = (this.beamCursor + i) % BEAM_POOL_SIZE;
      if (!pool[idx].active) {
        this.beamCursor = (idx + 1) % BEAM_POOL_SIZE;
        return pool[idx];
      }
    }
    const slot = pool[this.beamCursor];
    this.beamCursor = (this.beamCursor + 1) % BEAM_POOL_SIZE;
    return slot;
  }

  private acquireDamageNumber(): DamageNumberVisual {
    const pool = this.damageNumbers;
    for (let i = 0; i < DAMAGE_NUMBER_POOL_SIZE; i++) {
      const idx = (this.damageNumberCursor + i) % DAMAGE_NUMBER_POOL_SIZE;
      if (!pool[idx].active) {
        this.damageNumberCursor = (idx + 1) % DAMAGE_NUMBER_POOL_SIZE;
        return pool[idx];
      }
    }
    const slot = pool[this.damageNumberCursor];
    this.damageNumberCursor = (this.damageNumberCursor + 1) % DAMAGE_NUMBER_POOL_SIZE;
    return slot;
  }
}
