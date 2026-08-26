# Sofía · Calentamiento de leads

Workflow `Wo1odjgyX6heFyjw` en el n8n local. **Nace desactivado a propósito**:
al encenderlo empieza a mandar WhatsApp a leads reales.

Recupera al lead que dejó de contestar con tres toques cortos. Es un workflow
**aparte** del bot: si algo falla acá, Sofía sigue atendiendo igual.

## La restricción que define todo el diseño

WhatsApp Business solo permite mensajes **libres** —texto, imagen, video—
dentro de las **24 h desde el último mensaje del lead**. Fuera de esa ventana
lo único que sale es una plantilla HSM aprobada por Meta, y si lleva
multimedia hay que aprobar también el header.

Por eso la escalera es **2 h / 6 h / 20 h**: los tres toques caben dentro de la
ventana, así que el sistema no depende de ninguna aprobación de Meta. Fue
decisión de Mario y es la que hace viable el proyecto sin esperas externas.

| Toque | Formato | Pieza |
|---|---|---|
| T+2 h | Texto | "¿alcanzaste a ver lo que te comenté?" |
| T+6 h | Imagen | Infografía de valor |
| T+20 h | Video | Cierre suave: "si no es el momento, dímelo" |

## El flujo completo

El punto de partida no es la escalera, es **la plantilla**. El 99% de la base
(8.413 leads de 8.461) nunca escribió nada, y a esos Meta solo deja llegarles
con una plantilla HSM aprobada.

```
                              ¿el lead respondió?
plantilla de apertura ──┬── no ──→ se deja tranquilo (decisión de Mario: no se insiste)
                        │
                        └── sí ──→ se abre la ventana de 24 h ──→ Sofía conversa
                                        │
                                        ├── agenda reunión ──→ sale de la secuencia
                                        └── no agenda y se calla ──→ escalera 2 h / 6 h / 20 h
```

**Mandar la plantilla NO abre la ventana.** La abre únicamente un mensaje del
lead — y tocar un botón de respuesta rápida cuenta como mensaje suyo. Por eso
la plantilla lleva botones: ver `plantilla-apertura-meta.md`.

## Los nodos

Dos ramas que salen del mismo Schedule Trigger:

```
⏰ Cada 30 minutos ─┬─ 📋 Pedir cola → 🔁 Un lead por item → 🖼️ ¿Lleva multimedia?
                    │                                          ├─ sí → 🎬 Enviar con multimedia ─┐
                    │                                          └─ no → 💬 Enviar texto ──────────┴→ ✅ Registrar toque
                    │
                    └─ 📨 Pedir cola de apertura → 🔁 Un lead por item (apertura) → 📤 Enviar plantilla → ✅ Registrar apertura
```

- **📋 Pedir cola** y **✅ Registrar toque** llaman a la edge function
  `calentamiento-cola` con el credential Header Auth `Nexus bot-handoff`, el
  mismo de los nodos de captación.
- **El workflow no lleva la service_role key.** Las RPC `leads_para_calentar` y
  `calentamiento_registrar` están revocadas para `anon` y `authenticated`: solo
  las puede ejecutar el service_role, y esa llave no debe andar dentro de un
  nodo de n8n. La function la usa por dentro y hacia afuera pide el webhook
  secret.
- **✅ Registrar toque** lee los datos del item que salió de la cola, no la
  respuesta de WhatsApp, para que el toque quede anotado aunque WhatsApp
  devuelva algo inesperado.
- Los dos nodos de envío y los dos HTTP tienen `onError:
  continueRegularOutput`: un lead que falle no puede cortar la tanda entera.

## Antes de activarlo

1. **Los dos nodos de envío ya están verificados** contra el catálogo de tipos
   de n8n (`/types/nodes.json`) y contra un nodo de plantilla que ya funciona en
   producción (`AI-MAX | Leads Magnet v2`). Tenían cuatro errores, todos
   corregidos:

   | Nodo | Estaba | Correcto |
   |---|---|---|
   | Enviar plantilla | `operation: "send"` | sin `operation` — `sendTemplate` es el valor por defecto del nodo |
   | Enviar plantilla | `messageType: "template"` | no existe: sus valores son audio/contacts/document/image/location/text/video |
   | Multimedia | `mediaPath: "useMedialLink"` | `useMediaLink` |
   | Multimedia | `additionalFields.caption` | `additionalFields.mediaCaption` |

   El formato del campo `template` es `nombre|idioma`, pegado con barra. El
   ejemplo en producción usa `es_CL`, así que hay que cargar en la fase 0 el
   idioma **exacto** con el que Meta aprobó la plantilla.

2. **Cargar la infografía y el video** en `calentamiento_piezas.media_url`
   (fases 2 y 3). Sin eso, los tres toques salen como texto plano.
3. **Probar con un lead propio** antes de encender: poner
   `calentamiento_pausado = true` a todos los demás, activar, verificar, y
   recién ahí soltar.

## Las líneas de WhatsApp, después del cruce

La plantilla de apertura se subió a Meta con la cuenta **AI-MAX**, porque la de
RealtyPlus tiene un pago pendiente. Para que todo quede coherente, Mario cruzó
las credenciales de los dos bots:

| Línea | Trigger | Envío | Flujo que la atiende |
|---|---|---|---|
| **AI-MAX** (`1078596682011236`) | `AI-MAX` | `AI-MAX - ENVIAR MENSAJE` | **Sofía** — el sistema de Nexus |
| RealtyPlus | `RealtyPLus-AI` | `RealtyPlus- enviar Mensaje` | LexHouse Camil-AI — las landings |

Esto deja el circuito cerrado: la apertura sale por AI-MAX, el lead responde a
ese mismo número, y quien atiende es **Sofía**, que sí tiene la captura de
reuniones y de agenda. Si hubiera quedado al revés, un lead que agendara desde
el calentamiento no habría aparecido nunca en la agenda del CRM.

**Un flujo activo por línea**, verificado: no hay dos bots escuchando el mismo
número, que produciría dos respuestas distintas al mismo mensaje.

Lo que sí queda expuesto al pago pendiente es **Camil-AI**, el bot de las
landings. Si esa cuenta se suspende, deja de responder ese canal — pero Nexus
sigue funcionando.

## El tope diario, que es lo que protege el número

`calentamiento_config.tope_diario` arranca en **80**. Meta asigna un límite de
destinatarios por día y lo sube o lo baja según la calidad del número: si mucha
gente bloquea o reporta, el número queda restringido y **se cae todo el canal**,
incluido el bot que ya funciona. Mandar 8.413 plantillas de golpe es la forma
más rápida de perderlo.

## Cómo se apaga la secuencia

No hay que hacer nada para cortarla cuando el lead responde. **La fase se
calcula**, no se guarda: es la cantidad de toques enviados *después* del último
mensaje entrante del lead. Si el lead escribe, ese conteo vuelve a cero solo.

La versión anterior llevaba un contador que había que resetear con un nodo
dentro del bot principal; se cambió porque si ese reset fallaba, el lead
quedaba pegado en la fase 3 para siempre y nunca volvía a recibir el primer
toque.

Además queda fuera de la cola quien: tenga una reunión futura sin cancelar,
tenga el bot apagado por una escalación (un humano ya está en esa
conversación), esté archivado, esté fuera de las etapas en juego, tenga
`calentamiento_pausado`, o esté fuera del horario local 9–21 según su
`timezone`.

## Dónde mirar si algo sale mal

- `calentamiento_envios` — un registro por toque enviado.
- `contactos_log` con `origen = 'calentamiento'` — aparece en el panel de KPIs
  junto al resto de los contactos del vendedor.
- `admin_calentamiento_resumen()` — cuántos leads hay en cada fase.
