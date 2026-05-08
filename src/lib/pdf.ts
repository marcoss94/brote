import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RouteStop } from "@/types";
import { wazeUrl } from "./whatsapp";

interface GenerateOptions {
  route: RouteStop[];
  date: string;
  driverName?: string;
}

/**
 * Generate a printable PDF with route info.
 * One page summary + detail per stop with Waze URL.
 */
export function generateRoutePDF({
  route,
  date,
  driverName,
}: GenerateOptions): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 15;

  // ===== Header =====
  doc.setFillColor(35, 35, 35);
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Brote", marginX, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Hoja de ruta — ${date}`, marginX, 21);

  // Right aligned stats
  doc.setFontSize(8);
  doc.text(`${route.length} entregas`, pageWidth - marginX, 13, { align: "right" });
  if (driverName) {
    doc.text(`Repartidor: ${driverName}`, pageWidth - marginX, 19, { align: "right" });
  }

  // ===== Summary table =====
  doc.setTextColor(0, 0, 0);
  let cursorY = 42;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumen de entregas", marginX, cursorY);
  cursorY += 4;

  autoTable(doc, {
    startY: cursorY,
    head: [["#", "Cliente", "Dirección", "Producto", "Tel"]],
    body: route.map((s) => [
      String(s.orden),
      s.cliente,
      s.direccion,
      s.producto || "—",
      s.telefono || "—",
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [245, 240, 232],
      textColor: [35, 35, 35],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 45 },
      2: { cellWidth: 55 },
      3: { cellWidth: 45 },
      4: { cellWidth: 25 },
    },
    margin: { left: marginX, right: marginX },
  });

  // ===== Detail per stop (with Waze URL) =====
  doc.addPage();
  cursorY = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(26, 58, 42);
  doc.text("Detalle por parada", marginX, cursorY);
  cursorY += 10;

  doc.setTextColor(0, 0, 0);

  const textX = marginX + 14;
  const textMaxWidth = pageWidth - textX - marginX;
  const lineH = 4;

  route.forEach((stop) => {
    // Pre-wrap multi-line fields to compute exact height
    doc.setFontSize(8);
    const mensajeLines = stop.mensaje
      ? doc.splitTextToSize(`Tarjeta: ${stop.mensaje}`, textMaxWidth)
      : [];
    const obsLines = stop.obs
      ? doc.splitTextToSize(`Obs: ${stop.obs}`, textMaxWidth)
      : [];

    const singleLines =
      Number(!!stop.telefono) + Number(!!stop.producto);
    const totalOptLines = singleLines + mensajeLines.length + obsLines.length;
    // 14 = top of optional block, then per-line, then gap + waze line
    const blockHeight = 14 + totalOptLines * lineH + 6 + 4;

    if (cursorY + blockHeight > 280) {
      doc.addPage();
      cursorY = 20;
    }

    // Number badge
    doc.setFillColor(35, 35, 35);
    doc.circle(marginX + 5, cursorY + 2, 5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(String(stop.orden), marginX + 5, cursorY + 3.8, { align: "center" });

    // Client name + fecha
    doc.setTextColor(35, 35, 35);
    doc.setFontSize(12);
    let clientHeader = stop.cliente;
    if (stop.fecha) clientHeader += `  ·  ${stop.fecha}`;
    doc.text(clientHeader, textX, cursorY + 3);

    // Address
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(stop.direccion, textX, cursorY + 9);

    // Optional lines
    let optY = cursorY + 14;
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    if (stop.telefono) { doc.text(`Tel: ${stop.telefono}`, textX, optY); optY += lineH; }
    if (stop.producto) { doc.text(`Producto: ${stop.producto}`, textX, optY); optY += lineH; }
    if (mensajeLines.length) {
      doc.text(mensajeLines, textX, optY);
      optY += lineH * mensajeLines.length;
    }
    if (obsLines.length) {
      doc.setTextColor(168, 90, 56);
      doc.text(obsLines, textX, optY);
      optY += lineH * obsLines.length;
    }

    // Waze link
    doc.setTextColor(241, 157, 118);
    doc.setFontSize(7);
    doc.textWithLink(
      `Navegar en Waze: ${wazeUrl(stop.lat, stop.lng)}`,
      textX,
      optY + 3,
      { url: wazeUrl(stop.lat, stop.lng) }
    );

    cursorY += blockHeight;
  });

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Brote — Optimizador de Entregas  ·  Página ${i} de ${pageCount}`,
      pageWidth / 2,
      290,
      { align: "center" }
    );
  }

  return doc;
}

export function downloadRoutePDF(opts: GenerateOptions) {
  const doc = generateRoutePDF(opts);
  const filename = `ruta_${opts.date.replace(/\s/g, "_")}.pdf`;
  doc.save(filename);
}
