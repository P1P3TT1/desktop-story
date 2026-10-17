// Boots the desktop: loads the story content, builds the icons, windows, start menu and clock.

import { loadContent } from './content.js';
import { createWindow, initWindows, openWindow } from './windows.js';
import { mountDiary, mountDocuments, mountEmail, mountPhotos } from './apps.js';
import { mountBrowser } from './browser.js';

// Desktop apps in icon order. Labels and window titles come from content/story.json.
const APPS = [
  { id: 'email', icon: 'email', width: 600, height: 500, left: '10%', top: '10%',
    mount: (body, { sections }) => mountEmail(body, sections.emails ?? []) },
  { id: 'documents', icon: 'folder', width: 500, height: 400, left: '15%', top: '15%',
    mount: (body, { sections }) => mountDocuments(body, sections.documents ?? []) },
  { id: 'diary', icon: 'text', width: 600, height: 450, left: '20%', top: '20%',
    mount: (body, { sections }) => mountDiary(body, sections.diary ?? []) },
  { id: 'photos', icon: 'photo', width: 500, height: 400, left: '25%', top: '25%',
    mount: (body, { sections, story }) => mountPhotos(body, sections.photos ?? [], story.apps?.photos?.emptyText) },
  { id: 'browser', icon: 'browser', width: 800, height: 600, left: '8%', top: '8%', bodyClass: 'browser-body',
    mount: (body, { sections, story }) =>
      mountBrowser(body, { sites: sections['web/sites'] ?? [], results: sections['web/search'] ?? [], story }) },
];

async function boot() {
  const content = await loadContent();
  const { story } = content;
  if (story.title) document.title = story.title;

  initWindows(document.getElementById('task-buttons'));
  const desktop = document.getElementById('desktop');
  const startMenu = document.getElementById('start-menu');
  const views = {};

  for (const app of APPS) {
    const settings = story.apps?.[app.id] ?? {};
    const label = settings.label ?? app.id;
    let view;
    const body = createWindow(app.id, {
      title: settings.title ?? label,
      width: app.width,
      height: app.height,
      left: app.left,
      top: app.top,
      bodyClass: app.bodyClass,
      onClose: () => view?.reset(),
    });
    view = views[app.id] = app.mount(body, content);

    desktop.append(desktopIcon(app, label));
    const menuItem = document.createElement('button');
    menuItem.className = 'start-menu-item';
    menuItem.innerHTML = `<span class="icon-img ${app.icon}-icon"></span>`;
    menuItem.append(label);
    menuItem.addEventListener('click', () => {
      toggleStartMenu(false);
      openWindow(app.id);
    });
    startMenu.append(menuItem);
  }

  // [text](url) links in any content, and search results, open in the story's browser.
  document.addEventListener('click', event => {
    const link = event.target.closest('.story-link');
    if (!link) return;
    event.preventDefault();
    openWindow('browser');
    views.browser.navigate(link.dataset.url);
  });

  initStartMenu();
  startClock(story.clockStart);
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

const startButton = document.getElementById('start-button');
const startMenuElement = document.getElementById('start-menu');

function toggleStartMenu(show = startMenuElement.hidden) {
  startMenuElement.hidden = !show;
  startButton.setAttribute('aria-expanded', String(show));
}

function initStartMenu() {
  startButton.addEventListener('click', () => toggleStartMenu());
  document.addEventListener('pointerdown', event => {
    if (!startMenuElement.hidden && !event.target.closest('#start-menu, #start-button')) toggleStartMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') toggleStartMenu(false);
  });
}

// The clock starts at the story's moment (story.json "clockStart") and keeps ticking from there.
function startClock(clockStart) {
  const clock = document.getElementById('clock');
  const start = clockStart ? new Date(clockStart) : null;
  const offset = start && !isNaN(start) ? start.getTime() - Date.now() : 0;
  const tick = () => {
    const now = new Date(Date.now() + offset);
    clock.innerHTML = `
      <span>${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span>${now.toLocaleDateString()}</span>`;
  };
  tick();
  setInterval(tick, 1000);
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
