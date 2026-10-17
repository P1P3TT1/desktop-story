// Boots the desktop: loads the story content, builds the icons, windows, start menu and clock,
// and connects reader progress to notifications and endings.
//
// URL flags for testing a story while writing it:
//   ?debug  everything unlocked, nothing saved, endings playable from the Start menu
//   ?fast   new content arrives immediately instead of after its "delay"

import { escapeHtml, loadContent } from './content.js';
import { createWindow, initWindows, openWindow, setBadge } from './windows.js';
import { mountDiary, mountEmail, mountFiles, renderDocument, renderPhoto } from './apps.js';
import { mountBrowser } from './browser.js';
import { createProgress } from './progress.js';
import { startClock } from './clock.js';
import { notify } from './notify.js';
import { playEnding } from './ending.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const FAST = params.has('fast');

// Desktop apps in icon order. Labels and window titles come from content/story.json.
const APPS = [
  { id: 'email', icon: 'email', width: 600, height: 500, left: '10%', top: '10%',
    mount: (body, { sections, progress, setUnread }) =>
      mountEmail(body, { entries: sections.emails ?? [], progress, onUnreadCount: setUnread }) },
  { id: 'documents', icon: 'folder', width: 500, height: 400, left: '15%', top: '15%',
    mount: (body, { sections, progress }) => mountFiles(body, {
      entries: sections.documents ?? [], sections, progress,
      defaultIcon: 'text', backLabel: 'Back to Files', renderFile: renderDocument,
    }) },
  { id: 'diary', icon: 'text', width: 600, height: 450, left: '20%', top: '20%',
    mount: (body, { sections, progress }) => mountDiary(body, { entries: sections.diary ?? [], progress }) },
  { id: 'photos', icon: 'photo', width: 500, height: 400, left: '25%', top: '25%',
    mount: (body, { sections, progress, settings }) => mountFiles(body, {
      entries: sections.photos ?? [], sections, progress,
      defaultIcon: 'photo', backLabel: 'Back to Photos', renderFile: renderPhoto,
      intro: settings.emptyText ? `<p>📷</p><p>${escapeHtml(settings.emptyText)}</p>` : '',
    }) },
  { id: 'browser', icon: 'browser', width: 800, height: 600, left: '8%', top: '8%', bodyClass: 'browser-body',
    mount: (body, { sections, story, progress }) => mountBrowser(body, {
      sites: sections['web/sites'] ?? [], results: sections['web/search'] ?? [], story, progress,
    }) },
];

// How newly unlocked items are announced. Websites and search results arrive silently;
// they're for the reader to find.
const ANNOUNCEMENTS = {
  documents: { icon: '📁', title: 'New file in Documents', app: 'documents' },
  photos: { icon: '🖼️', title: 'New in Photos', app: 'photos' },
  diary: { icon: '📔', title: 'New diary entry', app: 'diary' },
};

const startButton = document.getElementById('start-button');
const startMenu = document.getElementById('start-menu');

async function boot() {
  const { story, sections } = await loadContent();
  if (story.title) document.title = story.title;
  startClock(document.getElementById('clock'), story.clockStart);

  const allEntries = Object.values(sections).flat();
  const endings = sections.endings ?? [];
  const progress = createProgress(allEntries, {
    storageKey: `desktop-story:${story.title ?? 'story'}`,
    debug: DEBUG,
    fast: FAST,
  });

  initWindows(document.getElementById('task-buttons'));
  const desktop = document.getElementById('desktop');
  const icons = {};
  const views = {};

  for (const app of APPS) {
    const settings = story.apps?.[app.id] ?? {};
    const label = settings.label ?? app.id;
    icons[app.id] = desktop.appendChild(desktopIcon(app, label));
    const body = createWindow(app.id, {
      title: settings.title ?? label,
      width: app.width,
      height: app.height,
      left: app.left,
      top: app.top,
      bodyClass: app.bodyClass,
      onOpen: () => views[app.id]?.onOpen?.(),
      onClose: () => views[app.id]?.reset(),
    });
    const setUnread = count => {
      setBadge(app.id, count);
      if (count > 0) icons[app.id].dataset.badge = count;
      else delete icons[app.id].dataset.badge;
    };
    views[app.id] = app.mount(body, { sections, story, progress, settings, setUnread });
  }

  function showEnding(ending, { glitch }) {
    progress.setEnding(ending.id);
    playEnding(ending, {
      glitch,
      onRestart: restart,
      onDismiss: () => progress.setEnding(ending.id, { dismissed: true }),
    });
  }

  function restart() {
    progress.reset();
    location.reload();
  }

  progress.onArrive(entry => {
    const section = entry.folder.split('/')[0];
    if (section === 'endings') {
      if (!progress.ending) showEnding(entry, { glitch: true });
    } else if (section === 'emails') {
      notify({
        icon: '📧',
        title: `New email from ${entry.fromName ?? entry.from}`,
        text: entry.subject ?? '',
        onClick: () => {
          openWindow('email');
          views.email.show(entry.id);
        },
      });
    } else if (ANNOUNCEMENTS[section]) {
      const { icon, title, app } = ANNOUNCEMENTS[section];
      notify({ icon, title, text: entry.name ?? entry.title ?? '', onClick: () => openWindow(app) });
    }
  });

  // [text](url) links in any content, and search results, open in the story's browser.
  document.addEventListener('click', event => {
    const link = event.target.closest('.story-link');
    if (!link) return;
    event.preventDefault();
    openWindow('browser');
    views.browser.navigate(link.dataset.url);
  });

  initStartMenu(() => {
    const items = APPS.map(app => menuItem(story.apps?.[app.id]?.label ?? app.id, app.icon, () => openWindow(app.id)));
    items.push(separator());
    const reached = endings.find(ending => ending.id === progress.ending);
    if (reached) items.push(menuItem('Replay ending', null, () => showEnding(reached, { glitch: true })));
    if (DEBUG) {
      endings.forEach(ending => items.push(menuItem(`▶ ${ending.title ?? ending.slug}`, null, () => showEnding(ending, { glitch: true }))));
    }
    items.push(restartItem(restart));
    return items;
  });

  if (DEBUG) {
    document.querySelector('.taskbar').insertAdjacentHTML('beforeend',
      '<span class="debug-tag" title="Everything is unlocked and progress is not saved">DEBUG</span>');
  }

  const reached = endings.find(ending => ending.id === progress.ending);
  if (reached && !progress.endingDismissed) showEnding(reached, { glitch: false });
  progress.start();
}

// Double-click (or Enter/Space, or a single tap on touch screens) opens an app.
function desktopIcon(app, label) {
  const icon = document.createElement('button');
  icon.className = 'desktop-icon';
  icon.innerHTML = `<div class="icon-img ${app.icon}-icon"></div><div class="icon-text"></div>`;
  icon.querySelector('.icon-text').textContent = label;
  let pointerType = 'mouse';
  icon.addEventListener('pointerdown', event => { pointerType = event.pointerType; });
  icon.addEventListener('click', event => {
    if (event.detail === 0 || pointerType !== 'mouse') openWindow(app.id);
  });
  icon.addEventListener('dblclick', () => openWindow(app.id));
  return icon;
}

function menuItem(label, icon, action) {
  const item = document.createElement('button');
  item.className = 'start-menu-item';
  item.innerHTML = icon ? `<span class="icon-img ${icon}-icon"></span>` : '<span class="menu-spacer"></span>';
  item.append(label);
  item.addEventListener('click', () => {
    toggleStartMenu(false);
    action();
  });
  return item;
}

function separator() {
  const line = document.createElement('div');
  line.className = 'start-menu-separator';
  return line;
}

// Restarting erases progress, so it asks for a second click.
function restartItem(restart) {
  const item = document.createElement('button');
  item.className = 'start-menu-item danger';
  item.innerHTML = '<span class="menu-spacer"></span>Restart story';
  item.addEventListener('click', () => {
    if (item.dataset.confirm) {
      restart();
      return;
    }
    item.dataset.confirm = 'true';
    item.lastChild.textContent = 'Click again to erase progress';
  });
  return item;
}

function toggleStartMenu(show = startMenu.hidden, buildItems) {
  if (show && buildItems) startMenu.replaceChildren(...buildItems());
  startMenu.hidden = !show;
  startButton.setAttribute('aria-expanded', String(show));
}

function initStartMenu(buildItems) {
  startButton.addEventListener('click', () => toggleStartMenu(startMenu.hidden, buildItems));
  document.addEventListener('pointerdown', event => {
    if (!startMenu.hidden && !event.target.closest('#start-menu, #start-button')) toggleStartMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') toggleStartMenu(false);
  });
}

// (Opening index.html from disk is handled by the inline script in index.html, since modules can't load there.)
function showBootError(error) {
  console.error(error);
  const overlay = document.createElement('div');
  overlay.className = 'boot-error';
  overlay.innerHTML = `<h2>The story couldn't be loaded</h2><p></p>`;
  overlay.querySelector('p').textContent = error.message;
  document.body.append(overlay);
}

boot().catch(showBootError);
