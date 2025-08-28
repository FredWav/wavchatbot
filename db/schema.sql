-- Database schema for Fred Wav Chatbot
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For BM25-like text search

-- Documents table: stores the original markdown files and content
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body_md TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    authority TEXT, -- Source authority/credibility level
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for full-text search and tags
CREATE INDEX idx_documents_title_search ON documents USING gin(to_tsvector('french', title));
CREATE INDEX idx_documents_body_search ON documents USING gin(to_tsvector('french', body_md));
CREATE INDEX idx_documents_tags ON documents USING gin(tags);
CREATE INDEX idx_documents_authority ON documents(authority);

-- Chunks table: stores processed chunks from documents
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    tokens INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for chunk retrieval
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_content_search ON chunks USING gin(to_tsvector('french', content));
CREATE INDEX idx_chunks_metadata ON chunks USING gin(metadata);

-- Chunk embeddings table: stores vector embeddings (OpenAI ada-002: 1536 dimensions)
CREATE TABLE chunk_embeddings (
    chunk_id UUID PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX idx_chunk_embeddings_vector ON chunk_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Conversations table: stores user conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Discord user ID or web session ID
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user conversations
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);

-- Messages table: stores individual messages in conversations
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- For storing additional context, sources, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for message retrieval
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- Update timestamps trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for hybrid search (BM25 + vector similarity)
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    user_namespace TEXT DEFAULT NULL
)
RETURNS TABLE (
    chunk_id UUID,
    content TEXT,
    similarity FLOAT,
    document_title TEXT,
    document_authority TEXT,
    bm25_score FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as chunk_id,
        c.content,
        1 - (e.embedding <=> query_embedding) as similarity,
        d.title as document_title,
        d.authority as document_authority,
        ts_rank_cd(to_tsvector('french', c.content), plainto_tsquery('french', query_text)) as bm25_score
    FROM chunks c
    JOIN chunk_embeddings e ON c.id = e.chunk_id
    JOIN documents d ON c.document_id = d.id
    WHERE 
        (1 - (e.embedding <=> query_embedding)) > match_threshold
        AND (
            user_namespace IS NULL 
            OR d.authority = 'fred_corpus' 
            OR d.authority = user_namespace
        )
    ORDER BY 
        (1 - (e.embedding <=> query_embedding)) DESC,
        ts_rank_cd(to_tsvector('french', c.content), plainto_tsquery('french', query_text)) DESC
    LIMIT match_count;
END;
$$;