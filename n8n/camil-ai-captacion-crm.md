# Sofía / Camil-AI → CRM: captación automática de leads (Fase B)

Parche sobre el workflow **Sofía** de n8n (`ouf0maiCEFpDc60d`, activo).
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

## Los dos workflows: cuál es cuál

En el n8n local hay dos bots activos, cada uno sobre **su propia cuenta de Meta**
(no compiten por el mismo número, así que los dos se quedan encendidos):

| id | nombre | agente | credencial WhatsApp | nodos |
|---|---|---|---|---|
Para qué es cada uno, los dos de LexHouse: **Sofía** es el sistema de
activación y reactivación de LexHouse Nexus; **Camil-AI** atiende el WhatsApp
de las landings del ecosistema.

| `ouf0maiCEFpDc60d` | **Sofía** | **Sofía**, timezone Santiago, tool `Crea1`, parseador v2 | trigger `RealtyPLus-AI` / envío `RealtyPlus- enviar Mensaje` (phoneNumberId fijo `1070824479455864`) | 65 |
| `2oKGpZR85DFAr4R6` | Meta - LexHouse Camil-AI | **Camil-AI**, timezone Santiago, tool `Reserva`, parseador v3 | trigger `AI-MAX` / envío `AI-MAX - ENVIAR MENSAJE` (responde al número por el que entró) | 51 |

**`ouf0maiCEFpDc60d` es el sistema de IA de LexHouse Nexus: ahí van TODAS las
actualizaciones del CRM.** Tiene el parche completo — escalación, movimientos de
reunión, `reunion_estado` en el parseador y en el prompt.

**En el flujo de Meta va solo la escalación.** Decisión de Mario: se le quitó
todo lo de agendamiento (los nodos `📅 ¿Movimiento de reunión?` y
`📅 Reunión al CRM (Nexus)`, el bloque de reunión del prompt del agente y los
campos `reunion_estado`/`reunion_agendada` del parseador v3). Lo que conserva es
`🎯 Captar Lead en CRM (Nexus)`, colgado de su IF de escalación junto a
`📧 Alerta Comercial (Gmail)` y `📱 Notificar Operador WhatsApp`.

Notas al parchear el de Meta, por si hay que volver a tocarlo: su trigger se
llama `WhatsApp Trigger` (sin el `1`), y su parseador v3 tiene cuatro ramas de
parseo, una de las cuales asigna `escalar` dos veces.

### Renombre de los agentes (2026-08-25)

Los nombres se cruzaron a propósito, por decisión de Mario:

- `ouf0maiCEFpDc60d`: el agente pasó de llamarse Camil-AI a **Sofía** (mismo
  nombre que la agente del chat web de lexhouse-ai.com, edge function
  `sofia-chat`, aunque son motores distintos), y su zona horaria pasó de Madrid
  a **Santiago de Chile**. Se cambiaron el `setZone` del prompt y de los dos
  Gmail, la etiqueta "(Zona horaria de …)", los ejemplos ISO `+02:00` → `-04:00`
  (incluidos los del tool `Crea1`) y la gramática al femenino ("la Asesora
  Comercial", "especializada"). Las 9 apariciones de "Madrid" eran todas de zona
  horaria — ninguna del mercado español — así que se cambiaron todas.
  El workflow también se renombró a `Sofía`: eso cambia lo que se guarda en
  `escalaciones.workflow_name` de las filas nuevas.
- `2oKGpZR85DFAr4R6`: el agente pasó de LeyIA a **Camil-AI** (14 apariciones:
  prompt, Gmail de escalación, WhatsApp al operador, Gmail de error y dos notas
  del canvas). El nombre del workflow se dejó igual.

### Por qué la escalación no disparaba (2026-08-25)

El nodo de captación colgado del IF de escalación nunca corría, en ninguno de
los dos flujos. No era la infraestructura: en todas las ejecuciones el
parseador devolvía `escalar: false` con `_parse_source: json_direct`, o sea el
JSON del agente llegaba bien formado y el modelo simplemente no activaba la
bandera.

La causa estaba en el prompt. El bloque "REGLA ANTI-BUCLE Y ESCALACIÓN" solo
daba **una** condición para escalar — repetir la misma pregunta ≥3 veces o
pasar 8 turnos sin cita — y después listaba `solicitud_humana`,
`alta_intencion_cerrar`, `cliente_molesto` y `caso_complejo` como *valores
válidos* de `motivo_escalacion`, **sin decir nunca cuándo usarlos**. Si el lead
pedía hablar con una persona, el agente no cumplía ninguna condición y seguía
conversando.

El bloque se reemplazó en los dos prompts por uno donde **cada motivo trae su
condición explícita**, más las reglas de que el mensaje visible no mencione
sistemas internos, que se escale una sola vez por conversación, y que ante la
duda se escale.

Para probarlo: escribirle al bot "quiero hablar con una persona". Debe
responder que un asesor lo contactará y, en la ejecución, el parseador tiene que
mostrar `escalar: true` con `motivo_escalacion: "solicitud_humana"`.

### Agendamiento en Sofía: la credencial de Calendar (2026-08-25)

Con la escalación ya funcionando, agendar seguía fallando: `Disponibilidad`
devolvía `notFound`. No era la zona horaria ni el prompt.

Los cinco nodos de calendario de Sofía apuntaban al calendario
`realtyplus.leads@gmail.com`, y la única credencial que lo alcanzaba
(`calendar realty- plus`) llevaba **desconectada desde el 9 de julio**
("Access could not be refreshed because the connected account…"). Al cambiarla
por `automatizador`, la autenticación pasaba pero Google seguía respondiendo
`notFound`: esa cuenta no ve ese calendario.

Se comprobó consultando qué calendarios alcanza cada credencial (endpoint
`/rest/dynamic-node-parameters/resource-locator-results`): `automatizador` y
`calrndar` son la **misma cuenta** y solo ven `automatizador.ex@gmail.com` más
los feriados de Chile.

Decisión de Mario: se abandona la cuenta de RealtyPlus. La credencial
`calendar realty- plus` se **eliminó** — la referenciaban 6 workflows, todos
inactivos (Isabel AI, los agendadores viejos, "whatsapp full"); si alguno se
reactiva hay que reasignarle credencial. Los cinco nodos de Sofía
(`Crea1`, `Disponibilidad`, `Modifica`, `Consulta`, `Cancela`) quedaron
apuntando a `automatizador.ex@gmail.com`.

**Calendario unificado.** Los 10 nodos de calendario de los dos flujos (5 y 5)
usan el mismo calendario `automatizador.ex@gmail.com` con la credencial
`automatizador`, que quedó como la única de Google Calendar: también se eliminó
`calrndar`, duplicada de la misma cuenta, que usaban 3 workflows inactivos
(`cazador realty-plus`, `aguas don benjamin`, `REALTYPLUS IA`).

Mario descartó un calendario dedicado: no hace falta, los dos sistemas son de
LexHouse. Compartir agenda además evita que los dos agentes agenden encima del
mismo bloque.

Si alguno de los 9 workflows inactivos que referenciaban las credenciales
borradas se reactiva, hay que reasignarle credencial de calendario a mano.

## Estado

Aplicado sobre los dos workflows vivos (2026-08-25): `ouf0maiCEFpDc60d` en 65
nodos con el parche completo, y `2oKGpZR85DFAr4R6` en 51 nodos solo con la
escalación. Ambos activos. El secreto no viaja dentro del workflow: los dos
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

## Movimientos de reunión: agendar, reagendar y cancelar

El contrato con el agente es **un solo campo**, `reunion_estado`, con tres
valores: `"agendada"` | `"modificada"` | `"cancelada"`. Se declara en el turno
en que la herramienta de calendario correspondiente (`Crea1`/`Reserva`,
`Modifica`, `Cancela`) devolvió éxito. Reemplaza al booleano
`reunion_agendada` de la primera versión; el parseador lo sigue aceptando y lo
traduce a `"agendada"`, por si el modelo arrastra el formato viejo.

Una cancelación importa tanto o más que un agendamiento: el lead se enfría y
hay que contactarlo. Por eso los tres casos hacen lo mismo — marcan el lead,
apagan el bot y lo dejan en `contactado` — y lo que cambia es el motivo que ve
el vendedor en la ficha:

- `agendada` → "El lead agendó una reunión con el bot"
- `modificada` → "El lead reagendó su reunión: revisar la nueva fecha"
- `cancelada` → "El lead canceló su reunión: contactar antes de que se enfríe"

El motivo **sí se sobrescribe** en cada llamada, a propósito: la ficha debe
mostrar lo último que pasó. La fecha `escalado_ia_at` no se toca nunca.

El IF pasó a llamarse `📅 ¿Movimiento de reunión?` y su condición es
`reunion_estado` no vacío (más `message_index === 1`). El nodo HTTP manda
`tipo: $json.reunion_estado` y ya no manda motivo: lo pone la function.

## Inbound fuera de campaña

Desde `20260907100000_bot_capta_lead_inbound.sql`, si el teléfono **no existe**
en `leads_campana`, `bot_capta_lead` **crea la ficha** con
`origen = 'whatsapp_inbound'`, ya marcada como captada por IA y en etapa
`contactado`. Antes devolvía 404 y la conversación se perdía: el bot atiende
gente que llega por la web o por anuncios, no solo leads de campaña.

Orden de búsqueda, que importa:

1. Lead vivo con ese teléfono → se marca.
2. Lead **archivado** con ese teléfono → se revive y se marca. Si la persona
   está conversando con el bot ahora, el motivo por el que se archivó
   (duplicado, número inmarcable) ya no aplica; y como `telefono` es UNIQUE,
   insertar uno nuevo reventaría la constraint.
3. No existe → se crea.

Los dos nodos HTTP mandan además `nombre` con el perfil de WhatsApp
(`$('WhatsApp Trigger…').first().json?.contacts?.[0]?.profile?.name`). Si viene
vacío, el RPC arma `Contacto WhatsApp <últimos 4 dígitos>`. Ese nombre también
rellena fichas viejas que quedaron sin nombre útil.

La respuesta de la function trae `creado` y `revivido` para distinguir los tres
casos desde n8n.

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
