// === Domain Types ===

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Order {
  numero_pedido: string; // auto-generated if missing
  cliente: string;
  direccion: string;
  ciudad?: string;
  franja_desde: string; // HH:MM — optional (empty string if missing)
  franja_hasta: string; // HH:MM — optional
  telefono?: string;
  notas?: string;
  // New fields from plant shop format
  fecha?: string; // DD/MM or free text
  producto?: string;
  mensaje?: string;
  red_social?: string;
  obs?: string;
  pickup?: boolean; // true if customer picks up in store
  lat?: number;
  lng?: number;
  // Preserve any extra columns from the original Excel
  [key: string]: unknown;
}

export interface GeocodedOrder extends Order {
  lat: number;
  lng: number;
}

export interface RouteStop {
  orden: number;
  numero_pedido: string;
  cliente: string;
  direccion: string;
  lat: number;
  lng: number;
  franja: string;
  hora_estimada: string; // HH:MM
  distancia_acumulada_km: number;
  telefono?: string;
  notas?: string;
  fecha?: string;
  producto?: string;
  mensaje?: string;
  red_social?: string;
  obs?: string;
}

export interface PickupOrder {
  numero_pedido: string;
  cliente: string;
  telefono?: string;
  fecha?: string;
  producto?: string;
  mensaje?: string;
  red_social?: string;
  obs?: string;
  direccion_original: string; // what the Excel said (e.g. "RETIRA PUNTA CARRETAS")
}

export interface OptimizationConfig {
  depot: LatLng;
  service_time_minutes: number; // default 10
  start_time: string; // HH:MM, default "08:00"
  average_speed_kmh: number; // default 30
}

export interface OptimizationResult {
  job_id: string;
  status: "processing" | "completed" | "error";
  result_file_path?: string;
  route: RouteStop[];
  pickup_orders?: PickupOrder[];
  error_message?: string;
}

// === Provider Interfaces (Agnostic) ===

export interface DistanceResult {
  distance_km: number;
  duration_minutes: number;
}

export interface DistanceProvider {
  getDistance(from: LatLng, to: LatLng): DistanceResult;
  getMatrix(points: LatLng[]): number[][]; // distance in km
}

export interface RouteOptimizer {
  optimize(
    orders: GeocodedOrder[],
    config: OptimizationConfig
  ): RouteStop[];
}

// === API Types ===

export interface OptimizeRequest {
  orders: GeocodedOrder[];
  pickup_orders?: PickupOrder[];
  depot: LatLng;
  original_file_path: string;
}

export interface OptimizeResponse extends OptimizationResult {}

// === Excel Validation ===

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ParsedExcel {
  orders: Order[];
  errors: ValidationError[];
  extraColumns: string[];
  pickupOrders: PickupOrder[];
}

// === Geocoding ===

export interface GeocodingResult {
  address: string;
  lat: number;
  lng: number;
  source: "nominatim" | "manual" | "cache";
}

export interface GeocodingProgress {
  total: number;
  completed: number;
  current: string;
  failed: string[];
}

// === Database Types ===

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  depot_address: string | null;
  depot_lat: number | null;
  depot_lng: number | null;
  must_change_password: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface OptimizationJob {
  id: string;
  user_id: string;
  status: "processing" | "completed" | "error";
  order_count: number;
  original_file_path: string | null;
  result_file_path: string | null;
  config: OptimizationConfig;
  route_data: RouteStop[] | null;
  pickup_data?: PickupOrder[] | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}
