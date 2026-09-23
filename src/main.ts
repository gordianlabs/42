import { runIntro } from './intro';
import { handleTileClick } from './tile';
import { triggerFinale } from './finale';

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

function generateDontPanicDataUrl(width: number, height: number): string {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const grad = ctx.createRadialGradient(
    width / 2, height / 2, 0,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  grad.addColorStop(0, '#8B0000');
  grad.addColorStop(1, '#3D0000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const fontSize = Math.min(width * 0.28, height * 0.18);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fontSize}px 'Nunito', 'Arial Rounded MT Bold', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("DON'T", width / 2, height * 0.38);
  ctx.fillText('PANIC', width / 2, height * 0.62);

  return canvas.toDataURL('image/png');
}

function buildGrid(
  grid: HTMLElement,
  revealed: boolean[]
): HTMLElement[] {
  const tileEls: HTMLElement[] = [];

  const rect = grid.getBoundingClientRect();
  const gridW = rect.width || grid.offsetWidth;
  const tileW = gridW / COLS;
  const tileH = tileW;
  const gridH = tileH * ROWS;

  const dontPanicUrl = generateDontPanicDataUrl(gridW, gridH);

  for (let i = 0; i < TOTAL; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const bpX = COLS > 1 ? `${(col / (COLS - 1)) * 100}%` : '0%';
    const bpY = ROWS > 1 ? `${(row / (ROWS - 1)) * 100}%` : '0%';

    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset['index'] = String(i);
    tile.setAttribute('role', 'listitem');
    tile.setAttribute('aria-label', `Memory ${i + 1}`);
    tile.setAttribute('tabindex', '0');

    const front = document.createElement('div');
    front.className = 'tile-front';
    front.style.backgroundImage = `url('${dontPanicUrl}')`;
    front.style.backgroundSize = `${COLS * 100}% ${ROWS * 100}%`;
    front.style.backgroundPosition = `${bpX} ${bpY}`;

    const back = document.createElement('div');
    back.className = 'tile-back';
    back.style.backgroundPosition = `${bpX} ${bpY}`;

    tile.append(front, back);
    grid.appendChild(tile);
    tileEls.push(tile);

    if (revealed[i]) {
      tile.classList.add('revealed', 'no-transition');
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
      setTimeout(() => triggerFinale(index, tileEls), 200);
    }
  };

  tileEls.forEach((tile, i) => {
    const handler = () => {
      if (revealed[i]) return;
      handleTileClick(i, tile, tileEls, revealed, captions, onReveal);
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

function showHint(): void {
  const hint = document.getElementById('hint');
  if (!hint) return;
  hint.classList.add('visible');
  const hide = () => hint.classList.remove('visible');
  hint.addEventListener('click', hide, { once: true });
  setTimeout(hide, 3000);
}

function wireEasterEgg(): void {
  // Keyboard: type "towel"
  let keyBuffer = '';
  document.addEventListener('keydown', (e) => {
    keyBuffer = (keyBuffer + e.key).slice(-5).toLowerCase();
    if (keyBuffer === 'towel') triggerEasterEgg();
  });

  // Mobile: 3 taps within 2s on hidden target
  const target = document.getElementById('easter-target');
  if (!target) return;
  let taps = 0;
  let tapTimer: ReturnType<typeof setTimeout>;
  target.addEventListener('click', () => {
    taps++;
    clearTimeout(tapTimer);
    if (taps >= 3) {
      taps = 0;
      triggerEasterEgg();
    } else {
      tapTimer = setTimeout(() => { taps = 0; }, 2000);
    }
  });
}

function triggerEasterEgg(): void {
  const towel = document.createElement('div');
  towel.className = 'towel-float';
  towel.textContent = '🧣';
  towel.style.left = `${20 + Math.random() * 60}%`;
  towel.style.bottom = '10%';
  document.body.appendChild(towel);
  towel.addEventListener('animationend', () => towel.remove());

  const toast = document.getElementById('towel-toast');
  if (!toast) return;
  toast.textContent = "Don't Panic. And always know where your towel is. — Deep Thought";
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 4000);
}

async function main(): Promise<void> {
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

  const tileEls = buildGrid(grid, revealed);
  wireTiles(tileEls, captions, revealed);
  wireEasterEgg();

  if (!anyRevealed) {
    setTimeout(showHint, 600);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  main().catch(console.warn);
});
