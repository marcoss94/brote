import * as XLSX from "xlsx";
import type { Order, ParsedExcel, ValidationError, RouteStop, PickupOrder } from "@/types";

const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

// Detect pickup orders by direccion keyword
const PICKUP_KEYWORDS = ["retira", "retiro en", "pickup"];

// Column aliases — maps normalized keys to actual header names (case-insensitive, space-flexible)
const COLUMN_ALIASES: Record<string, string[]> = {
  numero_pedido: ["numero_pedido", "numero pedido", "n_pedido", "id"],
  cliente: ["nombre", "cliente", "nombre cliente"],
  direccion: ["direccion", "dirección", "domicilio"],
  ciudad: ["ciudad"],
  fecha: ["fecha"],
  telefono: ["telefono", "teléfono", "tel"],
  red_social: ["red social", "red_social", "canal", "origen"],
  producto: ["producto", "productos", "detalle", "item"],
  mensaje: ["mensaje", "tarjeta"],
  obs: ["obs", "observaciones", "observacion", "notas"],
  franja_desde: ["franja_desde", "franja desde", "horario_desde", "desde"],
  franja_hasta: ["franja_hasta", "franja hasta", "horario_hasta", "hasta"],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, " ");
}

function matchColumn(headers: string[], aliases: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

// Decode common HTML entities present in the Excel (e.g., &iacute; → í)
function decodeHtmlEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&uuml;/g, "ü")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function isPickup(direccion: string): boolean {
  const d = direccion.toLowerCase();
  return PICKUP_KEYWORDS.some((k) => d.startsWith(k) || d.includes(k));
}

export const EXCEL_COLUMNS: {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
}[] = [
  { key: "FECHA", label: "FECHA", required: false, description: "Fecha del pedido (DD/MM)", example: "14/02" },
  { key: "NOMBRE", label: "NOMBRE", required: true, description: "Nombre del cliente", example: "María García" },
  { key: "TELEFONO", label: "TELEFONO", required: false, description: "Contacto", example: "099123456" },
  { key: "RED SOCIAL", label: "RED SOCIAL", required: false, description: "Canal de origen", example: "WEB" },
  { key: "DIRECCION", label: "DIRECCION", required: true, description: 'Dirección o "RETIRA ..."', example: "Av. Brasil 2580" },
  { key: "PRODUCTO", label: "PRODUCTO", required: false, description: "Producto", example: "12 rosas rojas" },
  { key: "MENSAJE", label: "MENSAJE", required: false, description: "Mensaje de tarjeta", example: "Feliz aniversario" },
  { key: "OBS", label: "OBS", required: false, description: "Observaciones", example: "Tocar timbre 2B" },
  { key: "FRANJA_DESDE", label: "FRANJA_DESDE", required: false, description: "Inicio ventana (HH:MM)", example: "09:00" },
  { key: "FRANJA_HASTA", label: "FRANJA_HASTA", required: false, description: "Fin ventana (HH:MM)", example: "12:00" },
];

export function generateTemplateExcel(): ArrayBuffer {
  const sampleRows = [
    {
      FECHA: "14/02",
      NOMBRE: "María García",
      TELEFONO: "099123456",
      "RED SOCIAL": "WEB",
      DIRECCION: "Av. Brasil 2580",
      PRODUCTO: "12 rosas rojas",
      MENSAJE: "Feliz aniversario",
      OBS: "Tocar timbre 2B",
      FRANJA_DESDE: "09:00",
      FRANJA_HASTA: "12:00",
    },
    {
      FECHA: "14/02",
      NOMBRE: "Juan Pérez",
      TELEFONO: "098654321",
      "RED SOCIAL": "Instagram",
      DIRECCION: "RETIRA PUNTA CARRETAS",
      PRODUCTO: "Bouquet mixto",
      MENSAJE: "",
      OBS: "",
      FRANJA_DESDE: "",
      FRANJA_HASTA: "",
    },
  ];

  const sheet = XLSX.utils.json_to_sheet(sampleRows);
  sheet["!cols"] = [
    { wch: 8 },   // FECHA
    { wch: 22 },  // NOMBRE
    { wch: 14 },  // TELEFONO
    { wch: 12 },  // RED SOCIAL
    { wch: 32 },  // DIRECCION
    { wch: 28 },  // PRODUCTO
    { wch: 30 },  // MENSAJE
    { wch: 24 },  // OBS
    { wch: 12 },  // FRANJA_DESDE
    { wch: 12 },  // FRANJA_HASTA
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Pedidos");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

export function parseExcel(buffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const errors: ValidationError[] = [];
  const pickupOrders: PickupOrder[] = [];

  if (rows.length === 0) {
    return {
      orders: [],
      errors: [{ row: 0, column: "", message: "El archivo está vacío" }],
      extraColumns: [],
      pickupOrders: [],
    };
  }

  const headers = Object.keys(rows[0]);

  // Resolve column references
  const resolved: Record<string, string | null> = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    resolved[key] = matchColumn(headers, aliases);
  }

  // Required: NOMBRE + DIRECCION
  if (!resolved.cliente) {
    errors.push({ row: 0, column: "NOMBRE", message: 'Columna "NOMBRE" no encontrada' });
  }
  if (!resolved.direccion) {
    errors.push({ row: 0, column: "DIRECCION", message: 'Columna "DIRECCION" no encontrada' });
  }
  if (errors.length > 0) {
    return { orders: [], errors, extraColumns: [], pickupOrders: [] };
  }

  // Extra columns not covered by known aliases
  const knownHeaders = new Set(
    Object.values(resolved).filter((v): v is string => !!v)
  );
  const extraColumns = headers.filter((h) => !knownHeaders.has(h));

  const orders: Order[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const get = (key: string): string => {
      const header = resolved[key];
      if (!header) return "";
      const val = row[header];
      if (val === null || val === undefined || val === "") return "";
      return decodeHtmlEntities(String(val).trim());
    };

    const cliente = get("cliente");
    const direccion = get("direccion");

    // Skip fully empty rows silently
    if (!cliente && !direccion) continue;

    if (!cliente) {
      errors.push({
        row: rowNum,
        column: "NOMBRE",
        message: `Fila ${rowNum}: falta nombre`,
      });
    }
    if (!direccion) {
      errors.push({
        row: rowNum,
        column: "DIRECCION",
        message: `Fila ${rowNum}: falta dirección`,
      });
    }

    // Time validation only if provided
    const franjaDesde = get("franja_desde");
    const franjaHasta = get("franja_hasta");

    if (franjaDesde && !TIME_REGEX.test(franjaDesde)) {
      errors.push({
        row: rowNum,
        column: "FRANJA_DESDE",
        message: `Fila ${rowNum}: FRANJA_DESDE inválida "${franjaDesde}" (formato HH:MM)`,
      });
    }
    if (franjaHasta && !TIME_REGEX.test(franjaHasta)) {
      errors.push({
        row: rowNum,
        column: "FRANJA_HASTA",
        message: `Fila ${rowNum}: FRANJA_HASTA inválida "${franjaHasta}" (formato HH:MM)`,
      });
    }

    const pedidoId = get("numero_pedido") || `row-${i + 1}`;
    const pickup = isPickup(direccion);

    // Handle pickup — send to separate list, don't include in delivery orders
    if (pickup) {
      pickupOrders.push({
        numero_pedido: pedidoId,
        cliente,
        telefono: get("telefono") || undefined,
        fecha: get("fecha") || undefined,
        producto: get("producto") || undefined,
        mensaje: get("mensaje") || undefined,
        red_social: get("red_social") || undefined,
        obs: get("obs") || undefined,
        direccion_original: direccion,
      });
      continue;
    }

    const order: Order = {
      numero_pedido: pedidoId,
      cliente,
      direccion,
      ciudad: "Montevideo",
      franja_desde: franjaDesde,
      franja_hasta: franjaHasta,
      telefono: get("telefono") || undefined,
      notas: get("obs") || undefined,
      fecha: get("fecha") || undefined,
      producto: get("producto") || undefined,
      mensaje: get("mensaje") || undefined,
      red_social: get("red_social") || undefined,
      obs: get("obs") || undefined,
      pickup: false,
    };

    // Preserve extra columns unchanged
    for (const col of extraColumns) {
      order[col] = row[col];
    }

    orders.push(order);
  }

  return { orders, errors, extraColumns, pickupOrders };
}

export function generateResultExcel(
  originalBuffer: ArrayBuffer,
  route: RouteStop[],
  pickupOrders: PickupOrder[] = []
): ArrayBuffer {
  const workbook = XLSX.read(originalBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const idHeader =
    headers.find((h) => normalizeHeader(h) === "numero_pedido" || normalizeHeader(h) === "id") || null;

  // Resolve direccion column — use it to overwrite with corrected address from route_data
  const direccionHeader = matchColumn(headers, COLUMN_ALIASES.direccion);

  // Map route by numero_pedido — either from a real ID column or fall back to row index
  const routeMap = new Map<string, RouteStop>();
  for (const stop of route) {
    routeMap.set(String(stop.numero_pedido), stop);
  }
  const pickupSet = new Set(pickupOrders.map((p) => p.numero_pedido));

  const enrichedRows = rows.map((row, i) => {
    const key = idHeader ? String(row[idHeader] ?? "") : `row-${i + 1}`;
    const stop = routeMap.get(key);
    const isPickupRow = pickupSet.has(key);

    const enriched: Record<string, unknown> = {
      ...row,
      orden_entrega: stop?.orden ?? (isPickupRow ? "RETIRO" : ""),
      hora_estimada: stop?.hora_estimada ?? "",
      distancia_acumulada_km: stop?.distancia_acumulada_km ?? "",
    };

    // Overwrite direccion with corrected one (if user fixed via retry/map-pick)
    if (stop && direccionHeader && stop.direccion) {
      enriched[direccionHeader] = stop.direccion;
    }

    return enriched;
  });

  // Sort: deliveries by orden, pickups at end
  enrichedRows.sort((a, b) => {
    const ao = a.orden_entrega;
    const bo = b.orden_entrega;
    if (typeof ao === "number" && typeof bo === "number") return ao - bo;
    if (typeof ao === "number") return -1;
    if (typeof bo === "number") return 1;
    return 0;
  });

  const newSheet = XLSX.utils.json_to_sheet(enrichedRows);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);

  return XLSX.write(newWorkbook, { type: "array", bookType: "xlsx" });
}
