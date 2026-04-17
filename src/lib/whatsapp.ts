import type { RouteStop } from "@/types";

/**
 * Build a Waze navigation URL for given coordinates.
 * Opens Waze (app or web) and starts navigation.
 */
export function wazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

/**
 * Format a route as a WhatsApp-ready text.
 * Uses emoji for readability on mobile.
 */
export function formatRouteMessage(
  route: RouteStop[],
  date: string
): string {
  const header = `*Ruta del ${date}* - ${route.length} ${route.length === 1 ? "entrega" : "entregas"}\n`;

  const stops = route.map((stop) => {
    const lines: string[] = [];
    lines.push(`\n*${stop.orden}. ${stop.cliente}*`);
    lines.push(`Dir: ${stop.direccion}`);
    lines.push(`Hora: ${stop.franja} (llegada ~${stop.hora_estimada})`);

    if (stop.telefono) lines.push(`Tel: ${stop.telefono}`);
    if (stop.notas) lines.push(`Notas: ${stop.notas}`);

    lines.push(`Waze: ${wazeUrl(stop.lat, stop.lng)}`);
    return lines.join("\n");
  });

  return header + stops.join("\n");
}

/**
 * Build a wa.me URL with pre-filled message.
 * Normalizes phone: strips spaces, dashes, parens, plus.
 * Driver clicks the link, WhatsApp opens with message ready to send.
 */
export function whatsappLink(phone: string, message: string): string {
  const normalized = phone.replace(/[\s\-()+]/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
