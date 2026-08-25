// Fase B del pipeline: Camil-AI (n8n) llama esto cuando capta un lead de
// leads_campana — o sea cuando la conversación se escala a un humano o
// cuando el lead agenda una reunión por Google Calendar.
//
// NO asigna vendedor automáticamente: el reparto sigue siendo 100% manual
// desde el panel "Asignar leads" del admin (decisión de Mario, ver
// [[project_nexus_pipeline_vendedor]]). Lo que sí hace, vía el RPC
// `bot_capta_lead`:
//   - marca el lead como captado por IA (escalado_ia_at / escalado_ia_motivo),
//     que es lo que pinta el badge "Captado por IA" en el CRM
//   - apaga bot_activo para que Camil-AI no le siga escribiendo
//   - lo sube a etapa "contactado" si seguía en "nuevo", y da por hecho el
//     primer contacto, así entra al Pipeline y no a la Bandeja
//   - deja el salto de etapa en leads_campana_etapa_log
//   - si el teléfono no estaba en leads_campana, CREA la ficha con
//     origen "whatsapp_inbound": un inbound que conversa y agenda ya no se
//     pierde por no venir de una campaña
//
// Si el lead ya tenía vendedor, aparece de inmediato en su Pipeline. Si no,
// queda "sin asignar" y marcado, esperando que el admin lo reparta — y al
// repartirlo conserva la etapa "contactado" (ver admin_asignar_leads).
//
// El aviso de la escalación al admin lo maneja aparte la rama "🚨 ¿Escalar a
// Humano?" del propio workflow (email + tabla escalaciones + Sheets); esto
// corre en paralelo, no la reemplaza.
//
// Auth: header X-Webhook-Secret (secreto dedicado BOT_HANDOFF_SECRET).
//
// Conectado desde el workflow "Camil-AI" (n8n, localhost:5678, id
// ouf0maiCEFpDc60d), en dos puntos:
//   - rama "🚨 ¿Escalar a Humano?" → nodo HTTP "🎯 Entregar a Vendedor (Nexus)",
//     en paralelo a "📥 Registrar Escalación"
//   - después del nodo de Google Calendar "Crea" (reunión agendada)
//
// Body:
//   telefono: string   (requerido) — mismo formato que usa el bot para el lead
//   motivo?: string    qué gatilló la captación; se muestra en la ficha del lead
//   tipo?: "escalacion" | "reunion"  solo define el motivo por defecto
//   nombre?: string    nombre del perfil de WhatsApp; se usa si hay que crear
//                      la ficha, o para rellenar un nombre vacío
//   pais?: string      opcional, si el workflow lo sabe
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MOTIVO_POR_TIPO: Record<string, string> = {
  escalacion: "Camil-AI escaló la conversación a un humano",
  reunion: "El lead agendó una reunión con Camil-AI",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("BOT_HANDOFF_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const incoming = req.headers.get("x-webhook-secret") ?? "";
    if (!WEBHOOK_SECRET || incoming !== WEBHOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const telefono = (body?.telefono ?? "").toString().replace(/\D/g, "");
    if (!telefono) return json({ error: "telefono requerido" }, 400);

    const tipo = typeof body?.tipo === "string" ? body.tipo.trim().toLowerCase() : "escalacion";
    const motivo = (typeof body?.motivo === "string" && body.motivo.trim())
      ? body.motivo.trim()
      : (MOTIVO_POR_TIPO[tipo] ?? MOTIVO_POR_TIPO.escalacion);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const nombre = typeof body?.nombre === "string" ? body.nombre.trim().slice(0, 120) : null;
    const pais = typeof body?.pais === "string" ? body.pais.trim().slice(0, 60) : null;

    const { data, error } = await supabase.rpc("bot_capta_lead", {
      _telefono: telefono,
      _motivo: motivo,
      _nombre: nombre,
      _pais: pais,
    });
    if (error) throw error;

    // Desde que el RPC crea la ficha si no existe, cero filas ya no es un
    // caso esperable: significa que algo salió mal de verdad.
    const r = (data ?? [])[0];
    if (!r) {
      return json({ success: false, error: `No se pudo captar el lead con teléfono: ${telefono}` }, 500);
    }

    return json({
      success: true,
      lead_id: r.lead_id,
      vendedor_id: r.vendedor_id,
      // true = ya venía marcado de una captación anterior; la llamada es
      // idempotente y no pisa la fecha original.
      ya_estaba_captado: r.ya_estaba,
      // creado = no existía y se abrió ficha nueva (inbound fuera de campaña).
      // revivido = existía pero estaba archivado y se volvió a poner en juego.
      creado: r.creado,
      revivido: r.revivido,
      etapa_anterior: r.etapa_anterior,
      etapa: r.etapa_nueva,
      sin_asignar: !r.vendedor_id,
      motivo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("bot-handoff-vendedor error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
