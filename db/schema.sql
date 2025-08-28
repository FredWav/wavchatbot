-- Database schema for Fred Wav Chatbot

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- embeddings
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- FTS type BM25-like

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body_md TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    authority TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_title_search ON documents USING gin(to_tsvector('french', title));
CREATE INDEX IF NOT EXISTS idx_documents_body_search  ON documents USING gin(to_tsvector('french', body_md));
CREATE INDEX IF NOT EXISTS idx_documents_tags         ON documents USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_documents_authority    ON documents(authority);

-- Chunks
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    tokens INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id   ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_content_search ON chunks USING gin(to_tsvector('french', content));
CREATE INDEX IF NOT EXISTS idx_chunks_metadata       ON chunks USING gin(metadata);

-- Embeddings
CREATE TABLE IF NOT EXISTS chunk_embeddings (
    chunk_id UUID PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_vector
  ON chunk_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id    ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id         ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role            ON messages(role);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Hybrid search function
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
