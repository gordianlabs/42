import { gsap } from 'gsap';

declare const confetti: ((opts: Record<string, unknown>) => void) | undefined;

// Tile indices that form "42" in pixel art across the 6×7 grid
// Col:  0  1  2  3  4  5
// Row 0: #  .  .  #  #  #
// Row 1: #  .  .  .  .  #
// Row 2: #  #  #  #  #  #  ← shared crossbar
// Row 3: .  .  #  #  .  .
// Row 4: .  .  #  #  .  .
// Row 5: .  .  #  #  #  #
// Row 6: .  .  .  .  .  .
const FORTY_TWO_TILES = new Set([
  0, 3, 4, 5,           // row 0
  6, 11,                // row 1
  12, 13, 14, 15, 16, 17, // row 2
  20, 21,               // row 3
  26, 27,               // row 4
  32, 33, 34, 35,       // row 5
]);

export function triggerFinale(
  lastIndex: number,
  tileEls: HTMLElement[],
  showToast?: (text: string) => void
): void {
  const COLS = 6;
  const grid = document.getElementById('grid')!;
  const finaleMsg = document.getElementById('finale-message')!;

  const lastCol = lastIndex % COLS;
  const lastRow = Math.floor(lastIndex / COLS);

  const sorted = tileEls
    .map((el, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const dist = Math.sqrt((col - lastCol) ** 2 + (row - lastRow) ** 2);
      return { el, dist };
    })
    .sort((a, b) => a.dist - b.dist);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced) {
    grid.classList.add('finale');
    lightUpFortyTwo(tileEls, true, undefined, showToast);
    playBirthdayVideo(() => finaleMsg.classList.add('visible'));
    return;
  }

  // Ripple pulse outward from last tile
  const tl = gsap.timeline({
    onComplete: () => {
      grid.classList.add('finale');
      gsap.fromTo(
        grid,
        { scale: 0.97 },
        {
          scale: 1,
          duration: 2,
          ease: 'power2.out',
          onComplete: () => {
            lightUpFortyTwo(tileEls, false, () => {
              playBirthdayVideo(() => {
                finaleMsg.classList.add('visible');
                fireConfetti();
              });
            }, showToast);
          },
        }
      );
    },
  });

  tl.to(sorted.map((s) => s.el), {
    scale: 1.06,
    duration: 0.25,
    stagger: { each: 0.04, ease: 'power1.in' },
    ease: 'power1.out',
  }).to(sorted.map((s) => s.el), {
    scale: 1,
    duration: 0.35,
    stagger: { each: 0.04, ease: 'power1.in' },
    ease: 'power2.out',
  }, '-=0.2');
}

export function lightUpFortyTwo(
  tileEls: HTMLElement[],
  instant: boolean,
  onComplete?: () => void,
  showToast?: (text: string) => void
): void {
  const highlights: HTMLElement[] = [];
  const litTiles: HTMLElement[] = [];

  tileEls.forEach((tile, i) => {
    if (!FORTY_TWO_TILES.has(i)) return;
    const back = tile.querySelector<HTMLElement>('.tile-back');
    if (!back) return;
    const hl = document.createElement('div');
    hl.className = 'tile-highlight';
    back.appendChild(hl);
    highlights.push(hl);
    litTiles.push(tile);
  });

  // Easter egg #6: tap any 4 highlighted tiles within 4s
  if (showToast) {
    let tapCount = 0;
    let tapTimer: ReturnType<typeof setTimeout>;
    const onLitTap = () => {
      tapCount++;
      clearTimeout(tapTimer);
      if (tapCount >= 4) {
        litTiles.forEach((t) => t.removeEventListener('click', onLitTap));
        fireConfetti();
        showToast("You've solved it twice. The Universe is impressed.");
      } else {
        tapTimer = setTimeout(() => { tapCount = 0; }, 4000);
      }
    };
    litTiles.forEach((t) => t.addEventListener('click', onLitTap));
  }

  if (instant) {
    highlights.forEach((hl) => (hl.style.opacity = '1'));
    onComplete?.();
    return;
  }

  gsap.to(highlights, {
    opacity: 1,
    duration: 0.25,
    stagger: 0.05,
    ease: 'power1.out',
    onComplete: () => {
      fadeMusicOut(); // fade music as 42 glows
      // Linger on the "42" — three confetti bursts, then hand off
      fireworks();
      setTimeout(() => fireworks(), 900);
      setTimeout(() => fireworks(), 1800);
      setTimeout(() => onComplete?.(), 3200);
    },
  });
}

function fadeMusicOut(): void {
  const bgMusic = document.getElementById('bg-music') as HTMLAudioElement | null;
  if (!bgMusic || bgMusic.paused) return;
  const step = bgMusic.volume / 20; // 20 steps over ~2s
  const fade = setInterval(() => {
    if (bgMusic.volume > step) {
      bgMusic.volume = Math.max(0, bgMusic.volume - step);
    } else {
      bgMusic.volume = 0;
      bgMusic.pause();
      clearInterval(fade);
    }
  }, 100);
}

export function playBirthdayVideo(onDone: () => void): void {
  // Hard-stop music
  const bgMusic = document.getElementById('bg-music') as HTMLAudioElement | null;
  if (bgMusic) { bgMusic.muted = true; bgMusic.pause(); }

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: '#000',
    zIndex: '500', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    opacity: '0', transition: 'opacity 0.6s ease',
  });

  const video = document.createElement('video');
  video.src = '/video/birthday.mp4';
  video.playsInline = true;
  video.controls = false;
  Object.assign(video.style, {
    width: '100%', height: '100%', objectFit: 'contain', display: 'block',
  });

  const skipBtn = document.createElement('button');
  skipBtn.textContent = 'skip ›';
  Object.assign(skipBtn.style, {
    position: 'absolute', bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
    right: 'max(1.5rem, env(safe-area-inset-right))',
    background: 'rgba(255,255,255,0.15)', border: 'none',
    color: '#fff', fontFamily: 'inherit', fontSize: '0.85rem',
    padding: '0.5rem 1rem', borderRadius: '20px', cursor: 'pointer',
    letterSpacing: '0.05em',
  });

  const tapCue = document.createElement('p');
  Object.assign(tapCue.style, {
    position: 'absolute', bottom: '30%', left: '0', right: '0',
    textAlign: 'center', color: 'rgba(255,255,255,0.4)',
    fontFamily: 'inherit', fontSize: '0.8rem', letterSpacing: '0.12em',
    pointerEvents: 'none',
  });
  tapCue.textContent = 'tap to continue';

  overlay.append(video, tapCue, skipBtn);
  document.body.appendChild(overlay);

  const finish = () => {
    overlay.style.opacity = '0';
    if (bgMusic) { bgMusic.muted = false; bgMusic.volume = 0.28; bgMusic.play().catch(() => {}); }
    overlay.addEventListener('transitionend', () => {
      overlay.remove();
      onDone();
    }, { once: true });
  };

  // Tap anywhere on overlay → play (fallback if autoplay is blocked)
  overlay.style.cursor = 'pointer';
  overlay.addEventListener('click', () => {
    overlay.style.cursor = 'default';
    tapCue.style.display = 'none';
    video.play().catch(() => {});
  }, { once: true });

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    // Try autoplay immediately; hide cue if it works
    video.play().then(() => {
      tapCue.style.display = 'none';
      overlay.style.cursor = 'default';
    }).catch(() => {
      // Blocked — leave tap cue visible, wait for user tap
    });
  });

  video.addEventListener('ended', finish, { once: true });
  skipBtn.addEventListener('click', (e) => { e.stopPropagation(); finish(); }, { once: true });

  // If video file is missing, skip straight to onDone
  video.addEventListener('error', () => { overlay.remove(); onDone(); }, { once: true });
}

function fireworks(): void {
  if (typeof confetti === 'undefined') return;
  const colors = ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5', '#ffffff'];
  // Two simultaneous bursts from opposite sides
  confetti({ particleCount: 60, angle: 60,  spread: 70, origin: { x: 0, y: 0.6 }, colors, ticks: 200 });
  confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors, ticks: 200 });
}

export function fireConfetti(): void {
  if (typeof confetti === 'undefined') return;
  const colors = ['#F9DF6D', '#c9a84c', '#f5f5f5', '#A0C35A'];
  confetti({ particleCount: 30, spread: 60, origin: { y: 0.5 }, colors, ticks: 150 });
}
