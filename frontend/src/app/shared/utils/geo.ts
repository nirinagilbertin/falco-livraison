import { LatLng } from '../../core/models/geo.model';

export function versGeoJson(points: LatLng[]) {
  if (points.length < 3) return null;
  const ring = points.map((p) => [p.lng, p.lat]);
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

export function depuisGeoJson(g: unknown): LatLng[] {
  let geo: any = g;
  if (typeof g === 'string') {
    try {
      geo = JSON.parse(g);
    } catch {
      return [];
    }
  }
  const ring = geo?.type === 'Polygon' ? geo.coordinates?.[0] : null;
  if (!Array.isArray(ring)) return [];
  const pts: LatLng[] = ring.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 1 && first.lat === last.lat && first.lng === last.lng) pts.pop();
  return pts;
}