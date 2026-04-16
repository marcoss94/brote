"use client";

import { useState } from "react";
import { geocodeAddress } from "@/lib/geocoder";
import type { LatLng } from "@/types";

interface DepotConfigProps {
  initialAddress?: string;
  initialCoords?: LatLng | null;
  onSave: (address: string, coords: LatLng) => void;
}

export default function DepotConfig({
  initialAddress,
  initialCoords,
  onSave,
}: DepotConfigProps) {
  const [address, setAddress] = useState(initialAddress || "");
  const [editing, setEditing] = useState(!initialAddress);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!address.trim()) return;
    setLoading(true);
    setError("");

    const result = await geocodeAddress(address);
    if (!result) {
      setError("No se pudo geocodificar la dirección. Verificá que sea correcta.");
      setLoading(false);
      return;
    }

    onSave(address, { lat: result.lat, lng: result.lng });
    setEditing(false);
    setLoading(false);
  }

  if (!editing && initialAddress) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-forest-100 text-forest-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-forest-800/50 mb-0.5">
                Depósito / Punto de partida
              </p>
              <p className="text-sm font-medium text-forest-950">{initialAddress}</p>
              {initialCoords && (
                <p className="text-[11px] text-sage-400 mt-0.5">
                  {initialCoords.lat.toFixed(4)}, {initialCoords.lng.toFixed(4)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-forest-600 hover:text-forest-800 font-medium transition-colors"
          >
            Editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-scale-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-terra-500/10 text-terra-500 flex items-center justify-center">
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-forest-950">
            Configurar depósito
          </p>
          <p className="text-xs text-forest-800/50">
            Dirección desde donde salen y vuelven las entregas
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Ej: Av. Brasil 2580, Montevideo"
          className="flex-1 bg-cream-50 border border-border rounded-xl px-4 py-2.5 text-sm text-forest-950 placeholder:text-sage-300 focus:outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-400/20 transition-all"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <button
          onClick={handleSave}
          disabled={loading || !address.trim()}
          className="bg-forest-700 hover:bg-forest-800 disabled:opacity-50 text-cream-50 font-medium px-5 py-2.5 rounded-xl text-sm transition-all duration-200 whitespace-nowrap"
        >
          {loading ? "Buscando..." : "Guardar"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-terra-500 mt-2 animate-slide-down">{error}</p>
      )}
    </div>
  );
}
