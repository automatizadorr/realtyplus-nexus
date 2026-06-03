# 🗺️ ROADMAP — RealtyPlus Nexus → Micro-SaaS multi-tenant

> Hoja de ruta para convertir RealtyPlus Nexus de un producto **single-tenant**
> (una sola agencia: Servicios Inmobiliarios Plus Sur SL) en un **micro-SaaS
> multi-tenant vendible**.
>
> Diseñada sobre el stack actual: **Supabase (PostgreSQL + RLS + Edge Functions)
> + React/TypeScript + n8n**.
>
> ⚠️ **Riesgo #1: fuga de datos entre clientes.** Por eso la tenancy va primero
> y con pruebas de aislamiento obligatorias.

---

## Estado actual (punto de partida)

`MVP ───────────●─────────── Micro-SaaS ─────────── SaaS`
**Estás aquí:** producto completo **single-tenant**, en producción, sin cobro ni multi-tenant.

**Ya tiene:** Auth real (Supabase), roles admin/user (RBAC), RLS en todas las tablas,
13 páginas, integraciones (n8n, ElevenLabs, Google Sheets, WhatsApp), PWA, deploy en
Vercel, landing de ventas.

**Le falta para ser micro-SaaS:** multi-tenancy, cobro/suscripciones, onboarding
self-service, aislamiento de datos por cliente.

---

## Decisiones de arquitectura (recomendadas)

| Decisión | Recomendación | Por qué |
|---|---|---|
| **Modelo multi-tenant** | Una sola base de datos + `organization_id` + RLS | Patrón nativo de Supabase, el más barato y mantenible. "Una DB por cliente" es caro y lento de operar |
| **Pasarela de pago** | Stripe | Estándar, soportado por Edge Functions, maneja IVA/España |
| **Cliente actual (Plus Sur SL)** | Se convierte en la **organización #1** (migración de sus datos) | No se pierde nada de lo ya funcionando |

---

## FASE 0 — Preparación (decisiones de negocio) · ½ día

Antes de tocar código:
- **Planes y precios** (ej. *Starter* / *Pro*) y qué los diferencia (nº de leads, mensajes, usuarios).
- **Trial**: ¿14 días gratis sin tarjeta?
- **Nombre comercial / dominio** del SaaS.

**Entregable:** tabla de planes (precio + límites). Sin esto, las Fases 4 y 5 no cierran.

---

## FASE 1 — Multi-tenancy de datos 🔴 (la más delicada) · 3-5 días

**Objetivo:** que cada fila pertenezca a una organización y nadie vea datos de otra.

1. **Tabla `organizations`**:
   `id, nombre, slug, plan, status (trial/active/past_due/canceled), trial_ends_at,
   stripe_customer_id, stripe_subscription_id, created_at`
2. **Agregar `organization_id`** a TODAS las tablas de negocio: `leads_campana`,
   `leads_escaner`, `lead_tags`, `lead_notes`, `quick_replies`, `mensajes_whatsapp`,
   `mensajes_automatizacion`, campañas, etc.
3. **Crear la organización #1** y asignar todos los datos actuales a ella (backfill).
4. **Reescribir TODAS las políticas RLS** para filtrar por la organización del usuario
   (no por `admin` global).
5. **🧪 Test de aislamiento (obligatorio):** crear 2 organizaciones de prueba y verificar
   que una NO puede leer ni una fila de la otra. Se prueba antes de seguir.

> ⚠️ Aquí está el ~80% del riesgo. Una política RLS mal escrita = un cliente ve los
> leads de otro. Se hace tabla por tabla con verificación.

---

## FASE 2 — Membresías y roles por organización · 2-3 días

Hoy el rol (`admin`/`user`) es **global**. En multi-tenant debe ser **por organización**.

1. **Tabla `organization_members`** (`organization_id`, `user_id`, `role`: owner/admin/agente).
2. Refactor de `has_role()` → `has_org_role(user, org, role)`.
3. **`AuthContext`**: cargar la organización activa del usuario y exponerla a toda la app.
4. Actualizar `AdminRoute`/`ProtectedRoute` para validar rol **dentro de la organización**.

---

## FASE 3 — Onboarding self-service · 2 días

**Objetivo:** que un cliente nuevo se registre solo, sin alta manual.

1. Registro → crea automáticamente su `organization` + lo hace `owner` + arranca el **trial**.
2. Pantalla de bienvenida / setup inicial.
3. **Invitar miembros** (tabla `invitations` + email) para sumar agentes.

---

## FASE 4 — Cobro con Stripe · 3-4 días

1. Crear productos/precios en Stripe (los de la Fase 0).
2. **Edge Functions** (Supabase):
   - `create-checkout-session` (iniciar suscripción)
   - `stripe-webhook` (escuchar pagos/cancelaciones y actualizar `organizations.status`)
   - `customer-portal` (que el cliente gestione su tarjeta/plan)
3. Sincronizar estado de suscripción ↔ `organizations`.
4. Pantalla de **Facturación** en Settings.

---

## FASE 5 — Límites por plan (gating) · 2 días

1. Hacer cumplir los límites del plan (ej. máx. leads/mensajes/usuarios).
2. Bloquear features según `plan` y `status` (ej. trial vencido → solo lectura).
3. UI de "mejora tu plan" cuando se topa un límite.

---

## FASE 6 — Hardening y lanzamiento · 2-3 días

1. Auditoría de seguridad (ECC `/security-scan`) enfocada en aislamiento RLS.
2. Pruebas con varias organizaciones simultáneas.
3. Conectar la landing de ventas (Index) con el flujo de registro→pago.
4. Revisar que **n8n** y las Edge Functions respeten `organization_id`
   (los webhooks hoy son globales).

---

## Resumen

| Fase | Qué logras | Esfuerzo | Riesgo |
|---|---|---|---|
| 0 · Decisiones | Planes y precios | ½ día | 🟢 |
| 1 · Multi-tenancy datos | Aislamiento real | 3-5 días | 🔴 Alto |
| 2 · Roles por org | Permisos correctos | 2-3 días | 🟠 |
| 3 · Onboarding | Alta automática | 2 días | 🟡 |
| 4 · Stripe | Cobrar de verdad | 3-4 días | 🟠 |
| 5 · Límites | Diferenciar planes | 2 días | 🟡 |
| 6 · Hardening | Lanzar seguro | 2-3 días | 🟠 |

**Total estimado: ~3-4 semanas** de trabajo enfocado para un micro-SaaS vendible.

> 💡 Las Fases 1 y 2 son irrenunciables y van juntas. Una vez aisladas las
> organizaciones, el resto (onboarding, cobro, límites) es montaje más estándar.

---

*Documento generado como hoja de ruta. Las estimaciones son orientativas y dependen
de las decisiones de la Fase 0.*
