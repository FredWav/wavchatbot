// RAG (Retrieval-Augmented Generation) utilities
import OpenAI from 'openai'
import { supabase, type HybridSearchResult, type Document, type Chunk } from '../config/supabase'
import fs from 'fs'
import path from 'path'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Generate embeddings for text using OpenAI's ada-002 model
 */
export async function embed(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty for embedding')
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.trim(),
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
}

/**
 * Hybrid search combining BM25 text search and vector similarity
 */
export async function hybridSearch(
  queryVariants: string[], 
  options: { k: number; namespaces: string[] }
): Promise<HybridSearchResult[]> {
  const { k, namespaces } = options
  
  if (!queryVariants || queryVariants.length === 0) {
    return []
  }

  try {
    // Use the first query variant for embedding (could be enhanced to use multiple)
    const queryEmbedding = await embed(queryVariants[0])
    
    // Prepare namespace filter - combine fred_corpus with user namespaces
    const allNamespaces = ['fred_corpus', ...namespaces]
    
    // Call the hybrid search function from the database
    const { data, error } = await supabase.rpc('hybrid_search', {
      query_text: queryVariants[0],
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: k,
      user_namespace: namespaces.length > 0 ? namespaces[0] : null
    })

    if (error) {
      console.error('Hybrid search error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in hybrid search:', error)
    return []
  }
}

/**
 * Chunk text into overlapping segments for better retrieval
 */
function chunkText(text: string, maxTokens: number = 800, overlapTokens: number = 120): string[] {
  // Simple word-based chunking (could be enhanced with proper tokenization)
  const words = text.split(/\s+/)
  const chunks: string[] = []
  
  // Estimate ~4 characters per token for rough token counting
  const wordsPerChunk = Math.floor(maxTokens * 4 / 5) // Conservative estimate
  const overlapWords = Math.floor(overlapTokens * 4 / 5)
  
  for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
    const chunkWords = words.slice(i, i + wordsPerChunk)
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '))
    }
  }
  
  return chunks
}

/**
 * Count tokens (rough estimation)
 */
function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4)
}

/**
 * Ingest markdown files from a directory into the knowledge base
 */
export async function ingestMarkdown(dir: string): Promise<void> {
  try {
    const files = fs.readdirSync(dir, { recursive: true })
    
    for (const file of files) {
      if (typeof file !== 'string' || !file.endsWith('.md')) continue
      
      const filePath = path.join(dir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      
      // Extract metadata from file path and content
      const relativePath = path.relative(dir, filePath)
      const dirParts = relativePath.split(path.sep)
      const fileName = path.basename(file, '.md')
      
      // Determine authority/namespace from directory structure
      let authority = 'fred_corpus'
      const tags: string[] = []
      
      if (dirParts.length > 1) {
        authority = dirParts[0] // Use subdirectory as authority
        tags.push(...dirParts.slice(0, -1)) // Add directory path as tags
      }
      
      // Extract title from first line or use filename
      const lines = content.split('\n')
      const title = lines.find(line => line.startsWith('# '))?.replace('# ', '') || fileName
      
      // Insert document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          title,
          body_md: content,
          tags,
          authority
        })
        .select()
        .single()

      if (docError) {
        console.error(`Error inserting document ${filePath}:`, docError)
        continue
      }

      // Chunk the content
      const chunks = chunkText(content)
      
      // Insert chunks and generate embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i]
        const tokens = estimateTokens(chunkContent)
        
        // Insert chunk
        const { data: chunk, error: chunkError } = await supabase
          .from('chunks')
          .insert({
            document_id: document.id,
            content: chunkContent,
            chunk_index: i,
            tokens,
            metadata: {
              file_path: relativePath,
              title
            }
          })
          .select()
          .single()

        if (chunkError) {
          console.error(`Error inserting chunk ${i} for ${filePath}:`, chunkError)
          continue
        }

        // Generate and store embedding
        try {
          const embedding = await embed(chunkContent)
          
          const { error: embeddingError } = await supabase
            .from('chunk_embeddings')
            .insert({
              chunk_id: chunk.id,
              embedding
            })

          if (embeddingError) {
            console.error(`Error inserting embedding for chunk ${chunk.id}:`, embeddingError)
          }
        } catch (embeddingError) {
          console.error(`Error generating embedding for chunk ${chunk.id}:`, embeddingError)
        }
      }
      
      console.log(`Ingested: ${filePath} (${chunks.length} chunks)`)
    }
  } catch (error) {
    console.error('Error ingesting markdown directory:', error)
    throw error
  }
}

/**
 * Rewrite user query into multiple variants for better retrieval
 */
function rewriteQuery(userMessage: string): string[] {
  const variants: string[] = [userMessage]
  
  // Add some basic query variants
  // In a more sophisticated system, this could use an LLM to generate variants
  
  // Remove question words for keyword extraction
  const keywordVersion = userMessage
    .replace(/^(comment|pourquoi|que|qu'|qui|quoi|quand|où|combien)/i, '')
    .trim()
  
  if (keywordVersion && keywordVersion !== userMessage) {
    variants.push(keywordVersion)
  }
  
  // Add focused version without common words
  const focusedVersion = userMessage
    .replace(/\b(le|la|les|un|une|des|de|du|et|ou|avec|pour|sur|dans)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    
  if (focusedVersion && focusedVersion !== userMessage) {
    variants.push(focusedVersion)
  }
  
  return variants.slice(0, 3) // Limit to 3 variants
}

/**
 * Detect contradictions in retrieved chunks
 */
function detectContradictions(hits: HybridSearchResult[]): boolean {
  // Simple contradiction detection based on content analysis
  // In a more sophisticated system, this could use NLP techniques
  
  if (hits.length < 2) return false
  
  // Look for opposing words/phrases
  const contradictionPatterns = [
    { positive: ['oui', 'recommande', 'bien', 'efficace'], negative: ['non', 'déconseille', 'mal', 'inefficace'] },
    { positive: ['gratuit', 'free'], negative: ['payant', 'coût', 'prix'] },
    { positive: ['facile', 'simple'], negative: ['difficile', 'complexe'] }
  ]
  
  for (const pattern of contradictionPatterns) {
    let hasPositive = false
    let hasNegative = false
    
    for (const hit of hits) {
      const content = hit.content.toLowerCase()
      
      if (pattern.positive.some(word => content.includes(word))) {
        hasPositive = true
      }
      if (pattern.negative.some(word => content.includes(word))) {
        hasNegative = true
      }
    }
    
    if (hasPositive && hasNegative) {
      return true
    }
  }
  
  return false
}

/**
 * Main context retrieval function
 */
export async function retrieveContext(userMessage: string, userId: string): Promise<{
  hits: HybridSearchResult[]
  contradiction: boolean
}> {
  try {
    // Rewrite query into variants
    const queryVariants = rewriteQuery(userMessage)
    
    // Define namespaces: fred_corpus + user-specific namespace
    const namespaces = [`user_${userId}`]
    
    // Perform hybrid search
    const hits = await hybridSearch(queryVariants, {
      k: 8,
      namespaces
    })
    
    // Detect contradictions
    const contradiction = detectContradictions(hits)
    
    return {
      hits,
      contradiction
    }
  } catch (error) {
    console.error('Error retrieving context:', error)
    return {
      hits: [],
      contradiction: false
    }
  }
}