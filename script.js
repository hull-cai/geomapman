// BGS detailed geology WMS endpoint (1:50 000 scale themes)
const BGS_WMS_BASE =
  'https://map.bgs.ac.uk/arcgis/services/BGS_Detailed_Geology/MapServer/WMSServer';

// Manchester city centre reference point.
const MANCHESTER_CENTER = [53.4808, -2.2426];

const statusText = document.getElementById('statusText');
const retryBtn = document.getElementById('retryBtn');

const map = L.map('map', {
  center: MANCHESTER_CENTER,
  zoom: 12,
  minZoom: 6,
  maxZoom: 19,
});

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
});
osm.addTo(map);

// WMS defaults used by each BGS layer.
const geologyWmsDefaults = {
  format: 'image/png',
  transparent: true,
  version: '1.3.0',
  attribution:
    'Contains British Geological Survey materials © UKRI 2026. Data from BGS WMS.',
};

const geologyDefinitions = [
  {
    label: 'Bedrock Geology',
    layerName: 'GBR_BGS_625k_BLT_Bedrock',
  },
  {
    label: 'Superficial Deposits',
    layerName: 'GBR_BGS_625k_SLT_Superficial_deposits',
  },
  {
    label: 'Artificial Ground',
    layerName: 'GBR_BGS_625k_AGT_Artificial_ground',
  },
  {
    label: 'Linear Features',
    layerName: 'GBR_BGS_625k_FLT_Faults',
  },
];

const geologyLayers = {};
let tileErrorCount = 0;

for (const { label, layerName } of geologyDefinitions) {
  const layer = L.tileLayer.wms(BGS_WMS_BASE, {
    ...geologyWmsDefaults,
    layers: layerName,
  });

  // Show a visible warning if WMS tiles fail to load.
  layer.on('tileerror', () => {
    tileErrorCount += 1;
    setStatus(
      `Warning: BGS geology tiles are failing to load (errors: ${tileErrorCount}). You can retry.`,
      'warn'
    );
  });

  geologyLayers[label] = layer;
}

// Start with bedrock enabled by default.
geologyLayers['Bedrock Geology'].addTo(map);

L.control
  .layers(
    {
      OpenStreetMap: osm,
    },
    geologyLayers,
    { collapsed: false }
  )
  .addTo(map);

retryBtn.addEventListener('click', () => {
  tileErrorCount = 0;
  for (const layer of Object.values(geologyLayers)) {
    if (map.hasLayer(layer)) {
      layer.redraw();
    }
  }
  setStatus('Retry requested. Re-loading active geology layers…', 'ok');
});

// Query visible geology layers with GetFeatureInfo on click.
map.on('click', async (event) => {
  const activeLayerNames = geologyDefinitions
    .filter(({ label }) => map.hasLayer(geologyLayers[label]))
    .map(({ layerName }) => layerName);

  if (activeLayerNames.length === 0) {
    L.popup()
      .setLatLng(event.latlng)
      .setContent('Enable at least one geology layer to query map attributes.')
      .openOn(map);
    return;
  }

  try {
    const featureInfo = await fetchFeatureInfo(event.latlng, activeLayerNames);
    L.popup().setLatLng(event.latlng).setContent(featureInfo).openOn(map);
  } catch (error) {
    console.error(error);
    setStatus(
      'Warning: Could not query geology attributes from BGS right now. Try again shortly.',
      'warn'
    );
    L.popup()
      .setLatLng(event.latlng)
      .setContent('Unable to load geology attributes right now.')
      .openOn(map);
  }
});

function setStatus(message, level = 'ok') {
  statusText.textContent = message;
  statusText.classList.toggle('status--warn', level === 'warn');
  statusText.classList.toggle('status--ok', level !== 'warn');
}

async function fetchFeatureInfo(latlng, activeLayerNames) {
  const size = map.getSize();
  const point = map.latLngToContainerPoint(latlng, map.getZoom());
  const bounds = map.getBounds();

  // WMS 1.3.0 uses CRS=EPSG:4326 axis order latitude,longitude for BBOX.
  const bbox = [
    bounds.getSouth(),
    bounds.getWest(),
    bounds.getNorth(),
    bounds.getEast(),
  ].join(',');

  const params = new URLSearchParams({
    service: 'WMS',
    request: 'GetFeatureInfo',
    version: '1.3.0',
    crs: 'EPSG:4326',
    bbox,
    width: Math.round(size.x).toString(),
    height: Math.round(size.y).toString(),
    i: Math.round(point.x).toString(),
    j: Math.round(point.y).toString(),
    layers: activeLayerNames.join(','),
    query_layers: activeLayerNames.join(','),
    info_format: 'application/json',
    feature_count: '8',
  });

  const url = `${BGS_WMS_BASE}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`GetFeatureInfo failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    return renderFeatureInfoFromJson(data);
  }

  // Fallback for services that answer with plain text/html instead of JSON.
  const fallbackText = await response.text();
  if (!fallbackText.trim()) {
    return 'No geology features found at this location.';
  }

  return `<pre style="max-width:280px;white-space:pre-wrap;">${escapeHtml(
    fallbackText
  )}</pre>`;
}

function renderFeatureInfoFromJson(data) {
  const features = data?.features || [];
  if (!features.length) {
    return 'No geology features found at this location.';
  }

  const prioritizedFields = [
    'LEX_D',
    'LEX_RCS_D',
    'ROCK',
    'AGE',
    'MAX_AGE',
    'MIN_AGE',
    'DESCRIPTN',
    'FEATURE',
  ];

  const cards = features.slice(0, 4).map((feature, index) => {
    const props = feature.properties || {};
    const entries = prioritizedFields
      .map((key) => [key, props[key]])
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');

    if (!entries.length) {
      return `<p><strong>Feature ${index + 1}</strong><br/>No common geology attributes returned.</p>`;
    }

    const rows = entries
      .map(
        ([key, value]) =>
          `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`
      )
      .join('');

    return `<p><strong>Feature ${index + 1}</strong></p><dl class="popup-grid">${rows}</dl>`;
  });

  return cards.join('<hr/>');
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
