import { useEffect } from "react";
import { BLOG_META } from "@/content/blogMeta";

/*
  useSeo — SEO client-side ligero (sin react-helmet): fija title, description,
  canonical y Open Graph/Twitter al montar la página. Google renderiza JS y lo
  recoge. (Nota: los scrapers sociales que NO ejecutan JS no leerán el OG; para
  eso haría falta prerender/SSR — pendiente si se quieren previews sociales ricas.)

  Si la ruta tiene canonicalOverride en BLOG_META (consolidación cross-domain
  del A1 de la auditoría SEO), el canonical apunta ahí en vez de a esta página.
*/

const ORIGIN = "https://lexhouse-ai.homes";
const DEFAULT_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/3Fius1RjN9XIwh9ntzEFdrBX6FC3/social-images/social-1783397860518-Gemini_Generated_Image_na5igdna5igdna5i.webp";

interface SeoOpts {
  title: string;
  description: string;
  /** Ruta absoluta del sitio, ej. "/blog/mi-articulo". */
  path: string;
  image?: string;
  type?: "website" | "article";
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({ title, description, path, image = DEFAULT_IMAGE, type = "website" }: SeoOpts) {
  useEffect(() => {
    const override = BLOG_META[path]?.canonicalOverride;
    const url = override ?? ORIGIN + path;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", type);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setCanonical(url);
    window.scrollTo(0, 0);
  }, [title, description, path, image, type]);
}
