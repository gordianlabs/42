interface Caption {
  photo: string;
  caption: string;
}

type OnReveal = (index: number) => void;

const hasVT = 'startViewTransition' in document;

function openModalFallback(
  index: number,
  caption: Caption,
  onClose: () => void
): void {
  const modal = buildModal(index, caption, onClose);
  document.body.appendChild(modal);
  modal.getBoundingClientRect();
}

function buildModal(
  index: number,
  caption: Caption,
  onClose: () => void
): HTMLElement {
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
  img.style.viewTransitionName = `vt-tile-${index}`;

  const cap = document.createElement('p');
  cap.className = 'modal-caption';
  cap.textContent = caption.caption;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';

  inner.append(img, cap);
  modal.append(inner, closeBtn);

  const closeModal = () => {
    modal.classList.add('closing');
    modal.addEventListener('animationend', () => {
      modal.remove();
      onClose();
    }, { once: true });
  };

  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  return modal;
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

  // Preload image
  new Image().src = `/photos/${caption.photo}`;

  const doReveal = () => {
    revealed[index] = true;
    onReveal(index);
  };

  const afterClose = () => {
    doReveal();
  };

  if (!hasVT) {
    // Fallback: show modal with CSS fade, then flip tile on close
    openModalFallback(index, caption, () => {
      tile.classList.add('no-transition', 'revealed');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => tile.classList.remove('no-transition'));
      });
      afterClose();
    });
    return;
  }

  // View Transitions path — open
  tile.style.viewTransitionName = `vt-tile-${index}`;

  let modal: HTMLElement;

  const openTransition = document.startViewTransition(() => {
    tile.style.viewTransitionName = '';
    tile.dataset['opening'] = '';

    modal = buildModal(index, caption, () => {
      // Close with View Transition
      const closeTransition = document.startViewTransition(() => {
        tile.classList.add('no-transition', 'revealed');
        tile.style.viewTransitionName = `vt-tile-${index}`;
        modal.remove();
      });

      closeTransition.finished.then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            tile.classList.remove('no-transition');
            tile.style.viewTransitionName = '';
          });
        });
        afterClose();
      }).catch(() => {
        tile.classList.remove('no-transition');
        tile.style.viewTransitionName = '';
        afterClose();
      });
    });

    document.body.appendChild(modal);
  });

  openTransition.finished.then(() => {
    delete tile.dataset['opening'];
  }).catch(() => {
    delete tile.dataset['opening'];
  });
}
