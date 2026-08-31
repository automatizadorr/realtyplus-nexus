// Edge middleware — SEO para SPA: inyecta title/description/canonical/OG en el HTML crudo
// que recibe Google. Las rutas /blog/* sirven index.html plano; este middleware reescribe
// los meta tags según la ruta antes de que el crawler lea el documento.
import { BLOG_META, ORIGIN } from "./src/content/blogMeta";

export const config = {
  matcher: ["/", "/blog", "/blog/:slug"],
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function injectMeta(html: string, title: string, description: string, url: string): string {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${u}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${u}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`);
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const { pathname } = new URL(request.url);
  const meta = BLOG_META[pathname] ?? BLOG_META["/"];
  const canonical = meta.canonicalOverride ?? `${ORIGIN}${pathname === "/" ? "/" : pathname}`;

  const base = new URL("/index.html", request.url);
  const res = await fetch(base);
  if (!res.ok) return undefined;

  const html = await res.text();
  const body = injectMeta(html, meta.title, meta.description, canonical);

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
