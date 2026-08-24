// Enlaces a Instagram / Facebook para contactar un lead.
//
// Ni Instagram ni Facebook aceptan el texto del mensaje en la URL (no existe un
// equivalente de `wa.me/...?text=`). Por eso el flujo del CRM es:
// copiar el mensaje al portapapeles y abrir el chat ya listo para pegar.

/** Handle limpio: acepta "@juan", "juan", o una URL completa del perfil. */
export function instagramHandle(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const url = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const handle = (url ? url[1] : s).replace(/^@/, "").replace(/\/+$/, "").trim();
  if (!handle || !/^[A-Za-z0-9._]+$/.test(handle)) return null;
  return handle;
}

/** Handle o id de página de Facebook desde "@pagina", "pagina" o una URL. */
export function facebookHandle(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const url = s.match(/facebook\.com\/(?:profile\.php\?id=)?([A-Za-z0-9.\-_]+)/i);
  const handle = (url ? url[1] : s).replace(/^@/, "").replace(/\/+$/, "").trim();
  if (!handle || !/^[A-Za-z0-9.\-_]+$/.test(handle)) return null;
  return handle;
}

/** Perfil público de Instagram. */
export function instagramPerfil(v: string | null | undefined): string | null {
  const h = instagramHandle(v);
  return h ? `https://instagram.com/${h}` : null;
}

/**
 * Chat directo de Instagram. `ig.me/m/<handle>` abre la app en móvil y el
 * Direct web en escritorio; si el handle no existe, cae en el perfil.
 */
export function instagramDm(v: string | null | undefined): string | null {
  const h = instagramHandle(v);
  return h ? `https://ig.me/m/${h}` : null;
}

/** Perfil / página de Facebook. */
export function facebookPerfil(v: string | null | undefined): string | null {
  const h = facebookHandle(v);
  if (!h) return null;
  return /^\d+$/.test(h) ? `https://facebook.com/profile.php?id=${h}` : `https://facebook.com/${h}`;
}

/** Messenger directo (`m.me`). Solo funciona con páginas/perfiles públicos. */
export function facebookMessenger(v: string | null | undefined): string | null {
  const h = facebookHandle(v);
  return h ? `https://m.me/${h}` : null;
}

/**
 * Mensaje de primer contacto para redes. Prioriza el que redactó la IA de
 * Buscar Leads; si no hay, arma uno neutro con los datos que sí existen
 * (sin inventar cifras ni prometer resultados).
 */
export function mensajeRedes(d: {
  mensajeIa?: string | null;
  nombre?: string | null;
  gancho?: string | null;
  propuestaValor?: string | null;
}): string {
  const ia = (d.mensajeIa ?? "").trim();
  if (ia) return ia;

  const nombre = (d.nombre ?? "").trim().split(/\s+/)[0] || "";
  const gancho = (d.gancho ?? "").trim();
  const valor = (d.propuestaValor ?? "").trim();

  return [
    `Hola${nombre ? ` ${nombre}` : ""}, ¿cómo estás?`,
    gancho ? `Los vi por acá y me llamó la atención ${gancho.charAt(0).toLowerCase()}${gancho.slice(1)}` : "Los vi por acá y me llamó la atención lo que hacen.",
    valor || "Trabajo ayudando a negocios como el suyo a captar contactos y darles seguimiento sin que se pierda ninguno.",
    "¿Te sirve si te cuento en dos minutos y me dices si te encaja?",
  ].join("\n\n");
}
