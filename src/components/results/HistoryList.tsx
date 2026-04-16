"use client";

import type { OptimizationJob } from "@/types";

interface HistoryListProps {
  jobs: OptimizationJob[];
  onDownload: (job: OptimizationJob) => void;
}

export default function HistoryList({ jobs, onDownload }: HistoryListProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 rounded-2xl bg-cream-200 text-sage-400 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <p className="text-sm text-sage-400">No hay optimizaciones previas</p>
        <p className="text-xs text-sage-300 mt-1">
          Subí un Excel para empezar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job, i) => (
        <div
          key={job.id}
          className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3 hover:border-forest-200 transition-colors animate-fade-in-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Status icon */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              job.status === "completed"
                ? "bg-forest-100 text-forest-600"
                : job.status === "error"
                ? "bg-terra-500/10 text-terra-500"
                : "bg-cream-200 text-sage-400"
            }`}
          >
            {job.status === "completed" ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : job.status === "error" ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-forest-950">
              {job.order_count} pedidos
            </p>
            <p className="text-[11px] text-sage-400">
              {new Date(job.created_at).toLocaleDateString("es-UY", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Status badge */}
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              job.status === "completed"
                ? "bg-forest-50 text-forest-600"
                : job.status === "error"
                ? "bg-terra-500/10 text-terra-500"
                : "bg-cream-200 text-sage-500"
            }`}
          >
            {job.status === "completed"
              ? "Completado"
              : job.status === "error"
              ? "Error"
              : "Procesando"}
          </span>

          {/* Download */}
          {job.status === "completed" && job.result_file_path && (
            <button
              onClick={() => onDownload(job)}
              className="text-forest-600 hover:text-forest-800 transition-colors"
              title="Descargar resultado"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
