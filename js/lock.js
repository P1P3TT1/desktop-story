// Password prompt shown in place of a locked item (a file, folder or website).

import { escapeHtml } from './content.js';

export function renderLock(container, entry, progress, onUnlock) {
  container.innerHTML = `
    <div class="lock-view">
      <div class="lock-icon">🔒</div>
      <div class="detail-title">${escapeHtml(entry.title ?? entry.name ?? entry.slug)}</div>
      <p>This item is password protected.</p>
      ${entry.hint ? `<p class="lock-hint">Hint: ${escapeHtml(entry.hint)}</p>` : ''}
      <form class="lock-form">
        <input type="password" class="lock-input" aria-label="Password" placeholder="Password" autocomplete="off">
        <button class="action-button">Unlock</button>
      </form>
      <div class="lock-error" role="alert" hidden>Incorrect password</div>
    </div>`;

  const input = container.querySelector('.lock-input');
  const error = container.querySelector('.lock-error');
  container.querySelector('.lock-form').addEventListener('submit', event => {
    event.preventDefault();
    if (progress.tryPassword(entry, input.value)) {
      onUnlock();
      return;
    }
    error.hidden = false;
    input.classList.remove('shake');
    void input.offsetWidth; // restart the shake animation
    input.classList.add('shake');
    input.select();
  });
  input.focus({ preventScroll: true });
}
