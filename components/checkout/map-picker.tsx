"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";

/**
 * Lazy-loaded pin picker (OpenStreetMap tiles). Click or drag the pin.
 * Loaded only when the customer opens it, so it costs nothing on first paint.
 */
export default function MapPicker({
  center,
  value,
  onChange,
  label,
}: {
  center: { lat: number; lng: number };
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !el.current || map.current) return;
      const start = value ?? center;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(m);
      const icon = L.divIcon({
        className: "",
        html: '<svg width="36" height="44" viewBox="0 0 36 44"><path d="M18 1c9.4 0 17 7.3 17 16.4C35 30 18 43 18 43S1 30 1 17.4C1 8.3 8.6 1 18 1z" fill="#ff8a45" stroke="#12100e" stroke-width="2"/><circle cx="18" cy="17" r="6" fill="#12100e"/></svg>',
        iconSize: [36, 44],
        iconAnchor: [18, 43],
      });
      const mk = L.marker([start.lat, start.lng], { draggable: true, icon, keyboard: true, title: label }).addTo(m);
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e) => {
        mk.setLatLng(e.latlng);
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.current = m;
      marker.current = mk;
      if (!value) onChangeRef.current(start);
    })();
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value && marker.current && map.current) {
      marker.current.setLatLng([value.lat, value.lng]);
    }
  }, [value]);

  return <div ref={el} role="application" aria-label={label} className="h-72 w-full overflow-hidden rounded-xl border border-border-strong" />;
}
