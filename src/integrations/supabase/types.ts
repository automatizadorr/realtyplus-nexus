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
      leads_campana: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          dias_reales: number | null
          email: string | null
          estado: string | null
          fase_secuencia: number | null
          fecha_proximo_contacto: string | null
          id: string
          nombre: string
          pais: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          estado?: string | null
          fase_secuencia?: number | null
          fecha_proximo_contacto?: string | null
          id?: string
          nombre: string
          pais?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          estado?: string | null
          fase_secuencia?: number | null
          fecha_proximo_contacto?: string | null
          id?: string
          nombre?: string
          pais?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_campana_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_recovery_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_realtyplus: {
        Row: {
          apellidos: string | null
          ciudad: string | null
          delegado: string | null
          email: string | null
          estado: string | null
          fec_alta: string | null
          id_contacto: number
          inactividad: number | null
          mod_franquicia: string | null
          nombres: string | null
          origen: string | null
          pais: string | null
          telefono: string | null
          ultima_tarea: string | null
          zona: string | null
        }
        Insert: {
          apellidos?: string | null
          ciudad?: string | null
          delegado?: string | null
          email?: string | null
          estado?: string | null
          fec_alta?: string | null
          id_contacto: number
          inactividad?: number | null
          mod_franquicia?: string | null
          nombres?: string | null
          origen?: string | null
          pais?: string | null
          telefono?: string | null
          ultima_tarea?: string | null
          zona?: string | null
        }
        Update: {
          apellidos?: string | null
          ciudad?: string | null
          delegado?: string | null
          email?: string | null
          estado?: string | null
          fec_alta?: string | null
          id_contacto?: number
          inactividad?: number | null
          mod_franquicia?: string | null
          nombres?: string | null
          origen?: string | null
          pais?: string | null
          telefono?: string | null
          ultima_tarea?: string | null
          zona?: string | null
        }
        Relationships: []
      }
      "LEx HOUSE AI BD": {
        Row: {
          apellidos: string | null
          asignado: string | null
          ciudad: string | null
          codigo_pais: string | null
          dias_transcurridos: number | null
          email: string | null
          estado: string | null
          fecha_registro: string | null
          id_contacto: number
          nombres: string | null
          origen: string | null
          pais: string | null
          PUNTUACION: number | null
          sub_estado: string | null
          telefono: string | null
        }
        Insert: {
          apellidos?: string | null
          asignado?: string | null
          ciudad?: string | null
          codigo_pais?: string | null
          dias_transcurridos?: number | null
          email?: string | null
          estado?: string | null
          fecha_registro?: string | null
          id_contacto?: number
          nombres?: string | null
          origen?: string | null
          pais?: string | null
          PUNTUACION?: number | null
          sub_estado?: string | null
          telefono?: string | null
        }
        Update: {
          apellidos?: string | null
          asignado?: string | null
          ciudad?: string | null
          codigo_pais?: string | null
          dias_transcurridos?: number | null
          email?: string | null
          estado?: string | null
          fecha_registro?: string | null
          id_contacto?: number
          nombres?: string | null
          origen?: string | null
          pais?: string | null
          PUNTUACION?: number | null
          sub_estado?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      mensajes_whatsapp: {
        Row: {
          contenido: string
          created_at: string | null
          direccion: string
          id: string
          leido: boolean | null
          telefono: string
        }
        Insert: {
          contenido: string
          created_at?: string | null
          direccion: string
          id?: string
          leido?: boolean | null
          telefono: string
        }
        Update: {
          contenido?: string
          created_at?: string | null
          direccion?: string
          id?: string
          leido?: boolean | null
          telefono?: string
        }
        Relationships: []
      }
    }
    Views: {
      vista_seguimiento_campana: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          dias_reales: number | null
          email: string | null
          estado: string | null
          fase_secuencia: number | null
          fecha_proximo_contacto: string | null
          id: string | null
          lead_name: string | null
          origin: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          estado?: string | null
          fase_secuencia?: number | null
          fecha_proximo_contacto?: string | null
          id?: string | null
          lead_name?: string | null
          origin?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          dias_reales?: number | null
          email?: string | null
          estado?: string | null
          fase_secuencia?: number | null
          fecha_proximo_contacto?: string | null
          id?: string | null
          lead_name?: string | null
          origin?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campana_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_recovery_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
