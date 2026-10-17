// Tracks what the reader has discovered and decides when new content appears.
//
// Content files opt in with front-matter fields:
//   requires: [documents/02-letter-draft]    hidden until the reader has opened these items
//   requires: [emails/06-last-chance:pier]   ...or made this reply choice
//   delay: 20                                seconds to wait once the requirements are met
//   password: [B-7, Room B-7]                locked until one of these is typed in
//
// Progress is saved in the reader's browser (localStorage), so it survives a reload.

import { asList, normalizeAnswer, parseRequirement } from './content.js';
import { storyStamp } from './clock.js';

const blankState = () => ({ seen: [], solved: [], choices: {}, arrived: {}, ending: null, endingDismissed: false });

export function createProgress(entries, { storageKey, debug = false, fast = false }) {
  let state = load();
  const timers = new Map();
  const changeListeners = new Set();
  const arriveListeners = new Set();

  function load() {
    if (debug) return blankState();
    try {
      return { ...blankState(), ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') };
    } catch {
      return blankState();
    }
  }

  function save() {
    if (debug) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode, blocked site data); progress then lasts until reload.
    }
  }

  function commit() {
    save();
    evaluate();
    changeListeners.forEach(listener => listener());
  }

  const hasRequirements = entry => asList(entry.requires).length > 0;

  function requirementsMet(entry) {
    return asList(entry.requires).every(requirement => {
      const { id, choice } = parseRequirement(requirement);
      return choice ? state.choices[id] === choice : state.seen.includes(id);
    });
  }

  // Schedules every entry whose requirements are now met. Also re-schedules arrivals that were
  // still pending when the page was closed.
  function evaluate() {
    if (debug) return;
    for (const entry of entries) {
      if (!hasRequirements(entry) || entry.id in state.arrived || timers.has(entry.id) || !requirementsMet(entry)) continue;
      const delay = fast ? 0 : Number(entry.delay) || 0;
      timers.set(entry.id, setTimeout(() => arrive(entry), delay * 1000));
    }
  }

  function arrive(entry) {
    timers.delete(entry.id);
    state.arrived[entry.id] = storyStamp();
    save();
    arriveListeners.forEach(listener => listener(entry));
    changeListeners.forEach(listener => listener());
  }

  return {
    debug,
    start: evaluate,
    onChange: listener => changeListeners.add(listener),
    onArrive: listener => arriveListeners.add(listener),

    isAvailable: entry => debug || !hasRequirements(entry) || entry.id in state.arrived,
    isLocked: entry => !debug && asList(entry.password).length > 0 && !state.solved.includes(entry.id),
    isSeen: id => state.seen.includes(id),
    arrivedAt: id => state.arrived[id] ?? null,
    // 0, 1, 2... in the order items arrived (-1 if never). Breaks ties between same-minute arrivals.
    arrivalOrder: id => Object.keys(state.arrived).indexOf(id),
    choiceOf: id => state.choices[id] ?? null,

    markSeen(id) {
      if (state.seen.includes(id)) return;
      state.seen.push(id);
      commit();
    },

    tryPassword(entry, answer) {
      const correct = asList(entry.password).some(password => normalizeAnswer(password) === normalizeAnswer(answer));
      if (correct && normalizeAnswer(answer)) {
        state.solved.push(entry.id);
        commit();
        return true;
      }
      return false;
    },

    choose(id, value) {
      if (state.choices[id]) return;
      state.choices[id] = value;
      commit();
    },

    get ending() {
      return state.ending;
    },
    get endingDismissed() {
      return state.endingDismissed;
    },
    setEnding(id, { dismissed = false } = {}) {
      state.ending = id;
      state.endingDismissed = dismissed;
      save();
    },

    reset() {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
      state = blankState();
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Nothing saved to remove.
      }
    },
  };
}
