// app.js — Main application logic and state management

(function () {
  // ── STATE ──────────────────────────────────────────────────────────────────
  const state = {
    mode:     'comparison',   // 'comparison' | 'heatmap'
    scenario: 2026,           // 2026 | 2030 | 2035 | 2040
    selected: []              // array of cityIds (max 2 in comparison, 1 in heatmap)
  };

  // ── INIT ───────────────────────────────────────────────────────────────────
  function init() {
    const dark = _loadTheme() === 'dark';
    _applyTheme(dark);
    _initSettings();
    MapModule.init(handleCityClick, dark, _loadBasemap());
    _bindBasemap();
    _bindSearch();
    _bindExports();
    _bindScenarioButtons();
    _bindViewToggle();
    _bindThemeToggle();
    ComparisonModule.showEmpty();
  }

  // ── MAP STYLE (persisted) ─────────────────────────────────────────────────
  const BASEMAP_KEY = 'railmap-basemap';
  function _loadBasemap() { try { return localStorage.getItem(BASEMAP_KEY) || 'grey'; } catch (e) { return 'grey'; } }
  function _bindBasemap() {
    const sel = document.getElementById('basemap-select');
    const current = _loadBasemap();
    sel.innerHTML = MapModule.styles().map(s => `<option value="${s.key}"${s.key === current ? ' selected' : ''}>${s.label}</option>`).join('');
    sel.addEventListener('change', () => {
      MapModule.setBasemap(sel.value);
      try { localStorage.setItem(BASEMAP_KEY, sel.value); } catch (e) { /* ignore */ }
    });
  }

  // ── CITY SEARCH (acts like clicking the city on the map) ──────────────────
  function _bindSearch() {
    const input = document.getElementById('city-search');
    const list = document.getElementById('city-list');
    list.innerHTML = CITIES.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map(c => `<option value="${c.name}"></option>`).join('');
    const norm = t => t.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').trim();
    const pick = () => {
      const q = norm(input.value);
      if (!q) return;
      const city = CITIES.find(c => norm(c.name) === q) || CITIES.find(c => norm(c.name).startsWith(q));
      if (!city) return;
      handleCityClick(city.id);
      input.value = '';
      input.blur();
    };
    input.addEventListener('change', pick);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') pick(); });
  }

  // ── EXPORTS: all pairs as CSV; comparison panel as PNG ───────────────────
  function _download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function _bindExports() {
    document.getElementById('export-csv').addEventListener('click', () => {
      const q = v => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
      const years = [2026, 2030, 2035, 2040];
      const head = ['from', 'to', ...years.map(y => `minutes_${y}`), ...years.map(y => `route_${y}`), ...years.map(y => `changes_${y}`),
        'flight_door_to_door_min', 'rail_co2e_kg_2026', 'air_co2e_kg', 'night_trains'];
      const rows = ROUTES.map(r => {
        const f = Network.flight(r.from, r.to), c = Network.co2(r, 2026, r.from, r.to);
        const nights = Network.nightTrains(r.from, r.to).map(n => `${n.op} (${n.freq})`).join('; ');
        return [CITIES[r.from].name, CITIES[r.to].name, ...years.map(y => r.times['y' + y]), ...years.map(y => r.viaByYear['y' + y]),
          ...years.map(y => r.transfersByYear['y' + y]), f.doorToDoor, c.railKg, f.doorToDoor === null ? '' : c.airKg, nights].map(q).join(',');
      });
      const meta = `# European Rail Travel Times — exported ${new Date().toISOString().slice(0, 10)}; change time ${Network.settings.transfer} min; project dates: ${Network.settings.timing}`;
      _download(new Blob(['\ufeff' + [meta, head.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }),
        `rail-travel-times_${Network.settings.timing}_${Network.settings.transfer}min.csv`);
    });
    document.getElementById('panel-content').addEventListener('click', async e => {
      if (!e.target.closest('#save-image')) return;
      if (typeof html2canvas !== 'function') { alert('Image export needs an internet connection (html2canvas library).'); return; }
      const el = document.getElementById('panel-content');
      const bg = getComputedStyle(document.body).backgroundColor;
      const canvas = await html2canvas(el, { backgroundColor: bg, scale: 2, ignoreElements: n => n.id === 'save-image' });
      canvas.toBlob(b => _download(b, `rail-comparison_${state.selected.map(i => CITIES[i].name).join('-')}_${state.scenario}.png`));
    });
  }

  // ── THEME (light default, persisted in localStorage) ──────────────────────
  const THEME_KEY = 'railmap-theme';

  function _loadTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  }

  function _applyTheme(dark) {
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = dark ? '☀️' : '🌙';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function _bindThemeToggle() {
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
      _applyTheme(dark);
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
      MapModule.setTheme(dark);
      _redrawMarkers();
    });
  }

  // Re-render markers for the current selection (used after theme change)
  function _redrawMarkers() {
    if (state.selected.length === 0) MapModule.setMarkerColors(null);
    else if (state.mode === 'heatmap') _renderHeatmap();
    else if (state.selected.length === 2) _renderComparison();
    else MapModule.highlightCities(state.selected[0], null);
  }

  // ── CITY CLICK ────────────────────────────────────────────────────────────
  function handleCityClick(cityId) {
    if (state.mode === 'comparison') {
      _handleComparisonClick(cityId);
    } else {
      _handleHeatmapClick(cityId);
    }
  }

  function _handleComparisonClick(cityId) {
    if (state.selected.length === 0) {
      // Select origin
      state.selected = [cityId];
      MapModule.highlightCities(cityId, null);
      ComparisonModule.showOriginSelected(cityId);

    } else if (state.selected.length === 1) {
      if (state.selected[0] === cityId) {
        // Clicked same city — deselect
        state.selected = [];
        MapModule.resetAll();
        ComparisonModule.showEmpty();
        return;
      }
      // Select destination
      state.selected = [state.selected[0], cityId];
      _renderComparison();

    } else {
      // Third click — reset and start fresh
      state.selected = [cityId];
      MapModule.highlightCities(cityId, null);
      ComparisonModule.showOriginSelected(cityId);
    }
  }

  function _handleHeatmapClick(cityId) {
    if (state.selected.length === 1 && state.selected[0] === cityId) {
      // Clicked same city — deselect
      state.selected = [];
      MapModule.resetAll();
      ComparisonModule.showEmpty();
      return;
    }
    state.selected = [cityId];
    _renderHeatmap();
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  function _renderComparison() {
    const [originId, destId] = state.selected;
    MapModule.highlightCities(originId, destId);
    const route = getRoute(originId, destId);
    const codes = route && route.pathByYear['y' + state.scenario];
    let stops = codes ? codes.map(c => Network.node(c)) : null;
    if (stops && originId > destId) stops = stops.reverse();
    MapModule.drawPath(originId, destId, stops, Network.settings.transfer);
    ComparisonModule.showComparison(originId, destId, state.scenario);
  }

  // ── SETTINGS (change time slider, project timing) — persisted ─────────────
  const SETTINGS_KEY = 'railmap-settings';

  function _initSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { /* ignore */ }
    const s = {
      transfer: Number.isFinite(saved.transfer) ? saved.transfer : 10,
      timing: saved.timing === 'conservative' ? 'conservative' : 'official'
    };
    const slider = document.getElementById('transfer-slider');
    const label = document.getElementById('transfer-value');
    slider.value = s.transfer;
    label.textContent = `${s.transfer} min`;
    document.querySelectorAll('#timing-toggle .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.timing === s.timing));
    Network.rebuild(s);

    const apply = next => {
      Network.rebuild(next);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(Network.settings)); } catch (e) { /* ignore */ }
      _refresh();
    };
    slider.addEventListener('input', () => { label.textContent = `${slider.value} min`; });
    slider.addEventListener('change', () => apply({ transfer: parseInt(slider.value, 10) }));
    document.querySelectorAll('#timing-toggle .seg-btn').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.timing === Network.settings.timing) return;
      document.querySelectorAll('#timing-toggle .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      apply({ timing: btn.dataset.timing });
    }));
  }

  function _renderHeatmap() {
    const originId = state.selected[0];

    // Build color map for all other cities
    const colorMap = {};
    CITIES.forEach(c => {
      if (c.id === originId) {
        colorMap[c.id] = '#4361ee'; // accent = selected
      } else {
        const t = getTime(originId, c.id, state.scenario);
        colorMap[c.id] = timeToColor(t);
      }
    });

    MapModule.setMarkerColors(colorMap, originId);
    MapModule.clearRoute();
    ComparisonModule.showHeatmap(originId, state.scenario);
  }

  // ── SCENARIO SELECTOR ─────────────────────────────────────────────────────
  function _bindScenarioButtons() {
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const year = parseInt(btn.dataset.year, 10);
        if (year === state.scenario) return;
        state.scenario = year;
        _updateScenarioBtns();
        _refresh();
      });
    });
  }

  function _updateScenarioBtns() {
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.year, 10) === state.scenario);
    });
  }

  // ── VIEW TOGGLE ───────────────────────────────────────────────────────────
  function _bindViewToggle() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newMode = btn.dataset.mode;
        if (newMode === state.mode) return;
        state.mode     = newMode;
        state.selected = [];
        _updateViewBtns();
        MapModule.resetAll();
        ComparisonModule.showEmpty();
      });
    });
  }

  function _updateViewBtns() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });
  }

  // ── REFRESH on scenario change ─────────────────────────────────────────────
  function _refresh() {
    if (state.selected.length === 0) return;

    if (state.mode === 'comparison') {
      if (state.selected.length === 2) {
        _renderComparison();
      }
      // If only one selected, nothing extra to redraw
    } else {
      _renderHeatmap();
    }
  }

  // ── BOOT ──────────────────────────────────────────────────────────────────
  // Scripts are at the bottom of <body> so the DOM is already parsed;
  // call init() directly rather than waiting for DOMContentLoaded.
  init();
})();
