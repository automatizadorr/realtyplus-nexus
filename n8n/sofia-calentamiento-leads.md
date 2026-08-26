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

## Los nodos

```
⏰ Cada 30 minutos  →  📋 Pedir cola  →  🔁 Un lead por item  →  🖼️ ¿Lleva multimedia?
                                                                  ├─ sí → 🎬 Enviar con multimedia ─┐
                                                                  └─ no → 💬 Enviar texto ──────────┴→ ✅ Registrar toque
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

1. **Verificar a ojo el nodo `🎬 Enviar con multimedia`.** Es el único que no
   pude validar contra un nodo existente: ningún workflow del n8n manda
   multimedia todavía, así que los nombres de sus parámetros (`mediaPath`,
   `mediaLink`, `caption`) van según la documentación y no copiados de algo que
   ya funcione. Mientras las piezas no tengan `media_url`, esa rama no se
   ejecuta y todo sale por la de texto.
2. **Cargar la infografía y el video** en `calentamiento_piezas.media_url`
   (fases 2 y 3). Sin eso, los tres toques salen como texto plano.
3. **Probar con un lead propio** antes de encender: poner
   `calentamiento_pausado = true` a todos los demás, activar, verificar, y
   recién ahí soltar.

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
