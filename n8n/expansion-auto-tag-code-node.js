// ============================================================
//  Nodo Code "Construir Reporte Expansión" — Webhook /auto-tag-chile
//  Transforma el payload de la Edge Function `enviar-expansion` (reporte diario
//  consolidado de reactivación) en un correo HTML de expansión con marca
//  RealtyPlus (paleta RE/MAX), AGRUPADO POR ETIQUETA, mostrando métricas por
//  etiqueta y la lista de leads. La conversación COMPLETA de cada lead NO va en
//  el cuerpo (Gmail no soporta <details>): viaja en el Excel adjunto (columna
//  «Conversación»), que genera la Edge Function y llega en `excel_base64`.
//
//  Modo de ejecución: "Run Once for All Items".
//  IMPORTANTE: en el nodo Gmail, Email Type = HTML (si no, sale en texto plano)
//  y el Webhook debe tener responseMode = "responseNode".
//
//  Payload esperado (enviar-expansion):
//    { timestamp, evento:"auto_expansion_24h", ventana_horas, filtro,
//      total_leads, total_mensajes, total_etiquetas,
//      etiquetas: [{ id, nombre, color, es_permanente, total_leads,
//                    respondieron, tasa_respuesta, leads:[{ nombre, telefono,
//                    email, pais, estado, ha_respondido, total_mensajes, ... }] }],
//      excel_base64, excel_filename }
// ============================================================

// ── CONFIGURACIÓN (editar) ──────────────────────────────────
const DEST = "expansion@realtyplus.es";   // <-- CORREO DE EXPANSIÓN / JEFATURA
const LOGO = "https://realtyplus-nexus.vercel.app/realtyplus-logo.png";
const AZUL = "#003DA5";   // RE/MAX azul
const ROJO = "#DC1C2E";   // RE/MAX rojo
// ────────────────────────────────────────────────────────────

// El webhook entrega el cuerpo en .json.body; si llega plano, usar .json
const p = ($input.first().json && $input.first().json.body) || $input.first().json || {};
const etiquetas = Array.isArray(p.etiquetas) ? p.etiquetas : [];

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/\n/g, "<br>");

const hoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

const totalLeads = Number(p.total_leads) || etiquetas.reduce((a, t) => a + (Array.isArray(t.leads) ? t.leads.length : 0), 0);
const totalMsgs = Number(p.total_mensajes) || 0;
const ventana = esc(p.ventana_horas || 24);

// ── Fila de un lead (compacta; la conversación completa va en el Excel) ──
const buildLead = (l, color) => {
  const tel = esc(l.telefono || "");
  const pais = l.pais ? ` · ${esc(l.pais)}` : "";
  const resp = l.ha_respondido ? "✅ respondió" : "· sin respuesta";
  const msgs = l.total_mensajes != null ? ` · 💬 ${esc(l.total_mensajes)} msgs` : "";
  return `<div class="lead">
    <div class="lav" style="background:${color}">${esc((l.nombre || "?").charAt(0).toUpperCase())}</div>
    <div class="lin">
      <div class="lnm">${esc(l.nombre || "Sin nombre")}</div>
      <div class="lmt">📱 ${tel}${pais}${msgs} · ${resp}</div>
    </div>
  </div>`;
};

// ── Sección por etiqueta (ordenadas por nombre) ─────────────
const seccionesArr = etiquetas
  .slice()
  .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"))
  .map((t) => {
    const color = t.color || AZUL;
    const leads = Array.isArray(t.leads) ? t.leads : [];
    const tasa = t.tasa_respuesta != null ? `${esc(t.tasa_respuesta)}%` : "—";
    return `<div class="tag">
      <div class="thd" style="border-left:5px solid ${color}">
        <span class="tdot" style="background:${color}"></span>
        <span class="ttl">${esc(t.nombre || "Sin etiqueta")}</span>
        <span class="tpill" style="background:${color}1a;color:${color}">${leads.length} leads · ${esc(t.respondieron ?? 0)} resp · ${tasa}</span>
      </div>
      <div class="tbd">${leads.map((l) => buildLead(l, color)).join("") || '<div class="nom">Sin leads</div>'}</div>
    </div>`;
  });
const secciones = seccionesArr.join("");

// ── HTML final (marca RealtyPlus / paleta RE/MAX) ───────────
const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte de Expansión — ${hoy}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#eef1f5;color:#1f2937;font-size:13px;line-height:1.5}
.wrap{max-width:820px;margin:0 auto;background:#fff}
.ph{background:#fff;border-bottom:4px solid ${ROJO};padding:22px 28px;text-align:center}
.ph img{height:52px;width:auto}
.ph h1{font-size:18px;color:${AZUL};margin-top:12px;font-weight:700}
.ph p{color:#6b7280;font-size:12px;margin-top:4px}
.note{background:${AZUL}0d;border:1px dashed ${AZUL}55;color:${AZUL};border-radius:8px;margin:16px 28px 0;padding:10px 14px;font-size:12px;font-weight:600;text-align:center}
.kpis{display:flex;flex-wrap:wrap;gap:10px;padding:18px 28px;background:${AZUL}}
.kpi{flex:1;min-width:120px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:14px;text-align:center}
.kpi b{display:block;font-size:24px;color:#fff}.kpi small{font-size:10px;color:#c7d2e0;text-transform:uppercase;letter-spacing:.5px}
.main{padding:20px 28px 36px}
.tag{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:18px;overflow:hidden}
.thd{display:flex;align-items:center;gap:10px;padding:13px 16px;background:#f8fafc}
.tdot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.ttl{font-size:15px;font-weight:700;color:${AZUL};flex:1}
.tpill{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
.tbd{padding:12px}
.lead{display:flex;align-items:center;gap:12px;background:#fbfcfe;border:1px solid #eef1f5;border-radius:9px;margin-bottom:8px;padding:10px 14px}
.lav{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0}
.lin{flex:1;min-width:0}
.lnm{font-size:14px;font-weight:700;color:#111827}
.lmt{font-size:11px;color:#6b7280;margin-top:2px}
.nom{padding:12px 14px;color:#cbd5e1;font-style:italic}
.ft{text-align:center;padding:16px;color:#9ca3af;font-size:10px;border-top:1px solid #eef1f5}
</style></head><body><div class="wrap">
<div class="ph"><img src="${LOGO}" alt="RealtyPlus — Servicios Inmobiliarios"><h1>Reporte de Expansión — Reactivación de leads</h1><p>Generado el ${hoy} · ${totalLeads} leads · ${seccionesArr.length} etiquetas · ventana ${ventana}h</p></div>
<div class="note">📎 Métricas por etiqueta y leads abajo. La conversación COMPLETA de cada lead está en el Excel adjunto (columna «Conversación»), junto con todas las métricas.</div>
<div class="kpis">
  <div class="kpi"><b>${totalLeads}</b><small>Leads</small></div>
  <div class="kpi"><b>${seccionesArr.length}</b><small>Etiquetas</small></div>
  <div class="kpi"><b>${totalMsgs}</b><small>Mensajes</small></div>
  <div class="kpi"><b>${ventana}h</b><small>Ventana</small></div>
</div>
<div class="main">${secciones || '<div class="nom">No hay leads enviables en esta ventana.</div>'}</div>
<div class="ft">RealtyPlus · Servicios Inmobiliarios · Generado automáticamente por RealtyPlus Nexus · ${hoy}</div>
</div></body></html>`;

const asunto = `📈 RealtyPlus — Reporte de Expansión · ${totalLeads} leads · ${hoy}`;

// Adjunto: el Excel (.xlsx) que genera la Edge Function y llega en excel_base64.
const binary = {};
if (p.excel_base64) {
  binary.excel = await this.helpers.prepareBinaryData(
    Buffer.from(p.excel_base64, "base64"),
    p.excel_filename || `expansion-leads-${new Date().toISOString().slice(0, 10)}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
} else {
  // Fallback: no llegó excel_base64 desde la Edge Function → armamos un CSV a partir
  // de los datos REALES del payload (etiquetas[].leads[]), no de las secciones HTML.
  // Así binary.excel siempre existe y el nodo Gmail no falla por adjunto ausente.
  const fecha = new Date().toISOString().slice(0, 10);
  const csvEsc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const filas = ["Etiqueta,Total Leads,Nombre,Email,Telefono,Pais,Ha Respondido,Total Mensajes"];
  for (const t of etiquetas) {
    const leads = Array.isArray(t.leads) ? t.leads : [];
    if (leads.length === 0) {
      filas.push([csvEsc(t.nombre), 0, "", "", "", "", "", ""].join(","));
      continue;
    }
    for (const l of leads) {
      filas.push([
        csvEsc(t.nombre), leads.length, csvEsc(l.nombre), csvEsc(l.email),
        csvEsc(l.telefono), csvEsc(l.pais), l.ha_respondido ? "Si" : "No", l.total_mensajes ?? 0,
      ].join(","));
    }
  }
  if (filas.length === 1) filas.push("Sin datos,0,,,,,,");
  binary.excel = await this.helpers.prepareBinaryData(
    Buffer.from("﻿" + filas.join("\r\n"), "utf8"),
    `expansion-leads-${fecha}.csv`,
    "text/csv"
  );
}

return [{
  json: {
    to: DEST,
    subject: asunto,
    html,
    total_leads: totalLeads,
    total_etiquetas: seccionesArr.length,
    con_excel: !!p.excel_base64,
  },
  binary,
}];
