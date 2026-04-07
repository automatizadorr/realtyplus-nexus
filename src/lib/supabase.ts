import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn('⚠️ Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment. Running in demo mode.');
}

// Export a proxy that won't crash when Supabase isn't configured
export const supabase = _supabase as SupabaseClient;

// Types based on existing tables
export interface LeadRecoveryCampaign {
  id: string;
  nombre: string;
  estado: string;
  fecha_creacion: string;
  mensaje_plantilla?: string;
  total_leads?: number;
  enviados?: number;
  respondidos?: number;
}

export interface LeadCampana {
  id: string;
  campaign_id: string;
  nombre: string;
  telefono: string;
  email?: string;
  estado?: string;
  fecha_contacto?: string;
}

export interface MensajeWhatsapp {
  id: string;
  telefono: string;
  mensaje: string;
  direccion: 'inbound' | 'outbound';
  fecha: string;
  estado?: string;
  campaign_id?: string;
}

export interface VistaSeguimientoCampana {
  id: string;
  nombre_campana: string;
  total_leads: number;
  enviados: number;
  respondidos: number;
  tasa_respuesta: number;
  estado: string;
  fecha_creacion: string;
}
