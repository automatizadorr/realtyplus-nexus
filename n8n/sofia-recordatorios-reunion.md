# Sofía · Recordatorios de reunión

Workflow `Xk4GWKRi4COL0hZq` en el n8n local. **Nace desactivado**: al encenderlo
empieza a escribirle a leads reales que tienen reunión agendada.

Una reunión que el lead olvida es peor que no haberla agendado: el vendedor
bloqueó la hora y se queda esperando. Van dos avisos antes de cada cita.

| Aviso | Cuándo | Qué hace |
|---|---|---|
| `previo` | T-5 h | Pide confirmar o reagendar |
| `inminente` | T-1 h | Recordatorio corto con el link de Meet |

Es un workflow **aparte** del bot: si algo falla acá, Sofía sigue atendiendo.

## La bifurcación que define el diseño: `modo`

Fuera de las 24 h desde el último mensaje del lead, WhatsApp no deja mandar
texto libre. Y una reunión se agenda **días antes**, así que el aviso de T-5 h
cae casi siempre fuera de la ventana. Por eso cada recordatorio tiene dos
formas, y es la RPC la que decide cuál corresponde:

| `modo` | Cuándo | Qué manda |
|---|---|---|
| `libre` | el lead escribió hace menos de 23 h | el campo `cuerpo` como texto |
| `plantilla` | ventana cerrada | la HSM `plantilla_nombre` \| `plantilla_idioma` |

La plantilla de T-5 h lleva **botones de respuesta rápida**, y tocar un botón
cuenta como mensaje del lead: eso **abre la ventana**, así que el aviso de T-1 h
ya sale como texto libre. Está encadenado a propósito.

## Los nodos

```
⏰ Cada 10 min → 📋 Pedir recordatorios → 🔁 Un recordatorio por item → 🪟 ¿Ventana abierta?
                                                                        ├─ sí → 💬 Enviar texto ─────┐
                                                                        └─ no → 📤 Enviar plantilla ─┴→ ✅ Registrar
```

- **📋 Pedir recordatorios** y **✅ Registrar** llaman a la edge function
  `recordatorios-cola` con el credential Header Auth `Nexus bot-handoff`, el
  mismo de captación y calentamiento.
- **El workflow no lleva la service_role key.** Las RPC
  `recordatorios_pendientes` / `recordatorio_registrar` / `recordatorio_respuesta`
  están revocadas para `anon` y `authenticated`; la function las usa por dentro
  y hacia afuera pide el webhook secret.
- **✅ Registrar** lee los datos del item que salió de la cola, no la respuesta
  de WhatsApp, para que el envío quede anotado aunque WhatsApp devuelva algo
  inesperado.
- Todos los nodos de envío y HTTP tienen `onError: continueRegularOutput`: un
  lead que falle no corta la tanda.
- Cada 10 minutos y no cada 30: la franja del aviso de T-1 h dura unos 50
  minutos, y con 30 min de cadencia un recordatorio podía salir muy pegado a la
  hora de la reunión.

## Las reglas viven en la base de datos, no en los nodos

| Regla | Dónde |
|---|---|
| Un solo envío por reunión y por tipo | UNIQUE `(agendamiento_id, tipo)` en `recordatorios_envios` |
| Nada de madrugada | el aviso de T-5 h respeta 08:00–22:00 **hora del lead** (`leads_campana.timezone`). El de T-1 h sale igual: el lead eligió esa hora |
| Reuniones tempranas | si el T-5 h caería de noche, ese aviso se salta y queda solo el de T-1 h |
| Reagendar no duplica avisos | `registrar_agendamiento` ahora cancela las demás reuniones futuras del lead, así no llega el recordatorio de una cita que ya se movió |
| Los tiempos son editables | `recordatorios_config`: `minutos_previo` (300), `minutos_inminente` (60), `hora_local_desde/hasta` |
| Se puede apagar sin tocar n8n | `recordatorios_config.activo = false` deja la cola vacía |

## La respuesta del lead

Cuando el lead contesta "Confirmo" o "Necesito reagendar", eso lo captura un
**trigger de Postgres** sobre `mensajes_automatizacion` — no un nodo de este
workflow ni de Sofía.

La alternativa era meter un nodo más en el flujo de Sofía, que tiene más de
sesenta y atiende toda la operación: cualquier error ahí deja al bot mudo. En
cambio, todo mensaje entrante ya se guarda en esa tabla, así que el trigger
escucha gratis y va dentro de un bloque `EXCEPTION` que se traga cualquier
fallo. Acá sí corresponde un trigger, al revés que en `leads_campana`: los
mensajes entran de a uno, no en lotes de cientos.

Qué hace `recordatorio_respuesta()`:

- **"Confirmo"** → marca `agendamientos.confirmada_at` y le avisa al vendedor.
  El calendario del CRM muestra la etiqueta verde **Confirmada**.
- **"Necesito reagendar"** → avisa al vendedor. Reagendar en sí lo sigue
  haciendo Sofía conversando, que ya tiene esa herramienta.
- Cualquier otra cosa → no hace nada y deja que Sofía conteste normal.

**Solo interpreta el mensaje si el recordatorio de T-5 h salió de verdad y llegó
después** (menos de 8 h). Sin ese filtro, cualquier "dale" u "ok" en medio de
una conversación normal marcaría la reunión como confirmada y le mandaría un
aviso falso al vendedor.

## Antes de activarlo

1. **Cargar las dos plantillas aprobadas** en `recordatorio_plantillas`:

   ```sql
   UPDATE public.recordatorio_plantillas
   SET plantilla_nombre = 'recordatorio_reunion_5h', plantilla_idioma = 'es'
   WHERE tipo = 'previo';

   UPDATE public.recordatorio_plantillas
   SET plantilla_nombre = 'recordatorio_reunion_1h', plantilla_idioma = 'es'
   WHERE tipo = 'inminente';
   ```

   El idioma tiene que ser el **exacto** con el que Meta las aprobó (`es` o
   `es_CL`, no dan lo mismo). Ver `plantillas-recordatorio-meta.md`.

   Mientras `plantilla_nombre` esté vacío, los recordatorios con la ventana
   cerrada **no salen** — en vez de salir rotos.

2. **Probar con una reunión propia**: agendar una a 5 h vista desde un número
   propio, activar el workflow y mirar `recordatorios_envios`.

3. Los dos nodos de envío son copia exacta de los del workflow de
   calentamiento, que ya están verificados contra `/types/nodes.json` y contra
   un nodo de plantilla que funciona en producción. El nodo de plantilla manda
   **dos** parámetros de body: `{{1}}` nombre, `{{2}}` hora.

## Diagnóstico rápido

```sql
-- Qué se mandaría ahora mismo
SELECT tipo, modo, telefono, hora_local, minutos_restan FROM recordatorios_pendientes(50);

-- Qué se mandó
SELECT * FROM recordatorios_envios ORDER BY enviado_at DESC LIMIT 20;

-- Reuniones confirmadas
SELECT fecha_inicio, estado, confirmada_at FROM agendamientos ORDER BY fecha_inicio DESC;
```

Si `recordatorios_pendientes` viene vacía y debería traer algo, revisar en este
orden: `recordatorios_config.activo`, la hora local del lead, que la reunión no
esté `cancelada`, y que no exista ya la fila en `recordatorios_envios`.
