// Knowledge base ingestion script
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Load environment variables
require('dotenv').config();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const KB_DIR = path.join(__dirname, '../kb');
const CHUNK_SIZE = 800; // tokens
const CHUNK_OVERLAP = 120; // tokens
const BATCH_SIZE = 5; // Embeddings per batch to avoid rate limits

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Chunk text into overlapping segments
 */
function chunkText(text, maxTokens = CHUNK_SIZE, overlapTokens = CHUNK_OVERLAP) {
  const words = text.split(/\s+/);
  const chunks = [];
  
  // Estimate words per chunk (conservative)
  const wordsPerChunk = Math.floor(maxTokens * 3.5); // ~3.5 chars per token avg
  const overlapWords = Math.floor(overlapTokens * 3.5);
  
  for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
  }
  
  return chunks;
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.trim(),
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Process embeddings in batches to respect rate limits
 */
async function generateEmbeddingsBatch(texts) {
  const embeddings = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    console.log(`  Generating embeddings for batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(texts.length/BATCH_SIZE)}`);
    
    try {
      const batchEmbeddings = await Promise.all(
        batch.map(text => generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
      
      // Rate limiting: wait between batches
      if (i + BATCH_SIZE < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error processing batch ${i}-${i+BATCH_SIZE}:`, error);
      throw error;
    }
  }
  
  return embeddings;
}

/**
 * Extract metadata from file path
 */
function extractMetadata(filePath, kbDir) {
  const relativePath = path.relative(kbDir, filePath);
  const pathParts = relativePath.split(path.sep);
  const fileName = path.basename(filePath, '.md');
  
  // Determine authority/namespace from directory structure
  let authority = 'fred_corpus';
  const tags = [];
  
  if (pathParts.length > 1) {
    const dirName = pathParts[0];
    authority = dirName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    tags.push(dirName);
    
    // Add subdirectories as tags
    if (pathParts.length > 2) {
      tags.push(...pathParts.slice(1, -1));
    }
  }
  
  return {
    authority,
    tags,
    fileName,
    relativePath
  };
}

/**
 * Extract title from markdown content
 */
function extractTitle(content, fallbackTitle) {
  const lines = content.split('\n');
  
  // Look for first H1 heading
  const h1Line = lines.find(line => line.startsWith('# '));
  if (h1Line) {
    return h1Line.replace('# ', '').trim();
  }
  
  // Look for first H2 heading as fallback
  const h2Line = lines.find(line => line.startsWith('## '));
  if (h2Line) {
    return h2Line.replace('## ', '').trim();
  }
  
  return fallbackTitle;
}

/**
 * Clean and prepare content for ingestion
 */
function prepareContent(content) {
  return content
    // Remove excessive whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Clean up markdown formatting for better chunking
    .replace(/^#{1,6}\s+/gm, '') // Remove header markers for content flow
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markers
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markers
    // Keep structure markers that are important
    .replace(/^- /gm, '• ') // Convert dashes to bullets
    .trim();
}

/**
 * Ingest a single markdown file
 */
async function ingestFile(filePath, kbDir) {
  try {
    console.log(`\nProcessing: ${path.relative(kbDir, filePath)}`);
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract metadata
    const metadata = extractMetadata(filePath, kbDir);
    const title = extractTitle(content, metadata.fileName);
    
    console.log(`  Title: ${title}`);
    console.log(`  Authority: ${metadata.authority}`);
    console.log(`  Tags: ${metadata.tags.join(', ')}`);
    
    // Prepare content
    const preparedContent = prepareContent(content);
    
    // Check if document already exists
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('title', title)
      .eq('authority', metadata.authority)
      .single();
    
    if (existingDoc) {
      console.log(`  ⚠️  Document already exists, skipping...`);
      return;
    }
    
    // Insert document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        title,
        body_md: content,
        tags: metadata.tags,
        authority: metadata.authority
      })
      .select()
      .single();
    
    if (docError) {
      console.error(`  ❌ Error inserting document:`, docError);
      return;
    }
    
    console.log(`  ✅ Document inserted with ID: ${document.id}`);
    
    // Chunk the content
    const chunks = chunkText(preparedContent);
    console.log(`  📄 Generated ${chunks.length} chunks`);
    
    if (chunks.length === 0) {
      console.log(`  ⚠️  No chunks generated, skipping embeddings`);
      return;
    }
    
    // Insert chunks first
    const chunkInserts = chunks.map((chunkContent, index) => ({
      document_id: document.id,
      content: chunkContent,
      chunk_index: index,
      tokens: estimateTokens(chunkContent),
      metadata: {
        file_path: metadata.relativePath,
        title: title,
        authority: metadata.authority
      }
    }));
    
    const { data: insertedChunks, error: chunkError } = await supabase
      .from('chunks')
      .insert(chunkInserts)
      .select();
    
    if (chunkError) {
      console.error(`  ❌ Error inserting chunks:`, chunkError);
      return;
    }
    
    console.log(`  ✅ Inserted ${insertedChunks.length} chunks`);
    
    // Generate embeddings for all chunks
    console.log(`  🧠 Generating embeddings...`);
    const embeddings = await generateEmbeddingsBatch(chunks);
    
    // Insert embeddings
    const embeddingInserts = insertedChunks.map((chunk, index) => ({
      chunk_id: chunk.id,
      embedding: embeddings[index]
    }));
    
    const { error: embeddingError } = await supabase
      .from('chunk_embeddings')
      .insert(embeddingInserts);
    
    if (embeddingError) {
      console.error(`  ❌ Error inserting embeddings:`, embeddingError);
      return;
    }
    
    console.log(`  ✅ Generated and stored ${embeddings.length} embeddings`);
    console.log(`  🎉 File processing complete!`);
    
  } catch (error) {
    console.error(`❌ Error processing file ${filePath}:`, error);
  }
}

/**
 * Find all markdown files in KB directory
 */
function findMarkdownFiles(dir) {
  const files = [];
  
  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const itemPath = path.join(currentDir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        scanDirectory(itemPath);
      } else if (stat.isFile() && item.endsWith('.md') && item !== 'README.md') {
        files.push(itemPath);
      }
    }
  }
  
  scanDirectory(dir);
  return files;
}

/**
 * Main ingestion function
 */
async function ingestKnowledgeBase() {
  console.log('🚀 Starting Fred Wav Knowledge Base Ingestion');
  console.log(`📁 KB Directory: ${KB_DIR}`);
  
  // Verify environment
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY environment variable');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }
  
  // Test database connection
  try {
    const { data, error } = await supabase.from('documents').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
  
  // Find all markdown files
  const markdownFiles = findMarkdownFiles(KB_DIR);
  console.log(`📚 Found ${markdownFiles.length} markdown files to process`);
  
  if (markdownFiles.length === 0) {
    console.log('⚠️  No markdown files found to ingest');
    return;
  }
  
  // Process files
  let processed = 0;
  let errors = 0;
  
  for (const filePath of markdownFiles) {
    try {
      await ingestFile(filePath, KB_DIR);
      processed++;
    } catch (error) {
      console.error(`❌ Failed to process ${filePath}:`, error);
      errors++;
    }
    
    // Rate limiting between files
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n🎉 Ingestion Complete!`);
  console.log(`✅ Successfully processed: ${processed} files`);
  console.log(`❌ Errors: ${errors} files`);
  console.log(`\n💡 Tip: Run this script again to add new files (existing ones will be skipped)`);
}

// Run ingestion if called directly
if (require.main === module) {
  ingestKnowledgeBase()
    .then(() => {
      console.log('✨ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  ingestKnowledgeBase,
  ingestFile
};