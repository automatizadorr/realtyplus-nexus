import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import lexLogo from "@/assets/lexhouse-logo.webp";
import { EcosystemSwitcher } from "@/components/EcosystemSwitcher";
import { PublicFooter } from "@/components/public/PublicFooter";

const INK = "#0F1B2D";
const BRAND = "#DC1C2E";

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

      <PublicFooter />
    </div>
  );
}
