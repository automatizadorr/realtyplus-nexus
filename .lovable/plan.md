

## Plan: Crear campañas reales con contactos existentes de mensajes

### Problema actual
1. La página **Campaigns** solo muestra un historial — no tiene botón para crear campañas.
2. La página **Scanner** usa columnas incorrectas (`nombre`, `mensaje_plantilla`) que no coinciden con la tabla `lead_recovery_campaigns` (que usa `campaign_name`, `user_id`, `message_template_whatsapp`, etc.) y no envía `user_id`, lo que viola RLS.
3. No hay forma de seleccionar contactos existentes de `leads_campana` para añadirlos a una campaña.

### Solución

**1. Rediseñar la página Campaigns** (`src/pages/Campaigns.tsx`)
- Añadir botón "Nueva Campaña" que abre un Dialog/Sheet.
- El formulario incluye:
  - Nombre de campaña
  - Canal (WhatsApp, Email, ambos)
  - Plantilla de mensaje WhatsApp
  - Plantilla de mensaje Email + Asunto
  - Selector de contactos: carga los contactos de `leads_campana` con búsqueda y selección múltiple (checkboxes)
  - Filtros para seleccionar contactos: por estado, por país, por bot activo/inactivo
- Al lanzar: inserta en `lead_recovery_campaigns` con `user_id = auth.uid()` y las columnas correctas (`campaign_name`, `status`, `channel`, `total_leads`, `message_template_whatsapp`, `message_template_email`, `subject_email`).

**2. Crear componente `CreateCampaignDialog`** (`src/components/campaigns/CreateCampaignDialog.tsx`)
- Dialog modal con formulario paso a paso o en un solo panel.
- Carga contactos de `leads_campana` para selección.
- Muestra preview de contactos seleccionados con contador.
- Botón "Lanzar Campaña" que:
  1. Inserta la campaña en `lead_recovery_campaigns`
  2. Muestra toast de éxito
  3. Refresca la lista de campañas

**3. Corregir Scanner** (`src/pages/Scanner.tsx`)
- Actualizar los nombres de columnas para que coincidan con la tabla real (`campaign_name`, `message_template_whatsapp`, `user_id`, `status`).
- Pasar el `user_id` del contexto de Auth.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `src/components/campaigns/CreateCampaignDialog.tsx` | Crear — formulario con selector de contactos |
| `src/pages/Campaigns.tsx` | Modificar — añadir botón "Nueva Campaña" + integrar dialog |
| `src/pages/Scanner.tsx` | Modificar — corregir columnas para coincidir con la BD |

### Detalles técnicos
- Se usa `useAuth()` para obtener `user.id` y pasarlo como `user_id` en los inserts (requerido por RLS).
- Los contactos se cargan desde `leads_campana` con `supabase.from("leads_campana").select(...)`.
- El selector de contactos permite buscar por nombre/teléfono y marcar/desmarcar contactos individualmente o todos.
- No se crean tablas nuevas — se usan las existentes.

