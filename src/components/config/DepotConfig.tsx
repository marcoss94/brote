"use client";

import { useState } from "react";
import { geocodeAddress } from "@/lib/geocoder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { LatLng } from "@/types";

interface DepotConfigProps {
  initialAddress?: string;
  initialCoords?: LatLng | null;
  onSave: (address: string, coords: LatLng) => void;
}

export default function DepotConfig({ initialAddress, initialCoords, onSave }: DepotConfigProps) {
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
      setError("No se pudo geocodificar. Verificá la dirección.");
      setLoading(false);
      return;
    }

    onSave(address, { lat: result.lat, lng: result.lng });
    setEditing(false);
    setLoading(false);
  }

  if (!editing && initialAddress) {
    return (
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-forest-50 text-forest-600 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Depósito</p>
              <p className="text-sm font-medium">{initialAddress}</p>
              {initialCoords && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {initialCoords.lat.toFixed(4)}, {initialCoords.lng.toFixed(4)}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-terra-500/10 text-terra-500 flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Configurar depósito</p>
            <p className="text-xs text-muted-foreground">Punto de partida y retorno</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ej: Av. Brasil 2580, Montevideo"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button onClick={handleSave} disabled={loading || !address.trim()}>
            {loading ? "Buscando..." : "Guardar"}
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
