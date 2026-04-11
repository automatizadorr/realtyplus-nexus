

## Plan: Notificaciones sonoras para mensajes entrantes

### Objetivo
Reproducir un sonido de notificación cuando llega un mensaje inbound vía Realtime, tanto en el chat activo como en el sidebar (para mensajes de otros contactos).

### Implementación

**1. Crear un hook `useNotificationSound`** (`src/hooks/use-notification-sound.ts`)
- Genera un beep corto usando la Web Audio API (sin necesidad de archivos de audio externos).
- Exporta una función `playNotificationSound()` reutilizable.

**2. Actualizar `ContactSidebar.tsx`**
- Importar el hook.
- En el listener de Realtime (`postgres_changes` INSERT), si el mensaje es `inbound`, reproducir el sonido.

**3. Actualizar `ChatArea.tsx`**
- Importar el hook.
- En el listener de Realtime, si el mensaje es `inbound` y proviene de otro contacto (o del contacto activo), reproducir el sonido. Para evitar duplicar el sonido con el sidebar, solo se reproducirá en el sidebar (punto central).

### Decisión de diseño
- El sonido se disparará únicamente desde `ContactSidebar.tsx` (que siempre está montado en la vista Inbox) para evitar doble notificación.
- Se usará Web Audio API para un tono corto y limpio, sin dependencias externas.

### Archivos a crear/modificar
| Archivo | Acción |
|---|---|
| `src/hooks/use-notification-sound.ts` | Crear — hook con Web Audio API |
| `src/components/inbox/ContactSidebar.tsx` | Modificar — llamar `playNotificationSound()` en INSERT inbound |

