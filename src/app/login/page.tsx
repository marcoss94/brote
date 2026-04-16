"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
      }
    }

    setLoading(false);
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="min-h-screen flex botanical-pattern">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-forest-900 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-20 w-96 h-96 bg-forest-400 organic-blob" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-terra-400 organic-blob" />
          <div className="absolute top-1/2 left-1/3 w-56 h-56 bg-sage-400 organic-blob" />
        </div>

        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <svg
              className="w-7 h-7 text-forest-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
            <span className="font-display text-xl font-semibold text-cream-100 tracking-tight">
              brote
            </span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-cream-100 leading-tight mb-4">
            Cada planta llega
            <br />
            <span className="text-forest-300 italic">a tiempo</span>
          </h2>
          <p className="text-forest-300/70 text-base max-w-sm leading-relaxed">
            Optimizá tus rutas de entrega y ahorrá tiempo, combustible y
            dolores de cabeza.
          </p>
        </div>

        <div className="relative text-forest-400/40 text-xs">
          © 2026 Brote
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Mobile logo */}
          <Link
            href="/"
            className="flex items-center gap-2 mb-10 lg:hidden"
          >
            <svg
              className="w-6 h-6 text-forest-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" />
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
            </svg>
            <span className="font-display text-lg font-semibold text-forest-900">
              brote
            </span>
          </Link>

          <h1 className="font-display text-2xl font-semibold text-forest-950 mb-1.5">
            {isSignUp ? "Crear cuenta" : "Bienvenido"}
          </h1>
          <p className="text-sm text-forest-800/50 mb-8">
            {isSignUp
              ? "Registrate para empezar a optimizar"
              : "Iniciá sesión para continuar"}
          </p>

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium text-forest-900 hover:border-forest-300 hover:bg-cream-100 transition-all duration-200 mb-6"
          >
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-xs text-sage-400">
                o con email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="animate-slide-down">
                <label className="block text-xs font-medium text-forest-800/70 mb-1.5">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-forest-950 placeholder:text-sage-300 focus:outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-400/20 transition-all"
                  placeholder="María García"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-forest-800/70 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-forest-950 placeholder:text-sage-300 focus:outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-400/20 transition-all"
                placeholder="maria@ejemplo.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-forest-800/70 mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-forest-950 placeholder:text-sage-300 focus:outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-400/20 transition-all"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="animate-scale-in bg-terra-500/10 border border-terra-400/30 text-terra-600 text-xs rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forest-700 hover:bg-forest-800 disabled:opacity-60 disabled:cursor-not-allowed text-cream-50 font-medium px-4 py-3 rounded-xl transition-all duration-200 text-sm hover:shadow-lg hover:shadow-forest-900/10"
            >
              {loading
                ? "Cargando..."
                : isSignUp
                ? "Crear cuenta"
                : "Iniciar sesión"}
            </button>
          </form>

          <p className="text-center text-xs text-sage-400 mt-6">
            {isSignUp ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              className="text-forest-600 hover:text-forest-800 font-medium transition-colors"
            >
              {isSignUp ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
