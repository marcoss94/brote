import type {
  RouteOptimizer,
  GeocodedOrder,
  OptimizationConfig,
  RouteStop,
  LatLng,
} from "@/types";
import { HaversineProvider } from "@/lib/providers/haversine";

/**
 * Heuristic VRPTW optimizer using nearest-neighbor with time window constraints.
 *
 * Strategy:
 * 1. Build distance matrix (depot + all orders)
 * 2. Nearest-neighbor insertion prioritizing time window feasibility
 * 3. 2-opt improvement pass respecting time windows
 */
export class HeuristicOptimizer implements RouteOptimizer {
  optimize(
    orders: GeocodedOrder[],
    config: OptimizationConfig
  ): RouteStop[] {
    if (orders.length === 0) return [];

    const provider = new HaversineProvider(config.average_speed_kmh);
    const depot = config.depot;

    // All points: index 0 = depot, 1..n = orders
    const points: LatLng[] = [
      depot,
      ...orders.map((o) => ({ lat: o.lat, lng: o.lng })),
    ];
    const distMatrix = provider.getMatrix(points);

    const n = orders.length;
    const visited = new Set<number>();
    const route: number[] = []; // order indices (0-based into orders array)

    // Nearest-neighbor construction with time window priority
    let currentPoint = 0; // depot index in distMatrix
    let currentTime = parseTime(config.start_time);

    for (let step = 0; step < n; step++) {
      let bestIdx = -1;
      let bestScore = Infinity;

      for (let i = 0; i < n; i++) {
        if (visited.has(i)) continue;

        const orderIdx = i + 1; // distMatrix index
        const travelMinutes =
          (distMatrix[currentPoint][orderIdx] / config.average_speed_kmh) * 60;
        const arrivalTime = currentTime + travelMinutes;

        const order = orders[i];
        const windowStart = order.franja_desde
          ? parseTime(order.franja_desde)
          : 0;
        const windowEnd = order.franja_hasta
          ? parseTime(order.franja_hasta)
          : 24 * 60;

        // Effective arrival: wait if we're early
        const effectiveArrival = Math.max(arrivalTime, windowStart);

        // Skip if we'd arrive after the window closes (hard constraint)
        if (effectiveArrival > windowEnd) continue;

        // Score components:
        // 1. Wait time penalty — heavily penalize choosing orders that require long waits
        const waitMinutes = Math.max(0, windowStart - arrivalTime);
        // 2. Urgency — less slack before window closes = more urgent (should go first)
        const urgency = windowEnd - effectiveArrival;
        // 3. Distance
        const distance = distMatrix[currentPoint][orderIdx];

        // Wait time dominates: 1 minute of waiting = 0.5 km penalty equivalent
        // Urgency is secondary: tighter windows get slight priority
        // Distance is tertiary
        const score = waitMinutes * 0.5 + distance + Math.max(0, urgency) * 0.005;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      // If no feasible order found (all windows passed), pick nearest unvisited
      if (bestIdx === -1) {
        let minDist = Infinity;
        for (let i = 0; i < n; i++) {
          if (visited.has(i)) continue;
          const d = distMatrix[currentPoint][i + 1];
          if (d < minDist) {
            minDist = d;
            bestIdx = i;
          }
        }
      }

      if (bestIdx === -1) break; // shouldn't happen

      visited.add(bestIdx);
      route.push(bestIdx);

      const orderIdx = bestIdx + 1;
      const travelMinutes =
        (distMatrix[currentPoint][orderIdx] / config.average_speed_kmh) * 60;
      const arrivalTime = currentTime + travelMinutes;
      const windowStart = orders[bestIdx].franja_desde
        ? parseTime(orders[bestIdx].franja_desde)
        : 0;
      currentTime =
        Math.max(arrivalTime, windowStart) + config.service_time_minutes;
      currentPoint = orderIdx;
    }

    // 2-opt improvement pass
    const improved = this.twoOpt(route, orders, distMatrix, config);

    // Build result
    return this.buildRouteStops(improved, orders, distMatrix, config);
  }

  private twoOpt(
    route: number[],
    orders: GeocodedOrder[],
    distMatrix: number[][],
    config: OptimizationConfig
  ): number[] {
    const result = [...route];
    let improved = true;
    let iterations = 0;
    const maxIterations = 1000;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 0; i < result.length - 1; i++) {
        for (let j = i + 2; j < result.length; j++) {
          // Check if reversing segment [i+1..j] improves distance
          const prevI = i === 0 ? 0 : result[i - 1] + 1;
          const currI = result[i] + 1;
          const currJ = result[j] + 1;
          const nextJ = j + 1 < result.length ? result[j + 1] + 1 : 0;

          const currentDist =
            distMatrix[currI][result[i + 1] + 1] +
            distMatrix[result[j - 1] + 1 || currI][currJ];
          const newDist =
            distMatrix[currI][result[j] + 1] +
            distMatrix[result[i + 1] + 1][nextJ];

          if (newDist < currentDist) {
            // Reverse segment
            const segment = result.slice(i + 1, j + 1).reverse();
            result.splice(i + 1, j - i, ...segment);

            // Verify time windows are still feasible
            if (this.isRouteFeasible(result, orders, distMatrix, config)) {
              improved = true;
            } else {
              // Revert
              const revert = result.slice(i + 1, j + 1).reverse();
              result.splice(i + 1, j - i, ...revert);
            }
          }
        }
      }
    }

    return result;
  }

  private isRouteFeasible(
    route: number[],
    orders: GeocodedOrder[],
    distMatrix: number[][],
    config: OptimizationConfig
  ): boolean {
    let currentTime = parseTime(config.start_time);
    let currentPoint = 0;

    for (const orderIdx of route) {
      const matrixIdx = orderIdx + 1;
      const travelMinutes =
        (distMatrix[currentPoint][matrixIdx] / config.average_speed_kmh) * 60;
      const arrivalTime = currentTime + travelMinutes;

      const order = orders[orderIdx];
      const windowEnd = order.franja_hasta
        ? parseTime(order.franja_hasta)
        : 24 * 60;

      if (arrivalTime > windowEnd) return false;

      const windowStart = order.franja_desde
        ? parseTime(order.franja_desde)
        : 0;
      currentTime =
        Math.max(arrivalTime, windowStart) + config.service_time_minutes;
      currentPoint = matrixIdx;
    }

    return true;
  }

  private buildRouteStops(
    route: number[],
    orders: GeocodedOrder[],
    distMatrix: number[][],
    config: OptimizationConfig
  ): RouteStop[] {
    const stops: RouteStop[] = [];
    let currentTime = parseTime(config.start_time);
    let currentPoint = 0;
    let accumulatedKm = 0;

    for (let i = 0; i < route.length; i++) {
      const orderIdx = route[i];
      const matrixIdx = orderIdx + 1;
      const order = orders[orderIdx];

      const segmentKm = distMatrix[currentPoint][matrixIdx];
      const travelMinutes =
        (segmentKm / config.average_speed_kmh) * 60;
      const arrivalTime = currentTime + travelMinutes;
      const windowStart = order.franja_desde
        ? parseTime(order.franja_desde)
        : 0;
      const effectiveArrival = Math.max(arrivalTime, windowStart);

      accumulatedKm += segmentKm;

      stops.push({
        orden: i + 1,
        numero_pedido: order.numero_pedido,
        cliente: order.cliente,
        direccion: order.direccion,
        lat: order.lat,
        lng: order.lng,
        franja: `${order.franja_desde || "—"}-${order.franja_hasta || "—"}`,
        hora_estimada: formatTime(effectiveArrival),
        distancia_acumulada_km: Math.round(accumulatedKm * 10) / 10,
      });

      currentTime = effectiveArrival + config.service_time_minutes;
      currentPoint = matrixIdx;
    }

    return stops;
  }
}

function parseTime(time: string): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
