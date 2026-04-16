import type { GeocodingResult } from "@/types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const RATE_LIMIT_MS = 1100; // slightly over 1 second to respect Nominatim policy

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
  return fetch(url);
}

export async function geocodeAddress(
  address: string,
  city = "Montevideo"
): Promise<GeocodingResult | null> {
  const query = `${address}, ${city}, Uruguay`;
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "uy",
  });

  const response = await rateLimitedFetch(
    `${NOMINATIM_URL}?${params.toString()}`
  );

  if (!response.ok) return null;

  const results = await response.json();

  if (results.length === 0) return null;

  return {
    address,
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    source: "nominatim",
  };
}

export async function geocodeAddresses(
  addresses: { address: string; city?: string }[],
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<Map<string, GeocodingResult | null>> {
  const results = new Map<string, GeocodingResult | null>();

  for (let i = 0; i < addresses.length; i++) {
    const { address, city } = addresses[i];
    onProgress?.(i, addresses.length, address);

    const result = await geocodeAddress(address, city);
    results.set(address, result);
  }

  onProgress?.(addresses.length, addresses.length, "Completado");
  return results;
}
