export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type PublicEnums = {
  approval_status: "pending" | "approved" | "rejected" | "cancelled";
  discount_policy_type: "percent_off" | "amount_off";
  opportunity_stage:
    | "prospecting"
    | "qualification"
    | "proposal"
    | "negotiation"
    | "closed_won"
    | "closed_lost";
  price_type: "list" | "customer_tier" | "customer_specific";
  product_status: "active" | "inactive" | "discontinued";
  quote_status:
    | "draft"
    | "needs_information"
    | "pending_approval"
    | "approved"
    | "sent"
    | "accepted"
    | "rejected"
    | "expired"
    | "cancelled";
  workflow_event_type:
    | "created"
    | "updated"
    | "extraction_failed"
    | "submitted_for_approval"
    | "approval_requested"
    | "approved"
    | "rejected"
    | "sent"
    | "accepted"
    | "cancelled"
    | "expired";
};

export type Database = {
  public: {
    Tables: {
      approvals: {
        Row: {
          approval_type: string;
          approver_id: string | null;
          comments: string | null;
          decided_at: string | null;
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          quote_id: string;
          requested_at: string;
          requested_by: string | null;
          required_role: string;
          status: PublicEnums["approval_status"];
          updated_at: string;
        };
        Insert: {
          approval_type?: string;
          approver_id?: string | null;
          comments?: string | null;
          decided_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          quote_id: string;
          requested_at?: string;
          requested_by?: string | null;
          required_role: string;
          status?: PublicEnums["approval_status"];
          updated_at?: string;
        };
        Update: {
          approval_type?: string;
          approver_id?: string | null;
          comments?: string | null;
          decided_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          quote_id?: string;
          requested_at?: string;
          requested_by?: string | null;
          required_role?: string;
          status?: PublicEnums["approval_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          billing_address: Json;
          billing_email: string | null;
          created_at: string;
          domain: string | null;
          external_id: string | null;
          id: string;
          legal_name: string | null;
          metadata: Json;
          name: string;
          phone: string | null;
          shipping_address: Json;
          updated_at: string;
        };
        Insert: {
          billing_address?: Json;
          billing_email?: string | null;
          created_at?: string;
          domain?: string | null;
          external_id?: string | null;
          id?: string;
          legal_name?: string | null;
          metadata?: Json;
          name: string;
          phone?: string | null;
          shipping_address?: Json;
          updated_at?: string;
        };
        Update: {
          billing_address?: Json;
          billing_email?: string | null;
          created_at?: string;
          domain?: string | null;
          external_id?: string | null;
          id?: string;
          legal_name?: string | null;
          metadata?: Json;
          name?: string;
          phone?: string | null;
          shipping_address?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      discount_policies: {
        Row: {
          active: boolean;
          amount_off: number;
          conditions: Json;
          created_at: string;
          description: string | null;
          discount_bps: number;
          ends_on: string | null;
          id: string;
          max_discount_bps: number;
          metadata: Json;
          minimum_margin_bps: number;
          name: string;
          policy_type: PublicEnums["discount_policy_type"];
          starts_on: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          amount_off?: number;
          conditions?: Json;
          created_at?: string;
          description?: string | null;
          discount_bps?: number;
          ends_on?: string | null;
          id?: string;
          max_discount_bps?: number;
          metadata?: Json;
          minimum_margin_bps?: number;
          name: string;
          policy_type?: PublicEnums["discount_policy_type"];
          starts_on?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          amount_off?: number;
          conditions?: Json;
          created_at?: string;
          description?: string | null;
          discount_bps?: number;
          ends_on?: string | null;
          id?: string;
          max_discount_bps?: number;
          metadata?: Json;
          minimum_margin_bps?: number;
          name?: string;
          policy_type?: PublicEnums["discount_policy_type"];
          starts_on?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          available_quantity: number;
          created_at: string;
          id: string;
          product_id: string;
          quantity_on_hand: number;
          quantity_reserved: number;
          refreshed_at: string;
          reorder_point: number;
          source_name: string;
          source_version: string;
          updated_at: string;
          warehouse_code: string;
        };
        Insert: {
          available_quantity?: never;
          created_at?: string;
          id?: string;
          product_id: string;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          refreshed_at?: string;
          reorder_point?: number;
          source_name?: string;
          source_version?: string;
          updated_at?: string;
          warehouse_code?: string;
        };
        Update: {
          available_quantity?: never;
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          refreshed_at?: string;
          reorder_point?: number;
          source_name?: string;
          source_version?: string;
          updated_at?: string;
          warehouse_code?: string;
        };
        Relationships: [];
      };
      opportunities: {
        Row: {
          created_at: string;
          currency_code: string;
          customer_id: string;
          estimated_amount: number;
          expected_close_date: string | null;
          external_id: string | null;
          id: string;
          metadata: Json;
          name: string;
          owner_id: string | null;
          stage: PublicEnums["opportunity_stage"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency_code?: string;
          customer_id: string;
          estimated_amount?: number;
          expected_close_date?: string | null;
          external_id?: string | null;
          id?: string;
          metadata?: Json;
          name: string;
          owner_id?: string | null;
          stage?: PublicEnums["opportunity_stage"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency_code?: string;
          customer_id?: string;
          estimated_amount?: number;
          expected_close_date?: string | null;
          external_id?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          owner_id?: string | null;
          stage?: PublicEnums["opportunity_stage"];
          updated_at?: string;
        };
        Relationships: [];
      };
      prices: {
        Row: {
          created_at: string;
          currency_code: string;
          customer_id: string | null;
          customer_tier: string | null;
          effective_from: string;
          effective_to: string | null;
          id: string;
          price_type: PublicEnums["price_type"];
          product_id: string;
          source_name: string;
          source_version: string;
          unit_cost: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          currency_code?: string;
          customer_id?: string | null;
          customer_tier?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          price_type?: PublicEnums["price_type"];
          product_id: string;
          source_name?: string;
          source_version?: string;
          unit_cost?: number;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          currency_code?: string;
          customer_id?: string | null;
          customer_tier?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          price_type?: PublicEnums["price_type"];
          product_id?: string;
          source_name?: string;
          source_version?: string;
          unit_cost?: number;
          unit_price?: number;
        };
        Relationships: [];
      };
      product_aliases: {
        Row: {
          alias: string;
          created_at: string;
          id: string;
          product_id: string;
          source: string;
        };
        Insert: {
          alias: string;
          created_at?: string;
          id?: string;
          product_id: string;
          source?: string;
        };
        Update: {
          alias?: string;
          created_at?: string;
          id?: string;
          product_id?: string;
          source?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          metadata: Json;
          name: string;
          sku: string;
          status: PublicEnums["product_status"];
          unit_of_measure: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: Json;
          name: string;
          sku: string;
          status?: PublicEnums["product_status"];
          unit_of_measure?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          sku?: string;
          status?: PublicEnums["product_status"];
          unit_of_measure?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quote_items: {
        Row: {
          created_at: string;
          description: string;
          discount_amount: number;
          discount_bps: number;
          id: string;
          line_number: number;
          line_total_amount: number;
          metadata: Json;
          product_id: string | null;
          quantity: number;
          quote_id: string;
          sku: string;
          unit_price: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          discount_amount?: number;
          discount_bps?: number;
          id?: string;
          line_number: number;
          line_total_amount: number;
          metadata?: Json;
          product_id?: string | null;
          quantity: number;
          quote_id: string;
          sku: string;
          unit_price: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          discount_amount?: number;
          discount_bps?: number;
          id?: string;
          line_number?: number;
          line_total_amount?: number;
          metadata?: Json;
          product_id?: string | null;
          quantity?: number;
          quote_id?: string;
          sku?: string;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: {
          accepted_at: string | null;
          approved_at: string | null;
          completed_at: string | null;
          created_at: string;
          currency_code: string;
          customer_id: string;
          discount_amount: number;
          id: string;
          metadata: Json;
          opportunity_id: string | null;
          quote_number: string;
          sent_at: string | null;
          sla_due_at: string | null;
          status: PublicEnums["quote_status"];
          submitted_at: string | null;
          subtotal_amount: number;
          tax_amount: number;
          total_amount: number;
          updated_at: string;
          valid_until: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          approved_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          currency_code?: string;
          customer_id: string;
          discount_amount?: number;
          id?: string;
          metadata?: Json;
          opportunity_id?: string | null;
          quote_number: string;
          sent_at?: string | null;
          sla_due_at?: string | null;
          status?: PublicEnums["quote_status"];
          submitted_at?: string | null;
          subtotal_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string;
          valid_until?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          approved_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          currency_code?: string;
          customer_id?: string;
          discount_amount?: number;
          id?: string;
          metadata?: Json;
          opportunity_id?: string | null;
          quote_number?: string;
          sent_at?: string | null;
          sla_due_at?: string | null;
          status?: PublicEnums["quote_status"];
          submitted_at?: string | null;
          subtotal_amount?: number;
          tax_amount?: number;
          total_amount?: number;
          updated_at?: string;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      workflow_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event_type: PublicEnums["workflow_event_type"];
          from_status: PublicEnums["quote_status"] | null;
          id: string;
          idempotency_key: string | null;
          payload: Json;
          quote_id: string;
          to_status: PublicEnums["quote_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event_type: PublicEnums["workflow_event_type"];
          from_status?: PublicEnums["quote_status"] | null;
          id?: string;
          idempotency_key?: string | null;
          payload?: Json;
          quote_id: string;
          to_status?: PublicEnums["quote_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event_type?: PublicEnums["workflow_event_type"];
          from_status?: PublicEnums["quote_status"] | null;
          id?: string;
          idempotency_key?: string | null;
          payload?: Json;
          quote_id?: string;
          to_status?: PublicEnums["quote_status"] | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: PublicEnums;
    CompositeTypes: Record<string, never>;
  };
};
