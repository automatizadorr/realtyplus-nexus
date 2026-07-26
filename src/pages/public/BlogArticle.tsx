import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Calendar } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { useSeo } from "@/lib/useSeo";
import { getPost } from "@/content/blogPosts";

const INK = "#0F1B2D";
const BRAND = "#DC1C2E";
const BLUE = "#003DA5";
const GOLD = "#D4AF37";

export default function BlogArticle() {
  const { slug = "" } = useParams();
  const post = getPost(slug);

  // useSeo se llama SIEMPRE (Rules of Hooks): valores de respaldo si no hay post.
  useSeo({
    title: post ? `${post.title} | LexHouse AI` : "Artículo no encontrado | LexHouse AI",
    description: post?.description ?? "El contenido que buscas no existe o cambió de dirección.",
    path: `/blog/${slug}`,
    type: "article",
  });

  if (!post) {
    return (
      <PublicShell>
        <section className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h1 className="font-display text-3xl font-black" style={{ color: INK }}>Artículo no encontrado</h1>
          <p className="mt-3 text-slate-500">El contenido que buscas no existe o cambió de dirección.</p>
          <Link to="/blog" className="mt-6 inline-flex items-center gap-2 font-semibold" style={{ color: BLUE }}>
            <ArrowLeft className="h-4 w-4" /> Volver al blog
          </Link>
        </section>
      </PublicShell>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "LexHouse AI", url: "https://lexhouse-ai.com" },
    publisher: {
      "@type": "Organization",
      name: "LexHouse AI",
      logo: { "@type": "ImageObject", url: "https://lexhouse-ai.homes/icon-192.png" },
    },
    mainEntityOfPage: `https://lexhouse-ai.homes/blog/${post.slug}`,
    keywords: post.keywords,
  };

  return (
    <PublicShell>
      <article className="max-w-3xl mx-auto px-6 pt-14 pb-4">
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#003DA5] transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al blog
        </Link>

        <span className="inline-block rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: BRAND }}>
          {post.category}
        </span>

        <h1 className="mt-5 font-display text-3xl sm:text-4xl font-black leading-tight tracking-tight" style={{ color: INK }}>
          {post.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-y border-slate-100 py-3 text-[13px] text-slate-400">
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {post.dateLabel}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {post.readingTime} de lectura</span>
        </div>

        <div className="mt-8">
          <post.Body />
        </div>
      </article>

      {/* CTA al sitio principal del ecosistema */}
      <section className="max-w-3xl mx-auto px-6 pb-4">
        <div className="relative overflow-hidden rounded-3xl px-8 py-12 text-center" style={{ background: INK }}>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: `radial-gradient(circle, ${BLUE}, transparent 70%)` }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: `radial-gradient(circle, ${BRAND}, transparent 70%)` }} />
          <h2 className="relative font-display text-2xl sm:text-3xl font-black text-white">
            Conoce la <span className="italic" style={{ color: GOLD }}>plataforma completa</span>
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/60">
            Marketplace, contratos con IA, valuación y agentes 24/7 para corredores en LexHouse AI.
          </p>
          <a
            href="https://lexhouse-ai.com"
            target="_blank"
            rel="noopener"
            className="relative mt-6 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-bold text-[#0F1B2D] shadow-lg transition-transform hover:-translate-y-0.5"
            style={{ background: GOLD }}
          >
            Ir a lexhouse-ai.com <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>
    </PublicShell>
  );
}
