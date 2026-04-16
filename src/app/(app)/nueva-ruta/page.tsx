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
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ParsedExcel,
  Order,
  GeocodedOrder,
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
  const [geocodingProgress, setGeocodingProgress] = useState<GeocodingProgressType | null>(null);

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
  }, []);

  async function handleGeocode() {
    if (!parsedExcel || parsedExcel.errors.length > 0) return;
    setStep("geocoding");

    const addresses = parsedExcel.orders.map((o: Order) => ({
      address: o.direccion,
      city: o.ciudad || "Montevideo",
    }));

    setGeocodingProgress({ total: addresses.length, completed: 0, current: "", failed: [] });

    const results = await geocodeAddresses(addresses, (completed, total, current) => {
      setGeocodingProgress((prev) => ({ total, completed, current, failed: prev?.failed || [] }));
    });

    const geocoded: GeocodedOrder[] = [];
    const failed: string[] = [];

    parsedExcel.orders.forEach((order: Order) => {
      const result = results.get(order.direccion);
      if (result) {
        geocoded.push({ ...order, lat: result.lat, lng: result.lng });
      } else {
        failed.push(order.direccion);
      }
    });

    setGeocodingProgress((prev) => ({ ...prev!, completed: addresses.length, current: "Completado", failed }));
    setGeocodedOrders(geocoded);
    if (failed.length === 0) setStep("ready");
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
        depot: { lat: profile.depot_lat, lng: profile.depot_lng },
        original_file_path: filePath,
      }),
    });

    const data = await res.json();
    if (data.status === "completed") {
      router.push(`/rutas/${data.job_id}`);
    } else {
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
  const canGeocode = hasDepot && hasValidExcel && step === "upload";
  const canOptimize = step === "ready" && geocodedOrders.length > 0;

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} title="Volver">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-forest-950">Nueva ruta</h1>
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

          {/* Step 2: Upload */}
          <FileUpload
            onFileParsed={handleFileParsed}
            disabled={step === "geocoding" || step === "optimizing"}
          />

          {parsedExcel && parsedExcel.errors.length > 0 && (
            <ValidationErrors errors={parsedExcel.errors} />
          )}

          {hasValidExcel && step === "upload" && (
            <Card>
              <CardContent className="py-3 flex items-center justify-between">
                <p className="text-sm text-forest-800">
                  <span className="font-semibold">{parsedExcel!.orders.length}</span> pedidos listos
                </p>
                {!hasDepot && (
                  <span className="text-xs text-destructive">Configurá el depósito primero</span>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Geocoding */}
          {step === "geocoding" && geocodingProgress && (
            <GeocodingProgress progress={geocodingProgress} />
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
                <p className="text-sm font-medium text-forest-700 animate-pulse">
                  Calculando ruta óptima...
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
  );
}
