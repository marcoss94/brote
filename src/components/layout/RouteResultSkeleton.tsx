import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function RouteResultSkeleton() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-4">
      {/* Sticky top bar mock */}
      <div className="sticky top-16 z-30 -mx-6 px-6 py-3 mb-4 bg-background/95 border-b border-border">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Back + title */}
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-7 h-7 rounded-md" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>

          {/* Inline metrics */}
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-3.5 w-8" />
            </div>
            <span className="w-px h-6 bg-border" />
            <div className="space-y-1">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          </div>

          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      </div>

      {/* Map + sidebar full height */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 h-[calc(100vh-180px)]">
        <Skeleton className="h-full min-h-[500px] rounded-xl" />
        <Card className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-36" />
          </div>
          <div className="divide-y divide-border flex-1 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-3 py-3 flex items-start gap-2">
                <Skeleton className="w-4 h-4 mt-1" />
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-40" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-4 w-14 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
