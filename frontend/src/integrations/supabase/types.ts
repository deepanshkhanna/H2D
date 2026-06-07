export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      case_events: {
        Row: {
          case_id: string;
          id: string;
          kind: Database["public"]["Enums"]["case_event_kind"];
          occurred_at: string;
          payload: Json | null;
          title: string;
          user_id: string;
        };
        Insert: {
          case_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["case_event_kind"];
          occurred_at?: string;
          payload?: Json | null;
          title: string;
          user_id: string;
        };
        Update: {
          case_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["case_event_kind"];
          occurred_at?: string;
          payload?: Json | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      cases: {
        Row: {
          created_at: string;
          financial_exposure_cents: number;
          id: string;
          reference: string;
          severity: Database["public"]["Enums"]["case_severity"];
          status: Database["public"]["Enums"]["case_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          financial_exposure_cents?: number;
          id?: string;
          reference: string;
          severity?: Database["public"]["Enums"]["case_severity"];
          status?: Database["public"]["Enums"]["case_status"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          financial_exposure_cents?: number;
          id?: string;
          reference?: string;
          severity?: Database["public"]["Enums"]["case_severity"];
          status?: Database["public"]["Enums"]["case_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      conclusion_evidence: {
        Row: {
          conclusion_id: string;
          evidence_id: string;
          user_id: string;
        };
        Insert: {
          conclusion_id: string;
          evidence_id: string;
          user_id: string;
        };
        Update: {
          conclusion_id?: string;
          evidence_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conclusion_evidence_conclusion_id_fkey";
            columns: ["conclusion_id"];
            isOneToOne: false;
            referencedRelation: "conclusions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conclusion_evidence_evidence_id_fkey";
            columns: ["evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence";
            referencedColumns: ["id"];
          },
        ];
      };
      conclusions: {
        Row: {
          case_id: string;
          confidence: number;
          created_at: string;
          financial_exposure_cents: number;
          id: string;
          input_hash: string | null;
          is_primary: boolean;
          model_name: string;
          model_run_at: string;
          needs_human_review: boolean;
          reasoning: string;
          recommended_action: string | null;
          root_cause: string;
          severity: Database["public"]["Enums"]["case_severity"];
          strength_label: Database["public"]["Enums"]["strength_label"];
          title: string;
          user_id: string;
        };
        Insert: {
          case_id: string;
          confidence: number;
          created_at?: string;
          financial_exposure_cents?: number;
          id?: string;
          input_hash?: string | null;
          is_primary?: boolean;
          model_name?: string;
          model_run_at?: string;
          needs_human_review?: boolean;
          reasoning: string;
          recommended_action?: string | null;
          root_cause: string;
          severity?: Database["public"]["Enums"]["case_severity"];
          strength_label: Database["public"]["Enums"]["strength_label"];
          title: string;
          user_id: string;
        };
        Update: {
          case_id?: string;
          confidence?: number;
          created_at?: string;
          financial_exposure_cents?: number;
          id?: string;
          input_hash?: string | null;
          is_primary?: boolean;
          model_name?: string;
          model_run_at?: string;
          needs_human_review?: boolean;
          reasoning?: string;
          recommended_action?: string | null;
          root_cause?: string;
          severity?: Database["public"]["Enums"]["case_severity"];
          strength_label?: Database["public"]["Enums"]["strength_label"];
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conclusions_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      entities: {
        Row: {
          case_id: string;
          confidence: number;
          created_at: string;
          id: string;
          source_evidence_id: string;
          type: string;
          user_id: string;
          value: string;
        };
        Insert: {
          case_id: string;
          confidence?: number;
          created_at?: string;
          id?: string;
          source_evidence_id: string;
          type: string;
          user_id: string;
          value: string;
        };
        Update: {
          case_id?: string;
          confidence?: number;
          created_at?: string;
          id?: string;
          source_evidence_id?: string;
          type?: string;
          user_id?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entities_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entities_source_evidence_id_fkey";
            columns: ["source_evidence_id"];
            isOneToOne: false;
            referencedRelation: "evidence";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence: {
        Row: {
          case_id: string;
          extracted_json: Json | null;
          filename: string;
          id: string;
          input_hash: string | null;
          kind: Database["public"]["Enums"]["evidence_kind"];
          mime_type: string | null;
          status: Database["public"]["Enums"]["evidence_status"];
          storage_path: string;
          summary: string | null;
          uploaded_at: string;
          user_id: string;
        };
        Insert: {
          case_id: string;
          extracted_json?: Json | null;
          filename: string;
          id?: string;
          input_hash?: string | null;
          kind: Database["public"]["Enums"]["evidence_kind"];
          mime_type?: string | null;
          status?: Database["public"]["Enums"]["evidence_status"];
          storage_path: string;
          summary?: string | null;
          uploaded_at?: string;
          user_id: string;
        };
        Update: {
          case_id?: string;
          extracted_json?: Json | null;
          filename?: string;
          id?: string;
          input_hash?: string | null;
          kind?: Database["public"]["Enums"]["evidence_kind"];
          mime_type?: string | null;
          status?: Database["public"]["Enums"]["evidence_status"];
          storage_path?: string;
          summary?: string | null;
          uploaded_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      case_event_kind:
        | "evidence_uploaded"
        | "entity_extracted"
        | "correlation_found"
        | "conclusion_generated"
        | "status_changed";
      case_severity: "low" | "medium" | "high" | "critical";
      case_status: "investigating" | "correlating" | "review_needed" | "confirmed" | "resolved";
      evidence_kind: "invoice" | "email" | "manifest" | "inspection" | "photo" | "other";
      evidence_status: "uploaded" | "extracting" | "extracted" | "failed";
      strength_label: "strong" | "confirmed" | "likely" | "weak" | "unverified";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      case_event_kind: [
        "evidence_uploaded",
        "entity_extracted",
        "correlation_found",
        "conclusion_generated",
        "status_changed",
      ],
      case_severity: ["low", "medium", "high", "critical"],
      case_status: ["investigating", "correlating", "review_needed", "confirmed", "resolved"],
      evidence_kind: ["invoice", "email", "manifest", "inspection", "photo", "other"],
      evidence_status: ["uploaded", "extracting", "extracted", "failed"],
      strength_label: ["strong", "confirmed", "likely", "weak", "unverified"],
    },
  },
} as const;
