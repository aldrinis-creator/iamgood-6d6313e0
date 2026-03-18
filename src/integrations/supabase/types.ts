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
      activity_logs: {
        Row: {
          active_minutes: number | null
          breaths_per_min: number | null
          cadence: number | null
          calories: number | null
          created_at: string
          distance_km: number | null
          exercise_minutes: number
          exercise_type: string | null
          floors_climbed: number | null
          heart_rate: number | null
          id: string
          log_date: string
          notes: string | null
          sleep_hours: number
          spo2: number | null
          steps: number
          user_id: string
        }
        Insert: {
          active_minutes?: number | null
          breaths_per_min?: number | null
          cadence?: number | null
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          exercise_minutes?: number
          exercise_type?: string | null
          floors_climbed?: number | null
          heart_rate?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          sleep_hours?: number
          spo2?: number | null
          steps?: number
          user_id: string
        }
        Update: {
          active_minutes?: number | null
          breaths_per_min?: number | null
          cadence?: number | null
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          exercise_minutes?: number
          exercise_type?: string | null
          floors_climbed?: number | null
          heart_rate?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          sleep_hours?: number
          spo2?: number | null
          steps?: number
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          alarm_enabled: boolean
          alarm_sound: string
          appointment_type: string
          created_at: string
          description: string | null
          doctor_name: string | null
          end_date: string | null
          end_time: string | null
          first_alert: string
          id: string
          location: string | null
          recurrence: string
          second_alert: string | null
          share_status: string
          shared_with_doctor: boolean
          start_date: string
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alarm_enabled?: boolean
          alarm_sound?: string
          appointment_type?: string
          created_at?: string
          description?: string | null
          doctor_name?: string | null
          end_date?: string | null
          end_time?: string | null
          first_alert?: string
          id?: string
          location?: string | null
          recurrence?: string
          second_alert?: string | null
          share_status?: string
          shared_with_doctor?: boolean
          start_date: string
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alarm_enabled?: boolean
          alarm_sound?: string
          appointment_type?: string
          created_at?: string
          description?: string | null
          doctor_name?: string | null
          end_date?: string | null
          end_time?: string | null
          first_alert?: string
          id?: string
          location?: string | null
          recurrence?: string
          second_alert?: string | null
          share_status?: string
          shared_with_doctor?: boolean
          start_date?: string
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      care_journal: {
        Row: {
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          mood: string
          notes: string | null
          symptoms: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          mood: string
          notes?: string | null
          symptoms?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          mood?: string
          notes?: string | null
          symptoms?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          responded_at: string | null
          response: string | null
          scheduled_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          response?: string | null
          scheduled_at: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          responded_at?: string | null
          response?: string | null
          scheduled_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      face_scans: {
        Row: {
          confidence: string
          created_at: string
          heart_rate: number
          id: string
          sample_count: number
          scanned_at: string
          stress_level: string
          stress_score: number
          user_id: string
        }
        Insert: {
          confidence: string
          created_at?: string
          heart_rate: number
          id?: string
          sample_count?: number
          scanned_at?: string
          stress_level: string
          stress_score: number
          user_id: string
        }
        Update: {
          confidence?: string
          created_at?: string
          heart_rate?: number
          id?: string
          sample_count?: number
          scanned_at?: string
          stress_level?: string
          stress_score?: number
          user_id?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          created_at: string
          guardian_email: string | null
          guardian_name: string
          guardian_phone: string
          id: string
          is_primary: boolean
          is_vault_nominee: boolean
          nominated_at: string
          relation: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guardian_email?: string | null
          guardian_name: string
          guardian_phone: string
          id?: string
          is_primary?: boolean
          is_vault_nominee?: boolean
          nominated_at?: string
          relation?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guardian_email?: string | null
          guardian_name?: string
          guardian_phone?: string
          id?: string
          is_primary?: boolean
          is_vault_nominee?: boolean
          nominated_at?: string
          relation?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      health_profile: {
        Row: {
          allergies: string[] | null
          blood_group: string | null
          chronic_conditions: string[] | null
          created_at: string
          current_medications: string[] | null
          emergency_notes: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string[] | null
          blood_group?: string | null
          chronic_conditions?: string[] | null
          created_at?: string
          current_medications?: string[] | null
          emergency_notes?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string[] | null
          blood_group?: string | null
          chronic_conditions?: string[] | null
          created_at?: string
          current_medications?: string[] | null
          emergency_notes?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          created_at: string
          description: string | null
          doctor_name: string | null
          file_name: string | null
          file_url: string | null
          hospital_name: string | null
          id: string
          record_date: string | null
          record_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          doctor_name?: string | null
          file_name?: string | null
          file_url?: string | null
          hospital_name?: string | null
          id?: string
          record_date?: string | null
          record_type: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          doctor_name?: string | null
          file_name?: string | null
          file_url?: string | null
          hospital_name?: string | null
          id?: string
          record_date?: string | null
          record_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          scheduled_at: string
          status: string
          taken_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          scheduled_at: string
          status?: string
          taken_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          scheduled_at?: string
          status?: string
          taken_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          alarm_enabled: boolean
          alarm_mode: string
          created_at: string
          dosage: string
          end_date: string | null
          frequency: string
          id: string
          instructions: string | null
          low_stock_threshold: number
          name: string
          refill_reminder: boolean
          remaining_quantity: number
          schedule_times: string[]
          start_date: string
          total_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alarm_enabled?: boolean
          alarm_mode?: string
          created_at?: string
          dosage?: string
          end_date?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          low_stock_threshold?: number
          name: string
          refill_reminder?: boolean
          remaining_quantity?: number
          schedule_times?: string[]
          start_date?: string
          total_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alarm_enabled?: boolean
          alarm_mode?: string
          created_at?: string
          dosage?: string
          end_date?: string | null
          frequency?: string
          id?: string
          instructions?: string | null
          low_stock_threshold?: number
          name?: string
          refill_reminder?: boolean
          remaining_quantity?: number
          schedule_times?: string[]
          start_date?: string
          total_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          guardian_id: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guardian_id?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_personas: {
        Row: {
          age: number | null
          allergies: string[] | null
          created_at: string
          diet_type: string
          health_goals: string[] | null
          id: string
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          allergies?: string[] | null
          created_at?: string
          diet_type?: string
          health_goals?: string[] | null
          id?: string
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          allergies?: string[] | null
          created_at?: string
          diet_type?: string
          health_goals?: string[] | null
          id?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      privacy_requests: {
        Row: {
          created_at: string
          id: string
          legal_basis: string | null
          request_type: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          legal_basis?: string | null
          request_type: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          legal_basis?: string | null
          request_type?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      sos_events: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          resolved_at: string | null
          status: string
          trigger_type: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          resolved_at?: string | null
          status?: string
          trigger_type?: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          resolved_at?: string | null
          status?: string
          trigger_type?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wellness_logs: {
        Row: {
          created_at: string
          energy_level: number | null
          id: string
          log_date: string
          mindfulness_minutes: number | null
          mood: string
          mood_score: number
          notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          stress_level: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          energy_level?: number | null
          id?: string
          log_date?: string
          mindfulness_minutes?: number | null
          mood?: string
          mood_score?: number
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          energy_level?: number | null
          id?: string
          log_date?: string
          mindfulness_minutes?: number | null
          mood?: string
          mood_score?: number
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "guardian"
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
      app_role: ["admin", "moderator", "user", "guardian"],
    },
  },
} as const
