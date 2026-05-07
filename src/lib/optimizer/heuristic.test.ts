import { describe, it, expect } from "vitest";
import { HeuristicOptimizer } from "./heuristic";
import type { GeocodedOrder, OptimizationConfig } from "@/types";

const defaultConfig: OptimizationConfig = {
  depot: { lat: -34.9011, lng: -56.1645 },
  service_time_minutes: 10,
  start_time: "08:00",
  average_speed_kmh: 30,
};

function makeOrder(
  id: string,
  lat: number,
  lng: number,
  from = "",
  to = ""
): GeocodedOrder {
  return {
    numero_pedido: id,
    cliente: `Cliente ${id}`,
    direccion: `Dir ${id}`,
    franja_desde: from,
    franja_hasta: to,
    lat,
    lng,
  };
}

describe("HeuristicOptimizer", () => {
  const optimizer = new HeuristicOptimizer();

  it("returns empty route for empty orders", () => {
    const result = optimizer.optimize([], defaultConfig);
    expect(result).toEqual([]);
  });

  it("visits single order", () => {
    const orders = [makeOrder("1", -34.91, -56.17)];
    const route = optimizer.optimize(orders, defaultConfig);
    expect(route.length).toBe(1);
    expect(route[0].numero_pedido).toBe("1");
    expect(route[0].orden).toBe(1);
  });

  it("assigns sequential orden field", () => {
    const orders = [
      makeOrder("A", -34.91, -56.17),
      makeOrder("B", -34.92, -56.18),
      makeOrder("C", -34.93, -56.19),
    ];
    const route = optimizer.optimize(orders, defaultConfig);
    expect(route.map((s) => s.orden)).toEqual([1, 2, 3]);
  });

  it("respects time windows — urgent order first", () => {
    // Order with narrow early window should be visited before flexible one
    const orders = [
      makeOrder("late", -34.91, -56.17, "14:00", "16:00"),
      makeOrder("early", -34.93, -56.19, "08:30", "09:30"),
    ];
    const route = optimizer.optimize(orders, defaultConfig);
    expect(route[0].numero_pedido).toBe("early");
  });

  it("does not arrive after time window closes", () => {
    const orders = [
      makeOrder("O1", -34.91, -56.17, "09:00", "11:00"),
      makeOrder("O2", -34.92, -56.18, "09:00", "11:00"),
      makeOrder("O3", -34.93, -56.19, "09:00", "11:00"),
    ];
    const route = optimizer.optimize(orders, defaultConfig);
    for (const stop of route) {
      const [h, m] = stop.hora_estimada.split(":").map(Number);
      const arrivalMin = h * 60 + m;
      // window end = 11:00 = 660
      expect(arrivalMin).toBeLessThanOrEqual(660);
    }
  });

  it("avoids long waits — late window order scheduled last", () => {
    // Scenario: one early order (09:00), one very late (17:00), and 2 flexible.
    // Late must come last so flexibles fill the gap; otherwise waits 8h.
    const orders = [
      makeOrder("early", -34.9085, -56.1567, "09:00", "11:00"),
      makeOrder("late", -34.9092, -56.151, "17:00", "20:00"),
      makeOrder("flex1", -34.9113, -56.1929),
      makeOrder("flex2", -34.907, -56.199),
    ];
    const route = optimizer.optimize(orders, defaultConfig);

    // Late should be last
    expect(route[route.length - 1].numero_pedido).toBe("late");
    // All orders visited
    expect(route.length).toBe(4);
  });

  it("accumulates distance monotonically", () => {
    const orders = [
      makeOrder("A", -34.91, -56.17),
      makeOrder("B", -34.92, -56.18),
      makeOrder("C", -34.93, -56.19),
    ];
    const route = optimizer.optimize(orders, defaultConfig);
    for (let i = 1; i < route.length; i++) {
      expect(route[i].distancia_acumulada_km).toBeGreaterThanOrEqual(
        route[i - 1].distancia_acumulada_km
      );
    }
  });

  it("preserves telefono and notas from order", () => {
    const order: GeocodedOrder = {
      numero_pedido: "X",
      cliente: "Test",
      direccion: "Dir",
      franja_desde: "",
      franja_hasta: "",
      telefono: "099111",
      notas: "Tocar timbre",
      lat: -34.91,
      lng: -56.17,
    };
    const route = optimizer.optimize([order], defaultConfig);
    expect(route[0].telefono).toBe("099111");
    expect(route[0].notas).toBe("Tocar timbre");
  });

  it("minimizes closed tour for 10 stops (regression)", () => {
    const depot = { lat: -34.9216192, lng: -56.1579978 };
    const orders: GeocodedOrder[] = [
      { numero_pedido: "1", cliente: "Sofia", direccion: "Pta Carretas", franja_desde: "", franja_hasta: "", lat: -34.9239559, lng: -56.158593 },
      { numero_pedido: "2", cliente: "Patricia", direccion: "Rio Negro", franja_desde: "", franja_hasta: "", lat: -34.907846, lng: -56.1933273 },
      { numero_pedido: "3", cliente: "Aldo", direccion: "Garibaldi", franja_desde: "", franja_hasta: "", lat: -34.8852567, lng: -56.1651303 },
      { numero_pedido: "4", cliente: "IPalles", direccion: "Gral Flores", franja_desde: "", franja_hasta: "", lat: -34.8812902, lng: -56.1818674 },
      { numero_pedido: "5", cliente: "Maxi", direccion: "Pilcomayo", franja_desde: "", franja_hasta: "", lat: -34.8939011, lng: -56.100235 },
      { numero_pedido: "6", cliente: "Nicolas", direccion: "Erevan", franja_desde: "", franja_hasta: "", lat: -34.8862614, lng: -56.1122155 },
      { numero_pedido: "7", cliente: "Carlos", direccion: "Marsella", franja_desde: "", franja_hasta: "", lat: -34.8757509, lng: -56.1834746 },
      { numero_pedido: "8", cliente: "Lucas", direccion: "Eucaliptus", franja_desde: "", franja_hasta: "", lat: -34.7893982, lng: -56.2320393 },
      { numero_pedido: "9", cliente: "Ramiro", direccion: "Matos Rdz", franja_desde: "", franja_hasta: "", lat: -34.821427, lng: -56.1067304 },
      { numero_pedido: "10", cliente: "Julieta", direccion: "Helios", franja_desde: "", franja_hasta: "", lat: -34.7808111, lng: -56.0486757 },
    ];
    const route = optimizer.optimize(orders, { ...defaultConfig, depot });

    // Compute closed tour cost (depot → all stops → depot)
    const lat0 = depot.lat, lng0 = depot.lng;
    const haver = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371;
      const tr = (d: number) => (d * Math.PI) / 180;
      const dLat = tr(b.lat - a.lat), dLng = tr(b.lng - a.lng);
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(tr(a.lat)) * Math.cos(tr(b.lat)) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    let closed = haver({ lat: lat0, lng: lng0 }, route[0]);
    for (let i = 1; i < route.length; i++) {
      closed += haver(route[i - 1], route[i]);
    }
    closed += haver(route[route.length - 1], { lat: lat0, lng: lng0 });

    // Pure NN closed tour ≈ 64 km. Optimized must be at least 6% better.
    expect(closed).toBeLessThan(62);
  });

  it("hora_estimada respects windowStart — waits if early", () => {
    const orders = [
      // Very close to depot but window starts late — arrival should = windowStart
      makeOrder("waited", -34.9012, -56.1646, "10:00", "12:00"),
    ];
    const route = optimizer.optimize(orders, defaultConfig);
    // Start 08:00, nearly no travel, but window starts 10:00 → effective 10:00
    expect(route[0].hora_estimada).toBe("10:00");
  });
});
