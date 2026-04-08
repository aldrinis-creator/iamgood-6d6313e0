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
          bp_diastolic: number | null
          bp_systolic: number | null
          breaths_per_min: number | null
          cadence: number | null
          calories: number | null
          created_at: string
          distance_km: number | null
          exercise_minutes: number
          exercise_type: string | null
          floors_climbed: number | null
          glucose_mg_dl: number | null
          heart_rate: number | null
          id: string
          log_date: string
          notes: string | null
          respiration_rate: number | null
          sleep_hours: number
          source: string
          spo2: number | null
          steps: number
          temperature_c: number | null
          user_id: string
        }
        Insert: {
          active_minutes?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          breaths_per_min?: number | null
          cadence?: number | null
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          exercise_minutes?: number
          exercise_type?: string | null
          floors_climbed?: number | null
          glucose_mg_dl?: number | null
          heart_rate?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          respiration_rate?: number | null
          sleep_hours?: number
          source?: string
          spo2?: number | null
          steps?: number
          temperature_c?: number | null
          user_id: string
        }
        Update: {
          active_minutes?: number | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          breaths_per_min?: number | null
          cadence?: number | null
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          exercise_minutes?: number
          exercise_type?: string | null
          floors_climbed?: number | null
          glucose_mg_dl?: number | null
          heart_rate?: number | null
          id?: string
          log_date?: string
          notes?: string | null
          respiration_rate?: number | null
          sleep_hours?: number
          source?: string
          spo2?: number | null
          steps?: number
          temperature_c?: number | null
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
          sentiment_data: Json | null
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
          sentiment_data?: Json | null
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
          sentiment_data?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emergency_share_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      encrypted_documents: {
        Row: {
          created_at: string
          doc_type: string
          encrypted_value: string
          id: string
          iv: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          encrypted_value: string
          id?: string
          iv: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          encrypted_value?: string
          id?: string
          iv?: string
          salt?: string
          updated_at?: string
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
      guardian_pings: {
        Row: {
          created_at: string
          guardian_read: boolean
          guardian_user_id: string
          id: string
          message: string
          read: boolean
          replied_at: string | null
          reply_message: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          guardian_read?: boolean
          guardian_user_id: string
          id?: string
          message: string
          read?: boolean
          replied_at?: string | null
          reply_message?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          guardian_read?: boolean
          guardian_user_id?: string
          id?: string
          message?: string
          read?: boolean
          replied_at?: string | null
          reply_message?: string | null
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
          guardian_user_id: string | null
          id: string
          is_primary: boolean
          is_vault_nominee: boolean
          nominated_at: string
          nomination_expires_at: string | null
          nomination_token: string | null
          relation: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guardian_email?: string | null
          guardian_name: string
          guardian_phone: string
          guardian_user_id?: string | null
          id?: string
          is_primary?: boolean
          is_vault_nominee?: boolean
          nominated_at?: string
          nomination_expires_at?: string | null
          nomination_token?: string | null
          relation?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guardian_email?: string | null
          guardian_name?: string
          guardian_phone?: string
          guardian_user_id?: string | null
          id?: string
          is_primary?: boolean
          is_vault_nominee?: boolean
          nominated_at?: string
          nomination_expires_at?: string | null
          nomination_token?: string | null
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
          family_doctor_name: string | null
          family_doctor_phone: string | null
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
          family_doctor_name?: string | null
          family_doctor_phone?: string | null
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
          family_doctor_name?: string | null
          family_doctor_phone?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jan_aushadhi_products: {
        Row: {
          category: string | null
          created_at: string
          drug_code: string | null
          generic_name: string
          id: string
          mrp: number
          salt_composition: string | null
          unit_size: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          drug_code?: string | null
          generic_name: string
          id?: string
          mrp?: number
          salt_composition?: string | null
          unit_size?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          drug_code?: string | null
          generic_name?: string
          id?: string
          mrp?: number
          salt_composition?: string | null
          unit_size?: string | null
        }
        Relationships: []
      }
      jan_aushadhi_stores: {
        Row: {
          address: string | null
          created_at: string
          district: string | null
          id: string
          lat: number | null
          lon: number | null
          phone: string | null
          pincode: string | null
          state: string | null
          store_name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          district?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          store_name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          district?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          store_name?: string
        }
        Relationships: []
      }
      journey_reports: {
        Row: {
          break_duration_min: number
          created_at: string
          destination_name: string
          deviation_count: number
          ended_at: string
          id: string
          journey_id: string
          max_deviation_m: number
          origin_name: string | null
          started_at: string
          total_distance_m: number
          total_duration_min: number
          transport_mode: string | null
          user_id: string
        }
        Insert: {
          break_duration_min?: number
          created_at?: string
          destination_name: string
          deviation_count?: number
          ended_at: string
          id?: string
          journey_id: string
          max_deviation_m?: number
          origin_name?: string | null
          started_at: string
          total_distance_m?: number
          total_duration_min?: number
          transport_mode?: string | null
          user_id: string
        }
        Update: {
          break_duration_min?: number
          created_at?: string
          destination_name?: string
          deviation_count?: number
          ended_at?: string
          id?: string
          journey_id?: string
          max_deviation_m?: number
          origin_name?: string | null
          started_at?: string
          total_distance_m?: number
          total_duration_min?: number
          transport_mode?: string | null
          user_id?: string
        }
        Relationships: []
      }
      journey_updates: {
        Row: {
          check_in_response: string | null
          created_at: string
          id: string
          journey_id: string
          lat: number | null
          lng: number | null
          user_id: string
        }
        Insert: {
          check_in_response?: string | null
          created_at?: string
          id?: string
          journey_id: string
          lat?: number | null
          lng?: number | null
          user_id: string
        }
        Update: {
          check_in_response?: string | null
          created_at?: string
          id?: string
          journey_id?: string
          lat?: number | null
          lng?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_updates_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          created_at: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          ended_at: string | null
          estimated_duration_min: number | null
          id: string
          origin_lat: number | null
          origin_lng: number | null
          origin_name: string | null
          started_at: string | null
          status: string
          transport_mode: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          ended_at?: string | null
          estimated_duration_min?: number | null
          id?: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_name?: string | null
          started_at?: string | null
          status?: string
          transport_mode?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          ended_at?: string | null
          estimated_duration_min?: number | null
          id?: string
          origin_lat?: number | null
          origin_lng?: number | null
          origin_name?: string | null
          started_at?: string | null
          status?: string
          transport_mode?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          created_at: string
          id: string
          items: Json
          log_date: string
          logged_at: string
          meal_name: string
          meal_type: string
          total_calories: number
          total_carbs_g: number
          total_fats_g: number
          total_fiber_g: number
          total_protein_g: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          log_date?: string
          logged_at?: string
          meal_name: string
          meal_type?: string
          total_calories?: number
          total_carbs_g?: number
          total_fats_g?: number
          total_fiber_g?: number
          total_protein_g?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          log_date?: string
          logged_at?: string
          meal_name?: string
          meal_type?: string
          total_calories?: number
          total_carbs_g?: number
          total_fats_g?: number
          total_fiber_g?: number
          total_protein_g?: number
          user_id?: string
        }
        Relationships: []
      }
      medical_history: {
        Row: {
          advice: string | null
          created_at: string
          doctor_name: string | null
          end_date: string | null
          hospital_name: string | null
          id: string
          medications: string | null
          nature: string | null
          reason: string
          start_date: string | null
          treatment: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advice?: string | null
          created_at?: string
          doctor_name?: string | null
          end_date?: string | null
          hospital_name?: string | null
          id?: string
          medications?: string | null
          nature?: string | null
          reason: string
          start_date?: string | null
          treatment?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advice?: string | null
          created_at?: string
          doctor_name?: string | null
          end_date?: string | null
          hospital_name?: string | null
          id?: string
          medications?: string | null
          nature?: string | null
          reason?: string
          start_date?: string | null
          treatment?: string | null
          type?: string
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
          activity_level: string | null
          age: number | null
          alcohol: string | null
          allergies: string[] | null
          blood_group: string | null
          created_at: string
          daily_calorie_goal: number | null
          date_of_birth: string | null
          diet_type: string
          dietary_preferences: string[] | null
          health_goals: string[] | null
          height_m: number | null
          id: string
          medical_conditions: string[] | null
          smoking: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          alcohol?: string | null
          allergies?: string[] | null
          blood_group?: string | null
          created_at?: string
          daily_calorie_goal?: number | null
          date_of_birth?: string | null
          diet_type?: string
          dietary_preferences?: string[] | null
          health_goals?: string[] | null
          height_m?: number | null
          id?: string
          medical_conditions?: string[] | null
          smoking?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          alcohol?: string | null
          allergies?: string[] | null
          blood_group?: string | null
          created_at?: string
          daily_calorie_goal?: number | null
          date_of_birth?: string | null
          diet_type?: string
          dietary_preferences?: string[] | null
          health_goals?: string[] | null
          height_m?: number | null
          id?: string
          medical_conditions?: string[] | null
          smoking?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      otp_events: {
        Row: {
          action: string
          created_at: string
          delivery_status: string | null
          delivery_time: string | null
          expires_at: string | null
          failure_reason: string | null
          id: string
          otp_code: string | null
          phone: string
          request_id: string | null
          status: string
          verified: boolean
        }
        Insert: {
          action?: string
          created_at?: string
          delivery_status?: string | null
          delivery_time?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          otp_code?: string | null
          phone: string
          request_id?: string | null
          status?: string
          verified?: boolean
        }
        Update: {
          action?: string
          created_at?: string
          delivery_status?: string | null
          delivery_time?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          otp_code?: string | null
          phone?: string
          request_id?: string | null
          status?: string
          verified?: boolean
        }
        Relationships: []
      }
      ppg_sessions: {
        Row: {
          avg_heart_rate: number | null
          created_at: string
          duration_sec: number
          id: string
          notes: string | null
          recorded_at: string
          samples: Json
          user_id: string
        }
        Insert: {
          avg_heart_rate?: number | null
          created_at?: string
          duration_sec?: number
          id?: string
          notes?: string | null
          recorded_at?: string
          samples?: Json
          user_id: string
        }
        Update: {
          avg_heart_rate?: number | null
          created_at?: string
          duration_sec?: number
          id?: string
          notes?: string | null
          recorded_at?: string
          samples?: Json
          user_id?: string
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
          gender: string | null
          height_m: number | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          height_m?: number | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          gender?: string | null
          height_m?: number | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          weight_kg?: number | null
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
      safe_zones: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_destinations: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean
          last_used_at: string
          lat: number
          lng: number
          name: string
          place_id: string | null
          use_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          last_used_at?: string
          lat: number
          lng: number
          name: string
          place_id?: string | null
          use_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          last_used_at?: string
          lat?: number
          lng?: number
          name?: string
          place_id?: string | null
          use_count?: number
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
      subscriptions: {
        Row: {
          amount_paise: number
          billing_cycle: string
          created_at: string
          expires_at: string
          id: string
          plan_type: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paise?: number
          billing_cycle: string
          created_at?: string
          expires_at: string
          id?: string
          plan_type: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          billing_cycle?: string
          created_at?: string
          expires_at?: string
          id?: string
          plan_type?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_facilities: {
        Row: {
          address: string | null
          created_at: string
          facility_type: string
          id: string
          lat: number
          lon: number
          name: string
          phone: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          facility_type: string
          id?: string
          lat: number
          lon: number
          name: string
          phone?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          facility_type?: string
          id?: string
          lat?: number
          lon?: number
          name?: string
          phone?: string | null
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
      vault_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
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
      guardians_emergency_safe: {
        Row: {
          guardian_name: string | null
          is_primary: boolean | null
          relation: string | null
          user_id: string | null
        }
        Insert: {
          guardian_name?: string | null
          is_primary?: boolean | null
          relation?: string | null
          user_id?: string | null
        }
        Update: {
          guardian_name?: string | null
          is_primary?: boolean | null
          relation?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_email_by_phone: { Args: { _phone: string }; Returns: string }
      guardian_ward_count: {
        Args: { _guardian_email: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_notification_deduped: {
        Args: {
          p_guardian_id?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      insert_notifications_deduped: {
        Args: { p_notifications: Json }
        Returns: undefined
      }
      link_guardian_user_id: { Args: never; Returns: undefined }
      lookup_emergency_token: {
        Args: { _token: string }
        Returns: {
          user_id: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
