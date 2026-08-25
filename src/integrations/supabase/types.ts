export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      connection_state: {
        Row: {
          id: number
          phone: string | null
          qr_string: string | null
          status: string
          updated_at: number
        }
        Insert: {
          id: number
          phone?: string | null
          qr_string?: string | null
          status?: string
          updated_at?: number
        }
        Update: {
          id?: number
          phone?: string | null
          qr_string?: string | null
          status?: string
          updated_at?: number
        }
        Relationships: []
      }
      contactos_log: {
        Row: {
          canal: string
          created_at: string
          id: string
          lead_id: string
          mensaje_final: string | null
          origen: string
          plantilla_id: string | null
          resultado: string | null
          user_id: string
        }
        Insert: {
          canal: string
          created_at?: string
          id?: string
          lead_id: string
          mensaje_final?: string | null
          origen?: string
          plantilla_id?: string | null
          resultado?: string | null
          user_id: string
        }
        Update: {
          canal?: string
          created_at?: string
          id?: string
          lead_id?: string
          mensaje_final?: string | null
          origen?: string
          plantilla_id?: string | null
          resultado?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: number
          id: number
          jid: string | null
          last_message_at: number | null
          mode: string
          name: string | null
          phone: string
        }
        Insert: {
          created_at?: number
          id?: never
          jid?: string | null
          last_message_at?: number | null
          mode?: string
          name?: string | null
          phone: string
        }
        Update: {
          created_at?: number
          id?: never
          jid?: string | null
          last_message_at?: number | null
          mode?: string
          name?: string | null
          phone?: string
        }
        Relationships: []
      }
      correo_envios: {
        Row: {
          abierto_at: string | null
          asunto: string | null
          click_at: string | null
          clicks: number
          email: string
          empresa: string | null
          entregado_at: string | null
          enviado_at: string
          enviado_por: string | null
          error: string | null
          estado: string
          id: string
          nombre: string | null
          opens: number
          pais: string | null
          rebotado_at: string | null
          resend_id: string | null
          resend_key_index: number | null
          secuencia_nombre: string | null
          secuencia_paso: number | null
          ultimo_evento_at: string | null
        }
        Insert: {
          abierto_at?: string | null
          asunto?: string | null
          click_at?: string | null
          clicks?: number
          email: string
          empresa?: string | null
          entregado_at?: string | null
          enviado_at?: string
          enviado_por?: string | null
          error?: string | null
          estado?: string
          id?: string
          nombre?: string | null
          opens?: number
          pais?: string | null
          rebotado_at?: string | null
          resend_id?: string | null
          resend_key_index?: number | null
          secuencia_nombre?: string | null
          secuencia_paso?: number | null
          ultimo_evento_at?: string | null
        }
        Update: {
          abierto_at?: string | null
          asunto?: string | null
          click_at?: string | null
          clicks?: number
          email?: string
          empresa?: string | null
          entregado_at?: string | null
          enviado_at?: string
          enviado_por?: string | null
          error?: string | null
          estado?: string
          id?: string
          nombre?: string | null
          opens?: number
          pais?: string | null
          rebotado_at?: string | null
          resend_id?: string | null
          resend_key_index?: number | null
          secuencia_nombre?: string | null
          secuencia_paso?: number | null
          ultimo_evento_at?: string | null
        }
        Relationships: []
      }
      documentos_rag: {
        Row: {
          contenido: string
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          contenido: string
          embedding?: string | null
          id?: never
          metadata?: Json | null
        }
        Update: {
          contenido?: string
          embedding?: string | null
          id?: never
          metadata?: Json | null
        }
        Relationships: []
      }
      equipo_miembros: {
        Row: {
          created_at: string
          equipo_id: string
          rol_equipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipo_id: string
          rol_equipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipo_id?: string
          rol_equipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipo_miembros_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "equipos_venta"
            referencedColumns: ["id"]
          },
        ]
      }
      equipo_paises: {
        Row: {
          created_at: string
          equipo_id: string
          pais: string
        }
        Insert: {
          created_at?: string
          equipo_id: string
          pais: string
        }
        Update: {
          created_at?: string
          equipo_id?: string
          pais?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipo_paises_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "equipos_venta"
            referencedColumns: ["id"]
          },
        ]
      }
      equipos_venta: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      escalaciones: {
        Row: {
          asignado_a: string | null
          atendido_at: string | null
          created_at: string | null
          estado: string | null
          execution_id: string | null
          id: number
          motivo: string
          nombre_lead: string | null
          notas_asesor: string | null
          telefono: string
          ultima_respuesta_sofia: string | null
          ultimo_mensaje_usuario: string | null
          workflow_name: string | null
        }
        Insert: {
          asignado_a?: string | null
          atendido_at?: string | null
          created_at?: string | null
          estado?: string | null
          execution_id?: string | null
          id?: number
          motivo: string
          nombre_lead?: string | null
          notas_asesor?: string | null
          telefono: string
          ultima_respuesta_sofia?: string | null
          ultimo_mensaje_usuario?: string | null
          workflow_name?: string | null
        }
        Update: {
          asignado_a?: string | null
          atendido_at?: string | null
          created_at?: string | null
          estado?: string | null
          execution_id?: string | null
          id?: number
          motivo?: string
          nombre_lead?: string | null
          notas_asesor?: string | null
          telefono?: string
          ultima_respuesta_sofia?: string | null
          ultimo_mensaje_usuario?: string | null
          workflow_name?: string | null
        }
        Relationships: []
      }
      franquiciados: {
        Row: {
          calendar_id: string | null
          created_at: string | null
          id: string
          nombre: string
          timezone_base: string | null
        }
        Insert: {
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          nombre: string
          timezone_base?: string | null
        }
        Update: {
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          nombre?: string
          timezone_base?: string | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          content: string
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          contenido: string
          created_at: string
          id: string
          lead_id: string
          user_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          lead_id: string
          user_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_recovery_campaigns: {
        Row: {
          campaign_name: string
          channel: string | null
          contacted_email: number | null
          contacted_whatsapp: number | null
          converted: number | null
          created_at: string | null
          executed_at: string | null
          id: string
          message_template_email: string | null
          message_template_whatsapp: string | null
          responded: number | null
          status: string | null
          subject_email: string | null
          target_filters: Json | null
          total_leads: number | null
          user_id: string
        }
        Insert: {
          campaign_name: string
          channel?: string | null
          contacted_email?: number | null
          contacted_whatsapp?: number | null
          converted?: number | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          message_template_email?: string | null
          message_template_whatsapp?: string | null
          responded?: number | null
          status?: string | null
          subject_email?: string | null
          target_filters?: Json | null
          total_leads?: number | null
          user_id: string
        }
        Update: {
          campaign_name?: string
          channel?: string | null
          contacted_email?: number | null
          contacted_whatsapp?: number | null
          converted?: number | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          message_template_email?: string | null
          message_template_whatsapp?: string | null
          responded?: number | null
          status?: string | null
          subject_email?: string | null
          target_filters?: Json | null
          total_leads?: number | null
          user_id?: string
        }
        Relationships: []
      }
      lead_tags: {
        Row: {
          color: string
          created_at: string
          es_permanente: boolean
          id: string
          nombre: string
        }
        Insert: {
          color?: string
          created_at?: string
          es_permanente?: boolean
          id?: string
          nombre: string
        }
        Update: {
          color?: string
          created_at?: string
          es_permanente?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      leads_campana: {
        Row: {
          archivado: boolean | null
          bot_activo: boolean | null
          created_at: string | null
          dias_reales: number | null
          email: string | null
          equipo_id: string | null
          escalado_ia_at: string | null
          escalado_ia_motivo: string | null
          estado: string | null
          etapa_venta: string
          facebook: string | null
          fase_secuencia: number | null
          fecha_asignacion: string | null
          fecha_cierre: string | null
          fecha_proximo_contacto: string | null
          fecha_respuesta: string | null
          franquiciado_id: string | null
          ha_respondido: boolean | null
          id: string
          id_contacto: string | null
          instagram: string | null
          mensaje_instagram: string | null
          motivo_cierre: string | null
          nombre: string
          notas_vendedor: string | null
          origen: string | null
          pais: string | null
          primer_contacto_at: string | null
          prospecto_id: string | null
          puntuacion: number | null
          resumen_ia: string | null
          setter_id: string | null
          tag_ids: string[] | null
          telefono: string
          timezone: string | null
          traspasado_at: string | null
          ultimo_contacto_at: string | null
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          archivado?: boolean | null
          bot_activo?: boolean | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          equipo_id?: string | null
          escalado_ia_at?: string | null
          escalado_ia_motivo?: string | null
          estado?: string | null
          etapa_venta?: string
          facebook?: string | null
          fase_secuencia?: number | null
          fecha_asignacion?: string | null
          fecha_cierre?: string | null
          fecha_proximo_contacto?: string | null
          fecha_respuesta?: string | null
          franquiciado_id?: string | null
          ha_respondido?: boolean | null
          id?: string
          id_contacto?: string | null
          instagram?: string | null
          mensaje_instagram?: string | null
          motivo_cierre?: string | null
          nombre: string
          notas_vendedor?: string | null
          origen?: string | null
          pais?: string | null
          primer_contacto_at?: string | null
          prospecto_id?: string | null
          puntuacion?: number | null
          resumen_ia?: string | null
          setter_id?: string | null
          tag_ids?: string[] | null
          telefono: string
          timezone?: string | null
          traspasado_at?: string | null
          ultimo_contacto_at?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          archivado?: boolean | null
          bot_activo?: boolean | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          equipo_id?: string | null
          escalado_ia_at?: string | null
          escalado_ia_motivo?: string | null
          estado?: string | null
          etapa_venta?: string
          facebook?: string | null
          fase_secuencia?: number | null
          fecha_asignacion?: string | null
          fecha_cierre?: string | null
          fecha_proximo_contacto?: string | null
          fecha_respuesta?: string | null
          franquiciado_id?: string | null
          ha_respondido?: boolean | null
          id?: string
          id_contacto?: string | null
          instagram?: string | null
          mensaje_instagram?: string | null
          motivo_cierre?: string | null
          nombre?: string
          notas_vendedor?: string | null
          origen?: string | null
          pais?: string | null
          primer_contacto_at?: string | null
          prospecto_id?: string | null
          puntuacion?: number | null
          resumen_ia?: string | null
          setter_id?: string | null
          tag_ids?: string[] | null
          telefono?: string
          timezone?: string | null
          traspasado_at?: string | null
          ultimo_contacto_at?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campana_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "equipos_venta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campana_franquiciado_id_fkey"
            columns: ["franquiciado_id"]
            isOneToOne: false
            referencedRelation: "franquiciados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campana_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospeccion_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_campana_etapa_log: {
        Row: {
          created_at: string
          etapa_anterior: string | null
          etapa_nueva: string
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          etapa_anterior?: string | null
          etapa_nueva: string
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          etapa_anterior?: string | null
          etapa_nueva?: string
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campana_etapa_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_campana"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campana_etapa_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vista_inbox_contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_escaner: {
        Row: {
          apellidos: string | null
          archivo_origen: string | null
          campaign_name: string
          created_at: string
          email: string | null
          estado: string
          id: string
          id_contacto: string | null
          message_template: string | null
          nombre: string
          pais: string | null
          telefono: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apellidos?: string | null
          archivo_origen?: string | null
          campaign_name: string
          created_at?: string
          email?: string | null
          estado?: string
          id?: string
          id_contacto?: string | null
          message_template?: string | null
          nombre?: string
          pais?: string | null
          telefono: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apellidos?: string | null
          archivo_origen?: string | null
          campaign_name?: string
          created_at?: string
          email?: string | null
          estado?: string
          id?: string
          id_contacto?: string | null
          message_template?: string | null
          nombre?: string
          pais?: string | null
          telefono?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads_sheet: {
        Row: {
          apellidos: string | null
          dias_transcurridos: number
          email: string | null
          id_contacto: string
          nombres: string | null
          pais: string
          synced_at: string
          telefono: string | null
        }
        Insert: {
          apellidos?: string | null
          dias_transcurridos?: number
          email?: string | null
          id_contacto: string
          nombres?: string | null
          pais?: string
          synced_at?: string
          telefono?: string | null
        }
        Update: {
          apellidos?: string | null
          dias_transcurridos?: number
          email?: string | null
          id_contacto?: string
          nombres?: string | null
          pais?: string
          synced_at?: string
          telefono?: string | null
        }
        Relationships: []
      }
      mensajes_automatizacion: {
        Row: {
          campaign_name: string | null
          canal: string | null
          contenido: string
          created_at: string
          dia_secuencia: number | null
          direccion: string
          email: string | null
          estado_envio: string | null
          id: string
          id_contacto: string | null
          leido: boolean | null
          n8n_execution_id: string | null
          nombre: string | null
          pais: string | null
          plantilla_usada: string | null
          seq: number
          telefono: string
          user_id: string | null
          wamid: string | null
        }
        Insert: {
          campaign_name?: string | null
          canal?: string | null
          contenido: string
          created_at?: string
          dia_secuencia?: number | null
          direccion?: string
          email?: string | null
          estado_envio?: string | null
          id?: string
          id_contacto?: string | null
          leido?: boolean | null
          n8n_execution_id?: string | null
          nombre?: string | null
          pais?: string | null
          plantilla_usada?: string | null
          seq?: number
          telefono: string
          user_id?: string | null
          wamid?: string | null
        }
        Update: {
          campaign_name?: string | null
          canal?: string | null
          contenido?: string
          created_at?: string
          dia_secuencia?: number | null
          direccion?: string
          email?: string | null
          estado_envio?: string | null
          id?: string
          id_contacto?: string | null
          leido?: boolean | null
          n8n_execution_id?: string | null
          nombre?: string | null
          pais?: string | null
          plantilla_usada?: string | null
          seq?: number
          telefono?: string
          user_id?: string | null
          wamid?: string | null
        }
        Relationships: []
      }
      mensajes_whatsapp: {
        Row: {
          autor: string | null
          contenido: string
          created_at: string | null
          direccion: string
          estado_envio: string | null
          id: string
          leido: boolean | null
          media_type: string | null
          media_url: string | null
          seq: number
          telefono: string
          wamid: string | null
        }
        Insert: {
          autor?: string | null
          contenido: string
          created_at?: string | null
          direccion: string
          estado_envio?: string | null
          id?: string
          leido?: boolean | null
          media_type?: string | null
          media_url?: string | null
          seq?: number
          telefono: string
          wamid?: string | null
        }
        Update: {
          autor?: string | null
          contenido?: string
          created_at?: string | null
          direccion?: string
          estado_envio?: string | null
          id?: string
          leido?: boolean | null
          media_type?: string | null
          media_url?: string | null
          seq?: number
          telefono?: string
          wamid?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: number
          created_at: number
          id: number
          role: string
        }
        Insert: {
          content: string
          conversation_id: number
          created_at?: number
          id?: never
          role: string
        }
        Update: {
          content?: string
          conversation_id?: number
          created_at?: number
          id?: never
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox: {
        Row: {
          content: string
          conversation_id: number
          created_at: number
          id: number
          phone: string
          sent: boolean
        }
        Insert: {
          content: string
          conversation_id: number
          created_at?: number
          id?: never
          phone: string
          sent?: boolean
        }
        Update: {
          content?: string
          conversation_id?: number
          created_at?: number
          id?: never
          phone?: string
          sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "outbox_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_favoritos: {
        Row: {
          canal: string
          creado_at: string
          plantilla_id: string
          user_id: string
        }
        Insert: {
          canal: string
          creado_at?: string
          plantilla_id: string
          user_id: string
        }
        Update: {
          canal?: string
          creado_at?: string
          plantilla_id?: string
          user_id?: string
        }
        Relationships: []
      }
      plantillas_email: {
        Row: {
          activa: boolean
          asunto: string
          avatar_url: string | null
          bonus_text: string | null
          bonus_url: string | null
          brand_color: string
          creado_por: string | null
          created_at: string
          cta_text: string | null
          cta_url: string | null
          cta2_text: string | null
          cta2_url: string | null
          cuerpo_html: string
          cuerpo_text: string | null
          design_mode: string
          footer_text: string | null
          id: string
          logo_url: string | null
          nombre: string
          titulo: string | null
        }
        Insert: {
          activa?: boolean
          asunto: string
          avatar_url?: string | null
          bonus_text?: string | null
          bonus_url?: string | null
          brand_color?: string
          creado_por?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          cta2_text?: string | null
          cta2_url?: string | null
          cuerpo_html: string
          cuerpo_text?: string | null
          design_mode?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          nombre: string
          titulo?: string | null
        }
        Update: {
          activa?: boolean
          asunto?: string
          avatar_url?: string | null
          bonus_text?: string | null
          bonus_url?: string | null
          brand_color?: string
          creado_por?: string | null
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          cta2_text?: string | null
          cta2_url?: string | null
          cuerpo_html?: string
          cuerpo_text?: string | null
          design_mode?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          nombre?: string
          titulo?: string | null
        }
        Relationships: []
      }
      plantillas_whatsapp: {
        Row: {
          activa: boolean
          contenido: string
          creado_por: string | null
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          contenido: string
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          contenido?: string
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospeccion_busquedas: {
        Row: {
          cantidad_encontrada: number
          cantidad_solicitada: number
          ciudad: string
          creado_por: string | null
          created_at: string
          estadisticas: Json
          id: string
          motor: string
          nicho: string
          nuevos: number
          repetidos: number
          servicio: string | null
        }
        Insert: {
          cantidad_encontrada?: number
          cantidad_solicitada?: number
          ciudad: string
          creado_por?: string | null
          created_at?: string
          estadisticas?: Json
          id?: string
          motor?: string
          nicho: string
          nuevos?: number
          repetidos?: number
          servicio?: string | null
        }
        Update: {
          cantidad_encontrada?: number
          cantidad_solicitada?: number
          ciudad?: string
          creado_por?: string | null
          created_at?: string
          estadisticas?: Json
          id?: string
          motor?: string
          nicho?: string
          nuevos?: number
          repetidos?: number
          servicio?: string | null
        }
        Relationships: []
      }
      prospeccion_leads: {
        Row: {
          asignado_a: string | null
          busqueda_id: string | null
          ciudad: string | null
          creado_por: string | null
          created_at: string
          dedup_key: string | null
          direccion: string | null
          email: string | null
          en_campana: boolean
          estado_gestion: string
          facebook: string | null
          fuente: string | null
          google_maps: string | null
          id: string
          instagram: string | null
          lead_campana_id: string | null
          mensaje_email: string | null
          mensaje_instagram: string | null
          mensaje_whatsapp: string | null
          nivel: string | null
          nombre: string
          notas: string | null
          pais: string | null
          problemas: string[]
          propuesta_valor: string | null
          region: string | null
          score: number | null
          telefono: string | null
          tipo_lead: string | null
          updated_at: string
          web: string | null
          whatsapp: string | null
        }
        Insert: {
          asignado_a?: string | null
          busqueda_id?: string | null
          ciudad?: string | null
          creado_por?: string | null
          created_at?: string
          dedup_key?: string | null
          direccion?: string | null
          email?: string | null
          en_campana?: boolean
          estado_gestion?: string
          facebook?: string | null
          fuente?: string | null
          google_maps?: string | null
          id?: string
          instagram?: string | null
          lead_campana_id?: string | null
          mensaje_email?: string | null
          mensaje_instagram?: string | null
          mensaje_whatsapp?: string | null
          nivel?: string | null
          nombre: string
          notas?: string | null
          pais?: string | null
          problemas?: string[]
          propuesta_valor?: string | null
          region?: string | null
          score?: number | null
          telefono?: string | null
          tipo_lead?: string | null
          updated_at?: string
          web?: string | null
          whatsapp?: string | null
        }
        Update: {
          asignado_a?: string | null
          busqueda_id?: string | null
          ciudad?: string | null
          creado_por?: string | null
          created_at?: string
          dedup_key?: string | null
          direccion?: string | null
          email?: string | null
          en_campana?: boolean
          estado_gestion?: string
          facebook?: string | null
          fuente?: string | null
          google_maps?: string | null
          id?: string
          instagram?: string | null
          lead_campana_id?: string | null
          mensaje_email?: string | null
          mensaje_instagram?: string | null
          mensaje_whatsapp?: string | null
          nivel?: string | null
          nombre?: string
          notas?: string | null
          pais?: string | null
          problemas?: string[]
          propuesta_valor?: string | null
          region?: string | null
          score?: number | null
          telefono?: string | null
          tipo_lead?: string | null
          updated_at?: string
          web?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospeccion_leads_busqueda_id_fkey"
            columns: ["busqueda_id"]
            isOneToOne: false
            referencedRelation: "prospeccion_busquedas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccion_leads_lead_campana_id_fkey"
            columns: ["lead_campana_id"]
            isOneToOne: false
            referencedRelation: "leads_campana"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospeccion_leads_lead_campana_id_fkey"
            columns: ["lead_campana_id"]
            isOneToOne: false
            referencedRelation: "vista_inbox_contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          contenido: string
          created_at: string
          id: string
          titulo: string
          user_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          titulo: string
          user_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      secuencia_envios_programados: {
        Row: {
          asunto: string
          ciudad: string | null
          creado_por: string | null
          created_at: string
          cta_texto: string | null
          cta_url: string | null
          cuerpo: string
          datos: Json | null
          email: string
          empresa: string | null
          enviado_at: string | null
          enviar_en: string
          error: string | null
          estado: string
          from_email: string
          from_name: string
          gancho: string | null
          html: string | null
          id: string
          nombre: string | null
          pais: string | null
          paso: number
          remitente_modo: string | null
          reply_to: string | null
          resend_id: string | null
          secuencia_id: string | null
          secuencia_nombre: string | null
        }
        Insert: {
          asunto: string
          ciudad?: string | null
          creado_por?: string | null
          created_at?: string
          cta_texto?: string | null
          cta_url?: string | null
          cuerpo: string
          datos?: Json | null
          email: string
          empresa?: string | null
          enviado_at?: string | null
          enviar_en: string
          error?: string | null
          estado?: string
          from_email?: string
          from_name?: string
          gancho?: string | null
          html?: string | null
          id?: string
          nombre?: string | null
          pais?: string | null
          paso: number
          remitente_modo?: string | null
          reply_to?: string | null
          resend_id?: string | null
          secuencia_id?: string | null
          secuencia_nombre?: string | null
        }
        Update: {
          asunto?: string
          ciudad?: string | null
          creado_por?: string | null
          created_at?: string
          cta_texto?: string | null
          cta_url?: string | null
          cuerpo?: string
          datos?: Json | null
          email?: string
          empresa?: string | null
          enviado_at?: string | null
          enviar_en?: string
          error?: string | null
          estado?: string
          from_email?: string
          from_name?: string
          gancho?: string | null
          html?: string | null
          id?: string
          nombre?: string | null
          pais?: string | null
          paso?: number
          remitente_modo?: string | null
          reply_to?: string | null
          resend_id?: string | null
          secuencia_id?: string | null
          secuencia_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secuencia_envios_programados_secuencia_id_fkey"
            columns: ["secuencia_id"]
            isOneToOne: false
            referencedRelation: "secuencias_correo"
            referencedColumns: ["id"]
          },
        ]
      }
      secuencias_correo: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          total_pasos: number
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          total_pasos: number
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          total_pasos?: number
        }
        Relationships: []
      }
      secuencias_correo_pasos: {
        Row: {
          asunto: string
          created_at: string
          cta_texto: string | null
          cta_url: string | null
          cuerpo: string
          dias_desde_inicio: number
          guia_titulo: string | null
          hora_envio: string
          id: string
          paso: number
          secuencia_id: string
        }
        Insert: {
          asunto: string
          created_at?: string
          cta_texto?: string | null
          cta_url?: string | null
          cuerpo: string
          dias_desde_inicio?: number
          guia_titulo?: string | null
          hora_envio: string
          id?: string
          paso: number
          secuencia_id: string
        }
        Update: {
          asunto?: string
          created_at?: string
          cta_texto?: string | null
          cta_url?: string | null
          cuerpo?: string
          dias_desde_inicio?: number
          guia_titulo?: string | null
          hora_envio?: string
          id?: string
          paso?: number
          secuencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secuencias_correo_pasos_secuencia_id_fkey"
            columns: ["secuencia_id"]
            isOneToOne: false
            referencedRelation: "secuencias_correo"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedor_paises: {
        Row: {
          created_at: string
          pais: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pais: string
          user_id: string
        }
        Update: {
          created_at?: string
          pais?: string
          user_id?: string
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          activo: boolean
          created_at: string
          created_by: string | null
          limite_mensajes_dia: number
          nombre_display: string | null
          recibe_traspasos: boolean
          remitente_from_name: string | null
          remitente_local: string | null
          remitente_modo: string
          remitente_particular: string | null
          remitente_reply_to: string | null
          rol_venta: string
          telefono_contacto: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          limite_mensajes_dia?: number
          nombre_display?: string | null
          recibe_traspasos?: boolean
          remitente_from_name?: string | null
          remitente_local?: string | null
          remitente_modo?: string
          remitente_particular?: string | null
          remitente_reply_to?: string | null
          rol_venta?: string
          telefono_contacto?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          created_by?: string | null
          limite_mensajes_dia?: number
          nombre_display?: string | null
          recibe_traspasos?: boolean
          remitente_from_name?: string | null
          remitente_local?: string | null
          remitente_modo?: string
          remitente_particular?: string | null
          remitente_reply_to?: string | null
          rol_venta?: string
          telefono_contacto?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_jobs: {
        Row: {
          created_at: string
          download_url: string | null
          id: string
          is_hybrid: boolean
          progress: number
          status: string
          task_id: string
          tipo: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_hybrid?: boolean
          progress?: number
          status?: string
          task_id: string
          tipo: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          id?: string
          is_hybrid?: boolean
          progress?: number
          status?: string
          task_id?: string
          tipo?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vista_inbox_automatizacion: {
        Row: {
          campaign_name: string | null
          last_message_at: string | null
          last_message_dir: string | null
          last_message_text: string | null
          nombre: string | null
          pais: string | null
          senal: string | null
          telefono: string | null
          total_mensajes: number | null
          ultimo_dia: number | null
          ultimo_estado: string | null
          unread_count: number | null
        }
        Relationships: []
      }
      vista_inbox_contactos: {
        Row: {
          archivado: boolean | null
          bot_activo: boolean | null
          estado: string | null
          first_message_at: string | null
          first_message_dir: string | null
          id: string | null
          inbound_count: number | null
          is_ai_initiated: boolean | null
          last_message_at: string | null
          last_message_dir: string | null
          last_message_text: string | null
          nombre: string | null
          outbound_count: number | null
          pais: string | null
          senal: string | null
          tag_ids: string[] | null
          telefono: string | null
          unread_count: number | null
        }
        Relationships: []
      }
      vista_mensajes_automatizacion: {
        Row: {
          campaign_name: string | null
          contenido: string | null
          created_at: string | null
          dia_secuencia: number | null
          direccion: string | null
          estado_envio: string | null
          id: string | null
          leido: boolean | null
          media_type: string | null
          media_url: string | null
          phone_key: string | null
          seq: number | null
          sort_ts: string | null
          telefono: string | null
        }
        Relationships: []
      }
      vista_mensajes_whatsapp: {
        Row: {
          autor: string | null
          contenido: string | null
          created_at: string | null
          direccion: string | null
          estado_envio: string | null
          id: string | null
          leido: boolean | null
          media_type: string | null
          media_url: string | null
          phone_key: string | null
          seq: number | null
          telefono: string | null
          wamid: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_agregar_vendedor: {
        Args: { _email: string; _rol?: string }
        Returns: string
      }
      admin_asignar_leads: {
        Args: {
          _busqueda?: string
          _cantidad?: number
          _pais?: string
          _solo_captados_ia?: boolean
          _solo_sin_asignar?: boolean
          _vendedor_id: string
        }
        Returns: {
          asignados: number
        }[]
      }
      admin_busquedas_vendedor: {
        Args: { _user_id: string }
        Returns: {
          cantidad_encontrada: number
          ciudad: string
          contactados: number
          created_at: string
          en_crm: number
          id: string
          nicho: string
          nuevos: number
          total_leads: number
        }[]
      }
      admin_captados_ia_sin_asignar: { Args: never; Returns: number }
      admin_contactos_vendedor: {
        Args: { _limite?: number; _user_id: string }
        Returns: {
          canal: string
          created_at: string
          lead_nombre: string
          lead_telefono: string
          mensaje: string
          resultado: string
        }[]
      }
      admin_kpis_vendedores: {
        Args: never
        Returns: {
          activo: boolean
          archivados: number
          busquedas: number
          captados_ia: number
          contactado: number
          cta_email: number
          cta_facebook: number
          cta_instagram: number
          cta_llamada: number
          cta_whatsapp: number
          demo: number
          en_bandeja: number
          ganado: number
          interesado: number
          leads_total: number
          nombre_display: string
          perdido: number
          prospectos: number
          recibe_traspasos: boolean
          rol_venta: string
          traspaso_dados: number
          traspaso_recibidos: number
          ultima_actividad: string
          user_id: string
          vencidos: number
        }[]
      }
      admin_listar_vendedores: {
        Args: never
        Returns: {
          activo: boolean
          email: string
          limite_mensajes_dia: number
          nombre_display: string
          paises: string[]
          rol_venta: string
          telefono_contacto: string
          user_id: string
        }[]
      }
      bot_capta_lead: {
        Args: {
          _motivo?: string
          _nombre?: string
          _pais?: string
          _telefono: string
        }
        Returns: {
          creado: boolean
          etapa_anterior: string
          etapa_nueva: string
          lead_id: string
          revivido: boolean
          vendedor_id: string
          ya_estaba: boolean
        }[]
      }
      complete_onboarding: { Args: never; Returns: undefined }
      correo_envios_resumen: {
        Args: { _dias?: number }
        Returns: {
          abiertos: number
          clicks: number
          entregados: number
          rebotados: number
          total: number
        }[]
      }
      elegir_equipo_para: { Args: { _pais: string }; Returns: string }
      elegir_vendedor_para: { Args: { _pais: string }; Returns: string }
      has_crm_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      kpis_por_pais: {
        Args: never
        Returns: {
          pais: string
          pct: number
          promedio_dias: number
          recientes_7d: number
          total: number
        }[]
      }
      leads_campana_paises: {
        Args: never
        Returns: {
          n: number
          pais: string
        }[]
      }
      marcar_leidos_conversacion: {
        Args: { p_phone_key: string }
        Returns: number
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      mi_rol_en_equipo: { Args: { _equipo_id: string }; Returns: string }
      plantilla_stats: {
        Args: never
        Returns: {
          canal: string
          plantilla_id: string
          respondieron: number
          tasa_pct: number
          usos: number
        }[]
      }
      prospeccion_historial: {
        Args: never
        Returns: {
          cantidad_encontrada: number
          ciudad: string
          clientes: number
          contactados: number
          created_at: string
          estadisticas: Json
          id: string
          nicho: string
          nuevos: number
          repetidos: number
          servicio: string
          total_leads: number
        }[]
      }
      siguiente_closer: { Args: never; Returns: string }
      sync_id_contacto_from_sheet: { Args: never; Returns: Json }
      tel_norm: { Args: { _tel: string }; Returns: string }
      telefonos_contactados_wa: {
        Args: never
        Returns: {
          lead_id: string
          tel_norm: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      vendedor_activo: { Args: { _user_id: string }; Returns: boolean }
      vendedor_actualizar_lead: {
        Args: { _estado: string; _lead_id: string; _notas: string }
        Returns: undefined
      }
      vendedor_archivar_lead: {
        Args: { _archivado?: boolean; _lead_id: string }
        Returns: undefined
      }
      vendedor_bandeja_count: { Args: never; Returns: number }
      vendedor_contactos_por_canal: {
        Args: { _dias?: number }
        Returns: {
          canal: string
          contactos: number
        }[]
      }
      vendedor_correos_resumen: {
        Args: never
        Returns: {
          abierto_30d: number
          click_30d: number
          cupo_diario: number
          entregado_30d: number
          enviado_30d: number
          enviados_hoy: number
          fallido_30d: number
          rebotado_30d: number
          total_30d: number
        }[]
      }
      vendedor_ganados_por_semana: {
        Args: { _semanas?: number }
        Returns: {
          ganados: number
          semana: string
        }[]
      }
      vendedor_kpis: {
        Args: never
        Returns: {
          asignados: number
          contactados: number
          demos: number
          dias_promedio_cierre: number
          ganados: number
          interesados: number
          perdidos: number
          tasa_respuesta_pct: number
        }[]
      }
      vendedor_lead_detalle: { Args: { _lead_id: string }; Returns: Json }
      vendedor_liberar_a_pipeline: {
        Args: { _lead_ids: string[] }
        Returns: {
          liberados: number
        }[]
      }
      vendedor_mover_etapa: {
        Args: { _etapa: string; _lead_id: string; _motivo_cierre?: string }
        Returns: Json
      }
      vendedor_plantillas_usadas: {
        Args: never
        Returns: {
          canal: string
          nombre: string
          plantilla_id: string
          usos: number
        }[]
      }
      vendedor_prospectos_a_pipeline: {
        Args: { _prospecto_ids: string[]; _ya_contactados?: boolean }
        Returns: {
          creados: number
          omitidos: number
          vinculados: number
        }[]
      }
      vendedor_ranking: {
        Args: never
        Returns: {
          mi_puesto: number
          mis_ganados: number
          total_vendedores: number
        }[]
      }
      vendedor_registrar_lead_manual: {
        Args: {
          _email?: string
          _facebook?: string
          _instagram?: string
          _nombre: string
          _notas?: string
          _pais?: string
          _telefono?: string
        }
        Returns: string
      }
      vendedor_resultados_llamadas: {
        Args: { _dias?: number }
        Returns: {
          llamadas: number
          resultado: string
        }[]
      }
      vendedor_set_notas_lead: {
        Args: { _lead_id: string; _notas: string }
        Returns: undefined
      }
      vendedor_set_proximo_contacto: {
        Args: { _fecha: string; _lead_id: string }
        Returns: undefined
      }
      vendedor_set_remitente: {
        Args: {
          _from_name?: string
          _local?: string
          _modo: string
          _particular?: string
          _reply_to?: string
        }
        Returns: undefined
      }
      vendedor_toggle_bot: {
        Args: { _activo: boolean; _lead_id: string }
        Returns: undefined
      }
      vendedor_traspasados: { Args: never; Returns: number }
      vendedor_ve_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
      vendedor_ve_telefono: { Args: { _telefono: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "sub_admin" | "vendedor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user", "sub_admin", "vendedor"],
    },
  },
} as const
