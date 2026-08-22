// Plantillas de correo para envío por Resend.
// IMPORTANTE: las plantillas conservan las variables {{empresa}}/{{ciudad}}/{{gancho}}
// intactas — la edge function `send-personalized-campaign` las rellena por destinatario.
// El HTML profesional usa layout de TABLAS + estilos inline (compatibilidad Gmail/Outlook/Apple Mail).
// Identidad de marca RE/MAX = LexHouse: azul (#003DA5) + rojo (#E4002B) + blanco, sobre navy (#0F1E3A).

const esc = (s: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Logo institucional fijo (URL pública estable, sin hash de build) para el
// diseño de correo del vendedor: NO es editable, siempre es este archivo.
export const LEXHOUSE_LOGO_URL = "https://lexhouse-ai.homes/lexhouse-logo-email.png";

// Paleta y tipografía (fuentes web-safe con Segoe UI en Windows/Outlook y Georgia para títulos).
const NAVY = "#0F1E3A";
const RED = "#E4002B";
const BLUE = "#003DA5";
const GOLD = "#C9A227";
const INK = "#3A4A63";
const MUTED = "#6B7A91";
const FONT_BODY = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FONT_HEAD = "Georgia,'Times New Roman',serif";

// Convierte el cuerpo en texto plano a bloques HTML (párrafos + listas con viñeta ✓ en chip).
function renderBlocks(text: string, brand: string): string {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => /^[-•]\s+/.test(l));
      if (isList) {
        const rows = lines
          .map((l) => {
            const t = esc(l.replace(/^[-•]\s+/, ""));
            return `<tr>
  <td valign="top" style="padding:0 12px 12px 0;">
    <span style="display:inline-block;width:22px;height:22px;border-radius:7px;background:${brand}14;color:${brand};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;text-align:center;line-height:22px;">&#10003;</span>
  </td>
  <td valign="top" style="padding:1px 0 12px;font-family:${FONT_BODY};font-size:15.5px;line-height:1.55;color:${INK};">${t}</td>
</tr>`;
          })
          .join("");
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 18px;">${rows}</table>`;
      }
      const p = lines.map(esc).join("<br>");
      return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15.5px;line-height:1.72;color:${INK};">${p}</p>`;
    })
    .join("\n");
}

// Convierte el cuerpo en texto plano a HTML simple (modo "texto").
export function bodyToHtml(text: string): string {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const html = blocks
    .map((block) => {
      const lines = block.split(/\n/).map((l) => l.trim());
      const isList = lines.every((l) => /^[-•]\s+/.test(l));
      if (isList) {
        const items = lines.map((l) => `<li>${l.replace(/^[-•]\s+/, "")}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("\n");
  return `<div style="font-family:${FONT_BODY};font-size:15px;color:${INK};line-height:1.65;max-width:560px;margin:0 auto">\n${html}\n</div>`;
}

// Bloques simples (párrafos + listas) sin estilos de marketing, para el modo personal.
function plainInner(text: string): string {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => /^[-•]\s+/.test(l));
      if (isList) {
        const items = lines.map((l) => `<li style="margin:0 0 4px;">${esc(l.replace(/^[-•]\s+/, ""))}</li>`).join("");
        return `<ul style="margin:0 0 12px;padding-left:20px;">${items}</ul>`;
      }
      return `<p style="margin:0 0 12px;">${lines.map(esc).join("<br>")}</p>`;
    })
    .join("\n");
}

// Correo "personal" minimalista: parece un correo 1:1 escrito a mano, sin banners,
// botones ni bloques de color. Maximiza la probabilidad de caer en Bandeja principal
// (Gmail suele mandar el HTML de marketing a "Promociones").
export function buildPlainEmail(opts: ProEmailOptions): string {
  const brand = (opts.brandColor || BLUE).trim();
  const inner = plainInner(opts.body || "");
  const cta = (opts.ctaText || "").trim();
  const ctaUrl = (opts.ctaUrl || "").trim();
  const cta2 = (opts.cta2Text || "").trim();
  const cta2Url = (opts.cta2Url || "").trim();
  const bonus = (opts.bonusText || "").trim();
  const bonusUrl = (opts.bonusUrl || "").trim();
  const links: string[] = [];
  if (cta && ctaUrl) links.push(`<a href="${esc(ctaUrl)}" style="color:${brand};font-weight:600;">${esc(cta)}</a>`);
  if (cta2 && cta2Url) links.push(`<a href="${esc(cta2Url)}" style="color:${brand};font-weight:600;">${esc(cta2)}</a>`);
  const ctaLine = links.length ? `<p style="margin:0 0 12px;">${links.join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</p>` : "";
  const bonusLine = bonus && bonusUrl
    ? `<p style="margin:0 0 12px;font-size:13px;color:#666666;"><a href="${esc(bonusUrl)}" style="color:${brand};">${esc(bonus)}</a></p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222222;max-width:600px;margin:0 auto;">
${inner}
${ctaLine}
${bonusLine}
</div>`;
}

export type ProEmailOptions = {
  fromName: string;
  titulo: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  cta2Text?: string;    // botón secundario opcional (p. ej. contacto directo)
  cta2Url?: string;
  brandColor?: string;
  logoUrl?: string;
  avatarUrl?: string;   // foto de perfil del remitente (firma con foto)
  footerText?: string;
  bonusText?: string;   // regalo/bonus opcional (línea bajo el CTA)
  bonusUrl?: string;
};

// Banda tricolor de marca (rojo RE/MAX | dorado | azul), firma constante bajo el encabezado.
const TRICOLOR = `<tr><td style="padding:0;font-size:0;line-height:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="40%" height="5" style="height:5px;background:${RED};font-size:0;line-height:0;">&nbsp;</td>
    <td width="20%" height="5" style="height:5px;background:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
    <td width="40%" height="5" style="height:5px;background:${BLUE};font-size:0;line-height:0;">&nbsp;</td>
  </tr></table>
</td></tr>`;

// Genera un correo HTML profesional, responsivo y compatible con clientes de correo.
export function buildProEmail(opts: ProEmailOptions): string {
  const brand = (opts.brandColor || BLUE).trim();
  const titulo = opts.titulo?.trim() || "";
  const bodyHtml = renderBlocks(opts.body || "", brand);
  const cta = (opts.ctaText || "").trim();
  const ctaUrl = (opts.ctaUrl || "").trim();
  const showCta = Boolean(cta && ctaUrl);
  const footer = (opts.footerText || `${opts.fromName} · Inteligencia artificial para tu negocio.`).trim();
  const preheader = esc(
    (opts.body || titulo).replace(/\{\{[^}]*\}\}/g, " ").replace(/[-•]/g, " ").replace(/\s+/g, " ").trim().slice(0, 110),
  );

  const header = opts.logoUrl?.trim()
    ? `<img src="${esc(opts.logoUrl.trim())}" alt="${esc(opts.fromName)}" height="36" style="display:block;border:0;outline:none;text-decoration:none;height:36px;">`
    : `<span style="font-family:${FONT_HEAD};font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.3px;">${esc(opts.fromName)}</span>`;

  const cta2 = (opts.cta2Text || "").trim();
  const cta2Url = (opts.cta2Url || "").trim();
  const showCta2 = Boolean(cta2 && cta2Url);
  const bonus = (opts.bonusText || "").trim();
  const bonusUrl = (opts.bonusUrl || "").trim();
  const showBonus = Boolean(bonus && bonusUrl);

  const primaryBtn = showCta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn"><tr>
    <td align="center" style="border-radius:12px;background:${brand};border:2px solid ${GOLD};box-shadow:0 8px 18px ${brand}3d;">
      <a href="${esc(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT_BODY};font-size:15px;font-weight:700;letter-spacing:.2px;color:#ffffff;text-decoration:none;border-radius:10px;background:${brand};">${esc(cta)}</a>
    </td></tr></table>`
    : "";
  const secondaryBtn = showCta2
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn"><tr>
    <td align="center" style="border-radius:12px;border:2px solid ${brand};background:#ffffff;">
      <a href="${esc(cta2Url)}" target="_blank" style="display:inline-block;padding:13px 32px;font-family:${FONT_BODY};font-size:15px;font-weight:700;letter-spacing:.2px;color:${brand};text-decoration:none;border-radius:12px;">${esc(cta2)}</a>
    </td></tr></table>`
    : "";
  const spacer = `<div style="height:11px;line-height:11px;font-size:0;">&nbsp;</div>`;

  // Firma con foto de perfil del remitente (opcional), con separador sutil.
  const avatar = (opts.avatarUrl || "").trim();
  const avatarBlock = avatar
    ? `<tr><td class="px" style="padding:6px 34px 4px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #edf0f5;padding-top:16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="48" style="vertical-align:middle;"><img src="${esc(avatar)}" width="48" height="48" alt="${esc(opts.fromName)}" style="display:block;border:0;border-radius:50%;width:48px;height:48px;object-fit:cover;box-shadow:0 3px 8px rgba(15,30,58,.18);"></td>
      <td style="padding-left:13px;vertical-align:middle;font-family:${FONT_BODY};">
        <div style="font-size:14.5px;font-weight:700;color:${NAVY};">${esc(opts.fromName)}<span style="display:inline-block;width:17px;height:17px;line-height:17px;text-align:center;border-radius:50%;background:${GOLD};color:#ffffff;font-size:10px;font-weight:700;vertical-align:middle;margin-left:7px;box-shadow:0 1px 3px rgba(201,162,39,.5);">&#10003;</span></div>
        <div style="font-size:12px;color:${MUTED};letter-spacing:.2px;">LexHouse AI</div>
      </td>
    </tr></table>
  </td></tr></table>
</td></tr>`
    : "";

  const ctaBlock = (showCta || showCta2)
    ? `<tr><td class="px" align="left" style="padding:8px 34px ${showBonus ? "12px" : "32px"};">
  ${primaryBtn}${showCta && showCta2 ? spacer : ""}${secondaryBtn}
</td></tr>`
    : "";

  const bonusBlock = showBonus
    ? `<tr><td class="px" align="left" style="padding:0 34px 30px;">
  <a href="${esc(bonusUrl)}" target="_blank" style="font-family:${FONT_BODY};font-size:13px;font-weight:600;color:${brand};text-decoration:none;border-bottom:1px dashed ${brand}66;padding-bottom:2px;">&#127873; ${esc(bonus)} &rarr;</a>
</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(titulo || opts.fromName)}</title>
<style>
  body{margin:0;padding:0;background:#e9edf3;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
  img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
  a{color:${brand};}
  .btn a:hover{opacity:.92;}
  @media only screen and (max-width:600px){
    .container{width:100%!important;border-radius:0!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .h1{font-size:23px!important;}
    .btn,.btn a{display:block!important;width:100%!important;text-align:center!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#e9edf3;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#e9edf3;font-size:1px;line-height:1px;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e9edf3;">
 <tr><td align="center" style="padding:30px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dfe4ec;box-shadow:0 14px 38px rgba(15,30,58,.12);">
   <tr><td class="px" style="background:${NAVY};padding:24px 34px;">${header}</td></tr>
   ${TRICOLOR}
   <tr><td class="px" style="padding:36px 34px 8px;">
     ${titulo ? `<h1 class="h1" style="margin:0 0 14px;font-family:${FONT_HEAD};font-size:27px;line-height:1.24;color:${NAVY};font-weight:700;letter-spacing:-.2px;">${esc(titulo)}</h1>
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td width="48" height="3" style="width:48px;height:3px;background:${GOLD};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr></table>` : ""}
     ${bodyHtml}
   </td></tr>
   ${avatarBlock}
   ${ctaBlock}
   ${bonusBlock}
   ${TRICOLOR}
   <tr><td class="px" style="background:${NAVY};padding:24px 34px;font-family:${FONT_BODY};font-size:12.5px;line-height:1.65;color:#9db0cc;">${esc(footer)}</td></tr>
  </table>
  <div style="font-family:${FONT_BODY};font-size:11px;line-height:1.55;color:#94a3b8;padding:18px 12px 0;max-width:600px;">
    Recibes este correo porque tu negocio podría beneficiarse de nuestra solución. Si no te interesa, responde este correo con &ldquo;baja&rdquo; y no volveremos a escribirte.
  </div>
 </td></tr>
</table>
</body>
</html>`;
}
