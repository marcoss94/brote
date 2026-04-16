"use client";

import type { GeocodingProgress as GeocodingProgressType } from "@/types";

interface GeocodingProgressProps {
  progress: GeocodingProgressType;
}

export default function GeocodingProgress({ progress }: GeocodingProgressProps) {
  const percent =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-forest-100 text-forest-600 flex items-center justify-center">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-forest-950">
              Geocodificando direcciones
            </p>
            <p className="text-[11px] text-sage-400">
              {progress.current}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium text-forest-600 tabular-nums">
          {progress.completed}/{progress.total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-forest-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-forest-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Failed addresses */}
      {progress.failed.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs font-medium text-terra-500 mb-1.5">
            Direcciones con error ({progress.failed.length}):
          </p>
          <ul className="space-y-0.5">
            {progress.failed.map((addr, i) => (
              <li key={i} className="text-[11px] text-terra-500/70">
                • {addr}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
