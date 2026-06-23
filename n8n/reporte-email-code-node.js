// ── Reporte de leads etiquetados por IA — RealtyPlus (solo Excel) ────────
// Sube SOLO el CSV a Supabase Storage y arma el correo con un botón/link real
// "Descargar Excel" (usa ?download= para forzar la descarga). Webhook → Code → Gmail.
// Salida: json { subject, html }
//
// ⚠️ Pega tu SERVICE_ROLE key en SVC (solo aquí en n8n; NO la subas a git).
const SUPA = "https://owykkhwqpnumvgdeugmj.supabase.co";
const BUCKET = "reportes";
const SVC = "PEGA_AQUI_TU_SERVICE_ROLE_KEY";

const src = $input.first().json;
const data = (src && src.body) ? src.body : src;

const LOGO = "https://realtyplus-nexus.vercel.app/realtyplus-logo.png";
const AZUL = "#003366", ROJO = "#cc0000", VERDE = "#16a34a";

const leads = Array.isArray(data.leads) ? data.leads : [];
const etiquetasTotales = Array.isArray(data.etiquetas_totales) ? data.etiquetas_totales : [];
const generadoEn = data.generado_en || new Date().toISOString();
const ventanaHoras = data.ventana_horas || null;

const colorDe = {};
for (const t of etiquetasTotales) colorDe[String(t.nombre || "").toLowerCase()] = t.color || AZUL;

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmtFecha = (iso) => { try {
  return new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago",
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
} catch (e) { return iso; } };

const totalLeads = leads.length;
const etiquetados = leads.filter((l) => (l.etiquetas || []).length > 0).length;
const conteo = {};
for (const l of leads) for (const e of (l.etiquetas || [])) conteo[e] = (conteo[e] || 0) + 1;
const conteoOrden = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
const leadsOrden = leads.slice().sort((a, b) => (b.etiquetas || []).length - (a.etiquetas || []).length);

const kpi = (v, l, c) => '<td align="center" style="padding:14px 8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">'
  + '<div style="font-size:26px;font-weight:800;color:' + c + ';line-height:1;">' + v + '</div>'
  + '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">' + l + '</div></td>';

const resumenEtiquetas = conteoOrden.length
  ? conteoOrden.map(([n, k]) => { const c = colorDe[n.toLowerCase()] || "#64748b";
      return '<span style="display:inline-block;background:' + c + ';color:#fff;font-size:12px;font-weight:600;padding:5px 13px;border-radius:14px;margin:3px;">' + esc(n) + ' &middot; ' + k + '</span>'; }).join("")
  : '<span style="color:#94a3b8;font-size:13px;">Ninguna etiqueta asignada en este periodo.</span>';

const headHtml = (titulo) => '<tr><td style="background:' + AZUL + ';padding:26px 28px;">'
  + '<table role="presentation" width="100%"><tr><td><img src="' + LOGO + '" alt="RealtyPlus" height="38" style="height:38px;display:block;border:0;"></td>'
  + '<td align="right" style="color:#fff;font-size:12px;opacity:.85;">Reporte automatico &middot; IA</td></tr></table>'
  + '<div style="color:#fff;font-size:21px;font-weight:800;margin-top:16px;">' + titulo + '</div>'
  + '<div style="color:#cdd9e6;font-size:13px;margin-top:4px;">Generado el ' + esc(fmtFecha(generadoEn)) + (ventanaHoras ? ' &middot; ventana de ' + ventanaHoras + ' h' : '') + '</div></td></tr>';
const kpisHtml = '<tr><td style="padding:22px 28px 6px;"><table role="presentation" width="100%"><tr>'
  + kpi(totalLeads, "Leads", AZUL) + '<td style="width:12px;"></td>' + kpi(etiquetados, "Etiquetados", VERDE) + '<td style="width:12px;"></td>' + kpi(conteoOrden.length, "Etiquetas", ROJO) + '</tr></table></td></tr>';
const etiqHtml = '<tr><td style="padding:18px 28px 4px;"><div style="font-size:13px;font-weight:700;color:' + AZUL + ';text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Resumen por etiqueta</div><div>' + resumenEtiquetas + '</div></td></tr>';
const footHtml = '<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;text-align:center;color:#94a3b8;font-size:11px;line-height:1.6;">RealtyPlus &middot; Etiquetado automatico con IA (DeepSeek).<br>Generado para el equipo de ventas y seguimiento de leads.</td></tr>';
const wrap = (inner) => '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,51,102,.10);">' + inner + '</table>';
const page = (inner) => '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
  + '<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">'
  + '<table role="presentation" width="100%" style="background:#eef2f7;padding:24px 12px;"><tr><td align="center">' + wrap(inner) + '</td></tr></table></body></html>';

// === Traer id_contacto y pais desde la BD (no depende del payload del cron) ===
const coreTel = (t) => String(t || "").split("@")[0].replace(/\D/g, "");
const infoTel = {};
try {
  const cores = [...new Set(leadsOrden.map((l) => coreTel(l.telefono)).filter(Boolean))];
  if (cores.length) {
    const rows = await this.helpers.httpRequest({
      method: "GET",
      url: SUPA + "/rest/v1/leads_campana?select=telefono,id_contacto,pais&telefono=in.(" + cores.join(",") + ")",
      headers: { apikey: SVC, Authorization: "Bearer " + SVC },
      json: true,
    });
    for (const r of (rows || [])) infoTel[coreTel(r.telefono)] = { id_contacto: r.id_contacto, pais: r.pais };
  }
} catch (e) { /* si falla la consulta, caemos a lo que venga en el payload */ }

const idcDe = (l) => { const i = infoTel[coreTel(l.telefono)] || {}; return (i.id_contacto != null && i.id_contacto !== "") ? i.id_contacto : (l.id_contacto || ""); };
const paisDe = (l) => { const i = infoTel[coreTel(l.telefono)] || {}; return (i.pais != null && i.pais !== "") ? i.pais : (l.pais || ""); };

// === CSV para Excel (BOM + separador ;) ===
const csvEsc = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
const csvRows = [["ID Contacto", "Nombre", "Telefono", "Pais", "Etiquetas", "Resumen"].map(csvEsc).join(";")];
for (const l of leadsOrden) csvRows.push([idcDe(l), l.nombre || "", l.telefono || "", paisDe(l), (l.etiquetas || []).join(", "), l.resumen || ""].map(csvEsc).join(";"));
const csv = "﻿" + csvRows.join("\r\n");

// === Subir SOLO el CSV a Supabase Storage ===
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const csvPath = "leads-" + stamp + ".csv";
// ?download= fuerza la descarga (Content-Disposition: attachment), aunque el bucket sirva text/plain.
const csvUrl = SUPA + "/storage/v1/object/public/" + BUCKET + "/" + csvPath + "?download=leads-realtyplus.csv";

await this.helpers.httpRequest({
  method: "POST",
  url: SUPA + "/storage/v1/object/" + BUCKET + "/" + csvPath,
  headers: { Authorization: "Bearer " + SVC, apikey: SVC, "Content-Type": "text/csv; charset=utf-8", "x-upsert": "true" },
  body: csv,
});

// === Cuerpo del correo con un único botón: Descargar Excel ===
const btn = (txt, color, href) => '<a href="' + href + '" target="_blank" style="display:inline-block;background:' + color + ';color:#fff;font-size:15px;font-weight:700;padding:13px 30px;border-radius:10px;text-decoration:none;text-align:center;">' + txt + '</a>';
const emailHtml = page(headHtml("Reporte de leads etiquetados") + kpisHtml + etiqHtml
  + '<tr><td style="padding:24px 28px;text-align:center;">' + btn("&#128202; Descargar Excel", VERDE, csvUrl)
  + '<div style="font-size:12px;color:#94a3b8;margin-top:10px;">Se abre directamente en Excel (formato CSV).</div></td></tr>'
  + footHtml);

const subject = "RealtyPlus - " + totalLeads + " lead" + (totalLeads === 1 ? "" : "s") + " etiquetado" + (totalLeads === 1 ? "" : "s") + " por IA - " + fmtFecha(generadoEn);

return [{ json: { subject, html: emailHtml, total: totalLeads, csvUrl } }];
