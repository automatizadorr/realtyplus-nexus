# Flujo Sofía WhatsApp (Parte 2 — Inbound + Acuses) — Auditoría y Mejoras

> Documento generado el 2026-07-06. Analiza el flujo n8n de Sofía (respuesta IA a WhatsApp,
> buffer/debounce, clasificación reactivación/oportunidad, agenda Calendar y acuses).
> **Antes de importar cambios: es un flujo en producción. Aplica los P0 con calma y prueba con el `pinData`.**

---

## 0. Resumen ejecutivo

| # | Severidad | Hallazgo | Impacto en acuses/semáforo |
|---|-----------|----------|-----------------------------|
| P0-1 | 🔴 Alta | La conversación de **reactivación** queda partida entre 2 tablas: el inbound va a `mensajes_whatsapp` pero el outbound va a `mensajes_automatizacion`. | El semáforo comercial de reactivación nunca ve las respuestas de Sofía. |
| P0-2 | 🔴 Alta | Cluster **huérfano / código muerto**: `Wait5 → Loop Over Items3 → ¿Reactivación? → Create a row1 / Registrar en Supabase → Wait5`. Es un ciclo cerrado sin entrada; **nunca se ejecuta**. | Ahí vivía la lógica "correcta" de logging outbound por tabla. Por eso todo cae en `mensajes_automatizacion`. |
| P0-3 | 🔴 Alta | Los **acuses solo actualizan `mensajes_automatizacion`**. Los mensajes guardados en `mensajes_whatsapp` nunca reciben `sent/delivered/read`. | Los checks de WhatsApp no aparecen en la mitad de las conversaciones. |
| P1-1 | 🟠 Media | **Secretos hardcodeados** en los nodos HTTP (`x-webhook-secret` y `Bearer` JWT anon). | Riesgo de seguridad; rotar el webhook-secret. |
| P1-2 | 🟠 Media | El evento de **acuse también entra a `Switch2`** (doble camino desde el Trigger). Funciona por suerte, pero es frágil. | Ruido; un cambio en Switch2 puede procesar acuses como si fueran mensajes. |
| P2-1 | 🟡 Baja | Nodos con `onError: continueErrorOutput` cuya **rama de error no está conectada** (`Registrar en Supabase`, `Guardar Mensaje Oportunidades WAMID`). | Errores silenciosos. |
| P2-2 | 🟡 Baja | `📩 Actualizar Estado (Acuse)` no guarda **timestamp de leído** ni distingue `failed`. | Semáforo sin marca temporal ni estado de error. |

---

## 1. Cómo corre HOY el flujo (traza real, no la de las notas)

Las sticky notes describen el diseño *deseado*, pero la ejecución real es distinta por el cluster muerto (P0-2). Traza efectiva:

**Entrada**
- `WhatsApp Trigger1` → **dos** salidas en paralelo: `Switch2` y `🔔 ¿Es acuse de WhatsApp?`.
- Si el evento trae `statuses[0].id` → acuse → `📩 Actualizar Estado (Acuse)` (solo `mensajes_automatizacion`).
- Si trae `messages` → `Switch2` → texto → buffer.

**Buffer / debounce** (Redis) → `🧩 Combinar Buffer` → `Get row(s) in sheet1`.

**Clasificación**
- `Switch` (por `TELEFONO` del sheet):
  - `en_hoja` → `Edit Fields2` → **inbound se guarda en `mensajes_whatsapp`** (`Create a row4`) + alimenta `AI Agent1`.
  - `extra` (fallback) → `Edit Fields5` → **inbound se guarda en `mensajes_automatizacion`** (`Leads Nuevos - Respuesta IA2`, edge fn) + alimenta `AI Agent1`.

**IA** → `AI Agent1` (DeepSeek + Gemini fallback, memoria Postgres, RAG Supabase, tools Calendar).

**Parseo + envío**
- `🧩 Parseador Nexus4` → `Loop Over Items2` → `Set Número` → `Send message1` → **`Guardar Mensaje Oportunidades WAMID`** (guarda `wamid` en `mensajes_automatizacion`) → `Wait3` → loop.
- 👉 **Aquí está el problema**: *todo* el outbound (reactivación **y** oportunidad) termina en `mensajes_automatizacion`, porque este es el único camino vivo.

**Cluster muerto** (nunca corre): `Wait5 / Loop Over Items3 / ¿Reactivación? (outbound) / Create a row1 / Registrar en Supabase`. Ahí estaba el enrutado correcto por tabla, pero ningún nodo externo entra al ciclo.

**Reserva** → `🧩 Parseador Nexus1` → `¿Hay Reserva?1` → `Ejecutar Reserva (Standard)` → email a expansión.

### Consecuencia para el semáforo
Una conversación de **reactivación** queda así:
- Inbound del lead → `mensajes_whatsapp` ✅
- Respuesta de Sofía → `mensajes_automatizacion` ❌ (debería ir a `mensajes_whatsapp`)

El hilo se rompe y los acuses de esa respuesta (que sí guarda `wamid`) actualizan la tabla equivocada.

---

## 2. Plan de arreglo (P0) — mínimo, seguro e importable

La idea: **etiquetar cada mensaje con su tabla destino desde la clasificación y arrastrar esa etiqueta hasta el logging y el acuse.** Sin resucitar el cluster muerto.

### Paso 1 — Propagar `es_reactivacion` y `tabla` en el parseo

En `🧩 Parseador Nexus4`, dentro del `for`, al construir cada `newItems.push({ json: {...} })`, añade el origen:

```js
// arriba del for, junto a telefonoFinal:
let esReactivacion = false;
try {
  esReactivacion = !!$('Get row(s) in sheet1').first().json.TELEFONO;
} catch (e) { esReactivacion = false; }
const tablaDestino = esReactivacion ? 'mensajes_whatsapp' : 'mensajes_automatizacion';

// ...dentro del push, agrega estos dos campos:
        es_reactivacion: esReactivacion,
        tabla_destino: tablaDestino,
```

### Paso 2 — Enrutar el logging outbound por tabla (reemplaza a `Guardar Mensaje Oportunidades WAMID`)

Después de `Send message1`, en vez de un único insert a `mensajes_automatizacion`, mete un **IF** `¿Reactivación? (send)`:

- Condición: `{{ $('🧩 Parseador Nexus4').item.json.es_reactivacion }}` es `true`.
- **true** → nuevo Supabase insert a `mensajes_whatsapp` con:
  - `telefono` = `{{ $json.telefono }}`
  - `direccion` = `outbound`
  - `contenido` = `{{ $('🧩 Parseador Nexus4').item.json.text_to_send }}`
  - `wamid` = `{{ $json.messages[0].id }}`  ← id devuelto por `Send message1`
  - `estado_envio` = `sent`
- **false** → tu `Guardar Mensaje Oportunidades WAMID` actual (ya guarda `wamid` en `mensajes_automatizacion`); añádele también `estado_envio = sent`.

> ⚠️ Requisito de esquema: `mensajes_whatsapp` debe tener columnas `wamid` y `estado_envio`.
> Si tu SQL de hoy ya las agregó, listo. Si no, corre:
> ```sql
> alter table public.mensajes_whatsapp
>   add column if not exists wamid text,
>   add column if not exists estado_envio text default 'sent',
>   add column if not exists leido_at timestamptz;
> create index if not exists idx_mensajes_whatsapp_wamid on public.mensajes_whatsapp(wamid);
> ```

### Paso 3 — Que el acuse actualice AMBAS tablas

`🔔 ¿Es acuse de WhatsApp?` (true) hoy va solo a `📩 Actualizar Estado (Acuse)` (tabla `mensajes_automatizacion`). Duplica ese nodo:

- **`📩 Actualizar Estado (mensajes_automatizacion)`** — el actual, sin cambios de filtro:
  - filtro `wamid eq {{ $json.statuses[0].id }}`, set `estado_envio = {{ $json.statuses[0].status }}`
- **`📩 Actualizar Estado (mensajes_whatsapp)`** — nuevo, mismo filtro pero tabla `mensajes_whatsapp`:
  - filtro `wamid eq {{ $json.statuses[0].id }}`, set `estado_envio = {{ $json.statuses[0].status }}`
  - opcional: set `leido_at = {{ $json.statuses[0].status === 'read' ? $now.toISO() : null }}`

Como el filtro es por `wamid` (único), cada acuse solo actualiza la fila que existe; en la otra tabla es un no-op inofensivo. Conéctalos en paralelo desde el `true` del IF.

Con esto: **reactivación y oportunidad quedan cada una completa en su tabla, con acuses `sent/delivered/read/failed` en ambas.**

---

## 3. Limpieza recomendada (P0-2 / P1 / P2)

1. **Borra el cluster muerto**: `Wait5`, `Loop Over Items3`, `¿Reactivación? (outbound)`, `Create a row1`, `Registrar en Supabase`. Ya no aporta nada (su función la absorben los pasos 1–2). Elimina también sus conexiones. *Verifica antes que ningún otro nodo dependa de ellos — según la traza, no.*

2. **Seguridad (P1-1)**: mueve `x-webhook-secret` y el `Bearer`/`apikey` a **credenciales n8n** (Header Auth) o variables de entorno, no en el nodo. El `anon` JWT es de rol público (bajo riesgo), pero **rota `rpchile_cron_2026_a8K3mZqL`** porque quedó expuesto en el export/chat y es lo que protege la edge function `log-auto-message`.

3. **Routing acuse (P1-2)**: idealmente `WhatsApp Trigger1` → `🔔 ¿Es acuse?` primero; su rama **false** → `Switch2`. Así los eventos de estado no entran al pipeline de mensajes.
   - ⚠️ Ojo: los **errores de pago** llegan como `statuses[...]` y hoy los captura `Switch2` (regla 3 → `Send a message4`). Si reordenas, mueve esa detección dentro de la rama de acuse (un IF extra: si `statuses[0].errors` existe → email de saldo; si no → update de estado). No lo hagas sin probarlo.

4. **Ramas de error (P2-1)**: los nodos con `onError: continueErrorOutput` (`Registrar en Supabase` —si lo conservaras—, `Guardar Mensaje Oportunidades WAMID`, `AI Agent1`) deben tener su segunda salida conectada (aunque sea a un `NoOp` o a un email de aviso). Hoy `Guardar Mensaje Oportunidades WAMID` tiene `continueErrorOutput` sin rama → si Supabase falla, se corta silencioso.

5. **Semáforo temporal (P2-2)**: guarda `leido_at`/`entregado_at` en el acuse para que el semáforo comercial distinga "enviado" vs "leído hace 2h" vs "leído recién".

---

## 4. Checklist de verificación (con el pinData)

1. Import del flujo → abrir `WhatsApp Trigger1` con su `pinData` (lead `59167027500`, "Quisiera más información?").
2. Ejecutar hasta `Send message1` → confirmar `messages[0].id` (wamid) presente.
3. Confirmar que el insert cayó en la tabla correcta según `es_reactivacion`.
4. Simular un acuse: payload con `statuses[0] = { id: <ese wamid>, status: "read" }` → confirmar que `estado_envio` pasa a `read` en la tabla correcta.
5. Repetir con un teléfono **fuera** del sheet (oportunidad) → debe caer todo en `mensajes_automatizacion`.

---

## 5. Nota sobre "entregar el JSON ya importable"

No reescribí el JSON completo automáticamente **a propósito**: es un flujo vivo y varios cambios (borrar el cluster, reordenar el Trigger, mover secretos) son decisiones que conviene que confirmes antes de tocar producción. Los pasos 1–3 (P0) son los seguros y de mayor impacto para tus acuses.

👉 Si me dices **"aplica los P0 al JSON"**, te devuelvo el workflow completo ya parcheado y listo para importar (con placeholders en los secretos, no el valor real).
