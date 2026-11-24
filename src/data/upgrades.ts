import {
  MAX_ACTIVE_INSTRUMENTS,
  type EvolutionId,
  type InstrumentId,
  type IRng,
  type MetaUpgradeDef,
  type ModulatorId,
  type RelicId,
  type RunUpgrades,
  type UpgradeDef,
  type UpgradeDraftOption,
  type UpgradeId,
  type UpgradeRarity,
} from '../types';

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  // =========================================================================
  // 5 ACTIVE INSTRUMENTS (maxRank: 4)
  // =========================================================================
  strike_ping: {
    id: 'strike_ping',
    name: 'Strike Ping',
    category: 'instrument',
    rarity: 'common',
    maxRank: 4,
    icon: 'ping',
    tagline: 'Rapid brass tone bolts aimed at the nearest dissonance.',
    descriptions: [
      'Fires crisp 20 dmg brass bolts at 2.4/s (640 px/s).',
      '26 dmg bolts at 2.8/s (700 px/s) with sharper transient punch.',
      '34 dmg bolts at 3.2/s (760 px/s) and +1 natural pierce.',
      '44 dmg bolts at 3.7/s (820 px/s) with +1 extra bolt and +1 pierce.',
    ],
  },
  chladni_orbitals: {
    id: 'chladni_orbitals',
    name: 'Chladni Orbitals',
    category: 'instrument',
    rarity: 'common',
    maxRank: 4,
    icon: 'orbitals',
    tagline: 'Rotating brass saw-nodes carving standing-wave defense.',
    descriptions: [
      'Summons 2 orbiting saw-nodes (18 dmg, 2.2 rad/s) that shred nearby foes.',
      '3 orbiting saw-nodes (24 dmg, 2.6 rad/s) in a wider nodal ring.',
      '4 orbiting saw-nodes (32 dmg, 3.0 rad/s) with stronger knockback.',
      '5 orbiting saw-nodes (42 dmg, 3.5 rad/s) carving a dense brass halo.',
    ],
  },
  arc_tessitura: {
    id: 'arc_tessitura',
    name: 'Arc Tessitura',
    category: 'instrument',
    rarity: 'rare',
    maxRank: 4,
    icon: 'arc',
    tagline: 'Plucks sympathetic lightning across clustered enemies.',
    descriptions: [
      'Zaps nearest enemy for 28 dmg and jumps across 3 total targets.',
      '36 dmg sympathetic arcs jumping across 4 targets with faster cadence.',
      '46 dmg arcs jumping across 5 targets at extended chain range.',
      '58 dmg high-voltage arcs jumping across 6 targets.',
    ],
  },
  sub_bass_mortar: {
    id: 'sub_bass_mortar',
    name: 'Sub-Bass Mortar',
    category: 'instrument',
    rarity: 'rare',
    maxRank: 4,
    icon: 'mortar',
    tagline: 'Heavy acoustic shells erupting in concussive shockwaves.',
    descriptions: [
      'Lobs sub-bass shells every 1.9s dealing 46 AoE dmg (115 px blast, high knockback).',
      '60 AoE dmg every 1.7s (130 px blast) with heavier shockwave push.',
      '78 AoE dmg every 1.5s (145 px blast) that briefly staggers survivors.',
      '100 AoE dmg every 1.3s (165 px blast) with thunderous knockback.',
    ],
  },
  standing_lance: {
    id: 'standing_lance',
    name: 'Standing Lance',
    category: 'instrument',
    rarity: 'epic',
    maxRank: 4,
    icon: 'lance',
    tagline: 'Piercing harmonic beam slicing through the densest enemy line.',
    descriptions: [
      'Fires a narrow harmonic beam every 1.65s dealing 44 dmg along the densest vector.',
      '60 dmg beam every 1.45s with wider resonance corridor.',
      '80 dmg beam every 1.25s with +15% bonus damage to dampened/armored targets.',
      '105 dmg hyper-coherent beam every 1.05s carving cleanly across the plate.',
    ],
  },

  // =========================================================================
  // 9 PASSIVE MODULATORS (maxRank: 4)
  // =========================================================================
  split_octave: {
    id: 'split_octave',
    name: 'Split Octave',
    category: 'modulator',
    rarity: 'rare',
    maxRank: 4,
    icon: 'split',
    tagline: 'Splits harmonic waveforms into parallel octaves.',
    descriptions: [
      '+1 Projectile / Multishot across all projectile & chain instruments.',
      '+2 Projectiles / Multishot across all projectile & chain instruments.',
      '+3 Projectiles / Multishot across all projectile & chain instruments.',
      '+4 Projectiles / Multishot across all projectile & chain instruments.',
    ],
  },
  overdrive_tempo: {
    id: 'overdrive_tempo',
    name: 'Overdrive Tempo',
    category: 'modulator',
    rarity: 'common',
    maxRank: 4,
    icon: 'tempo',
    tagline: 'Accelerates instrument cadence and Overdrive buildup.',
    descriptions: [
      '+16% Fire Rate and +15% faster Overdrive charge.',
      '+32% Fire Rate and +30% faster Overdrive charge.',
      '+48% Fire Rate and +45% faster Overdrive charge.',
      '+64% Fire Rate and +60% faster Overdrive charge.',
    ],
  },
  heavy_brass: {
    id: 'heavy_brass',
    name: 'Heavy Brass',
    category: 'modulator',
    rarity: 'common',
    maxRank: 4,
    icon: 'brass',
    tagline: 'Dense alloy resonators amplify impact and force.',
    descriptions: [
      '+22% All Damage and +20% Knockback.',
      '+44% All Damage and +40% Knockback.',
      '+66% All Damage and +60% Knockback.',
      '+88% All Damage and +80% Knockback.',
    ],
  },
  wide_aperture: {
    id: 'wide_aperture',
    name: 'Wide Aperture',
    category: 'modulator',
    rarity: 'common',
    maxRank: 4,
    icon: 'aperture',
    tagline: 'Expands acoustic blast radius and shard collection field.',
    descriptions: [
      '+20% AoE & Orbital Size and +30% Shard Magnet Radius.',
      '+40% AoE & Orbital Size and +60% Shard Magnet Radius.',
      '+60% AoE & Orbital Size and +90% Shard Magnet Radius.',
      '+80% AoE & Orbital Size and +120% Shard Magnet Radius.',
    ],
  },
  sympathetic_echo: {
    id: 'sympathetic_echo',
    name: 'Sympathetic Echo',
    category: 'modulator',
    rarity: 'rare',
    maxRank: 4,
    icon: 'echo',
    tagline: 'Tones rebound off targets and arena rails.',
    descriptions: [
      '+1 Pierce and +1 Ricochet Bounce.',
      '+2 Pierce and +2 Ricochet Bounces.',
      '+3 Pierce and +3 Ricochet Bounces.',
      '+4 Pierce and +4 Ricochet Bounces.',
    ],
  },
  crit_transients: {
    id: 'crit_transients',
    name: 'Crit Transients',
    category: 'modulator',
    rarity: 'rare',
    maxRank: 4,
    icon: 'crit',
    tagline: 'Sharpens attack peaks into lethal critical spikes.',
    descriptions: [
      '+9% Crit Chance and +25% Crit Multiplier.',
      '+18% Crit Chance and +50% Crit Multiplier.',
      '+27% Crit Chance and +75% Crit Multiplier.',
      '+36% Crit Chance and +100% Crit Multiplier.',
    ],
  },
  shatter_resonance: {
    id: 'shatter_resonance',
    name: 'Shatter Resonance',
    category: 'modulator',
    rarity: 'epic',
    maxRank: 4,
    icon: 'shatter',
    tagline: 'Slain enemies burst into cascading harmonic shrapnel.',
    descriptions: [
      'Killed enemies burst into 3 harmonic shrapnel darts dealing 35% overkill burst.',
      'Killed enemies burst into 4 harmonic shrapnel darts dealing 50% overkill burst.',
      'Killed enemies burst into 5 harmonic shrapnel darts dealing 65% overkill burst.',
      'Killed enemies burst into 6 harmonic shrapnel darts dealing 85% overkill burst.',
    ],
  },
  grounded_focus: {
    id: 'grounded_focus',
    name: 'Grounded Focus',
    category: 'modulator',
    rarity: 'rare',
    maxRank: 4,
    icon: 'anchor',
    tagline: 'Supercharges Anchor Stance and raises a Quartz Barrier.',
    descriptions: [
      '+22% extra anchored Fire Rate and 20 regenerating Quartz Barrier Shield.',
      '+44% extra anchored Fire Rate and 40 regenerating Quartz Barrier Shield.',
      '+66% extra anchored Fire Rate and 65 regenerating Quartz Barrier Shield.',
      '+88% extra anchored Fire Rate and 95 regenerating Quartz Barrier Shield.',
    ],
  },
  harmonic_siphon: {
    id: 'harmonic_siphon',
    name: 'Harmonic Siphon',
    category: 'modulator',
    rarity: 'common',
    maxRank: 4,
    icon: 'siphon',
    tagline: 'Reinforces stylus vitality and draws healing forks from elites.',
    descriptions: [
      '+25 Max HP, heals 20% HP immediately, and raises Elite Tuning Fork drop rate.',
      '+50 Max HP, heals 20% HP immediately, and raises Elite Tuning Fork drop rate.',
      '+75 Max HP, heals 20% HP immediately, and raises Elite Tuning Fork drop rate.',
      '+100 Max HP, heals 20% HP immediately, and maximizes Elite Tuning Fork drops.',
    ],
  },

  // =========================================================================
  // 5 GRAND HARMONIC EVOLUTIONS (maxRank: 1, rarity: 'legendary')
  // =========================================================================
  evo_tesla_philharmonic: {
    id: 'evo_tesla_philharmonic',
    name: 'TESLA PHILHARMONIC',
    category: 'evolution',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'evo_tesla',
    tagline: 'Strike Ping transcends into homing, bouncing golden arpeggios.',
    descriptions: [
      'Transforms Strike Ping into a wide fan of homing, ricocheting golden arpeggio darts that gain +15% damage per bounce.',
    ],
    requiresInstrument: 'strike_ping',
    requiresModulator: 'split_octave',
    evolvesInstrument: 'strike_ping',
  },
  evo_aegis_mandala: {
    id: 'evo_aegis_mandala',
    name: 'AEGIS MANDALA',
    category: 'evolution',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'evo_aegis',
    tagline: 'Dual supersonic saw-rings erase enemy fire and vacuum shards.',
    descriptions: [
      'Evolves Chladni Orbitals into 6 dual-ring supersonic saw-nodes that vaporize enemy projectiles on contact and vacuum nearby shards.',
    ],
    requiresInstrument: 'chladni_orbitals',
    requiresModulator: 'wide_aperture',
    evolvesInstrument: 'chladni_orbitals',
  },
  evo_storm_conductor: {
    id: 'evo_storm_conductor',
    name: 'STORM CONDUCTOR',
    category: 'evolution',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'evo_storm',
    tagline: 'Forking critical arcs punctuated by thunderous Zenith Bolts.',
    descriptions: [
      'Evolves Arc Tessitura into forking chain lightning with guaranteed 2.5x crit transients and screen-shaking Zenith Bolts every 5th strike.',
    ],
    requiresInstrument: 'arc_tessitura',
    requiresModulator: 'crit_transients',
    evolvesInstrument: 'arc_tessitura',
  },
  evo_tectonic_drop: {
    id: 'evo_tectonic_drop',
    name: 'TECTONIC DROP',
    category: 'evolution',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'evo_tectonic',
    tagline: 'Mortar craters pull enemies inward before a secondary mega-quake.',
    descriptions: [
      'Evolves Sub-Bass Mortar shells to leave vacuuming Cymatic Fault Zones that implode in a massive secondary mega-quake.',
    ],
    requiresInstrument: 'sub_bass_mortar',
    requiresModulator: 'heavy_brass',
    evolvesInstrument: 'sub_bass_mortar',
  },
  evo_prism_singularity: {
    id: 'evo_prism_singularity',
    name: 'PRISM SINGULARITY',
    category: 'evolution',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'evo_prism',
    tagline: 'Triple sweeping prism beams refracting off arena rails.',
    descriptions: [
      'Evolves Standing Lance into 3 sweeping prism beams that refract off arena rails for relentless cross-plate devastation.',
    ],
    requiresInstrument: 'standing_lance',
    requiresModulator: 'sympathetic_echo',
    evolvesInstrument: 'standing_lance',
  },

  // =========================================================================
  // 3 WILDCARD RELICS (maxRank: 1, rarity: 'legendary')
  // =========================================================================
  relic_glass_octave: {
    id: 'relic_glass_octave',
    name: 'GLASS OCTAVE',
    category: 'relic',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'glass',
    tagline: 'Razor-thin resonance: double all power at half durability.',
    descriptions: [
      'Deals 2.0x ALL outgoing damage, but caps your Max HP at 50%.',
    ],
  },
  relic_perpetual_feedback: {
    id: 'relic_perpetual_feedback',
    name: 'PERPETUAL FEEDBACK',
    category: 'relic',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'feedback',
    tagline: 'Unbroken momentum snowballs into ultrasonic fire rate.',
    descriptions: [
      'Rapid kills build Feedback stacks (+3% Fire Rate per stack, up to 40 stacks = +120% Fire Rate); resets upon taking HP damage.',
    ],
  },
  relic_anchor_chladni: {
    id: 'relic_anchor_chladni',
    name: 'ANCHOR OF CHLADNI',
    category: 'relic',
    rarity: 'legendary',
    maxRank: 1,
    icon: 'chladni_anchor',
    tagline: 'Locks into the nodal grid with pulsing defensive shockwaves.',
    descriptions: [
      'Anchor Stance activates twice as fast, grants +50% anchored Fire Rate, and pulses a radial shockwave every 1.0s while planted.',
    ],
  },

  // =========================================================================
  // 2 REPEATABLE BONUS UPGRADES (maxRank: 999, rarity: 'common')
  // =========================================================================
  bonus_harmonic_polish: {
    id: 'bonus_harmonic_polish',
    name: 'Harmonic Polish',
    category: 'bonus',
    rarity: 'common',
    maxRank: 999,
    icon: 'polish',
    tagline: 'Fine-tunes stylus brass for permanent run-wide output.',
    descriptions: [
      '+12% All Damage permanently for the rest of this run.',
    ],
  },
  bonus_field_mend: {
    id: 'bonus_field_mend',
    name: 'Field Retune',
    category: 'bonus',
    rarity: 'common',
    maxRank: 999,
    icon: 'mend',
    tagline: 'Emergency quartz restoration and capacitor surge.',
    descriptions: [
      'Restores 45% Max HP and grants +50% Overdrive Charge immediately.',
    ],
  },
};

export const UPGRADE_LIST: readonly UpgradeDef[] = Object.values(UPGRADE_DEFS);

const EVOLUTION_DEFS: readonly UpgradeDef[] = UPGRADE_LIST.filter(
  (def) => def.category === 'evolution'
);

const BONUS_IDS: readonly UpgradeId[] = ['bonus_harmonic_polish', 'bonus_field_mend'];

const RARITY_BASE_WEIGHT: Record<UpgradeRarity, number> = {
  common: 24,
  rare: 16,
  epic: 11,
  legendary: 5,
};

function countPicksMade(runUpgrades: RunUpgrades): number {
  let totalRanks = 0;
  for (let i = 0; i < UPGRADE_LIST.length; i++) {
    const id = UPGRADE_LIST[i].id;
    totalRanks += runUpgrades.ranks[id] ?? 0;
  }
  // Starter instrument begins at Rank 1 before the player's first level-up pick.
  return runUpgrades.activeInstruments.length > 0 ? Math.max(0, totalRanks - 1) : totalRanks;
}

function findEvolutionForInstrument(instrumentId: InstrumentId): UpgradeDef | undefined {
  for (let i = 0; i < EVOLUTION_DEFS.length; i++) {
    if (EVOLUTION_DEFS[i].requiresInstrument === instrumentId) {
      return EVOLUTION_DEFS[i];
    }
  }
  return undefined;
}

function findEvolutionForModulator(modulatorId: ModulatorId): UpgradeDef | undefined {
  for (let i = 0; i < EVOLUTION_DEFS.length; i++) {
    if (EVOLUTION_DEFS[i].requiresModulator === modulatorId) {
      return EVOLUTION_DEFS[i];
    }
  }
  return undefined;
}

function computeSynergyHint(
  def: UpgradeDef,
  currentRank: number,
  nextRank: number,
  runUpgrades: RunUpgrades
): string | undefined {
  if (def.category === 'evolution') {
    const instName = def.requiresInstrument
      ? UPGRADE_DEFS[def.requiresInstrument].name
      : 'Instrument';
    return `EVOLUTION READY! Transforms ${instName}`;
  }

  if (def.category === 'instrument') {
    const evo = findEvolutionForInstrument(def.id as InstrumentId);
    if (!evo || !evo.requiresModulator) return undefined;
    const modDef = UPGRADE_DEFS[evo.requiresModulator];
    if (runUpgrades.evolutions.includes(evo.id as EvolutionId)) {
      return `Empowers ${evo.name}`;
    }
    const modRank = runUpgrades.ranks[evo.requiresModulator] ?? 0;
    if (nextRank >= 3 && modRank >= 1) {
      return `Unlocks ${evo.name} next draft!`;
    }
    if (nextRank === 2 && modRank >= 1) {
      return `1 rank from ${evo.name}!`;
    }
    if (modRank >= 1) {
      return `Synergizes with ${modDef.name} -> ${evo.name}`;
    }
    if (nextRank >= 3) {
      return `Needs ${modDef.name} -> ${evo.name}`;
    }
    return `Pairs with ${modDef.name} -> Evolution`;
  }

  if (def.category === 'modulator') {
    const evo = findEvolutionForModulator(def.id as ModulatorId);
    if (evo && evo.requiresInstrument) {
      const instDef = UPGRADE_DEFS[evo.requiresInstrument];
      const instRank = runUpgrades.ranks[evo.requiresInstrument] ?? 0;
      if (runUpgrades.evolutions.includes(evo.id as EvolutionId)) {
        return `Amplifies ${evo.name}`;
      }
      if (instRank >= 3 && currentRank === 0) {
        return `Unlocks ${evo.name} next draft!`;
      }
      if (instRank > 0) {
        return `Pairs with ${instDef.name} -> ${evo.name}`;
      }
      return `Evolution catalyst for ${instDef.name}`;
    }
    if (def.id === 'shatter_resonance' && runUpgrades.relics.includes('relic_glass_octave')) {
      return 'Deadly chain combo with Glass Octave';
    }
    if (def.id === 'grounded_focus' && runUpgrades.relics.includes('relic_anchor_chladni')) {
      return 'Supercharges Anchor of Chladni';
    }
    if (def.id === 'overdrive_tempo') {
      return 'Accelerates all Instruments & Overdrive';
    }
    if (def.id === 'harmonic_siphon') {
      return 'Sustain + Elite Tuning Fork drops';
    }
    return undefined;
  }

  if (def.category === 'relic') {
    if (def.id === 'relic_glass_octave') {
      return 'High-risk 2.0x damage multiplier';
    }
    if (def.id === 'relic_perpetual_feedback') {
      return 'Rewards unbroken kill streaks';
    }
    if (def.id === 'relic_anchor_chladni') {
      return 'Pulse shockwaves while stationary';
    }
  }

  return undefined;
}

function getUpgradeWeight(
  def: UpgradeDef,
  currentRank: number,
  runUpgrades: RunUpgrades
): number {
  if (def.category === 'evolution') {
    return 150;
  }

  if (def.category === 'relic') {
    return RARITY_BASE_WEIGHT.legendary;
  }

  let weight = RARITY_BASE_WEIGHT[def.rarity];

  if (def.category === 'instrument') {
    if (currentRank > 0) {
      weight += 6;
    }
    const evo = findEvolutionForInstrument(def.id as InstrumentId);
    if (evo?.requiresModulator && (runUpgrades.ranks[evo.requiresModulator] ?? 0) > 0) {
      weight += 5;
    }
  } else if (def.category === 'modulator') {
    if (currentRank > 0) {
      weight += 3;
    }
    const evo = findEvolutionForModulator(def.id as ModulatorId);
    if (evo?.requiresInstrument && (runUpgrades.ranks[evo.requiresInstrument] ?? 0) > 0) {
      weight += 6;
    }
  }

  return weight;
}

export function rollUpgradeChoices(
  rng: IRng,
  runUpgrades: RunUpgrades
): UpgradeDraftOption[] {
  const picksMade = countPicksMade(runUpgrades);
  const candidates: { def: UpgradeDef; currentRank: number; weight: number }[] = [];

  for (let i = 0; i < UPGRADE_LIST.length; i++) {
    const def = UPGRADE_LIST[i];
    if (def.category === 'bonus') continue;

    const currentRank = runUpgrades.ranks[def.id] ?? 0;

    if (def.category === 'evolution') {
      if (currentRank > 0) continue;
      if (!def.requiresInstrument || !def.requiresModulator) continue;
      const instRank = runUpgrades.ranks[def.requiresInstrument] ?? 0;
      const modRank = runUpgrades.ranks[def.requiresModulator] ?? 0;
      if (instRank < 3 || modRank < 1) continue;
      candidates.push({
        def,
        currentRank,
        weight: getUpgradeWeight(def, currentRank, runUpgrades),
      });
      continue;
    }

    if (def.category === 'instrument') {
      if (currentRank >= def.maxRank) continue;
      if (
        currentRank === 0 &&
        runUpgrades.activeInstruments.length >= MAX_ACTIVE_INSTRUMENTS
      ) {
        continue;
      }
      candidates.push({
        def,
        currentRank,
        weight: getUpgradeWeight(def, currentRank, runUpgrades),
      });
      continue;
    }

    if (def.category === 'relic') {
      if (currentRank >= def.maxRank || picksMade < 2) continue;
      candidates.push({
        def,
        currentRank,
        weight: getUpgradeWeight(def, currentRank, runUpgrades),
      });
      continue;
    }

    // Modulator
    if (currentRank < def.maxRank) {
      candidates.push({
        def,
        currentRank,
        weight: getUpgradeWeight(def, currentRank, runUpgrades),
      });
    }
  }

  const chosen: UpgradeDraftOption[] = [];
  let totalWeight = 0;
  for (let i = 0; i < candidates.length; i++) {
    totalWeight += candidates[i].weight;
  }

  while (chosen.length < 3 && candidates.length > 0 && totalWeight > 0) {
    let roll = rng.next() * totalWeight;
    let pickedIndex = candidates.length - 1;

    for (let i = 0; i < candidates.length; i++) {
      roll -= candidates[i].weight;
      if (roll <= 0) {
        pickedIndex = i;
        break;
      }
    }

    const picked = candidates[pickedIndex];
    totalWeight -= picked.weight;
    candidates.splice(pickedIndex, 1);

    const nextRank = picked.currentRank + 1;
    chosen.push({
      def: picked.def,
      currentRank: picked.currentRank,
      nextRank,
      synergyHint: computeSynergyHint(picked.def, picked.currentRank, nextRank, runUpgrades),
    });
  }

  // Pad with repeatable bonus upgrades if fewer than 3 standard upgrades remain
  for (let i = 0; i < BONUS_IDS.length && chosen.length < 3; i++) {
    const bonusDef = UPGRADE_DEFS[BONUS_IDS[i]];
    const currentRank = runUpgrades.ranks[bonusDef.id] ?? 0;
    chosen.push({
      def: bonusDef,
      currentRank,
      nextRank: currentRank + 1,
      synergyHint:
        bonusDef.id === 'bonus_harmonic_polish'
          ? 'Repeatable run power scaling'
          : 'Instant survivability & burst charge',
    });
  }

  return chosen;
}

export function applyUpgradePick(
  runUpgrades: RunUpgrades,
  id: UpgradeId
): { isEvolution: boolean; evolvedId?: EvolutionId; healFraction: number } {
  const def = UPGRADE_DEFS[id];
  const prevRank = runUpgrades.ranks[id] ?? 0;

  if (def.category === 'bonus') {
    runUpgrades.ranks[id] = prevRank + 1;
    if (id === 'bonus_harmonic_polish') {
      runUpgrades.bonusDamageStacks += 1;
      return { isEvolution: false, healFraction: 0 };
    }
    return {
      isEvolution: false,
      healFraction: id === 'bonus_field_mend' ? 0.45 : 0,
    };
  }

  const nextRank = Math.min(def.maxRank, prevRank + 1);
  runUpgrades.ranks[id] = nextRank;

  if (def.category === 'instrument') {
    const instId = id as InstrumentId;
    if (!runUpgrades.activeInstruments.includes(instId)) {
      runUpgrades.activeInstruments.push(instId);
    }
    return { isEvolution: false, healFraction: 0 };
  }

  if (def.category === 'evolution') {
    const evoId = id as EvolutionId;
    if (!runUpgrades.evolutions.includes(evoId)) {
      runUpgrades.evolutions.push(evoId);
    }
    return { isEvolution: true, evolvedId: evoId, healFraction: 0.25 };
  }

  if (def.category === 'relic') {
    const relicId = id as RelicId;
    if (!runUpgrades.relics.includes(relicId)) {
      runUpgrades.relics.push(relicId);
    }
    return { isEvolution: false, healFraction: 0 };
  }

  return {
    isEvolution: false,
    healFraction: id === 'harmonic_siphon' ? 0.2 : 0,
  };
}

// ===========================================================================
// 5 META-UPGRADES (Tuning Bench)
// ===========================================================================
export const META_UPGRADE_DEFS: readonly MetaUpgradeDef[] = [
  {
    id: 'tempered_alloy',
    name: 'Tempered Alloy',
    icon: 'alloy',
    maxRank: 5,
    baseCost: 25,
    costStep: 25,
    effectPerRank: '+18 Max HP',
    description: 'Reinforces the Cantor stylus chassis with annealed quartz-brass plating.',
  },
  {
    id: 'keen_striker',
    name: 'Keen Striker',
    icon: 'striker',
    maxRank: 5,
    baseCost: 30,
    costStep: 30,
    effectPerRank: '+8% Base Damage',
    description: 'Sharpens primary harmonic transducers for higher output on every instrument.',
  },
  {
    id: 'magnetic_core',
    name: 'Magnetic Core',
    icon: 'magnet',
    maxRank: 5,
    baseCost: 25,
    costStep: 25,
    effectPerRank: '+5% Move Speed & +15% Magnet',
    description: 'Boosts magnetic levitation glide speed and Amber Shard attraction radius.',
  },
  {
    id: 'harmonic_memory',
    name: 'Harmonic Memory',
    icon: 'memory',
    maxRank: 5,
    baseCost: 35,
    costStep: 30,
    effectPerRank: '+10% XP Gain & +1 Reroll (R1/R3/R5)',
    description: 'Extracts richer resonance from shards and stores extra draft reroll charges.',
  },
  {
    id: 'overclocked_coil',
    name: 'Overclocked Coil',
    icon: 'coil',
    maxRank: 5,
    baseCost: 40,
    costStep: 35,
    effectPerRank: '+6% Fire Rate & +2% Crit Chance',
    description: 'Overwinds the induction coil for faster cadence and sharper critical transients.',
  },
];
