"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { parseExcel } from "@/lib/excel";
import type { ParsedExcel } from "@/types";

interface FileUploadProps {
  onFileParsed: (result: ParsedExcel, file: File) => void;
  disabled?: boolean;
}

export default function FileUpload({ onFileParsed, disabled }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setFileName(file.name);
      setParsing(true);

      const buffer = await file.arrayBuffer();
      const result = parseExcel(buffer);
      onFileParsed(result, file);
      setParsing(false);
    },
    [onFileParsed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
        transition-all duration-300
        ${
          disabled
            ? "opacity-50 cursor-not-allowed border-border bg-cream-100"
            : isDragActive
            ? "border-forest-400 bg-forest-50 scale-[1.01]"
            : "border-border hover:border-forest-300 hover:bg-cream-50 bg-card"
        }
      `}
    >
      <input {...getInputProps()} />

      {parsing ? (
        <div className="animate-pulse-gentle">
          <div className="w-12 h-12 rounded-2xl bg-forest-100 text-forest-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-forest-800">Procesando archivo...</p>
        </div>
      ) : fileName ? (
        <div className="animate-scale-in">
          <div className="w-12 h-12 rounded-2xl bg-forest-100 text-forest-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-forest-900 mb-1">{fileName}</p>
          <p className="text-xs text-sage-400">
            Arrastrá otro archivo para reemplazar
          </p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-forest-100/60 text-forest-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-forest-900 mb-1">
            {isDragActive
              ? "Soltá el archivo acá"
              : "Arrastrá tu Excel o hacé click"}
          </p>
          <p className="text-xs text-sage-400">
            Formato .xlsx con columnas: numero_pedido, cliente, direccion,
            franja_desde, franja_hasta
          </p>
        </>
      )}
    </div>
  );
}
