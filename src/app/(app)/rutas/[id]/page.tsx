"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OptimizationJob, RouteStop, Profile } from "@/types";

const RouteMap = dynamic(() => import("@/components/results/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Cargando mapa...</p>
    </div>
  ),
});

export default function RutaResultPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<OptimizationJob | null>(null);
  const [route, setRoute] = useState<RouteStop[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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

      // Load route data from DB
      if (jobRes.data.route_data) {
        setRoute(jobRes.data.route_data as RouteStop[]);
      }

      setLoading(false);
    }
    load();
  }, [supabase, router, jobId]);

  async function handleDownload() {
    if (!job?.result_file_path) return;
    setDownloading(true);

    const { data } = await supabase.storage.from("results").download(job.result_file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ruta_${job.id.slice(0, 8)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    }

    setDownloading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando ruta...</p>
      </div>
    );
  }

  if (!job) return null;

  const config = job.config as { depot?: { lat: number; lng: number } } | null;
  const depot = config?.depot;

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} title="Volver">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-forest-950">
                  Ruta del {new Date(job.created_at).toLocaleDateString("es-UY", {
                    day: "numeric",
                    month: "long",
                  })}
                </h1>
                <Badge
                  variant="secondary"
                  className={
                    job.status === "completed"
                      ? "bg-forest-50 text-forest-700 border-forest-200"
                      : "bg-destructive/10 text-destructive"
                  }
                >
                  {job.status === "completed" ? "Completado" : job.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {job.order_count} pedidos ·{" "}
                {new Date(job.created_at).toLocaleTimeString("es-UY", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {job.result_file_path && (
            <Button onClick={handleDownload} disabled={downloading}>
              <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? "Descargando..." : "Descargar Excel"}
            </Button>
          )}
        </div>

        {/* Error message */}
        {job.status === "error" && job.error_message && (
          <Card className="mb-6 border-destructive/30">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{job.error_message}</p>
            </CardContent>
          </Card>
        )}

        {/* Map */}
        {depot && route.length > 0 && (
          <div className="mb-6">
            <RouteMap route={route} depot={depot} />
          </div>
        )}

        {/* Route table */}
        {route.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle de la ruta</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead className="text-center">Franja</TableHead>
                  <TableHead className="text-center">Llegada est.</TableHead>
                  <TableHead className="text-right">Km acum.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {route.map((stop) => (
                  <TableRow key={stop.numero_pedido}>
                    <TableCell>
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {stop.orden}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{stop.cliente}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{stop.direccion}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">{stop.franja}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {stop.hora_estimada}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {stop.distancia_acumulada_km}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* If no route data yet, show download prompt */}
        {route.length === 0 && job.status === "completed" && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-forest-50 text-forest-500 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="text-base font-semibold text-forest-950 mb-1">
                Ruta optimizada correctamente
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {job.order_count} pedidos procesados
              </p>
              {job.result_file_path && (
                <Button onClick={handleDownload} disabled={downloading}>
                  {downloading ? "Descargando..." : "Descargar Excel con ruta"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
  );
}
