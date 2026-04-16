"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { geocodeAddresses } from "@/lib/geocoder";
import DepotConfig from "@/components/config/DepotConfig";
import FileUpload from "@/components/upload/FileUpload";
import ValidationErrors from "@/components/upload/ValidationErrors";
import GeocodingProgress from "@/components/optimize/GeocodingProgress";
import ResultPreview from "@/components/results/ResultPreview";
import HistoryList from "@/components/results/HistoryList";
import dynamic from "next/dynamic";
import type {
  ParsedExcel,
  Order,
  GeocodedOrder,
  LatLng,
  RouteStop,
  GeocodingProgress as GeocodingProgressType,
  OptimizationJob,
  Profile,
} from "@/types";

const RouteMap = dynamic(() => import("@/components/results/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-cream-100 rounded-2xl animate-pulse-gentle flex items-center justify-center">
      <p className="text-sm text-sage-400">Cargando mapa...</p>
    </div>
  ),
});

type DashboardStep =
  | "upload"
  | "geocoding"
  | "ready"
  | "optimizing"
  | "result";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  // User & profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Workflow state
  const [step, setStep] = useState<DashboardStep>("upload");
  const [parsedExcel, setParsedExcel] = useState<ParsedExcel | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [geocodedOrders, setGeocodedOrders] = useState<GeocodedOrder[]>([]);
  const [geocodingProgress, setGeocodingProgress] =
    useState<GeocodingProgressType | null>(null);
  const [route, setRoute] = useState<RouteStop[]>([]);
  const [resultFilePath, setResultFilePath] = useState<string | null>(null);

  // History
  const [jobs, setJobs] = useState<OptimizationJob[]>([]);

  // Load profile & history
  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Get or create profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      // Load history
      const { data: jobsData } = await supabase
        .from("optimization_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setJobs((jobsData as OptimizationJob[]) || []);
      setLoading(false);
    }

    init();
  }, [supabase, router]);

  // Save depot
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

    setProfile({
      ...profile,
      depot_address: address,
      depot_lat: coords.lat,
      depot_lng: coords.lng,
    });
  }

  // Handle file parsed
  const handleFileParsed = useCallback(
    (result: ParsedExcel, uploadedFile: File) => {
      setParsedExcel(result);
      setFile(uploadedFile);
      setStep("upload");
      setRoute([]);
      setGeocodedOrders([]);
    },
    []
  );

  // Start geocoding
  async function handleGeocode() {
    if (!parsedExcel || parsedExcel.errors.length > 0) return;

    setStep("geocoding");

    const addresses = parsedExcel.orders.map((o: Order) => ({
      address: o.direccion,
      city: o.ciudad || "Montevideo",
    }));

    const progress: GeocodingProgressType = {
      total: addresses.length,
      completed: 0,
      current: "",
      failed: [],
    };
    setGeocodingProgress(progress);

    const results = await geocodeAddresses(addresses, (completed, total, current) => {
      setGeocodingProgress((prev) => ({
        total,
        completed,
        current,
        failed: prev?.failed || [],
      }));
    });

    // Map results back to orders
    const geocoded: GeocodedOrder[] = [];
    const failed: string[] = [];

    parsedExcel.orders.forEach((order: Order) => {
      const result = results.get(order.direccion);
      if (result) {
        geocoded.push({
          ...order,
          lat: result.lat,
          lng: result.lng,
        });
      } else {
        failed.push(order.direccion);
      }
    });

    setGeocodingProgress((prev) => ({
      ...prev!,
      completed: addresses.length,
      current: "Completado",
      failed,
    }));

    setGeocodedOrders(geocoded);

    if (failed.length === 0) {
      setStep("ready");
    }
  }

  // Run optimization
  async function handleOptimize() {
    if (!profile?.depot_lat || !profile?.depot_lng || !file) return;

    setStep("optimizing");

    // Upload original file
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    await supabase.storage.from("uploads").upload(filePath, file, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Call optimize API
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
      setRoute(data.route);
      setResultFilePath(data.result_file_path);
      setStep("result");

      // Refresh history
      const { data: jobsData } = await supabase
        .from("optimization_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setJobs((jobsData as OptimizationJob[]) || []);
    } else {
      setStep("ready");
    }
  }

  // Download result
  async function handleDownload() {
    if (!resultFilePath) return;

    const { data } = await supabase.storage
      .from("results")
      .download(resultFilePath);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pedidos_optimizados.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Download from history
  async function handleHistoryDownload(job: OptimizationJob) {
    if (!job.result_file_path) return;

    const { data } = await supabase.storage
      .from("results")
      .download(job.result_file_path);

    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resultado_${job.id.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Logout
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center botanical-pattern">
        <div className="animate-pulse-gentle text-center">
          <svg
            className="w-10 h-10 text-forest-500 mx-auto mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
          </svg>
          <p className="text-sm text-sage-400">Cargando...</p>
        </div>
      </div>
    );
  }

  const hasDepot = !!(profile?.depot_address && profile?.depot_lat);
  const hasValidExcel =
    parsedExcel && parsedExcel.errors.length === 0 && parsedExcel.orders.length > 0;
  const canGeocode = hasDepot && hasValidExcel && step === "upload";
  const canOptimize = step === "ready" && geocodedOrders.length > 0;

  return (
    <div className="min-h-screen botanical-pattern">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg
              className="w-6 h-6 text-forest-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
            <span className="font-display text-lg font-semibold text-forest-900 tracking-tight">
              brote
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-sage-400 hover:text-forest-700 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Depot config */}
            <DepotConfig
              initialAddress={profile?.depot_address || undefined}
              initialCoords={
                profile?.depot_lat && profile?.depot_lng
                  ? { lat: profile.depot_lat, lng: profile.depot_lng }
                  : null
              }
              onSave={handleDepotSave}
            />

            {/* File upload */}
            <div className="space-y-4">
              <FileUpload
                onFileParsed={handleFileParsed}
                disabled={step === "geocoding" || step === "optimizing"}
              />

              {/* Validation errors */}
              {parsedExcel && parsedExcel.errors.length > 0 && (
                <ValidationErrors errors={parsedExcel.errors} />
              )}

              {/* Excel summary */}
              {hasValidExcel && step === "upload" && (
                <div className="bg-forest-50 border border-forest-200 rounded-2xl px-5 py-3 flex items-center justify-between animate-slide-down">
                  <p className="text-sm text-forest-800">
                    <span className="font-semibold">{parsedExcel!.orders.length}</span>{" "}
                    pedidos listos para procesar
                  </p>
                  {!hasDepot && (
                    <span className="text-[11px] text-terra-500">
                      Configurá el depósito primero
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Geocoding progress */}
            {step === "geocoding" && geocodingProgress && (
              <GeocodingProgress progress={geocodingProgress} />
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {canGeocode && (
                <button
                  onClick={handleGeocode}
                  className="flex-1 bg-forest-700 hover:bg-forest-800 text-cream-50 font-medium px-6 py-3 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-forest-900/10 animate-fade-in"
                >
                  Geocodificar direcciones
                </button>
              )}

              {canOptimize && (
                <button
                  onClick={handleOptimize}
                  className="flex-1 bg-terra-500 hover:bg-terra-600 text-cream-50 font-medium px-6 py-3 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-terra-600/15 animate-scale-in"
                >
                  🌿 Optimizar ruta
                </button>
              )}

              {step === "optimizing" && (
                <div className="flex-1 bg-forest-50 border border-forest-200 rounded-xl px-6 py-3 text-center animate-pulse-gentle">
                  <p className="text-sm font-medium text-forest-700">
                    Calculando ruta óptima...
                  </p>
                </div>
              )}
            </div>

            {/* Results */}
            {step === "result" && route.length > 0 && (
              <div className="space-y-6">
                <ResultPreview
                  route={route}
                  onDownload={handleDownload}
                />
                {profile?.depot_lat && profile?.depot_lng && (
                  <RouteMap
                    route={route}
                    depot={{
                      lat: profile.depot_lat,
                      lng: profile.depot_lng,
                    }}
                  />
                )}

                {/* Reset button */}
                <button
                  onClick={() => {
                    setStep("upload");
                    setParsedExcel(null);
                    setFile(null);
                    setRoute([]);
                    setGeocodedOrders([]);
                    setGeocodingProgress(null);
                    setResultFilePath(null);
                  }}
                  className="w-full text-sm text-sage-400 hover:text-forest-700 py-2 transition-colors"
                >
                  ← Nueva optimización
                </button>
              </div>
            )}
          </div>

          {/* Sidebar — History */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <h2 className="font-display text-base font-semibold text-forest-950 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-sage-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Historial
              </h2>
              <HistoryList
                jobs={jobs}
                onDownload={handleHistoryDownload}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
