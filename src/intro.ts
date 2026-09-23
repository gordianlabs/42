import { gsap } from 'gsap';

const LINES = [
  '&gt; DEEP THOUGHT v42.0',
  '&gt; Initializing consciousness...',
  '&gt; Computing the Answer to Life, the Universe, and Everything...',
  '&gt; ..........................................',
  '&gt; The Answer is: <strong>42</strong>',
  '&gt; Happy birthday, Mukta.',
];

export function runIntro(): Promise<void> {
  return new Promise((resolve) => {
    const introEl = document.getElementById('intro');
    const linesEl = document.getElementById('intro-lines');
    if (!introEl || !linesEl) { resolve(); return; }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const spans = LINES.map((text) => {
      const span = document.createElement('span');
      span.innerHTML = text;
      linesEl.appendChild(span);
      return span;
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      gsap.to(introEl, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
          introEl.style.display = 'none';
          resolve();
        },
      });
    };

    introEl.addEventListener('click', finish, { once: true });

    if (reduced) {
      spans.forEach((s) => (s.style.opacity = '1'));
      setTimeout(finish, 800);
      return;
    }

    const tl = gsap.timeline({ onComplete: () => setTimeout(finish, 1200) });
    tl.to(spans, {
      opacity: 1,
      duration: 0.05,
      stagger: 0.55,
      ease: 'none',
    });
  });
}
