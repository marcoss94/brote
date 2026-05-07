"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchAddresses, type SearchResult } from "@/lib/geocoder";
import type { LatLng } from "@/types";

interface MapPickerProps {
  initialCenter: LatLng;
  onPick: (coords: LatLng) => void;
  currentPick?: LatLng | null;
}

export default function MapPicker({ initialCenter, onPick, currentPick }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Keep callback stable so init effect never re-runs
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Keep initial center stable — only used on first mount
  const initialCenterRef = useRef(initialCenter);
  const initialPickRef = useRef(currentPick);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // Init map — runs ONCE
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
        zoomControl: true,
        // Mark container for crosshair override
      }).setView(
        [initialCenterRef.current.lat, initialCenterRef.current.lng],
        14
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OSM",
        maxZoom: 18,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "custom-pin",
        html: `<div style="
          width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
          background: #c4704b; border: 3px solid #fff;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          transform: rotate(-45deg);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const initialPick = initialPickRef.current;
      if (initialPick) {
        markerRef.current = L.marker([initialPick.lat, initialPick.lng], {
          icon: pinIcon,
        }).addTo(map);
      }

      const setPin = (lat: number, lng: number) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
        }
        onPickRef.current({ lat, lng });
      };

      map.on("click", (e: L.LeafletMouseEvent) => {
        setPin(e.latlng.lat, e.latlng.lng);
      });

      // Crosshair cursor on map panes
      const mapEl = mapRef.current;
      if (mapEl) mapEl.style.cursor = "crosshair";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any)._brotePick = setPin;

      mapInstance.current = map;
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const res = await searchAddresses(query);
      setResults(res);
      setSearching(false);
      setShowDropdown(true);
    }, 400);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  function handleSelect(r: SearchResult) {
    setQuery(r.display_name);
    setShowDropdown(false);

    const map = mapInstance.current;
    if (!map) return;

    map.setView([r.lat, r.lng], 17);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map as any)._brotePick?.(r.lat, r.lng);
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative z-[1100]">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Buscar dirección, calle, barrio..."
            className="pl-9"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
              Buscando...
            </span>
          )}
        </div>

        {/* Dropdown — sits above map via high z-index */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-[1100] max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border last:border-0 flex items-start gap-2"
              >
                <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-[520px] rounded-lg border border-border cursor-crosshair"
      />
    </div>
  );
}
