import type {
  AcousticModifierId,
  EnemyTypeId,
  IRng,
  WaveConfig,
} from '../types';

interface AuthoredWaveSpec {
  frequencyHz: number;
  chladniN: number;
  chladniM: number;
  duration: number;
  isBossWave: boolean;
  bossId?: 'boss_wolf_tone' | 'boss_anechoic_monolith';
  weights: Partial<Record<EnemyTypeId, number>>;
  accentColor: string;
}

const AUTHORED_WAVES: readonly AuthoredWaveSpec[] = [
  // Wave 1 (110.0 Hz - A2)
  {
    frequencyHz: 110.0,
    chladniN: 2,
    chladniM: 1,
    duration: 26,
    isBossWave: false,
    weights: {
      static_mite: 1.0,
    },
    accentColor: '#38BDF8',
  },
  // Wave 2 (130.8 Hz - C3): introduces Hum Drone
  {
    frequencyHz: 130.8,
    chladniN: 3,
    chladniM: 1,
    duration: 28,
    isBossWave: false,
    weights: {
      static_mite: 0.78,
      hum_drone: 0.22,
    },
    accentColor: '#F59E0B',
  },
  // Wave 3 (146.8 Hz - D3): introduces Phase Skitter (+ Elites begin)
  {
    frequencyHz: 146.8,
    chladniN: 3,
    chladniM: 2,
    duration: 29,
    isBossWave: false,
    weights: {
      static_mite: 0.54,
      hum_drone: 0.2,
      phase_skitter: 0.26,
    },
    accentColor: '#C084FC',
  },
  // Wave 4 (196.0 Hz - G3): introduces Siren Node
  {
    frequencyHz: 196.0,
    chladniN: 4,
    chladniM: 1,
    duration: 30,
    isBossWave: false,
    weights: {
      static_mite: 0.44,
      hum_drone: 0.18,
      phase_skitter: 0.2,
      siren_node: 0.18,
    },
    accentColor: '#84CC16',
  },
  // Wave 5 (220.0 Hz - A3): Boss 1 — THE WOLF TONE
  {
    frequencyHz: 220.0,
    chladniN: 4,
    chladniM: 3,
    duration: 60,
    isBossWave: true,
    bossId: 'boss_wolf_tone',
    weights: {
      static_mite: 0.5,
      hum_drone: 0.16,
      phase_skitter: 0.2,
      siren_node: 0.14,
    },
    accentColor: '#F43F5E',
  },
  // Wave 6 (261.6 Hz - C4): introduces Splitter Chord
  {
    frequencyHz: 261.6,
    chladniN: 5,
    chladniM: 2,
    duration: 31,
    isBossWave: false,
    weights: {
      static_mite: 0.3,
      hum_drone: 0.15,
      phase_skitter: 0.18,
      siren_node: 0.15,
      splitter_chord: 0.22,
    },
    accentColor: '#FB7185',
  },
  // Wave 7 (293.7 Hz - D4): introduces Null Dampener
  {
    frequencyHz: 293.7,
    chladniN: 5,
    chladniM: 3,
    duration: 32,
    isBossWave: false,
    weights: {
      static_mite: 0.26,
      hum_drone: 0.14,
      phase_skitter: 0.16,
      siren_node: 0.14,
      splitter_chord: 0.18,
      null_dampener: 0.12,
    },
    accentColor: '#EC4899',
  },
  // Wave 8 (329.6 Hz - E4): high-tempo swarm pressure
  {
    frequencyHz: 329.6,
    chladniN: 6,
    chladniM: 1,
    duration: 33,
    isBossWave: false,
    weights: {
      static_mite: 0.24,
      hum_drone: 0.14,
      phase_skitter: 0.2,
      siren_node: 0.14,
      splitter_chord: 0.16,
      null_dampener: 0.12,
    },
    accentColor: '#22D3EE',
  },
  // Wave 9 (392.0 Hz - G4): pre-boss crescendo
  {
    frequencyHz: 392.0,
    chladniN: 6,
    chladniM: 5,
    duration: 34,
    isBossWave: false,
    weights: {
      static_mite: 0.2,
      hum_drone: 0.16,
      phase_skitter: 0.18,
      siren_node: 0.16,
      splitter_chord: 0.16,
      null_dampener: 0.14,
    },
    accentColor: '#F5C451',
  },
  // Wave 10 (440.0 Hz - A4): Boss 2 — ANECHOIC MONOLITH
  {
    frequencyHz: 440.0,
    chladniN: 7,
    chladniM: 4,
    duration: 60,
    isBossWave: true,
    bossId: 'boss_anechoic_monolith',
    weights: {
      static_mite: 0.24,
      hum_drone: 0.15,
      phase_skitter: 0.18,
      siren_node: 0.15,
      splitter_chord: 0.16,
      null_dampener: 0.12,
    },
    accentColor: '#A855F7',
  },
];

interface AcousticModifierSpec {
  id: Exclude<AcousticModifierId, 'none'>;
  label: string;
  accentColor: string;
}

const ENDLESS_MODIFIERS: readonly AcousticModifierSpec[] = [
  {
    id: 'doppler_surge',
    label: 'DOPPLER SURGE (+20% Enemy & Player Speed)',
    accentColor: '#38BDF8',
  },
  {
    id: 'dense_choir',
    label: 'DENSE CHOIR (+35% Swarm Size & XP)',
    accentColor: '#FB7185',
  },
  {
    id: 'blood_octave',
    label: 'BLOOD OCTAVE (+25% All Damage & Brass)',
    accentColor: '#F43F5E',
  },
  {
    id: 'sub_harmonic_armor',
    label: 'SUB-HARMONIC (+25% Toughness, +1 Elite Drop)',
    accentColor: '#F5C451',
  },
];

const ENDLESS_CHLADNI_MODES: readonly [number, number][] = [
  [5, 4],
  [7, 2],
  [7, 5],
  [8, 3],
  [8, 5],
  [9, 2],
  [9, 4],
  [9, 7],
  [10, 3],
  [11, 4],
  [11, 6],
  [12, 5],
];

export function getWaveConfig(waveNumber: number, rng: IRng): WaveConfig {
  const w = Math.max(1, Math.floor(waveNumber));

  let hpMult = (1 + 0.18 * (w - 1)) * Math.pow(1.09, Math.max(0, w - 10));
  let damageMult = (1 + 0.11 * (w - 1)) * Math.pow(1.04, Math.max(0, w - 10));
  let spawnBudget = Math.floor(
    18 + 6.5 * w + 1.4 * Math.pow(Math.max(0, w - 10), 1.35)
  );
  const eliteChance = w < 3 ? 0 : Math.min(0.3, 0.04 + 0.015 * (w - 3));
  let speedMult = 1 + Math.min(0.45, 0.012 * (w - 1));

  if (w <= AUTHORED_WAVES.length) {
    const spec = AUTHORED_WAVES[w - 1];
    if (spec.isBossWave) {
      hpMult *= 1.08;
    }

    return {
      wave: w,
      frequencyHz: spec.frequencyHz,
      chladniN: spec.chladniN,
      chladniM: spec.chladniM,
      duration: spec.duration,
      isBossWave: spec.isBossWave,
      bossId: spec.bossId,
      spawnBudget,
      hpMult,
      damageMult,
      speedMult,
      eliteChance,
      weights: { ...spec.weights },
      modifier: 'none',
      modifierLabel: '',
      accentColor: spec.accentColor,
    };
  }

  // Endless Ultrasonic Overdrive (Wave 11+)
  const endlessIndex = w - 11;
  const isBossWave = w % 5 === 0;
  const bossCycle = Math.floor(w / 5); // 3 -> W15, 4 -> W20, ...
  const bossId: WaveConfig['bossId'] = isBossWave
    ? bossCycle % 2 === 1
      ? 'boss_wolf_tone'
      : 'boss_anechoic_monolith'
    : undefined;

  if (isBossWave) {
    // Cleanly boost boss-wave HP scaling per 5-wave tier
    hpMult *= 1.12 + 0.06 * Math.max(0, bossCycle - 2);
  }

  // Ascending ultrasonic frequency from 440 Hz upward
  const frequencyHz = Math.round(440 * Math.pow(2, (w - 10) / 5) * 10) / 10;

  // Pick a Chladni (n, m) mode with n !== m
  const modeOffset = rng.int(0, ENDLESS_CHLADNI_MODES.length - 1);
  const [chladniN, chladniM] =
    ENDLESS_CHLADNI_MODES[(endlessIndex + modeOffset) % ENDLESS_CHLADNI_MODES.length];

  // Rotating Acoustic Modifier (randomized slightly around the cycle)
  const modSpec =
    ENDLESS_MODIFIERS[(endlessIndex + rng.int(0, 1)) % ENDLESS_MODIFIERS.length];

  if (modSpec.id === 'doppler_surge') {
    speedMult *= 1.2;
  } else if (modSpec.id === 'dense_choir') {
    spawnBudget = Math.floor(spawnBudget * 1.35);
  } else if (modSpec.id === 'blood_octave') {
    damageMult *= 1.25;
  } else if (modSpec.id === 'sub_harmonic_armor') {
    hpMult *= 1.25;
  }

  const weights: Partial<Record<EnemyTypeId, number>> = {
    static_mite: 0.2,
    hum_drone: 0.15,
    phase_skitter: 0.19,
    siren_node: 0.16,
    splitter_chord: 0.17,
    null_dampener: 0.13,
  };

  const duration = isBossWave ? 60 : Math.min(42, 34 + Math.floor((w - 10) / 3));

  return {
    wave: w,
    frequencyHz,
    chladniN,
    chladniM,
    duration,
    isBossWave,
    bossId,
    spawnBudget,
    hpMult,
    damageMult,
    speedMult,
    eliteChance,
    weights,
    modifier: modSpec.id,
    modifierLabel: modSpec.label,
    accentColor: isBossWave
      ? bossId === 'boss_wolf_tone'
        ? '#F43F5E'
        : '#A855F7'
      : modSpec.accentColor,
  };
}
