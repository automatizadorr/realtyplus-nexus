# Camil-AI → CRM: captación automática de leads (Fase B)

Parche sobre el workflow **Camil-AI** de n8n (`ouf0maiCEFpDc60d`, 62 nodos, activo).
Cierra el circuito entre el bot de WhatsApp y el Pipeline del vendedor en el CRM Nexus:
cuando el bot escala una conversación a un humano, o cuando el lead agenda una reunión,
el lead queda marcado como "captado por el sistema IA" y entra al Pipeline en etapa
`contactado` en vez de quedarse muerto en la campaña.

Lo que consume este parche ya está en producción:

- Edge function `bot-handoff-vendedor` (Supabase, proyecto `owykkhwqpnumvgdeugmj`)
- RPC `bot_capta_lead` y columnas `leads_campana.escalado_ia_at` / `escalado_ia_motivo`
- Migración `supabase/migrations/20260907090000_captacion_ia_camil.sql`

El reparto de leads **sigue siendo manual**: esto no asigna vendedor. Deja el lead
marcado y en etapa `contactado` para que el admin lo reparta desde "Asignar leads".

---

---

## Estado

Los cinco parches están **aplicados** sobre el workflow vivo (2026-08-25): quedó
en 65 nodos y sigue activo. El secreto no viaja dentro del workflow: los dos
nodos HTTP usan el credential Header Auth `Nexus bot-handoff`
(`zLDkSgmw5BzyYKn9`), que lleva el header `x-webhook-secret`.

**Falta un paso, y es manual:** el valor de `BOT_HANDOFF_SECRET` en Supabase
(Edge Functions → Secrets) tiene que ser el mismo que quedó guardado en ese
credential. El valor original se perdió — los secretos de Edge Functions son de
solo escritura y el dashboard solo muestra un digest — así que hay que
sobrescribirlo. Hasta que eso pase, los dos nodos reciben `401 Unauthorized` y,
por el `onError: continueRegularOutput`, la conversación del bot sigue normal
pero el lead no se marca.

---
## 1. Nodo HTTP — escalación a humano — APLICADO 2026-08-25

Se cuelga de la salida **true** del IF `🚨 ¿Escalar a Humano?`, en paralelo a
`📥 Registrar Escalación (Supabase)`, `📧 Alerta Comercial (Gmail)` y
`📊 Marcar Escalado en Sheets`. No reemplaza a ninguno: la escalación sigue
avisando por correo y Sheets como siempre; esto es el paso que además mueve el
lead dentro del CRM.

`onError: continueRegularOutput` es deliberado: si la function está caída, la
conversación del bot con el lead no se puede cortar por eso.

```json
{
  "name": "🎯 Captar Lead en CRM (Nexus)",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [17168, 27100],
  "onError": "continueRegularOutput",
  "parameters": {
    "method": "POST",
    "url": "https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/bot-handoff-vendedor",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ telefono: $('WhatsApp Trigger1').item.json.contacts[0].wa_id, motivo: $('🧩 Parseador Nexus4').item.json.motivo_escalacion || 'sin_motivo_especificado', tipo: 'escalacion' }) }}",
    "options": { "timeout": 30000 }
  },
  "credentials": {
    "httpHeaderAuth": { "id": "zLDkSgmw5BzyYKn9", "name": "Nexus bot-handoff" }
  }
}
```

## 2. Nodo IF — ¿agendó reunión? — APLICADO 2026-08-25

El agendamiento **no** se puede detectar poniendo un nodo después del Google
Calendar: `Crea1`, `Modifica`, `Consulta` y `Disponibilidad` son *tools* del AI
Agent, no pasos del flujo, así que no tienen salida encadenable. Por eso el
agente declara el hecho en su JSON de respuesta (ver sección 4) y el parser lo
expone (sección 3).

Se cuelga de la salida principal de `🧩 Parseador Nexus4`, junto a
`Loop Over Items` y `🚨 ¿Escalar a Humano?`.

La condición sobre `message_index === 1` es la misma que usa el IF de escalación:
el parser emite un item por cada mensaje en que se parte la respuesta, así que sin
ese filtro la function se llamaría una vez por burbuja de WhatsApp.

```json
{
  "name": "📅 ¿Agendó reunión?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [16944, 27300],
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2 },
      "conditions": [
        {
          "id": "cond-reunion-true",
          "leftValue": "={{ $json.reunion_agendada }}",
          "rightValue": true,
          "operator": { "type": "boolean", "operation": "true", "singleValue": true }
        },
        {
          "id": "cond-reunion-primer-mensaje",
          "leftValue": "={{ $json.message_index }}",
          "rightValue": 1,
          "operator": { "type": "number", "operation": "equals" }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  }
}
```

## 3. Nodo HTTP — reunión agendada — APLICADO 2026-08-25

Va colgado de la salida **true** del IF anterior.

```json
{
  "name": "📅 Reunión al CRM (Nexus)",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [17168, 27460],
  "onError": "continueRegularOutput",
  "parameters": {
    "method": "POST",
    "url": "https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/bot-handoff-vendedor",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ telefono: $json.telefono, motivo: 'El lead agendó una reunión con Camil-AI', tipo: 'reunion' }) }}",
    "options": { "timeout": 30000 }
  },
  "credentials": {
    "httpHeaderAuth": { "id": "zLDkSgmw5BzyYKn9", "name": "Nexus bot-handoff" }
  }
}
```

## 4. Parche al nodo Code `🧩 Parseador Nexus4` — APLICADO 2026-08-25

Tres cambios, todos espejo de cómo ya se trata `escalar`:

1. Declarar `let reunion_agendada = false;` junto a `let escalar = false;`
2. En las dos ramas de parseo (el `try` con `JSON.parse` y el `catch` con
   `extractJson`), leer el campo: `reunion_agendada = Boolean(jsonData.reunion_agendada);`
   y `reunion_agendada = Boolean(extracted.reunion_agendada);`
3. Agregarlo al objeto que se emite, al lado de `escalar` y `motivo_escalacion`.

## 5. Parche al system prompt del `AI Agent1` — APLICADO 2026-08-25

Se agrega al final del bloque "⚠️ REGLA ANTI-BUCLE Y ESCALACIÓN":

```
📅 REUNIÓN AGENDADA (OBLIGATORIO):
En el MISMO turno en que confirmes al lead que su reunión quedó agendada — es decir,
el turno en que la herramienta 'Crea1' devolvió éxito — incluye además en tu JSON:
"reunion_agendada": true
Ese campo no lo ve el usuario: le avisa al CRM que este lead ya tiene cita y hay que
entregárselo a un vendedor. Va SOLO en ese turno; en los mensajes siguientes no lo
incluyas. Si 'Crea1' falló o todavía no la llamaste, NUNCA lo pongas en true.
```

## Cómo probarlo sin molestar a un lead real

1. Crear un lead de prueba en `leads_campana` con un teléfono propio.
2. Ejecutar el nodo HTTP a mano ("Test step") con ese teléfono.
3. Verificar en la base: `etapa_venta = 'contactado'`, `bot_activo = false`,
   `escalado_ia_at` con fecha, y una fila nueva en `leads_campana_etapa_log`
   con `user_id = NULL`.
4. En el CRM, el lead debe aparecer con el badge verde "Captado por IA" en el
   panel "Asignar leads" del admin.
5. Borrar el lead de prueba.

Una segunda llamada sobre el mismo teléfono es idempotente: responde
`ya_estaba_captado: true` y no pisa la fecha original.
