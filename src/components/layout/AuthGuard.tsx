"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LeafIcon } from "@/components/icons";

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
        .select("must_change_password")
        .eq("id", user.id)
        .single();

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
            <div className="flex items-center gap-2 mb-1">
              <LeafIcon className="w-5 h-5 text-forest-600" />
              <h2 className="text-lg font-semibold text-forest-950">Bienvenido a Brote</h2>
            </div>
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
