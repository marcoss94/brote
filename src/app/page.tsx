import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { LeafIcon } from "@/components/icons";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col botanical-pattern">
      <nav className="flex items-center justify-between px-6 md:px-12 py-4">
        <div className="flex items-center gap-2">
          <LeafIcon className="w-6 h-6 text-forest-700" />
          <span className="text-lg font-semibold text-forest-900 tracking-tight">
            brote
          </span>
        </div>
        <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Iniciar sesión</Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-xl text-center">
          <div className="relative inline-block mb-6">
            <div className="absolute -inset-6 bg-forest-100 rounded-full opacity-50" />
            <LeafIcon className="relative w-12 h-12 text-forest-600" />
          </div>

          <h1 className="text-4xl md:text-5xl font-semibold text-forest-950 tracking-tight leading-[1.1] mb-4">
            Rutas de entrega{" "}
            <span className="text-forest-600">optimizadas</span>
          </h1>

          <p className="text-base text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
            Subí tu Excel de pedidos. Brote calcula la mejor ruta respetando
            horarios, y te devuelve el archivo listo para salir a entregar.
          </p>

          <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
            Empezar
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full mt-16">
          {[
            { title: "Subí tu Excel", desc: "Arrastrá el archivo con los pedidos del día. Validación instantánea." },
            { title: "Ruta óptima", desc: "Algoritmo que respeta franjas horarias y minimiza distancia." },
            { title: "En segundos", desc: "50 pedidos optimizados en menos de 2 segundos. Descargá y salí." },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-forest-900 mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-5 text-xs text-muted-foreground">
        Hecho con 🌱 para tiendas de plantas en Montevideo
      </footer>
    </div>
  );
}
