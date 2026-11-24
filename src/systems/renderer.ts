import type {
  EnemyEntity,
  FaultZoneEntity,
  IParticleSystem,
  OrbitalNode,
  PickupEntity,
  PlayerState,
  ProjectileEntity,
  RenderState,
} from '../types';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../types';

const PLATE_W = ARENA_WIDTH >> 1; // 550
const PLATE_H = ARENA_HEIGHT >> 1; // 800
const CAMERA_MARGIN = 64;
const NULL_DAMPENER_AURA_RADIUS = 165;
const TWO_PI = Math.PI * 2;

export class CymaticRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private readonly plateCanvas: HTMLCanvasElement;
  private readonly plateCtx: CanvasRenderingContext2D;
  private readonly plateImageData: ImageData;
  private readonly plateData: Uint8ClampedArray;

  // Pre-allocated separable trig LUTs for fast <2ms Chladni plate baking
  private readonly cosNU = new Float32Array(PLATE_W);
  private readonly cosMU = new Float32Array(PLATE_W);
  private readonly cosNV = new Float32Array(PLATE_H);
  private readonly cosMV = new Float32Array(PLATE_H);

  // Pre-allocated LUTs & scratch buffers for title screen & lightning bolts
  private readonly titleCols = 48;
  private readonly titleRows = 68;
  private readonly titleCosNU = new Float32Array(48);
  private readonly titleCosMU = new Float32Array(48);
  private readonly titleCosNV = new Float32Array(68);
  private readonly titleCosMV = new Float32Array(68);
  private readonly boltPointsX = new Float32Array(5);
  private readonly boltPointsY = new Float32Array(5);

  private viewW = 390;
  private viewH = 844;
  private dpr = 1;

  private camX = 0;
  private camY = 0;
  private camInitialized = false;

  private bakedN = -1;
  private bakedM = -1;
  private bakedAccent = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false }) ?? canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context');
    }
    this.ctx = ctx;

    this.plateCanvas = document.createElement('canvas');
    this.plateCanvas.width = PLATE_W;
    this.plateCanvas.height = PLATE_H;
    const pCtx = this.plateCanvas.getContext('2d');
    if (!pCtx) {
      throw new Error('Failed to acquire offscreen Chladni plate 2D context');
    }
    this.plateCtx = pCtx;
    this.plateImageData = pCtx.createImageData(PLATE_W, PLATE_H);
    this.plateData = this.plateImageData.data;

    this.resize();
    this.bakeChladniPlate(2, 3, '#38BDF8');
  }

  resize(): void {
    this.viewW = Math.max(320, window.innerWidth || 390);
    this.viewH = Math.max(320, window.innerHeight || 844);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  bakeChladniPlate(n: number, m: number, accentColor: string): void {
    if (n === this.bakedN && m === this.bakedM && accentColor === this.bakedAccent) {
      return;
    }
    this.bakedN = n;
    this.bakedM = m;
    this.bakedAccent = accentColor;

    const effM = m === n ? m + 1 : m;
    const data = this.plateData;

    // Parse accent color (default cyan #38BDF8)
    let ar = 56;
    let ag = 189;
    let ab = 248;
    if (accentColor.charCodeAt(0) === 35 && accentColor.length === 7) {
      const parsed = parseInt(accentColor.slice(1), 16);
      if (!Number.isNaN(parsed)) {
        ar = (parsed >> 16) & 255;
        ag = (parsed >> 8) & 255;
        ab = parsed & 255;
      }
    }

    // 1. Precompute 1D cosine lookup tables
    for (let x = 0; x < PLATE_W; x++) {
      const u = x / PLATE_W;
      this.cosNU[x] = Math.cos(n * Math.PI * u);
      this.cosMU[x] = Math.cos(effM * Math.PI * u);
    }
    for (let y = 0; y < PLATE_H; y++) {
      const v = y / PLATE_H;
      this.cosNV[y] = Math.cos(n * Math.PI * v);
      this.cosMV[y] = Math.cos(effM * Math.PI * v);
    }

    // 2. Fill brushed obsidian ground (#090A10) with subtle center lift
    const halfW = PLATE_W * 0.5;
    const halfH = PLATE_H * 0.5;
    for (let y = 0; y < PLATE_H; y++) {
      const dy = (y - halfH) / halfH;
      const dy2 = dy * dy;
      const brush = (y & 1) === 0 ? 1 : 0;
      const rowOffset = y * PLATE_W;
      for (let x = 0; x < PLATE_W; x++) {
        const dx = (x - halfW) / halfW;
        const dist2 = dx * dx + dy2;
        const lift = dist2 < 1.2 ? ((1.2 - dist2) * 3.5) | 0 : 0;
        const idx = (rowOffset + x) << 2;
        data[idx] = 9 + lift + brush;
        data[idx + 1] = 10 + lift + brush;
        data[idx + 2] = 16 + lift + (brush << 1);
        data[idx + 3] = 255;
      }
    }

    // 3. Evaluate Chladni standing-wave equation & stipple quartz-brass sand grains
    //    val = cos(n*pi*u)*cos(m*pi*v) - cos(m*pi*u)*cos(n*pi*v)
    for (let y = 4; y < PLATE_H - 4; y += 2) {
      const cnv = this.cosNV[y];
      const cmv = this.cosMV[y];
      for (let x = 4; x < PLATE_W - 4; x += 2) {
        const val = this.cosNU[x] * cmv - this.cosMU[x] * cnv;
        const absVal = val < 0 ? -val : val;
        if (absVal >= 0.14) continue;

        const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const closeness = 1 - absVal / 0.14;
        const grainRand = (h & 255) / 255;
        const alpha = 0.14 + 0.14 * closeness * (0.45 + 0.55 * grainRand);

        const accentMix = (((h >>> 8) & 255) / 255) * 0.5;
        const gr = 245 + (ar - 245) * accentMix;
        const gg = 196 + (ag - 196) * accentMix;
        const gb = 81 + (ab - 81) * accentMix;

        const px = x + (h & 1);
        const py = y + ((h >>> 1) & 1);
        const idx = (py * PLATE_W + px) << 2;
        const inv = 1 - alpha;
        data[idx] = data[idx] * inv + gr * alpha;
        data[idx + 1] = data[idx + 1] * inv + gg * alpha;
        data[idx + 2] = data[idx + 2] * inv + gb * alpha;

        if (closeness > 0.62) {
          const sx = px + (((h >>> 2) & 1) === 0 ? 1 : -1);
          const idx2 = (py * PLATE_W + sx) << 2;
          const a2 = alpha * 0.55;
          const inv2 = 1 - a2;
          data[idx2] = data[idx2] * inv2 + gr * a2;
          data[idx2 + 1] = data[idx2 + 1] * inv2 + gg * a2;
          data[idx2 + 2] = data[idx2 + 2] * inv2 + gb * a2;
        }
      }
    }

    const pCtx = this.plateCtx;
    pCtx.putImageData(this.plateImageData, 0, 0);

    // 4. Subtle metallic harmonic grid lines every 100 arena px (50px on plate)
    pCtx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
    pCtx.lineWidth = 1;
    pCtx.beginPath();
    for (let x = 50; x < PLATE_W; x += 50) {
      pCtx.moveTo(x + 0.5, 10);
      pCtx.lineTo(x + 0.5, PLATE_H - 10);
    }
    for (let y = 50; y < PLATE_H; y += 50) {
      pCtx.moveTo(10, y + 0.5);
      pCtx.lineTo(PLATE_W - 10, y + 0.5);
    }
    pCtx.stroke();

    // Subtle harmonic center crosshairs & resonance circle
    pCtx.strokeStyle = 'rgba(245, 196, 81, 0.085)';
    pCtx.beginPath();
    pCtx.moveTo(halfW + 0.5, 16);
    pCtx.lineTo(halfW + 0.5, PLATE_H - 16);
    pCtx.moveTo(16, halfH + 0.5);
    pCtx.lineTo(PLATE_W - 16, halfH + 0.5);
    pCtx.stroke();

    pCtx.beginPath();
    pCtx.arc(halfW, halfH, 72, 0, TWO_PI);
    pCtx.stroke();

    // 5. Ornate double-line burnished brass & cyan resonant boundary rails
    pCtx.strokeStyle = '#C99738';
    pCtx.lineWidth = 2.5;
    pCtx.strokeRect(4, 4, PLATE_W - 8, PLATE_H - 8);

    pCtx.strokeStyle = 'rgba(56, 189, 248, 0.58)';
    pCtx.lineWidth = 1.25;
    pCtx.strokeRect(10, 10, PLATE_W - 20, PLATE_H - 20);

    // Corner brass resonator rivets
    pCtx.fillStyle = '#F5C451';
    const corners = [
      [10, 10],
      [PLATE_W - 10, 10],
      [10, PLATE_H - 10],
      [PLATE_W - 10, PLATE_H - 10],
    ];
    for (let i = 0; i < corners.length; i++) {
      const cx = corners[i][0];
      const cy = corners[i][1];
      pCtx.beginPath();
      pCtx.arc(cx, cy, 4, 0, TWO_PI);
      pCtx.fill();
      pCtx.strokeStyle = '#38BDF8';
      pCtx.lineWidth = 1;
      pCtx.beginPath();
      pCtx.arc(cx, cy, 7, 0, TWO_PI);
      pCtx.stroke();
    }
  }

  renderTitleBackground(time: number): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const w = this.viewW;
    const h = this.viewH;

    ctx.fillStyle = '#090A10';
    ctx.fillRect(0, 0, w, h);

    // Subtle ambient center bloom
    const cx = w * 0.5;
    const cy = h * 0.46;
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.58);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
    grad.addColorStop(0.45, 'rgba(245, 196, 81, 0.045)');
    grad.addColorStop(1, 'rgba(9, 10, 16, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Slowly morphing Chladni standing-wave sand preview
    const n = 2.4 + 1.15 * Math.sin(time * 0.21);
    const m = 4.1 + 1.35 * Math.cos(time * 0.16);
    const cols = this.titleCols;
    const rows = this.titleRows;
    const stepX = w / cols;
    const stepY = h / rows;

    for (let ix = 0; ix < cols; ix++) {
      const u = (ix + 0.5) / cols;
      this.titleCosNU[ix] = Math.cos(n * Math.PI * u);
      this.titleCosMU[ix] = Math.cos(m * Math.PI * u);
    }
    for (let iy = 0; iy < rows; iy++) {
      const v = (iy + 0.5) / rows;
      this.titleCosNV[iy] = Math.cos(n * Math.PI * v);
      this.titleCosMV[iy] = Math.cos(m * Math.PI * v);
    }

    ctx.fillStyle = '#F5C451';
    for (let iy = 0; iy < rows; iy++) {
      const cnv = this.titleCosNV[iy];
      const cmv = this.titleCosMV[iy];
      const py = (iy + 0.5) * stepY;
      for (let ix = 0; ix < cols; ix++) {
        const val = this.titleCosNU[ix] * cmv - this.titleCosMU[ix] * cnv;
        const absVal = val < 0 ? -val : val;
        if (absVal >= 0.17) continue;
        const alpha = (1 - absVal / 0.17) * 0.42;
        ctx.globalAlpha = alpha;
        const px = (ix + 0.5) * stepX;
        const sz = absVal < 0.055 ? 2.5 : 1.75;
        ctx.fillRect(px - sz * 0.5, py - sz * 0.5, sz, sz);
      }
    }

    // Sacred rotating brass & cyan nodal mandala rings
    ctx.globalAlpha = 0.22;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.14);
    ctx.strokeStyle = '#F5C451';
    ctx.lineWidth = 1.25;
    const baseR = Math.min(w, h) * 0.28;
    ctx.beginPath();
    ctx.arc(0, 0, baseR, 0, TWO_PI);
    ctx.stroke();

    ctx.strokeStyle = '#38BDF8';
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, baseR * 1.24, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.rotate(-time * 0.28);
    ctx.strokeStyle = 'rgba(245, 196, 81, 0.35)';
    const sides = 6;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * TWO_PI;
      const rx = Math.cos(a) * baseR * 0.82;
      const ry = Math.sin(a) * baseR * 0.82;
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  render(state: RenderState): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const { player, wave, particles, time } = state;

    // Ensure Chladni plate is baked for current wave
    this.bakeChladniPlate(wave.chladniN, wave.chladniM, wave.accentColor);

    // Camera calculation centered on player + soft arena clamping + screen shake
    let targetCamX: number;
    if (this.viewW >= ARENA_WIDTH + CAMERA_MARGIN * 2) {
      targetCamX = (ARENA_WIDTH - this.viewW) * 0.5;
    } else {
      const rawX = player.x - this.viewW * 0.5;
      const minX = -CAMERA_MARGIN;
      const maxX = ARENA_WIDTH - this.viewW + CAMERA_MARGIN;
      targetCamX = rawX < minX ? minX : rawX > maxX ? maxX : rawX;
    }

    let targetCamY: number;
    if (this.viewH >= ARENA_HEIGHT + CAMERA_MARGIN * 2) {
      targetCamY = (ARENA_HEIGHT - this.viewH) * 0.5;
    } else {
      const rawY = player.y - this.viewH * 0.5;
      const minY = -CAMERA_MARGIN;
      const maxY = ARENA_HEIGHT - this.viewH + CAMERA_MARGIN;
      targetCamY = rawY < minY ? minY : rawY > maxY ? maxY : rawY;
    }

    if (
      !this.camInitialized ||
      Math.abs(targetCamX - this.camX) > 260 ||
      Math.abs(targetCamY - this.camY) > 260
    ) {
      this.camX = targetCamX;
      this.camY = targetCamY;
      this.camInitialized = true;
    } else {
      this.camX += (targetCamX - this.camX) * 0.18;
      this.camY += (targetCamY - this.camY) * 0.18;
    }

    const drawCamX = this.camX - particles.shakeOffsetX;
    const drawCamY = this.camY - particles.shakeOffsetY;

    // Clear void outside arena
    ctx.fillStyle = '#05060B';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(-drawCamX, -drawCamY);

    // 1. Offscreen Chladni Plate + dark outer edge vignette
    ctx.drawImage(this.plateCanvas, 0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.drawArenaOuterVignette(ctx);

    // 2. Tectonic Fault Zones & Null Dampener Auras
    this.drawFaultZones(ctx, state, time);
    this.drawNullDampenerAuras(ctx, state, time);

    // 3. Boss & Skitter Telegraphs (+ active monolith beams)
    this.drawTelegraphs(ctx, state, time, drawCamX, drawCamY);

    // 4. Pickups
    this.drawPickups(ctx, state, time, drawCamX, drawCamY);

    // 5. Enemies
    this.drawEnemies(ctx, state, time, drawCamX, drawCamY);

    // 6. Player ("The Cantor") & Chladni Orbitals / Aegis Mandala
    this.drawPlayer(ctx, player, state.orbitals, time);

    // 7. Projectiles, Beams & Shockwaves
    this.drawProjectilesAndFX(ctx, state, particles, time, drawCamX, drawCamY);

    // 8. Particles & Floating Damage Numbers
    this.drawParticles(ctx, particles, drawCamX, drawCamY);
    this.drawDamageNumbers(ctx, particles);

    ctx.restore();

    // 9. Screen-space Overlays (Flash, Low-HP Edge Pulse, Floating Virtual Joystick)
    this.drawScreenOverlays(ctx, state, time);
  }

  private drawArenaOuterVignette(ctx: CanvasRenderingContext2D): void {
    // Subtle dark bezel shadow right outside the arena boundary rails
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.lineWidth = 14;
    ctx.strokeRect(-7, -7, ARENA_WIDTH + 14, ARENA_HEIGHT + 14);
  }

  private drawFaultZones(ctx: CanvasRenderingContext2D, state: RenderState, time: number): void {
    const { items, activeIndices, activeCount } = state.faultZones;
    for (let i = 0; i < activeCount; i++) {
      const z: FaultZoneEntity = items[activeIndices[i]];
      if (!z.active) continue;

      const lifeFrac = Math.max(0, Math.min(1, z.life / Math.max(0.01, z.maxLife)));
      const fade = lifeFrac < 0.2 ? lifeFrac / 0.2 : 1;
      const pulse = 0.78 + 0.22 * Math.sin(time * 12 + z.poolIndex);

      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.globalAlpha = fade;

      ctx.fillStyle = z.evolved
        ? 'rgba(245, 196, 81, 0.14)'
        : 'rgba(251, 146, 60, 0.11)';
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, TWO_PI);
      ctx.fill();

      // Outer cymatic boundary ring
      ctx.strokeStyle = z.evolved ? '#F5C451' : '#FB923C';
      ctx.lineWidth = 2;
      ctx.globalAlpha = fade * (0.55 * pulse);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, TWO_PI);
      ctx.stroke();

      // Concentric vibrating inner rings
      const r1 = z.radius * ((0.35 + ((time * 0.85) % 0.65)));
      const r2 = z.radius * ((0.2 + ((time * 0.85 + 0.45) % 0.75)));
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FDE047';
      ctx.globalAlpha = fade * 0.45;
      ctx.beginPath();
      ctx.arc(0, 0, r1, 0, TWO_PI);
      ctx.stroke();

      ctx.globalAlpha = fade * 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, r2, 0, TWO_PI);
      ctx.stroke();

      // Evolved mega-quake inward implosion ring
      if (z.evolved && !z.megaQuakeDone) {
        const collapse = Math.max(0.1, lifeFrac);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = fade * 0.75;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, z.radius * collapse, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  private drawNullDampenerAuras(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    time: number
  ): void {
    const { items, activeIndices, activeCount } = state.enemies;
    const auraR = NULL_DAMPENER_AURA_RADIUS;
    const auraR2 = (auraR + 24) * (auraR + 24);

    for (let i = 0; i < activeCount; i++) {
      const e: EnemyEntity = items[activeIndices[i]];
      if (!e.active || e.type !== 'null_dampener') continue;

      const pulse = 0.82 + 0.18 * Math.sin(time * 5 + e.poolIndex);
      ctx.save();

      // Translucent magenta suppression field
      ctx.fillStyle = 'rgba(217, 70, 239, 0.085)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, auraR, 0, TWO_PI);
      ctx.fill();

      ctx.strokeStyle = `rgba(232, 121, 249, ${0.42 * pulse})`;
      ctx.lineWidth = 1.75;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, auraR, time * 0.5, time * 0.5 + TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tether lines to dampened allies
      ctx.strokeStyle = 'rgba(217, 70, 239, 0.28)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let j = 0; j < activeCount; j++) {
        if (i === j) continue;
        const ally = items[activeIndices[j]];
        if (!ally.active || !ally.dampened) continue;
        const dx = ally.x - e.x;
        const dy = ally.y - e.y;
        if (dx * dx + dy * dy <= auraR2) {
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(ally.x, ally.y);
        }
      }
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawTelegraphs(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    time: number,
    camX: number,
    camY: number
  ): void {
    const { items, activeIndices, activeCount } = state.enemies;
    for (let i = 0; i < activeCount; i++) {
      const e: EnemyEntity = items[activeIndices[i]];
      if (!e.active) continue;

      // Active Anechoic Monolith Sweeping Laser Beam
      if (e.laserActiveTimer > 0) {
        const len = 1500;
        const x2 = e.x + Math.cos(e.telegraphAngle) * len;
        const y2 = e.y + Math.sin(e.telegraphAngle) * len;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
        ctx.lineWidth = 28;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#C084FC';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.restore();
      }

      if (e.telegraphTimer <= 0 || e.telegraphKind === 'none') continue;

      const dur = Math.max(0.01, e.telegraphDuration);
      const progress = Math.max(0, Math.min(1, 1 - e.telegraphTimer / dur));
      const blink = 0.6 + 0.4 * Math.sin(time * 28);

      if (e.telegraphKind === 'dash') {
        const hasTarget = e.telegraphX !== 0 || e.telegraphY !== 0;
        let tx = e.telegraphX;
        let ty = e.telegraphY;
        let angle = e.telegraphAngle;
        if (hasTarget) {
          angle = Math.atan2(ty - e.y, tx - e.x);
        } else {
          tx = e.x + Math.cos(angle) * 260;
          ty = e.y + Math.sin(angle) * 260;
        }

        ctx.save();
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.55 + 0.4 * progress})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 7]);
        ctx.lineDashOffset = -time * 90;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Warning ring & directional chevron
        ctx.strokeStyle = '#F5C451';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 7 + (1 - progress) * 10, 0, TWO_PI);
        ctx.stroke();

        ctx.translate(tx, ty);
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(244, 63, 94, ${0.4 + 0.5 * progress})`;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-7, -7);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (e.telegraphKind === 'slam') {
        const sx = e.telegraphX || e.x;
        const sy = e.telegraphY || e.y;
        const slamRadius = e.isBoss ? 140 : Math.max(70, e.radius * 3.2);

        ctx.save();
        // Outer danger rim
        ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
        ctx.beginPath();
        ctx.arc(sx, sy, slamRadius, 0, TWO_PI);
        ctx.fill();

        // Filling inner impact circle
        ctx.fillStyle = `rgba(244, 63, 94, ${0.14 + 0.2 * progress})`;
        ctx.beginPath();
        ctx.arc(sx, sy, slamRadius * progress, 0, TWO_PI);
        ctx.fill();

        ctx.strokeStyle = progress > 0.78 ? '#FEF08A' : '#F43F5E';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, slamRadius, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      } else if (e.telegraphKind === 'laser') {
        const len = 1500;
        const cosA = Math.cos(e.telegraphAngle);
        const sinA = Math.sin(e.telegraphAngle);
        const x2 = e.x + cosA * len;
        const y2 = e.y + sinA * len;

        ctx.save();
        // Narrowing lock-on guide rails
        const railSpread = 16 * (1 - progress * 0.78);
        const nx = -sinA * railSpread;
        const ny = cosA * railSpread;

        ctx.strokeStyle = `rgba(232, 121, 249, ${0.35 + 0.45 * progress})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x + nx, e.y + ny);
        ctx.lineTo(x2 + nx, y2 + ny);
        ctx.moveTo(e.x - nx, e.y - ny);
        ctx.lineTo(x2 - nx, y2 - ny);
        ctx.stroke();

        // Core targeting line
        ctx.strokeStyle = progress > 0.75 ? '#FEF08A' : `rgba(244, 63, 94, ${0.5 + 0.5 * blink})`;
        ctx.lineWidth = 2 + progress * 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsing chevrons along beam path
        ctx.fillStyle = '#FDE047';
        for (let step = 90; step < 520; step += 110) {
          const cx = e.x + cosA * step;
          const cy = e.y + sinA * step;
          if (
            cx < camX - 40 ||
            cx > camX + this.viewW + 40 ||
            cy < camY - 40 ||
            cy > camY + this.viewH + 40
          ) {
            continue;
          }
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(e.telegraphAngle);
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-4, -5);
          ctx.lineTo(-1, 0);
          ctx.lineTo(-4, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      } else if (e.telegraphKind === 'ring') {
        ctx.save();
        ctx.strokeStyle = `rgba(245, 196, 81, ${0.4 + 0.5 * blink})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 10 + progress * 18, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawPickups(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    time: number,
    camX: number,
    camY: number
  ): void {
    const { items, activeIndices, activeCount } = state.pickups;
    const minX = camX - 40;
    const maxX = camX + this.viewW + 40;
    const minY = camY - 40;
    const maxY = camY + this.viewH + 40;

    for (let i = 0; i < activeCount; i++) {
      const p: PickupEntity = items[activeIndices[i]];
      if (!p.active) continue;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;

      const bob = Math.sin(time * 5 + p.bobPhase) * 2.2;
      const px = p.x;
      const py = p.y + bob;

      if (p.kind === 'xp') {
        // Glowing amber diamond shard
        const s = p.value >= 10 ? 7.5 : 5.5;
        ctx.fillStyle = p.value >= 10 ? '#FDE047' : '#F5C451';
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px + s * 0.72, py);
        ctx.lineTo(px, py + s);
        ctx.lineTo(px - s * 0.72, py);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        ctx.moveTo(px, py - s * 0.45);
        ctx.lineTo(px + s * 0.32, py);
        ctx.lineTo(px, py + s * 0.45);
        ctx.lineTo(px - s * 0.32, py);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'brass') {
        // Spinning golden Tuning Fork coin
        const spin = Math.max(0.28, Math.abs(Math.cos(time * 4.5 + p.bobPhase)));
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(spin, 1);

        ctx.fillStyle = '#B45309';
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, TWO_PI);
        ctx.fill();
        ctx.stroke();

        // Tuning fork glyph inside coin
        ctx.strokeStyle = '#FFFBEB';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(0, 0);
        ctx.moveTo(-2.5, -4.5);
        ctx.lineTo(-2.5, 0);
        ctx.lineTo(2.5, 0);
        ctx.lineTo(2.5, -4.5);
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'heal_fork') {
        // Emerald-gold Cross-Fork
        ctx.save();
        ctx.translate(px, py);
        const pulse = 1 + 0.08 * Math.sin(time * 6 + p.bobPhase);
        ctx.scale(pulse, pulse);

        ctx.fillStyle = 'rgba(52, 211, 153, 0.24)';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, TWO_PI);
        ctx.fill();

        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 6);
        ctx.stroke();

        ctx.strokeStyle = '#F5C451';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      } else {
        // Radiant treasure resonator ('chest')
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(time * 1.4);

        ctx.fillStyle = 'rgba(245, 196, 81, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, TWO_PI);
        ctx.fill();

        ctx.fillStyle = '#F5C451';
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TWO_PI;
          const r = k % 2 === 0 ? 13 : 9.5;
          const rx = Math.cos(a) * r;
          const ry = Math.sin(a) * r;
          if (k === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawEnemies(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    time: number,
    camX: number,
    camY: number
  ): void {
    const { items, activeIndices, activeCount } = state.enemies;
    const minX = camX - 90;
    const maxX = camX + this.viewW + 90;
    const minY = camY - 90;
    const maxY = camY + this.viewH + 90;

    for (let i = 0; i < activeCount; i++) {
      const e: EnemyEntity = items[activeIndices[i]];
      if (!e.active) continue;
      if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) continue;

      const r = e.radius;
      const flash = e.hitFlash > 0;
      const speedSq = e.vx * e.vx + e.vy * e.vy;
      const moveAngle =
        speedSq > 4
          ? Math.atan2(e.vy, e.vx)
          : Math.atan2(state.player.y - e.y, state.player.x - e.x);

      ctx.save();
      ctx.translate(e.x, e.y);

      // Elite golden aura ring
      if (e.isElite && !e.isBoss) {
        ctx.strokeStyle =
          e.affix === 'hasted'
            ? '#38BDF8'
            : e.affix === 'twin_shot'
              ? '#A3E635'
              : '#F5C451';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0, TWO_PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Dampened rim indicator
      if (e.dampened && e.type !== 'null_dampener') {
        ctx.strokeStyle = 'rgba(232, 121, 249, 0.72)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 3.5, 0, TWO_PI);
        ctx.stroke();
      }

      this.drawEnemySilhouette(ctx, e, r, moveAngle, time, flash);

      // Elite crown halo above unit
      if (e.isElite && !e.isBoss) {
        const cy = -r - 9;
        ctx.fillStyle = '#F5C451';
        ctx.strokeStyle = '#090A10';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-7, cy + 3);
        ctx.lineTo(-8, cy - 4);
        ctx.lineTo(-3, cy);
        ctx.lineTo(0, cy - 6);
        ctx.lineTo(3, cy);
        ctx.lineTo(8, cy - 4);
        ctx.lineTo(7, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Compact HP bar above hurt elites
      if (e.isElite && !e.isBoss && e.hp < e.maxHp && e.hp > 0) {
        const bw = Math.max(28, r * 1.9);
        const bh = 4;
        const bx = -bw * 0.5;
        const by = -r - 19;
        const frac = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
        ctx.fillStyle = 'rgba(9, 10, 16, 0.85)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#F5C451';
        ctx.fillRect(bx, by, bw * frac, bh);
      }

      ctx.restore();
    }
  }

  private drawEnemySilhouette(
    ctx: CanvasRenderingContext2D,
    e: EnemyEntity,
    r: number,
    moveAngle: number,
    time: number,
    flash: boolean
  ): void {
    const fill = flash ? '#FFFFFF' : e.color;
    const accent = flash ? '#FFFFFF' : e.accentColor;

    switch (e.type) {
      case 'static_mite': {
        ctx.rotate(moveAngle);
        ctx.fillStyle = fill;
        ctx.strokeStyle = '#090A10';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(r * 1.15, 0);
        ctx.lineTo(-r * 0.85, -r * 0.85);
        ctx.lineTo(-r * 0.45, 0);
        ctx.lineTo(-r * 0.85, r * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (!flash) {
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        break;
      }

      case 'hum_drone': {
        ctx.rotate(time * 0.7 + e.poolIndex);
        ctx.fillStyle = flash ? '#FFFFFF' : '#291D09';
        ctx.strokeStyle = fill;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TWO_PI;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, TWO_PI);
        ctx.fill();
        break;
      }

      case 'phase_skitter': {
        const angle = e.telegraphTimer > 0 ? e.telegraphAngle : moveAngle;
        ctx.rotate(angle);
        ctx.fillStyle = flash ? '#FFFFFF' : '#1E1033';
        ctx.strokeStyle = fill;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(r * 1.35, 0);
        ctx.lineTo(0, -r * 0.72);
        ctx.lineTo(-r * 1.1, 0);
        ctx.lineTo(0, r * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(r * 0.15, 0, r * 0.28, 0, TWO_PI);
        ctx.fill();
        break;
      }

      case 'siren_node': {
        ctx.rotate(time * 1.6 + e.poolIndex);
        ctx.fillStyle = flash ? '#FFFFFF' : '#14240B';
        ctx.strokeStyle = fill;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TWO_PI;
          const rad = k % 2 === 0 ? r * 1.15 : r * 0.48;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = flash ? '#FFFFFF' : '#E879F9';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.34, 0, TWO_PI);
        ctx.fill();
        break;
      }

      case 'null_dampener': {
        ctx.rotate(-time * 1.2 + e.poolIndex);
        ctx.fillStyle = flash ? '#FFFFFF' : '#190B24';
        ctx.strokeStyle = fill;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TWO_PI);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.56, 0, TWO_PI);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TWO_PI;
          ctx.moveTo(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
        break;
      }

      case 'splitter_chord': {
        const vib = Math.sin(time * 18 + e.poolIndex) * 1.6;
        ctx.rotate(moveAngle);
        ctx.fillStyle = fill;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.8;

        // Top & bottom twin-octahedron halves
        for (let side = -1; side <= 1; side += 2) {
          const oy = side * (r * 0.42 + Math.abs(vib) * 0.5);
          ctx.beginPath();
          ctx.moveTo(r * 0.85, oy);
          ctx.lineTo(0, oy - side * r * 0.45);
          ctx.lineTo(-r * 0.85, oy);
          ctx.lineTo(0, oy + side * r * 0.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        break;
      }

      case 'micro_tick': {
        ctx.rotate(moveAngle);
        ctx.fillStyle = fill;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0);
        ctx.lineTo(-r * 0.8, -r * 0.7);
        ctx.lineTo(-r * 0.8, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'boss_wolf_tone': {
        // Giant crimson-gold serrated dodecagon with rotating brass armor arcs
        ctx.save();
        ctx.rotate(time * 0.55);
        ctx.fillStyle = flash ? '#FFFFFF' : '#260812';
        ctx.strokeStyle = fill;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const teeth = 24;
        for (let k = 0; k < teeth; k++) {
          const a = (k / teeth) * TWO_PI;
          const rad = k % 2 === 0 ? r : r * 0.8;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Rotating brass armor arcs
        ctx.save();
        ctx.rotate(e.armorAngle);
        ctx.strokeStyle = flash ? '#FFFFFF' : '#F5C451';
        ctx.lineWidth = 4;
        for (let k = 0; k < 3; k++) {
          const start = (k / 3) * TWO_PI;
          ctx.beginPath();
          ctx.arc(0, 0, r + 9, start, start + 1.25);
          ctx.stroke();
        }
        ctx.restore();

        // Inner dissonant core
        ctx.fillStyle = flash ? '#FFFFFF' : accent;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.36, 0, TWO_PI);
        ctx.fill();
        break;
      }

      case 'boss_anechoic_monolith': {
        // Multi-ring sacred obelisk mandala
        ctx.save();
        ctx.rotate(time * 0.45);
        ctx.fillStyle = flash ? '#FFFFFF' : '#0E091A';
        ctx.strokeStyle = fill;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TWO_PI;
          const rad = k % 2 === 0 ? r * 1.05 : r * 0.72;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Counter-rotating sacred outer rings
        ctx.save();
        ctx.rotate(-e.armorAngle * 0.9);
        ctx.strokeStyle = flash ? '#FFFFFF' : '#F5C451';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 10, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = flash ? '#FFFFFF' : accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(-r * 0.48, -r * 0.48, r * 0.96, r * 0.96);
        ctx.restore();

        // Luminous aperture eye
        ctx.fillStyle = flash ? '#FFFFFF' : '#FDE047';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.24, 0, TWO_PI);
        ctx.fill();
        break;
      }
    }
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    orbitals: readonly OrbitalNode[],
    time: number
  ): void {
    // 1. Anchor Stance: Golden Nodal Mandala Ring underneath player
    if (player.isAnchored) {
      const anchorGrow = Math.min(1, 0.55 + player.anchorTimer * 1.8);
      const ringR = (player.radius + 26) * anchorGrow;

      ctx.save();
      ctx.translate(player.x, player.y);

      ctx.fillStyle = 'rgba(245, 196, 81, 0.09)';
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, TWO_PI);
      ctx.fill();

      ctx.rotate(time * 1.15);
      ctx.strokeStyle = '#F5C451';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);

      // 8-point sacred mandala geometry
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.58)';
      ctx.lineWidth = 1.4;
      for (let s = 0; s < 2; s++) {
        ctx.rotate(Math.PI * 0.25);
        const side = ringR * 0.7;
        ctx.strokeRect(-side, -side, side * 2, side * 2);
      }
      ctx.restore();
    }

    // 2. Shield: Translucent cyan quartz hex-barrier ring
    if (player.shield > 0) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(-time * 0.8);
      const sr = player.radius + 11;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.82)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TWO_PI;
        const px = Math.cos(a) * sr;
        const py = Math.sin(a) * sr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 3. The Cantor Tuning Stylus
    const invulnBlink =
      player.invulnTimer > 0 && Math.floor(time * 24) % 2 === 0;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facingAngle);
    if (invulnBlink) {
      ctx.globalAlpha = 0.45;
    }

    const r = player.radius;
    const isHurt = player.hurtFlash > 0;

    // Subtle levitation glow
    ctx.fillStyle = isHurt
      ? 'rgba(251, 113, 133, 0.35)'
      : 'rgba(56, 189, 248, 0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.28, 0, TWO_PI);
    ctx.fill();

    // Two-pronged brass tuning stylus silhouette
    ctx.fillStyle = isHurt ? '#FB7185' : '#F5C451';
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(r * 1.32, -r * 0.28);
    ctx.lineTo(r * 0.4, -r * 0.42);
    ctx.lineTo(r * 0.4, -r * 0.14);
    ctx.lineTo(r * 1.1, -r * 0.14);
    ctx.lineTo(r * 1.1, r * 0.14);
    ctx.lineTo(r * 0.4, r * 0.14);
    ctx.lineTo(r * 0.4, r * 0.42);
    ctx.lineTo(r * 1.32, r * 0.28);
    ctx.lineTo(-r * 0.55, r * 0.82);
    ctx.lineTo(-r * 0.98, 0);
    ctx.lineTo(-r * 0.55, -r * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner obsidian chassis & glowing cyan quartz core
    ctx.fillStyle = '#090A10';
    ctx.beginPath();
    ctx.arc(-r * 0.1, 0, r * 0.48, 0, TWO_PI);
    ctx.fill();

    ctx.fillStyle = isHurt ? '#FFF1F2' : '#38BDF8';
    ctx.beginPath();
    ctx.arc(-r * 0.1, 0, r * 0.3, 0, TWO_PI);
    ctx.fill();

    ctx.restore();

    // 4. Chladni Orbitals / Aegis Mandala
    for (let i = 0; i < orbitals.length; i++) {
      const orb = orbitals[i];
      if (!orb.active) continue;

      ctx.save();
      ctx.translate(orb.x, orb.y);
      const dir = orb.ringIndex % 2 === 0 ? 1 : -1;
      ctx.rotate(time * (orb.evolved ? 9 : 6) * dir + i);

      const or = orb.radius;
      const teeth = orb.evolved ? 10 : 8;
      ctx.fillStyle = orb.evolved ? 'rgba(56, 189, 248, 0.28)' : 'rgba(245, 196, 81, 0.24)';
      ctx.strokeStyle = orb.evolved ? '#38BDF8' : '#F5C451';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 0; t < teeth; t++) {
        const a = (t / teeth) * TWO_PI;
        const rad = t % 2 === 0 ? or : or * 0.65;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = orb.evolved ? '#FEF08A' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, 0, or * 0.28, 0, TWO_PI);
      ctx.fill();

      ctx.restore();
    }
  }

  private drawProjectilesAndFX(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    particles: IParticleSystem,
    time: number,
    camX: number,
    camY: number
  ): void {
    const minX = camX - 60;
    const maxX = camX + this.viewW + 60;
    const minY = camY - 60;
    const maxY = camY + this.viewH + 60;

    // Enemy projectiles rendered in source-over for maximal contrast against dark plate
    const { items, activeIndices, activeCount } = state.projectiles;
    for (let i = 0; i < activeCount; i++) {
      const p: ProjectileEntity = items[activeIndices[i]];
      if (!p.active || !p.isEnemy) continue;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;

      ctx.fillStyle = p.color || '#F43F5E';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 2.5, 0, TWO_PI);
      ctx.fill();

      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2.5, p.radius * 0.48), 0, TWO_PI);
      ctx.fill();
    }

    // Selective additive pass ('lighter') for beams, lightning, shockwaves & player projectiles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Player projectiles
    for (let i = 0; i < activeCount; i++) {
      const p: ProjectileEntity = items[activeIndices[i]];
      if (!p.active || p.isEnemy) continue;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;

      const angle = Math.atan2(p.vy, p.vx);
      if (p.sourceId === 'sub_bass_mortar') {
        ctx.fillStyle = p.color || '#F59E0B';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, TWO_PI);
        ctx.fill();

        ctx.strokeStyle = p.evolved ? '#FEF08A' : '#FDE047';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 1.35, 0, TWO_PI);
        ctx.stroke();
      } else if (p.sourceId === 'standing_lance') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.fillStyle = p.color || '#C084FC';
        ctx.fillRect(-p.radius * 2.4, -p.radius * 0.45, p.radius * 4.8, p.radius * 0.9);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-p.radius * 1.6, -p.radius * 0.2, p.radius * 3.2, p.radius * 0.4);
        ctx.restore();
      } else {
        // Strike Ping / Tesla Philharmonic / Shrapnel / Overdrive
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        const len = p.evolved ? p.radius * 2.2 : p.radius * 1.75;
        const wid = p.radius * 0.85;

        ctx.fillStyle = p.color || '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.lineTo(-len * 0.45, -wid);
        ctx.lineTo(-len * 0.2, 0);
        ctx.lineTo(-len * 0.45, wid);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(len * 0.2, 0, Math.max(1.8, p.radius * 0.35), 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }
    }

    // Beams & 4-segment jagged lightning bolts
    const beams = particles.beams;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i];
      if (!b.active) continue;
      const frac = Math.max(0, b.life / Math.max(0.01, b.maxLife));
      ctx.globalAlpha = frac;

      if (b.isLightning) {
        const dx = b.x2 - b.x1;
        const dy = b.y2 - b.y1;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const jitterAmp = Math.min(20, dist * 0.14);

        this.boltPointsX[0] = b.x1;
        this.boltPointsY[0] = b.y1;
        this.boltPointsX[4] = b.x2;
        this.boltPointsY[4] = b.y2;

        const seedBase = i * 31 + ((time * 60) | 0);
        for (let seg = 1; seg <= 3; seg++) {
          const t = seg * 0.25;
          const sHash = Math.sin(seedBase * 12.9898 + seg * 78.233) * 43758.5453;
          const offset = ((sHash - Math.floor(sHash)) * 2 - 1) * jitterAmp;
          this.boltPointsX[seg] = b.x1 + dx * t + nx * offset;
          this.boltPointsY[seg] = b.y1 + dy * t + ny * offset;
        }

        // Colored outer lightning glow
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width * 2.1;
        ctx.beginPath();
        ctx.moveTo(this.boltPointsX[0], this.boltPointsY[0]);
        for (let seg = 1; seg <= 4; seg++) {
          ctx.lineTo(this.boltPointsX[seg], this.boltPointsY[seg]);
        }
        ctx.stroke();

        // Crisp white inner arc
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.2, b.width * 0.65);
        ctx.stroke();
      } else {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width * (0.6 + 0.6 * frac);
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(1.4, b.width * 0.35 * frac);
        ctx.stroke();
      }
    }

    // Shockwaves
    const shockwaves = particles.shockwaves;
    for (let i = 0; i < shockwaves.length; i++) {
      const s = shockwaves[i];
      if (!s.active) continue;
      const t = 1 - Math.max(0, s.life / Math.max(0.01, s.maxLife));
      const easeOut = 1 - (1 - t) * (1 - t);
      const r = s.startRadius + (s.endRadius - s.startRadius) * easeOut;
      const alpha = 1 - t;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, s.lineWidth * alpha);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, TWO_PI);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: IParticleSystem,
    camX: number,
    camY: number
  ): void {
    const list = particles.particles;
    const minX = camX - 24;
    const maxX = camX + this.viewW + 24;
    const minY = camY - 24;
    const maxY = camY + this.viewH + 24;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.active) continue;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;

      const frac = Math.max(0, p.life / Math.max(0.01, p.maxLife));
      const sz = p.size * (0.35 + 0.65 * frac);
      ctx.globalAlpha = frac;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawDamageNumbers(
    ctx: CanvasRenderingContext2D,
    particles: IParticleSystem
  ): void {
    const list = particles.damageNumbers;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#05060A';
    ctx.lineWidth = 2.6;

    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d.active) continue;

      const frac = Math.max(0, d.life / Math.max(0.01, d.maxLife));
      const alpha = frac < 0.35 ? frac / 0.35 : 1;
      const pop = frac > 0.85 ? 1 + (frac - 0.85) * 1.4 : 1;
      const fontSize = Math.round(14 * d.scale * pop);

      ctx.globalAlpha = alpha;
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillText(d.text, d.x, d.y);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawScreenOverlays(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    time: number
  ): void {
    const { particles, player, input } = state;

    // 1. Screen flash tint
    if (particles.flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = particles.flashAlpha;
      ctx.fillStyle = particles.flashColor;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.restore();
    }

    // 2. Low-HP (< 30%) crimson edge pulse
    if (player.hp > 0 && player.maxHp > 0 && player.hp / player.maxHp < 0.3) {
      const pulse = 0.16 + 0.14 * Math.sin(time * 7.5);
      const cx = this.viewW * 0.5;
      const cy = this.viewH * 0.5;
      const outerR = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, outerR * 0.45, cx, cy, outerR);
      grad.addColorStop(0, 'rgba(244, 63, 94, 0)');
      grad.addColorStop(1, `rgba(244, 63, 94, ${pulse.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // 3. Floating Virtual Joystick
    if (input.joystickActive) {
      ctx.save();

      // Translucent brass outer ring
      ctx.fillStyle = 'rgba(9, 10, 16, 0.28)';
      ctx.strokeStyle = 'rgba(245, 196, 81, 0.48)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(input.originX, input.originY, 48, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();

      // Inner guide ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(input.originX, input.originY, 24, 0, TWO_PI);
      ctx.stroke();

      // Tether line
      ctx.strokeStyle = 'rgba(245, 196, 81, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(input.originX, input.originY);
      ctx.lineTo(input.knobX, input.knobY);
      ctx.stroke();

      // Glowing cyan-gold thumb nub
      ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.beginPath();
      ctx.arc(input.knobX, input.knobY, 24, 0, TWO_PI);
      ctx.fill();

      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = '#F5C451';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(input.knobX, input.knobY, 17, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath();
      ctx.arc(input.knobX, input.knobY, 5, 0, TWO_PI);
      ctx.fill();

      ctx.restore();
    }
  }
}
