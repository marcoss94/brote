"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { GeocodingProgress as GeocodingProgressType } from "@/types";

interface GeocodingProgressProps {
  progress: GeocodingProgressType;
}

export default function GeocodingProgress({ progress }: GeocodingProgressProps) {
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Geocodificando direcciones</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{progress.current}</p>
          </div>
          <span className="text-xs font-medium tabular-nums">
            {progress.completed}/{progress.total}
          </span>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        {progress.failed.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-destructive mb-1">
              Direcciones con error ({progress.failed.length}):
            </p>
            <ul className="space-y-0.5">
              {progress.failed.map((addr, i) => (
                <li key={i} className="text-[11px] text-destructive/70">• {addr}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
