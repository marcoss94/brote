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
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OptimizationJob } from "@/types";

type SortField = "created_at" | "order_count";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "completed" | "error" | "processing";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [jobs, setJobs] = useState<OptimizationJob[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters & sort
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Delete state
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("optimization_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      setJobs((data as OptimizationJob[]) || []);
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  // Filtered & sorted jobs
  const filteredJobs = useMemo(() => {
    let result = jobs;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((j) => j.status === statusFilter);
    }

    // Search (by date text or order count)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((j) => {
        const dateStr = new Date(j.created_at).toLocaleDateString("es-UY", {
          day: "numeric", month: "short", year: "numeric",
        }).toLowerCase();
        return (
          dateStr.includes(q) ||
          String(j.order_count).includes(q)
        );
      });
    }

    // Sort
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

  // Selection helpers
  const allSelected = filteredJobs.length > 0 && filteredJobs.every((j) => selected.has(j.id));
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
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredJobs.map((j) => j.id)));
    }
  }

  // Delete single
  async function deleteJob(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    // Delete storage files
    const filesToDelete: string[] = [];
    if (job.original_file_path) filesToDelete.push(job.original_file_path);
    if (job.result_file_path) filesToDelete.push(job.result_file_path);

    if (filesToDelete.length > 0) {
      await Promise.all([
        supabase.storage.from("uploads").remove(filesToDelete.filter((f) => f.startsWith(job.user_id))),
        supabase.storage.from("results").remove(filesToDelete.filter((f) => f.startsWith(job.user_id))),
      ]);
    }

    await supabase.from("optimization_jobs").delete().eq("id", id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Delete bulk
  async function deleteBulk() {
    setDeleting(true);
    const ids = Array.from(selected);

    // Delete storage files for all selected
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

    await supabase.from("optimization_jobs").delete().in("id", ids);
    setJobs((prev) => prev.filter((j) => !selected.has(j.id)));
    setSelected(new Set());
    setDeleting(false);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  function statusBadge(status: string) {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="bg-forest-50 text-forest-700 border-forest-200">Completado</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Procesando</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title + actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-forest-950">Mis rutas</h1>
            <p className="text-sm text-muted-foreground">
              {jobs.length} {jobs.length === 1 ? "optimización" : "optimizaciones"}
            </p>
          </div>
          <Link href="/nueva-ruta" className={cn(buttonVariants())}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva ruta
          </Link>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16">
              <div className="w-12 h-12 rounded-full bg-forest-50 text-forest-500 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="19" r="3" />
                  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                  <circle cx="18" cy="5" r="3" />
                </svg>
              </div>
              <CardTitle className="text-base mb-1">No hay rutas todavía</CardTitle>
              <CardDescription className="mb-4">
                Creá tu primera ruta optimizada subiendo un Excel de pedidos
              </CardDescription>
              <Link href="/nueva-ruta" className={cn(buttonVariants())}>Crear primera ruta</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Toolbar: filters + search + bulk actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por fecha..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48"
              />

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger size="sm" className="w-36">
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

              {/* Bulk delete */}
              {someSelected && (
                <AlertDialog>
                  <AlertDialogTrigger
                    className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}
                  >
                    Eliminar ({selected.size})
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Eliminar {selected.size} {selected.size === 1 ? "ruta" : "rutas"}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminarán las optimizaciones seleccionadas y sus archivos asociados. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={deleteBulk}
                        disabled={deleting}
                      >
                        {deleting ? "Eliminando..." : "Eliminar"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort("created_at")}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Fecha <span className="text-xs opacity-50">{sortIcon("created_at")}</span>
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button
                        onClick={() => toggleSort("order_count")}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Pedidos <span className="text-xs opacity-50">{sortIcon("order_count")}</span>
                      </button>
                    </TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        No hay resultados para estos filtros
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className={cn(
                          "hover:bg-forest-50/50 transition-colors",
                          selected.has(job.id) && "bg-forest-50/30"
                        )}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(job.id)}
                            onCheckedChange={() => toggleSelect(job.id)}
                          />
                        </TableCell>
                        <TableCell
                          className="font-medium cursor-pointer"
                          onClick={() => {
                            if (job.status === "completed") router.push(`/rutas/${job.id}`);
                          }}
                        >
                          {new Date(job.created_at).toLocaleDateString("es-UY", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          <span className="block text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleTimeString("es-UY", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {job.order_count}
                        </TableCell>
                        <TableCell className="text-center">
                          {statusBadge(job.status)}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {job.status === "completed" && (
                              <Link
                                href={`/rutas/${job.id}`}
                                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
                                title="Ver ruta"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </Link>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger
                                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-destructive")}
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* Footer count */}
            {filteredJobs.length !== jobs.length && (
              <p className="text-xs text-muted-foreground text-center">
                Mostrando {filteredJobs.length} de {jobs.length}
              </p>
            )}
          </div>
        )}
      </main>
  );
}
