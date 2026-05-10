## Mejoras para la sección de Mensajes (solo administradores)

Todas las funciones nuevas estarán protegidas por `useIsAdmin()` (tabla `user_roles`). Los no-admin verán las acciones con candado, igual que el botón actual.

---

### 1. Búsqueda dentro del chat
- Botón 🔍 en el header de `ChatArea`.
- Abre una barra superior con input que filtra/resalta coincidencias en los mensajes cargados.
- Navegación con ↑ ↓ entre coincidencias y contador "3 de 12".

### 2. Respuestas rápidas / Plantillas
- Botón ⚡ junto al input de envío → abre un Popover con plantillas guardadas.
- Click en una plantilla → la inserta en el textarea (editable antes de enviar).
- Soporte de variables: `{{nombre}}` se reemplaza con `selectedContact.nombre`.
- Pantalla de gestión (modal "Administrar plantillas") para crear/editar/eliminar.

### 3. Emojis y formato básico
- Botón 😊 → picker de emojis (`emoji-picker-react`) que inserta en el input.
- Mini-toolbar con **negrita** (`*texto*`), _cursiva_ (`_texto_`) y ~tachado~ (`~texto~`), siguiendo el estándar de WhatsApp.
- Renderizar ese formato en las burbujas del chat.

### 4. Adjuntar archivos / imágenes
- Botón 📎 → abre selector de archivos (imágenes, PDF, audio).
- Subida al bucket de Supabase Storage `whatsapp-media` (privado, con URLs firmadas).
- El payload al webhook de n8n incluirá `media_url` y `media_type` además del texto opcional.
- Preview en burbuja: imagen inline, PDF/audio como tarjeta con icono y nombre.

### 5. Marcar como no leído / Archivar contacto
- Click derecho (o menú "⋮") sobre un contacto en `ContactSidebar`:
  - **Marcar como no leído** → revierte `leido=false` al último mensaje inbound.
  - **Archivar / Desarchivar** → setea `archivado=true` en `leads_campana`.
- Nuevo filtro en el dropdown: "Archivados".

### 6. Etiquetas (tags) por contacto
- Chips de colores debajo del nombre en la lista y en el header del chat.
- Botón "+" para añadir/quitar tags desde un Popover con buscador.
- Pantalla "Administrar etiquetas" (color + nombre).
- Filtro por etiqueta en el sidebar.

### 7. Notas internas del lead
- Panel lateral derecho colapsable (icono 📝 en el header del chat).
- Lista cronológica de notas + textarea para añadir nueva.
- Solo visibles para administradores; nunca se envían al lead.

---

### Cambios técnicos

**Base de datos** (requiere aprobación de migración — *nota: contradice la regla "no crear tablas nuevas" guardada en memoria; lo confirmo contigo antes de ejecutar*):

- `leads_campana`: añadir columnas `archivado boolean default false`, `tag_ids uuid[] default '{}'`.
- Nueva tabla `quick_replies` (id, user_id, titulo, contenido, created_at) — RLS: cada admin ve/edita las suyas.
- Nueva tabla `lead_tags` (id, nombre, color) — RLS: solo admins escriben, todos los autenticados leen.
- Nueva tabla `lead_notes` (id, lead_id, user_id, contenido, created_at) — RLS: solo admins.
- Bucket Storage `whatsapp-media` (privado) + policies de admin.
- `mensajes_whatsapp`: añadir columnas `media_url text`, `media_type text` (opcionales).

**Frontend**:
- Nuevos componentes en `src/components/inbox/`:
  - `ChatSearchBar.tsx`
  - `QuickRepliesPopover.tsx` + `ManageQuickRepliesDialog.tsx`
  - `EmojiPicker.tsx` + helper `whatsappFormat.ts` (parser de `*_~`)
  - `AttachmentButton.tsx` + `MediaBubble.tsx`
  - `ContactContextMenu.tsx` (no leído / archivar / tags)
  - `TagsManager.tsx` + `TagChip.tsx`
  - `NotesPanel.tsx`
- Hook `useAdminGuard()` que envuelve handlers y muestra toast "Función solo para administradores" + candado visual.
- Dependencia nueva: `emoji-picker-react`.

**Webhook n8n**: el payload pasará a incluir opcionalmente `media_url`, `media_type`, `formato: "whatsapp"`. Tendrás que adaptar el flujo de n8n para reenviar el archivo a WhatsApp Cloud API (no lo cubre este plan en código, solo el envío del payload).

---

### Orden sugerido de implementación
1. Migración de BD + bucket de Storage.
2. Hook `useAdminGuard` + integración del candado en los nuevos botones.
3. Búsqueda en chat + emojis + formato (frontend puro, rápido).
4. Respuestas rápidas (CRUD + popover).
5. Adjuntos (Storage + webhook).
6. Gestión de contactos (no leído, archivar, tags, notas).
