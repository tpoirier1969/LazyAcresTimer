(() => {
  const STORE_PREFIX = 'lazy-acres-timer-v1';
  const PROFILE_KEY = 'lazy-acres-timer-profile';
  const CAP_SECONDS = 36000;
  const originalSetInterval = window.setInterval.bind(window);

  function profile() {
    return localStorage.getItem(PROFILE_KEY) || 'tod';
  }

  function storageKey() {
    return `${STORE_PREFIX}:${profile()}`;
  }

  function loadData() {
    try {
      const loaded = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      if (!loaded || typeof loaded !== 'object') return null;
      loaded.types ||= [];
      loaded.projects ||= [];
      loaded.sessions ||= [];
      loaded.settings ||= { capSeconds: CAP_SECONDS };
      return loaded;
    } catch (error) {
      console.warn('Timer live tick could not read local data.', error);
      return null;
    }
  }

  function routeName() {
    return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)[0] || 'timers';
  }

  function routeProjectId() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return parts[0] === 'project' ? parts[1] : '';
  }

  function money(n) {
    return Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  function dur(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  function durLong(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    if (m) return `${m}m`;
    return `${seconds % 60}s`;
  }

  function projectById(data, projectId) {
    return (data?.projects || []).find((project) => project.id === projectId && !project.deleted) || null;
  }

  function sessionById(data, sessionId) {
    return (data?.sessions || []).find((session) => session.id === sessionId && !session.deleted) || null;
  }

  function sessionsFor(data, projectId) {
    return (data?.sessions || []).filter((session) => session.projectId === projectId && !session.deleted);
  }

  function runningSessions(data) {
    return (data?.sessions || []).filter((session) => !session.deleted && !session.ended);
  }

  function elapsed(session, at = Date.now()) {
    const end = session.ended ? new Date(session.ended).getTime() : at;
    return Math.max(0, Math.floor((end - new Date(session.started).getTime()) / 1000));
  }

  function counted(data, session, project = projectById(data, session.projectId)) {
    const raw = elapsed(session);
    return project?.useCap ? Math.min(raw, Number(data?.settings?.capSeconds || CAP_SECONDS)) : raw;
  }

  function sessionCharge(data, session, project = projectById(data, session.projectId)) {
    return project?.billable ? counted(data, session, project) / 3600 * Number(project.rate || 0) : 0;
  }

  function projectSeconds(data, projectId) {
    const project = projectById(data, projectId);
    return sessionsFor(data, projectId).reduce((sum, session) => sum + counted(data, session, project), 0);
  }

  function projectCharge(data, projectId) {
    const project = projectById(data, projectId);
    return project?.billable ? projectSeconds(data, projectId) / 3600 * Number(project.rate || 0) : 0;
  }

  function updateRunningRows(data) {
    document.querySelectorAll('.timer-row').forEach((row) => {
      const sessionId = row.querySelector('[data-stop]')?.dataset.stop;
      const session = sessionById(data, sessionId);
      if (!session || session.ended) return;
      const timeEl = row.querySelector('.timer-readout');
      if (timeEl) timeEl.textContent = dur(elapsed(session));
      const chargeEl = row.querySelector('.charge-readout');
      if (chargeEl) chargeEl.textContent = money(projectCharge(data, session.projectId));
    });
  }

  function updateProjectCards(data) {
    document.querySelectorAll('.project-card').forEach((card) => {
      const projectId = card.querySelector('[data-open]')?.dataset.open;
      if (!projectId) return;
      const running = runningSessions(data).find((session) => session.projectId === projectId);
      const runningEl = card.querySelector('.project-actions .timer-readout');
      if (runningEl && running) runningEl.textContent = dur(elapsed(running));
      const chargeEl = card.querySelector('.charge-readout');
      if (chargeEl) chargeEl.textContent = money(projectCharge(data, projectId));
    });
  }

  function updateProjectPage(data) {
    const projectId = routeProjectId();
    if (!projectId) return;
    const project = projectById(data, projectId);
    if (!project) return;
    const running = runningSessions(data).find((session) => session.projectId === projectId);
    const stats = document.querySelectorAll('.main-view > section.panel .grid-three .stat-card strong');
    if (stats[0]) stats[0].textContent = running ? dur(elapsed(running)) : durLong(projectSeconds(data, projectId));
    if (stats[1]) stats[1].textContent = durLong(projectSeconds(data, projectId));
    if (stats[2]) stats[2].textContent = money(projectCharge(data, projectId));

    document.querySelectorAll('tr').forEach((row) => {
      const sessionId = row.querySelector('[data-edit-session]')?.dataset.editSession;
      const session = sessionById(data, sessionId);
      if (!session) return;
      const cells = row.children;
      if (cells[3]) cells[3].textContent = durLong(counted(data, session, project));
      if (cells[4]) cells[4].textContent = money(sessionCharge(data, session, project));
    });
  }

  function updateExistingIdleWarnings(data) {
    document.querySelectorAll('.notice strong').forEach((strong) => {
      const text = strong.textContent || '';
      if (!/ has been running /.test(text)) return;
      const projectName = text.split(' has been running ')[0];
      const running = runningSessions(data).find((session) => projectById(data, session.projectId)?.name === projectName);
      if (!running) return;
      strong.textContent = `${projectName} has been running ${durLong(elapsed(running))}.`;
    });
  }

  function updateLiveTimerReadouts() {
    const data = loadData();
    if (!data) return;
    updateRunningRows(data);
    updateProjectCards(data);
    updateProjectPage(data);
    updateExistingIdleWarnings(data);
  }

  window.setInterval = function patchedSetInterval(callback, delay, ...args) {
    const source = typeof callback === 'function' ? String(callback) : '';
    const isLegacyFullRenderTick = Number(delay) === 1000 && source.includes('running().length') && source.includes('render()');
    if (!isLegacyFullRenderTick) return originalSetInterval(callback, delay, ...args);

    return originalSetInterval(() => {
      const route = routeName();
      if (route === 'stopwatch' || route === 'countdown') {
        callback(...args);
        return;
      }
      const data = loadData();
      if (!runningSessions(data).length) return;
      updateLiveTimerReadouts();
    }, delay);
  };

  window.addEventListener('lazy-acres-timer-data-changed', updateLiveTimerReadouts);
})();
