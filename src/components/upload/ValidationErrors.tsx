"use client";

import type { ValidationError } from "@/types";

interface ValidationErrorsProps {
  errors: ValidationError[];
}

export default function ValidationErrors({ errors }: ValidationErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <div className="bg-terra-500/5 border border-terra-400/20 rounded-2xl p-5 animate-slide-down">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-terra-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-sm font-semibold text-terra-600">
          {errors.length} {errors.length === 1 ? "error" : "errores"} en el archivo
        </p>
      </div>
      <ul className="space-y-1 max-h-40 overflow-y-auto">
        {errors.map((err, i) => (
          <li
            key={i}
            className="text-xs text-terra-600/80 flex items-start gap-2"
          >
            <span className="text-terra-400 mt-0.5">•</span>
            {err.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
