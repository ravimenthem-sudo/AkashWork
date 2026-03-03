-- CONSOLIDATED SECURITY & PRIVACY FIX
-- ===================================

-- 1. UPDATE SEMANTIC CACHE (Exists)
ALTER TABLE IF EXISTS semantic_cache ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. CREATE CHAT HISTORY (Missing)
CREATE TABLE IF NOT EXISTS chat_history (
    id bigserial PRIMARY KEY,
    session_id text NOT NULL,
    user_id uuid, -- Added for privacy from the start
    org_id uuid,
    role text NOT NULL, -- 'user' or 'assistant'
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast retrieval by user and session
CREATE INDEX IF NOT EXISTS idx_chat_history_user_session ON chat_history (user_id, session_id);

-- Index for future cleanup queries (e.g. delete records older than 90 days)
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history (created_at);

-- 3. UPDATE MATCH FUNCTION
CREATE OR REPLACE FUNCTION match_semantic_cache (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  msg_org_id uuid,
  msg_user_id uuid DEFAULT NULL  -- Added user_id parameter
)
RETURNS TABLE (
  id uuid,
  query_text text,
  response_text text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    semantic_cache.id,
    semantic_cache.query_text,
    semantic_cache.response_text,
    1 - (semantic_cache.query_embedding <=> query_embedding) AS similarity
  FROM semantic_cache
  WHERE 1 - (semantic_cache.query_embedding <=> query_embedding) > match_threshold
  AND (semantic_cache.org_id = msg_org_id OR semantic_cache.org_id IS NULL)
  -- CRITICAL: Ensure personal queries are isolated by user_id
  AND (
    (semantic_cache.user_id = msg_user_id) OR 
    (semantic_cache.user_id IS NULL) -- Allow global knowledge
  )
  ORDER BY semantic_cache.query_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- NOTE: chat_history user_id column and index already created above at table creation time.

-- 3. ENABLE RLS POLICIES FOR SECURE ACCESS
-- These ensure that even if the app makes a mistake, the DB blocks the leak.
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Strict isolation by user and org" ON semantic_cache
FOR ALL TO authenticated
USING (
  -- Only allow: personal entries belonging to the user, OR global entries (user_id is NULL)
  -- org_id = auth.uid() was removed — org_id is an org UUID, not a user UUID, so it never matches
  (user_id = auth.uid()) OR (user_id IS NULL)
);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own history" ON chat_history
FOR ALL TO authenticated
USING (user_id = auth.uid());
