// Email, Documents, Diary and Photos views. Each mount function fills a window body from
// content entries and returns { reset }, which puts the window back to its list view.

import { contentUrl, dateKey, escapeHtml, formatDate, plainText, renderText } from './content.js';

// A list that is swapped for a detail view (with a back button) when an item is opened.
function listDetail(body, { listClass, backLabel }) {
  const list = document.createElement('div');
  list.className = listClass;
  const detail = document.createElement('article');
  detail.className = 'detail-view';
  detail.hidden = true;
  body.append(list, detail);

  const showList = () => {
    detail.hidden = true;
    detail.replaceChildren();
    list.hidden = false;
    body.scrollTop = 0;
  };
  const showDetail = html => {
    detail.innerHTML = `<button class="back-button">← ${escapeHtml(backLabel)}</button>${html}`;
    detail.querySelector('.back-button').addEventListener('click', showList);
    list.hidden = true;
    detail.hidden = false;
    body.scrollTop = 0;
  };
  return { list, showList, showDetail };
}

function fileItem(label, icon, thumbnail) {
  const item = document.createElement('button');
  item.className = 'file-item';
  item.innerHTML = thumbnail
    ? `<img class="file-thumb" src="${escapeHtml(thumbnail)}" alt="">`
    : `<div class="icon-img ${escapeHtml(icon)}-icon"></div>`;
  const text = document.createElement('div');
  text.className = 'file-label';
  text.textContent = label;
  item.append(text);
  return item;
}

export function mountEmail(body, emails) {
  const view = listDetail(body, { listClass: 'email-list', backLabel: 'Back to Inbox' });
  const newestFirst = [...emails].sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)));

  for (const email of newestFirst) {
    const item = document.createElement('button');
    item.className = 'email-item';
    item.classList.toggle('unread', email.unread === true);
    const preview = email.preview ?? plainText(email.body).slice(0, 60) + '...';
    item.innerHTML = `
      <div class="email-sender">${escapeHtml(email.fromName ?? email.from)}</div>
      <div class="email-subject">${escapeHtml(email.subject)}</div>
      <div class="email-preview">${escapeHtml(preview)}</div>`;
    item.addEventListener('click', () => {
      item.classList.remove('unread');
      view.showDetail(`
        <div class="detail-header">
          <div class="email-from">From: ${escapeHtml(email.from)}</div>
          ${email.to ? `<div class="email-from">To: ${escapeHtml(email.to)}</div>` : ''}
          <div class="detail-title">${escapeHtml(email.subject)}</div>
          <div class="detail-date">${escapeHtml(formatDate(email.date))}</div>
        </div>
        <div class="email-body">${renderText(email.body)}</div>`);
    });
    view.list.append(item);
  }
  return { reset: view.showList };
}

export function mountDocuments(body, documents) {
  const view = listDetail(body, { listClass: 'file-list', backLabel: 'Back to Files' });

  for (const doc of documents) {
    const item = fileItem(doc.name ?? doc.title ?? doc.id, doc.icon ?? 'text');
    item.addEventListener('click', () => {
      const subtitle = doc.subtitle ?? (doc.date ? `Last modified: ${formatDate(doc.date, { time: false })}` : '');
      view.showDetail(`
        <div class="detail-header">
          <div class="detail-title">${escapeHtml(doc.title ?? doc.name)}</div>
          <div class="detail-date">${escapeHtml(subtitle)}</div>
        </div>
        ${doc.banner ? `<div class="classified">${escapeHtml(doc.banner)}</div>` : ''}
        <div class="document-body">${renderText(doc.body)}</div>`);
    });
    view.list.append(item);
  }
  return { reset: view.showList };
}

export function mountDiary(body, entries) {
  const oldestFirst = [...entries].sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)));
  body.innerHTML = oldestFirst.map(entry => `
    <div class="diary-entry">
      <div class="diary-date">${escapeHtml(formatDate(entry.date, { time: false }))}</div>
      <div class="diary-text">${renderText(entry.body)}</div>
    </div>`).join('');
  return { reset: () => { body.scrollTop = 0; } };
}

export function mountPhotos(body, photos, emptyText) {
  const view = listDetail(body, { listClass: 'photos-list', backLabel: 'Back to Photos' });
  if (emptyText) {
    view.list.innerHTML = `<div class="photos-intro"><p>📷</p><p>${escapeHtml(emptyText)}</p></div>`;
  }
  const grid = document.createElement('div');
  grid.className = 'file-list';
  view.list.append(grid);

  for (const photo of photos) {
    const image = photo.image ? contentUrl(photo.folder, photo.image) : null;
    const item = fileItem(photo.name ?? photo.title ?? photo.id, photo.icon ?? 'photo', image);
    item.addEventListener('click', () => {
      view.showDetail(`
        <div class="detail-header">
          <div class="detail-title">${escapeHtml(photo.title ?? photo.name)}</div>
          ${photo.date ? `<div class="detail-date">${escapeHtml(formatDate(photo.date))}</div>` : ''}
        </div>
        ${image ? `<img class="photo-full" src="${escapeHtml(image)}" alt="${escapeHtml(photo.name ?? '')}">` : ''}
        <div class="photo-caption">${renderText(photo.body)}</div>`);
    });
    grid.append(item);
  }
  return { reset: view.showList };
}
