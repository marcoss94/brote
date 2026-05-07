"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { parseExcel, generateTemplateExcel } from "@/lib/excel";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
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
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled,
  });

  function handleDownloadTemplate(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const buffer = generateTemplateExcel();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "brote_plantilla_pedidos.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Plantilla descargada");
    } catch {
      toast.error("Error al generar plantilla");
    }
  }

  return (
    <Card
      {...getRootProps()}
      className={`relative border-2 border-dashed p-12 text-center cursor-pointer transition-all overflow-hidden ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : isDragActive
          ? "border-terra-400 bg-terra-500/5 scale-[1.005]"
          : "hover:border-terra-400 hover:bg-muted/40"
      }`}
    >
      <input {...getInputProps()} />

      {parsing ? (
        <div className="animate-pulse space-y-3">
          <div className="w-14 h-14 rounded-full bg-muted mx-auto" />
          <p className="text-sm font-medium">Procesando archivo...</p>
        </div>
      ) : fileName ? (
        <div>
          <div className="w-14 h-14 rounded-full bg-muted text-foreground flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <p className="text-base font-semibold text-foreground">{fileName}</p>
          <p className="text-xs text-muted-foreground mt-1">Arrastrá otro archivo para reemplazar</p>
        </div>
      ) : (
        <div>
          <div className="w-14 h-14 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-base font-semibold text-foreground mb-1">
            {isDragActive ? "Soltá el archivo acá" : "Arrastrá tu Excel o hacé click"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Formato .xlsx · Máximo 500 pedidos
          </p>

          {/* Template download — inline subtle CTA */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 text-xs text-terra-600 hover:text-terra-700 underline underline-offset-4 decoration-terra-400/40 hover:decoration-terra-500 transition-colors"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar plantilla de Excel
          </button>
        </div>
      )}
    </Card>
  );
}
