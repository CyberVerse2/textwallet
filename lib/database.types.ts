export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at: string
          privy_user_id: string
          email: string | null
          last_login: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          privy_user_id: string
          email?: string | null
          last_login?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          privy_user_id?: string
          email?: string | null
          last_login?: string | null
        }
      }
      server_wallets: {
        Row: {
          id: string
          created_at: string
          user_id: string
          address: string
          chain_id: number
          // Renamed from encrypted_private_key
          private_key: string 
          is_active: boolean
          balance: string | null
          last_used: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          address: string
          chain_id: number
          // Renamed from encrypted_private_key
          private_key: string 
          is_active?: boolean
          balance?: string | null
          last_used?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          address?: string
          chain_id?: number
          // Renamed from encrypted_private_key
          private_key?: string 
          is_active?: boolean
          balance?: string | null
          last_used?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          created_at: string
          from_address: string
          to_address: string
          amount: string
          chain_id: number
          hash: string | null
          status: 'pending' | 'completed' | 'failed'
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          from_address: string
          to_address: string
          amount: string
          chain_id: number
          hash?: string | null
          status?: 'pending' | 'completed' | 'failed'
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          from_address?: string
          to_address?: string
          amount?: string
          chain_id?: number
          hash?: string | null
          status?: 'pending' | 'completed' | 'failed'
          user_id?: string
        }
      }
      chat_history: {
        Row: {
          id: string
          created_at: string
          user_id: string
          message: string
          sender: 'user' | 'ai'
          related_transaction_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          message: string
          sender: 'user' | 'ai'
          related_transaction_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          message?: string
          sender?: 'user' | 'ai'
          related_transaction_id?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
