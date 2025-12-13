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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      blocked_numbers: {
        Row: {
          blocked_at: string
          id: string
          message_count: number | null
          phone_number: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_at?: string
          id?: string
          message_count?: number | null
          phone_number: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_at?: string
          id?: string
          message_count?: number | null
          phone_number?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      call_history: {
        Row: {
          audio_analysis: Json | null
          caller_id: string | null
          created_at: string
          duration: number
          fraud_indicators: string[] | null
          id: string
          notes: string | null
          recording_url: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
          scenario_type: string | null
          transcript: string | null
          transcript_segments: Json | null
          user_id: string
        }
        Insert: {
          audio_analysis?: Json | null
          caller_id?: string | null
          created_at?: string
          duration?: number
          fraud_indicators?: string[] | null
          id?: string
          notes?: string | null
          recording_url?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          scenario_type?: string | null
          transcript?: string | null
          transcript_segments?: Json | null
          user_id: string
        }
        Update: {
          audio_analysis?: Json | null
          caller_id?: string | null
          created_at?: string
          duration?: number
          fraud_indicators?: string[] | null
          id?: string
          notes?: string | null
          recording_url?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          scenario_type?: string | null
          transcript?: string | null
          transcript_segments?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          alert_type: string
          call_id: string | null
          created_at: string
          email_sent: boolean | null
          id: string
          message: string
          read: boolean | null
          user_id: string
        }
        Insert: {
          alert_type?: string
          call_id?: string | null
          created_at?: string
          email_sent?: boolean | null
          id?: string
          message: string
          read?: boolean | null
          user_id: string
        }
        Update: {
          alert_type?: string
          call_id?: string | null
          created_at?: string
          email_sent?: boolean | null
          id?: string
          message?: string
          read?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_history"
            referencedColumns: ["id"]
          },
        ]
      }
      text_messages: {
        Row: {
          analyzed_at: string
          detected_indicators: string[] | null
          id: string
          is_cyberbullying: boolean | null
          message_content: string
          sender_number: string
          threat_level: string | null
          user_id: string
        }
        Insert: {
          analyzed_at?: string
          detected_indicators?: string[] | null
          id?: string
          is_cyberbullying?: boolean | null
          message_content: string
          sender_number: string
          threat_level?: string | null
          user_id: string
        }
        Update: {
          analyzed_at?: string
          detected_indicators?: string[] | null
          id?: string
          is_cyberbullying?: boolean | null
          message_content?: string
          sender_number?: string
          threat_level?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      risk_level: "safe" | "warning" | "blocked"
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
      risk_level: ["safe", "warning", "blocked"],
    },
  },
} as const
