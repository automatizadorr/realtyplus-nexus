import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { useSeo } from "@/lib/useSeo";
import { POSTS } from "@/content/blogPosts";

const INK = "#0F1B2D";
const BRAND = "#DC1C2E";

export default function Blog() {
  useSeo({
    title: "Blog | LexHouse AI — IA para corredores inmobiliarios",
    description:
      "Guías y recursos sobre IA inmobiliaria: captación de leads por WhatsApp, CRM, contratos con IA y marketing. Parte del ecosistema LexHouse AI.",
    path: "/blog",
  });

  return (
    <PublicShell>
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        <span className="font-mono text-xs tracking-widest uppercase" style={{ color: BRAND }}>Blog · Ecosistema LexHouse AI</span>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl font-black tracking-tight" style={{ color: INK }}>
          IA para vender más propiedades.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-500">
          Guías prácticas de captación, CRM, contratos y marketing con inteligencia artificial —
          del equipo detrás de{" "}
          <a href="https://lexhouse-ai.com" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2" style={{ color: "#003DA5" }}>
            lexhouse-ai.com
          </a>.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {POSTS.map((p) => (
            <Link
              key={p.slug}
              to={`/blog/${p.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgba(15,27,45,0.3)]"
            >
              <span className="inline-block w-fit rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: BRAND }}>
                {p.category}
              </span>
              <h2 className="mt-4 font-display text-xl font-bold leading-snug tracking-tight transition-colors group-hover:text-[#003DA5]" style={{ color: INK }}>
                {p.title}
              </h2>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-slate-500">{p.description}</p>
              <div className="mt-5 flex items-center justify-between text-[12px] text-slate-400">
                <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {p.readingTime}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-500 group-hover:text-[#003DA5]">
                  Leer <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
