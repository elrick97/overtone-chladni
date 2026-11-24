import {
  STORAGE_KEY,
  type EvolutionId,
  type MetaBonuses,
  type MetaUpgradeDef,
  type MetaUpgradeId,
  type SaveData,
  type SaveSettings,
} from '../types';

const META_UPGRADE_IDS: readonly MetaUpgradeId[] = [
  'tempered_alloy',
  'keen_striker',
  'magnetic_core',
  'harmonic_memory',
  'overclocked_coil',
];

const VALID_EVOLUTIONS: ReadonlySet<string> = new Set<EvolutionId>([
  'evo_tesla_philharmonic',
  'evo_aegis_mandala',
  'evo_storm_conductor',
  'evo_tectonic_drop',
  'evo_prism_singularity',
]);

function createDefaultSaveData(): SaveData {
  return {
    version: 1,
    brass: 0,
    metaRanks: {
      tempered_alloy: 0,
      keen_striker: 0,
      magnetic_core: 0,
      harmonic_memory: 0,
      overclocked_coil: 0,
    },
    records: {
      bestWave: 0,
      peakFrequencyHz: 0,
      highScore: 0,
      totalKills: 0,
      totalRuns: 0,
      bossesSilenced: 0,
      discoveredEvolutions: [],
    },
    settings: {
      sfx: true,
      music: true,
      haptics: true,
    },
  };
}

function sanitizeNonNeg(value: unknown, integerOnly: boolean): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return integerOnly ? Math.floor(value) : value;
}

function sanitizeSaveData(raw: unknown, metaDefs: readonly MetaUpgradeDef[]): SaveData {
  const defaults = createDefaultSaveData();
  if (typeof raw !== 'object' || raw === null) {
    return defaults;
  }

  const obj = raw as Record<string, unknown>;
  defaults.brass = sanitizeNonNeg(obj.brass, true);

  if (typeof obj.metaRanks === 'object' && obj.metaRanks !== null) {
    const rawRanks = obj.metaRanks as Record<string, unknown>;
    for (let i = 0; i < META_UPGRADE_IDS.length; i++) {
      const id = META_UPGRADE_IDS[i];
      const def = metaDefs.find((d) => d.id === id);
      const rank = sanitizeNonNeg(rawRanks[id], true);
      defaults.metaRanks[id] = def ? Math.min(def.maxRank, rank) : rank;
    }
  }

  if (typeof obj.records === 'object' && obj.records !== null) {
    const rec = obj.records as Record<string, unknown>;
    defaults.records.bestWave = sanitizeNonNeg(rec.bestWave, true);
    defaults.records.peakFrequencyHz = sanitizeNonNeg(rec.peakFrequencyHz, false);
    defaults.records.highScore = sanitizeNonNeg(rec.highScore, true);
    defaults.records.totalKills = sanitizeNonNeg(rec.totalKills, true);
    defaults.records.totalRuns = sanitizeNonNeg(rec.totalRuns, true);
    defaults.records.bossesSilenced = sanitizeNonNeg(rec.bossesSilenced, true);

    if (Array.isArray(rec.discoveredEvolutions)) {
      const seen = new Set<EvolutionId>();
      for (let i = 0; i < rec.discoveredEvolutions.length; i++) {
        const evo = rec.discoveredEvolutions[i];
        if (typeof evo === 'string' && VALID_EVOLUTIONS.has(evo)) {
          seen.add(evo as EvolutionId);
        }
      }
      defaults.records.discoveredEvolutions = Array.from(seen);
    }
  }

  if (typeof obj.settings === 'object' && obj.settings !== null) {
    const settings = obj.settings as Record<string, unknown>;
    if (typeof settings.sfx === 'boolean') defaults.settings.sfx = settings.sfx;
    if (typeof settings.music === 'boolean') defaults.settings.music = settings.music;
    if (typeof settings.haptics === 'boolean') defaults.settings.haptics = settings.haptics;
  }

  return defaults;
}

/**
 * Resilient localStorage persistence manager for meta-progression, records, and settings.
 */
export class StorageManager {
  private readonly metaDefs: readonly MetaUpgradeDef[];
  private data: SaveData;

  constructor(metaDefs: readonly MetaUpgradeDef[]) {
    this.metaDefs = metaDefs;
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createDefaultSaveData();
      }
      const parsed: unknown = JSON.parse(raw);
      return sanitizeSaveData(parsed, this.metaDefs);
    } catch {
      return createDefaultSaveData();
    }
  }

  getData(): SaveData {
    return this.data;
  }

  getUpgradeCost(id: MetaUpgradeId): number {
    const def = this.metaDefs.find((d) => d.id === id);
    if (!def) return Infinity;
    const rank = this.data.metaRanks[id] ?? 0;
    if (rank >= def.maxRank) {
      return Infinity;
    }
    return Math.round(def.baseCost + rank * def.costStep + rank * rank * (def.costStep * 0.35));
  }

  buyMetaUpgrade(id: MetaUpgradeId): boolean {
    const def = this.metaDefs.find((d) => d.id === id);
    if (!def) return false;
    const rank = this.data.metaRanks[id] ?? 0;
    if (rank >= def.maxRank) return false;

    const cost = this.getUpgradeCost(id);
    if (!Number.isFinite(cost) || this.data.brass < cost) {
      return false;
    }

    this.data.brass -= cost;
    this.data.metaRanks[id] = rank + 1;
    this.save();
    return true;
  }

  computeBonuses(): MetaBonuses {
    const ranks = this.data.metaRanks;
    const tempered = ranks.tempered_alloy ?? 0;
    const keen = ranks.keen_striker ?? 0;
    const magnetic = ranks.magnetic_core ?? 0;
    const harmonic = ranks.harmonic_memory ?? 0;
    const overclocked = ranks.overclocked_coil ?? 0;

    return {
      maxHpFlat: tempered * 22,
      damageMult: 1 + keen * 0.10,
      moveSpeedMult: 1 + magnetic * 0.05,
      pickupRadiusMult: 1 + magnetic * 0.16,
      xpMult: 1 + harmonic * 0.10,
      startingRerolls: Math.floor((harmonic + 1) / 2),
      fireRateMult: 1 + overclocked * 0.08,
      critChanceBonus: overclocked * 0.03,
    };
  }

  toggleSetting(key: keyof SaveSettings): SaveSettings {
    this.data.settings[key] = !this.data.settings[key];
    this.save();
    return { ...this.data.settings };
  }

  recordRun(summary: {
    wave: number;
    frequencyHz: number;
    score: number;
    kills: number;
    bossesKilled: number;
    brassEarned: number;
    evolutions: EvolutionId[];
  }): { isNewBestWave: boolean; isNewHighScore: boolean } {
    const wave = sanitizeNonNeg(summary.wave, true);
    const frequencyHz = sanitizeNonNeg(summary.frequencyHz, false);
    const score = sanitizeNonNeg(summary.score, true);
    const kills = sanitizeNonNeg(summary.kills, true);
    const bossesKilled = sanitizeNonNeg(summary.bossesKilled, true);
    const brassEarned = sanitizeNonNeg(summary.brassEarned, true);

    this.data.brass += brassEarned;
    this.data.records.totalRuns += 1;
    this.data.records.totalKills += kills;
    this.data.records.bossesSilenced += bossesKilled;

    const discovered = this.data.records.discoveredEvolutions;
    for (let i = 0; i < summary.evolutions.length; i++) {
      const evo = summary.evolutions[i];
      if (VALID_EVOLUTIONS.has(evo) && !discovered.includes(evo)) {
        discovered.push(evo);
      }
    }

    const isNewBestWave = wave > this.data.records.bestWave;
    if (isNewBestWave) {
      this.data.records.bestWave = wave;
    }

    if (frequencyHz > this.data.records.peakFrequencyHz) {
      this.data.records.peakFrequencyHz = frequencyHz;
    }

    const isNewHighScore = score > this.data.records.highScore;
    if (isNewHighScore) {
      this.data.records.highScore = score;
    }

    this.save();
    return { isNewBestWave, isNewHighScore };
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage failures (Safari Private Mode, QuotaExceeded, etc.)
    }
  }
}
