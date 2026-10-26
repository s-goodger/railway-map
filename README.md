# European Rail Travel Times: Now vs Future

An interactive prototype comparing the fastest rail journeys between 73 European cities today (2026) with projected times in 2030, 2035 and 2040, as planned infrastructure projects open.

## How to open

Open `index.html` in any modern browser. No server or build step is needed. Leaflet, the Inter font and the map tiles load from the internet.

## What it does

**Route Comparison** (default). Click an origin, then a destination. The side panel shows:
- a bar chart of the four scenario years;
- a **train vs plane** card with an estimated door-to-door flight time (see caveats);
- the **legs** of the journey in the selected year: each direct train, its time, a confidence mark (✓ timetable-confirmed, ~ secondary source, ? estimate, ◆ planned new line) and a link to the source;
- the route for each scenario year, with badges naming the projects that cut the time;
- **project cards**: official project page, official target date, current status and a link to the source of that date.

The map draws the route stop by stop, with white dots at each change. Hover a dot to see the change point.

**Isochrone Heatmap.** Click one city to colour every other city by travel time (green ≤2h → yellow ~6h → red ≥12h, grey = no rail link under 20h). The side panel ranks the cities.

**Settings** (top of the side panel, remembered in the browser):
- **Time per change**: 10–60 minutes, default 10. It is added once for every change of train.
- **Project opening dates**: *Official* places each project in the first scenario year at or after its official target date. *Conservative* adds 4 years to every official date, roughly the typical slippage on large European rail projects.

A 🌙/☀️ toggle switches dark mode.

**Other features:**
- **Find a city.** Type a name in the side panel; picking one is the same as clicking it on the map.
- **Map style.** Choose Grey (minimal, the default), Street (colourful) or Satellite. All are keyless Esri basemaps, and a CARTO Voyager option appears if you set a CARTO key in `js/map.js`. In dark mode, styles without a dark version are dimmed.
- **CO₂e per passenger.** Rail versus plane per trip, using EEA EU-27 averages (see caveats).
- **Night trains.** Direct sleeper or couchette services are listed for 137 city pairs. They don't count toward the journey times.
- **Export.** "Download all journey times (CSV)" saves every pair under the current settings: times by year, route, changes, flight estimate, CO₂ and night trains. "⤓ Image" saves the current comparison panel as a PNG. Image export needs an internet connection for the html2canvas library.

**Sources & projects page.** The link under the title opens `sources.html`. It is organised year by year: the 2026 timetable sources for all 278 links, then the projects in each of the 2030, 2035 and 2040 scenarios. Each project has a short description, its official target, its status, its conservative-mode year and links to its official page and date source. The page is built from `js/network.js`, so it always matches the map.

## How journey times are calculated

`js/network.js` models the network as **278 direct rail links**. Each link uses the **fastest scheduled train** on that link, from 2026 timetables including the 13 December 2026 timetable change. The browser finds the fastest path between every pair of cities, adds the chosen change time at each interchange, and treats anything over 20 hours as "no reasonable rail link". It recalculates all 2,628 pairs, about 0.2 s, whenever a setting changes.

Infrastructure projects are modelled as faster times on specific links or as new links, at their design journey times (e.g. Lyon–Turin: Paris–Milan ~4h; Fehmarn Belt: Hamburg–Copenhagen 2h30).

### Data verification (October 2026)

Every link was checked against operator timetables (DB/ÖBB/SBB timetable data, SNCF Connect, CP, Trenitalia) or timetable aggregators (Kombo, Trainline, Seat61, Entur):

| Confidence | Links |
|---|---|
| ✓ high (timetable/operator page) | 165 |
| ~ medium (reliable secondary source) | 107 |
| ? low (unconfirmed estimate) | 6: Luxembourg–Cologne, Bilbao–San Sebastián, San Sebastián–Hendaye, Nice–Ventimiglia, Ventimiglia–Milan, Helsinki–Oulu |

The full list with notes and source URLs is in `data/links.csv`.

Notable 2026 conditions reflected in the data:
- **Spain.** Madrid–Barcelona is 3h02, not the usual 2h30, and Madrid–Valencia is also slower, because of speed limits after the January 2026 Adamuz accident. The limits are scheduled to end with 2026.
- **Berlin–Hamburg** reopened in June 2026 (1h47).
- **New trains.** A direct Prague–Berlin–Copenhagen ComfortJet runs since May 2026, a direct Riga–Tallinn train since January 2026, and a Naples–Bari Frecciarossa via the new Naples–Cancello link since July 2026.
- **Stockholm–Copenhagen.** SJ's X2000 is suspended until 13 December 2026. The usual ~5h15 is used.

### Projects and official dates

All 34 projects in `data/projects.json` have an official project page and the source of their current target date (checked October 2026). Recent changes:
- **Brenner Base Tunnel** slipped to 2034 (announced 20 October 2026).
- **Stuttgart 21** was re-planned in June 2026: main station December 2031.
- **Fehmarn Belt** will open in two stages, with rail no earlier than 2032.
- **HS2's** reset in May 2026 puts first services in 2036–2039. They run Old Oak Common–Birmingham in about 45 min, modelled as 55 min to central London. Manchester and Scotland trains only gain once Euston and the Handsacre link open (2040–2043, beyond 2040), so no Manchester saving is modelled.
- **Official stated targets** now drive these projects:
  - CPK: Warsaw–Łódź 40 min (2032); Warsaw–Poznań and Warsaw–Wrocław 1h40, Łódź–Poznań and Łódź–Wrocław 1h (2035).
  - Bordeaux–Toulouse 1h05 and Paris–Toulouse 3h10.
  - Prague–Brno 1h.
  - Semmering: Vienna–Graz under 2h, about −25 min on journeys south of Vienna.
  - Berlin–Dresden 80 min (2033).
  - Danish Funen upgrades: about −11 min on Copenhagen–Jutland.
  - Plzeň–Domažlice: −10 min on Munich–Prague.

### RNE capacity strategies

The infrastructure managers' Capacity Strategies published via [RailNetEurope](https://rne.eu/capacity-management/acp/capacity-strategies/) were read in October 2026: the TT2030 drafts, plus the TT2029 or TT2028 editions where no newer one exists, for every country with a city on the map. Only three projects in them come with a journey-time figure in minutes:
- **Stuttgart 21: ~15 min.** It is now modelled on through links (Stuttgart–Munich, Paris–Munich, Strasbourg–Munich), replacing the earlier ~8 min assumption.
- **Karlsruhe–Offenburg (Rastatt section, Dec 2026): ~3 min.** Added as a new project in the 2030 scenario.
- **Dresdner Bahn: ~10 min.** Not added, because it opened in December 2025 and is already in the 2026 timetable times.

The documents name 24 other upgrades on the map's links without saying how much time they save, such as the Danish 180→200 km/h programme and Fortezza–Ponte Gardena. These are listed on the sources page but not modelled, along with a selection of major closures planned for 2027–2030 and date cross-checks for each project.

Some projects have no formal date, so the best official statement is used and the card says so: the Basque Y (2030 is this tool's estimate), Prague–Brno (~2035, indicative), GPSO (2032 target that advisers doubt) and the Rail Baltica Polish section.

### Cities added in the latest update

The latest update added Stuttgart, Basel, Geneva, Nuremberg, Venice, Verona, Graz, Porto, Kaunas, Nice, Dresden, Leipzig, Hanover, Antwerp, Rotterdam, Helsinki, Dublin, Athens, Bucharest, Sofia and Belgrade. Their links come from timetables, mostly the ÖBB journey planner's December 2026 data. Stated targets added with them:
- Frankfurt–Mannheim new line: −9 min (2037).
- Pfaffensteig tunnel: −15 min Stuttgart–Zurich (2033).
- Budapest–Belgrade: 2h40 (Serbian government target; first through trains 3h17 from Dec 2026).
- LNPCA: −20 min for Paris/Lyon–Nice TGVs crossing Marseille (2032).
- Rail Baltica: Vilnius–Kaunas 38 min, Riga–Kaunas 1h32, Vilnius–Kaunas–Warsaw 3h52.
- Porto–Vigo: 50 min (2033).
- Lisbon–Porto: 1h19 non-stop (~2033).
- Athens–Thessaloniki: 3h (date estimated).
- The Dresden–Prague new line (1h, end of 2044) is listed but falls beyond 2040.

Temporary conditions in 2026:
- The Hanover–Berlin line is closed until Dec 2027, so Hanover/Cologne/Amsterdam–Berlin trains are about 70 min slower in the 2026 figures. Normal running returns from 2030.
- Several Balkan and Greek cross-border trains are suspended. Helsinki, Dublin and Athens have no rail link under 20 hours to any other city. These cities, plus Bucharest, Sofia and Belgrade, carry a short explanatory note in the panel.

## Caveats

- **Best case.** Times use the fastest train on every leg and a fixed change time. Real trips are often slower: connections don't always line up, crossing Paris or London between stations takes 45–60 minutes, and Eurostar check-in is about 30 minutes. Raise the change-time slider for a more realistic view.
- **Leg-chaining.** Combining the fastest legs can beat a through train. For example, London–Rome via Paris, Turin and Milan is quicker than via the direct Paris–Milan train. Such routes may not be bookable as one ticket.
- **Flights are estimates, not schedules.** Gate-to-gate time is 35 minutes plus great-circle distance at 800 km/h. A fixed 2h30 is added for getting to the airport, security, boarding and into the city. The estimate ignores whether a direct flight exists. Pairs under 300 km show no flight.
- **Future scenarios are illustrative.** Deutschlandtakt is a uniform speed-up of German links (−5% by 2030, about −8% by 2035, about −12% by 2040). Access lines often lag the headline tunnels.
- Not modelled: night trains, ferries (e.g. Stockholm–Tallinn), Dresden–Prague, Götalandsbanan, Northern Powerhouse Rail.

## File structure

```
/railway-map
├── index.html            Entry point (map)
├── sources.html          Sources & projects page
├── css/styles.css        Styling (light + dark themes)
├── css/sources.css       Sources page styling
├── js/
│   ├── data.js           Base cities and helper functions
│   ├── network.js        Rail links, projects, routing engine, flight estimate
│   ├── map.js            Leaflet map, markers, route drawing
│   ├── comparison.js     Side panel: chart, legs, flights, projects, heatmap list
│   ├── app.js            State, settings, click handling
│   └── sources.js        Builds the sources page
└── data/
    ├── projects.json     Project metadata (generated from network.js)
    └── links.csv         All 278 links with times, confidence and sources
```

To change a link time or a project date, edit `js/network.js`.

## Technologies

Leaflet 1.9.4; Esri Light/Dark Gray Canvas tiles (no API key; CARTO now needs a key, which you can set via `CARTO_API_KEY` in `js/map.js`); Inter via Google Fonts; plain HTML, CSS and JavaScript.
