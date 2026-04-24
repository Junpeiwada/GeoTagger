import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GpxPoint, MatchResult } from './types';

let map: L.Map;
let gpxLayer: L.LayerGroup;
let pinLayer: L.LayerGroup;
let selectedMarker: L.Marker | null = null;
const markerMap = new Map<string, L.Marker>();

const TILES = {
  street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  }),
};

let currentTile: 'street' | 'satellite' = 'street';

export function initMap(elementId: string): void {
  map = L.map(elementId, { zoomControl: true }).setView([35.6, 139.7], 5);
  TILES.street.addTo(map);
  gpxLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);
}

export function toggleMapTile(): void {
  const next: 'street' | 'satellite' = currentTile === 'street' ? 'satellite' : 'street';
  map.removeLayer(TILES[currentTile]);
  TILES[next].addTo(map);
  map.addLayer(gpxLayer);
  map.addLayer(pinLayer);
  currentTile = next;
}

export function drawGpxTrack(points: GpxPoint[]): void {
  gpxLayer.clearLayers();
  if (!points.length) return;
  const latlngs = points.map(p => [p.lat, p.lon] as L.LatLngTuple);
  const line = L.polyline(latlngs, { color: '#4a9eff', weight: 2, opacity: 0.7 });
  gpxLayer.addLayer(line);
  map.fitBounds(line.getBounds(), { padding: [20, 20] });
}

export function drawPhotoPins(
  results: MatchResult[],
  onPinClick: (filePath: string) => void,
): void {
  pinLayer.clearLayers();
  markerMap.clear();
  selectedMarker = null;

  for (const r of results) {
    if (!r.match) continue;
    const { lat, lon } = r.match;
    const marker = L.marker([lat, lon], { icon: makeIcon('red') })
      .bindPopup(`<b>${basename(r.filePath)}</b><br>${fmtUtc(r.utcTime)}<br>${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    marker.on('click', () => onPinClick(r.filePath));
    pinLayer.addLayer(marker);
    markerMap.set(r.filePath, marker);
  }
}

export function highlightPin(filePath: string): void {
  if (selectedMarker) selectedMarker.setIcon(makeIcon('red'));
  const marker = markerMap.get(filePath);
  if (!marker) return;
  marker.setIcon(makeIcon('blue'));
  map.panTo(marker.getLatLng(), { animate: true });
  selectedMarker = marker;
}

function makeIcon(color: 'red' | 'blue'): L.DivIcon {
  const c = color === 'blue' ? '#3498db' : '#e74c3c';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="${c}"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36] });
}

function basename(p: string): string { return p.split('/').pop() ?? p; }
function fmtUtc(d: Date | null): string {
  return d ? d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—';
}
