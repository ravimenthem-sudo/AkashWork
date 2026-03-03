-- Add missing columns for Points System
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS allocated_hours NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS total_points NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS points_per_hour NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS penalty_points_per_hour NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS risk_tag TEXT CHECK (risk_tag IN ('red', 'yellow'));

-- Add missing columns for Task Submissions
ALTER TABLE task_submissions
ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS bonus_hours NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS overrun_hours NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS bonus_points NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS penalty_points NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS final_points NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
