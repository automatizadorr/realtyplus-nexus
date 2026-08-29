# Configuración ElevenLabs Webhook → voice-tracker

## 1. En ElevenLabs Dashboard
Ir a: **Agente `agent_5801kj0vngjhfrjvnypa36vvagmv` → Settings → Webhooks**

Agregar **Post-call Webhook**:
- **URL**: `https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/voice-tracker`
- **Events**: `call_ended`, `transcript_ready`, `recording_ready`
- **Secret**: `ELEVENLABS_WEBHOOK_SECRET` (configurado en Supabase secrets)

## 2. En Twilio Console
Ir a: **Phone Numbers → +17744602305 (LexHouseAI new 2026) → Voice Configuration**

- **A Call Comes In**: `Webhook` → `https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/voice-tracker`
- **Call Status Changes**: `Webhook` → `https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/voice-tracker`
- **Recording Status Callback**: `https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/voice-tracker`

## 3. Variables de entorno requeridas en Supabase (ya configuradas)
```bash
ELEVENLABS_API_KEY=sk_f795fc5f7db77fd4b98c54a058ed37396466e3aa22dbca0a
ELEVENLABS_WEBHOOK_SECRET=<generado automáticamente>
TWILIO_AUTH_TOKEN=<tu_twilio_auth_token>
SUPABASE_URL=https://owykkhwqpnumvgdeugmj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## 4. Endpoints disponibles

### voice-orchestrator (iniciar llamada)
```
POST https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/voice-orchestrator
Headers: Authorization: Bearer <anon_key>, Content-Type: application/json
Body:
{
  "lead_data": {
    "nombre": "Juan Pérez",
    "telefono": "+56912345678",
    "propiedad": "Casa en La Reina",
    "tipo_propiedad": "casa",
    "tipo_operacion": "venta",
    "valor_uf": "4500",
    "tipo_moneda": "UF",
    "ubicacion": "La Reina, Santiago",
    "direccion": "Av. Alcalde Fernando Castillo 1234",
    "dormitorios": "4",
    "banos": "3",
    "m2_totales": "180",
    "resumen": "Busca casa familiar zona oriente",
    "informe": "Cliente con liquidez, quiere visitar esta semana",
    "tipo_interes": "compra vivienda",
    "call_objective": "agendar_visita",
    "broker_name": "LexHouse",
    "agent_instructions": "instrucciones_estandar"
  },
  "to_number": "+56912345678",
  "call_objective": "agendar_visita"
}
```

Response éxito:
```json
{
  "success": true,
  "call_id": "call_1700000000_abc123",
  "elevenlabs_conversation_id": "conv_...",
  "voz_log_id": "uuid...",
  "remaining_minutes": 59,
  "dynamic_variables_sent": {
    "lead_name": "Juan Pérez",
    "broker_name": "LexHouse",
    "lead_phone": "+56912345678",
    "lead_interest": "compra vivienda",
    "lead_notes": "Cliente con liquidez, quiere visitar esta semana",
    "call_objective": "agendar_visita",
    "has_property": "true",
    "property_title": "Casa en La Reina",
    "property_operation": "venta",
    "property_type": "casa",
    "property_price": "4.500 UF",
    "property_city": "La Reina, Santiago",
    "property_address": "Av. Alcalde Fernando Castillo 1234",
    "property_bedrooms": "4",
    "property_bathrooms": "3",
    "property_sqm": "180",
    "property_description": "Cliente con liquidez, quiere visitar esta semana",
    "agent_instructions": "instrucciones_estandar"
  }
}
```

Response error (límite alcanzado):
```json
{
  "error": "VOZ_LIMITE_ALCANZADO",
  "code": "VOZ_LIMITE",
  "remaining_min": 0,
  "included_min": 60,
  "upgrade_url": "/settings?tab=plan"
}
```

### voice-tracker (webhook post-call)
```
POST https://owykkhwqpnumvgdeugmj.supabase.co/functions/v1/voice-tracker
Headers: X-ElevenLabs-Signature: <hmac_sha256>
Body (ElevenLabs):
{
  "conversation_id": "conv_...",
  "status": "completed",
  "metadata": {
    "duration_seconds": 185,
    "cost_usd": 0.42
  },
  "transcript": "Hola Juan... [transcripción completa]",
  "recording_url": "https://...",
  "ended_at": "2026-01-15T14:30:00Z"
}
```

### n8n Webhook (desde CRM / Botón "Llamar")
```
POST https://n8n.lexhouse-ai.online/webhook/voz/llamar
Body:
{
  "lead_data": { ... },  // o usar lead_id para buscar en Supabase
  "to_number": "+56912345678",
  "call_objective": "agendar_visita"
}
```

## 5. Flujo completo sincronizado

```
CRM (VoiceCrm.tsx / Botón "Llamar")
    ↓
n8n Webhook: /webhook/voz/llamar
    ↓
Normalizar Lead Data (Function node)
    ↓
HTTP Request → voice-orchestrator (Supabase Edge Function)
    ↓
voice-orchestrator:
  1. Verifica límites voz_minutos_disponibles(usuario)
  2. Construye dynamic_variables canónicas (17 vars)
  3. POST ElevenLabs /convai/twilio/outbound-call
  4. Inserta voice_llamadas (status=initiated)
    ↓
ElevenLabs + Twilio ejecutan llamada
    ↓
Post-call webhook → voice-tracker
    ↓
voice-tracker actualiza voice_llamadas:
  - duration_seconds, cost_usd, transcript, recording_url, status=completed
    ↓
Próxima llamada: voice_minutos_disponibles() ya refleja minutos usados
```

## 6. Mapeo de variables (Single Source of Truth)
Archivo: `supabase/functions/_shared/voice-variables.ts`

| ElevenLabs Variable | CRM Field | Transform |
|---------------------|-----------|-----------|
| lead_name | nombre | trim |
| broker_name | broker_name | default:LexHouse |
| lead_phone | telefono | normPhoneE164 (+569...) |
| lead_interest | tipo_interes | default:información general |
| lead_notes | resumen | default:sin notas |
| call_objective | call_objective | default:agendar_visita |
| has_property | propiedad | boolean (tiene propiedad?) |
| property_title | propiedad | string |
| property_operation | tipo_operacion | default:venta |
| property_type | tipo_propiedad | string |
| property_price | valor_uf + tipo_moneda | formatPriceWithCurrency |
| property_city | ubicacion | string |
| property_address | direccion | string |
| property_bedrooms | dormitorios | numberOrEmpty |
| property_bathrooms | banos | numberOrEmpty |
| property_sqm | m2_totales | numberOrEmpty |
| property_description | informe | string |
| agent_instructions | agent_instructions | default:instrucciones_estandar |

## 7. Planes y límites de voz (en plan_limites)

| Plan | voz_minutos_incluidos | voz_telephony_enabled | excedente_minuto_usd |
|------|----------------------|----------------------|---------------------|
| gratis | 0 | false | 0.15 |
| motor_ventas | 0 | false | 0.15 |
| growth | 60 | false | 0.15 |
| pro | 120 | false | 0.15 |
| enterprise | 300 | true | 0.15 |

## 8. Dashboard de consumo (ConsumoPlanPanel.tsx)
- Nueva barra "Voz (minutos)" con pctIncluido/pctExcedente
- Banner warning ≥80% consumo
- CTA upgrade cuando tope alcanzado