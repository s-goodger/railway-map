// data.js — base city list, shared globals and helper functions.
// Routes and project metadata are filled in by network.js.
// All times in minutes. null = no reasonable rail connection (>20 hours).

const CITIES = [
  { id: 0, name: 'Paris',     lat: 48.8566, lng:  2.3522, station: 'Gare du Nord / Gare de Lyon' },
  { id: 1, name: 'London',    lat: 51.5317, lng: -0.1262, station: 'St Pancras International' },
  { id: 2, name: 'Berlin',    lat: 52.5251, lng: 13.3694, station: 'Berlin Hauptbahnhof' },
  { id: 3, name: 'Madrid',    lat: 40.4907, lng: -3.6716, station: 'Atocha' },
  { id: 4, name: 'Rome',      lat: 41.9009, lng: 12.5014, station: 'Roma Termini' },
  { id: 5, name: 'Amsterdam', lat: 52.3791, lng:  4.9003, station: 'Amsterdam Centraal' },
  { id: 6, name: 'Brussels',  lat: 50.8358, lng:  4.3366, station: 'Bruxelles-Midi/Zuid' },
  { id: 7, name: 'Vienna',    lat: 48.1860, lng: 16.3779, station: 'Wien Hauptbahnhof' },
  { id: 8, name: 'Warsaw',    lat: 52.2285, lng: 21.0032, station: 'Warszawa Centralna' },
  { id: 9, name: 'Barcelona', lat: 41.3793, lng:  2.1404, station: 'Barcelona Sants' }
];

// Infrastructure project metadata — populated by network.js
const PROJECTS = {};

// ─── ROUTE DATA ───────────────────────────────────────────────────────────────
// Computed at runtime by network.js (fastest train per link + fixed change time)
const ROUTES = [];

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

function getRoute(from, to) {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  return ROUTES.find(r => r.from === a && r.to === b) || null;
}

function getTime(from, to, year) {
  const route = getRoute(from, to);
  if (!route) return null;
  return route.times[`y${year}`];
}

function formatTime(minutes) {
  if (minutes === null || minutes === undefined) return 'No rail link';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

// Return all times for a city vs all others for a given year, sorted ascending
function getAllTimesFrom(cityId, year) {
  return CITIES
    .filter(c => c.id !== cityId)
    .map(c => ({
      city: c,
      minutes: getTime(cityId, c.id, year)
    }))
    .sort((a, b) => {
      if (a.minutes === null) return 1;
      if (b.minutes === null) return -1;
      return a.minutes - b.minutes;
    });
}

// Color scale for travel time (green → yellow → red), null = grey
function timeToColor(minutes) {
  if (minutes === null) return '#b0b8c4';
  if (minutes <= 120)  return interpolateColor('#06d6a0', '#06d6a0', 0);
  if (minutes <= 360)  return interpolateColor('#06d6a0', '#ffd166', (minutes - 120) / 240);
  if (minutes <= 720)  return interpolateColor('#ffd166', '#ef476f', (minutes - 360) / 360);
  return '#ef476f';
}

function interpolateColor(hex1, hex2, t) {
  t = Math.max(0, Math.min(1, t));
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
  const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
  const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// Compute quadratic Bezier arc points between two lat/lng positions
function getBezierArc(lat1, lng1, lat2, lng2, numPts) {
  numPts = numPts || 60;
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const offset = Math.min(dist * 0.22, 4);
  // Perpendicular direction
  const normLat = -dLng / (dist || 1);
  const normLng =  dLat / (dist || 1);
  const cLat = midLat + normLat * offset;
  const cLng = midLng + normLng * offset;
  const pts = [];
  for (let i = 0; i <= numPts; i++) {
    const t = i / numPts;
    const u = 1 - t;
    pts.push([
      u * u * lat1 + 2 * u * t * cLat + t * t * lat2,
      u * u * lng1 + 2 * u * t * cLng + t * t * lng2
    ]);
  }
  return pts;
}
