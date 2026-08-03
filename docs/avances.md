# Avances — RealtyPlus Nexus

Registro de cambios y decisiones clave. Lo más reciente arriba.

---

## 2026-08-03

### Fase 4.1 — Remanentes Fase 4 + {{pais}} en la vista previa
`send-personalized-campaign` y `cron-secuencias-correo` pasaron a usar `TZ`/`pickPais`
compartidos (antes tenían literales locales). `src/lib/correosVariables.ts` ahora
también resuelve `{{pais}}`, para que la vista previa muestre lo mismo que el correo real.

### Secuencia de Servicios Completos · Todo en uno (correos)
Nueva plantilla y embudo automático que presenta el ecosistema LexHouse completo:
software a medida, IA, CRM inmobiliario, agentes de voz IA, marketing digital,
prospección, reactivación de leads y generador de videos para inmobiliarias.

- **Plantilla** `servicios-todo-en-uno` en `src/lib/emailCopys.ts` (categoría
  "Servicios completos (todo en uno)") con regalo (autodiagnóstico) y CTA a
  **lexhouse-ai.com** como carta de presentación.
- **Secuencia SQL** (`20260805090000_secuencia_servicios_completos.sql`, id
  `...000006`): 3 correos en 6 días — ecosistema completo, reactivación de
  clientes, y cierre invitando a la demo/web. Cada paso regala una guía.

### Fase 4 — Helpers compartidos de correo (refactor)
Se creó `supabase/functions/_shared/correo.ts` con los helpers que vivían duplicados
en las 3 edge functions de correo: `pickPais`, `fillTemplate`, `zonedToUtc`, `esc`,
`HORA_RE`, `TZ`, `LIMITE_DIA` y `corsHeaders`.

- **send-personalized-campaign**, **cron-secuencias-correo** y **programar-secuencia**
  ahora importan desde `_shared/correo.ts` → la resolución de `{{variables}}` es
  idéntica en los tres.

---

## 2026-06-25

### Campaña para NUEVOS LEADS (n8n)
Flujo: webhook `camapañas_segmentadas` → `Preparar Leads2` → `Loop Leads1` (batch 1) →
genera mensaje → **WhatsApp Template `nuevos_leads_|es`** → en éxito loguea a
`/automatizacion inbox` y Sheet; en error manda un email HTML de fallback al lead.
Ambas ramas vuelven al loop (no se frena).

- ⚠️ **El WhatsApp no se entrega aunque la API diga "success" → falta método de pago en
  Meta** (error `131042`). El flujo está OK; falta resolver el pago en WhatsApp Manager.
- El número debe ir con código de país completo (`+56971806730`, no `971806730`).
- El template `nuevos_leads_` debe estar **APROBADO** en Meta.

### `log-auto-message` (Edge Function)
Inserta en `mensajes_automatizacion` con **service role** (gateada por `x-webhook-secret`).
Necesaria porque el RLS exige rol admin para insertar ahí y a `anon` se le revocó el
INSERT; el nodo Supabase de n8n (anon key) ya no podía escribir → la sección
**/automatizacion inbox** quedaba vacía. El nodo de n8n se reemplazó por un HTTP Request
a esta función.

### Scanner — orden de columnas
`src/pages/Scanner.tsx` ahora parsea en orden **id, nombre, teléfono, correo, país**
(acepta separador TAB o coma). Antes esperaba `id|nombres|apellidos|email|telefono|pais`.

### Landing rediseñada (`src/pages/Index.tsx`)
Muestra las funciones reales (inbox, iSabel IA, etiquetado, campañas, scanner, VoiceCRM,
exportar, reporte 08:00). Héroe = conversación de WhatsApp que se auto-clasifica.
**Paleta RE/MAX (azul `#003DA5` + rojo `#DC1C2E` + blanco)**; verde solo en contexto
WhatsApp. Se quitaron datos inventados (500+ inmobiliarias, testimonios, SOC 2).
> **PENDIENTE:** seguir mejorando la landing — es la **fuente de los nuevos leads** que
> alimentan la campaña de WhatsApp.

### Fix: recarga al cambiar de pestaña (se perdían datos)
`use-is-admin.ts` + `App.tsx`. Al volver el foco, Supabase refresca el token → nuevo
objeto `user` → `useIsAdmin` (dep `[user]`) se re-ejecutaba → `AdminRoute` mostraba su
spinner y **desmontaba la página**, perdiendo lo escrito. Fix: depender de **`user?.id`**
(estable) + `refetchOnWindowFocus:false`. Patrón a vigilar: `useEffect` con dep `[user]`.

### Inbox normal — conversaciones sin lead (DEFERIDO)
`ensure-lead` (auto-crea el lead) + migración `vista_inbox_join_normalizado` (join
lead↔mensajes por dígitos). Desplegado, pero **pendiente** de correr el SQL y cablear el
nodo en n8n (Mario lo dejó para más adelante).

---

## 2026-06-24

### Etiquetado IA + envío consolidado a expansión
- `cron-etiquetado-ia`: por defecto SOLO etiqueta (acumula en `leads_campana.tag_ids`),
  ya no postea fragmentado. El envío REAL hay que correrlo en tandas de ≤20
  (`max_leads:20` + `offset`) por el límite de recursos de la Edge Function (error 546).
- Etiquetas: no-respondió → `Sigue en campaña` (no va a expansión); respondió sin
  intención clara → `Sin respuesta clara` (sí va).
- **`enviar-expansion`** (Edge Function) + pg_cron `'0 6,7 * * *'` con `hora_madrid:8`:
  manda el reporte consolidado a jefatura **cada día a las 08:00 de Madrid** (a prueba de
  horario de verano).

### Webhook de campañas — typo del path
El webhook n8n real está en `/webhook/camapañas_segmentadas` ("camApañas", con 'a'
extra). El proxy `send-n8n-webhook` (target `campanas_segmentadas`) debe apuntar a ese
typo o no llega nada.
