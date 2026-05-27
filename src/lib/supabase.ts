import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn('⚠️ Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment. Running in demo mode.');
}

export const supabase = _supabase as SupabaseClient;

export interface LeadCampana {
  id: string;
  nombre: string;
  telefono: string;
  pais?: string | null;
  estado?: string | null;
  bot_activo?: boolean | null;
  campaign_id?: string | null;
  email?: string | null;
  archivado?: boolean | null;
  tag_ids?: string[] | null;
  id_contacto?: string | null;
}

export interface LeadTag {
  id: string;
  nombre: string;
  color: string;
}

export interface QuickReply {
  id: string;
  user_id: string;
  titulo: string;
  contenido: string;
  created_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  user_id: string;
  contenido: string;
  created_at: string;
}

export interface VistaSeguimientoCampana {
  id: string;
  nombre_campana?: string;
  total_leads?: number;
  enviados?: number;
  respondidos?: number;
  tasa_respuesta?: number;
  estado?: string;
  fecha_creacion?: string;
}

export interface MensajeWhatsapp {
  id: string;
  telefono: string;
  contenido: string;
  direccion: 'inbound' | 'outbound';
  autor?: string | null;
  leido?: boolean | null;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
}
