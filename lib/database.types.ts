export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string;
          privy_user_id: string;
          wallet_address: string | null;
          email: string | null;
          last_login: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          privy_user_id: string;
          wallet_address?: string | null;
          email?: string | null;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          privy_user_id?: string;
          wallet_address?: string | null;
          email?: string | null;
          last_login?: string | null;
        };
      };
      server_wallets: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          address: string;
          chain_id: number;
          // Renamed from encrypted_private_key
          private_key: string;
          is_active: boolean;
          balance: string | null;
          last_used: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          address: string;
          chain_id: number;
          // Renamed from encrypted_private_key
          private_key: string;
          is_active?: boolean;
          balance?: string | null;
          last_used?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          address?: string;
          chain_id?: number;
          // Renamed from encrypted_private_key
          private_key?: string;
          is_active?: boolean;
          balance?: string | null;
          last_used?: string | null;
        };
      };
      transactions: {
        Row: {
          id: string;
          created_at: string;
          from_address: string;
          to_address: string;
          amount: string;
          chain_id: number;
          hash: string | null;
          status: 'pending' | 'completed' | 'failed';
          user_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          from_address: string;
          to_address: string;
          amount: string;
          chain_id: number;
          hash?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          user_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          from_address?: string;
          to_address?: string;
          amount?: string;
          chain_id?: number;
          hash?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          user_id?: string;
        };
      };
      chat_history: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          message: string;
          sender: 'user' | 'ai';
          related_transaction_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          message: string;
          sender: 'user' | 'ai';
          related_transaction_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          message?: string;
          sender?: 'user' | 'ai';
          related_transaction_id?: string | null;
        };
      };
      budgets: {
        Row: {
          user_id: string;
          weekly_limit_cents: number;
          remaining_cents: number;
          period_start: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          weekly_limit_cents?: number;
          remaining_cents?: number;
          period_start?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>;
      };
      trade_intents: {
        Row: {
          id: string;
          user_id: string;
          market_id: string;
          side: 'yes' | 'no';
          price: number;
          size: number;
          status: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['trade_intents']['Row'],
          'id' | 'created_at' | 'status'
        > & {
          id?: string;
          created_at?: string;
          status?: string;
        };
        Update: Partial<Database['public']['Tables']['trade_intents']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          market_id: string;
          side: 'yes' | 'no';
          price: number;
          size: number;
          polymarket_order_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['orders']['Row'],
          'id' | 'created_at' | 'status' | 'polymarket_order_id'
        > & {
          id?: string;
          created_at?: string;
          status?: string;
          polymarket_order_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      autopilot_settings: {
        Row: {
          user_id: string;
          enabled: boolean;
          max_weekly_cents: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          enabled?: boolean;
          max_weekly_cents?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['autopilot_settings']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
