import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { LatLng } from '../../../core/models/geo.model';

const CENTRE: L.LatLngTuple = [-21.45, 47.08];
const arrondi = (n: number) => Math.round(n * 1e6) / 1e6;

@Component({
  selector: 'app-map-picker',
  templateUrl: './map-picker.html',
  styleUrl: './map-picker.css',
})
export class MapPicker implements AfterViewInit, OnDestroy {
  mode = input<'point' | 'polygon'>('point');
  point = input<LatLng | null>(null);
  polygon = input<LatLng[]>([]);
  lecture = input(false);

  pointChange = output<LatLng>();
  polygonChange = output<LatLng[]>();

  private conteneur = viewChild.required<ElementRef<HTMLDivElement>>('carte');
  private map?: L.Map;
  private couche = L.layerGroup();
  private observer?: ResizeObserver;

  constructor() {
    effect(() => {
      this.mode();
      this.point();
      this.polygon();
      this.dessiner();
    });
  }

  ngAfterViewInit() {
    this.map = L.map(this.conteneur().nativeElement).setView(CENTRE, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);
    this.couche.addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.lecture()) return;
      const p = { lat: arrondi(e.latlng.lat), lng: arrondi(e.latlng.lng) };
      if (this.mode() === 'point') this.pointChange.emit(p);
      else this.polygonChange.emit([...this.polygon(), p]);
    });

    // la carte est souvent affichée dans une boîte de dialogue animée
    this.observer = new ResizeObserver(() => this.map?.invalidateSize());
    this.observer.observe(this.conteneur().nativeElement);

    this.dessiner();
  }

  private dessiner() {
    const map = this.map;
    if (!map) return;
    this.couche.clearLayers();
    const style = { color: '#2563eb', fillColor: '#2563eb' };

    if (this.mode() === 'point') {
      const p = this.point();
      if (!p) return;
      const ll = L.latLng(p.lat, p.lng);
      L.circleMarker(ll, { ...style, radius: 9, fillOpacity: 0.8 }).addTo(this.couche);
      if (!map.getBounds().contains(ll)) map.setView(ll, 14);
      return;
    }

    const pts = this.polygon().map((p) => L.latLng(p.lat, p.lng));
    if (pts.length >= 3) L.polygon(pts, { ...style, fillOpacity: 0.2 }).addTo(this.couche);
    else if (pts.length === 2) L.polyline(pts, style).addTo(this.couche);
    pts.forEach((ll) => L.circleMarker(ll, { ...style, radius: 5, fillOpacity: 1 }).addTo(this.couche));

    if (pts.length) {
      const bounds = L.latLngBounds(pts);
      if (!map.getBounds().contains(bounds)) map.fitBounds(bounds, { maxZoom: 15 });
    }
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.map?.remove();
  }
}