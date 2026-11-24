/// <reference types="vite/client" />
import './styles.css';
import type {
  EvolutionId,
  GamePhase,
  HUDState,
  MetaUpgradeDef,
  MetaUpgradeId,
  RunSummary,
  RunUpgrades,
  SaveData,
  SaveSettings,
  UICallbacks,
  UpgradeCategory,
  UpgradeDef,
  UpgradeDraftOption,
  UpgradeId,
  WaveConfig,
} from '../types';

const OVERDRIVE_RADIUS = 35;
const OVERDRIVE_CIRCUMFERENCE = 2 * Math.PI * OVERDRIVE_RADIUS;
const DRAFT_INPUT_GUARD_MS = 220;

const CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  instrument: 'Instrument',
  modulator: 'Modulator',
  evolution: 'Grand Evolution',
  relic: 'Wildcard Relic',
  bonus: 'Resonance Bonus',
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimeMMSS(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function resolveIconBody(icon: string, id?: string): string {
  const trimmed = icon.trim();
  // Support raw SVG path strings directly per UpgradeDef.icon contract
  if (/^[Mm]\s*-?\d/.test(trimmed)) {
    return `<path d="${escapeHtml(trimmed)}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const key = `${trimmed.toLowerCase()} ${id ? id.toLowerCase() : ''}`;

  if (key.includes('tesla') || key.includes('philharmonic')) {
    return `<path d="M12 2l3 6 6 2-5 4 2 7-6-4-6 4 2-7-5-4 6-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.3" fill="currentColor"/>`;
  }
  if (key.includes('mandala') || key.includes('aegis')) {
    return `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/>`;
  }
  if (key.includes('storm') || key.includes('conductor')) {
    return `<path d="M13 2L5.5 12.5H11L9.5 22L18.5 10.5H13L15.5 2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  if (key.includes('tectonic') || key.includes('drop')) {
    return `<path d="M3 16l4-5 4 3 4-7 6 9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 20h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (key.includes('prism') || key.includes('singularity')) {
    return `<polygon points="12,2 21,12 12,22 3,12" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>`;
  }
  if (key.includes('ping') || key.includes('strike') || key.includes('bolt')) {
    return `<path d="M4 19L19 5M19 5h-6M19 5v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="16.5" r="2.2" fill="currentColor"/>`;
  }
  if (key.includes('orbital') || key.includes('orbit') || key.includes('saw')) {
    return `<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="4 3"/><circle cx="19" cy="7.5" r="2" fill="currentColor"/><circle cx="5" cy="16.5" r="2" fill="currentColor"/>`;
  }
  if (key.includes('arc') || key.includes('tessitura') || key.includes('lightning')) {
    return `<path d="M13.5 2.5L6.5 12h5l-1 9.5L17.5 11h-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  if (key.includes('mortar') || key.includes('sub_bass') || key.includes('bass')) {
    return `<circle cx="12" cy="13" r="4" fill="currentColor"/><path d="M5 17a8.5 8.5 0 0 1 14 0M2.5 14a11 11 0 0 1 19 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (key.includes('lance') || key.includes('standing') || key.includes('laser') || key.includes('beam')) {
    return `<path d="M3 21L21 3M14 3h7v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10l6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`;
  }
  if (key.includes('split') || key.includes('octave')) {
    return `<path d="M4 12h7m0 0l7-6m-7 6l7 6m-7-6h9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (key.includes('tempo') || key.includes('overdrive') || key.includes('coil')) {
    return `<path d="M6 19l6-14 6 14H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 15l5-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (key.includes('heavy') || key.includes('brass') || key.includes('striker')) {
    return `<path d="M5 9h14l-2 10H7L5 9zM9 9V5h6v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  if (key.includes('aperture') || key.includes('wide') || key.includes('magnetic') || key.includes('core')) {
    return `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (key.includes('echo') || key.includes('sympathetic')) {
    return `<path d="M4 17L10 7l5 10 5-8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="9" r="2" fill="currentColor"/>`;
  }
  if (key.includes('crit') || key.includes('transient')) {
    return `<path d="M12 2l2.2 6.8L21 9l-5.3 4.2L17.8 20 12 16l-5.8 4 2.1-6.8L3 9l6.8-.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`;
  }
  if (key.includes('shatter')) {
    return `<polygon points="12,3 17,9 14,20 7,15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9l4-2M7 15l-4 3M14 20l4 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`;
  }
  if (key.includes('grounded') || key.includes('anchor') || key.includes('focus')) {
    return `<circle cx="12" cy="6" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5V20M5 14a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (key.includes('siphon') || key.includes('mend') || key.includes('heal')) {
    return `<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.65"/>`;
  }
  if (key.includes('glass')) {
    return `<path d="M7 3h10l-4 9 4 9H7l4-9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  if (key.includes('feedback') || key.includes('memory')) {
    return `<path d="M8 8a4 4 0 1 0 0 8c2.5 0 4-4 8-4a4 4 0 1 1 0 8c-2.5 0-4-4-8-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (key.includes('chladni')) {
    return `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 12c4-5 12 5 16 0M12 4c-5 4 5 12 0 16" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
  }
  if (key.includes('alloy') || key.includes('tempered') || key.includes('shield')) {
    return `<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  if (key.includes('polish')) {
    return `<polygon points="12,3 20,9 12,21 4,9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 9h16" stroke="currentColor" stroke-width="1.4"/>`;
  }

  // Default tuning fork emblem
  return `<path d="M9 3v7a3 3 0 0 0 6 0V3M12 13v8M9.5 21h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`;
}

function renderIconSvg(
  icon: string,
  size: number,
  colorClass: string,
  id?: string
): string {
  const body = resolveIconBody(icon, id);
  return `<span class="ov-icon ${colorClass}" style="width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24">${body}</svg></span>`;
}

function categoryIconClass(category: UpgradeCategory | 'meta'): string {
  switch (category) {
    case 'instrument':
      return 'ov-icon--instrument';
    case 'modulator':
      return 'ov-icon--modulator';
    case 'evolution':
      return 'ov-icon--evolution';
    case 'relic':
      return 'ov-icon--relic';
    case 'bonus':
      return 'ov-icon--bonus';
    case 'meta':
      return 'ov-icon--meta';
  }
}

const BRASS_GLYPH = '⏚';

export class GameUI {
  private readonly root: HTMLElement;
  private readonly callbacks: UICallbacks;
  private readonly metaDefs: readonly MetaUpgradeDef[];
  private readonly upgradeDefs: Record<UpgradeId, UpgradeDef>;
  private readonly getUpgradeCost: (id: MetaUpgradeId) => number;

  private currentPhase: GamePhase = 'title';
  private latestSaveData: SaveData | null = null;
  private latestRunUpgrades: RunUpgrades | undefined = undefined;
  private localSettings: SaveSettings = { sfx: true, music: true, haptics: true };
  private offlineReady = false;
  private bannerTimerId: number | null = null;
  private draftUnlockTime = 0;

  // Top-level layers
  private readonly hudLayer: HTMLElement;
  private readonly bannerLayer: HTMLElement;
  private readonly bannerTitleEl: HTMLElement;
  private readonly bannerSubEl: HTMLElement;
  private readonly titleLayer: HTMLElement;
  private readonly levelupLayer: HTMLElement;
  private readonly pauseLayer: HTMLElement;
  private readonly gameoverLayer: HTMLElement;
  private readonly shopDrawer: HTMLElement;
  private readonly codexDrawer: HTMLElement;

  // Cached HUD DOM elements (Zero DOM thrashing!)
  private readonly xpFillEl: HTMLElement;
  private readonly levelTextEl: HTMLElement;
  private readonly hpFillEl: HTMLElement;
  private readonly shieldFillEl: HTMLElement;
  private readonly hpTextEl: HTMLElement;
  private readonly brassRunEl: HTMLElement;
  private readonly killsRunEl: HTMLElement;
  private readonly scoreRunEl: HTMLElement;
  private readonly waveFreqEl: HTMLElement;
  private readonly waveTimerEl: HTMLElement;
  private readonly waveModEl: HTMLElement;
  private readonly bossBarEl: HTMLElement;
  private readonly bossNameEl: HTMLElement;
  private readonly bossFillEl: HTMLElement;
  private readonly bossHpTextEl: HTMLElement;
  private readonly anchorBadgeEl: HTMLElement;
  private readonly feedbackBadgeEl: HTMLElement;
  private readonly overdriveBtnEl: HTMLButtonElement;
  private readonly overdriveRingEl: SVGCircleElement;
  private readonly overdrivePctEl: HTMLElement;

  // Cached primitive HUD values
  private lastXpPct = -1;
  private lastLevel = -1;
  private lastHpPct = -1;
  private lastShieldPct = -1;
  private lastHpInt = -1;
  private lastMaxHpInt = -1;
  private lastShieldInt = -1;
  private lastBrass = -1;
  private lastKills = -1;
  private lastScore = -1;
  private lastFps = -1;
  private lastWaveNum = -1;
  private lastFreqTenths = -1;
  private lastN = -1;
  private lastM = -1;
  private lastTimerSec = -1;
  private lastIsBossWave = false;
  private lastModifier = '';
  private lastBossName: string | null = null;
  private lastBossPct = -1;
  private lastBossHpInt = -1;
  private lastAnchored = false;
  private lastFeedback = -1;
  private lastOverdrivePct = -1;
  private lastOverdriveReady = false;

  // Cached Title refs for quick refresh
  private offlinePillEl: HTMLElement | null = null;
  private offlinePillTextEl: HTMLElement | null = null;

  constructor(
    root: HTMLElement,
    callbacks: UICallbacks,
    metaDefs: readonly MetaUpgradeDef[],
    upgradeDefs: Record<UpgradeId, UpgradeDef>,
    getUpgradeCost: (id: MetaUpgradeId) => number
  ) {
    this.root = root;
    this.callbacks = callbacks;
    this.metaDefs = metaDefs;
    this.upgradeDefs = upgradeDefs;
    this.getUpgradeCost = getUpgradeCost;

    this.root.classList.add('ov-ui-root');
    this.root.innerHTML = '';

    // 1. Build In-Run HUD DOM once
    this.hudLayer = document.createElement('div');
    this.hudLayer.className = 'ov-hud is-hidden';
    this.hudLayer.innerHTML = `
      <div class="ov-hud-top">
        <div class="ov-xp-row">
          <div class="ov-xp-track"><div class="ov-xp-fill"></div></div>
          <div class="ov-level-pill">LV 1</div>
        </div>
        <div class="ov-hud-bar">
          <div class="ov-vitals-col">
            <div class="ov-hp-wrap">
              <div class="ov-hp-fill"></div>
              <div class="ov-shield-fill"></div>
              <span class="ov-hp-text">100 / 100</span>
            </div>
            <div class="ov-mini-stats">
              <span class="ov-stat-brass">${BRASS_GLYPH} 0</span>
              <span class="ov-stat-kills">◈ 0</span>
            </div>
          </div>
          <div class="ov-wave-col">
            <div class="ov-wave-freq">W1 • 110.0 Hz [2:1]</div>
            <div class="ov-wave-timer">0:25</div>
            <div class="ov-wave-modifier is-hidden"></div>
          </div>
          <div class="ov-right-col">
            <button type="button" class="ov-btn ov-pause-btn" aria-label="Pause Game">❚❚</button>
            <div class="ov-score-tag">0 PTS</div>
          </div>
        </div>
        <div class="ov-boss-bar is-hidden">
          <div class="ov-boss-head">
            <span class="ov-boss-name">BOSS</span>
            <span class="ov-boss-hp-text"></span>
          </div>
          <div class="ov-boss-track"><div class="ov-boss-fill"></div></div>
        </div>
      </div>
      <div class="ov-hud-bottom">
        <div class="ov-status-stack">
          <div class="ov-status-badge ov-badge-anchor">⚓ ANCHOR LOCKED</div>
          <div class="ov-status-badge ov-badge-feedback">⚡ FEEDBACK ×0</div>
        </div>
        <button type="button" class="ov-overdrive-btn" aria-label="Trigger Overdrive Burst">
          <svg class="ov-overdrive-ring" viewBox="0 0 80 80" aria-hidden="true">
            <circle class="ov-overdrive-ring-bg" cx="40" cy="40" r="${OVERDRIVE_RADIUS}"></circle>
            <circle class="ov-overdrive-ring-fg" cx="40" cy="40" r="${OVERDRIVE_RADIUS}"></circle>
          </svg>
          <span class="ov-overdrive-label">OVERDRIVE</span>
          <span class="ov-overdrive-pct">0%</span>
        </button>
      </div>
    `;

    this.xpFillEl = this.hudLayer.querySelector('.ov-xp-fill') as HTMLElement;
    this.levelTextEl = this.hudLayer.querySelector('.ov-level-pill') as HTMLElement;
    this.hpFillEl = this.hudLayer.querySelector('.ov-hp-fill') as HTMLElement;
    this.shieldFillEl = this.hudLayer.querySelector('.ov-shield-fill') as HTMLElement;
    this.hpTextEl = this.hudLayer.querySelector('.ov-hp-text') as HTMLElement;
    this.brassRunEl = this.hudLayer.querySelector('.ov-stat-brass') as HTMLElement;
    this.killsRunEl = this.hudLayer.querySelector('.ov-stat-kills') as HTMLElement;
    this.scoreRunEl = this.hudLayer.querySelector('.ov-score-tag') as HTMLElement;
    this.waveFreqEl = this.hudLayer.querySelector('.ov-wave-freq') as HTMLElement;
    this.waveTimerEl = this.hudLayer.querySelector('.ov-wave-timer') as HTMLElement;
    this.waveModEl = this.hudLayer.querySelector('.ov-wave-modifier') as HTMLElement;
    this.bossBarEl = this.hudLayer.querySelector('.ov-boss-bar') as HTMLElement;
    this.bossNameEl = this.hudLayer.querySelector('.ov-boss-name') as HTMLElement;
    this.bossFillEl = this.hudLayer.querySelector('.ov-boss-fill') as HTMLElement;
    this.bossHpTextEl = this.hudLayer.querySelector('.ov-boss-hp-text') as HTMLElement;
    this.anchorBadgeEl = this.hudLayer.querySelector('.ov-badge-anchor') as HTMLElement;
    this.feedbackBadgeEl = this.hudLayer.querySelector('.ov-badge-feedback') as HTMLElement;
    this.overdriveBtnEl = this.hudLayer.querySelector('.ov-overdrive-btn') as HTMLButtonElement;
    this.overdriveRingEl = this.hudLayer.querySelector('.ov-overdrive-ring-fg') as SVGCircleElement;
    this.overdrivePctEl = this.hudLayer.querySelector('.ov-overdrive-pct') as HTMLElement;

    this.overdriveRingEl.style.strokeDasharray = `${OVERDRIVE_CIRCUMFERENCE.toFixed(2)}`;
    this.overdriveRingEl.style.strokeDashoffset = `${OVERDRIVE_CIRCUMFERENCE.toFixed(2)}`;

    const pauseBtn = this.hudLayer.querySelector('.ov-pause-btn') as HTMLButtonElement;
    pauseBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onPauseToggle();
    });

    this.overdriveBtnEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.callbacks.onTriggerOverdrive();
    });

    // 2. Transient Wave Banner
    this.bannerLayer = document.createElement('div');
    this.bannerLayer.className = 'ov-wave-banner';
    this.bannerLayer.innerHTML = `
      <div class="ov-wave-banner-title"></div>
      <div class="ov-wave-banner-sub"></div>
    `;
    this.bannerTitleEl = this.bannerLayer.querySelector('.ov-wave-banner-title') as HTMLElement;
    this.bannerSubEl = this.bannerLayer.querySelector('.ov-wave-banner-sub') as HTMLElement;

    // 3. Modal & Screen Containers
    this.titleLayer = document.createElement('section');
    this.titleLayer.className = 'ov-overlay ov-title-screen is-hidden';

    this.levelupLayer = document.createElement('section');
    this.levelupLayer.className = 'ov-overlay ov-levelup-modal is-hidden';

    this.pauseLayer = document.createElement('section');
    this.pauseLayer.className = 'ov-overlay ov-pause-modal is-hidden';

    this.gameoverLayer = document.createElement('section');
    this.gameoverLayer.className = 'ov-overlay ov-gameover-modal is-hidden';

    this.shopDrawer = document.createElement('section');
    this.shopDrawer.className = 'ov-drawer ov-shop-drawer is-hidden';

    this.codexDrawer = document.createElement('section');
    this.codexDrawer.className = 'ov-drawer ov-codex-drawer is-hidden';

    this.root.append(
      this.hudLayer,
      this.bannerLayer,
      this.titleLayer,
      this.levelupLayer,
      this.pauseLayer,
      this.gameoverLayer,
      this.shopDrawer,
      this.codexDrawer
    );
  }

  public setPhase(phase: GamePhase, saveData: SaveData, runUpgrades?: RunUpgrades): void {
    this.currentPhase = phase;
    this.syncSaveData(saveData);
    if (runUpgrades !== undefined) {
      this.latestRunUpgrades = runUpgrades;
    }

    if (phase !== 'title' && phase !== 'gameover') {
      this.shopDrawer.classList.add('is-hidden');
      this.codexDrawer.classList.add('is-hidden');
    }

    const showHud = phase === 'playing' || phase === 'levelup' || phase === 'paused';
    this.hudLayer.classList.toggle('is-hidden', !showHud);
    this.titleLayer.classList.toggle('is-hidden', phase !== 'title');
    this.levelupLayer.classList.toggle('is-hidden', phase !== 'levelup');
    this.pauseLayer.classList.toggle('is-hidden', phase !== 'paused');
    this.gameoverLayer.classList.toggle('is-hidden', phase !== 'gameover');

    if (phase === 'title') {
      this.renderTitle(saveData);
    } else if (phase === 'paused') {
      this.renderPause(saveData, this.latestRunUpgrades);
    }
  }

  public showTitle(saveData: SaveData): void {
    this.shopDrawer.classList.add('is-hidden');
    this.codexDrawer.classList.add('is-hidden');
    this.setPhase('title', saveData);
  }

  public refreshShop(saveData: SaveData): void {
    this.syncSaveData(saveData);
    if (!this.shopDrawer.classList.contains('is-hidden')) {
      this.renderShop(saveData);
    }
    if (!this.titleLayer.classList.contains('is-hidden')) {
      this.renderTitle(saveData);
    }
    if (!this.pauseLayer.classList.contains('is-hidden')) {
      this.renderPause(saveData, this.latestRunUpgrades);
    }
  }

  public updateHUD(hud: HUDState): void {
    // 1. XP Resonance Bar + Level
    const xpPct = hud.xpToNext > 0 ? Math.min(100, Math.max(0, (hud.xp / hud.xpToNext) * 100)) : 0;
    const xpPctRounded = Math.round(xpPct * 10) / 10;
    if (xpPctRounded !== this.lastXpPct) {
      this.lastXpPct = xpPctRounded;
      this.xpFillEl.style.width = `${xpPctRounded}%`;
    }
    if (hud.level !== this.lastLevel) {
      this.lastLevel = hud.level;
      this.levelTextEl.textContent = `LV ${hud.level}`;
    }

    // 2. HP + Shield Bar
    const maxHpSafe = Math.max(1, hud.maxHp);
    const hpPct = Math.round(Math.min(100, Math.max(0, (hud.hp / maxHpSafe) * 100)) * 10) / 10;
    if (hpPct !== this.lastHpPct) {
      this.lastHpPct = hpPct;
      this.hpFillEl.style.width = `${hpPct}%`;
    }

    const shieldPct =
      hud.maxShield > 0
        ? Math.round(Math.min(100, Math.max(0, (hud.shield / hud.maxShield) * 100)) * 10) / 10
        : 0;
    if (shieldPct !== this.lastShieldPct) {
      this.lastShieldPct = shieldPct;
      this.shieldFillEl.style.width = `${shieldPct}%`;
    }

    const hpInt = Math.max(0, Math.ceil(hud.hp));
    const maxHpInt = Math.max(1, Math.ceil(hud.maxHp));
    const shieldInt = Math.max(0, Math.ceil(hud.shield));
    if (hpInt !== this.lastHpInt || maxHpInt !== this.lastMaxHpInt || shieldInt !== this.lastShieldInt) {
      this.lastHpInt = hpInt;
      this.lastMaxHpInt = maxHpInt;
      this.lastShieldInt = shieldInt;
      this.hpTextEl.textContent =
        shieldInt > 0 ? `${hpInt}/${maxHpInt} +${shieldInt}` : `${hpInt} / ${maxHpInt}`;
    }

    // 3. Brass, Kills, Score
    const brassInt = Math.floor(hud.brassThisRun);
    if (brassInt !== this.lastBrass) {
      this.lastBrass = brassInt;
      this.brassRunEl.textContent = `${BRASS_GLYPH} ${brassInt}`;
    }
    if (hud.kills !== this.lastKills) {
      this.lastKills = hud.kills;
      this.killsRunEl.textContent = `◈ ${hud.kills}`;
    }
    const scoreInt = Math.floor(hud.score);
    const fpsInt = Math.max(1, Math.round(hud.fps || 60));
    if (scoreInt !== this.lastScore || fpsInt !== this.lastFps) {
      this.lastScore = scoreInt;
      this.lastFps = fpsInt;
      this.scoreRunEl.textContent = `${scoreInt.toLocaleString()} PTS • ${fpsInt} FPS`;
    }

    // 4. Wave & Frequency + Timer + Endless Modifier
    const freqTenths = Math.round(hud.frequencyHz * 10);
    if (
      hud.wave !== this.lastWaveNum ||
      freqTenths !== this.lastFreqTenths ||
      hud.chladniN !== this.lastN ||
      hud.chladniM !== this.lastM
    ) {
      this.lastWaveNum = hud.wave;
      this.lastFreqTenths = freqTenths;
      this.lastN = hud.chladniN;
      this.lastM = hud.chladniM;
      this.waveFreqEl.textContent = `W${hud.wave} • ${(freqTenths / 10).toFixed(1)} Hz [${hud.chladniN}:${hud.chladniM}]`;
    }

    const timerSec = Math.max(0, Math.ceil(hud.waveTimeRemaining));
    if (hud.isBossWave !== this.lastIsBossWave || (!hud.isBossWave && timerSec !== this.lastTimerSec)) {
      this.lastIsBossWave = hud.isBossWave;
      this.lastTimerSec = timerSec;
      this.waveTimerEl.classList.toggle('is-boss', hud.isBossWave);
      this.waveTimerEl.textContent = hud.isBossWave ? 'BOSS' : formatTimeMMSS(timerSec);
    }

    if (hud.modifierLabel !== this.lastModifier) {
      this.lastModifier = hud.modifierLabel;
      const showMod = hud.modifierLabel.length > 0 && hud.modifierLabel.toLowerCase() !== 'none';
      this.waveModEl.classList.toggle('is-hidden', !showMod);
      if (showMod) {
        this.waveModEl.textContent = hud.modifierLabel;
      }
    }

    // 5. Boss Health Bar
    if (hud.activeBossName !== this.lastBossName) {
      this.lastBossName = hud.activeBossName;
      const hasBoss = hud.activeBossName !== null && hud.activeBossName.length > 0;
      this.bossBarEl.classList.toggle('is-hidden', !hasBoss);
      if (hasBoss) {
        this.bossNameEl.textContent = hud.activeBossName;
      }
    }
    if (hud.activeBossName !== null) {
      const bossMax = Math.max(1, hud.activeBossMaxHp);
      const bossPct = Math.round(Math.min(100, Math.max(0, (hud.activeBossHp / bossMax) * 100)) * 10) / 10;
      if (bossPct !== this.lastBossPct) {
        this.lastBossPct = bossPct;
        this.bossFillEl.style.width = `${bossPct}%`;
      }
      const bossHpInt = Math.max(0, Math.ceil(hud.activeBossHp));
      if (bossHpInt !== this.lastBossHpInt) {
        this.lastBossHpInt = bossHpInt;
        this.bossHpTextEl.textContent = `${bossHpInt.toLocaleString()}`;
      }
    }

    // 6. Anchor & Feedback Status Badges
    if (hud.isAnchored !== this.lastAnchored) {
      this.lastAnchored = hud.isAnchored;
      this.anchorBadgeEl.classList.toggle('is-visible', hud.isAnchored);
    }
    if (hud.feedbackStacks !== this.lastFeedback) {
      this.lastFeedback = hud.feedbackStacks;
      this.feedbackBadgeEl.classList.toggle('is-visible', hud.feedbackStacks > 0);
      if (hud.feedbackStacks > 0) {
        this.feedbackBadgeEl.textContent = `⚡ FEEDBACK ×${hud.feedbackStacks}`;
      }
    }

    // 7. Overdrive Circular Progress
    const odPct = Math.min(100, Math.max(0, Math.floor(hud.overdriveCharge)));
    const odReady = hud.overdriveCharge >= 100;
    if (odPct !== this.lastOverdrivePct || odReady !== this.lastOverdriveReady) {
      this.lastOverdrivePct = odPct;
      this.lastOverdriveReady = odReady;
      const offset = OVERDRIVE_CIRCUMFERENCE * (1 - odPct / 100);
      this.overdriveRingEl.style.strokeDashoffset = `${offset.toFixed(1)}`;
      this.overdriveBtnEl.classList.toggle('is-ready', odReady);
      this.overdrivePctEl.textContent = odReady ? 'BURST!' : `${odPct}%`;
    }
  }

  public showWaveBanner(wave: WaveConfig): void {
    if (this.bannerTimerId !== null) {
      window.clearTimeout(this.bannerTimerId);
      this.bannerTimerId = null;
    }

    this.bannerLayer.style.setProperty('--banner-accent', wave.accentColor || '#f5c451');
    this.bannerTitleEl.textContent = `WAVE ${wave.wave} • ${wave.frequencyHz.toFixed(1)} HZ`;

    if (wave.isBossWave) {
      const bossTitle =
        wave.bossId === 'boss_anechoic_monolith' ? 'ANECHOIC MONOLITH' : 'THE WOLF TONE';
      this.bannerSubEl.textContent = `⚠ ${bossTitle} ⚠`;
    } else if (wave.modifier !== 'none' && wave.modifierLabel) {
      this.bannerSubEl.textContent = `${wave.modifierLabel} • MODE [${wave.chladniN}:${wave.chladniM}]`;
    } else {
      this.bannerSubEl.textContent = `CHLADNI MODE [${wave.chladniN}:${wave.chladniM}]`;
    }

    this.bannerLayer.classList.remove('is-visible');
    void this.bannerLayer.offsetWidth;
    this.bannerLayer.classList.add('is-visible');

    this.bannerTimerId = window.setTimeout(() => {
      this.bannerLayer.classList.remove('is-visible');
      this.bannerTimerId = null;
    }, 2200);
  }

  public showLevelUpDraft(options: UpgradeDraftOption[], rerollsLeft: number, level: number): void {
    this.currentPhase = 'levelup';
    this.draftUnlockTime = performance.now() + DRAFT_INPUT_GUARD_MS;

    this.hudLayer.classList.remove('is-hidden');
    this.titleLayer.classList.add('is-hidden');
    this.pauseLayer.classList.add('is-hidden');
    this.gameoverLayer.classList.add('is-hidden');
    this.levelupLayer.classList.remove('is-hidden');

    const cardsHtml = options
      .map((opt, idx) => {
        const def = opt.def;
        const catClass = `ov-draft-card--${def.category}`;
        const iconSvg = renderIconSvg(def.icon, 30, categoryIconClass(def.category), def.id);
        const rankLabel = this.formatRankTransition(opt);
        const desc = def.descriptions[opt.nextRank - 1] || def.descriptions[0] || def.tagline;
        const ribbon =
          def.category === 'evolution'
            ? `<div class="ov-evo-ribbon">★ GRAND EVOLUTION ★</div>`
            : '';
        const synergy = opt.synergyHint
          ? `<div class="ov-synergy-pill">✦ ${escapeHtml(opt.synergyHint)}</div>`
          : '';

        return `
          <button type="button" class="ov-draft-card ${catClass}" data-upgrade-id="${escapeHtml(def.id)}">
            ${ribbon}
            <div class="ov-card-icon-box">${iconSvg}</div>
            <div class="ov-card-body">
              <div class="ov-card-top">
                <span class="ov-card-name">${escapeHtml(def.name)}</span>
                <span class="ov-card-key">${idx + 1}</span>
              </div>
              <div class="ov-card-meta">
                <span class="ov-cat-tag">${escapeHtml(CATEGORY_LABELS[def.category])}</span>
                <span class="ov-rank-badge">${escapeHtml(rankLabel)}</span>
              </div>
              <p class="ov-card-desc">${escapeHtml(desc)}</p>
              ${synergy}
            </div>
          </button>
        `;
      })
      .join('');

    const rerollHtml =
      rerollsLeft > 0
        ? `<button type="button" class="ov-btn ov-btn--secondary ov-reroll-btn" data-action="reroll">↻ REROLL HARMONICS (${rerollsLeft} left)</button>`
        : '';

    this.levelupLayer.innerHTML = `
      <div class="ov-shell">
        <div class="ov-draft-header">
          <div class="ov-draft-kicker">Resonance Threshold Reached</div>
          <h2 class="ov-draft-title">HARMONIC ASCENSION — LEVEL ${level}</h2>
        </div>
        <div class="ov-draft-cards">${cardsHtml}</div>
        ${rerollHtml}
      </div>
    `;

    const cardBtns = this.levelupLayer.querySelectorAll<HTMLButtonElement>('.ov-draft-card');
    cardBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (performance.now() < this.draftUnlockTime) return;
        const id = btn.dataset.upgradeId as UpgradeId | undefined;
        if (id) {
          this.callbacks.onSelectUpgrade(id);
        }
      });
    });

    const rerollBtn = this.levelupLayer.querySelector<HTMLButtonElement>('[data-action="reroll"]');
    if (rerollBtn) {
      rerollBtn.addEventListener('click', () => {
        if (performance.now() < this.draftUnlockTime) return;
        this.callbacks.onRerollUpgrades();
      });
    }
  }

  public showGameOver(summary: RunSummary, saveData: SaveData): void {
    this.currentPhase = 'gameover';
    this.syncSaveData(saveData);
    this.latestRunUpgrades = summary.upgrades;

    this.hudLayer.classList.add('is-hidden');
    this.titleLayer.classList.add('is-hidden');
    this.levelupLayer.classList.add('is-hidden');
    this.pauseLayer.classList.add('is-hidden');
    this.gameoverLayer.classList.remove('is-hidden');

    const isLegend = summary.wave > 10;
    const titleClass = isLegend ? 'ov-modal-title ov-modal-title--legend' : 'ov-modal-title ov-modal-title--crimson';
    const titleText = isLegend ? 'ULTRASONIC LEGEND' : 'CHORD SILENCED';

    const callouts: string[] = [];
    if (summary.isNewBestWave) callouts.push('<span class="ov-callout-badge">★ NEW BEST WAVE! ★</span>');
    if (summary.isNewHighScore) callouts.push('<span class="ov-callout-badge">★ NEW HIGH SCORE! ★</span>');
    const calloutsHtml = callouts.length > 0 ? `<div class="ov-callouts">${callouts.join('')}</div>` : '';

    const affordableCount = this.countAffordableMeta(saveData);
    const benchBadge =
      affordableCount > 0 ? `<span class="ov-afford-badge">${affordableCount}</span>` : '';

    this.gameoverLayer.innerHTML = `
      <div class="ov-shell">
        <div class="ov-glass-panel ov-modal-card">
          <h2 class="${titleClass}">${titleText}</h2>
          ${calloutsHtml}
          <div class="ov-stats-grid">
            <div class="ov-stat-box">
              <div class="ov-stat-box-label">Wave Reached</div>
              <div class="ov-stat-box-value">Wave ${summary.wave}</div>
            </div>
            <div class="ov-stat-box">
              <div class="ov-stat-box-label">Peak Frequency</div>
              <div class="ov-stat-box-value">${summary.frequencyHz.toFixed(1)} Hz</div>
            </div>
            <div class="ov-stat-box">
              <div class="ov-stat-box-label">Time Survived</div>
              <div class="ov-stat-box-value">${formatTimeMMSS(summary.timeSurvivedSec)}</div>
            </div>
            <div class="ov-stat-box">
              <div class="ov-stat-box-label">Enemies Shattered</div>
              <div class="ov-stat-box-value">${summary.kills.toLocaleString()}</div>
            </div>
            <div class="ov-stat-box">
              <div class="ov-stat-box-label">Score</div>
              <div class="ov-stat-box-value">${summary.score.toLocaleString()}</div>
            </div>
            <div class="ov-stat-box ov-stat-box--brass">
              <div class="ov-stat-box-label">+Hz Brass Earned</div>
              <div class="ov-stat-box-value">+${summary.brassEarned} ${BRASS_GLYPH}</div>
            </div>
          </div>
          <div class="ov-section-label">Harmonic Build Summary</div>
          <div class="ov-build-grid">${this.renderBuildGrid(summary.upgrades)}</div>
          <div class="ov-actions-col">
            <button type="button" class="ov-btn ov-btn--primary" data-action="play-again">PLAY AGAIN</button>
            <button type="button" class="ov-btn ov-btn--secondary ov-bench-btn" data-action="open-bench">
              ${BRASS_GLYPH} TUNING BENCH (${saveData.brass} ${BRASS_GLYPH})
              ${benchBadge}
            </button>
            <button type="button" class="ov-btn ov-btn--ghost" data-action="to-title">RETURN TO TITLE</button>
          </div>
        </div>
      </div>
    `;

    this.gameoverLayer.querySelector('[data-action="play-again"]')?.addEventListener('click', () => {
      this.callbacks.onStartRun();
    });
    this.gameoverLayer.querySelector('[data-action="open-bench"]')?.addEventListener('click', () => {
      this.openShop(this.latestSaveData ?? saveData);
    });
    this.gameoverLayer.querySelector('[data-action="to-title"]')?.addEventListener('click', () => {
      this.showTitle(this.latestSaveData ?? saveData);
    });
  }

  public setOfflineReady(ready: boolean): void {
    this.offlineReady = ready;
    if (this.offlinePillEl && this.offlinePillTextEl) {
      this.offlinePillEl.classList.toggle('is-offline-ready', ready);
      this.offlinePillTextEl.textContent = ready ? 'OFFLINE READY' : 'ACOUSTIC ENGINE READY';
    }
  }

  // ===========================
  // Private Rendering Helpers
  // ===========================

  private syncSaveData(saveData: SaveData): void {
    this.latestSaveData = saveData;
    this.localSettings = { ...saveData.settings };
  }

  private countAffordableMeta(saveData: SaveData): number {
    let count = 0;
    for (let i = 0; i < this.metaDefs.length; i++) {
      const def = this.metaDefs[i];
      const rank = saveData.metaRanks[def.id] ?? 0;
      if (rank < def.maxRank && saveData.brass >= this.getUpgradeCost(def.id)) {
        count++;
      }
    }
    return count;
  }

  private renderSettingTogglesHtml(): string {
    const s = this.localSettings;
    return `
      <div class="ov-toggles-row">
        <button type="button" class="ov-btn ov-toggle-pill ${s.sfx ? 'is-on' : ''}" data-setting="sfx">SFX</button>
        <button type="button" class="ov-btn ov-toggle-pill ${s.music ? 'is-on' : ''}" data-setting="music">MUSIC</button>
        <button type="button" class="ov-btn ov-toggle-pill ${s.haptics ? 'is-on' : ''}" data-setting="haptics">HAPTIC</button>
      </div>
    `;
  }

  private bindSettingToggles(container: HTMLElement): void {
    const btns = container.querySelectorAll<HTMLButtonElement>('[data-setting]');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.setting as keyof SaveSettings | undefined;
        if (!key) return;
        this.localSettings[key] = !this.localSettings[key];
        btn.classList.toggle('is-on', this.localSettings[key]);
        this.callbacks.onToggleSetting(key);
      });
    });
  }

  private renderTitle(saveData: SaveData): void {
    const affordableCount = this.countAffordableMeta(saveData);
    const affordBadge =
      affordableCount > 0 ? `<span class="ov-afford-badge">${affordableCount}</span>` : '';
    const offlineClass = this.offlineReady ? 'is-offline-ready' : '';
    const offlineLabel = this.offlineReady ? 'OFFLINE READY' : 'ACOUSTIC ENGINE READY';

    this.titleLayer.innerHTML = `
      <div class="ov-shell">
        <div class="ov-title-top">
          <div class="ov-offline-pill ${offlineClass}">
            <span class="ov-offline-dot"></span>
            <span class="ov-offline-text">${offlineLabel}</span>
          </div>
          ${this.renderSettingTogglesHtml()}
        </div>

        <div class="ov-glass-panel ov-hero">
          <div class="ov-hero-emblem" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.5"/>
              <path d="M12 32c8-16 32 16 40 0M32 12c-16 8 16 32 0 40" fill="none" stroke="#38BDF8" stroke-width="1.5" opacity="0.75"/>
              <path d="M26 14v15a6 6 0 0 0 12 0V14M32 35v16M26 51h12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 class="ov-hero-title">OVERTONE</h1>
          <p class="ov-hero-sub">CHLADNI SURVIVOR</p>
          <p class="ov-hero-hint">Drag anywhere to glide. Lift thumb to Anchor Lock (+Fire Rate). Tap Overdrive at 100%.</p>
        </div>

        <div class="ov-records-strip">
          <div class="ov-record-cell">
            <div class="ov-record-label">Best Wave</div>
            <div class="ov-record-val">W${saveData.records.bestWave}</div>
          </div>
          <div class="ov-record-cell">
            <div class="ov-record-label">Peak Hz</div>
            <div class="ov-record-val">${saveData.records.peakFrequencyHz.toFixed(0)} Hz</div>
          </div>
          <div class="ov-record-cell">
            <div class="ov-record-label">High Score</div>
            <div class="ov-record-val">${saveData.records.highScore.toLocaleString()}</div>
          </div>
          <div class="ov-record-cell">
            <div class="ov-record-label">Hz Brass</div>
            <div class="ov-record-val ov-record-val--brass">${BRASS_GLYPH} ${saveData.brass}</div>
          </div>
        </div>

        <button type="button" class="ov-btn ov-btn--primary ov-play-btn" data-action="start-run">
          <span>STRIKE THE PLATE</span>
          <span class="ov-play-sub">PLAY</span>
        </button>

        <div class="ov-secondary-row">
          <button type="button" class="ov-btn ov-btn--secondary ov-bench-btn" data-action="open-shop">
            ${BRASS_GLYPH} TUNING BENCH
            ${affordBadge}
          </button>
          <button type="button" class="ov-btn ov-btn--ghost" data-action="open-codex">
            ✦ HARMONIC CODEX
          </button>
        </div>
      </div>
    `;

    this.offlinePillEl = this.titleLayer.querySelector('.ov-offline-pill');
    this.offlinePillTextEl = this.titleLayer.querySelector('.ov-offline-text');
    this.bindSettingToggles(this.titleLayer);

    this.titleLayer.querySelector('[data-action="start-run"]')?.addEventListener('click', () => {
      this.callbacks.onStartRun();
    });
    this.titleLayer.querySelector('[data-action="open-shop"]')?.addEventListener('click', () => {
      this.openShop(this.latestSaveData ?? saveData);
    });
    this.titleLayer.querySelector('[data-action="open-codex"]')?.addEventListener('click', () => {
      this.openCodex(this.latestSaveData ?? saveData);
    });
  }

  private renderPause(saveData: SaveData, runUpgrades?: RunUpgrades): void {
    this.pauseLayer.innerHTML = `
      <div class="ov-shell">
        <div class="ov-glass-panel ov-modal-card">
          <h2 class="ov-modal-title">PLATE SUSPENDED</h2>
          <div style="display:flex;justify-content:center;">
            ${this.renderSettingTogglesHtml()}
          </div>
          <div class="ov-section-label">Current Harmonic Build</div>
          <div class="ov-build-grid">${this.renderBuildGrid(runUpgrades)}</div>
          <div class="ov-actions-col">
            <button type="button" class="ov-btn ov-btn--primary" data-action="resume">RESUME</button>
            <button type="button" class="ov-btn ov-btn--danger" data-action="abandon">ABANDON RUN</button>
          </div>
        </div>
      </div>
    `;

    this.bindSettingToggles(this.pauseLayer);
    this.pauseLayer.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
      this.callbacks.onResume();
    });
    this.pauseLayer.querySelector('[data-action="abandon"]')?.addEventListener('click', () => {
      this.callbacks.onAbandonRun();
    });
  }

  private openShop(saveData: SaveData): void {
    this.renderShop(saveData);
    this.shopDrawer.classList.remove('is-hidden');
  }

  private renderShop(saveData: SaveData, purchasedId?: MetaUpgradeId): void {
    const itemsHtml = this.metaDefs
      .map((def) => {
        const rank = saveData.metaRanks[def.id] ?? 0;
        const isMax = rank >= def.maxRank;
        const cost = this.getUpgradeCost(def.id);
        const canAfford = !isMax && saveData.brass >= cost;
        const pips = Array.from({ length: def.maxRank }, (_, i) =>
          `<span class="ov-pip ${i < rank ? 'is-filled' : ''}"></span>`
        ).join('');

        return `
          <div class="ov-shop-card ${purchasedId === def.id ? 'is-purchased' : ''}">
            <div class="ov-card-icon-box">
              ${renderIconSvg(def.icon, 28, 'ov-icon--meta', def.id)}
            </div>
            <div class="ov-shop-info">
              <div class="ov-shop-name">${escapeHtml(def.name)} <span style="color:var(--ov-brass);font-size:11px;">R${rank}/${def.maxRank}</span></div>
              <div class="ov-shop-pips">${pips}</div>
              <div class="ov-shop-effect">${escapeHtml(def.effectPerRank)}</div>
              <div class="ov-shop-desc">${escapeHtml(def.description)}</div>
            </div>
            <button
              type="button"
              class="ov-btn ${canAfford ? 'ov-btn--primary' : 'ov-btn--ghost'} ov-buy-btn"
              data-meta-id="${escapeHtml(def.id)}"
              ${canAfford ? '' : 'disabled'}
            >
              ${isMax ? '<span>MAXED</span>' : `<span>${BRASS_GLYPH} ${cost}</span><span>TUNE</span>`}
            </button>
          </div>
        `;
      })
      .join('');

    this.shopDrawer.innerHTML = `
      <div class="ov-drawer-inner">
        <div class="ov-drawer-head">
          <h2 class="ov-drawer-title">TUNING BENCH</h2>
          <div class="ov-brass-bank">${BRASS_GLYPH} ${saveData.brass}</div>
          <button type="button" class="ov-btn ov-btn--ghost ov-close-btn" data-action="close-shop" aria-label="Close Tuning Bench">✕</button>
        </div>
        <div class="ov-shop-list">${itemsHtml}</div>
      </div>
    `;

    this.shopDrawer.querySelector('[data-action="close-shop"]')?.addEventListener('click', () => {
      this.shopDrawer.classList.add('is-hidden');
    });

    const buyBtns = this.shopDrawer.querySelectorAll<HTMLButtonElement>('[data-meta-id]');
    buyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.metaId as MetaUpgradeId | undefined;
        if (!id) return;
        const ok = this.callbacks.onBuyMetaUpgrade(id);
        if (ok && this.latestSaveData) {
          this.renderShop(this.latestSaveData, id);
          if (!this.titleLayer.classList.contains('is-hidden')) {
            this.renderTitle(this.latestSaveData);
          }
        }
      });
    });
  }

  private openCodex(saveData: SaveData): void {
    this.renderCodex(saveData);
    this.codexDrawer.classList.remove('is-hidden');
  }

  private renderCodex(saveData: SaveData): void {
    const allDefs = Object.values(this.upgradeDefs) as UpgradeDef[];
    const evolutions = allDefs.filter((d) => d.category === 'evolution');

    const evoHtml = evolutions
      .map((evo) => {
        const instId = evo.requiresInstrument ?? evo.evolvesInstrument;
        const modId = evo.requiresModulator;
        const instDef = instId ? this.upgradeDefs[instId] : undefined;
        const modDef = modId ? this.upgradeDefs[modId] : undefined;
        const discovered = saveData.records.discoveredEvolutions.includes(evo.id as EvolutionId);

        const instChip = instDef
          ? `<span class="ov-codex-chip">${renderIconSvg(instDef.icon, 16, 'ov-icon--instrument', instDef.id)} ${escapeHtml(instDef.name)} (R3)</span>`
          : `<span class="ov-codex-chip">Instrument R3</span>`;

        const modChip = modDef
          ? `<span class="ov-codex-chip">${renderIconSvg(modDef.icon, 16, 'ov-icon--modulator', modDef.id)} ${escapeHtml(modDef.name)}</span>`
          : `<span class="ov-codex-chip">Modulator</span>`;

        return `
          <div class="ov-codex-card ${discovered ? 'is-discovered' : ''}">
            <div class="ov-codex-result">
              <div class="ov-codex-evo-name">
                ${renderIconSvg(evo.icon, 22, 'ov-icon--evolution', evo.id)}
                <span>${escapeHtml(evo.name)}</span>
              </div>
              <span class="ov-codex-badge ${discovered ? 'is-discovered' : ''}">
                ${discovered ? '★ DISCOVERED' : 'RECIPE'}
              </span>
            </div>
            <div class="ov-codex-recipe">
              ${instChip}
              <span class="ov-codex-op">+</span>
              ${modChip}
              <span class="ov-codex-op">→</span>
              <span class="ov-codex-chip" style="border-color:var(--ov-brass);color:#fde68a;">EVOLVE</span>
            </div>
            <p class="ov-codex-desc">${escapeHtml(evo.descriptions[0] || evo.tagline)}</p>
          </div>
        `;
      })
      .join('');

    this.codexDrawer.innerHTML = `
      <div class="ov-drawer-inner">
        <div class="ov-drawer-head">
          <h2 class="ov-drawer-title">HARMONIC CODEX</h2>
          <button type="button" class="ov-btn ov-btn--ghost ov-close-btn" data-action="close-codex" aria-label="Close Harmonic Codex">✕</button>
        </div>
        <div class="ov-section-label">5 Grand Harmonic Evolutions</div>
        <div class="ov-codex-list">
          ${evoHtml}
          <div class="ov-codex-tip">
            <strong>Anchor &amp; Relic Synergy Tip:</strong> Holding still plants your Stylus in <em>Anchor Stance</em> (+28% Fire Rate). Pair <em>Grounded Focus</em> with <em>Glass Octave</em> (2.0× DMG, 50% Max HP) and <em>Shatter Resonance</em> for chain-detonating crowd clears.
          </div>
        </div>
      </div>
    `;

    this.codexDrawer.querySelector('[data-action="close-codex"]')?.addEventListener('click', () => {
      this.codexDrawer.classList.add('is-hidden');
    });
  }

  private renderBuildGrid(runUpgrades?: RunUpgrades): string {
    if (!runUpgrades) {
      return `<div class="ov-build-item" style="grid-column:span 2;justify-content:center;color:var(--ov-text-muted);font-size:12px;">Base Tuning Stylus</div>`;
    }

    const items: string[] = [];
    const seen = new Set<UpgradeId>();

    // 1. Evolutions
    for (const evoId of runUpgrades.evolutions) {
      const def = this.upgradeDefs[evoId];
      if (!def || seen.has(evoId)) continue;
      seen.add(evoId);
      items.push(this.renderBuildItem(def, 'EVOLVED', 'ov-build-item--evolution'));
    }

    // 2. Active Instruments
    for (const instId of runUpgrades.activeInstruments) {
      const def = this.upgradeDefs[instId];
      if (!def || seen.has(instId)) continue;
      seen.add(instId);
      const rank = runUpgrades.ranks[instId] ?? 1;
      items.push(this.renderBuildItem(def, `R${rank}/${def.maxRank}`, ''));
    }

    // 3. Relics
    for (const relicId of runUpgrades.relics) {
      const def = this.upgradeDefs[relicId];
      if (!def || seen.has(relicId)) continue;
      seen.add(relicId);
      items.push(this.renderBuildItem(def, 'RELIC', 'ov-build-item--relic'));
    }

    // 4. Remaining Modulators / Bonus in ranks
    const rankEntries = Object.entries(runUpgrades.ranks) as [UpgradeId, number | undefined][];
    for (const [id, rank] of rankEntries) {
      if (!rank || seen.has(id)) continue;
      const def = this.upgradeDefs[id];
      if (!def) continue;
      seen.add(id);
      const label = def.maxRank > 1 ? `R${rank}/${def.maxRank}` : `×${rank}`;
      items.push(this.renderBuildItem(def, label, ''));
    }

    if (items.length === 0) {
      return `<div class="ov-build-item" style="grid-column:span 2;justify-content:center;color:var(--ov-text-muted);font-size:12px;">Base Tuning Stylus</div>`;
    }

    return items.join('');
  }

  private renderBuildItem(def: UpgradeDef, rankLabel: string, extraClass: string): string {
    const iconSvg = renderIconSvg(def.icon, 24, categoryIconClass(def.category), def.id);
    return `
      <div class="ov-build-item ${extraClass}">
        <div class="ov-build-item-icon">${iconSvg}</div>
        <div class="ov-build-item-info">
          <span class="ov-build-item-name">${escapeHtml(def.name)}</span>
          <span class="ov-build-item-rank">${escapeHtml(rankLabel)}</span>
        </div>
      </div>
    `;
  }

  private formatRankTransition(opt: UpgradeDraftOption): string {
    if (opt.def.category === 'evolution') {
      return 'EVOLVE!';
    }
    if (opt.currentRank === 0) {
      return 'NEW!';
    }
    if (opt.def.category === 'bonus' && opt.nextRank > opt.def.maxRank) {
      return `STACK ${opt.nextRank}`;
    }
    if (opt.nextRank >= opt.def.maxRank) {
      return `RANK ${opt.currentRank} → ${opt.nextRank} (MAX)`;
    }
    return `RANK ${opt.currentRank} → ${opt.nextRank}`;
  }
}
