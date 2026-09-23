import { runIntro } from './intro';
import { handleTileClick, setTilePhoto, reopenTile } from './tile';
import { triggerFinale, lightUpFortyTwo, playBirthdayVideo, fireConfetti } from './finale';

const COLS = 6;
const ROWS = 7;
const TOTAL = COLS * ROWS;
const STORAGE_KEY = 'mukta42-v1';

interface SavedState {
  v: number;
  r: boolean[];
}

interface Caption {
  photo: string;
  caption: string;
}

function loadState(): boolean[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(TOTAL).fill(false);
    const parsed = JSON.parse(raw) as SavedState;
    if (parsed.v === 1 && Array.isArray(parsed.r) && parsed.r.length === TOTAL) {
      return parsed.r;
    }
  } catch {
    // ignore
  }
  return Array(TOTAL).fill(false);
}

function saveState(revealed: boolean[]): void {
  try {
    const state: SavedState = { v: 1, r: revealed };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Connections-style color palette
const DONT_COLOR  = '#F9DF6D'; // yellow  — DON'T tiles
const PANIC_COLOR = '#A0C35A'; // green   — PANIC tiles
const BLANK_EVEN  = '#B0C4EF'; // blue    — blank rows (even)
const BLANK_ODD   = '#BA81C5'; // purple  — blank rows (odd)

// DON'T right-aligned in row 3 (tiles 19-23), PANIC left-aligned in row 4 (tiles 24-28)
const DONT_PANIC_LETTERS: Record<number, string> = {
  19: 'D', 20: 'O', 21: 'N', 22: "'", 23: 'T',
  24: 'P', 25: 'A', 26: 'N', 27: 'I', 28: 'C',
};

function getTileColor(index: number): string {
  const row = Math.floor(index / COLS);
  if (row === 3) return DONT_COLOR;   // whole row 3 = yellow (DON'T)
  if (row === 4) return PANIC_COLOR;  // whole row 4 = green  (PANIC)
  return row % 2 === 0 ? BLANK_EVEN : BLANK_ODD;
}

function buildGrid(
  grid: HTMLElement,
  revealed: boolean[],
  captions: Caption[]
): HTMLElement[] {
  const tileEls: HTMLElement[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset['index'] = String(i);
    tile.setAttribute('role', 'listitem');
    tile.setAttribute('aria-label', `Memory ${i + 1}`);
    tile.setAttribute('tabindex', '0');

    const front = document.createElement('div');
    front.className = 'tile-front';
    front.style.backgroundColor = getTileColor(i);

    const letter = DONT_PANIC_LETTERS[i];
    if (letter) {
      const span = document.createElement('span');
      span.className = 'tile-letter';
      span.textContent = letter;
      front.appendChild(span);
    }

    const back = document.createElement('div');
    back.className = 'tile-back';

    tile.append(front, back);
    grid.appendChild(tile);
    tileEls.push(tile);

    if (revealed[i]) {
      tile.classList.add('revealed');
      const photo = captions[i]?.photo ?? `${String(i + 1).padStart(2, '0')}.jpg`;
      setTilePhoto(back, photo);
    }
  }

  // Remove no-transition after one paint so initial state is instant
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      tileEls.forEach((t) => t.classList.remove('no-transition'));
    });
  });

  return tileEls;
}

function wireTiles(
  tileEls: HTMLElement[],
  captions: Caption[],
  revealed: boolean[]
): void {
  let finaleTriggered = false;

  const onReveal = (index: number) => {
    saveState(revealed);

    const count = revealed.filter(Boolean).length;
    if (count === TOTAL && !finaleTriggered) {
      finaleTriggered = true;
      setTimeout(() => triggerFinale(index, tileEls, showToast), 200);
    }
  };

  tileEls.forEach((tile, i) => {
    const handler = () => {
      if (revealed[i]) {
        // Re-tap on a revealed tile: expand the photo again
        reopenTile(i, tile, captions);
      } else {
        handleTileClick(i, tile, tileEls, revealed, captions, onReveal);
      }
    };

    tile.addEventListener('click', handler);
    tile.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}


function wireShakeToFinale(): void {
  const THRESHOLD = 25; // m/s² — needs a real shake, not pocket movement
  const COOLDOWN = 3000;
  let lastShake = 0;
  let lastX = 0, lastY = 0, lastZ = 0, firstReading = true;

  const onMotion = (e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity;
    if (!acc || acc.x == null) return;
    const x = acc.x ?? 0, y = acc.y ?? 0, z = acc.z ?? 0;
    if (firstReading) { lastX = x; lastY = y; lastZ = z; firstReading = false; return; }
    const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
    lastX = x; lastY = y; lastZ = z;
    if (delta > THRESHOLD && Date.now() - lastShake > COOLDOWN) {
      lastShake = Date.now();
      skipToFinale();
    }
  };

  // iOS 13+ requires permission
  if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
    // Request on first user gesture (tile tap already happened)
    (DeviceMotionEvent as any).requestPermission()
      .then((r: string) => { if (r === 'granted') window.addEventListener('devicemotion', onMotion); })
      .catch(() => {});
  } else {
    window.addEventListener('devicemotion', onMotion);
  }
}

function wireEasterEgg(): void {
  // Keyboard: type "towel"
  let keyBuffer = '';
  document.addEventListener('keydown', (e) => {
    keyBuffer = (keyBuffer + e.key).slice(-5).toLowerCase();
    if (keyBuffer === 'towel') triggerEasterEgg();
  });

}

function showToast(text: string, duration = 4500): void {
  const toast = document.getElementById('towel-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), duration);
}

function triggerEasterEgg(): void {
  const towel = document.createElement('div');
  towel.className = 'towel-float';
  towel.textContent = '🧣';
  towel.style.left = `${20 + Math.random() * 60}%`;
  towel.style.bottom = '10%';
  document.body.appendChild(towel);
  towel.addEventListener('animationend', () => towel.remove());
  showToast("Don't Panic. And always know where your towel is. — Deep Thought");
}

// Easter egg #2: long-press the apostrophe tile (revealed or not)
function wireApostropheEgg(tileEls: HTMLElement[], _revealed: boolean[]): void {
  const APOSTROPHE_TILE = 22; // the ' in DON'T
  const tile = tileEls[APOSTROPHE_TILE];
  if (!tile) return;

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressed = false;

  tile.addEventListener('pointerdown', () => {
    suppressed = false;
    pressTimer = setTimeout(() => {
      suppressed = true;
      showToast('This apostrophe was inserted by the Magratheans for a nominal fee.');
    }, 600);
  });

  const cancel = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  };
  tile.addEventListener('pointerup', cancel);
  tile.addEventListener('pointercancel', cancel);
  tile.addEventListener('pointermove', cancel);

  // Suppress the normal tile click if long-press fired
  tile.addEventListener('click', (e) => {
    if (suppressed) { e.stopImmediatePropagation(); suppressed = false; }
  }, true); // capture phase — runs before wireTiles handler
}

// Easter egg #4: long-press on background (not on tiles or modal)
function wireLongPress(): void {
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  document.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.tile, .modal, #intro, #easter-target')) return;
    startX = e.clientX;
    startY = e.clientY;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      triggerLongPressEgg();
    }, 600);
  });

  const cancel = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  };

  document.addEventListener('pointermove', (e) => {
    if (!pressTimer) return;
    if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) cancel();
  });
  document.addEventListener('pointerup', cancel);
  document.addEventListener('pointercancel', cancel);
}

function triggerLongPressEgg(): void {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: '#000', zIndex: '1000',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: '0', transition: 'opacity 0.6s ease', cursor: 'pointer',
  });

  const p = document.createElement('p');
  Object.assign(p.style, {
    color: '#c9a84c', fontFamily: 'Courier New, monospace',
    fontSize: 'clamp(0.85rem, 3vw, 1.1rem)', textAlign: 'center',
    padding: '2rem', lineHeight: '2.5', maxWidth: '500px',
  });
  p.innerHTML =
    'DO NOT ADJUST YOUR MIND.<br>REALITY IS ADJUSTED TO FIT YOUR MIND.' +
    '<br><small style="opacity:0.4;font-size:0.7em">— Sirius Cybernetics Corporation</small>';

  overlay.appendChild(p);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    const dismiss = () => {
      overlay.style.opacity = '0';
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    };
    setTimeout(dismiss, 3500);
    overlay.addEventListener('click', dismiss, { once: true });
  });
}

// ── Background music ──────────────────────────────────────
let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function initMusic(): void {
  const audio = document.getElementById('bg-music') as HTMLAudioElement | null;
  if (!audio) return;

  audio.volume = 0.28;

  // Start on first user interaction (satisfies browser autoplay policy)
  const startOnce = () => {
    audio.play().catch(() => {});
    document.removeEventListener('pointerdown', startOnce);
  };
  document.addEventListener('pointerdown', startOnce);

  // Mute toggle
  const btn = document.getElementById('music-toggle');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.muted = !audio.muted;
    btn.textContent = audio.muted ? '🔇' : '🔉';
    btn.setAttribute('aria-label', audio.muted ? 'Unmute music' : 'Mute music');
  });
}

async function main(): Promise<void> {
  // ?reset → clear and reload fresh (check BEFORE stripping the URL)
  if (new URLSearchParams(location.search).has('reset')) {
    localStorage.removeItem(STORAGE_KEY);
    location.replace('/');
    return;
  }

  // Clean up any other stale query params
  if (location.search) history.replaceState(null, '', '/');

  document.addEventListener('keydown', (e) => {
    // Cmd+Shift+0 → reset grid
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '0') {
      e.preventDefault();
      localStorage.removeItem(STORAGE_KEY);
      location.href = '/';
    }
    // Cmd+Shift+F → skip to finale (dev shortcut)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
      e.preventDefault();
      skipToFinale();
    }
  });

  const [captionsRes] = await Promise.all([
    fetch('/captions.json'),
  ]);
  const captions: Caption[] = await captionsRes.json();

  const revealed = loadState();
  const anyRevealed = revealed.some(Boolean);

  const grid = document.getElementById('grid')!;
  const app = document.getElementById('app')!;

  // Show intro only on first visit
  if (!anyRevealed) {
    app.style.opacity = '0';
    await runIntro();
    app.style.opacity = '';
  } else {
    const intro = document.getElementById('intro');
    if (intro) intro.style.display = 'none';
  }

  const allRevealed = revealed.every(Boolean);

  const tileEls = buildGrid(grid, revealed, captions);
  wireTiles(tileEls, captions, revealed);
  wireEasterEgg();
  wireApostropheEgg(tileEls, revealed);
  wireLongPress();
  initMusic();
  wireShakeToFinale();

  // If already complete on load, skip straight to fireworks → video → message
  if (allRevealed) {
    grid.classList.add('finale');
    setTimeout(() => {
      lightUpFortyTwo(tileEls, false, () => {
        playBirthdayVideo(() => {
          document.getElementById('finale-message')?.classList.add('visible');
          fireConfetti();
        });
      }, showToast);
    }, 600);
  }


  // Expose for the Cmd+Shift+F shortcut — skips straight to 42 + video
  skipToFinale = () => {
    tileEls.forEach((tile, i) => {
      if (revealed[i]) return;
      revealed[i] = true;
      const back = tile.querySelector<HTMLElement>('.tile-back')!;
      setTilePhoto(back, captions[i]?.photo ?? `${String(i + 1).padStart(2, '0')}.jpg`);
      tile.classList.add('revealed');
    });
    requestAnimationFrame(() => {
      saveState(revealed);
      document.getElementById('grid')?.classList.add('finale');
      // Skip ripple + breathe — jump straight to the payoff
      lightUpFortyTwo(tileEls, false, () => {
        playBirthdayVideo(() => {
          document.getElementById('finale-message')?.classList.add('visible');
          fireConfetti();
        });
      }, showToast);
    });
  };
}

// Filled in after main() runs so the keydown handler can call it
let skipToFinale: () => void = () => {};

document.addEventListener('DOMContentLoaded', () => {
  main().catch(console.warn);
});
