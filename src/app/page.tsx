import Link from "next/link";

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function RouteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col botanical-pattern">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <LeafIcon className="w-7 h-7 text-forest-700" />
          <span className="font-display text-xl font-semibold text-forest-900 tracking-tight">
            brote
          </span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-forest-700 hover:text-forest-900 transition-colors"
        >
          Iniciar sesión
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-2xl text-center animate-fade-in-up">
          {/* Decorative blob */}
          <div className="relative inline-block mb-8">
            <div className="absolute -inset-8 bg-forest-100 organic-blob opacity-60" />
            <LeafIcon className="relative w-14 h-14 text-forest-600" />
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-forest-950 tracking-tight leading-[1.1] mb-5">
            Rutas de entrega
            <br />
            <span className="text-forest-600 italic">optimizadas</span>
          </h1>

          <p className="text-lg md:text-xl text-forest-800/70 max-w-lg mx-auto mb-10 leading-relaxed">
            Subí tu Excel de pedidos. Brote calcula la mejor ruta respetando
            horarios, y te devuelve el archivo listo para salir a entregar.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 bg-forest-700 hover:bg-forest-800 text-cream-50 font-medium px-7 py-3.5 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-forest-900/15 hover:-translate-y-0.5 text-[15px]"
          >
            Empezar
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mt-20">
          {[
            {
              icon: <FileIcon className="w-5 h-5" />,
              title: "Subí tu Excel",
              desc: "Arrastrá el archivo con los pedidos del día. Validación instantánea.",
              delay: "delay-2",
            },
            {
              icon: <RouteIcon className="w-5 h-5" />,
              title: "Ruta óptima",
              desc: "Algoritmo que respeta franjas horarias y minimiza distancia.",
              delay: "delay-3",
            },
            {
              icon: <ClockIcon className="w-5 h-5" />,
              title: "En segundos",
              desc: "50 pedidos optimizados en menos de 2 segundos. Descargá y salí.",
              delay: "delay-4",
            },
          ].map((f) => (
            <div
              key={f.title}
              className={`animate-fade-in-up ${f.delay} bg-card/60 backdrop-blur-sm border border-border/60 rounded-2xl p-6 hover:border-forest-300 transition-colors duration-300`}
            >
              <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-600 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-display text-base font-semibold text-forest-900 mb-1.5">
                {f.title}
              </h3>
              <p className="text-sm text-forest-800/60 leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-sage-400">
        Hecho con 🌱 para tiendas de plantas en Montevideo
      </footer>
    </div>
  );
}
