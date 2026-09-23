// Soft chime for re-opening an already-revealed tile
function playChimeSound(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {}
}

// Synthesise a short card-flip "thwack" — no audio file needed
function playFlipSound(): void {
  try {
    const ctx = new AudioContext();
    const sampleRate = ctx.sampleRate;
    const dur = 0.14;
    const buf = ctx.createBuffer(1, Math.floor(sampleRate * dur), sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // White noise shaped by a fast exponential decay
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 4) * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
  } catch {}
}

export function setTilePhoto(back: HTMLElement, photo: string): void {
  const tile = back.parentElement as HTMLElement;

  let img = back.querySelector<HTMLImageElement>('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = '';
    img.style.cssText = 'object-fit:cover;display:block;position:absolute;top:0;left:0;';
    back.appendChild(img);
  }
  img.src = `/photos/${photo}`;

  // Stamp explicit pixel dimensions so object-fit:cover is unambiguous in any browser
  const stamp = () => {
    const w = tile.offsetWidth;
    const h = tile.offsetHeight;
    if (w > 0 && h > 0 && img) {
      img.style.width  = w + 'px';
      img.style.height = h + 'px';
    }
  };

  stamp();
  // Re-stamp after image loads in case it triggered a reflow
  img.addEventListener('load', stamp, { once: true });
}

interface Caption {
  photo: string;
  caption: string;
}

type OnReveal = (index: number) => void;

function buildModal(caption: Caption): HTMLElement {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const inner = document.createElement('div');
  inner.className = 'modal-inner';

  const img = document.createElement('img');
  img.className = 'modal-photo';
  img.src = `/photos/${caption.photo}`;
  img.alt = caption.caption;

  const cap = document.createElement('p');
  cap.className = 'modal-caption';
  cap.textContent = caption.caption;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';

  inner.append(img, cap);
  modal.append(inner, closeBtn);
  return modal;
}

// Compute the CSS transform to make a full-screen element appear at the tile's rect
function tileTransform(rect: DOMRect): string {
  const scaleX = rect.width / window.innerWidth;
  const scaleY = rect.height / window.innerHeight;
  const tx = rect.left + rect.width / 2 - window.innerWidth / 2;
  const ty = rect.top + rect.height / 2 - window.innerHeight / 2;
  return `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`;
}

export function handleTileClick(
  index: number,
  tile: HTMLElement,
  _tileEls: HTMLElement[],
  revealed: boolean[],
  captions: Caption[],
  onReveal: OnReveal
): void {
  if (revealed[index]) return;

  const caption = captions[index];
  if (!caption) return;

  const back = tile.querySelector<HTMLElement>('.tile-back')!;

  // Set back face to this tile's photo — stays here permanently after reveal
  setTilePhoto(back, caption.photo);

  // Preload
  new Image().src = `/photos/${caption.photo}`;

  // Step 1: flip the tile (CSS 3D rotateY, ~450ms)
  playFlipSound();
  tile.classList.add('revealed');

  // Step 2: after the flip's first half, expand the modal from the tile's position
  setTimeout(() => {
    const rect = tile.getBoundingClientRect();
    const modal = buildModal(caption);

    // Start at tile size/position using GPU transform
    modal.style.transform = tileTransform(rect);
    modal.style.borderRadius = '8px';
    document.body.appendChild(modal);
    tile.dataset['opening'] = '';

    // Force paint, then animate to full screen
    modal.getBoundingClientRect();
    modal.style.transition =
      'transform 360ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 360ms ease';
    modal.style.transform = '';
    modal.style.borderRadius = '0';

    // Fade in caption + close after expansion
    modal.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'transform') modal.classList.add('expanded');
    }, { once: true });

    const closeModal = () => {
      document.removeEventListener('keydown', onEsc);
      modal.classList.remove('expanded');

      const closeRect = tile.getBoundingClientRect();
      modal.style.transition =
        'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms ease';
      modal.style.transform = tileTransform(closeRect);
      modal.style.borderRadius = '8px';

      modal.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'transform') return;
        modal.remove();
        delete tile.dataset['opening'];
        revealed[index] = true;
        onReveal(index);
      }, { once: true });
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onEsc);

    modal.querySelector('.modal-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }, 280); // halfway through the flip (~280ms)
}

// Re-open an already-revealed tile (no flip, no state change)
export function reopenTile(
  index: number,
  tile: HTMLElement,
  captions: Caption[]
): void {
  const caption = captions[index];
  if (!caption) return;

  playChimeSound();

  const rect = tile.getBoundingClientRect();
  const modal = buildModal(caption);

  modal.style.transform = tileTransform(rect);
  modal.style.borderRadius = '8px';
  document.body.appendChild(modal);
  tile.dataset['opening'] = '';

  modal.getBoundingClientRect();
  modal.style.transition =
    'transform 360ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 360ms ease';
  modal.style.transform = '';
  modal.style.borderRadius = '0';

  modal.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform') modal.classList.add('expanded');
  }, { once: true });

  const closeModal = () => {
    document.removeEventListener('keydown', onEsc);
    modal.classList.remove('expanded');
    const closeRect = tile.getBoundingClientRect();
    modal.style.transition =
      'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 300ms ease';
    modal.style.transform = tileTransform(closeRect);
    modal.style.borderRadius = '8px';
    modal.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return;
      modal.remove();
      delete tile.dataset['opening'];
    }, { once: true });
  };

  const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onEsc);
  modal.querySelector('.modal-close')?.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}
