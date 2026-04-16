import * as XLSX from "xlsx";
import type { Order, ParsedExcel, ValidationError, RouteStop } from "@/types";

const REQUIRED_COLUMNS = [
  "numero_pedido",
  "cliente",
  "direccion",
  "franja_desde",
  "franja_hasta",
];

const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseExcel(buffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (rows.length === 0) {
    return {
      orders: [],
      errors: [{ row: 0, column: "", message: "El archivo está vacío" }],
      extraColumns: [],
    };
  }

  // Check required columns
  const headers = Object.keys(rows[0]);
  const headersLower = headers.map((h) => h.toLowerCase().trim());
  const errors: ValidationError[] = [];

  for (const col of REQUIRED_COLUMNS) {
    if (!headersLower.includes(col)) {
      errors.push({
        row: 0,
        column: col,
        message: `Columna obligatoria "${col}" no encontrada`,
      });
    }
  }

  if (errors.length > 0) {
    return { orders: [], errors, extraColumns: [] };
  }

  // Map headers to normalized keys
  const headerMap: Record<string, string> = {};
  for (const h of headers) {
    headerMap[h] = h.toLowerCase().trim();
  }

  const knownColumns = new Set([
    "numero_pedido",
    "cliente",
    "direccion",
    "ciudad",
    "franja_desde",
    "franja_hasta",
    "telefono",
    "notas",
  ]);
  const extraColumns = headersLower.filter((h) => !knownColumns.has(h));

  const orders: Order[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (1-indexed + header)

    // Build normalized row
    const normalized: Record<string, unknown> = {};
    for (const [original, lower] of Object.entries(headerMap)) {
      normalized[lower] = row[original];
    }

    // Validate required fields
    if (!normalized.numero_pedido && normalized.numero_pedido !== 0) {
      errors.push({
        row: rowNum,
        column: "numero_pedido",
        message: `Fila ${rowNum}: falta número de pedido`,
      });
    }
    if (!normalized.cliente) {
      errors.push({
        row: rowNum,
        column: "cliente",
        message: `Fila ${rowNum}: falta nombre del cliente`,
      });
    }
    if (!normalized.direccion) {
      errors.push({
        row: rowNum,
        column: "direccion",
        message: `Fila ${rowNum}: falta dirección`,
      });
    }

    // Validate time formats
    const franjaDesde = String(normalized.franja_desde || "").trim();
    const franjaHasta = String(normalized.franja_hasta || "").trim();

    if (franjaDesde && !TIME_REGEX.test(franjaDesde)) {
      errors.push({
        row: rowNum,
        column: "franja_desde",
        message: `Fila ${rowNum}: franja_desde inválida "${franjaDesde}" (formato: HH:MM)`,
      });
    }
    if (franjaHasta && !TIME_REGEX.test(franjaHasta)) {
      errors.push({
        row: rowNum,
        column: "franja_hasta",
        message: `Fila ${rowNum}: franja_hasta inválida "${franjaHasta}" (formato: HH:MM)`,
      });
    }

    // Preserve all original data
    const order: Order = {
      numero_pedido: String(normalized.numero_pedido ?? ""),
      cliente: String(normalized.cliente ?? ""),
      direccion: String(normalized.direccion ?? ""),
      ciudad: String(normalized.ciudad || "Montevideo"),
      franja_desde: franjaDesde,
      franja_hasta: franjaHasta,
      telefono: normalized.telefono ? String(normalized.telefono) : undefined,
      notas: normalized.notas ? String(normalized.notas) : undefined,
    };

    // Preserve extra columns
    for (const col of extraColumns) {
      order[col] = normalized[col];
    }

    orders.push(order);
  }

  return { orders, errors, extraColumns };
}

export function generateResultExcel(
  originalBuffer: ArrayBuffer,
  route: RouteStop[]
): ArrayBuffer {
  const workbook = XLSX.read(originalBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  // Create order map for quick lookup
  const routeMap = new Map<string, RouteStop>();
  for (const stop of route) {
    routeMap.set(String(stop.numero_pedido), stop);
  }

  // Add new columns and sort by route order
  const enrichedRows = rows
    .map((row) => {
      // Find the matching key (case-insensitive)
      const pedidoKey = Object.keys(row).find(
        (k) => k.toLowerCase().trim() === "numero_pedido"
      );
      const pedidoVal = pedidoKey ? String(row[pedidoKey]) : "";
      const stop = routeMap.get(pedidoVal);

      return {
        ...row,
        orden_entrega: stop?.orden ?? 999,
        hora_estimada: stop?.hora_estimada ?? "",
        distancia_acumulada_km: stop?.distancia_acumulada_km ?? 0,
      };
    })
    .sort(
      (a, b) =>
        (a.orden_entrega as number) - (b.orden_entrega as number)
    );

  // Create new workbook
  const newSheet = XLSX.utils.json_to_sheet(enrichedRows);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);

  const output = XLSX.write(newWorkbook, {
    type: "array",
    bookType: "xlsx",
  });

  return output;
}
