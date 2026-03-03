-- SAFE SQL SCRIPT FOR SLM FEATURES
-- ===========================================
-- This script is strictly ADDITIVE. 
-- It does NOT drop any existing tables.
-- It does NOT modify any other tables.
-- It only creates 'learnings' and 'task_metrics' if they do not exist.
-- ===========================================

-- 1. LEARNINGS TABLE
-- Stores structured insights extracted from conversations.
CREATE TABLE IF NOT EXISTS learnings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    insight text NOT NULL,                
    context text,                         
    domain text DEFAULT 'general',        
    
    source_user_id uuid REFERENCES auth.users(id), 
    project_id uuid,                      
    confidence float DEFAULT 1.0,         
    tags text[] DEFAULT '{}',             
    
    CONSTRAINT insight_length CHECK (char_length(insight) > 5)
);

-- Enable RLS (Safe to run multiple times)
ALTER TABLE learnings ENABLE ROW LEVEL SECURITY;

-- Safely create policies (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'learnings' AND policyname = 'Enable read access for authenticated users'
    ) THEN
        CREATE POLICY "Enable read access for authenticated users" ON learnings FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'learnings' AND policyname = 'Enable insert for authenticated users'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users" ON learnings FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;


-- 2. TASK_METRICS TABLE
-- Stores snapshots of task progress for the SLM Progress Engine.
CREATE TABLE IF NOT EXISTS task_metrics (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    captured_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    task_id uuid NOT NULL, 
    
    previous_status text,
    new_status text,
    time_spent_hours float DEFAULT 0,     
    completion_percentage int DEFAULT 0,  
    
    update_comment text,                  
    slm_validation_result text,           
    slm_risk_score float DEFAULT 0.0,     
    
    updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE task_metrics ENABLE ROW LEVEL SECURITY;

-- Safely create policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'task_metrics' AND policyname = 'Enable access for all users'
    ) THEN
        CREATE POLICY "Enable access for all users" ON task_metrics FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- Validation Message
DO $$
BEGIN
    RAISE NOTICE 'SLM Tables (learnings, task_metrics) checked/created successfully.';
END $$;
