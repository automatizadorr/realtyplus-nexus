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
      contactos: {
        Row: {
          apellidos: string | null
          email: string
          fecha_creacion: string | null
          id_contacto: number
          nombres: string
          pais: string
          telefono: string | null
        }
        Insert: {
          apellidos?: string | null
          email: string
          fecha_creacion?: string | null
          id_contacto: number
          nombres: string
          pais: string
          telefono?: string | null
        }
        Update: {
          apellidos?: string | null
          email?: string
          fecha_creacion?: string | null
          id_contacto?: number
          nombres?: string
          pais?: string
          telefono?: string | null
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
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
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
          id: string
          leido: boolean | null
          media_type: string | null
          media_url: string | null
          telefono: string
        }
        Insert: {
          autor?: string | null
          contenido: string
          created_at?: string | null
          direccion: string
          id?: string
          leido?: boolean | null
          media_type?: string | null
          media_url?: string | null
          telefono: string
        }
        Update: {
          autor?: string | null
          contenido?: string
          created_at?: string | null
          direccion?: string
          id?: string
          leido?: boolean | null
          media_type?: string | null
          media_url?: string | null
          telefono?: string
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
          tag_ids: string[] | null
          telefono: string | null
          unread_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
