"use client";

import { useEffect, useRef, useState } from "react";
import type { RouteStop, LatLng } from "@/types";

interface RouteMapProps {
  route: RouteStop[];
  depot: LatLng;
}

export default function RouteMap({ route, depot }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;

    // Prevent double init from React strict mode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((container as any)._leaflet_id) return;

    // Dynamic import to avoid SSR issues
    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");

      // Guard: div may have been cleaned up or already initialized during async import
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!mapRef.current || (mapRef.current as any)._leaflet_id) return;

      const map = L.map(mapRef.current, {
        zoomControl: false,
      }).setView([depot.lat, depot.lng], 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
        maxZoom: 18,
      }).addTo(map);

      // Depot marker
      const depotIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: #c4704b; border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 14px; font-weight: bold;
        ">🏠</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([depot.lat, depot.lng], { icon: depotIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: 'DM Sans', sans-serif">
            <strong style="color: #1a3a2a">Depósito</strong><br/>
            <span style="color: #7c9a82; font-size: 11px">Punto de partida y retorno</span>
          </div>`
        );

      // Route stops
      const points: L.LatLng[] = [L.latLng(depot.lat, depot.lng)];

      route.forEach((stop) => {
        const stopIcon = L.divIcon({
          className: "custom-marker",
          html: `<div style="
            width: 30px; height: 30px; border-radius: 50%;
            background: #3d7558; border: 2.5px solid #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 12px; font-weight: 700;
            font-family: 'DM Sans', sans-serif;
          ">${stop.orden}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        L.marker([stop.lat, stop.lng], { icon: stopIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: 'DM Sans', sans-serif">
              <strong style="color: #1a3a2a">${stop.cliente}</strong><br/>
              <span style="color: #666; font-size: 12px">${stop.direccion}</span><br/>
              <div style="margin-top: 6px; display: flex; gap: 8px;">
                <span style="background: #e4f3ea; color: #3d7558; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600">
                  ${stop.hora_estimada}
                </span>
                <span style="background: #f5f0e8; color: #a85a38; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600">
                  ${stop.franja}
                </span>
              </div>
            </div>`
          );

        points.push(L.latLng(stop.lat, stop.lng));
      });

      // Return to depot
      points.push(L.latLng(depot.lat, depot.lng));

      // Draw route line
      L.polyline(points, {
        color: "#3d7558",
        weight: 3,
        opacity: 0.7,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(map);

      // Fit bounds
      if (points.length > 1) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      mapInstance.current = map;
      setReady(true);
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [depot, route]);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-scale-in">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-forest-100 text-forest-600 flex items-center justify-center">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            <line x1="9" y1="3" x2="9" y2="18"/>
            <line x1="15" y1="6" x2="15" y2="21"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-forest-950">Mapa de ruta</p>
        {!ready && (
          <span className="text-[11px] text-sage-400 animate-pulse-gentle ml-auto">
            Cargando mapa...
          </span>
        )}
      </div>
      <div ref={mapRef} className="h-[400px] w-full" />
    </div>
  );
}
