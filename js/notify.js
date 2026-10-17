// Pop-up notifications in the bottom-right corner ("📧 New email from Mom").

import { escapeHtml } from './content.js';

const VISIBLE_MS = 8000;

export function notify({ icon, title, text, onClick }) {
  let area = document.getElementById('toasts');
  if (!area) {
    area = document.createElement('div');
    area.id = 'toasts';
    area.className = 'toasts';
    area.setAttribute('aria-live', 'polite');
    document.body.append(area);
  }

  const toast = document.createElement('button');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="toast-icon">${escapeHtml(icon)}</span>
    <span class="toast-text"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></span>`;
  const dismiss = () => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  };
  toast.addEventListener('click', () => {
    onClick?.();
    dismiss();
  });
  area.append(toast);
  setTimeout(dismiss, VISIBLE_MS);
}
