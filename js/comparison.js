// comparison.js — Side panel: bar chart, route legs with sources, projects, flight comparison, heatmap list

const ComparisonModule = (() => {
  const YEARS = [2026, 2030, 2035, 2040];
  const CONF = { h: ['✓', 'Confirmed from a timetable'], m: ['~', 'Reliable secondary source'], l: ['?', 'Unconfirmed estimate'], plan: ['◆', 'Planned new line (design time)'] };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const link = (url, text, cls) => `<a href="${esc(url)}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ''}>${text}</a>`;
  const prevYear = y => YEARS[YEARS.indexOf(y) - 1];

  // ── EMPTY STATE ─────────────────────────────────────────────────────────
  function showEmpty() {
    document.getElementById('panel-content').innerHTML = `
      <div id="panel-empty">
        <div class="icon">🗺️</div>
        <p><strong>Click a city</strong> to begin.</p>
        <p>In <em>Route Comparison</em> mode, click two cities to compare travel times across scenarios.<br><br>
           In <em>Isochrone Heatmap</em> mode, click one city to see all others coloured by travel time.</p>
      </div>`;
  }

  function showOriginSelected(originId) {
    document.getElementById('panel-content').innerHTML = `
      <div id="panel-empty">
        <div class="icon">📍</div>
        <p><strong>${CITIES[originId].name}</strong> selected as origin.<br><br>Now click a destination city to compare travel times.</p>
      </div>`;
  }

  // ── ROUTE COMPARISON ────────────────────────────────────────────────────
  function showComparison(originId, destId, scenario) {
    const origin = CITIES[originId], dest = CITIES[destId];
    const route = getRoute(originId, destId);
    const reversed = originId > destId; // routes are stored lowest-id first
    const times = YEARS.map(y => ({ year: y, minutes: route ? route.times['y' + y] : null }));
    const maxTime = Math.max(...times.map(t => t.minutes || 0), 1);

    document.getElementById('panel-content').innerHTML = `
      <div class="panel-route-header">
        <div class="route-title-row">
          <h2>${origin.name} → ${dest.name}</h2>
          <button type="button" id="save-image" class="icon-btn" title="Save this comparison as an image">⤓ Image</button>
        </div>
        <div class="subtitle">${origin.station} → ${dest.station}</div>
      </div>
      <div id="bar-chart-wrap">${times.map(t => _barRow(t, scenario, maxTime)).join('')}</div>
      ${_cityNotes([origin, dest], times.some(t => t.minutes === null))}
      ${_flightCard(originId, destId, route ? route.times['y' + scenario] : null, scenario)}
      ${_co2Card(route, scenario, originId, destId)}
      ${_nightCard(originId, destId)}
      ${_legsSection(route, scenario, reversed)}
      <h3 class="panel-h3">Route by scenario</h3>
      <div id="route-details">${times.map(t => _detailRow(t, route, scenario, reversed)).join('')}</div>
      ${_projectsSection(route)}`;
  }

  function _barRow({ year, minutes }, scenario, maxTime) {
    const on = year === scenario ? ' active' : '';
    const pct = minutes !== null ? Math.max((minutes / maxTime) * 100, 3) : 0;
    return `
      <div class="bar-row">
        <span class="bar-label-year${on}">${year}</span>
        <div class="bar-outer">${minutes !== null
          ? `<div class="bar-inner${on}" style="width:${pct.toFixed(1)}%"></div>`
          : `<div class="bar-null"><span>No rail link under 20h</span></div>`}</div>
        <span class="bar-time${on}">${minutes !== null ? formatTime(minutes) : '—'}</span>
      </div>`;
  }

  function _viaText(route, k, reversed) {
    let via = route.viaByYear[k] || '—';
    if (reversed && via.startsWith('via ')) via = 'via ' + via.slice(4).split(', ').reverse().join(', ');
    return via;
  }

  function _detailRow({ year, minutes }, route, scenario, reversed) {
    if (!route) return '';
    const k = 'y' + year, on = year === scenario;
    const tr = route.transfersByYear[k];
    const transfers = tr === 0 ? 'No change required' : `${tr} change${tr > 1 ? 's' : ''}`;
    return `
      <div class="detail-row">
        <div class="detail-year${on ? ' active' : ''}">${year}${on ? ' ← shown on map' : ''}</div>
        ${minutes !== null ? `
          <div class="detail-via">${_viaText(route, k, reversed)}</div>
          <div class="detail-transfers">${transfers}</div>
          ${_badge(route, year)}`
        : `<div class="detail-transfers muted-italic">No reasonable rail connection</div>`}
      </div>`;
  }

  function _saving(route, year) {
    if (year === 2026) return 0;
    const p = route.times['y' + prevYear(year)], c = route.times['y' + year];
    if (c === null) return 0;
    return p === null ? null : p - c; // null = newly possible
  }

  function _badge(route, year) {
    if (year === 2026) return '';
    const ids = route.improvements['y' + year] || [];
    const s = _saving(route, year);
    if (!ids.length || s === 0) return '';
    const names = ids.map(pid => PROJECTS[pid] ? link(PROJECTS[pid].url, PROJECTS[pid].shortName) : '').filter(Boolean).join(' + ');
    return `<div class="detail-project"><span class="arrow">▲</span>${names} <strong>${s === null ? 'new link' : '−' + s + 'm'}</strong></div>`;
  }

  // Leg-by-leg breakdown for the selected scenario, with sources and confidence
  function _legsSection(route, scenario, reversed) {
    if (!route) return '';
    const k = 'y' + scenario;
    let legs = route.legsByYear[k];
    if (!legs) return '';
    legs = reversed ? legs.slice().reverse().map(l => ({ ...l, a: l.b, b: l.a })) : legs;
    const tr = Network.settings.transfer;
    const rows = legs.map((l, i) => {
      const [sym, tip] = CONF[l.conf] || CONF.l;
      return `${i > 0 ? `<div class="leg-change">↻ Change at ${Network.node(l.a).name} · ${tr} min</div>` : ''}
        <div class="leg">
          <span class="leg-conf conf-${l.conf}" title="${tip}">${sym}</span>
          <span class="leg-name">${Network.node(l.a).name} → ${Network.node(l.b).name}</span>
          <span class="leg-time">${formatTime(l.t)}</span>
          <div class="leg-note">${esc(l.note)} · ${link(l.src, 'source')}</div>
        </div>`;
    }).join('');
    return `
      <h3 class="panel-h3">Legs in ${scenario}</h3>
      <div class="legs">${rows}</div>
      <div class="legend">✓ timetable-confirmed · ~ secondary source · ? estimate · ◆ planned line. Times are the fastest train on each leg; sources checked ${Network.CHECKED}.</div>`;
  }

  // Train vs plane (door-to-door estimate)
  function _flightCard(originId, destId, railMin, scenario) {
    const f = Network.flight(originId, destId);
    if (f.doorToDoor === null) {
      return `<div class="flight-card"><div class="flight-head">✈ Flying</div><p>Under ${Network.FLIGHT.minKm} km (${f.km} km): no practical flight.</p></div>`;
    }
    let verdict = '';
    if (railMin !== null) {
      const d = f.doorToDoor - railMin;
      verdict = d >= 0
        ? `<span class="verdict good">Rail is ${formatTime(d)} faster door-to-door in ${scenario}</span>`
        : `<span class="verdict bad">Flying is ${formatTime(-d)} faster door-to-door in ${scenario}</span>`;
    }
    return `
      <div class="flight-card">
        <div class="flight-head">✈ Flying (estimate) <strong>${formatTime(f.doorToDoor)}</strong> door-to-door</div>
        ${verdict}
        <p class="flight-disclose">Estimate, not a schedule: ${f.km} km great-circle distance → ~${formatTime(f.block)} gate-to-gate
          (${Network.FLIGHT.taxiAndClimb} min taxi/climb + cruise at ${Network.FLIGHT.cruiseKmh} km/h), plus a fixed
          ${formatTime(Network.FLIGHT.airportAllowance)} for getting to the airport, security, boarding and into town. It ignores whether a direct flight exists.
          Rail times are city-centre station to station.</p>
      </div>`;
  }

  // Explanatory notes for cities with limited or no international rail (e.g. Dublin, Helsinki, Athens)
  function _cityNotes(cities, show) {
    const notes = cities.filter(c => c.note);
    if (!show || !notes.length) return '';
    return notes.map(c => `<div class="city-note"><strong>${esc(c.name)}:</strong> ${esc(c.note)}</div>`).join('');
  }

  // CO₂e per passenger: rail (sum of legs) vs flying
  function _co2Card(route, scenario, originId, destId) {
    const f = Network.flight(originId, destId);
    const c = Network.co2(route, scenario, originId, destId);
    if (c.railKg === null && f.doorToDoor === null) return '';
    const max = Math.max(c.railKg || 0, f.doorToDoor !== null ? c.airKg : 0, 1);
    const bar = (label, kg, cls) => `<div class="co2-row"><span class="co2-label">${label}</span>
      <div class="co2-track"><div class="co2-bar ${cls}" style="width:${Math.max(kg / max * 100, 2).toFixed(1)}%"></div></div>
      <span class="co2-val">${kg} kg</span></div>`;
    const ratio = c.railKg && f.doorToDoor !== null ? Math.round(c.airKg / Math.max(c.railKg, 1)) : null;
    return `
      <div class="co2-card">
        <div class="flight-head">🌍 CO₂e per passenger (estimate)${ratio && ratio > 1 ? ` <span class="verdict good">rail ≈ ${ratio}× lower</span>` : ''}</div>
        ${c.railKg !== null ? bar('🚆 Rail', c.railKg, 'rail') : ''}
        ${f.doorToDoor !== null ? bar('✈ Plane', c.airKg, 'air') : ''}
        <p class="flight-disclose">EU-27 averages from the ${link(Network.CO2.src, 'European Environment Agency')}: rail ${Network.CO2.railG} g and aviation
          ${Network.CO2.airG} g CO₂e per passenger-km (well-to-wheel; aviation includes non-CO₂ effects ×1.7). Rail distance = route legs × ${Network.CO2.railDetour}
          for track curvature (${c.railKm || '—'} km); flight = great-circle + ${Network.CO2.airExtraKm} km (${c.airKm} km). Actual rail emissions vary widely with each country's electricity mix.</p>
      </div>`;
  }

  // Direct night trains for this pair
  function _nightCard(originId, destId) {
    const list = Network.nightTrains(originId, destId);
    if (!list.length) return '';
    const rows = list.map(n => `
      <div class="night-row">
        <div class="night-top"><strong>${esc(n.op)}</strong><span>${formatTime(n.minutes)}</span></div>
        <div class="night-meta">${esc(n.freq)} · ${esc(n.times)}${n.reversed && !/→/.test(n.times) ? ` (${esc(n.a)}→${esc(n.b)})` : ''} · ${link(n.src, 'source')}</div>
      </div>`).join('');
    return `
      <div class="night-card">
        <div class="flight-head">🌙 Direct night train${list.length > 1 ? 's' : ''}</div>
        ${rows}
        <p class="flight-disclose">Sleeper/couchette alternative to the daytime route; not used in the journey-time calculation. Typical times, ${Network.CHECKED}.</p>
      </div>`;
  }

  // Projects driving improvements on this route, with official links and dates
  function _projectsSection(route) {
    if (!route) return '';
    const seen = new Map();
    [2030, 2035, 2040].forEach(y => (route.improvements['y' + y] || []).forEach(pid => {
      const s = _saving(route, y);
      if (s !== 0 && !seen.has(pid)) seen.set(pid, y);
    }));
    if (!seen.size) return '';
    const mode = Network.settings.timing === 'conservative' ? `conservative mode (official + ${Network.CONSERVATIVE_SLIP} years)` : 'official dates';
    const cards = [...seen].map(([pid, y]) => {
      const p = PROJECTS[pid];
      if (!p) return '';
      return `
        <div class="project-card">
          <div class="project-title">${link(p.url, esc(p.name))} <span class="project-year">counts from ${y}</span></div>
          <div class="project-desc">${esc(p.description)}</div>
          <div class="project-status"><strong>Official target:</strong> ${esc(p.official)}. ${esc(p.status)}
            ${p.dateSource ? link(p.dateSource, 'Date source') : ''}</div>
          ${p.rne ? `<div class="project-status"><strong>RNE capacity strategy:</strong> ${esc(p.rne.text)} ${link(p.rne.url, 'Document')}</div>` : ''}
        </div>`;
    }).join('');
    return `<h3 class="panel-h3">Projects behind the improvements</h3>
      <div class="legend">Scenario placement uses ${mode}. Status checked ${Network.CHECKED}.</div>${cards}`;
  }

  // ── HEATMAP ─────────────────────────────────────────────────────────────
  function showHeatmap(originId, scenario) {
    const origin = CITIES[originId];
    const sorted = getAllTimesFrom(originId, scenario);
    document.getElementById('panel-content').innerHTML = `
      <div class="panel-route-header">
        <h2>${origin.name}</h2>
        <div class="subtitle">Travel times from ${origin.name} · ${scenario}</div>
      </div>
      ${_cityNotes([origin], true)}
      <div class="heat-legend"><span class="heat-bar"></span><span>≤2h</span><span>6h</span><span>≥12h</span><span class="heat-null">no link</span></div>
      <div id="heatmap-list">${sorted.map(({ city, minutes }) => `
        <div class="heatmap-row">
          <div class="heatmap-swatch" style="background:${timeToColor(minutes)}"></div>
          <span class="heatmap-city">${city.name}</span>
          ${minutes !== null ? `<span class="heatmap-time">${formatTime(minutes)}</span>` : `<span class="heatmap-null">No rail link</span>`}
        </div>`).join('')}</div>`;
  }

  return { showEmpty, showComparison, showHeatmap, showOriginSelected };
})();
