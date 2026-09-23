import { gsap } from 'gsap';

declare const confetti: ((opts: Record<string, unknown>) => void) | undefined;

export function triggerFinale(lastIndex: number, tileEls: HTMLElement[]): void {
  const COLS = 6;
  const grid = document.getElementById('grid')!;
  const finaleMsg = document.getElementById('finale-message')!;

  const lastCol = lastIndex % COLS;
  const lastRow = Math.floor(lastIndex / COLS);

  // Sort tiles by distance from last-tapped tile
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
    finaleMsg.classList.add('visible');
    return;
  }

  // Ripple pulse from last tile outward
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
            finaleMsg.classList.add('visible');
            fireConfetti();
          },
        }
      );
    },
  });

  tl.to(
    sorted.map((s) => s.el),
    {
      scale: 1.06,
      duration: 0.25,
      stagger: {
        each: 0.04,
        ease: 'power1.in',
      },
      ease: 'power1.out',
    }
  ).to(
    sorted.map((s) => s.el),
    {
      scale: 1,
      duration: 0.35,
      stagger: {
        each: 0.04,
        ease: 'power1.in',
      },
      ease: 'power2.out',
    },
    '-=0.2'
  );
}

function fireConfetti(): void {
  if (typeof confetti === 'undefined') return;
  const colors = ['#c9a84c', '#f5f5f5', '#8B0000', '#3D0000'];
  confetti({
    particleCount: 20,
    spread: 55,
    origin: { y: 0.6 },
    colors,
    ticks: 120,
  });
}
