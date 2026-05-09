"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { Profile, OptimizationJob, RouteStop } from "@/types";

interface Props {
  profiles: Profile[];
  jobs: OptimizationJob[];
}

const chartConfig = {
  jobs: { label: "Rutas", color: "var(--terra-500)" },
} satisfies ChartConfig;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-UY", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function totalKm(route: RouteStop[] | null | undefined): number {
  if (!route || route.length === 0) return 0;
  return route[route.length - 1]?.distancia_acumulada_km ?? 0;
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminDashboard({ profiles, jobs }: Props) {
  const [userFilter, setUserFilter] = useState("");

  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  // Per-user stats
  const userStats = useMemo(() => {
    const stats = new Map<string, { count: number; lastJob: string | null; totalStops: number; totalKm: number }>();
    for (const j of jobs) {
      const s = stats.get(j.user_id) || { count: 0, lastJob: null, totalStops: 0, totalKm: 0 };
      s.count++;
      s.totalStops += j.order_count || 0;
      s.totalKm += totalKm(j.route_data);
      if (!s.lastJob || (j.created_at > s.lastJob)) s.lastJob = j.created_at;
      stats.set(j.user_id, s);
    }
    return stats;
  }, [jobs]);

  // KPIs
  const kpis = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const jobs7d = jobs.filter((j) => new Date(j.created_at).getTime() >= sevenDaysAgo).length;
    const totalStops = jobs.reduce((acc, j) => acc + (j.order_count || 0), 0);
    const completed = jobs.filter((j) => j.status === "completed").length;
    const totalKmAll = jobs.reduce((acc, j) => acc + totalKm(j.route_data), 0);
    return {
      users: profiles.length,
      jobs: jobs.length,
      jobs7d,
      completed,
      totalStops,
      totalKm: totalKmAll,
    };
  }, [profiles, jobs]);

  // Chart: jobs per day, last 28 days
  const chartData = useMemo(() => {
    const days: { date: string; label: string; jobs: number }[] = [];
    const now = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = localDateKey(d.toISOString());
      days.push({
        date: key,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        jobs: 0,
      });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    for (const j of jobs) {
      const k = localDateKey(j.created_at);
      const i = idx.get(k);
      if (i !== undefined) days[i].jobs++;
    }
    return days;
  }, [jobs]);

  const filteredProfiles = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.email || "").toLowerCase().includes(q) ||
        (p.full_name || "").toLowerCase().includes(q)
    );
  }, [profiles, userFilter]);

  const recentJobs = useMemo(() => jobs.slice(0, 50), [jobs]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panel de admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Uso de la app, usuarios y rutas generadas.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Usuarios" value={kpis.users} />
        <KpiCard label="Rutas totales" value={kpis.jobs} />
        <KpiCard label="Últimos 7 días" value={kpis.jobs7d} />
        <KpiCard label="Completadas" value={kpis.completed} />
        <KpiCard label="Paradas total" value={kpis.totalStops} />
        <KpiCard label="Km optimizados" value={`${kpis.totalKm.toFixed(0)}`} />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rutas por día</CardTitle>
          <CardDescription>Últimos 28 días</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="jobs" fill="var(--color-jobs)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Usuarios</CardTitle>
              <CardDescription>{filteredProfiles.length} de {profiles.length}</CardDescription>
            </div>
            <Input
              placeholder="Buscar por nombre o email..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Alta</TableHead>
                  <TableHead className="text-right">Rutas</TableHead>
                  <TableHead className="text-right">Paradas</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead>Última ruta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p) => {
                  const s = userStats.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {p.full_name || "—"}
                          {p.is_admin && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-terra-500/20 text-terra-600 border-terra-500/30">
                              admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.email || "—"}</TableCell>
                      <TableCell className="text-xs">{formatDate(p.created_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s?.count ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{s?.totalStops ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{(s?.totalKm ?? 0).toFixed(0)}</TableCell>
                      <TableCell className="text-xs">{formatDate(s?.lastJob ?? null)}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredProfiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Sin resultados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rutas recientes</CardTitle>
          <CardDescription>Últimas 50</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Paradas</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((j) => {
                  const owner = profilesById.get(j.user_id);
                  const km = totalKm(j.route_data);
                  return (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDateTime(j.created_at)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{owner?.full_name || "—"}</span>
                          <span className="text-muted-foreground">{owner?.email || j.user_id.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={j.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{j.order_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{km.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        {j.status === "completed" && (
                          <Link
                            href={`/rutas/${j.id}`}
                            className="text-xs text-terra-600 hover:underline"
                          >
                            Ver
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {recentJobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sin rutas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: OptimizationJob["status"] }) {
  if (status === "completed") {
    return <Badge className="bg-forest-100 text-forest-800 border-forest-200 hover:bg-forest-100">Completada</Badge>;
  }
  if (status === "error") {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <Badge variant="secondary">Procesando</Badge>;
}
