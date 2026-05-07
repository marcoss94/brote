"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password, full_name, avatar_url")
        .eq("id", user.id)
        .single();

      // Sync name + avatar from OAuth metadata if empty/changed
      const meta = user.user_metadata || {};
      const metaName = meta.full_name || meta.name || null;
      const metaAvatar = meta.avatar_url || meta.picture || null;

      const updates: Record<string, string | boolean> = {};
      if (metaName && metaName !== profile?.full_name) updates.full_name = metaName;
      if (metaAvatar && metaAvatar !== profile?.avatar_url) updates.avatar_url = metaAvatar;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("profiles")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }

      if (profile?.must_change_password) {
        setUserId(user.id);
        setMustChange(true);
      }

      setReady(true);
    }
    check();
  }, [supabase, router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Mínimo 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);

    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) {
      setError(authError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", userId);

    setMustChange(false);
    setSaving(false);
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <>
      {children}

      {/* Blocking modal — first login password change */}
      {mustChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-center mb-3">
              <Image src="/brote-logo.jpg" alt="Brote" width={100} height={42} className="h-8 w-auto" />
            </div>
            <h2 className="text-lg font-semibold text-foreground text-center mb-1">Bienvenido</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Es tu primer inicio de sesión. Por seguridad, elegí una contraseña nueva antes de continuar.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="modal-new-pw">Nueva contraseña</Label>
                <Input
                  id="modal-new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modal-confirm-pw">Confirmar contraseña</Label>
                <Input
                  id="modal-confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Guardando..." : "Cambiar contraseña"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
