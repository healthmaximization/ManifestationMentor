export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          company_role: string;
          membership: "lite" | "pro";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      membership_entitlements: {
        Row: {
          id: string;
          email: string;
          membership: "lite" | "pro";
          source: string;
          external_id: string | null;
          status: "active" | "inactive";
          event_type: string | null;
          raw_payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["membership_entitlements"]["Row"]> & {
          email: string;
          membership: "lite" | "pro";
        };
        Update: Partial<Database["public"]["Tables"]["membership_entitlements"]["Row"]>;
        Relationships: [];
      };
      manifestation_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["manifestation_conversations"]["Insert"]>;
        Relationships: [];
      };
      manifestation_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["manifestation_messages"]["Insert"]>;
        Relationships: [];
      };
      manifestation_training_config: {
        Row: {
          id: string;
          tone: string;
          response_length: string;
          personality_traits: string[];
          custom_instructions: string;
          methodology: string;
          banned_phrases: string[];
          qa_pairs: Json;
          system_prompt: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["manifestation_training_config"]["Row"]> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["manifestation_training_config"]["Row"]>;
        Relationships: [];
      };
      manifestation_training_documents: {
        Row: {
          id: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          storage_path: string;
          extracted_text: string | null;
          status: "processing" | "indexed" | "ready" | "error";
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          storage_path: string;
          extracted_text?: string | null;
          status?: "processing" | "indexed" | "ready" | "error";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["manifestation_training_documents"]["Insert"]>;
        Relationships: [];
      };
      subliminal_projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          intention: string | null;
          status: "draft" | "generating" | "ready" | "archived" | "error";
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subliminal_projects"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["subliminal_projects"]["Row"]>;
        Relationships: [];
      };
      subliminal_scripts: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          script_text: string;
          voice_style: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subliminal_scripts"]["Row"]> & {
          project_id: string;
          user_id: string;
          script_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["subliminal_scripts"]["Row"]>;
        Relationships: [];
      };
      subliminal_audio_jobs: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          status: "queued" | "processing" | "ready" | "error";
          storage_path: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subliminal_audio_jobs"]["Row"]> & {
          project_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["subliminal_audio_jobs"]["Row"]>;
        Relationships: [];
      };
      subliminal_exports: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          storage_path: string;
          format: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subliminal_exports"]["Row"]> & {
          project_id: string;
          user_id: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["subliminal_exports"]["Row"]>;
        Relationships: [];
      };
      subliminal_playlists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subliminal_playlists"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["subliminal_playlists"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
