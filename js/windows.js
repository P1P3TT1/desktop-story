// Window manager: creating, focusing, minimizing, maximizing, closing and dragging windows,
// plus one taskbar button per open window.

const TASKBAR_HEIGHT = 48;
const MIN_VISIBLE = 80; // px of a window that must stay on screen while dragging

const windows = new Map();
let taskbarList;
let zCounter = 100;

export function initWindows(taskbarElement) {
  taskbarList = taskbarElement;
  window.addEventListener('resize', () => windows.forEach(({ el }) => keepInView(el)));
}

export function createWindow(id, { title, width, height, left, top, bodyClass, onClose }) {
  const el = document.createElement('section');
  el.className = 'window';
  el.id = `${id}-window`;
  el.tabIndex = -1;
  el.setAttribute('aria-label', title);
  Object.assign(el.style, { width: `${width}px`, height: `${height}px`, left, top });
  el.innerHTML = `
    <header class="window-header">
      <div class="window-title"></div>
      <div class="window-controls">
        <button class="window-button minimize-btn" aria-label="Minimize" title="Minimize"></button>
        <button class="window-button maximize-btn" aria-label="Maximize" title="Maximize"></button>
        <button class="window-button close-btn" aria-label="Close" title="Close"></button>
      </div>
    </header>
    <div class="window-body"></div>`;
  el.querySelector('.window-title').textContent = title;
  const body = el.querySelector('.window-body');
  if (bodyClass) body.classList.add(bodyClass);

  const taskButton = document.createElement('button');
  taskButton.className = 'task-button';
  taskButton.textContent = title;
  taskButton.hidden = true;
  taskbarList.append(taskButton);

  windows.set(id, { el, taskButton, onClose });

  el.addEventListener('pointerdown', () => focusWindow(id));
  el.querySelector('.minimize-btn').addEventListener('click', () => minimizeWindow(id));
  el.querySelector('.maximize-btn').addEventListener('click', () => toggleMaximize(id));
  el.querySelector('.close-btn').addEventListener('click', () => closeWindow(id));

  const header = el.querySelector('.window-header');
  header.addEventListener('dblclick', event => {
    if (!event.target.closest('button')) toggleMaximize(id);
  });
  enableDrag(el, header);

  taskButton.addEventListener('click', () => {
    if (el.classList.contains('minimized')) openWindow(id);
    else if (el.classList.contains('focused')) minimizeWindow(id);
    else focusWindow(id);
  });

  document.body.append(el);
  return body;
}

export function openWindow(id) {
  const { el, taskButton } = windows.get(id);
  el.classList.add('open');
  el.classList.remove('minimized');
  taskButton.hidden = false;
  focusWindow(id);
  keepInView(el);
  el.focus({ preventScroll: true });
}

export function closeWindow(id) {
  const { el, taskButton, onClose } = windows.get(id);
  el.classList.remove('open', 'minimized', 'maximized', 'focused');
  taskButton.hidden = true;
  taskButton.classList.remove('active');
  onClose?.();
  focusTopWindow();
}

function minimizeWindow(id) {
  const { el, taskButton } = windows.get(id);
  el.classList.add('minimized');
  el.classList.remove('focused');
  taskButton.classList.remove('active');
  focusTopWindow();
}

function toggleMaximize(id) {
  windows.get(id).el.classList.toggle('maximized');
}

function focusWindow(id) {
  windows.forEach(({ el, taskButton }, otherId) => {
    el.classList.toggle('focused', otherId === id);
    taskButton.classList.toggle('active', otherId === id);
  });
  windows.get(id).el.style.zIndex = ++zCounter;
}

function focusTopWindow() {
  let top = null;
  windows.forEach(({ el }, id) => {
    const visible = el.classList.contains('open') && !el.classList.contains('minimized');
    if (visible && (!top || +el.style.zIndex > +windows.get(top).el.style.zIndex)) top = id;
  });
  if (top) focusWindow(top);
}

function keepInView(el) {
  if (!el.classList.contains('open') || el.classList.contains('maximized')) return;
  const rect = el.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width;
  const maxTop = window.innerHeight - TASKBAR_HEIGHT - rect.height;
  if (rect.left > maxLeft || rect.left < 0) el.style.left = `${Math.max(0, maxLeft)}px`;
  if (rect.top > maxTop || rect.top < 0) el.style.top = `${Math.max(0, maxTop)}px`;
}

function enableDrag(el, handle) {
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button') || el.classList.contains('maximized')) return;
    const rect = el.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add('dragging');

    const onMove = moveEvent => {
      const x = clamp(moveEvent.clientX - offsetX, MIN_VISIBLE - rect.width, window.innerWidth - MIN_VISIBLE);
      const y = clamp(moveEvent.clientY - offsetY, 0, window.innerHeight - TASKBAR_HEIGHT - handle.offsetHeight);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      document.body.classList.remove('dragging');
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
