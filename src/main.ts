import './ui/styles.css';
import { Game } from './game';

function installMobileViewportGuards(): void {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  const preventGesture = (e: Event): void => {
    e.preventDefault();
  };
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  // Prevent iOS Safari double-tap zoom on rapid taps outside native controls
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        if (!target || !target.closest('button, a, input, select, textarea')) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

function registerServiceWorker(game: Game): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string } | null;
    if (data && data.type === 'OVERTONE_SW_READY') {
      game.setOfflineReady(true);
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        if (reg.active) {
          game.setOfflineReady(true);
        }
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        game.setOfflineReady(true);
      })
      .catch(() => {
        // Gracefully ignore missing sw.js in Vite dev mode
      });
  });
}

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root') as HTMLElement | null;
  if (!canvas || !uiRoot) {
    throw new Error('OVERTONE bootstrap failed: missing #game-canvas or #ui-root');
  }

  installMobileViewportGuards();

  const game = new Game(canvas, uiRoot);
  (window as unknown as { __OVERTONE_GAME__?: Game }).__OVERTONE_GAME__ = game;
  registerServiceWorker(game);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
