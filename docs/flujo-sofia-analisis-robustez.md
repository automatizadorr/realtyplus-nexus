# Flujo principal Sofía (WhatsApp Parte 2) — Análisis de robustez

> Objetivo: que **no se pare**, que **no falle**, y que **el usuario SIEMPRE reciba respuesta**.
> Analizado nodo por nodo. Producción.

## Resumen ejecutivo

| # | Sev | Hallazgo | ¿El usuario se queda sin respuesta? |
|---|-----|----------|--------------------------------------|
| P0-1 | 🔴 | **Redis es punto único de fallo.** Los 6 nodos Redis del buffer no tienen `onError` ni bypass. Si Redis se cae, el PRIMER nodo (Agregar a Buffer) rompe y **el flujo muere ahí**, sin fallback. | **SÍ — todos los mensajes** |
| P0-2 | 🔴 | **Switch2 no tiene salida fallback.** Solo enruta `type==text`. Un **audio, imagen, sticker, ubicación, etc.** no matchea ninguna regla → se descarta en silencio. | **SÍ — todo lo que no sea texto** |
| P0-3 | 🔴 | **El fallback de envío "Send message" está roto.** Usa `{{ $json.contacts[0].wa_id }}`, que **NO existe** en ese punto (ahí `$json` es la respuesta de Send message1, no el trigger) → destinatario `undefined` → el fallback tampoco llega. Además no tiene `onError` → si falla, para el flujo. | **SÍ — si el envío principal falla** |
| P0-4 | 🔴 | **Nodos de fallback/alerta sin `onError`**: `Send message`, `📲 Fallback al Lead`, `Send a message3/4/5`, `Ejecutar Reserva`. Si cualquiera falla, **para el workflow** justo en el momento de recuperación. | Depende |
| P1-1 | 🟠 | **`📅 Ejecutar Reserva` sin `onError`.** Si Calendar falla, para el flujo; y desalinea con el mensaje "te llegó la invitación" que la IA ya envió. | No (ya respondió), pero rompe |
| P1-2 | 🟠 | **Cluster huérfano de código muerto**: `Wait5 → Loop Over Items3 → ¿Reactivación?(outbound) → Create a row1 / Registrar en Supabase → Wait5`. Ciclo cerrado **sin entrada externa → nunca corre.** El logging real ya lo hacen `💬 Guardar Reactivación WAMID` / `Guardar Oportunidades WAMID`. | No, pero ensucia/confunde |
| P2-1 | 🟡 | **Secretos hardcodeados** (JWT anon + `x-webhook-secret`) en los 2 nodos HTTP `log-auto-message`. | No |
| P2-2 | 🟡 | `onError` inconsistentes (`continueErrorOutput` con rama de error sin conectar en algún nodo). | No |

**Lo que YA está bien** ✅ (no tocar):
- **AI Agent1** tiene doble red: `needsFallback:true` (DeepSeek → Gemini) **y** `onError:continueErrorOutput` → si la IA falla, el usuario recibe `📲 Fallback al Lead` ("disculpa la demora, un asesor te contactará") + email de alerta. Excelente.
- **Debounce con buffer** (agrupa mensajes rápidos → 1 sola respuesta) — bien diseñado (aparte del SPOF de Redis).
- **Acuses** actualizando ambas tablas por `wamid`.
- **Send message1** con `onError` y rama de fallback (aunque el fallback esté roto, ver P0-3).

---

## Detalle y solución de cada punto

### 🔴 P0-1 — Redis: punto único de fallo
**Problema:** `Edit Fields4 → 📥 Agregar → 🏷️ Marcar Último → ⏳ Wait → 📖 Leer Último → ¿Soy último? → 📤 Leer → 🧹 Limpiar → 🧩 Combinar`. Ningún nodo Redis tiene `onError`. Si Redis está caído/lento, el flujo revienta en el primer Redis y **el lead no recibe nada, ni fallback**.

**Solución (bypass anti-caída):**
- Poner `onError: continueErrorOutput` en los nodos Redis clave (al menos Agregar, Leer Último, Leer Buffer).
- Añadir un **camino de respaldo**: si Redis falla, saltar el buffer y mandar el **mensaje único crudo** (`Edit Fields4.msg_text`) directo a `Get row(s) in sheet1` / IA. Se pierde el debounce (degradación aceptable), pero **el usuario SIEMPRE recibe respuesta**.

### 🔴 P0-2 — Switch2 sin fallback (mensajes no-texto se pierden)
**Problema:** `Switch2` solo enruta `messages[0].type == text`. Audios, imágenes, stickers, ubicaciones, contactos, etc. → no matchean → **descartados sin respuesta**. (El prompt de Sofía dice "o transcripción de audio", pero no hay nodo de transcripción.)

**Solución:**
- Activar **`fallbackOutput`** en Switch2 → rama "otros tipos".
- Mínimo viable: esa rama envía un WhatsApp tipo *"Por ahora solo puedo leerte por texto 🙏, ¿me lo escribes?"* → el usuario recibe respuesta.
- Ideal (futuro): transcribir audio (Whisper/Deepgram) y reinyectarlo como texto.

### 🔴 P0-3 — Fallback de envío roto
**Problema:** `Send message` (fallback de `Send message1`) usa `{{ $json.contacts[0].wa_id }}`. En la rama de error de `Send message1`, `$json` NO tiene `contacts` → destinatario `undefined` → **el fallback no llega**. Y no tiene `onError`.

**Solución:**
- Cambiar el destinatario a `{{ $('🧩 Parseador Nexus4').item.json.telefono }}` (o `$('WhatsApp Trigger1').item.json.contacts[0].wa_id`).
- Añadir `onError: continueRegularOutput`.

### 🔴 P0-4 — Nodos de recuperación sin `onError`
**Problema:** si un nodo de fallback/alerta/reserva falla, para todo el workflow.

**Solución:** poner `onError: continueRegularOutput` en: `Send message`, `📲 Fallback al Lead`, `Send a message3`, `Send a message4`, `Send a message5`, `📅 Ejecutar Reserva (Standard)`. Un fallo en recuperación NUNCA debe tumbar el flujo.

### 🟠 P1-2 — Borrar el cluster muerto
`Wait5`, `Loop Over Items3`, `¿Reactivación? (outbound)`, `Create a row1`, `Registrar en Supabase` forman un ciclo sin entrada → **nunca se ejecutan**. El registro de salida real ya lo hacen los nodos WAMID. **Borrarlos** reduce confusión y superficie de error.

### 🟡 P2-1 — Secretos
Mover `x-webhook-secret` y el `Bearer`/`apikey` a **credenciales n8n / variables de entorno**. Y rotar `rpchile_cron_2026_a8K3mZqL` (expuesto).

---

## Plan de endurecimiento (orden recomendado)
1. **P0-3 + P0-4** (rápido, alto impacto): arreglar destinatario del fallback + `onError` en todos los nodos de recuperación. → el usuario recibe respuesta aunque falle el envío o la IA.
2. **P0-2**: `fallbackOutput` en Switch2 + rama "solo texto por ahora". → nadie queda sin respuesta por mandar audio/imagen.
3. **P0-1**: bypass de Redis. → sobrevive a caídas de Redis.
4. **P1-2**: borrar cluster muerto.
5. **P2**: secretos a credenciales.

Con 1–3 el flujo cumple "no se para y el usuario siempre recibe respuesta". Con 4–5 queda limpio y seguro.
