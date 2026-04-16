"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ValidationError } from "@/types";

interface ValidationErrorsProps {
  errors: ValidationError[];
}

export default function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <Card className="border-destructive/30">
      <CardContent className="py-4">
        <p className="text-sm font-semibold text-destructive mb-2">
          {errors.length} {errors.length === 1 ? "error" : "errores"} en el archivo
        </p>
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {errors.map((err, i) => (
            <li key={i} className="text-xs text-destructive/80">
              • {err.message}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
