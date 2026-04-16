"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/types";

export default function CuentaPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Name form
  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      setFullName(data?.full_name || "");
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      // Clear must_change_password flag
      if (profile?.must_change_password) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false, updated_at: new Date().toISOString() })
          .eq("id", profile.id);

        setProfile({ ...profile, must_change_password: false });
      }

      setMessage({ type: "success", text: "Contraseña actualizada correctamente" });
      setNewPassword("");
      setConfirmPassword("");
    }

    setSaving(false);
  }

  async function handleChangeName(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !fullName.trim()) return;
    setSavingName(true);
    setNameMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (error) {
      setNameMessage({ type: "error", text: "Error al guardar" });
    } else {
      setProfile({ ...profile, full_name: fullName.trim() });
      setNameMessage({ type: "success", text: "Nombre actualizado" });
    }

    setSavingName(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-950">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Configuración de tu perfil</p>
      </div>

      {/* Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
          <CardDescription>Tu nombre visible en el sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangeName} className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>
            <Button type="submit" disabled={savingName} className="self-end">
              {savingName ? "Guardando..." : "Guardar"}
            </Button>
          </form>
          {nameMessage && (
            <p className={`text-xs mt-2 ${nameMessage.type === "success" ? "text-forest-600" : "text-destructive"}`}>
              {nameMessage.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
          <CardDescription>Mínimo 6 caracteres</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {message && (
              <p className={`text-xs ${message.type === "success" ? "text-forest-600" : "text-destructive"} bg-${message.type === "success" ? "forest-50" : "destructive/10"} border border-${message.type === "success" ? "forest-200" : "destructive/20"} rounded-md px-3 py-2`}>
                {message.text}
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
