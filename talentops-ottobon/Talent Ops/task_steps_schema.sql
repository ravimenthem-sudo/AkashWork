-- ============================================
-- TASK STEPS TABLE - Execute in Supabase Console
-- ============================================
-- This table stores execution-level steps for each task phase.
-- Steps are granular checklists that must be completed before 
-- a lifecycle phase can be submitted for validation.

CREATE TABLE IF NOT EXISTS task_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,                                    -- Multi-tenancy support
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,     -- Link to parent task
    stage_id TEXT NOT NULL,                                  -- e.g., 'requirement_refiner', 'design_guidance'
    step_title TEXT NOT NULL,
    step_description TEXT,
    order_index INT NOT NULL DEFAULT 0,                      -- For ordering steps within a phase
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
    skipped_reason TEXT,                                     -- Required if status = 'skipped'
    created_by UUID,                                         -- User who created the step
    created_by_role TEXT,                                    -- 'manager' or 'employee' for permission logic
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_task_steps_org_id ON task_steps(org_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_stage_id ON task_steps(stage_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_status ON task_steps(status);

-- ============================================
-- ROW LEVEL SECURITY (OPTIONAL - Enable if using RLS)
-- ============================================
-- ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Users can view steps in their org" ON task_steps
--     FOR SELECT USING (org_id = auth.jwt() ->> 'org_id');
-- 
-- CREATE POLICY "Users can manage steps in their org" ON task_steps
--     FOR ALL USING (org_id = auth.jwt() ->> 'org_id');
