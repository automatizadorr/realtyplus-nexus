// Plantillas de correo para envío por Resend.
// IMPORTANTE: las plantillas conservan las variables {{empresa}}/{{ciudad}}/{{gancho}}
// intactas — la edge function `send-personalized-campaign` las rellena por destinatario.
// El HTML profesional usa layout de TABLAS + estilos inline (compatibilidad Gmail/Outlook/Apple Mail).

const esc = (s: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Convierte el cuerpo en texto plano a bloques HTML (párrafos + listas con viñeta ✓).
// `brand` colorea las viñetas. Usado por el diseño profesional.
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
  <td valign="top" style="padding:0 10px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:${brand};font-weight:700;">&#10003;</td>
  <td valign="top" style="padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#2a3b57;">${t}</td>
</tr>`;
          })
          .join("");
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${rows}</table>`;
      }
      const p = lines.map(esc).join("<br>");
      return `<p style="margin:0 0 15px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#2a3b57;">${p}</p>`;
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
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a2b4a;line-height:1.6;max-width:560px;margin:0 auto">\n${html}\n</div>`;
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
  footerText?: string;
  bonusText?: string;   // regalo/bonus opcional (línea bajo el CTA)
  bonusUrl?: string;
};

// Genera un correo HTML profesional, responsivo y compatible con clientes de correo.
export function buildProEmail(opts: ProEmailOptions): string {
  const brand = (opts.brandColor || "#003DA5").trim();
  const titulo = opts.titulo?.trim() || "";
  const bodyHtml = renderBlocks(opts.body || "", brand);
  const cta = (opts.ctaText || "").trim();
  const ctaUrl = (opts.ctaUrl || "").trim();
  const showCta = cta && ctaUrl;
  const footer = (opts.footerText || `${opts.fromName} · Inteligencia artificial para tu negocio.`).trim();
  // Preheader (texto oculto de vista previa en la bandeja): quitamos los tokens
  // {{...}} ANTES de recortar para no dejar un token partido (p. ej. "{{gan").
  const preheader = esc(
    (opts.body || titulo).replace(/\{\{[^}]*\}\}/g, " ").replace(/[-•]/g, " ").replace(/\s+/g, " ").trim().slice(0, 110),
  );

  const header = opts.logoUrl?.trim()
    ? `<img src="${esc(opts.logoUrl.trim())}" alt="${esc(opts.fromName)}" height="34" style="display:block;border:0;outline:none;text-decoration:none;height:34px;">`
    : `<span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:700;color:#ffffff;letter-spacing:.3px;">${esc(opts.fromName)}</span>`;

  const cta2 = (opts.cta2Text || "").trim();
  const cta2Url = (opts.cta2Url || "").trim();
  const showCta2 = Boolean(cta2 && cta2Url);
  const bonus = (opts.bonusText || "").trim();
  const bonusUrl = (opts.bonusUrl || "").trim();
  const showBonus = Boolean(bonus && bonusUrl);

  const primaryBtn = showCta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn"><tr>
    <td align="center" style="border-radius:10px;background:${brand};">
      <a href="${esc(ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:${brand};">${esc(cta)}</a>
    </td></tr></table>`
    : "";
  const secondaryBtn = showCta2
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn"><tr>
    <td align="center" style="border-radius:10px;border:2px solid ${brand};">
      <a href="${esc(cta2Url)}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${brand};text-decoration:none;border-radius:10px;">${esc(cta2)}</a>
    </td></tr></table>`
    : "";
  const spacer = `<div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>`;

  const ctaBlock = (showCta || showCta2)
    ? `<tr><td class="px" align="left" style="padding:4px 34px ${showBonus ? "12px" : "30px"};">
  ${primaryBtn}${showCta && showCta2 ? spacer : ""}${secondaryBtn}
</td></tr>`
    : "";

  const bonusBlock = showBonus
    ? `<tr><td class="px" align="left" style="padding:0 34px 30px;">
  <a href="${esc(bonusUrl)}" target="_blank" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${brand};text-decoration:none;border-bottom:1px dashed ${brand}66;padding-bottom:1px;">&#127873; ${esc(bonus)} &rarr;</a>
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
  body{margin:0;padding:0;background:#eef1f6;-webkit-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{border:0;line-height:100%;outline:none;text-decoration:none;}
  a{color:${brand};}
  @media only screen and (max-width:600px){
    .container{width:100%!important;border-radius:0!important;}
    .px{padding-left:22px!important;padding-right:22px!important;}
    .h1{font-size:22px!important;}
    .btn a{display:block!important;text-align:center!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eef1f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef1f6;font-size:1px;line-height:1px;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f6;">
 <tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
   <tr><td class="px" style="background:${brand};padding:22px 32px;">${header}</td></tr>
   <tr><td style="height:4px;line-height:4px;font-size:0;background:${brand};">&nbsp;</td></tr>
   <tr><td class="px" style="padding:34px 34px 6px;">
     ${titulo ? `<h1 class="h1" style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.25;color:#0f1e3a;font-weight:700;">${esc(titulo)}</h1>` : ""}
     ${bodyHtml}
   </td></tr>
   ${ctaBlock}
   ${bonusBlock}
   <tr><td class="px" style="background:#0f1e3a;padding:22px 34px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#9fb0cc;">${esc(footer)}</td></tr>
  </table>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#94a3b8;padding:16px 12px 0;max-width:600px;">
    Recibes este correo porque tu negocio podría beneficiarse de nuestra solución. Si no te interesa, responde este correo con &ldquo;baja&rdquo; y no volveremos a escribirte.
  </div>
 </td></tr>
</table>
</body>
</html>`;
}
