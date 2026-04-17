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
      projects: {
        Row: {
          id: string
          image_url: string
          video_url: string
          tracking_url: string
          overlay_x: number
          overlay_y: number
          overlay_scale: number
          created_at: string
        }
        Insert: {
          id?: string
          image_url: string
          video_url: string
          tracking_url: string
          overlay_x?: number
          overlay_y?: number
          overlay_scale?: number
          created_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          video_url?: string
          tracking_url?: string
          overlay_x?: number
          overlay_y?: number
          overlay_scale?: number
          created_at?: string
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
