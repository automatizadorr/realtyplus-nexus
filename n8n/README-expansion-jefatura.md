# Workflow n8n — Reporte de Etiquetados → Jefatura

Envía a la jefatura de RealtyPlus un **correo HTML con la marca RealtyPlus**
(logo + paleta azul `#003366` / rojo `#cc0000`) que contiene el reporte completo
de leads etiquetados con sus conversaciones. La jefatura lo reenvía a los agentes
encargados de contactar a los leads.

- **Archivo importable:** `expansion-reporte-jefatura.json`
- **Disparador:** webhook `POST /webhook/expansion` (el mismo que ya usa el botón
  "Enviar a n8n" de `/tagged/export`).
- **Salida:** correo HTML + adjunto `.html` de fidelidad total.

---

## Diagrama del flujo

```
Webhook /expansion
   └─> Validar secreto (IF)
        ├─ (válido) ─> Construir Reporte HTML (Code)
        │                 └─> Enviar Email Jefatura (SMTP)
        │                       ├─ (éxito) ─> Log éxito (Supabase) ─> Responder OK
        │                       └─ (error) ─> Log error (Supabase) ─> Responder error
        └─ (inválido) ─> Responder 401
```

### Propósito de cada nodo
| Nodo | Qué hace |
|------|----------|
| **Webhook /expansion** | Recibe el payload del botón "Enviar a n8n". |
| **Validar secreto** | Compara el header `X-Webhook-Secret` con la variable de entorno `N8N_WEBHOOK_SECRET`. Si no coincide → 401. |
| **Construir Reporte HTML** | Transforma el payload en el HTML con marca RealtyPlus y genera el adjunto `.html`. |
| **Enviar Email Jefatura** | Manda el correo por SMTP. Tiene salida de error separada. |
| **Log éxito / Log error** | Inserta una fila append-only en `public.logs_expansion`. |
| **Responder OK / error / 401** | Devuelve la respuesta al llamante (la Edge Function `send-n8n-webhook`). |

---

## Pasos de instalación (en orden)

### 1. Aplicar la tabla de log en Supabase
Ejecuta en el **SQL Editor** de Supabase el archivo:
`supabase/migrations/20260604140000_logs_expansion.sql`

### 2. Subir el logo y desplegar
Ya se copió el logo a `public/realtyplus-logo.png`. Tras el próximo deploy a
Vercel quedará accesible en:
`https://realtyplus-nexus.vercel.app/realtyplus-logo.png`
(Verifícalo abriendo esa URL en el navegador antes de enviar el primer correo.)

### 3. Importar el workflow
En n8n: **Workflows → Import from File →** `expansion-reporte-jefatura.json`.

> ⚠️ Asegúrate de que **no exista otro workflow activo** escuchando en la ruta
> `/expansion`, o habrá conflicto.

### 4. Configurar credenciales y variables

**a) SMTP (envío de correo).** Recomendado: Gmail con App Password.
1. En tu cuenta Google activa la **verificación en 2 pasos**.
2. Crea una **contraseña de aplicación** en https://myaccount.google.com/apppasswords
3. En n8n crea una credencial **SMTP** con:
   - Host: `smtp.gmail.com`  ·  Puerto: `465`  ·  SSL/TLS: activado
   - Usuario: tu correo Gmail  ·  Contraseña: la App Password
4. Abre el nodo **Enviar Email Jefatura** y selecciona esa credencial.

**b) Variables de entorno en n8n (EasyPanel):**
| Variable | Valor |
|----------|-------|
| `N8N_WEBHOOK_SECRET` | el mismo valor que pusiste en el secreto de la Edge Function |
| `SUPABASE_SERVICE_ROLE_KEY` | la service role key del proyecto Supabase |

### 5. Editar los 2 datos del nodo "Construir Reporte HTML"
Abre ese nodo y cambia, al inicio del código:
- `DEST` → el correo real de la jefatura.

Y en el nodo **Enviar Email Jefatura** cambia `fromEmail` (`no-reply@realtyplus.es`)
por el remitente que quieras mostrar.

### 6. Activar y probar
1. Activa el workflow (toggle arriba a la derecha).
2. En la app, ve a **/tagged/export**, elige un filtro y pulsa **"Enviar a n8n"**.
3. Revisa: el correo llega a la jefatura y aparece una fila en `logs_expansion`.

---

## Notas
- El correo lleva el reporte **en el cuerpo** y también **adjunto como `.html`**
  (los agentes lo abren con fidelidad perfecta en el navegador).
- Si Gmail no muestra el logo, es porque aún no se ha desplegado el `public/`
  o la URL no es pública: revisa el paso 2.
- El log es **append-only** por diseño (sin políticas UPDATE/DELETE).
