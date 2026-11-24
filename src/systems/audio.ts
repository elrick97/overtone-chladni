import type { IAudio, InstrumentId, PickupEntity } from '../types.ts';

// D-minor pentatonic / Dorian harmonic frequencies (Hz)
const HARMONIC_SCALE: readonly number[] = [
  146.83, // D3
  174.61, // F3
  196.0,  // G3
  220.0,  // A3
  261.63, // C4
  293.66, // D4
  349.23, // F4
  392.0,  // G4
  440.0,  // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5 (Dorian 6th)
  698.46, // F5
  880.0,  // A5
];

const THROTTLE_SHOOT_MS = 42;
const THROTTLE_HIT_MS = 32;
const THROTTLE_KILL_MS = 45;
const THROTTLE_PICKUP_MS = 28;

const MAX_COMBAT_VOICES = 22;
const MAX_TOTAL_VOICES = 30;

const MUSIC_INTERVAL_MS = 250;
const MUSIC_LOOKAHEAD_SEC = 0.34;
const MUSIC_STEP_SEC = 0.25;
const MUSIC_PATTERN: readonly number[] = [0, -1, 3, 4, -1, 5, 7, -1, 2, -1, 6, 4, -1, 8, 5, -1];

export class SynthAudio implements IAudio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private silentBuffer: AudioBuffer | null = null;

  private sfxEnabled = true;
  private musicEnabled = true;
  private suspended = false;
  private unlockedOnce = false;

  private activeVoices = 0;
  private shootPitchStep = 0;

  private lastShootMs = 0;
  private lastHitMs = 0;
  private lastKillMs = 0;
  private lastPickupMs = 0;

  private musicWanted = false;
  private musicFrequencyHz = 146.83;
  private musicTimerId: number | null = null;
  private musicNextNoteTime = 0;
  private musicStepIndex = 0;

  public unlock(): void {
    if (typeof window === 'undefined') return;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;
      compressor.connect(ctx.destination);

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = this.sfxEnabled ? 0.85 : 0;
      sfxGain.connect(compressor);

      const musicGain = ctx.createGain();
      musicGain.gain.value = this.musicEnabled ? 0.32 : 0;
      musicGain.connect(compressor);

      this.ctx = ctx;
      this.sfxGain = sfxGain;
      this.musicGain = musicGain;
      this.silentBuffer = ctx.createBuffer(1, 1, 22050);
    }

    const ctx = this.ctx;
    const state = ctx.state as string;
    const needsResume = state === 'suspended' || state === 'interrupted';

    if (needsResume && !this.suspended) {
      ctx.resume().catch(() => {});
    }

    if ((needsResume || !this.unlockedOnce) && this.silentBuffer) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.silentBuffer;
        src.connect(ctx.destination);
        src.start(0);
        this.unlockedOnce = true;
      } catch {
        // Ignore if context is closed or restricted
      }
    }

    if (this.musicWanted && this.musicEnabled && !this.suspended && this.musicTimerId === null) {
      this.startMusicScheduler();
    }
  }

  public setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    if (!this.ctx) return;

    const state = this.ctx.state as string;
    if (suspended) {
      if (state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    } else {
      if (state === 'suspended' || state === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }
      this.musicNextNoteTime = this.ctx.currentTime + 0.05;
      if (this.musicWanted && this.musicEnabled && this.musicTimerId === null) {
        this.startMusicScheduler();
      }
    }
  }

  public setSettings(sfxEnabled: boolean, musicEnabled: boolean): void {
    this.sfxEnabled = sfxEnabled;
    this.musicEnabled = musicEnabled;

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(sfxEnabled ? 0.85 : 0, now, 0.02);
    }
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(musicEnabled ? 0.32 : 0, now, 0.04);
    }

    if (!musicEnabled) {
      this.stopMusicScheduler();
    } else if (this.musicWanted && !this.suspended && this.musicTimerId === null) {
      this.startMusicScheduler();
    }
  }

  public startMusic(frequencyHz?: number): void {
    if (typeof frequencyHz === 'number' && Number.isFinite(frequencyHz) && frequencyHz > 0) {
      this.musicFrequencyHz = frequencyHz;
    }
    this.musicWanted = true;
    if (this.ctx && this.musicEnabled && !this.suspended && this.musicTimerId === null) {
      this.startMusicScheduler();
    }
  }

  public stopMusic(): void {
    this.musicWanted = false;
    this.stopMusicScheduler();
  }

  public playShoot(instrument: InstrumentId, evolved: boolean): void {
    if (!this.canPlayCombatSfx()) return;
    const nowMs = performance.now();
    if (nowMs - this.lastShootMs < THROTTLE_SHOOT_MS) return;
    this.lastShootMs = nowMs;

    const ctx = this.ctx!;
    const out = this.sfxGain!;
    const t = ctx.currentTime;
    const step = this.shootPitchStep++;
    const scaleBias = HARMONIC_SCALE[(step % 4) + 8]; // A4..F5

    switch (instrument) {
      case 'strike_ping': {
        const f = step % 2 === 0 ? 587.33 : 440.0;
        this.spawnTone(out, 'triangle', f, f * 0.98, t, 0.004, 0.085, 0.13);
        this.spawnTone(out, 'sine', f * 2, f * 2, t, 0.002, 0.06, 0.06);
        if (evolved) {
          this.spawnTone(out, 'triangle', f * 1.5, f * 1.5, t + 0.01, 0.004, 0.09, 0.07);
        }
        break;
      }
      case 'chladni_orbitals': {
        this.spawnTone(out, 'sine', 880.0, 932.33, t, 0.015, 0.13, 0.09);
        this.spawnTone(out, 'triangle', 1318.5, 1318.5, t, 0.012, 0.11, 0.05);
        if (evolved) {
          this.spawnTone(out, 'sine', 1760.0, 1760.0, t + 0.008, 0.01, 0.14, 0.055);
        }
        break;
      }
      case 'arc_tessitura': {
        this.spawnFmZap(out, scaleBias * 1.5, scaleBias * 0.75, 190, 95, t, 0.085, 0.11);
        if (evolved) {
          this.spawnTone(out, 'triangle', scaleBias * 2, scaleBias * 3, t, 0.003, 0.075, 0.065);
        }
        break;
      }
      case 'sub_bass_mortar': {
        this.spawnTone(out, 'sine', 110.0, 45.0, t, 0.005, 0.15, 0.22);
        this.spawnTone(out, 'triangle', 220.0, 73.42, t, 0.003, 0.06, 0.11);
        if (evolved) {
          this.spawnTone(out, 'triangle', 165.0, 67.5, t + 0.01, 0.004, 0.14, 0.1);
        }
        break;
      }
      case 'standing_lance': {
        this.spawnFilteredSweep(
          out,
          'sawtooth',
          1174.66,
          587.33,
          2800,
          900,
          5,
          t,
          0.11,
          0.09
        );
        this.spawnTone(out, 'sine', 1174.66, 587.33, t, 0.004, 0.11, 0.08);
        if (evolved) {
          this.spawnTone(out, 'sine', 1760.0, 1174.66, t, 0.004, 0.13, 0.06);
        }
        break;
      }
    }
  }

  public playHit(isCrit: boolean): void {
    if (!this.canPlayCombatSfx()) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHitMs < THROTTLE_HIT_MS) return;
    this.lastHitMs = nowMs;

    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    if (isCrit) {
      this.spawnTone(out, 'sine', 880.0, 880.0, t, 0.002, 0.11, 0.12);
      this.spawnTone(out, 'triangle', 1318.5, 1318.5, t, 0.002, 0.095, 0.09);
    } else {
      this.spawnTone(out, 'triangle', 320.0, 130.0, t, 0.002, 0.036, 0.08);
    }
  }

  public playKill(isEliteOrBoss: boolean): void {
    if (!this.canPlaySfx(isEliteOrBoss)) return;
    const nowMs = performance.now();
    if (!isEliteOrBoss && nowMs - this.lastKillMs < THROTTLE_KILL_MS) return;
    this.lastKillMs = nowMs;

    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    if (isEliteOrBoss) {
      // Deep brass gong + octave crystalline chime
      this.spawnFilteredSweep(out, 'sawtooth', 146.83, 144.0, 950, 220, 2.5, t, 0.48, 0.2);
      this.spawnTone(out, 'sine', 73.42, 65.41, t, 0.008, 0.5, 0.24);
      this.spawnTone(out, 'sine', 587.33, 587.33, t + 0.02, 0.004, 0.3, 0.12);
      this.spawnTone(out, 'triangle', 880.0, 880.0, t + 0.05, 0.004, 0.34, 0.11);
      this.spawnTone(out, 'sine', 1174.66, 1174.66, t + 0.08, 0.004, 0.36, 0.09);
    } else {
      const f1 = HARMONIC_SCALE[(this.shootPitchStep % 5) + 7];
      this.spawnTone(out, 'sine', f1, f1 * 1.12, t, 0.003, 0.09, 0.1);
      this.spawnTone(out, 'triangle', f1 * 1.5, f1 * 2, t + 0.018, 0.003, 0.11, 0.07);
    }
  }

  public playPickup(kind: PickupEntity['kind'], comboStep: number): void {
    if (!this.canPlayCombatSfx()) return;
    const nowMs = performance.now();
    if (kind === 'xp' && nowMs - this.lastPickupMs < THROTTLE_PICKUP_MS) return;
    this.lastPickupMs = nowMs;

    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    if (kind === 'xp') {
      const safeStep = comboStep >= 0 ? comboStep : 0;
      const freq = HARMONIC_SCALE[safeStep % HARMONIC_SCALE.length];
      this.spawnTone(out, 'sine', freq, freq, t, 0.003, 0.095, 0.11);
      this.spawnTone(out, 'triangle', freq * 2, freq * 2, t, 0.002, 0.06, 0.045);
    } else if (kind === 'brass') {
      this.spawnTone(out, 'triangle', 587.33, 587.33, t, 0.003, 0.085, 0.12);
      this.spawnTone(out, 'sine', 880.0, 880.0, t + 0.045, 0.003, 0.13, 0.12);
    } else {
      // 'heal_fork' or 'chest': warm D-major chord swell
      this.spawnTone(out, 'sine', 293.66, 293.66, t, 0.025, 0.26, 0.12);
      this.spawnTone(out, 'triangle', 369.99, 369.99, t + 0.03, 0.025, 0.28, 0.1);
      this.spawnTone(out, 'sine', 440.0, 440.0, t + 0.06, 0.025, 0.3, 0.1);
      if (kind === 'chest') {
        this.spawnTone(out, 'sine', 587.33, 587.33, t + 0.09, 0.02, 0.36, 0.12);
      }
    }
  }

  public playAnchorLock(): void {
    if (!this.canPlaySfx(true)) return;
    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;
    this.spawnTone(out, 'triangle', 1174.66, 440.0, t, 0.002, 0.035, 0.11);
    this.spawnTone(out, 'sine', 220.0, 220.0, t + 0.01, 0.01, 0.18, 0.13);
  }

  public playOverdrive(): void {
    if (!this.canPlaySfx(true)) return;
    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    // Sub-bass drop
    this.spawnTone(out, 'sine', 146.83, 36.71, t, 0.01, 0.55, 0.3);
    // Rising harmonic chord sweep
    this.spawnFilteredSweep(out, 'sawtooth', 293.66, 293.66, 320, 3400, 3.2, t, 0.48, 0.12);
    this.spawnFilteredSweep(out, 'sawtooth', 440.0, 440.0, 400, 3800, 2.5, t + 0.02, 0.48, 0.1);
    this.spawnTone(out, 'triangle', 587.33, 880.0, t + 0.04, 0.03, 0.45, 0.11);
  }

  public playLevelUp(): void {
    if (!this.canPlaySfx(true)) return;
    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    // 4-note rising D-major9 brass-bell arpeggio
    const notes = [293.66, 369.99, 440.0, 659.25];
    for (let i = 0; i < notes.length; i++) {
      const start = t + i * 0.068;
      const dur = i === notes.length - 1 ? 0.34 : 0.18;
      this.spawnTone(out, 'triangle', notes[i], notes[i], start, 0.005, dur, 0.14);
      this.spawnTone(out, 'sine', notes[i] * 2, notes[i] * 2, start, 0.004, dur * 0.8, 0.065);
    }
  }

  public playEvolution(): void {
    if (!this.canPlaySfx(true)) return;
    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    // 5-note golden shimmer octave cascade
    const notes = [293.66, 440.0, 587.33, 880.0, 1174.66];
    this.spawnTone(out, 'sine', 146.83, 146.83, t, 0.02, 0.65, 0.18);
    for (let i = 0; i < notes.length; i++) {
      const start = t + i * 0.075;
      const dur = i === notes.length - 1 ? 0.52 : 0.25;
      this.spawnTone(out, 'triangle', notes[i], notes[i], start, 0.006, dur, 0.13);
      this.spawnTone(out, 'sine', notes[i] * 1.004, notes[i] * 1.004, start, 0.01, dur, 0.09);
    }
  }

  public playPlayerHurt(): void {
    if (!this.canPlaySfx(true)) return;
    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    // Dissonant detuned sawtooth crunch + low thud
    this.spawnFilteredSweep(out, 'sawtooth', 110.0, 78.0, 1100, 200, 3, t, 0.21, 0.15);
    this.spawnFilteredSweep(out, 'sawtooth', 117.5, 83.0, 1100, 200, 3, t, 0.21, 0.14);
    this.spawnTone(out, 'sine', 92.0, 38.0, t, 0.004, 0.18, 0.24);
  }

  public playBossWarning(): void {
    if (!this.canPlaySfx(true)) return;
    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;

    // Ominous 2-pulse low brass horn (D2 + tritone G#2)
    for (let i = 0; i < 2; i++) {
      const start = t + i * 0.34;
      this.spawnFilteredSweep(out, 'sawtooth', 73.42, 71.0, 420, 160, 2.2, start, 0.27, 0.18);
      this.spawnFilteredSweep(out, 'sawtooth', 103.83, 100.0, 460, 180, 2.2, start, 0.27, 0.14);
    }
  }

  public playButton(): void {
    if (!this.canPlaySfx(true)) return;
    const t = this.ctx!.currentTime;
    const out = this.sfxGain!;
    this.spawnTone(out, 'sine', 587.33, 880.0, t, 0.002, 0.036, 0.1);
  }

  private canPlayCombatSfx(): boolean {
    return this.canPlaySfx(false);
  }

  private canPlaySfx(priority: boolean): boolean {
    if (!this.sfxEnabled || this.suspended || !this.ctx || !this.sfxGain) {
      return false;
    }
    if (this.ctx.state !== 'running') {
      return false;
    }
    const cap = priority ? MAX_TOTAL_VOICES : MAX_COMBAT_VOICES;
    return this.activeVoices < cap;
  }

  private startMusicScheduler(): void {
    if (!this.ctx || this.musicTimerId !== null) return;
    this.musicNextNoteTime = this.ctx.currentTime + 0.05;
    this.musicTimerId = window.setInterval(() => {
      this.scheduleMusicTick();
    }, MUSIC_INTERVAL_MS);
    this.scheduleMusicTick();
  }

  private stopMusicScheduler(): void {
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  private scheduleMusicTick(): void {
    if (
      !this.musicWanted ||
      !this.musicEnabled ||
      this.suspended ||
      !this.ctx ||
      !this.musicGain ||
      this.ctx.state !== 'running'
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    if (this.musicNextNoteTime < now - 0.1) {
      this.musicNextNoteTime = now + 0.04;
    }

    while (this.musicNextNoteTime < now + MUSIC_LOOKAHEAD_SEC) {
      this.scheduleMusicStep(this.musicNextNoteTime, this.musicStepIndex);
      this.musicNextNoteTime += MUSIC_STEP_SEC;
      this.musicStepIndex = (this.musicStepIndex + 1) & 15;
    }
  }

  private scheduleMusicStep(time: number, step: number): void {
    if (!this.ctx || !this.musicGain || this.activeVoices >= MAX_TOTAL_VOICES) return;

    // Normalize wave frequency into warm sub-bass range (65Hz..130Hz)
    let rootBass = this.musicFrequencyHz;
    while (rootBass > 130) rootBass *= 0.5;
    while (rootBass < 65) rootBass *= 2;
    const timbreNorm = Math.min(1, Math.max(0, (this.musicFrequencyHz - 140) / 400));

    // Warm cymatic sub-bass drone pulse every 2 beats (8 steps)
    if (step % 8 === 0) {
      const bassFreq = step === 0 ? rootBass : rootBass * 1.125; // slight 2nd shift on bar B
      this.spawnFilteredSweep(
        this.musicGain,
        'triangle',
        bassFreq,
        bassFreq,
        220 + timbreNorm * 140,
        140,
        1.2,
        time,
        1.45,
        0.18,
        0.08
      );
      this.spawnTone(this.musicGain, 'sine', bassFreq, bassFreq, time, 0.08, 1.5, 0.22);
    }

    // Subtle mid pulse on quarter beats
    if (step % 4 === 2 && this.activeVoices < MAX_TOTAL_VOICES - 2) {
      this.spawnTone(this.musicGain, 'sine', rootBass * 2, rootBass * 2, time, 0.02, 0.38, 0.07);
    }

    // Delicate pentatonic overtone plucks
    const scaleOffset = MUSIC_PATTERN[step];
    if (scaleOffset >= 0 && this.activeVoices < MAX_TOTAL_VOICES - 2) {
      const baseIndex = 4 + scaleOffset; // C4..A5 region
      const noteFreq = HARMONIC_SCALE[baseIndex % HARMONIC_SCALE.length];
      // Subtle shimmer shift on higher waves
      const detunedFreq = noteFreq * (1 + timbreNorm * 0.002);
      this.spawnTone(this.musicGain, 'sine', detunedFreq, detunedFreq, time, 0.008, 0.34, 0.09);
      if (timbreNorm > 0.35 && step % 2 === 1) {
        this.spawnTone(
          this.musicGain,
          'triangle',
          detunedFreq * 2,
          detunedFreq * 2,
          time + 0.01,
          0.008,
          0.22,
          0.035
        );
      }
    }
  }

  private spawnTone(
    destination: AudioNode,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startTime: number,
    attackSec: number,
    durationSec: number,
    peakGain: number
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        startTime + durationSec
      );
    }

    const attackEnd = startTime + Math.max(0.001, attackSec);
    const endTime = startTime + Math.max(attackSec + 0.01, durationSec);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(Math.max(0.0002, peakGain), attackEnd);
    env.gain.exponentialRampToValueAtTime(0.0001, endTime);

    osc.connect(env);
    env.connect(destination);

    this.activeVoices++;
    osc.onended = () => {
      if (this.activeVoices > 0) this.activeVoices--;
      osc.disconnect();
      env.disconnect();
    };

    osc.start(startTime);
    osc.stop(endTime + 0.01);
  }

  private spawnFilteredSweep(
    destination: AudioNode,
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    startCutoff: number,
    endCutoff: number,
    q: number,
    startTime: number,
    durationSec: number,
    peakGain: number,
    attackSec = 0.005
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), startTime);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFreq),
        startTime + durationSec
      );
    }

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(q, startTime);
    filter.frequency.setValueAtTime(Math.max(40, startCutoff), startTime);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, endCutoff),
      startTime + durationSec
    );

    const attackEnd = startTime + Math.max(0.002, attackSec);
    const endTime = startTime + Math.max(attackSec + 0.015, durationSec);

    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(Math.max(0.0002, peakGain), attackEnd);
    env.gain.exponentialRampToValueAtTime(0.0001, endTime);

    osc.connect(filter);
    filter.connect(env);
    env.connect(destination);

    this.activeVoices++;
    osc.onended = () => {
      if (this.activeVoices > 0) this.activeVoices--;
      osc.disconnect();
      filter.disconnect();
      env.disconnect();
    };

    osc.start(startTime);
    osc.stop(endTime + 0.01);
  }

  private spawnFmZap(
    destination: AudioNode,
    carrierStartHz: number,
    carrierEndHz: number,
    modFreqHz: number,
    modDepthHz: number,
    startTime: number,
    durationSec: number,
    peakGain: number
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const env = ctx.createGain();

    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(Math.max(40, carrierStartHz), startTime);
    carrier.frequency.exponentialRampToValueAtTime(
      Math.max(40, carrierEndHz),
      startTime + durationSec
    );

    mod.type = 'sine';
    mod.frequency.setValueAtTime(Math.max(20, modFreqHz), startTime);
    modGain.gain.setValueAtTime(modDepthHz, startTime);
    modGain.gain.exponentialRampToValueAtTime(1, startTime + durationSec);

    const endTime = startTime + durationSec;
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(Math.max(0.0002, peakGain), startTime + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, endTime);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(destination);

    this.activeVoices += 2;
    carrier.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 2);
      mod.disconnect();
      modGain.disconnect();
      carrier.disconnect();
      env.disconnect();
    };

    mod.start(startTime);
    carrier.start(startTime);
    mod.stop(endTime + 0.01);
    carrier.stop(endTime + 0.01);
  }
}
