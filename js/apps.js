// Email, Documents, Diary and Photos views. Each mount function fills a window body from
// content entries and returns { reset, ... }; reset puts the window back to its list view.
// Lists only show entries the reader has unlocked, and are rebuilt whenever progress changes.

import { contentUrl, dateKey, escapeHtml, formatDate, parseChoices, plainText, renderText } from './content.js';
import { renderLock } from './lock.js';

// A list view plus a stack of detail pages, each with a back button to the previous level.
function pageStack(body, { rootClass, backLabel }) {
  const root = document.createElement('div');
  root.className = rootClass;
  const detail = document.createElement('article');
  detail.className = 'detail-view';
  detail.hidden = true;
  body.append(root, detail);
  const stack = [];

  function show() {
    const page = stack.at(-1);
    root.hidden = Boolean(page);
    detail.hidden = !page;
    detail.replaceChildren();
    if (page) {
      const back = document.createElement('button');
      back.className = 'back-button';
      back.textContent = `← ${stack.length > 1 ? `Back to ${stack.at(-2).title}` : backLabel}`;
      back.addEventListener('click', () => {
        stack.pop();
        show();
      });
      const content = document.createElement('div');
      detail.append(back, content);
      page.render(content);
    }
    body.scrollTop = 0;
  }

  return {
    root,
    open(page) {
      stack.push(page);
      show();
    },
    rerender: show,
    reset() {
      stack.length = 0;
      show();
    },
  };
}

// Opens an entry as a page: shows the password prompt while it's locked, otherwise marks it
// as seen and renders it.
function openEntry(view, entry, progress, render) {
  view.open({
    title: entry.name ?? entry.title ?? entry.slug,
    render(container) {
      if (progress.isLocked(entry)) {
        renderLock(container, entry, progress, () => view.rerender());
        return;
      }
      progress.markSeen(entry.id);
      render(container);
    },
  });
}

function fileItem(entry, { icon, thumbnail, locked }) {
  const item = document.createElement('button');
  item.className = 'file-item';
  item.innerHTML = thumbnail
    ? `<img class="file-thumb" src="${escapeHtml(thumbnail)}" alt="">`
    : `<div class="icon-img ${escapeHtml(icon)}-icon"></div>`;
  if (locked) item.insertAdjacentHTML('beforeend', '<span class="lock-badge" title="Locked">🔒</span>');
  const label = document.createElement('div');
  label.className = 'file-label';
  label.textContent = entry.name ?? entry.title ?? entry.slug;
  item.append(label);
  return item;
}

export function mountEmail(body, { entries, progress, onUnreadCount }) {
  const view = pageStack(body, { rootClass: 'email-list', backLabel: 'Back to Inbox' });
  const dateOf = email => email.date ?? progress.arrivedAt(email.id);
  const isUnread = email => (email.unread === true || progress.arrivedAt(email.id) !== null) && !progress.isSeen(email.id);

  function open(email) {
    openEntry(view, email, progress, container => {
      container.innerHTML = `
        <div class="detail-header">
          <div class="email-from">From: ${escapeHtml(email.from)}</div>
          ${email.to ? `<div class="email-from">To: ${escapeHtml(email.to)}</div>` : ''}
          <div class="detail-title">${escapeHtml(email.subject)}</div>
          <div class="detail-date">${escapeHtml(formatDate(dateOf(email)))}</div>
        </div>
        <div class="email-body">${renderText(email.body)}</div>`;
      renderChoices(container, email);
    });
  }

  // Reply buttons for emails with "choices". The reader can answer once.
  function renderChoices(container, email) {
    const choices = parseChoices(email.choices);
    if (!choices.length) return;
    const box = document.createElement('div');
    box.className = 'email-choices';
    const chosen = choices.find(choice => choice.value === progress.choiceOf(email.id));
    if (chosen) {
      box.innerHTML = `<div class="choice-made">You replied: <strong>${escapeHtml(chosen.label)}</strong></div>`;
    } else {
      box.innerHTML = '<div class="choice-prompt">Reply:</div>';
      for (const choice of choices) {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.textContent = choice.label;
        button.addEventListener('click', () => {
          progress.choose(email.id, choice.value);
          view.rerender();
        });
        box.append(button);
      }
    }
    container.append(box);
  }

  function rebuild() {
    const visible = entries.filter(progress.isAvailable).sort((a, b) =>
      dateKey(dateOf(b)).localeCompare(dateKey(dateOf(a))) || progress.arrivalOrder(b.id) - progress.arrivalOrder(a.id));
    view.root.replaceChildren(...visible.map(email => {
      const item = document.createElement('button');
      item.className = 'email-item';
      item.classList.toggle('unread', isUnread(email));
      const preview = email.preview ?? plainText(email.body).slice(0, 60) + '...';
      item.innerHTML = `
        <div class="email-sender">${escapeHtml(email.fromName ?? email.from)}</div>
        <div class="email-subject">${escapeHtml(email.subject)}</div>
        <div class="email-preview">${escapeHtml(preview)}</div>`;
      item.addEventListener('click', () => open(email));
      return item;
    }));
    onUnreadCount?.(visible.filter(isUnread).length);
  }

  rebuild();
  progress.onChange(rebuild);
  return {
    reset: view.reset,
    show(id) {
      const email = entries.find(entry => entry.id === id);
      view.reset();
      if (email) open(email);
    },
  };
}

// Documents and Photos: a grid of files. An entry with "opens: <subfolder>" is a folder that
// lists the files in content/<folder>/<subfolder>/.
export function mountFiles(body, { entries, sections, progress, defaultIcon, backLabel, intro, renderFile }) {
  const view = pageStack(body, { rootClass: 'files-root', backLabel });

  function grid(items) {
    const list = document.createElement('div');
    list.className = 'file-list';
    for (const entry of items.filter(progress.isAvailable)) {
      const thumbnail = entry.image ? contentUrl(entry.folder, entry.image) : null;
      const icon = entry.icon ?? (entry.opens ? 'folder' : defaultIcon);
      const item = fileItem(entry, { icon, thumbnail, locked: progress.isLocked(entry) });
      item.addEventListener('click', () => openEntry(view, entry, progress, container => {
        if (entry.opens) renderFolder(container, entry);
        else renderFile(container, entry);
      }));
      list.append(item);
    }
    return list;
  }

  function renderFolder(container, folder) {
    container.innerHTML = `
      <div class="detail-header"><div class="detail-title">📁 ${escapeHtml(folder.title ?? folder.name)}</div></div>
      ${folder.body ? `<p class="folder-intro">${renderText(folder.body)}</p>` : ''}`;
    container.append(grid(sections[`${folder.folder}/${folder.opens}`] ?? []));
  }

  function rebuild() {
    view.root.innerHTML = intro ? `<div class="files-intro">${intro}</div>` : '';
    view.root.append(grid(entries));
  }

  rebuild();
  progress.onChange(rebuild);
  return { reset: view.reset };
}

export function renderDocument(container, doc) {
  const subtitle = doc.subtitle ?? (doc.date ? `Last modified: ${formatDate(doc.date, { time: false })}` : '');
  container.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">${escapeHtml(doc.title ?? doc.name)}</div>
      <div class="detail-date">${escapeHtml(subtitle)}</div>
    </div>
    ${doc.banner ? `<div class="classified">${escapeHtml(doc.banner)}</div>` : ''}
    <div class="document-body">${renderText(doc.body)}</div>`;
}

export function renderPhoto(container, photo) {
  const image = photo.image ? contentUrl(photo.folder, photo.image) : null;
  container.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">${escapeHtml(photo.title ?? photo.name)}</div>
      ${photo.date ? `<div class="detail-date">${escapeHtml(formatDate(photo.date))}</div>` : ''}
    </div>
    ${image ? `<img class="photo-full" src="${escapeHtml(image)}" alt="${escapeHtml(photo.name ?? '')}">` : ''}
    <div class="photo-caption">${renderText(photo.body)}</div>`;
}

// The diary shows every unlocked entry at once; opening the window marks them all as read.
export function mountDiary(body, { entries, progress }) {
  const visible = () => entries.filter(progress.isAvailable)
    .sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)));

  function rebuild() {
    body.innerHTML = visible().map(entry => `
      <div class="diary-entry">
        <div class="diary-date">${escapeHtml(formatDate(entry.date, { time: false }))}</div>
        <div class="diary-text">${renderText(entry.body)}</div>
      </div>`).join('');
  }

  rebuild();
  progress.onChange(rebuild);
  return {
    reset: () => { body.scrollTop = 0; },
    onOpen: () => visible().forEach(entry => progress.markSeen(entry.id)),
  };
}
