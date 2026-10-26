// map.js — Leaflet map rendering, city markers, route drawing

const MapModule = (() => {
  let _map = null;
  let _markers = {};         // cityId → Leaflet circleMarker
  let _routeLayer = null;    // current route polyline
  let _onCityClick = null;   // callback

  const MARKER_RADIUS    = 7;
  const MARKER_RADIUS_SEL = 10;
  const COLOR_BASE       = '#8fa3b1';
  const COLOR_ORIGIN     = '#4361ee';
  const COLOR_DEST       = '#e63946';
  const COLOR_ROUTE      = '#4361ee';

  let _tiles = null;
  let _stroke = '#ffffff';

  // Basemap: Esri Light/Dark Gray Canvas (no API key needed).
  // CARTO now requires a free key; to use CARTO Positron / Dark Matter instead,
  // paste your key here (get one at https://carto.com/basemaps/apikey/).
  const CARTO_API_KEY = '';

  const ATTR_ESRI  = 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';
  const ATTR_CARTO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  // Map styles (all keyless Esri basemaps; 'voyager' only appears if a CARTO key is set)
  const ESRI = svc => `https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`;
  const STYLES = {
    grey:      { label: 'Grey (minimal)', light: ESRI('Canvas/World_Light_Gray_Base'), dark: ESRI('Canvas/World_Dark_Gray_Base') },
    street:    { label: 'Street (colourful)', light: ESRI('World_Street_Map') },
    satellite: { label: 'Satellite', light: ESRI('World_Imagery') }
  };
  if (CARTO_API_KEY) STYLES.voyager = { label: 'CARTO Voyager', carto: true,
    light: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
    dark: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}` };
  let _style = 'grey', _dark = false;

  // In dark mode, styles without a dark variant are dimmed via CSS (class on the map container)
  function _tileUrl() {
    const st = STYLES[_style] || STYLES.grey;
    return (_dark && st.dark) || st.light;
  }
  function _applyDim() {
    const st = STYLES[_style] || STYLES.grey;
    document.getElementById('map').classList.toggle('dim-tiles', _dark && !st.dark && _style !== 'satellite');
  }

  function init(onCityClick, dark, style) {
    _onCityClick = onCityClick;
    _stroke = dark ? '#14161f' : '#ffffff';
    _dark = !!dark; _style = STYLES[style] ? style : 'grey';

    _map = L.map('map', {
      center: [50, 10],
      zoom: 5,
      zoomControl: true,
      attributionControl: true
    });

    _tiles = L.tileLayer(_tileUrl(), {
      attribution: STYLES[_style].carto ? ATTR_CARTO : ATTR_ESRI,
      maxZoom: 16
    }).addTo(_map);
    _applyDim();

    _createMarkers();
    _map.fitBounds(CITIES.map(c => [c.lat, c.lng]), { padding: [24, 24] });

    // Resize map when window size changes
    window.addEventListener('resize', () => _map.invalidateSize());
  }

  function _createMarkers() {
    CITIES.forEach(city => {
      const marker = L.circleMarker([city.lat, city.lng], _baseStyle(COLOR_BASE))
        .addTo(_map)
        .bindTooltip(city.name, { permanent: false, direction: 'top', offset: [0, -10] });

      marker.on('click', () => _onCityClick(city.id));
      marker.on('mouseover', function () {
        if (!this.options._selected) {
          this.setStyle({ fillColor: '#6c8097', radius: MARKER_RADIUS + 1 });
        }
      });
      marker.on('mouseout', function () {
        if (!this.options._selected) {
          this.setStyle(_baseStyle(this.options._color || COLOR_BASE));
        }
      });

      _markers[city.id] = marker;
    });
  }

  function _baseStyle(color, selected) {
    return {
      radius:      selected ? MARKER_RADIUS_SEL : MARKER_RADIUS,
      fillColor:   color,
      color:       _stroke,
      weight:      2,
      opacity:     1,
      fillOpacity: 0.95,
      _color:      color,
      _selected:   !!selected
    };
  }

  // Set all markers to base/heatmap colours
  function setMarkerColors(colorMap, selectedId) {
    // colorMap: { cityId → hexColor } or null (reset to base); selectedId: enlarged origin marker
    CITIES.forEach(city => {
      const m = _markers[city.id];
      const color = colorMap ? (colorMap[city.id] || COLOR_BASE) : COLOR_BASE;
      const sel = city.id === selectedId;
      m.setStyle(_baseStyle(color, sel));
      m.options._color = color;
      m.options._selected = sel;
      if (sel && m.bringToFront) m.bringToFront();
    });
  }

  // Highlight origin / destination markers
  function highlightCities(originId, destId) {
    CITIES.forEach(city => {
      const m = _markers[city.id];
      if (city.id === originId) {
        m.setStyle(_baseStyle(COLOR_ORIGIN, true));
        m.options._selected = true;
        m.options._color = COLOR_ORIGIN;
      } else if (city.id === destId) {
        m.setStyle(_baseStyle(COLOR_DEST, true));
        m.options._selected = true;
        m.options._color = COLOR_DEST;
      } else {
        m.setStyle(_baseStyle(COLOR_BASE));
        m.options._selected = false;
        m.options._color = COLOR_BASE;
      }
    });
  }

  // Draw the actual route stop by stop. stops: [{lat, lng, name}] in travel order, or null
  // (no rail link) in which case a dashed line joins the two cities.
  function drawPath(fromId, toId, stops, changeMin) {
    clearRoute();
    _routeLayer = L.layerGroup().addTo(_map);
    if (!stops) {
      const a = CITIES[fromId], b = CITIES[toId];
      L.polyline(getBezierArc(a.lat, a.lng, b.lat, b.lng, 60),
        { color: '#b0b8c4', weight: 2, opacity: 0.6, dashArray: '6 6' }).addTo(_routeLayer);
      return;
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const p = stops[i], q = stops[i + 1];
      L.polyline(getBezierArc(p.lat, p.lng, q.lat, q.lng, 30),
        { color: COLOR_ROUTE, weight: 3.5, opacity: 0.85, lineCap: 'round' }).addTo(_routeLayer);
    }
    // Change points (intermediate stops)
    stops.slice(1, -1).forEach(s => {
      L.circleMarker([s.lat, s.lng], {
        radius: 5, fillColor: '#ffffff', fillOpacity: 1, color: COLOR_ROUTE, weight: 2.5
      }).bindTooltip(`Change at ${s.name} · ${changeMin} min`, { direction: 'top', offset: [0, -6] })
        .addTo(_routeLayer);
    });
  }

  function clearRoute() {
    if (_routeLayer) {
      _map.removeLayer(_routeLayer);
      _routeLayer = null;
    }
  }

  function resetAll() {
    clearRoute();
    setMarkerColors(null);
  }

  function getMap() { return _map; }

  // Swap basemap and marker outline colour; caller re-renders markers afterwards
  function setTheme(dark) {
    _stroke = dark ? '#14161f' : '#ffffff';
    _dark = !!dark;
    if (_tiles) _tiles.setUrl(_tileUrl());
    _applyDim();
  }

  function setBasemap(style) {
    if (!STYLES[style]) return;
    _style = style;
    if (_tiles) {
      _map.removeLayer(_tiles);
      _tiles = L.tileLayer(_tileUrl(), { attribution: STYLES[style].carto ? ATTR_CARTO : ATTR_ESRI,
        maxZoom: STYLES[style].maxZoom || 16 }).addTo(_map);
      _tiles.bringToBack && _tiles.bringToBack();
    }
    _applyDim();
  }

  function styles() { return Object.entries(STYLES).map(([k, v]) => ({ key: k, label: v.label })); }

  return { init, setMarkerColors, highlightCities, drawPath, clearRoute, resetAll, getMap, setTheme, setBasemap, styles };
})();
