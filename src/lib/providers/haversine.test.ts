import { describe, it, expect } from "vitest";
import { HaversineProvider } from "./haversine";

describe("HaversineProvider", () => {
  const provider = new HaversineProvider(30);

  it("returns 0 km between same point", () => {
    const p = { lat: -34.9, lng: -56.15 };
    const result = provider.getDistance(p, p);
    expect(result.distance_km).toBeCloseTo(0, 3);
  });

  it("computes distance in Montevideo (~2.5km reference)", () => {
    // Plaza Independencia → Pocitos ~3.5km straight line
    const from = { lat: -34.9055, lng: -56.199 };
    const to = { lat: -34.914, lng: -56.161 };
    const result = provider.getDistance(from, to);
    expect(result.distance_km).toBeGreaterThan(3);
    expect(result.distance_km).toBeLessThan(5);
  });

  it("computes duration from distance using average speed", () => {
    const from = { lat: 0, lng: 0 };
    const to = { lat: 0, lng: 0.5 }; // ~55 km
    const result = provider.getDistance(from, to);
    // at 30 km/h, 55 km takes 110 minutes
    expect(result.duration_minutes).toBeCloseTo(
      (result.distance_km / 30) * 60,
      1
    );
  });

  it("builds symmetric distance matrix", () => {
    const points = [
      { lat: -34.9, lng: -56.15 },
      { lat: -34.91, lng: -56.16 },
      { lat: -34.92, lng: -56.17 },
    ];
    const matrix = provider.getMatrix(points);
    expect(matrix.length).toBe(3);
    expect(matrix[0][0]).toBe(0);
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 5);
    expect(matrix[1][2]).toBeCloseTo(matrix[2][1], 5);
  });
});
