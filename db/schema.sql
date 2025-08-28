-- Database schema for Fred Wav Chatbot
-- Will be implemented in Phase 3

-- TODO: Create tables for:
-- - documents (id, title, body_md, tags, authority, created_at)
-- - chunks (id, document_id, content, chunk_index, tokens, metadata)
-- - chunk_embeddings (chunk_id, embedding vector(1536))
-- - conversations (id, user_id, created_at)
-- - messages (id, conversation_id, user_id, role, content, created_at)