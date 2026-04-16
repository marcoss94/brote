import type { DistanceProvider, LatLng, DistanceResult } from "@/types";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistance(from: LatLng, to: LatLng): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export class HaversineProvider implements DistanceProvider {
  private averageSpeedKmh: number;

  constructor(averageSpeedKmh = 30) {
    this.averageSpeedKmh = averageSpeedKmh;
  }

  getDistance(from: LatLng, to: LatLng): DistanceResult {
    const distance_km = haversineDistance(from, to);
    const duration_minutes = (distance_km / this.averageSpeedKmh) * 60;
    return { distance_km, duration_minutes };
  }

  getMatrix(points: LatLng[]): number[][] {
    const n = points.length;
    const matrix: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(0)
    );
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = haversineDistance(points[i], points[j]);
        matrix[i][j] = d;
        matrix[j][i] = d;
      }
    }
    return matrix;
  }
}
