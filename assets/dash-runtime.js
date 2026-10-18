/*
 * dash-runtime.js
 * A small, dependency-free stand-in for the Claude Dashboard artifact runtime,
 * so the exact same page (artifact/index.html) runs as a static site.
 *
 * Implements the subset of the `dash` API the page uses:
 *   dash.data(id), dash.onData(fn), dash.calc(id, {...}),
 *   dash.params(), dash.setParams(obj), dash.resetParams(), dash.setLink(name), dash.colors
 */
(function () {
  const DATASETS = { weekly: 'data/executive_weekly_metrics.json' };
  const DEFAULT_PARAMS = { country: null, city: null, week: null };

  const store = {};      // dataset id -> {status, data}
  const calcs = {};      // calc id -> {inputs, fn}
  const calcCache = {};  // calc id -> result
  const listeners = [];
  let params = { ...DEFAULT_PARAMS };

  const notify = () => listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error('[dash] onData callback failed', e); }
  });

  function load(id) {
    if (store[id]) return;
    store[id] = { status: 'loading', data: [] };
    fetch(DATASETS[id])
      .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.json(); })
      .then((rows) => {
        store[id] = { status: 'ok', data: Array.isArray(rows) ? rows : rows.rows || rows.data || [] };
        notify();
      })
      .catch((e) => { store[id] = { status: 'error', data: [], message: String(e) }; notify(); });
  }

  function data(id) {
    if (calcs[id]) {
      if (calcCache[id]) return calcCache[id];
      const ins = calcs[id].inputs.map(data);
      const bad = ins.find((d) => d.status !== 'ok');
      if (bad) return { status: bad.status, data: [], message: bad.message };
      try {
        const out = calcs[id].fn(...ins.map((d) => d.data));
        return (calcCache[id] = { status: 'ok', data: out });
      } catch (e) {
        console.error('[dash] calc failed', id, e);
        return { status: 'error', data: [], message: String(e) };
      }
    }
    if (!DATASETS[id]) return { status: 'missing', data: [] };
    load(id);
    return store[id];
  }

  window.dash = {
    data,
    calc: (id, def) => { calcs[id] = def; },
    onData: (fn) => { listeners.push(fn); try { fn(); } catch (e) { console.error(e); } },
    params: () => ({ ...params }),
    setParams: (obj) => { params = { ...params, ...obj }; notify(); },
    resetParams: () => { params = { ...DEFAULT_PARAMS }; notify(); },
    setLink: (name) => history.replaceState(null, '', '#' + name),
    refresh: () => {},
    colors: ['#00c2a8', '#6366f1', '#38bdf8', '#f5a524', '#ff6b57', '#1b2370', '#8b5cf6', '#10b981'],
  };

  // Redraw when the page width changes (charts size from clientWidth).
  let lastW = 0, t;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w === lastW) return;
    lastW = w; clearTimeout(t); t = setTimeout(notify, 120);
  }).observe(document.getElementById('dash-root'));
})();
