// Supabase configuration and client setup
import { createClient } from '@supabase/supabase-js'

// Environment variables validation
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE')
}

// Create Supabase client with service role for server-side operations
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  db: {
    schema: 'public'
  }
})

// Types for database tables
export interface Document {
  id: string
  title: string
  body_md: string
  tags: string[]
  authority: string
  created_at: string
  updated_at: string
}

export interface Chunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  tokens: number
  metadata: Record<string, any>
  created_at: string
}

export interface ChunkEmbedding {
  chunk_id: string
  embedding: number[]
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title?: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, any>
  created_at: string
}

export interface HybridSearchResult {
  chunk_id: string
  content: string
  similarity: number
  document_title: string
  document_authority: string
  bm25_score: number
}