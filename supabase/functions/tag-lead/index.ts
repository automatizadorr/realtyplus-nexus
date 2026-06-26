// Llamada por n8n para asignar etiquetas automáticamente a un lead.
// Auth: header X-Webhook-Secret (mismo secreto que N8N_WEBHOOK_SECRET en n8n).
//
// Body:
//   telefono: string                 (requerido)
//   tag_nombres: string[]            (requerido) etiquetas a AÑADIR
//   mode?: "add" | "replace"         (default "add")
//       "add":     fusiona con las etiquetas existentes (sin duplicados)
//       "replace": reemplaza todas las etiquetas por tag_nombres
//   remove_tag_nombres?: string[]    etiquetas a QUITAR (se aplican siempre, al final)
//   grupo_exclusivo?: string         si se indica, antes de añadir quita las OTRAS
//                                    etiquetas del mismo grupo (estado único del lead)
//   solo_si_grupo_vacio?: boolean    si true y el lead ya tiene una etiqueta del
//                                    grupo_exclusivo, no hace nada (evita re-etiquetar)
//   crear_si_no_existe?: boolean     (default false) crea el lead si no se encuentra
//   nombre?, pais?, origen?          datos opcionales para el lead recién creado
//
// El match de nombres es insensible a mayúsculas y tildes (más robusto que el match exacto).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Normaliza: minúsculas, sin tildes, sin espacios sobrantes. Para comparar nombres.
const norm = (s: string) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Grupos de etiquetas mutuamente excluyentes (un lead tiene UN estado de ciclo de vida).
// Editable: si dos estados pueden coexistir, sácalos del grupo.
const GRUPOS_EXCLUSIVOS: Record<string, string[]> = {
  estado_lead: [
    "Sigue en campaña",
    "No interesa",
    "Agente asignado",
    "Pendiente asignar agente",
    "Solo quiere propiedades",
    "Cita agendada",
    "Sin respuesta clara",
  ],
  // Segmento de clasificación IA - WhatsApp (clasificar-whatsapp-ia). Un lead está en
  // UN segmento a la vez. OJO: "Cita agendada" y "No interesa" NO se incluyen aquí a
  // propósito: ya viven en estado_lead (mismo concepto, misma fila), así que el
  // clasificador los enruta por estado_lead y solo estos 7 se limpian entre sí. Así
  // asignar un segmento no borra el estado de ciclo de vida del lead, ni al revés.
  segmento_clasificacion: [
    "Lead Caliente",
    "Interesado en Financiamiento",
    "Listo para Cerrar",
    "Solo Consultando",
    "Requiere Seguimiento IA",
    "Conversación Activa",
    "Sin Respuesta al Bot",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WEBHOOK_SECRET = Deno.env.get("N8N_WEBHOOK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const incoming = req.headers.get("x-webhook-secret") ?? "";
    if (!WEBHOOK_SECRET || incoming !== WEBHOOK_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const telefono = (body?.telefono ?? "").toString().replace(/\D/g, "");
    const tag_nombres: string[] = Array.isArray(body?.tag_nombres) ? body.tag_nombres : [];
    const remove_tag_nombres: string[] = Array.isArray(body?.remove_tag_nombres) ? body.remove_tag_nombres : [];
    const mode: "add" | "replace" = body?.mode === "replace" ? "replace" : "add";
    const grupoExclusivo: string | null = typeof body?.grupo_exclusivo === "string" ? body.grupo_exclusivo : null;
    const soloSiGrupoVacio: boolean = body?.solo_si_grupo_vacio === true;
    const crearSiNoExiste: boolean = body?.crear_si_no_existe === true;

    if (!telefono) return json({ error: "telefono requerido" }, 400);
    if (tag_nombres.length === 0) {
      return json({ error: "tag_nombres requerido (array con al menos 1 elemento)" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Cargar TODAS las etiquetas y resolver por nombre normalizado (case/tilde-insensible).
    const { data: tags, error: tagsErr } = await supabase.from("lead_tags").select("id, nombre");
    if (tagsErr) throw tagsErr;
    const byNorm = new Map<string, string>(); // nombre_norm -> id
    for (const t of tags ?? []) byNorm.set(norm(t.nombre), t.id);

    const resolve = (nombres: string[]) => {
      const ids: string[] = [];
      const notFound: string[] = [];
      for (const n of nombres) {
        const id = byNorm.get(norm(n));
        if (id) ids.push(id);
        else notFound.push(n);
      }
      return { ids, notFound };
    };

    const add = resolve(tag_nombres);
    const remove = resolve(remove_tag_nombres);
    const notFound = [...new Set([...add.notFound, ...remove.notFound])];

    if (add.ids.length === 0) {
      return json({ error: `Etiquetas no encontradas en lead_tags: ${add.notFound.join(", ")}` }, 404);
    }

    // IDs del grupo exclusivo (los que hay que limpiar al asignar un estado nuevo).
    const grupoIds = grupoExclusivo
      ? (GRUPOS_EXCLUSIVOS[grupoExclusivo] ?? []).map((n) => byNorm.get(norm(n))).filter(Boolean) as string[]
      : [];

    // 2. Buscar el lead por teléfono (acepta variantes con sufijo JID de WhatsApp).
    let { data: lead, error: leadErr } = await supabase
      .from("leads_campana")
      .select("id, tag_ids")
      .or(`telefono.eq.${telefono},telefono.like.${telefono}@%`)
      .maybeSingle();
    if (leadErr) throw leadErr;

    // 2b. Crear el lead si no existe y así se solicitó (en vez de perder la etiqueta).
    if (!lead) {
      if (!crearSiNoExiste) {
        return json({ error: `Lead no encontrado para teléfono: ${telefono}` }, 404);
      }
      const insert = {
        telefono,
        nombre: (body?.nombre ?? "").toString().trim() || `Lead ${telefono}`,
        pais: body?.pais ?? null,
        origen: body?.origen ?? "auto-etiquetado",
        ha_respondido: true,
        tag_ids: [] as string[],
      };
      const { data: created, error: createErr } = await supabase
        .from("leads_campana")
        .insert(insert)
        .select("id, tag_ids")
        .single();
      if (createErr) throw createErr;
      lead = created;
    }

    const current: string[] = Array.isArray(lead.tag_ids) ? lead.tag_ids : [];

    // 2c. Si solo debe actuar cuando el grupo está vacío y ya hay un estado → no tocar.
    if (soloSiGrupoVacio && grupoIds.some((id) => current.includes(id))) {
      return json({
        success: true,
        skipped: true,
        reason: "El lead ya tiene un estado asignado (grupo no vacío)",
        lead_id: lead.id,
        telefono,
        tag_ids: current,
      });
    }

    // 3. Calcular el nuevo conjunto de etiquetas.
    let next = new Set<string>(mode === "replace" ? [] : current);

    // 3a. Limpiar el resto del grupo exclusivo antes de fijar el estado nuevo.
    if (grupoIds.length) {
      const addingFromGroup = add.ids.filter((id) => grupoIds.includes(id));
      if (addingFromGroup.length) for (const id of grupoIds) next.delete(id);
    }

    // 3b. Añadir las nuevas y quitar las que se pidió remover (remove gana).
    for (const id of add.ids) next.add(id);
    for (const id of remove.ids) next.delete(id);

    const newTagIds = [...next];

    const { error: updateErr } = await supabase
      .from("leads_campana")
      .update({ tag_ids: newTagIds })
      .eq("id", lead.id);
    if (updateErr) throw updateErr;

    return json({
      success: true,
      lead_id: lead.id,
      telefono,
      tag_ids: newTagIds,
      ...(notFound.length ? { warning: `Etiquetas ignoradas (no existen): ${notFound.join(", ")}` } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("tag-lead error:", msg);
    return json({ success: false, error: msg }, 500);
  }
});
