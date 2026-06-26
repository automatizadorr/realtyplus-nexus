// ============================================================
//  Nodo "Construir Reporte HTML" — Clasificación IA leads nuevos
//  Transforma el payload de /etiquetas-leads-nuevos (enviado por la
//  Edge Function cron-clasificacion-ia) en un correo HTML de expansión,
//  agrupado por etiqueta, con el RESUMEN IA y la conversación de cada lead.
//  Modo de ejecución: "Run Once for All Items".
//
//  Payload esperado:
//   { evento, timestamp, ventana_horas, leads_clasificados,
//     leads: [{ lead_id, nombre, telefono, etiqueta, resumen,
//               mensajes: [{ rol: "lead"|"agente", texto }] }] }
// ============================================================

// ── CONFIGURACIÓN (editar estas líneas) ─────────────────────
const DEST = "expansion@realtyplus.es";          // <-- CORREO DE EXPANSIÓN (cámbialo)
const LOGO = "https://realtyplus-nexus.vercel.app/realtyplus-logo.png";
const NAVY = "#003366";
const RED  = "#cc0000";
// ────────────────────────────────────────────────────────────

// Colores por etiqueta (mismos del catálogo lead_tags).
const COLORS = {
  "Lead Caliente": "#ef4444",
  "Cita agendada": "#8b5cf6",
  "Interesado en Financiamiento": "#10b981",
  "Listo para Cerrar": "#f97316",
  "Solo Consultando": "#3b82f6",
  "Requiere Seguimiento IA": "#eab308",
  "Conversación Activa": "#06b6d4",
  "Sin Respuesta al Bot": "#94a3b8",
  "No interesa": "#6b7280",
};

// El webhook entrega el cuerpo en .json.body; si llega plano, usar .json
const p = ($input.first().json && $input.first().json.body) || $input.first().json || {};
const leads = Array.isArray(p.leads) ? p.leads : [];

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/\n/g, "<br>");

const hoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

// ── Agrupar leads por etiqueta ──────────────────────────────
const grupos = {};
for (const l of leads) {
  const k = (l.etiqueta || "Sin etiqueta").toString();
  (grupos[k] = grupos[k] || []).push(l);
}
const nombresOrden = Object.keys(grupos).sort((a, b) => a.localeCompare(b, "es"));

// ── Tarjeta de un lead (resumen + conversación) ─────────────
const buildLead = (l) => {
  const msgs = Array.isArray(l.mensajes) ? l.mensajes : [];
  const bubbles = msgs.map((m) => {
    const out = (m.rol === "agente" || m.rol === "agent" || m.rol === "assistant");
    const txt = esc((m.texto || m.contenido || "").trim());
    return `<div class="brow ${out ? "o" : "i"}"><div class="bub ${out ? "bo" : "bi"}"><div class="bx">${txt || "<em style='opacity:.4'>—</em>"}</div></div></div>`;
  }).join("");

  const color = COLORS[l.etiqueta] || NAVY;
  return `<div class="lead">
    <div class="lhd">
      <div class="lav" style="background:${color}">${esc((l.nombre || "?").charAt(0).toUpperCase())}</div>
      <div class="lin">
        <div class="lnm">${esc(l.nombre || "Sin nombre")}</div>
        <div class="lmt">📱 ${esc(l.telefono || "")}${l.lead_id ? ` · ID ${esc(l.lead_id)}` : ""}</div>
      </div>
    </div>
    ${l.resumen ? `<div class="res"><b>🧠 Resumen IA:</b> ${esc(l.resumen)}</div>` : ""}
    ${msgs.length ? `<div class="chd">💬 ${msgs.length} mensajes</div><div class="cha">${bubbles}</div>` : `<div class="nom">Sin mensajes registrados</div>`}
  </div>`;
};

// ── Secciones por etiqueta ──────────────────────────────────
const secciones = nombresOrden.map((nombre) => {
  const ls = grupos[nombre];
  const color = COLORS[nombre] || NAVY;
  return `<div class="tag">
    <div class="thd" style="border-left:5px solid ${color}">
      <span class="tdot" style="background:${color}"></span>
      <span class="ttl">${esc(nombre)}</span>
      <span class="tpill" style="background:${color}1a;color:${color}">${ls.length} leads</span>
    </div>
    <div class="tbd">${ls.map(buildLead).join("")}</div>
  </div>`;
}).join("");

// ── HTML final (marca RealtyPlus) ───────────────────────────
const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clasificación IA de leads nuevos — ${hoy}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#eef1f5;color:#1f2937;font-size:13px;line-height:1.5}
.wrap{max-width:820px;margin:0 auto;background:#fff}
.ph{background:#fff;border-bottom:4px solid ${RED};padding:22px 28px;text-align:center}
.ph img{height:54px;width:auto}
.ph h1{font-size:18px;color:${NAVY};margin-top:12px;font-weight:700}
.ph p{color:#6b7280;font-size:12px;margin-top:4px}
.kpis{display:flex;flex-wrap:wrap;gap:10px;padding:18px 28px;background:${NAVY}}
.kpi{flex:1;min-width:120px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:14px;text-align:center}
.kpi b{display:block;font-size:24px;color:#fff}.kpi small{font-size:10px;color:#c7d2e0;text-transform:uppercase;letter-spacing:.5px}
.main{padding:20px 28px 36px}
.tag{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:18px;overflow:hidden}
.thd{display:flex;align-items:center;gap:10px;padding:13px 16px;background:#f8fafc}
.tdot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.ttl{font-size:15px;font-weight:700;color:${NAVY};flex:1}
.tpill{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}
.tbd{padding:12px}
.lead{background:#fff;border:1px solid #eef1f5;border-radius:9px;margin-bottom:10px;overflow:hidden}
.lhd{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fbfcfe}
.lav{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0}
.lin{flex:1;min-width:0}
.lnm{font-size:14px;font-weight:700;color:#111827}
.lmt{font-size:11px;color:#6b7280;margin-top:2px}
.res{padding:9px 14px;font-size:12px;color:#374151;background:#fffbeb;border-top:1px solid #fef3c7}.res b{color:#b45309}
.nom{padding:12px 14px;color:#cbd5e1;font-style:italic}
.chd{padding:8px 14px;background:${NAVY};color:#fff;font-size:11px;font-weight:600}
.cha{background:#f6f8fb;padding:12px 14px}
.brow{display:flex;margin-bottom:7px}.brow.o{justify-content:flex-end}.brow.i{justify-content:flex-start}
.bub{max-width:74%;padding:7px 11px;border-radius:11px;word-break:break-word}
.bo{background:${NAVY};color:#fff;border-bottom-right-radius:2px}
.bi{background:#fff;color:#1f2937;border:1px solid #e2e8f0;border-bottom-left-radius:2px}
.bx{font-size:12px}
.ft{text-align:center;padding:16px;color:#9ca3af;font-size:10px;border-top:1px solid #eef1f5}
</style></head><body><div class="wrap">
<div class="ph"><img src="${LOGO}" alt="RealtyPlus — Servicios Inmobiliarios"><h1>Clasificación IA de leads nuevos</h1><p>Generado el ${hoy} · ${leads.length} leads · ${nombresOrden.length} etiquetas · ventana ${esc(p.ventana_horas || 24)}h</p></div>
<div class="kpis">
  <div class="kpi"><b>${leads.length}</b><small>Leads clasificados</small></div>
  <div class="kpi"><b>${nombresOrden.length}</b><small>Etiquetas</small></div>
  <div class="kpi"><b>${esc(p.ventana_horas || 24)}h</b><small>Ventana</small></div>
</div>
<div class="main">${secciones || '<div class="nom">No hay leads clasificados en este envío.</div>'}</div>
<div class="ft">RealtyPlus · Servicios Inmobiliarios · Generado automáticamente por RealtyPlus Nexus · ${hoy}</div>
</div></body></html>`;

const asunto = `📋 RealtyPlus — Clasificación IA de leads nuevos · ${leads.length} leads · ${hoy}`;

// Adjunto .html de fidelidad total
const fileName = `clasificacion-leads-${new Date().toISOString().slice(0, 10)}.html`;
const binary = { reporte: await this.helpers.prepareBinaryData(Buffer.from(html, "utf-8"), fileName, "text/html") };

// Adjunto Excel (.xlsx) si la edge function lo incluyó en el payload (excel_base64).
// Misma lógica que la exportación de reactivación (TaggedExport): 2 hojas.
if (p.excel_base64) {
  binary.excel = await this.helpers.prepareBinaryData(
    Buffer.from(p.excel_base64, "base64"),
    p.excel_filename || `leads-clasificados-${new Date().toISOString().slice(0, 10)}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

return [{
  json: {
    to: DEST,
    subject: asunto,
    html,
    total_leads: leads.length,
    total_etiquetas: nombresOrden.length,
    con_excel: !!p.excel_base64,
  },
  binary,
}];
