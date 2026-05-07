"use client";

import type { RouteStop } from "@/types";

interface ResultPreviewProps {
  route: RouteStop[];
  onDownload: () => void;
  downloading?: boolean;
}

export default function ResultPreview({
  route,
  onDownload,
  downloading,
}: ResultPreviewProps) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Ruta optimizada
            </p>
            <p className="text-[11px] text-sage-400">
              {route.length} paradas · {route[route.length - 1]?.distancia_acumulada_km ?? 0} km total
            </p>
          </div>
        </div>

        <button
          onClick={onDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-50 text-cream-50 font-medium px-4 py-2 rounded-xl text-xs transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {downloading ? "Descargando..." : "Descargar Excel"}
        </button>
      </div>

      {/* Route list */}
      <div className="max-h-80 overflow-y-auto">
        {route.map((stop, i) => (
          <div
            key={stop.numero_pedido}
            className={`flex items-center gap-4 px-5 py-3 ${
              i < route.length - 1 ? "border-b border-border/50" : ""
            } hover:bg-cream-50/50 transition-colors animate-fade-in-up`}
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {/* Order number badge */}
            <div className="w-8 h-8 rounded-full bg-forest-700 text-cream-50 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {stop.orden}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {stop.cliente}
              </p>
              <p className="text-[11px] text-sage-400 truncate">
                {stop.direccion}
              </p>
            </div>

            {/* Time & distance */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {stop.hora_estimada}
              </p>
              <p className="text-[11px] text-sage-400 tabular-nums">
                {stop.distancia_acumulada_km} km
              </p>
            </div>

            {/* Time window badge */}
            <div className="hidden sm:block">
              <span className="inline-block text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                {stop.franja}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
