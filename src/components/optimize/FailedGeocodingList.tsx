"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { geocodeAddress } from "@/lib/geocoder";
import { toast } from "sonner";
import type { Order, GeocodedOrder, LatLng } from "@/types";

const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

interface FailedGeocodingListProps {
  failedOrders: Order[];
  depot: LatLng;
  onResolve: (order: Order, coords: LatLng) => void;
  onCancel?: () => void;
  resolvedIds: Set<string>;
}

export default function FailedGeocodingList({
  failedOrders,
  depot,
  onResolve,
  onCancel,
  resolvedIds,
}: FailedGeocodingListProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [pickingOrder, setPickingOrder] = useState<Order | null>(null);
  const [pickedCoords, setPickedCoords] = useState<LatLng | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});

  const pendingOrders = failedOrders.filter((o) => !resolvedIds.has(o.numero_pedido));

  if (pendingOrders.length === 0) {
    return (
      <Card className="border-forest-200 bg-muted/40">
        <CardContent className="py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm text-foreground">
            Todas las direcciones resueltas. Ya podés optimizar.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleRetry(order: Order) {
    const newAddress = edited[order.numero_pedido] ?? order.direccion;
    if (!newAddress.trim()) return;
    setRetryingId(order.numero_pedido);
    const result = await geocodeAddress(newAddress, order.ciudad || "Montevideo");
    setRetryingId(null);

    if (result) {
      onResolve({ ...order, direccion: newAddress }, { lat: result.lat, lng: result.lng });
      toast.success(`"${order.cliente}" resuelto`);
    } else {
      toast.error("Sigue sin encontrar. Probá editar o elegir en mapa.");
    }
  }

  function handleOpenMap(order: Order) {
    setPickingOrder(order);
    setPickedCoords(null);
  }

  function handleConfirmPick() {
    if (!pickingOrder || !pickedCoords) return;
    // Prefer user-edited address text over original failed one
    const editedText = edited[pickingOrder.numero_pedido]?.trim();
    const direccion = editedText && editedText.length > 0 ? editedText : pickingOrder.direccion;
    onResolve({ ...pickingOrder, direccion }, pickedCoords);
    toast.success(`"${pickingOrder.cliente}" ubicado en mapa`);
    setPickingOrder(null);
    setPickedCoords(null);
  }

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {pendingOrders.length} {pendingOrders.length === 1 ? "dirección sin resolver" : "direcciones sin resolver"}
              </CardTitle>
              <CardDescription className="mt-1">
                Editá la dirección y reintentá, o elegí la ubicación en el mapa.
              </CardDescription>
            </div>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="flex-shrink-0 text-muted-foreground"
              >
                Empezar de nuevo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {pendingOrders.map((order) => {
            const currentValue = edited[order.numero_pedido] ?? order.direccion;
            const isRetrying = retryingId === order.numero_pedido;
            return (
              <div
                key={order.numero_pedido}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {order.cliente}
                  </p>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    #{order.numero_pedido}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={currentValue}
                    onChange={(e) =>
                      setEdited({ ...edited, [order.numero_pedido]: e.target.value })
                    }
                    className="flex-1 h-8 text-xs"
                    placeholder="Dirección..."
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetry(order)}
                    disabled={isRetrying}
                  >
                    {isRetrying ? "Buscando..." : "Reintentar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenMap(order)}
                    title="Elegir en mapa"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Map picker dialog */}
      <Dialog open={!!pickingOrder} onOpenChange={(o) => !o && setPickingOrder(null)}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Elegir ubicación en mapa</DialogTitle>
            <DialogDescription>
              {pickingOrder?.cliente} — {pickingOrder?.direccion}.
              Hacé click en el mapa para fijar la ubicación.
            </DialogDescription>
          </DialogHeader>

          {pickingOrder && (
            <MapPicker
              initialCenter={depot}
              onPick={setPickedCoords}
              currentPick={pickedCoords}
            />
          )}

          {pickedCoords && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {pickedCoords.lat.toFixed(5)}, {pickedCoords.lng.toFixed(5)}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickingOrder(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPick} disabled={!pickedCoords}>
              Confirmar ubicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { GeocodedOrder };
