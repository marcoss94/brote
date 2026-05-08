"use client";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import type { RouteStop } from "@/types";

interface SortableRouteListProps {
  route: RouteStop[];
  onReorder: (route: RouteStop[]) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export default function SortableRouteList({
  route,
  onReorder,
  selectedId,
  onSelect,
}: SortableRouteListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = route.findIndex((s) => s.numero_pedido === active.id);
    const newIndex = route.findIndex((s) => s.numero_pedido === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(route, oldIndex, newIndex);
    onReorder(reordered);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={route.map((s) => s.numero_pedido)}
        strategy={verticalListSortingStrategy}
      >
        <div className="divide-y divide-border">
          {route.map((stop) => (
            <SortableItem
              key={stop.numero_pedido}
              stop={stop}
              isSelected={stop.numero_pedido === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  stop,
  isSelected,
  onSelect,
}: {
  stop: RouteStop;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.numero_pedido });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect?.(isSelected ? "" : stop.numero_pedido)}
      className={`relative px-3 py-3 transition-colors cursor-pointer ${
        isDragging
          ? "bg-muted"
          : isSelected
          ? "bg-muted/60 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-terra-500"
          : "hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 mt-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Reordenar"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="6" r="1" fill="currentColor" />
            <circle cx="9" cy="12" r="1" fill="currentColor" />
            <circle cx="9" cy="18" r="1" fill="currentColor" />
            <circle cx="15" cy="6" r="1" fill="currentColor" />
            <circle cx="15" cy="12" r="1" fill="currentColor" />
            <circle cx="15" cy="18" r="1" fill="currentColor" />
          </svg>
        </button>

        <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold flex-shrink-0">
          {stop.orden}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {stop.cliente}
          </p>
          <p className="text-xs text-muted-foreground truncate mb-1">
            {stop.direccion}
          </p>
          {stop.producto && (
            <p className="text-[11px] text-foreground truncate mb-1.5">
              <span className="text-muted-foreground">Producto: </span>
              {stop.producto}
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {stop.fecha && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {stop.fecha}
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="text-[10px] h-5 px-1.5 bg-muted text-foreground border-border"
            >
              {stop.distancia_acumulada_km.toFixed(1)} km
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
