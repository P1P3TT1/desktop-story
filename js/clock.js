// Story time: the taskbar clock starts at story.json "clockStart" and keeps ticking from there.
// storyNow() is also used to timestamp emails that arrive while the reader explores.

let offset = 0;

export function storyNow() {
  return new Date(Date.now() + offset);
}

// "2024-03-30 00:52", the same format content files use for dates.
export function storyStamp(date = storyNow()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function startClock(clockElement, clockStart) {
  const start = clockStart ? new Date(clockStart) : null;
  offset = start && !isNaN(start) ? start.getTime() - Date.now() : 0;
  const tick = () => {
    const now = storyNow();
    clockElement.innerHTML = `
      <span>${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span>${now.toLocaleDateString()}</span>`;
  };
  tick();
  setInterval(tick, 1000);
}
