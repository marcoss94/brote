"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import DashboardSkeleton from "@/components/layout/DashboardSkeleton";
import type { OptimizationJob, RouteStop } from "@/types";

type SortField = "created_at" | "order_count";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "completed" | "error" | "processing";

const chartConfig = {
  rutas: {
    label: "Rutas",
    color: "var(--forest-500)",
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [jobs, setJobs] = useState<OptimizationJob[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleting, setDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("optimization_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);

      setJobs((data as OptimizationJob[]) || []);
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  // Metrics
  const metrics = useMemo(() => {
    const completed = jobs.filter((j) => j.status === "completed");
    const totalOrders = completed.reduce((sum, j) => sum + j.order_count, 0);

    const totalKm = completed.reduce((sum, j) => {
      const route = (j.route_data as RouteStop[] | null) || [];
      const last = route[route.length - 1];
      return sum + (last?.distancia_acumulada_km || 0);
    }, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = completed.filter(
      (j) => new Date(j.created_at) >= monthStart
    ).length;

    return {
      totalRoutes: completed.length,
      totalOrders,
      totalKm: Math.round(totalKm * 10) / 10,
      thisMonth,
    };
  }, [jobs]);

  // Chart data: last 14 days
  const chartData = useMemo(() => {
    const days: { date: string; label: string; rutas: number }[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        label: d.toLocaleDateString("es-UY", { day: "numeric", month: "short" }),
        rutas: 0,
      });
    }

    jobs
      .filter((j) => j.status === "completed")
      .forEach((j) => {
        const key = new Date(j.created_at).toISOString().slice(0, 10);
        const day = days.find((d) => d.date === key);
        if (day) day.rutas++;
      });

    return days;
  }, [jobs]);

  // Filtered & sorted
  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (statusFilter !== "all") {
      result = result.filter((j) => j.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((j) => {
        const dateStr = new Date(j.created_at)
          .toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" })
          .toLowerCase();
        return dateStr.includes(q) || String(j.order_count).includes(q);
      });
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "order_count") {
        cmp = a.order_count - b.order_count;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [jobs, statusFilter, search, sortField, sortDir]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, pageSize]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, page, pageSize]);

  const allSelected = paginatedJobs.length > 0 && paginatedJobs.every((j) => selected.has(j.id));
  const someSelected = selected.size > 0;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(paginatedJobs.map((j) => j.id)));
  }

  async function deleteJob(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    const files: string[] = [];
    if (job.original_file_path) files.push(job.original_file_path);
    if (job.result_file_path) files.push(job.result_file_path);
    if (files.length > 0) {
      await Promise.all([
        supabase.storage.from("uploads").remove(files),
        supabase.storage.from("results").remove(files),
      ]);
    }
    const { error } = await supabase.from("optimization_jobs").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar la ruta");
      return;
    }
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success("Ruta eliminada");
  }

  async function deleteBulk() {
    setDeleting(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      const job = jobs.find((j) => j.id === id);
      if (!job) continue;
      const files: string[] = [];
      if (job.original_file_path) files.push(job.original_file_path);
      if (job.result_file_path) files.push(job.result_file_path);
      if (files.length > 0) {
        await supabase.storage.from("uploads").remove(files);
        await supabase.storage.from("results").remove(files);
      }
    }
    const { error } = await supabase.from("optimization_jobs").delete().in("id", ids);
    if (error) {
      toast.error("Error al eliminar rutas");
    } else {
      toast.success(`${ids.length} ${ids.length === 1 ? "ruta eliminada" : "rutas eliminadas"}`);
    }
    setJobs((prev) => prev.filter((j) => !selected.has(j.id)));
    setSelected(new Set());
    setDeleting(false);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  function statusBadge(status: string) {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="bg-muted text-foreground border-forest-200">Completado</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Procesando</Badge>;
    }
  }

  if (loading) return <DashboardSkeleton />;

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resumen de actividad y gestión de rutas
          </p>
        </div>
        <Link href="/nueva-ruta" className={cn(buttonVariants({ size: "lg" }))}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva ruta
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Rutas completadas"
          value={metrics.totalRoutes}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
        <MetricCard
          label="Pedidos optimizados"
          value={metrics.totalOrders.toLocaleString("es-UY")}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
        />
        <MetricCard
          label="Km recorridos"
          value={`${metrics.totalKm.toLocaleString("es-UY", { maximumFractionDigits: 1 })} km`}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
        />
        <MetricCard
          label="Este mes"
          value={metrics.thisMonth}
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actividad últimas 2 semanas</CardTitle>
          <CardDescription>Rutas optimizadas por día</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="var(--cream-300)" strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--sage-500)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--sage-500)" }}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--forest-50)" }} />
              <Bar dataKey="rutas" fill="var(--color-rutas)" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Table section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Historial de rutas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {jobs.length} {jobs.length === 1 ? "optimización" : "optimizaciones"} en total
            </p>
          </div>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-20">
              <div className="w-14 h-14 rounded-full bg-muted text-forest-500 flex items-center justify-center mb-4">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="19" r="3" />
                  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                  <circle cx="18" cy="5" r="3" />
                </svg>
              </div>
              <CardTitle className="text-base mb-1">No hay rutas todavía</CardTitle>
              <CardDescription className="mb-5">
                Creá tu primera ruta optimizada subiendo un Excel
              </CardDescription>
              <Link href="/nueva-ruta" className={cn(buttonVariants())}>Crear primera ruta</Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            {/* Toolbar inside card */}
            <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-2.5">
              <Input
                placeholder="Buscar por fecha..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />

              {someSelected && (
                <AlertDialog>
                  <AlertDialogTrigger className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}>
                    Eliminar ({selected.size})
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Eliminar {selected.size} {selected.size === 1 ? "ruta" : "rutas"}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminarán las optimizaciones seleccionadas y sus archivos. No se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={deleteBulk} disabled={deleting}>
                        {deleting ? "Eliminando..." : "Eliminar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 pl-6">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="py-4">
                    <button
                      onClick={() => toggleSort("created_at")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-xs uppercase tracking-wider font-semibold"
                    >
                      Fecha <span className="opacity-40">{sortIcon("created_at")}</span>
                    </button>
                  </TableHead>
                  <TableHead className="py-4 text-center">
                    <button
                      onClick={() => toggleSort("order_count")}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-xs uppercase tracking-wider font-semibold"
                    >
                      Pedidos <span className="opacity-40">{sortIcon("order_count")}</span>
                    </button>
                  </TableHead>
                  <TableHead className="py-4 text-center text-xs uppercase tracking-wider font-semibold">
                    Distancia
                  </TableHead>
                  <TableHead className="py-4 text-center text-xs uppercase tracking-wider font-semibold">
                    Estado
                  </TableHead>
                  <TableHead className="py-4 text-right pr-6 text-xs uppercase tracking-wider font-semibold">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                      No hay resultados para estos filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedJobs.map((job) => {
                    const route = (job.route_data as RouteStop[] | null) || [];
                    const distance = route[route.length - 1]?.distancia_acumulada_km ?? 0;
                    // Delivery date from first route stop (falls back to creation date)
                    const deliveryDate = route.find((s) => s.fecha)?.fecha || null;

                    return (
                      <TableRow
                        key={job.id}
                        className={cn(
                          "hover:bg-muted/40 transition-colors",
                          selected.has(job.id) && "bg-muted/30"
                        )}
                      >
                        <TableCell className="pl-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(job.id)}
                            onCheckedChange={() => toggleSelect(job.id)}
                          />
                        </TableCell>
                        <TableCell
                          className="py-4 cursor-pointer"
                          onClick={() => {
                            if (job.status === "completed") router.push(`/rutas/${job.id}`);
                          }}
                        >
                          {deliveryDate ? (
                            <>
                              <div className="font-medium text-foreground">
                                Entrega {deliveryDate}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Creada {new Date(job.created_at).toLocaleDateString("es-UY", {
                                  day: "numeric",
                                  month: "short",
                                })} · {new Date(job.created_at).toLocaleTimeString("es-UY", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })} hs
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-foreground">
                                {new Date(job.created_at).toLocaleDateString("es-UY", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {new Date(job.created_at).toLocaleTimeString("es-UY", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })} hs
                              </div>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="py-4 text-center tabular-nums text-sm">
                          {job.order_count}
                        </TableCell>
                        <TableCell className="py-4 text-center tabular-nums text-sm text-muted-foreground">
                          {distance > 0 ? `${distance.toFixed(1)} km` : "—"}
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          {statusBadge(job.status)}
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {job.status === "completed" && (
                              <Link
                                href={`/rutas/${job.id}`}
                                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-foreground")}
                                title="Ver ruta"
                              >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </Link>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-destructive")}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar esta ruta?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Se eliminará la optimización y sus archivos. No se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    variant="destructive"
                                    onClick={() => deleteJob(job.id)}
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {filteredJobs.length > 0 && (
              <div className="px-6 py-3 border-t border-border flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Mostrando <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredJobs.length)}</span> de <span className="font-medium text-foreground">{filteredJobs.length}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span>por página</span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger size="sm" className="h-7 w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    title="Primera página"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="11 17 6 12 11 7" />
                      <polyline points="18 17 13 12 18 7" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    title="Anterior"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </Button>
                  <span className="text-xs px-3 tabular-nums">
                    Página <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    title="Siguiente"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                    title="Última página"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 17 18 12 13 7" />
                      <polyline points="6 17 11 12 6 7" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="py-5 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
              {label}
            </p>
            <p className="text-2xl font-semibold text-foreground tabular-nums tracking-tight">
              {value}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
