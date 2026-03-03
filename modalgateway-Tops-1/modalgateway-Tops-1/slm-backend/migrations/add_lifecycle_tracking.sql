-- Migration: Add lifecycle state tracking for task monitoring
-- This enables the task_monitor module to detect lifecycle stagnation

-- 1. Add lifecycle_state_updated_at column
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS lifecycle_state_updated_at timestamp with time zone DEFAULT now();

-- 2. Initialize existing rows with current timestamp
UPDATE public.tasks 
SET lifecycle_state_updated_at = COALESCE(updated_at, now())
WHERE lifecycle_state_updated_at IS NULL;

-- 3. Create function to auto-update lifecycle_state_updated_at when lifecycle_state changes
CREATE OR REPLACE FUNCTION update_lifecycle_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if lifecycle_state actually changed
    IF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
        NEW.lifecycle_state_updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to call the function
DROP TRIGGER IF EXISTS trg_update_lifecycle_state_timestamp ON public.tasks;

CREATE TRIGGER trg_update_lifecycle_state_timestamp
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_lifecycle_state_timestamp();

-- 5. Create index for efficient querying by lifecycle state and timestamp
CREATE INDEX IF NOT EXISTS idx_tasks_lifecycle_monitoring 
ON public.tasks (lifecycle_state, lifecycle_state_updated_at, status, due_date)
WHERE status NOT IN ('completed', 'done', 'archived');

-- 6. Add comment for documentation
COMMENT ON COLUMN public.tasks.lifecycle_state_updated_at IS 
'Timestamp when lifecycle_state was last changed. Used by task_monitor module for stagnation detection.';

COMMENT ON TRIGGER trg_update_lifecycle_state_timestamp ON public.tasks IS 
'Auto-updates lifecycle_state_updated_at when lifecycle_state changes';
