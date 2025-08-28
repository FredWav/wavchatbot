-- RLS policies

-- Enable RLS
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_embeddings  ENABLE ROW LEVEL SECURITY;

-- Conversations: user scoping via JWT user_id
CREATE POLICY "Users view own conversations" ON conversations
  FOR SELECT USING (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

CREATE POLICY "Users create own conversations" ON conversations
  FOR INSERT WITH CHECK (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

CREATE POLICY "Users update own conversations" ON conversations
  FOR UPDATE USING (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

CREATE POLICY "Users delete own conversations" ON conversations
  FOR DELETE USING (user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text);

-- Messages: only messages in user's conversations
CREATE POLICY "Users view messages in their conversations" ON messages
  FOR SELECT USING (
    user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text
    OR conversation_id IN (
      SELECT id FROM conversations 
      WHERE user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text
    )
  );

CREATE POLICY "Users create messages in their conversations" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE user_id::text = (current_setting('request.jwt.claims', true)::json->>'user_id')::text
    )
  );

-- KB: public read, admin write (optionnel)
CREATE POLICY "Public read documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Admin manage documents" ON documents FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin'
);

CREATE POLICY "Public read chunks" ON chunks FOR SELECT USING (true);
CREATE POLICY "Admin manage chunks" ON chunks FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin'
);

CREATE POLICY "Public read embeddings" ON chunk_embeddings FOR SELECT USING (true);
CREATE POLICY "Admin manage embeddings" ON chunk_embeddings FOR ALL USING (
  (current_setting('request.jwt.claims', true)::json->>'role')::text = 'admin'
);

-- Helper: current user id (service_role => NULL)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
DECLARE
  role_claim TEXT;
BEGIN
  role_claim := (current_setting('request.jwt.claims', true)::json->>'role')::text;
  IF role_claim = 'service_role' THEN
    RETURN NULL; -- backend bypass
  END IF;
  RETURN (current_setting('request.jwt.claims', true)::json->>'user_id')::text;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: can_access_conversation()
CREATE OR REPLACE FUNCTION can_access_conversation(conversation_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_uuid TEXT;
  conv_user_id UUID;
BEGIN
  user_uuid := get_current_user_id();
  IF user_uuid IS NULL THEN
    RETURN TRUE; -- backend
  END IF;

  SELECT user_id INTO conv_user_id 
  FROM conversations 
  WHERE id = conversation_uuid;

  RETURN conv_user_id::text = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
