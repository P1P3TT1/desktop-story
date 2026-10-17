// Plays an ending from content/endings/: the desktop glitches, then the ending text appears
// paragraph by paragraph on a black screen. Click or press a key to show it all at once.

import { escapeHtml, renderText } from './content.js';

const GLITCH_MS = 1600;

export async function playEnding(ending, { glitch = true, onRestart, onDismiss }) {
  if (glitch) {
    document.body.classList.add('glitching');
    await wait(GLITCH_MS);
    document.body.classList.remove('glitching');
  }

  const overlay = document.createElement('div');
  overlay.className = 'ending';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', ending.title ?? 'Ending');
  overlay.innerHTML = `
    <div class="ending-screen">
      <div class="ending-text"></div>
      <div class="ending-final" hidden>
        <h1 class="ending-title">${escapeHtml(ending.title ?? 'THE END')}</h1>
        <div class="ending-actions">
          <button class="ending-button" data-action="restart">Restart story</button>
          <button class="ending-button secondary" data-action="dismiss">Keep exploring</button>
        </div>
      </div>
    </div>`;
  document.body.append(overlay);

  const text = overlay.querySelector('.ending-text');
  const final = overlay.querySelector('.ending-final');
  const paragraphs = String(ending.body ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  let skipped = !glitch; // when an ending is shown again after a reload, show it all at once
  let wake = null;
  const skip = () => {
    skipped = true;
    wake?.();
  };
  overlay.addEventListener('click', skip);
  document.addEventListener('keydown', skip);

  for (const paragraph of paragraphs) {
    const p = document.createElement('p');
    p.innerHTML = renderText(paragraph);
    text.append(p);
    if (!skipped) {
      p.scrollIntoView({ block: 'end', behavior: 'smooth' });
      await new Promise(resolve => {
        wake = resolve;
        setTimeout(resolve, Math.min(Math.max(paragraph.length * 35, 1200), 4500));
      });
    }
  }
  overlay.removeEventListener('click', skip);
  document.removeEventListener('keydown', skip);
  final.hidden = false;
  final.querySelector('.ending-button').focus();

  overlay.querySelector('[data-action="restart"]').addEventListener('click', () => onRestart?.());
  overlay.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
    overlay.remove();
    onDismiss?.();
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
