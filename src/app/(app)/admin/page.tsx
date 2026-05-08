export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import type { Profile, OptimizationJob } from "@/types";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!me?.is_admin) redirect("/dashboard");

  const [{ data: profiles }, { data: jobs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, created_at, is_admin, depot_address, depot_lat, depot_lng, must_change_password, updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("optimization_jobs")
      .select("id, user_id, status, order_count, created_at, completed_at, route_data, original_file_path, result_file_path, config, pickup_data, error_message")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <AdminDashboard
      profiles={(profiles as Profile[]) || []}
      jobs={(jobs as OptimizationJob[]) || []}
    />
  );
}
