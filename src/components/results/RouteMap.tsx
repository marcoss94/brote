"use client";

import { useEffect, useRef, useState } from "react";
import type { RouteStop, LatLng } from "@/types";

interface RouteMapProps {
  route: RouteStop[];
  depot: LatLng;
  selectedId?: string | null;
  onClearSelection?: () => void;
}

export default function RouteMap({ route, depot, selectedId, onClearSelection }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const onClearRef = useRef(onClearSelection);
  onClearRef.current = onClearSelection;
  const didInitialFit = useRef(false);
  const [ready, setReady] = useState(false);

  // Init map ONCE
  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((container as any)._leaflet_id) return;

    import("leaflet").then((L) => {
      import("leaflet/dist/leaflet.css");
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

      // Depot marker — never changes
      const depotIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: #f19d76; border: 3px solid #fff;
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
          `<div style="font-family: 'Open Sans', sans-serif">
            <strong style="color: #232323">Depósito</strong><br/>
            <span style="color: #7c9a82; font-size: 11px">Punto de partida y retorno</span>
          </div>`
        );

      // Layer group holds all dynamic markers + polyline (reactive to route changes)
      const layer = L.layerGroup().addTo(map);

      // Click on empty map area clears selection
      map.on("click", () => {
        onClearRef.current?.();
      });

      mapInstance.current = map;
      layerRef.current = layer;
      LRef.current = L;
      setReady(true);
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        layerRef.current = null;
        LRef.current = null;
      }
    };
  }, [depot.lat, depot.lng]);

  // Update markers + polyline when route changes
  useEffect(() => {
    const map = mapInstance.current;
    const layer = layerRef.current;
    const L = LRef.current;
    if (!map || !layer || !L) return;

    layer.clearLayers();
    markersRef.current.clear();

    const points: L.LatLng[] = [L.latLng(depot.lat, depot.lng)];

    route.forEach((stop) => {
      const isSelected = stop.numero_pedido === selectedId;
      const stopIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width: ${isSelected ? 40 : 30}px; height: ${isSelected ? 40 : 30}px; border-radius: 50%;
          background: ${isSelected ? "#f19d76" : "#232323"};
          border: ${isSelected ? 4 : 2.5}px solid #fff;
          box-shadow: 0 ${isSelected ? 6 : 2}px ${isSelected ? 16 : 8}px rgba(0,0,0,${isSelected ? 0.35 : 0.15});
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: ${isSelected ? 14 : 12}px; font-weight: 700;
          font-family: 'Open Sans', sans-serif;
          transition: all 0.2s ease;
        ">${stop.orden}</div>`,
        iconSize: [isSelected ? 40 : 30, isSelected ? 40 : 30],
        iconAnchor: [isSelected ? 20 : 15, isSelected ? 20 : 15],
      });

      const marker = L.marker([stop.lat, stop.lng], {
        icon: stopIcon,
        zIndexOffset: isSelected ? 1000 : 0,
      })
        .bindPopup(
          `<div style="font-family: 'Open Sans', sans-serif">
            <strong style="color: #232323">${stop.cliente}</strong><br/>
            <span style="color: #666; font-size: 12px">${stop.direccion}</span>
            ${stop.detalle_direccion ? `<br/><span style="color: #232323; font-size: 12px; font-weight: 600">${stop.detalle_direccion}</span>` : ""}
            <div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
              <span style="background: #e1f5e7; color: #265a33; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600">
                #${stop.orden}
              </span>
              ${stop.hora_estimada ? `<span style="background: #e1f5e7; color: #265a33; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600">ETA ${stop.hora_estimada}</span>` : ""}
              ${stop.franja && stop.franja !== "—-—" ? `<span style="background: #fff; color: #c67a55; border: 1px solid #f4b193; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600">Franja ${stop.franja}</span>` : ""}
            </div>
          </div>`
        )
        .addTo(layer);

      markersRef.current.set(stop.numero_pedido, marker);
      points.push(L.latLng(stop.lat, stop.lng));
    });

    points.push(L.latLng(depot.lat, depot.lng));

    L.polyline(points, {
      color: "#f19d76",
      weight: 3,
      opacity: 0.8,
      dashArray: "8, 8",
      lineCap: "round",
    }).addTo(layer);

    // Fit bounds on first render with real route data (not on subsequent reorders)
    if (!didInitialFit.current && route.length > 0 && points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
      didInitialFit.current = true;
    }
  }, [route, depot.lat, depot.lng, ready, selectedId]);

  // Open popup + pan only if marker is outside current viewport (no zoom change)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (!selectedId) {
      map.closePopup();
      return;
    }
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;
    const latlng = marker.getLatLng();
    if (!map.getBounds().pad(-0.1).contains(latlng)) {
      map.panTo(latlng, { animate: true, duration: 0.4 });
    }
    marker.openPopup();
  }, [selectedId]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden h-full flex flex-col shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-border flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            <line x1="9" y1="3" x2="9" y2="18"/>
            <line x1="15" y1="6" x2="15" y2="21"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-foreground">Mapa de ruta</p>
        {!ready && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            Cargando mapa...
          </span>
        )}
      </div>
      <div ref={mapRef} className="flex-1 w-full min-h-[500px]" />
    </div>
  );
}
