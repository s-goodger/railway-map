// sources.js — renders the Sources & projects page from network.js (always in sync with the map)

(function () {
  const N = Network;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const a = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${text}</a>`;
  const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'source'; } };
  const CONF = { h: ['✓', 'Timetable / operator', 'conf-h'], m: ['~', 'Secondary source', 'conf-m'], l: ['?', 'Estimate', 'conf-l'] };

  // ── Group project phases by scenario year (official dates) ──────────────
  const byYear = { 2030: [], 2035: [], 2040: [], beyond: [] };
  const projIds = [...new Set(N.PHASES.map(p => p.project))];
  projIds.forEach(id => {
    const phases = N.PHASES.filter(p => p.project === id);
    const offYears = [...new Set(phases.map(p => N.scenarioFor(p.year)))];
    const consYears = [...new Set(phases.map(p => N.scenarioFor(p.year + N.CONSERVATIVE_SLIP) || 'after 2040'))];
    offYears.forEach((y, i) => {
      (byYear[y] || byYear.beyond).push({ id, stage: offYears.length > 1 ? `Stage ${i + 1} of ${offYears.length}` : null, consYears });
    });
  });

  // ── 2026 baseline: direct links grouped by first city ───────────────────
  const links = N.EDGES.map(e => ({ a: N.node(e[0]).name, b: N.node(e[1]).name, t: e[2], conf: e[3], src: e[4], note: e[5] }))
    .map(l => (l.a > l.b ? { ...l, a: l.b, b: l.a } : l))
    .sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  const counts = links.reduce((m, l) => (m[l.conf] = (m[l.conf] || 0) + 1, m), {});

  const linkRows = links.map(l => {
    const [sym, label, cls] = CONF[l.conf];
    return `<tr>
      <td class="lk">${esc(l.a)} – ${esc(l.b)}</td>
      <td class="tm">${formatTime(l.t)}</td>
      <td class="nt">${esc(l.note)}</td>
      <td class="cf"><span class="${cls}" title="${label}">${sym}</span></td>
      <td class="sr">${a(l.src, esc(host(l.src)))}</td>
    </tr>`;
  }).join('');

  const section2026 = `
    <section class="year-section" id="y2026">
      <div class="year-head"><span class="year-badge">2026</span><h2>Today's network: timetable sources</h2></div>
      <p class="year-intro">The 2026 baseline uses the <strong>fastest scheduled train on each of ${links.length} direct links</strong>,
        from 2026 timetables including the 13 December 2026 change, checked in ${N.CHECKED}. Journeys combine these links with a fixed
        time per change (set on the map; default 10 min).</p>
      <div class="conf-summary">
        <span><b class="conf-h">✓</b> ${counts.h || 0} confirmed from operator timetables</span>
        <span><b class="conf-m">~</b> ${counts.m || 0} from reliable secondary sources</span>
        <span><b class="conf-l">?</b> ${counts.l || 0} unconfirmed estimates</span>
      </div>
      <div class="callouts">
        <div class="callout"><strong>Conditions in 2026 reflected in the data.</strong>
          <ul>
            <li><strong>Spain.</strong> Madrid–Barcelona (3h02) and Madrid–Valencia run slower under speed limits imposed after the January 2026 Adamuz accident, due to end with 2026 (${a('https://en.ara.cat/politics/the-25-minute-increase-in-travel-time-between-madrid-and-barcelona-will-be-extended-until-the-end-of-the-year_1_5639216.html', 'Ara')}).</li>
            <li><strong>Berlin–Hamburg</strong> reopened in June 2026 after a 10-month rebuild (${a('https://www.bahn.de/reisen/view/verbindung/berlin/hamburg.shtml', 'DB')}).</li>
            <li><strong>Koralm line</strong> (Graz–Klagenfurt) opened in December 2025, cutting Vienna–Venice to 7h15 (${a('https://www.vienna.at/new-oebb-timetable-this-changes-from-december/9674177', 'vienna.at')}).</li>
            <li><strong>New direct trains:</strong> Prague–Berlin–Copenhagen since May 2026 (${a('https://www.deutschebahn.com/en/presse/press_releases/Connecting-Europe-by-rail-Direct-connection-from-Prague-to-Copenhagen-via-Berlin-13433718', 'DB')}), Riga–Tallinn since January 2026 (${a('https://vivi.lv/en/news/267/regular-train-service-launched-on-the-tallinn-tartu-riga-route/', 'Vivi')}), and Naples–Bari via the new Naples–Cancello link since July 2026 (${a('https://www.trenitalia.com/it/chi-siamo/comunicati-stampa/20260530-frecciarossa-diretto-lecce-napoli.html', 'Trenitalia')}).</li>
          </ul>
        </div>
      </div>
      <details class="links-table">
        <summary>All ${links.length} direct links with sources</summary>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Link</th><th>Fastest</th><th>Train</th><th></th><th>Source</th></tr></thead>
            <tbody>${linkRows}</tbody>
          </table>
        </div>
        <p class="small">Also available as <a href="data/links.csv">data/links.csv</a>.</p>
      </details>
    </section>`;

  // ── Future scenario sections ─────────────────────────────────────────────
  const INTRO = {
    2030: 'Projects whose official opening date falls in 2027–2030.',
    2035: 'Projects whose official opening date falls in 2031–2035.',
    2040: 'Projects whose official opening date falls in 2036–2040.'
  };
  const projectCard = ({ id, stage, consYears }) => {
    const p = N.PROJECTS[id];
    const cons = consYears.map(y => (typeof y === 'number' ? y : y)).join(', ');
    return `
      <article class="proj">
        <div class="proj-top">
          <h3>${esc(p.name)}${stage ? ` <span class="stage">${stage}</span>` : ''}</h3>
          <a class="proj-link" href="${esc(p.url)}" target="_blank" rel="noopener">Official project page ↗</a>
        </div>
        <p class="proj-desc">${esc(p.description)}</p>
        <dl class="proj-meta">
          <div><dt>Official target</dt><dd>${esc(p.official)}</dd></div>
          <div><dt>Status (${N.CHECKED})</dt><dd>${esc(p.status)}</dd></div>
          <div><dt>Conservative mode</dt><dd>counts from ${esc(cons)} (official + ${N.CONSERVATIVE_SLIP} years)</dd></div>
          ${p.dateSource ? `<div><dt>Date source</dt><dd>${a(p.dateSource, esc(host(p.dateSource)))}</dd></div>` : ''}
          ${p.rne ? `<div><dt>RNE capacity strategy</dt><dd>${esc(p.rne.text)} ${a(p.rne.url, 'Document')}</dd></div>` : ''}
        </dl>
      </article>`;
  };
  const yearSection = y => `
    <section class="year-section" id="y${y}">
      <div class="year-head"><span class="year-badge">${y}</span><h2>${byYear[y].length} project${byYear[y].length === 1 ? '' : 's'} in this scenario</h2></div>
      <p class="year-intro">${INTRO[y]} Each counts from the first scenario year at or after its official target (switch to “Conservative” on the map to add ${N.CONSERVATIVE_SLIP} years).</p>
      <div class="proj-grid">${byYear[y].map(projectCard).join('')}</div>
    </section>`;

  // ── RNE capacity strategies (read October 2026) ─────────────────────────
  const U = f => 'https://rne.eu/wp-content/uploads/' + f;
  const DOCS = [
    ['Common Capacity Strategy TT2030 (draft) — DE, AT, IT, FR, SI, CZ, SK', U('Draft-_Common-Capacity-Strategy-TT-2030.pdf')],
    ['Common Capacity Strategy TT2029', U('Common-pilot-Capacity-Strategy-TT-2029-1.pdf')],
    ['SNCF Réseau TT2028 (draft)', U('2028-Capacity-Strategy-Mature-Draft-SNCF-R-EN.pdf')],
    ['Infrabel TT2030 (draft) and TT2029', U('Infrabel-Capacity-Strategy-for-timetable-2030-DRAFT-VERSION-for-consultation.pdf')],
    ['ProRail TT2030 (draft)', U('Draft-Capacity-Strategy-2030-ProRail-Netherlands.pdf')],
    ['ACF/CFL TT2030 (draft) and TT2028', U('CFL_ACF_Capacity-Strategy-TT2030_Draft.pdf')],
    ['ADIF TT2030 (draft) and TT2029', U('Capacity-Strategy-2030.pdf')],
    ['Banedanmark TT2030 (draft) and TT2029', U('Banedanmarks-Capacity-Strategy-TT30_Draft_Version-1_English-Version.pdf')],
    ['Trafikverket TT2030 (draft) and TT2029', U('trafikverkets_capacity_strategy_2030_draft.pdf')],
    ['Bane NOR R30 (draft) and R29', U('Capacity-Strategy-R30_consultation-draft_Bane-Nor.pdf')],
    ['SBB/BLS TT2030 (draft)', U('CapacityStrategy_2030_TTR@CH_ENG_draft.pdf')],
    ['MÁV/GYSEV TT2028', U('TTR-Capacity-Strategy_TT2028_MAV-GYSEV-KTI-VPE_V1.0_HU-en_GYSEV-VPE-es-MAV-altal-alairt.pdf')],
    ['ŽSR TT2028', U('ZSR-CSt-2028-eng.pdf')]
  ];
  const STATED = [
    ['Stuttgart 21', '≈ −15 min', 'Dec 2031 (DB reset)', 'Modelled: −15 min on through links Stuttgart–Munich, Paris–Munich, Strasbourg–Munich (replaces the earlier ~8 min assumption)'],
    ['Karlsruhe–Offenburg, Rastatt section', '≈ −3 min', 'TT2027 (Dec 2026)', 'Modelled (new): −3 min on Rhine Valley links, counts from 2030'],
    ['Dresdner Bahn (Berlin Südkreuz–Blankenfelde)', '≈ −10 min', 'Dec 2025', 'Not added: already open and included in the 2026 timetable times (Berlin–Prague 3h57)']
  ];
  const UNQUANT = [
    ['Germany', 'Karlsruhe–Basel new tracks Müllheim–Schliengen, Haltingen–Weil (250 km/h)', 'Dec 2027', 'Frankfurt–Basel, Frankfurt–Zurich'],
    ['Germany', 'Kehl station, 160 km/h through running', 'Dec 2028', 'Paris/Strasbourg–Stuttgart/Munich'],
    ['Germany', 'Mannheim–Saarbrücken ETCS ("reduction of journey time")', 'Dec 2029', 'Paris–Frankfurt'],
    ['Germany', 'Dresden Hbf flying junction (higher speed)', 'Dec 2027', 'Berlin/Hamburg–Prague'],
    ['Germany', 'Eifel line electrification (140 km/h)', 'TT2029', 'Luxembourg–Cologne'],
    ['Austria', 'Arlberg tunnel speed increase (110/140 km/h)', 'Dec 2027', 'Zurich–Innsbruck/Vienna'],
    ['Austria', 'Pottendorfer line Wampersdorf–Ebenfurth; Bruck–Graz speed increases', 'Dec 2027; Dec 2029', 'Vienna–Venice'],
    ['Austria', 'Süßenbrunn–Gänserndorf 160 km/h', 'Dec 2026', 'Vienna–Prague, Vienna–Warsaw'],
    ['Austria', 'Weststrecke Pielach tunnel (higher speed)', 'Dec 2029', 'Vienna–Munich/Zurich'],
    ['Czechia', 'Ejpovice–Plzeň 200 km/h; Plzeň–Chotěšov upgrade', 'Dec 2027; TT2028', 'Munich–Prague'],
    ['Czechia', 'Rakvice–Břeclav upgrade for 200 km/h', 'works to Nov 2030', 'Prague–Vienna, Prague–Budapest'],
    ['Czechia', 'Přerov–Ostrava high-speed line connections', 'works to 2035', 'Prague–Warsaw'],
    ['Slovakia', 'Malacky–Kúty modernisation', 'works to 2029', 'Prague–Budapest'],
    ['Italy', 'Fortezza–Ponte Gardena new line (Brenner southern access)', '2029', 'Munich/Innsbruck–Verona'],
    ['Italy', 'Verona Porta Nuova layout; Verona East and West nodes', '2028–2030', 'Milan–Venice, Verona links'],
    ['France / Spain', 'Hendaye–Irun double standard-gauge track', '2029', 'Bordeaux–Bilbao/Madrid (through running)'],
    ['Spain', 'Valladolid doubling and new station; Mérida–Aljucén doubling; Redondela bypass', 'to 2030 (indicative)', 'Madrid–Bilbao/Irun, Madrid–Badajoz, Madrid–Vigo'],
    ['Netherlands', 'Wolfheze and Deventer ("shorter running times")', 'TT2027; TT2030', 'Amsterdam–Cologne/Frankfurt, Amsterdam–Berlin'],
    ['Belgium / Lux.', 'Brussels–Luxembourg L161/L162 modernisation; Luxembourg–Bettembourg new line', 'works to ≥2031; 2027', 'Brussels–Luxembourg, Luxembourg–Paris/Strasbourg'],
    ['Denmark', 'Vestfyn new 250 km/h line; Ringsted–Slagelse, Nyborg–Odense, Roskilde–Ringsted 180→200 km/h', '2028–2030', 'Hamburg/Berlin/Prague–Copenhagen via Jutland'],
    ['Sweden', 'Älvsjö–Huddinge speed increase; Laxå; Olskroken + West Link Gothenburg C', 'Dec 2026–2028', 'Stockholm–Gothenburg/Oslo, Copenhagen–Gothenburg'],
    ['Norway', 'Oslo–Moss double track ("reduced travel time")', 'by TT2030', 'Oslo–Gothenburg'],
    ['Hungary', 'Ferencváros–Kelenföld third track', 'Dec 2027', 'Vienna/Munich–Budapest'],
    ['Switzerland', '"No impact on capacity resulting from the upgrades is known for the 2030 timetable"', 'TT2030', '—']
  ];
  const TCRS = [
    ['Plzeň–Stod total closure', 'Jan 2028 – Jun 2030', 'Munich–Prague'],
    ['Berlin–Dresden total closure', '28 Apr 2028 – 7 Dec 2029', 'Berlin/Hamburg–Prague, Berlin–Vienna'],
    ['Turin–Modane (Fréjus) tunnel maintenance', '2026–2030', 'Paris/Lyon–Turin/Milan'],
    ['Tarvisio–Udine total closure', '2027–2028', 'Vienna–Venice'],
    ['Simplon (Iselle–Domodossola) works', 'to 2029', 'Geneva/Basel–Milan'],
    ['Lehrte–Berlin general renovation', '5 Feb – 10 Dec 2027', 'Amsterdam/Cologne–Berlin'],
    ['Fulda–Hanau total closure', '13 Aug 2027 – 4 Feb 2028', 'Frankfurt–Hamburg/Berlin'],
    ['Aachen–Cologne general renovation', '22 Jun – 7 Dec 2029', 'Brussels/Paris–Cologne'],
    ['Cologne–Koblenz total closure', '11 Jan – 15 Nov 2030', 'Luxembourg–Cologne'],
    ['Stuttgart–Ulm total closure', '11 Jan – 28 Jun 2030', 'Stuttgart/Paris–Munich'],
    ['Berlin–Frankfurt (Oder) total closure', '8 Mar – 28 Jun 2030', 'Berlin–Warsaw'],
    ['HSL-Zuid ERTMS replacement (several weeks)', '2030', 'Amsterdam–Brussels/Paris/London'],
    ['Hallsberg–Sköldinge summer closures (+~50 min)', '2027–2031', 'Stockholm–Gothenburg/Oslo'],
    ['Norrköping C summer closure (+30–60 min)', 'Jul–Aug 2030', 'Stockholm–Copenhagen'],
    ['Brennero station tracks', '2027–2028', 'Munich/Innsbruck–Verona']
  ];
  const tr = cells => `<tr>${cells.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`;
  const sectionRNE = `
    <section class="year-section" id="rne">
      <div class="year-head"><span class="year-badge alt">RNE</span><h2>Infrastructure managers' capacity strategies</h2></div>
      <p class="year-intro">Each infrastructure manager publishes a ${a('https://rne.eu/capacity-management/acp/capacity-strategies/', 'Capacity Strategy')} via RailNetEurope,
        setting out planned construction, upgrades and major closures for an upcoming timetable year. The latest editions (TT2030 drafts under consultation
        to 16 Nov 2026, plus TT2029/TT2028 where newer ones are missing) were read for every country with a city on the map. No capacity strategies are published
        for the UK, Poland, Portugal or the Baltic states.</p>
      <div class="callout"><strong>Main finding:</strong> these are capacity-planning documents. Only three projects come with a journey-time figure in minutes; everything
        else is described qualitatively ("reduced travel time", "180→200 km/h"). Only the stated figures are used in the model, and nothing already covered was added twice.</div>
      <h3 class="sub-h">Stated journey-time savings</h3>
      <div class="table-wrap"><table class="plain"><thead><tr><th>Project</th><th>Stated</th><th>Opening</th><th>How it's used</th></tr></thead>
        <tbody>${STATED.map(tr).join('')}</tbody></table></div>
      <details class="links-table">
        <summary>Upgrades identified without a stated time effect (${UNQUANT.length}, not modelled)</summary>
        <div class="table-wrap"><table class="plain"><thead><tr><th>Country</th><th>Upgrade</th><th>Date in document</th><th>Links affected</th></tr></thead>
          <tbody>${UNQUANT.map(tr).join('')}</tbody></table></div>
      </details>
      <details class="links-table">
        <summary>Major planned closures 2027–2030 (selection, not modelled)</summary>
        <div class="table-wrap"><table class="plain"><thead><tr><th>Closure</th><th>When</th><th>Links affected</th></tr></thead>
          <tbody>${TCRS.map(tr).join('')}</tbody></table></div>
        <p class="small">Scenarios show normal service after works; temporary closures and diversions are not reflected.</p>
      </details>
      <details class="links-table">
        <summary>Documents read (${DOCS.length})</summary>
        <ul class="method-list">${DOCS.map(([t, u]) => `<li>${a(u, esc(t))}</li>`).join('')}</ul>
      </details>
      <p class="small">Date cross-checks against these documents are shown on each project card under “RNE capacity strategy”.</p>
    </section>`;

  // ── Method & other sources ───────────────────────────────────────────────
  const F = N.FLIGHT;
  const methods = `
    <section class="year-section" id="method">
      <div class="year-head"><span class="year-badge alt">Method</span><h2>Other sources and assumptions</h2></div>
      <ul class="method-list">
        <li><strong>Flights (estimate).</strong> Gate-to-gate time is ${F.taxiAndClimb} minutes plus great-circle distance at ${F.cruiseKmh} km/h, plus a fixed ${formatTime(F.airportAllowance)} for getting to the airport, security, boarding and into town. No flight is shown under ${F.minKm} km. Real schedules and whether a direct flight exists aren't checked.</li>
        <li><strong>CO₂e per passenger (estimate).</strong> Uses EU-27 averages from the ${a(N.CO2.src, 'European Environment Agency')}: rail ${N.CO2.railG} g and aviation ${N.CO2.airG} g CO₂e per passenger-km (well-to-wheel, aviation includes non-CO₂ effects ×1.7). Rail distance is the sum of the route's legs × ${N.CO2.railDetour}, and flight distance is the great-circle distance + ${N.CO2.airExtraKm} km. Real rail emissions vary widely with each country's electricity mix.</li>
        <li><strong>Night trains.</strong> ${N.NIGHT.length} city pairs with a regular direct sleeper/couchette service (Nightjet, European Sleeper, EuroNight, Snälltåget, Caledonian Sleeper, Intercités de nuit, Intercity Notte…), compiled from the ${a('https://github.com/Back-on-Track-eu/night-train-data', 'Back-on-Track night-train database')} (26 Oct 2026) and checked against operator pages. They are shown as an alternative and don't count toward journey times. Changes noted: the Paris–Vienna and Paris–Berlin Nightjets ended in Dec 2025; Snälltåget Berlin–Stockholm pauses 8 Jan 2027 until Easter; Nightjet Munich–Rome doesn't run 7 Feb–4 May 2027.</li>
        <li><strong>Deutschlandtakt.</strong> Modelled as a uniform speed-up of German links (−5% by 2030, about −8% by 2035, about −12% by 2040). The ${a('https://www.deutschlandtakt.de/faqs/', 'official FAQ')} stresses that 2030 is a stage, not a completion date.</li>
        <li><strong>Timetable tools used for checking:</strong> ${a('https://fahrplan.oebb.at', 'ÖBB/DB/SBB timetable')}, ${a('https://transport.opendata.ch', 'SBB open data')}, ${a('https://www.sncf-connect.com', 'SNCF Connect')}, ${a('https://www.cp.pt', 'CP')}, ${a('https://www.trenitalia.com', 'Trenitalia')}, ${a('https://www.kombo.co', 'Kombo')}, ${a('https://www.thetrainline.com', 'Trainline')}, ${a('https://www.seat61.com', 'Seat61')}, ${a('https://entur.no', 'Entur')}.</li>
        <li><strong>Map.</strong> ${a('https://leafletjs.com', 'Leaflet')} with Esri Light/Dark Gray Canvas tiles; © OpenStreetMap contributors.</li>
        <li>Project data is also available as <a href="data/projects.json">data/projects.json</a>.</li>
      </ul>
    </section>`;

  const beyond = byYear.beyond.length ? `<p class="small">Not in any scenario (official date after 2040): ${byYear.beyond.map(x => esc(N.PROJECTS[x.id].name)).join(', ')}.</p>` : '';

  document.getElementById('src-main').innerHTML =
    section2026 + [2030, 2035, 2040].map(yearSection).join('') + beyond + sectionRNE + methods;
  document.getElementById('year-nav').innerHTML =
    ['2026', '2030', '2035', '2040'].map(y => `<a href="#y${y}">${y}</a>`).join('') + '<a href="#rne">Capacity strategies</a><a href="#method">Method</a>';
})();
