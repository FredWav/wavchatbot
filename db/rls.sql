-- Row Level Security (RLS) policies for Fred Wav Chatbot
-- Ensures users can only access their own conversations and messages

-- Enable RLS on sensitive tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Documents and chunks are publicly readable (knowledge base)
-- but only admin can write
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_embeddings ENABLE ROW LEVEL SECURITY;

-- Conversations policies: users can only access their own conversations
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

CREATE POLICY "Users can create their own conversations" ON conversations
    FOR INSERT WITH CHECK (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE USING (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

-- Messages policies: users can only access messages in their conversations
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text
        OR conversation_id IN (
            SELECT id FROM conversations 
            WHERE user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text
        )
    );

CREATE POLICY "Users can create messages in their conversations" ON messages
    FOR INSERT WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations 
            WHERE user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text
        )
    );

-- Knowledge base policies: public read, admin write
CREATE POLICY "Public read access to documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage documents" ON documents
    FOR ALL USING (
        (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin'
    );

CREATE POLICY "Public read access to chunks" ON chunks
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage chunks" ON chunks
    FOR ALL USING (
        (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin'
    );

CREATE POLICY "Public read access to embeddings" ON chunk_embeddings
    FOR SELECT USING (true);

CREATE POLICY "Admin can manage embeddings" ON chunk_embeddings
    FOR ALL USING (
        (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin'
    );

-- Function to get user ID from JWT or service role
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
    -- For service role calls (backend), return NULL to bypass RLS
    IF current_setting('role') = 'service_role' THEN
        RETURN NULL;
    END IF;
    
    -- For authenticated users, extract user_id from JWT
    RETURN (current_setting('request.jwt.claims', true)::json->>'user_id')::text;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user can access conversation
CREATE OR REPLACE FUNCTION can_access_conversation(conversation_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_uuid TEXT;
    conv_user_id UUID;
BEGIN
    user_uuid := get_current_user_id();
    
    -- Service role can access all
    IF user_uuid IS NULL THEN
        RETURN TRUE;
    END IF;
    
    SELECT user_id INTO conv_user_id 
    FROM conversations 
    WHERE id = conversation_uuid;
    
    RETURN conv_user_id::text = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;