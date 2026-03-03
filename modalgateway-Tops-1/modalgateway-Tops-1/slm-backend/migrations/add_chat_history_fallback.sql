-- SAFE SQL SCRIPT FOR CHAT HISTORY FALLBACK
-- ===========================================
-- Run this in Supabase if you cannot use Redis.
-- This allows the chatbot to store history in your main database.
-- ===========================================

CREATE TABLE IF NOT EXISTS chat_history (
    id bigserial PRIMARY KEY,
    session_id text NOT NULL,
    org_id uuid,
    role text NOT NULL, -- 'user' or 'assistant'
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast retrieval by session
CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history (session_id, created_at);

-- RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable access for all authenticated users" ON chat_history FOR ALL TO authenticated USING (true);

COMMENT ON TABLE chat_history IS 'Fallback storage for chat history when Redis is unavailable.';
