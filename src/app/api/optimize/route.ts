import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HeuristicOptimizer } from "@/lib/optimizer/heuristic";
import { generateResultExcel } from "@/lib/excel";
import type { OptimizeRequest, OptimizationConfig } from "@/types";

// Rate limit config
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX_REQUESTS = 5;
const MAX_ORDERS_PER_REQUEST = 500;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Rate limit: count jobs created by this user in last N seconds
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SEC * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("optimization_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    return NextResponse.json(
      {
        error: `Demasiadas optimizaciones. Máximo ${RATE_LIMIT_MAX_REQUESTS} por minuto.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(RATE_LIMIT_WINDOW_SEC),
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const body: OptimizeRequest = await request.json();
  const { orders, depot, original_file_path, pickup_orders = [] } = body;

  if (!orders?.length || !depot) {
    return NextResponse.json(
      { error: "Faltan pedidos o depósito" },
      { status: 400 }
    );
  }

  if (orders.length > MAX_ORDERS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Máximo ${MAX_ORDERS_PER_REQUEST} pedidos por optimización` },
      { status: 400 }
    );
  }

  // Create job record
  const { data: job, error: jobError } = await supabase
    .from("optimization_jobs")
    .insert({
      user_id: user.id,
      status: "processing",
      order_count: orders.length,
      original_file_path,
      config: {
        depot,
        service_time_minutes: 10,
        start_time: "08:00",
        average_speed_kmh: 30,
      },
    })
    .select()
    .single();

  if (jobError) {
    return NextResponse.json(
      { error: "Error al crear job" },
      { status: 500 }
    );
  }

  try {
    const config: OptimizationConfig = {
      depot,
      service_time_minutes: 10,
      start_time: "08:00",
      average_speed_kmh: 30,
    };

    const optimizer = new HeuristicOptimizer();
    const route = optimizer.optimize(orders, config);

    // Download original file to generate result Excel
    let resultFilePath: string | null = null;

    if (original_file_path) {
      const { data: fileData } = await supabase.storage
        .from("uploads")
        .download(original_file_path);

      if (fileData) {
        const buffer = await fileData.arrayBuffer();
        const resultBuffer = generateResultExcel(buffer, route, pickup_orders);

        const resultPath = `${user.id}/${job.id}_resultado.xlsx`;
        await supabase.storage
          .from("results")
          .upload(resultPath, resultBuffer, {
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });

        resultFilePath = resultPath;
      }
    }

    // Update job as completed (store route data + pickups for later retrieval)
    await supabase
      .from("optimization_jobs")
      .update({
        status: "completed",
        result_file_path: resultFilePath,
        route_data: route,
        pickup_data: pickup_orders,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json({
      job_id: job.id,
      status: "completed",
      result_file_path: resultFilePath,
      route,
      pickup_orders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";

    await supabase
      .from("optimization_jobs")
      .update({
        status: "error",
        error_message: message,
      })
      .eq("id", job.id);

    return NextResponse.json(
      {
        job_id: job.id,
        status: "error",
        error_message: message,
        route: [],
      },
      { status: 500 }
    );
  }
}
