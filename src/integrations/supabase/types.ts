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
          opens: number
          rebotado_at: string | null
          resend_id: string | null
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
          opens?: number
          rebotado_at?: string | null
          resend_id?: string | null
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
          opens?: number
          rebotado_at?: string | null
          resend_id?: string | null
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
          estado: string | null
          fase_secuencia: number | null
          fecha_proximo_contacto: string | null
          fecha_respuesta: string | null
          franquiciado_id: string | null
          ha_respondido: boolean | null
          id: string
          id_contacto: string | null
          motivo_cierre: string | null
          nombre: string
          origen: string | null
          pais: string | null
          puntuacion: number | null
          resumen_ia: string | null
          tag_ids: string[] | null
          telefono: string
          timezone: string | null
          ultimo_contacto_at: string | null
          updated_at: string | null
        }
        Insert: {
          archivado?: boolean | null
          bot_activo?: boolean | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          estado?: string | null
          fase_secuencia?: number | null
          fecha_proximo_contacto?: string | null
          fecha_respuesta?: string | null
          franquiciado_id?: string | null
          ha_respondido?: boolean | null
          id?: string
          id_contacto?: string | null
          motivo_cierre?: string | null
          nombre: string
          origen?: string | null
          pais?: string | null
          puntuacion?: number | null
          resumen_ia?: string | null
          tag_ids?: string[] | null
          telefono: string
          timezone?: string | null
          ultimo_contacto_at?: string | null
          updated_at?: string | null
        }
        Update: {
          archivado?: boolean | null
          bot_activo?: boolean | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          estado?: string | null
          fase_secuencia?: number | null
          fecha_proximo_contacto?: string | null
          fecha_respuesta?: string | null
          franquiciado_id?: string | null
          ha_respondido?: boolean | null
          id?: string
          id_contacto?: string | null
          motivo_cierre?: string | null
          nombre?: string
          origen?: string | null
          pais?: string | null
          puntuacion?: number | null
          resumen_ia?: string | null
          tag_ids?: string[] | null
          telefono?: string
          timezone?: string | null
          ultimo_contacto_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campana_franquiciado_id_fkey"
            columns: ["franquiciado_id"]
            isOneToOne: false
            referencedRelation: "franquiciados"
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
          nicho?: string
          nuevos?: number
          repetidos?: number
          servicio?: string | null
        }
        Relationships: []
      }
      prospeccion_leads: {
        Row: {
          busqueda_id: string | null
          ciudad: string | null
          creado_por: string | null
          created_at: string
          dedup_key: string | null
          direccion: string | null
          email: string | null
          estado_gestion: string
          fuente: string | null
          google_maps: string | null
          id: string
          instagram: string | null
          mensaje_email: string | null
          mensaje_whatsapp: string | null
          nivel: string | null
          nombre: string
          notas: string | null
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
          busqueda_id?: string | null
          ciudad?: string | null
          creado_por?: string | null
          created_at?: string
          dedup_key?: string | null
          direccion?: string | null
          email?: string | null
          estado_gestion?: string
          fuente?: string | null
          google_maps?: string | null
          id?: string
          instagram?: string | null
          mensaje_email?: string | null
          mensaje_whatsapp?: string | null
          nivel?: string | null
          nombre: string
          notas?: string | null
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
          busqueda_id?: string | null
          ciudad?: string | null
          creado_por?: string | null
          created_at?: string
          dedup_key?: string | null
          direccion?: string | null
          email?: string | null
          estado_gestion?: string
          fuente?: string | null
          google_maps?: string | null
          id?: string
          instagram?: string | null
          mensaje_email?: string | null
          mensaje_whatsapp?: string | null
          nivel?: string | null
          nombre?: string
          notas?: string | null
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
      sync_id_contacto_from_sheet: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user" | "sub_admin"
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
  public: {
    Enums: {
      app_role: ["admin", "user", "sub_admin"],
    },
  },
} as const
