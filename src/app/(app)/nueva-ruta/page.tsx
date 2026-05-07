"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { geocodeAddresses } from "@/lib/geocoder";
import DepotConfig from "@/components/config/DepotConfig";
import FileUpload from "@/components/upload/FileUpload";
import ValidationErrors from "@/components/upload/ValidationErrors";
import GeocodingProgress from "@/components/optimize/GeocodingProgress";
import FailedGeocodingList from "@/components/optimize/FailedGeocodingList";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type {
  ParsedExcel,
  Order,
  GeocodedOrder,
  PickupOrder,
  LatLng,
  GeocodingProgress as GeocodingProgressType,
  Profile,
} from "@/types";

type Step = "upload" | "geocoding" | "ready" | "optimizing";

export default function NuevaRutaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("upload");
  const [parsedExcel, setParsedExcel] = useState<ParsedExcel | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [geocodedOrders, setGeocodedOrders] = useState<GeocodedOrder[]>([]);
  const [failedOrders, setFailedOrders] = useState<Order[]>([]);
  const [pickupOrders, setPickupOrders] = useState<PickupOrder[]>([]);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [geocodingProgress, setGeocodingProgress] = useState<GeocodingProgressType | null>(null);

  // Date selector — if Excel has multiple fechas, user picks one
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    }
    init();
  }, [supabase, router]);

  async function handleDepotSave(address: string, coords: LatLng) {
    if (!profile) return;
    await supabase
      .from("profiles")
      .update({
        depot_address: address,
        depot_lat: coords.lat,
        depot_lng: coords.lng,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setProfile({ ...profile, depot_address: address, depot_lat: coords.lat, depot_lng: coords.lng });
  }

  const handleFileParsed = useCallback((result: ParsedExcel, uploadedFile: File) => {
    setParsedExcel(result);
    setFile(uploadedFile);
    setStep("upload");
    setGeocodedOrders([]);
    setFailedOrders([]);
    setPickupOrders(result.pickupOrders || []);
    setResolvedIds(new Set());
    setGeocodingProgress(null);

    // Auto-select if single date, null otherwise
    const dates = new Set<string>();
    result.orders.forEach((o) => dates.add(o.fecha || "__sin_fecha__"));
    result.pickupOrders.forEach((p) => dates.add(p.fecha || "__sin_fecha__"));
    setSelectedDate(dates.size === 1 ? Array.from(dates)[0] : null);
  }, []);

  function handleReset() {
    setParsedExcel(null);
    setFile(null);
    setStep("upload");
    setGeocodedOrders([]);
    setFailedOrders([]);
    setPickupOrders([]);
    setResolvedIds(new Set());
    setGeocodingProgress(null);
    setSelectedDate(null);
  }

  async function handleGeocode() {
    if (!parsedExcel || parsedExcel.errors.length > 0) return;
    setStep("geocoding");

    const ordersToGeocode = selectedDate
      ? parsedExcel.orders.filter((o) => (o.fecha || "__sin_fecha__") === selectedDate)
      : parsedExcel.orders;

    const addresses = ordersToGeocode.map((o: Order) => ({
      address: o.direccion,
      city: o.ciudad || "Montevideo",
    }));

    setGeocodingProgress({ total: addresses.length, completed: 0, current: "", failed: [] });

    const results = await geocodeAddresses(addresses, (completed, total, current) => {
      setGeocodingProgress((prev) => ({ total, completed, current, failed: prev?.failed || [] }));
    });

    const geocoded: GeocodedOrder[] = [];
    const failedList: Order[] = [];
    const failedAddrs: string[] = [];

    ordersToGeocode.forEach((order: Order) => {
      const result = results.get(order.direccion);
      if (result) {
        geocoded.push({ ...order, lat: result.lat, lng: result.lng });
      } else {
        failedList.push(order);
        failedAddrs.push(order.direccion);
      }
    });

    setGeocodingProgress((prev) => ({ ...prev!, completed: addresses.length, current: "Completado", failed: failedAddrs }));
    setGeocodedOrders(geocoded);
    setFailedOrders(failedList);
    setResolvedIds(new Set());

    if (failedList.length === 0) {
      setStep("ready");
      toast.success(`${geocoded.length} direcciones geocodificadas`);
    } else {
      toast.warning(`${failedList.length} sin resolver. Editá o elegí en mapa.`);
    }
  }

  function handleResolveFailed(order: Order, coords: LatLng) {
    // Add resolved order to geocoded list
    setGeocodedOrders((prev) => [
      ...prev,
      { ...order, lat: coords.lat, lng: coords.lng },
    ]);
    setResolvedIds((prev) => new Set(prev).add(order.numero_pedido));
  }

  async function handleOptimize() {
    if (!profile?.depot_lat || !profile?.depot_lng || !file) return;
    setStep("optimizing");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    await supabase.storage.from("uploads").upload(filePath, file, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: geocodedOrders,
        pickup_orders: filteredPickups,
        depot: { lat: profile.depot_lat, lng: profile.depot_lng },
        original_file_path: filePath,
      }),
    });

    const data = await res.json();
    if (data.status === "completed") {
      toast.success("Ruta optimizada con éxito");
      router.push(`/rutas/${data.job_id}`);
    } else if (res.status === 429) {
      toast.error(data.error || "Demasiadas optimizaciones. Esperá un minuto.");
      setStep("ready");
    } else {
      toast.error(data.error_message || data.error || "Error al optimizar");
      setStep("ready");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  const hasDepot = !!(profile?.depot_address && profile?.depot_lat);
  const hasValidExcel = parsedExcel && parsedExcel.errors.length === 0 && parsedExcel.orders.length > 0;

  // Unique dates across orders + pickups
  const availableDates = (() => {
    if (!parsedExcel) return [] as string[];
    const set = new Set<string>();
    parsedExcel.orders.forEach((o) => set.add(o.fecha || "__sin_fecha__"));
    parsedExcel.pickupOrders.forEach((p) => set.add(p.fecha || "__sin_fecha__"));
    return Array.from(set).sort();
  })();
  const needsDatePick = availableDates.length > 1 && !selectedDate;

  // Filter by selected date
  const filteredOrders = parsedExcel && selectedDate
    ? parsedExcel.orders.filter((o) => (o.fecha || "__sin_fecha__") === selectedDate)
    : parsedExcel?.orders || [];
  const filteredPickups = parsedExcel && selectedDate
    ? pickupOrders.filter((p) => (p.fecha || "__sin_fecha__") === selectedDate)
    : pickupOrders;

  const canGeocode = hasDepot && hasValidExcel && !needsDatePick && step === "upload" && filteredOrders.length > 0;
  const allFailedResolved =
    failedOrders.length > 0 && failedOrders.every((o) => resolvedIds.has(o.numero_pedido));
  const canOptimize =
    (step === "ready" || (step === "geocoding" && allFailedResolved)) &&
    geocodedOrders.length > 0 &&
    geocodedOrders.length === filteredOrders.length;

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} title="Volver">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Nueva ruta</h1>
            <p className="text-sm text-muted-foreground">Subí el Excel de pedidos y optimizá la ruta</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Step 1: Depot */}
          <DepotConfig
            initialAddress={profile?.depot_address || undefined}
            initialCoords={
              profile?.depot_lat && profile?.depot_lng
                ? { lat: profile.depot_lat, lng: profile.depot_lng }
                : null
            }
            onSave={handleDepotSave}
          />

          {/* Step 2: Upload — disabled only while actively geocoding or optimizing */}
          <FileUpload
            onFileParsed={handleFileParsed}
            disabled={
              step === "optimizing" ||
              (step === "geocoding" &&
                !!geocodingProgress &&
                geocodingProgress.completed < geocodingProgress.total)
            }
          />

          {parsedExcel && parsedExcel.errors.length > 0 && (
            <ValidationErrors errors={parsedExcel.errors} />
          )}

          {/* Date selector — only when multiple dates present */}
          {hasValidExcel && availableDates.length > 1 && step === "upload" && (
            <Card className={selectedDate ? "" : "border-terra-400/60"}>
              <CardContent className="py-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">
                    El archivo tiene {availableDates.length} fechas distintas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Elegí qué fecha optimizar ahora. Solo se cargan los pedidos de esa fecha.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {availableDates.map((d) => {
                    const label = d === "__sin_fecha__" ? "Sin fecha" : d;
                    const orderCount =
                      parsedExcel!.orders.filter((o) => (o.fecha || "__sin_fecha__") === d).length;
                    const pickupCount =
                      parsedExcel!.pickupOrders.filter((p) => (p.fecha || "__sin_fecha__") === d).length;
                    const isSelected = selectedDate === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 px-3 py-2 rounded-md border transition-colors text-left",
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground/40 hover:bg-muted"
                        )}
                      >
                        <span className="text-sm font-semibold">{label}</span>
                        <span className={cn(
                          "text-[11px]",
                          isSelected ? "text-background/70" : "text-muted-foreground"
                        )}>
                          {orderCount} entrega{orderCount !== 1 ? "s" : ""}
                          {pickupCount > 0 && ` · ${pickupCount} retiro${pickupCount !== 1 ? "s" : ""}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {hasValidExcel && step === "upload" && !needsDatePick && (
            <Card>
              <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  {selectedDate && selectedDate !== "__sin_fecha__" && (
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">Fecha:</span>
                      <span className="font-semibold">{selectedDate}</span>
                    </span>
                  )}
                  <span>
                    <span className="font-semibold">{filteredOrders.length}</span>{" "}
                    <span className="text-muted-foreground">entregas</span>
                  </span>
                  {filteredPickups.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground" />
                      <span className="font-semibold">{filteredPickups.length}</span>{" "}
                      <span className="text-muted-foreground">retiros en tienda</span>
                    </span>
                  )}
                </div>
                {!hasDepot && (
                  <span className="text-xs text-destructive">Configurá el depósito primero</span>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Geocoding progress */}
          {step === "geocoding" && geocodingProgress && geocodingProgress.completed < geocodingProgress.total && (
            <GeocodingProgress progress={geocodingProgress} />
          )}

          {/* Step 4: Fix failed geocoding */}
          {failedOrders.length > 0 && step === "geocoding" && profile?.depot_lat && profile?.depot_lng && (
            <FailedGeocodingList
              failedOrders={failedOrders}
              depot={{ lat: profile.depot_lat, lng: profile.depot_lng }}
              onResolve={handleResolveFailed}
              onCancel={handleReset}
              resolvedIds={resolvedIds}
            />
          )}

          {/* Actions */}
          {canGeocode && (
            <Button className="w-full" size="lg" onClick={handleGeocode}>
              Geocodificar direcciones
            </Button>
          )}

          {canOptimize && (
            <Button className="w-full" size="lg" onClick={handleOptimize}>
              🌿 Optimizar ruta
            </Button>
          )}

          {step === "optimizing" && (
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-sm font-medium text-foreground animate-pulse">
                  Calculando ruta óptima...
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
  );
}
