// Utilitaires géographiques. Convention GeoJSON : les coordonnées sont [longitude, latitude].

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

// Distance à vol d'oiseau entre deux points (formule de haversine), en km
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

// Point dans un anneau (algorithme du rayon)
const pointInRing = (lon, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Polygone : premier anneau = contour extérieur, les suivants = trous
const pointInPolygon = (lon, lat, rings) => {
  if (!Array.isArray(rings) || rings.length === 0 || !pointInRing(lon, lat, rings[0])) return false;
  return !rings.slice(1).some((hole) => pointInRing(lon, lat, hole));
};

// Geometry GeoJSON de type Polygon ou MultiPolygon
const pointInGeometry = (lon, lat, geometry) => {
  if (!geometry || typeof geometry !== 'object') return false;
  if (geometry.type === 'Polygon') return pointInPolygon(lon, lat, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((poly) => pointInPolygon(lon, lat, poly));
  return false;
};

module.exports = { haversineKm, pointInGeometry };