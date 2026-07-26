import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import lexLogo from "@/assets/lexhouse-logo.webp";
import { EcosystemSwitcher } from "@/components/EcosystemSwitcher";

const INK = "#0F1B2D";
const BRAND = "#DC1C2E";
const GOLD = "#D4AF37";

/* Marco público (nav + footer) para páginas fuera de la landing (blog). */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-sans" style={{ color: INK }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center" aria-label="LexHouse AI — inicio">
            <img src={lexLogo} alt="LexHouse AI" className="h-10 w-auto" width="40" height="40" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/blog" className="hidden sm:inline text-sm text-slate-600 hover:text-[#DC1C2E] transition-colors">Blog</Link>
            <EcosystemSwitcher current="crm" />
            <Link to="/auth" className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-transform hover:scale-105" style={{ background: BRAND }}>
              Comenzar gratis
            </Link>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      {/* Footer */}
      <footer className="mt-20 py-12 px-6" style={{ background: INK }} aria-label="Pie de página">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 ring-1 ring-white/10">
            <img src={lexLogo} alt="LexHouse AI" className="h-11 w-auto" width="44" height="44" />
          </span>
          <p className="text-white/40 text-xs text-center sm:text-right font-mono">
            © {new Date().getFullYear()} LexHouse AI · Servicios Inmobiliarios Plus Sur SL ·{" "}
            <a href="https://lexhouse-ai.com" target="_blank" rel="noopener" className="hover:text-white underline underline-offset-2" style={{ color: GOLD }}>
              lexhouse-ai.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
