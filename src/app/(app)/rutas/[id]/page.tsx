"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import WhatsAppDialog from "@/components/results/WhatsAppDialog";
import RouteResultSkeleton from "@/components/layout/RouteResultSkeleton";
import SortableRouteList from "@/components/results/SortableRouteList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { downloadRoutePDF } from "@/lib/pdf";
import { HaversineProvider } from "@/lib/providers/haversine";
import type { OptimizationJob, RouteStop, Profile, PickupOrder } from "@/types";

const RouteMap = dynamic(() => import("@/components/results/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[500px] bg-muted rounded-xl flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Cargando mapa...</p>
    </div>
  ),
});

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export default function RutaResultPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<OptimizationJob | null>(null);
  const [route, setRoute] = useState<RouteStop[]>([]);
  const [pickupOrders, setPickupOrders] = useState<PickupOrder[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pending action when there are unsaved changes
  const [pendingAction, setPendingAction] = useState<{
    label: string;
    run: () => void | Promise<void>;
  } | null>(null);

  // Controlled WhatsApp dialog so we can auto-open after save
  const [waOpen, setWaOpen] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Browser-level guard: warn before tab close/refresh
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [jobRes, profileRes] = await Promise.all([
        supabase.from("optimization_jobs").select("*").eq("id", jobId).single(),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);

      if (!jobRes.data) { router.push("/dashboard"); return; }

      setJob(jobRes.data as OptimizationJob);
      setProfile(profileRes.data);

      if (jobRes.data.route_data) {
        setRoute(jobRes.data.route_data as RouteStop[]);
      }
      if (jobRes.data.pickup_data) {
        setPickupOrders(jobRes.data.pickup_data as PickupOrder[]);
      }

      setLoading(false);
    }
    load();
  }, [supabase, router, jobId]);

  const stats = useMemo(() => {
    if (route.length === 0) return null;
    const last = route[route.length - 1];
    const first = route[0];
    const totalKm = last.distancia_acumulada_km;

    const startMin = parseTimeToMinutes(first.hora_estimada);
    const endMin = parseTimeToMinutes(last.hora_estimada);
    const durationMin = endMin - startMin;
    const hours = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return {
      totalKm,
      duration,
      startTime: first.hora_estimada,
      endTime: last.hora_estimada,
    };
  }, [route]);

  async function handleDownload() {
    if (!job?.result_file_path) return;
    setDownloading(true);
    const { data, error } = await supabase.storage.from("results").download(job.result_file_path);
    if (error || !data) {
      toast.error("No se pudo descargar el archivo");
    } else {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ruta_${job.id.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel descargado");
    }
    setDownloading(false);
  }

  function handleReorder(reordered: RouteStop[]) {
    if (!job) return;
    const config = job.config as { depot?: { lat: number; lng: number } } | null;
    const depot = config?.depot;
    if (!depot) return;

    // Recompute orden + distancia_acumulada_km via Haversine
    const provider = new HaversineProvider(30);
    let acc = 0;
    let prev = depot;
    const updated: RouteStop[] = reordered.map((stop, i) => {
      const segment = provider.getDistance(prev, { lat: stop.lat, lng: stop.lng }).distance_km;
      acc += segment;
      prev = { lat: stop.lat, lng: stop.lng };
      return {
        ...stop,
        orden: i + 1,
        distancia_acumulada_km: Math.round(acc * 10) / 10,
      };
    });

    setRoute(updated);
    setDirty(true);
  }

  async function handleSaveOrder(): Promise<boolean> {
    if (!job) return false;
    setSaving(true);
    const { error } = await supabase
      .from("optimization_jobs")
      .update({ route_data: route })
      .eq("id", job.id);
    setSaving(false);
    if (error) {
      toast.error("Error al guardar el orden");
      return false;
    }
    toast.success("Orden guardado");
    setDirty(false);
    return true;
  }

  /** Wrap any action: if dirty, show confirmation; otherwise run directly. */
  function guardAction(label: string, run: () => void | Promise<void>) {
    return () => {
      if (dirty) {
        setPendingAction({ label, run });
      } else {
        run();
      }
    };
  }

  async function handleConfirmSaveAndContinue() {
    if (!pendingAction) return;
    const ok = await handleSaveOrder();
    if (ok) {
      const action = pendingAction;
      setPendingAction(null);
      await action.run();
    }
  }

  async function handleConfirmDiscardAndContinue() {
    if (!pendingAction) return;
    const action = pendingAction;
    // Restore from last saved snapshot in DB (job.route_data)
    if (job?.route_data) {
      setRoute(job.route_data as RouteStop[]);
    }
    setDirty(false);
    setPendingAction(null);
    await action.run();
  }

  function handleDownloadPDF() {
    if (!job || route.length === 0) return;
    try {
      const date = new Date(job.created_at).toLocaleDateString("es-UY", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      downloadRoutePDF({
        route,
        date,
        driverName: profile?.full_name || undefined,
      });
      toast.success("PDF descargado");
    } catch {
      toast.error("Error al generar PDF");
    }
  }

  if (loading) return <RouteResultSkeleton />;

  if (!job) return null;

  const config = job.config as { depot?: { lat: number; lng: number } } | null;
  const depot = config?.depot;
  const routeDate = new Date(job.created_at).toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="max-w-7xl mx-auto px-6 py-4">
      {/* Sticky top bar — title + metrics inline + actions */}
      <div className="sticky top-16 z-30 -mx-6 px-6 py-3 mb-4 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Left: back + title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Volver"
              onClick={guardAction("Volver al dashboard", () => router.push("/dashboard"))}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold text-foreground truncate">
                  Ruta {routeDate}
                </h1>
                <Badge
                  variant="secondary"
                  className={
                    job.status === "completed"
                      ? "bg-muted text-foreground border-forest-200 text-[10px]"
                      : "bg-destructive/10 text-destructive text-[10px]"
                  }
                >
                  {job.status === "completed" ? "Completado" : job.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Inline metrics */}
          {stats && (
            <div className="flex items-center gap-4 text-xs">
              <InlineStat label="Paradas" value={String(route.length)} />
              <span className="w-px h-6 bg-border" />
              <InlineStat label="Distancia" value={`${stats.totalKm.toFixed(1)} km`} />
              {pickupOrders.length > 0 && (
                <>
                  <span className="w-px h-6 bg-border" />
                  <InlineStat label="Retiros" value={String(pickupOrders.length)} />
                </>
              )}
            </div>
          )}

          {/* Spacer + actions */}
          <div className="flex-1" />
          <div className="flex items-center gap-2 flex-shrink-0">
            {route.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={guardAction("Enviar por WhatsApp", () => setWaOpen(true))}
              >
                <svg className="w-4 h-4 mr-1.5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </Button>
            )}
            {job.result_file_path && (
              <Button
                onClick={guardAction("Descargar Excel", handleDownload)}
                disabled={downloading}
                size="sm"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {downloading ? "Descargando..." : "Excel"}
              </Button>
            )}
            {route.length > 0 && (
              <Button
                variant="outline"
                onClick={guardAction("Descargar PDF", handleDownloadPDF)}
                size="sm"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {job.status === "error" && job.error_message && (
        <Card className="mb-4 border-destructive/30">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{job.error_message}</p>
          </CardContent>
        </Card>
      )}

      {/* Main content — map + sidebar take full available height */}
      {depot && route.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 h-[calc(100vh-180px)]">
          {/* Map fills full grid cell */}
          <div className="min-h-[500px] h-full">
            <RouteMap
              route={route}
              depot={depot}
              selectedId={selectedStopId}
              onClearSelection={() => setSelectedStopId(null)}
            />
          </div>

          {/* Sidebar */}
          <aside className="h-full overflow-hidden flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-2 flex-shrink-0">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">
                    Paradas en orden
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Arrastrá para reordenar
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedStopId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedStopId(null)}
                    >
                      Quitar selección
                    </Button>
                  )}
                  {dirty && (
                    <Button size="sm" onClick={() => { handleSaveOrder(); }} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SortableRouteList
                  route={route}
                  onReorder={handleReorder}
                  selectedId={selectedStopId}
                  onSelect={(id) => setSelectedStopId(id || null)}
                />
              </div>
            </Card>
          </aside>
        </div>
      ) : null}

      {/* Pickup orders — separate section, always visible if any */}
      {pickupOrders.length > 0 && (
        <Card className="mt-6">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Retiros en tienda
              </h2>
              <p className="text-xs text-muted-foreground">
                {pickupOrders.length} {pickupOrders.length === 1 ? "cliente retira" : "clientes retiran"} · no van en la ruta
              </p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {pickupOrders.map((p) => (
              <div key={p.numero_pedido} className="px-5 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-foreground truncate">{p.cliente}</p>
                    {p.fecha && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {p.fecha}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.direccion_original}
                  </p>
                  {p.producto && (
                    <p className="text-xs text-foreground mt-1 truncate">
                      <span className="text-muted-foreground">Producto: </span>
                      {p.producto}
                    </p>
                  )}
                  {(p.telefono || p.red_social) && (
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {p.telefono && <span>Tel: {p.telefono}</span>}
                      {p.red_social && <span>{p.red_social}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {route.length === 0 && job.status === "completed" && pickupOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted text-forest-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-base font-semibold text-foreground mb-1">
              Ruta optimizada correctamente
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {job.order_count} pedidos procesados
            </p>
            {job.result_file_path && (
              <Button onClick={handleDownload} disabled={downloading}>
                {downloading ? "Descargando..." : "Descargar Excel con ruta"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Controlled WhatsApp dialog (no inline trigger — opened via button) */}
      {route.length > 0 && (
        <WhatsAppDialog
          route={route}
          date={routeDate}
          open={waOpen}
          onOpenChange={setWaOpen}
          trigger={false}
        />
      )}

      {/* Unsaved-changes confirmation */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(o) => !o && setPendingAction(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Tenés cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Reordenaste la ruta pero no la guardaste. ¿Querés guardar antes de continuar
              con <span className="font-medium text-foreground">{pendingAction?.label}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mx-0 mb-0 bg-transparent border-t-0 p-0 pt-2 flex-col sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel className="sm:mr-auto">Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleConfirmDiscardAndContinue}
              disabled={saving}
            >
              Descartar
            </Button>
            <AlertDialogAction onClick={handleConfirmSaveAndContinue} disabled={saving}>
              {saving ? "Guardando..." : "Guardar y continuar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}
