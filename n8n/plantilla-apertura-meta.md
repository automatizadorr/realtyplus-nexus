# Plantilla de apertura para Meta Business

Esta es la que abre la conversación con los **8.413 leads que nunca han
escrito**. Sin ella no se les puede mandar nada: fuera de la ventana de 24 h
Meta solo permite plantillas aprobadas.

## Qué crear en Meta Business

**Manager → WhatsApp → Plantillas de mensaje → Crear plantilla**

- **Nombre:** `apertura_lexhouse_es`
- **Categoría:** `MARKETING`
- **Idioma:** Español

**Cuerpo:**

```
Hola {{1}}, soy Sofía de LexHouse AI 👋

Ayudamos a corredores e inmobiliarias a dejar de perder leads: una IA
responde el WhatsApp, califica y agenda las reuniones por ti.

¿Te muestro en 2 minutos cómo se vería en tu operación?
```

Ejemplo para la variable `{{1}}`: `Mario`

**Botones — tipo "Respuesta rápida", dos:**

1. `Sí, cuéntame`
2. `Ahora no`

## Por qué los botones importan tanto

Cuando el lead toca un botón, **Meta lo cuenta como un mensaje suyo**, y eso
**abre la ventana de 24 h**. A partir de ahí Sofía puede conversar libremente y
mandar imágenes y videos sin ninguna plantilla más.

Sin botones dependes de que el lead se tome el trabajo de escribir. Con
botones, un toque basta. Es la diferencia entre que la secuencia de
calentamiento se pueda usar con casi todos o casi con nadie.

El botón "Ahora no" también sirve: abre la ventana igual, y le da a Sofía la
oportunidad de responder algo breve y dejar la puerta abierta, en vez de que
el lead simplemente ignore el mensaje.

## Ojo con el ritmo de envío

**No mandar las 8.413 de golpe.** Meta asigna un límite diario por número
(suele partir en 1.000 destinatarios/día) y sube o baja según la *calidad*: si
mucha gente bloquea o reporta, el número queda restringido y se cae todo el
canal, incluido el bot que ya funciona.

El motor tiene un tope diario configurable en `calentamiento_config.tope_diario`,
que arranca en **80**. Conviene subirlo de a poco mirando la tasa de respuesta
y la calidad del número en Meta Business.

## Cuando esté aprobada

Cargar el nombre exacto en la pieza de fase 0:

```sql
UPDATE public.calentamiento_piezas
SET plantilla_nombre = 'apertura_lexhouse_es', plantilla_idioma = 'es'
WHERE fase = 0;
```

Y activar la rama de apertura en el workflow `Sofía · Calentamiento de leads`.
