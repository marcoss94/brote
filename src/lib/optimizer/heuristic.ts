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

    const points: LatLng[] = [
      depot,
      ...orders.map((o) => ({ lat: o.lat, lng: o.lng })),
    ];
    const distMatrix = provider.getMatrix(points);
    const n = orders.length;

    // Multi-start NN: try starting at each city, keep best closed-tour length after 2-opt
    let bestRoute: number[] | null = null;
    let bestCost = Infinity;

    const startCount = Math.min(n, 12); // cap for performance
    const startPicks = this.pickStartCandidates(distMatrix, n, startCount);

    for (const forcedFirst of startPicks) {
      const nn = this.nearestNeighbor(orders, distMatrix, config, forcedFirst);
      if (!nn) continue;
      const optimized = this.twoOpt(nn, orders, distMatrix, config);
      if (!this.isRouteFeasible(optimized, orders, distMatrix, config)) continue;
      // Cost = km + wait penalty (1h idle ≈ 3km equivalent — tunable via WAIT_KM_EQUIV)
      const km = this.closedTourCost(optimized, distMatrix);
      const waitMin = this.computeTotalWait(optimized, orders, distMatrix, config);
      const WAIT_KM_EQUIV = 0.05;
      const cost = km + waitMin * WAIT_KM_EQUIV;
      if (cost < bestCost) {
        bestCost = cost;
        bestRoute = optimized;
      }
    }

    // Fallback: plain NN from depot if multi-start somehow failed
    if (!bestRoute) {
      const fallback = this.nearestNeighbor(orders, distMatrix, config, null);
      bestRoute = fallback || orders.map((_, i) => i);
    }

    return this.buildRouteStops(bestRoute, orders, distMatrix, config);
  }

  /**
   * Total minutes the driver waits idle for a window to open.
   * Used to rank candidate routes — long waits = bad even if km is low.
   */
  private computeTotalWait(
    route: number[],
    orders: GeocodedOrder[],
    distMatrix: number[][],
    config: OptimizationConfig
  ): number {
    let currentTime = parseTime(config.start_time);
    let currentPoint = 0;
    let totalWait = 0;
    for (const idx of route) {
      const matrixIdx = idx + 1;
      const travelMin = (distMatrix[currentPoint][matrixIdx] / config.average_speed_kmh) * 60;
      const arrival = currentTime + travelMin;
      const winStart = orders[idx].franja_desde ? parseTime(orders[idx].franja_desde) : 0;
      totalWait += Math.max(0, winStart - arrival);
      currentTime = Math.max(arrival, winStart) + config.service_time_minutes;
      currentPoint = matrixIdx;
    }
    return totalWait;
  }

  /**
   * Closed-tour cost = depot → route[0] → ... → route[last] → depot.
   * This is the metric 2-opt should minimize when driver returns to depot.
   */
  private closedTourCost(route: number[], distMatrix: number[][]): number {
    let total = 0;
    let prev = 0; // depot
    for (const r of route) {
      const cur = r + 1;
      total += distMatrix[prev][cur];
      prev = cur;
    }
    total += distMatrix[prev][0]; // return to depot
    return total;
  }

  /**
   * Pick candidate "first" cities for multi-start: the closest few to depot,
   * plus a few far ones to diversify search.
   */
  private pickStartCandidates(
    distMatrix: number[][],
    n: number,
    k: number
  ): (number | null)[] {
    const distFromDepot = Array.from({ length: n }, (_, i) => ({
      idx: i,
      d: distMatrix[0][i + 1],
    }));
    distFromDepot.sort((a, b) => a.d - b.d);
    const closest = distFromDepot.slice(0, Math.ceil(k / 2)).map((x) => x.idx);
    const farthest = distFromDepot.slice(-Math.floor(k / 2)).map((x) => x.idx);
    return [null, ...closest, ...farthest]; // null = unforced (greedy from depot)
  }

  /**
   * Nearest-neighbor route construction with optional forced first city.
   * Returns null if any time window is infeasible from the chosen start.
   */
  private nearestNeighbor(
    orders: GeocodedOrder[],
    distMatrix: number[][],
    config: OptimizationConfig,
    forcedFirst: number | null
  ): number[] | null {
    const n = orders.length;
    const visited = new Set<number>();
    const route: number[] = [];

    let currentPoint = 0;
    let currentTime = parseTime(config.start_time);

    if (forcedFirst !== null) {
      const orderIdx = forcedFirst + 1;
      const order = orders[forcedFirst];
      const windowEnd = order.franja_hasta ? parseTime(order.franja_hasta) : 24 * 60;
      const travelMin = (distMatrix[currentPoint][orderIdx] / config.average_speed_kmh) * 60;
      const arrival = currentTime + travelMin;
      if (arrival > windowEnd) return null;

      const windowStart = order.franja_desde ? parseTime(order.franja_desde) : 0;
      route.push(forcedFirst);
      visited.add(forcedFirst);
      currentTime = Math.max(arrival, windowStart) + config.service_time_minutes;
      currentPoint = orderIdx;
    }

    for (let step = route.length; step < n; step++) {
      let bestIdx = -1;
      let bestScore = Infinity;

      for (let i = 0; i < n; i++) {
        if (visited.has(i)) continue;
        const orderIdx = i + 1;
        const travelMin = (distMatrix[currentPoint][orderIdx] / config.average_speed_kmh) * 60;
        const arrivalTime = currentTime + travelMin;

        const order = orders[i];
        const windowStart = order.franja_desde ? parseTime(order.franja_desde) : 0;
        const windowEnd = order.franja_hasta ? parseTime(order.franja_hasta) : 24 * 60;
        const effectiveArrival = Math.max(arrivalTime, windowStart);
        if (effectiveArrival > windowEnd) continue;

        const waitMinutes = Math.max(0, windowStart - arrivalTime);
        const hasRealWindow = !!order.franja_hasta;
        const urgency = hasRealWindow ? windowEnd - effectiveArrival : 0;
        const distance = distMatrix[currentPoint][orderIdx];
        const score = waitMinutes * 0.5 + distance + Math.max(0, urgency) * 0.005;

        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      // Fallback when no candidate fits any window
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
      if (bestIdx === -1) break;

      visited.add(bestIdx);
      route.push(bestIdx);

      const orderIdx = bestIdx + 1;
      const travelMin = (distMatrix[currentPoint][orderIdx] / config.average_speed_kmh) * 60;
      const arrivalTime = currentTime + travelMin;
      const windowStart = orders[bestIdx].franja_desde ? parseTime(orders[bestIdx].franja_desde) : 0;
      currentTime = Math.max(arrivalTime, windowStart) + config.service_time_minutes;
      currentPoint = orderIdx;
    }

    return route;
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

      // Try all segment reversals between two non-adjacent edges.
      // i = -1 means "edge from depot to route[0]" — allows reversing the head.
      for (let i = -1; i < result.length - 1; i++) {
        const startJ = i === -1 ? 1 : i + 2;
        for (let j = startJ; j < result.length; j++) {
          // distMatrix indices: depot = 0, order k = k + 1
          const a = i === -1 ? 0 : result[i] + 1;          // node before reversal
          const b = result[i + 1] + 1;                     // first of reversal
          const c = result[j] + 1;                         // last of reversal
          const d = j + 1 < result.length ? result[j + 1] + 1 : 0; // node after reversal (or depot)

          const currentDist = distMatrix[a][b] + distMatrix[c][d];
          const newDist = distMatrix[a][c] + distMatrix[b][d];

          // Use small epsilon to avoid float-noise oscillation
          if (newDist < currentDist - 1e-9) {
            const segment = result.slice(i + 1, j + 1).reverse();
            result.splice(i + 1, j - i, ...segment);

            if (this.isRouteFeasible(result, orders, distMatrix, config)) {
              improved = true;
            } else {
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
        telefono: order.telefono,
        notas: order.notas,
        fecha: order.fecha,
        producto: order.producto,
        mensaje: order.mensaje,
        red_social: order.red_social,
        obs: order.obs,
        detalle_direccion: order.detalle_direccion,
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
