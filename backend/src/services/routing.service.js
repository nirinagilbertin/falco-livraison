const { haversineKm } = require('../utils/geo');

const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map();

const round2 = (n) => Math.round(n * 100) / 100;
const cacheKey = (a, b) => `${a.latitude.toFixed(5)},${a.longitude.toFixed(5)};${b.latitude.toFixed(5)},${b.longitude.toFixed(5)}`;

// Repli : ligne droite et distance à vol d'oiseau
const straightLine = (a, b) => ({
  distance_km: round2(haversineKm(a.latitude, a.longitude, b.latitude, b.longitude)),
  duree_min: null,
  geometrie: { type: 'LineString', coordinates: [[a.longitude, a.latitude], [b.longitude, b.latitude]] },
  approximation: true,
});

// Itinéraire routier via OSRM (serveur public par défaut ; en production, prévoir sa propre instance)
const fetchOsrm = async (a, b) => {
  const base = (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  const url = `${base}/route/v1/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=geojson`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const route = data.code === 'Ok' && data.routes && data.routes[0];
    if (!route) throw new Error(`OSRM ${data.code}`);
    return {
      distance_km: round2(route.distance / 1000),
      duree_min: Math.round(route.duration / 60),
      geometrie: route.geometry,
      approximation: false,
    };
  } finally {
    clearTimeout(timer);
  }
};

// from / to : { latitude, longitude }. Ne lève jamais d'erreur : en cas d'échec, repli sur la ligne droite.
const getRoute = async (from, to) => {
  if ((process.env.ROUTING_PROVIDER || 'osrm') === 'none') return straightLine(from, to);

  const key = cacheKey(from, to);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  try {
    const value = await fetchOsrm(from, to);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.warn(`Itinéraire routier indisponible (${err.message}) : distance à vol d'oiseau utilisée`);
    return straightLine(from, to);
  }
};

const getDistanceKm = async (from, to) => (await getRoute(from, to)).distance_km;

module.exports = { getRoute, getDistanceKm };