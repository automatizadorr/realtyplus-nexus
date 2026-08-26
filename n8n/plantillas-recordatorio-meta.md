# Plantillas de recordatorio · para subir a Meta

Dos plantillas HSM. Van en la cuenta de **AI-MAX**, la misma desde la que se
subió `apertura_lexhouse_es`, porque es la línea que atiende Sofía.

Se suben en WhatsApp Manager → *Herramientas de la cuenta* → *Plantillas de
mensajes* → **Crear plantilla**.

## Por qué son categoría UTILITY y no MARKETING

Un recordatorio de una reunión que el propio lead agendó es un mensaje
transaccional: Meta lo aprueba rápido, no cuenta contra el límite de
marketing y molesta mucho menos a la calidad del número. Si se sube como
MARKETING, se aprueba igual pero se paga como marketing y arrastra la
reputación de la línea.

**No agregar frases de venta al cuerpo.** Un "aprovecha nuestra promoción" en un
recordatorio hace que Meta lo reclasifique como marketing o lo rechace.

---

## 1 · `recordatorio_reunion_5h`

| Campo | Valor |
|---|---|
| Nombre | `recordatorio_reunion_5h` |
| Categoría | **Utilidad** (UTILITY) |
| Idioma | **Español** (`es`) |
| Encabezado | ninguno |
| Pie | ninguno |

**Cuerpo**

```
Hola {{1}}, te recuerdo tu reunión de hoy a las {{2}} con LexHouse AI.

¿La confirmamos? Si te cambió la agenda, dime y la movemos sin problema.
```

**Ejemplos para las variables** (Meta los exige para revisar):

- `{{1}}` → `Mario`
- `{{2}}` → `15:30`

**Botones** — tipo *Respuesta rápida*, dos:

| Botón | Texto exacto |
|---|---|
| 1 | `Confirmo` |
| 2 | `Necesito reagendar` |

Los botones no son decoración: **tocar uno cuenta como mensaje del lead**, y eso
abre la ventana de 24 h. Por eso el recordatorio de T-1 h ya puede salir como
texto libre, y por eso Sofía puede conversar el cambio de hora sin gastar otra
plantilla.

El texto de los botones tiene que empezar por `Confirmo` y `Necesito reagendar`
para que los clasifique `recordatorio_respuesta()`. Si se cambian, hay que
ajustar los patrones de esa función.

---

## 2 · `recordatorio_reunion_1h`

| Campo | Valor |
|---|---|
| Nombre | `recordatorio_reunion_1h` |
| Categoría | **Utilidad** (UTILITY) |
| Idioma | **Español** (`es`) |
| Encabezado | ninguno |
| Botones | ninguno |
| Pie | ninguno |

**Cuerpo**

```
{{1}}, tu reunión con LexHouse AI empieza en un rato, a las {{2}}.

Nos vemos.
```

**Ejemplos para las variables**

- `{{1}}` → `Mario`
- `{{2}}` → `15:30`

Sin botones a propósito: a una hora de la reunión ya no hay nada que decidir, y
menos botones es una plantilla que se aprueba más rápido.

Este recordatorio casi siempre saldrá como **texto libre**, no como plantilla,
porque el de T-5 h ya abrió la ventana. La plantilla es el respaldo para cuando
el lead no tocó ningún botón.

---

## Cuando Meta las apruebe

Cargar el nombre **y el idioma exacto** con el que quedaron aprobadas:

```sql
UPDATE public.recordatorio_plantillas
SET plantilla_nombre = 'recordatorio_reunion_5h', plantilla_idioma = 'es'
WHERE tipo = 'previo';

UPDATE public.recordatorio_plantillas
SET plantilla_nombre = 'recordatorio_reunion_1h', plantilla_idioma = 'es'
WHERE tipo = 'inminente';
```

`es` y `es_CL` **no** son intercambiables: el nodo de n8n manda
`nombre|idioma` pegado con barra, y si el idioma no coincide con el aprobado,
Meta rechaza el envío.

Después: activar el workflow `Xk4GWKRi4COL0hZq`.

## El link de Meet

No va en las plantillas. Meta pide aprobar los botones de URL con el dominio
fijo, y el link de Meet cambia en cada reunión. Va en la versión de **texto
libre** (`recordatorio_plantillas.cuerpo_libre` del tipo `inminente`, con el
marcador `{{link}}`), que es la que sale en la mayoría de los casos. El lead que
recibe la plantilla igual tiene el link en el mensaje con el que Sofía le
confirmó la reunión, y en la invitación de Google Calendar.
