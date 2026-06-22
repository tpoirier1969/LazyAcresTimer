const config = window.LAZY_TIMER_CONFIG || {};
const APP_VERSION = config.appVersion || 'v0.1.0';
const STORAGE_PREFIX = 'lazy-acres-timer-v1';
const PROFILE_KEY = 'lazy-acres-timer-profile';
const THEME_KEY = 'lazy-acres-timer-theme';
const DEFAULT_CAP_SECONDS = 10 * 60 * 60;
const DEFAULT_IDLE_MINUTES = 120;

const appRoot = document.querySelector('[data-app-root]');

let activeProfile = localStorage.getItem(PROFILE_KEY) || 'tod';
let activeTheme = localStorage.getItem(THEME_KEY) || 'field';
let state = loadState();
let currentRoute = parseRoute();
let renderTimer = 0;
let stopwatch = { running: false, startedAt: 0, elapsedMs: 0 };
let countdown = { running: false, startedAt: 0, durationMs: 15 * 60 * 1000, remainingMs: 15 * 60 * 1000 };
let supabaseClientPromise = null;
let lastToast = '';

const TABS = [
  ['timers', 'Timers'],
  ['reports', 'Reports'],
  ['stopwatch', 'Stopwatch'],
  ['countdown', 'Countdown'],
  ['timecode', 'Time Code'],
  ['settings', 'Settings'],
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function storageKey(profile = activeProfile) {
  return `${STORAGE_PREFIX}:${profile}`;
}

function defaultState() {
  const now = nowIso();
  const millingId = uid();
  const computerId = uid();
  return {
    projectTypes: [
      { id: millingId, name: 'Milling', defaultHourlyRate: 100, isArchived: false, sortOrder: 10, createdAt: now, updatedAt: now, deletedAt: null },
      { id: computerId, name: 'Computer Work', defaultHourlyRate: 25, isArchived: false, sortOrder: 20, createdAt: now, updatedAt: now, deletedAt: null },
    ],
    projects: [],
    sessions: [],
    settings: { idleWarningMinutes: DEFAULT_IDLE_MINUTES, defaultCapSeconds: DEFAULT_CAP_SECONDS, createdAt: now, updatedAt: now, deletedAt: null },
    sync: { dirty: false, lastSyncedAt: null, message: 'Local mode', pendingChanges: 0 },
    ui: { acknowledgedIdleBlocks: {} },
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    const base = defaultState();
    if (!parsed || typeof parsed !== 'object') return base;
    return normalizeState({ ...base, ...parsed });
  } catch {
    return defaultState();
  }
}

function normalizeState(input) {
  const base = defaultState();
  const next = {
    projectTypes: Array.isArray(input.projectTypes) ? input.projectTypes : base.projectTypes,
    projects: Array.isArray(input.projects) ? input.projects : [],
    sessions: Array.isArray(input.sessions) ? input.sessions : [],
    settings: { ...base.settings, ...(input.settings || {}) },
    sync: { ...base.sync, ...(input.sync || {}) },
    ui: { ...base.ui, ...(input.ui || {}) },
  };
  if (!next.projectTypes.filter((type) => !type.deletedAt).some((type) => type.name === 'Milling')) {
    next.projectTypes.push({ id: uid(), name: 'Milling', defaultHourlyRate: 100, isArchived: false, sortOrder: 10, createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null });
  }
  if (!next.projectTypes.filter((type) => !type.deletedAt).some((type) => type.name === 'Computer Work')) {
    next.projectTypes.push({ id: uid(), name: 'Computer Work', defaultHourlyRate: 25, isArchived: false, sortOrder: 20, createdAt: nowIso(), updatedAt: nowIso(), deletedAt: null });
  }
  return next;
}

function saveState({ dirty = true, message = '' } = {}) {
  if (dirty) {
    state.sync.dirty = true;
    state.sync.pendingChanges = (state.sync.pendingChanges || 0) + 1;
  }
  if (message) state.sync.message = message;
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function switchProfile(profile) {
  activeProfile = profile;
  localStorage.setItem(PROFILE_KEY, profile);
  state = loadState();
  navigate('timers');
}

function applyTheme() {
  document.documentElement.dataset.theme = activeTheme === 'dark' ? 'dark' : 'field';
}

function setTheme(theme) {
  activeTheme = theme === 'dark' ? 'dark' : 'field';
  localStorage.setItem(THEME_KEY, activeTheme);
  render();
}

function parseRoute(hash = window.location.hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'project' && parts[1]) return { tab: 'timers', projectId: parts[1] };
  const tab = TABS.some(([id]) => id === parts[0]) ? parts[0] : 'timers';
  return { tab, projectId: null };
}

function navigate(tabOrHash) {
  const hash = String(tabOrHash || 'timers').startsWith('#') ? tabOrHash : `#/${tabOrHash}`;
  window.location.hash = hash;
}

function liveElapsedSeconds(session, at = Date.now()) {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt ? new Date(session.endedAt).getTime() : at;
  return Math.max(0, Math.floor((end - start) / 1000));
}

function getProject(projectId) {
  return state.projects.find((project) => project.id === projectId && !project.deletedAt) || null;
}

function getProjectType(typeId) {
  return state.projectTypes.find((type) => type.id === typeId && !type.deletedAt) || null;
}

function activeSessions() {
  return state.sessions.filter((session) => !session.deletedAt && !session.endedAt).sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
}

function projectSessions(projectId, includeDeleted = false) {
  return state.sessions
    .filter((session) => session.projectId === projectId && (includeDeleted || !session.deletedAt))
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

function projectRawSeconds(projectId, at = Date.now()) {
  return projectSessions(projectId).reduce((sum, session) => sum + liveElapsedSeconds(session, at), 0);
}

function countedSecondsForSession(session, project = getProject(session.projectId), at = Date.now()) {
  const raw = liveElapsedSeconds(session, at);
  const cap = Number(session.capSeconds || state.settings.defaultCapSeconds || DEFAULT_CAP_SECONDS);
  if (project?.useTenHourCap && cap > 0) return Math.min(raw, cap);
  return raw;
}

function projectCountedSeconds(projectId, at = Date.now()) {
  const project = getProject(projectId);
  return projectSessions(projectId).reduce((sum, session) => sum + countedSecondsForSession(session, project, at), 0);
}

function projectCharge(projectId, at = Date.now()) {
  const project = getProject(projectId);
  if (!project?.isBillable) return 0;
  return (projectCountedSeconds(projectId, at) / 3600) * Number(project.hourlyRate || 0);
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDurationLong(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
  return `${seconds % 60}s`;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}\n