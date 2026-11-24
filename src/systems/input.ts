import type { InputSnapshot } from '../types.ts';

export interface InputCallbacks {
  onFirstGesture: () => void;
  onPauseRequest: () => void;
  onQuickPickUpgrade: (index: 0 | 1 | 2) => void;
  onOverdriveKey: () => void;
  onVisibilityHidden: () => void;
}

const MAX_JOYSTICK_RADIUS = 56;
const JOYSTICK_DEADZONE = 6;
const MOVE_THRESHOLD = 0.08;
const ANCHOR_DELAY_SEC = 0.22;
const INV_SQRT2 = Math.SQRT1_2;

export class InputController {
  private readonly canvas: HTMLCanvasElement;
  private readonly callbacks: InputCallbacks;

  private readonly snapshot: InputSnapshot = {
    moveX: 0,
    moveY: 0,
    magnitude: 0,
    isMoving: false,
    joystickActive: false,
    originX: 0,
    originY: 0,
    knobX: 0,
    knobY: 0,
    stillDuration: 0,
    isAnchored: false,
    overdrivePressed: false,
  };

  private gameplayActive = true;
  private activePointerId: number | null = null;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchMagnitude = 0;
  private overdrivePressed = false;

  private readonly heldKeys = new Set<string>();
  private destroyed = false;

  private readonly onPointerDownBound: (e: PointerEvent) => void;
  private readonly onPointerMoveBound: (e: PointerEvent) => void;
  private readonly onPointerUpBound: (e: PointerEvent) => void;
  private readonly onPointerCancelBound: (e: PointerEvent) => void;
  private readonly onKeyDownBound: (e: KeyboardEvent) => void;
  private readonly onKeyUpBound: (e: KeyboardEvent) => void;
  private readonly onVisibilityChangeBound: () => void;
  private readonly onPageHideBound: () => void;
  private readonly onBlurBound: () => void;

  constructor(canvas: HTMLCanvasElement, callbacks: InputCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);
    this.onPointerCancelBound = this.handlePointerCancel.bind(this);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onVisibilityChangeBound = this.handleVisibilityChange.bind(this);
    this.onPageHideBound = this.handleHiddenSignal.bind(this);
    this.onBlurBound = this.handleHiddenSignal.bind(this);

    canvas.addEventListener('pointerdown', this.onPointerDownBound, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMoveBound, { passive: false });
    canvas.addEventListener('pointerup', this.onPointerUpBound, { passive: false });
    canvas.addEventListener('pointercancel', this.onPointerCancelBound, { passive: false });

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
    window.addEventListener('pagehide', this.onPageHideBound);
    window.addEventListener('blur', this.onBlurBound);
  }

  public setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
    if (!active) {
      this.resetTouch();
      this.snapshot.moveX = 0;
      this.snapshot.moveY = 0;
      this.snapshot.magnitude = 0;
      this.snapshot.isMoving = false;
      this.snapshot.stillDuration = 0;
      this.snapshot.isAnchored = false;
    }
  }

  public consumeOverdrivePress(): boolean {
    const pressed = this.overdrivePressed;
    this.overdrivePressed = false;
    this.snapshot.overdrivePressed = false;
    return pressed;
  }

  public resetTouch(): void {
    if (this.activePointerId !== null) {
      try {
        if (this.canvas.hasPointerCapture?.(this.activePointerId)) {
          this.canvas.releasePointerCapture(this.activePointerId);
        }
      } catch {
        // Ignore capture release errors on synthetic or detached pointers
      }
    }
    this.activePointerId = null;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchMagnitude = 0;
    this.snapshot.joystickActive = false;
    this.snapshot.originX = 0;
    this.snapshot.originY = 0;
    this.snapshot.knobX = 0;
    this.snapshot.knobY = 0;
  }

  public vibrate(ms: number, enabled: boolean): void {
    if (!enabled || ms <= 0) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      // Ignore unsupported or restricted vibration environments
    }
  }

  public update(dt: number): InputSnapshot {
    const safeDt = dt > 0 ? dt : 0;

    let moveX = 0;
    let moveY = 0;
    let magnitude = 0;

    if (this.gameplayActive) {
      if (this.snapshot.joystickActive) {
        moveX = this.touchMoveX;
        moveY = this.touchMoveY;
        magnitude = this.touchMagnitude;
      } else if (this.heldKeys.size > 0) {
        const up = this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp');
        const down = this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown');
        const left = this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft');
        const right = this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight');

        const kx = (right ? 1 : 0) - (left ? 1 : 0);
        const ky = (down ? 1 : 0) - (up ? 1 : 0);

        if (kx !== 0 && ky !== 0) {
          moveX = kx * INV_SQRT2;
          moveY = ky * INV_SQRT2;
          magnitude = 1;
        } else if (kx !== 0 || ky !== 0) {
          moveX = kx;
          moveY = ky;
          magnitude = 1;
        }
      }
    }

    const isMoving = magnitude > MOVE_THRESHOLD;
    if (!this.gameplayActive) {
      this.snapshot.stillDuration = 0;
      this.snapshot.isAnchored = false;
    } else if (isMoving) {
      this.snapshot.stillDuration = 0;
      this.snapshot.isAnchored = false;
    } else {
      this.snapshot.stillDuration += safeDt;
      this.snapshot.isAnchored = this.snapshot.stillDuration >= ANCHOR_DELAY_SEC;
    }

    this.snapshot.moveX = moveX;
    this.snapshot.moveY = moveY;
    this.snapshot.magnitude = magnitude;
    this.snapshot.isMoving = isMoving;
    this.snapshot.overdrivePressed = this.overdrivePressed;

    return this.snapshot;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.resetTouch();
    this.heldKeys.clear();

    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    this.canvas.removeEventListener('pointerup', this.onPointerUpBound);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancelBound);

    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
    window.removeEventListener('pagehide', this.onPageHideBound);
    window.removeEventListener('blur', this.onBlurBound);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    this.callbacks.onFirstGesture();

    if (!this.gameplayActive || this.activePointerId !== null) return;

    this.activePointerId = e.pointerId;
    this.snapshot.originX = e.clientX;
    this.snapshot.originY = e.clientY;
    this.snapshot.knobX = e.clientX;
    this.snapshot.knobY = e.clientY;
    this.snapshot.joystickActive = true;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchMagnitude = 0;

    try {
      this.canvas.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic events
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.snapshot.joystickActive || e.pointerId !== this.activePointerId) {
      return;
    }

    e.preventDefault();

    let dx = e.clientX - this.snapshot.originX;
    let dy = e.clientY - this.snapshot.originY;
    let dist = Math.hypot(dx, dy);

    // Dynamic floating tether: drag origin along once exceeding maxRadius
    // so abrupt direction reversals feel instantaneous.
    if (dist > MAX_JOYSTICK_RADIUS) {
      const invDist = 1 / dist;
      const nx = dx * invDist;
      const ny = dy * invDist;
      this.snapshot.originX = e.clientX - nx * MAX_JOYSTICK_RADIUS;
      this.snapshot.originY = e.clientY - ny * MAX_JOYSTICK_RADIUS;
      dx = nx * MAX_JOYSTICK_RADIUS;
      dy = ny * MAX_JOYSTICK_RADIUS;
      dist = MAX_JOYSTICK_RADIUS;
    }

    this.snapshot.knobX = this.snapshot.originX + dx;
    this.snapshot.knobY = this.snapshot.originY + dy;

    if (dist <= JOYSTICK_DEADZONE) {
      this.touchMoveX = 0;
      this.touchMoveY = 0;
      this.touchMagnitude = 0;
      return;
    }

    const mag = Math.min(
      1,
      (dist - JOYSTICK_DEADZONE) / (MAX_JOYSTICK_RADIUS - JOYSTICK_DEADZONE)
    );
    const invDist = 1 / dist;
    this.touchMoveX = dx * invDist * mag;
    this.touchMoveY = dy * invDist * mag;
    this.touchMagnitude = mag;
  }

  private handlePointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.resetTouch();
  }

  private handlePointerCancel(e: PointerEvent): void {
    if (e.pointerId !== this.activePointerId) return;
    e.preventDefault();
    this.resetTouch();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    this.callbacks.onFirstGesture();

    const code = e.code;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      this.heldKeys.add(code);
      return;
    }

    if (e.repeat) return;

    if (code === 'Space') {
      this.overdrivePressed = true;
      this.snapshot.overdrivePressed = true;
      this.callbacks.onOverdriveKey();
    } else if (code === 'Escape' || code === 'KeyP') {
      this.callbacks.onPauseRequest();
    } else if (code === 'Digit1') {
      this.callbacks.onQuickPickUpgrade(0);
    } else if (code === 'Digit2') {
      this.callbacks.onQuickPickUpgrade(1);
    } else if (code === 'Digit3') {
      this.callbacks.onQuickPickUpgrade(2);
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.heldKeys.delete(e.code);
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden' || document.hidden) {
      this.handleHiddenSignal();
    }
  }

  private handleHiddenSignal(): void {
    this.heldKeys.clear();
    this.resetTouch();
    this.callbacks.onVisibilityHidden();
  }
}
