
-- CHUNK 1: Schema Updates & Points Logic Refinement

-- 1. Add step_duration_setting to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS step_duration_setting TEXT CHECK (step_duration_setting IN ('2h', '4h')) DEFAULT '2h';

-- 2. Ensure other columns exist (idempotent)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS allocated_hours NUMERIC(10, 2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_points NUMERIC(10, 2);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS final_points NUMERIC(10, 2);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS bonus_points NUMERIC(10, 2);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS penalty_points NUMERIC(10, 2);

-- 2.1 Add Technical Scores to Profiles for Filtering Logic
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS technical_scores JSONB DEFAULT '{}'::jsonb;
-- Example Data: {"frontend": 85, "backend": 70, "design": 90}

-- 3. Update the Point Calculation Function
CREATE OR REPLACE FUNCTION calculate_task_points()
RETURNS TRIGGER AS $$
DECLARE
    task_record RECORD;
    points_rate NUMERIC := 10; -- Hardcoded rate as per requirements
    base_points NUMERIC;
    time_diff NUMERIC;
    bonus_points NUMERIC := 0;
    penalty_points NUMERIC := 0;
    calculated_final_points NUMERIC;
BEGIN
    -- Fetch task details
    SELECT * INTO task_record FROM tasks WHERE id = NEW.task_id;
    
    -- Ensure allocated_hours exists, default to 0 if null
    IF task_record.allocated_hours IS NULL THEN
        task_record.allocated_hours := 0;
    END IF;

    -- Calculate Base Points (Allocated Hours * 10)
    base_points := task_record.allocated_hours * points_rate;

    -- Calculate Time Difference (Allocated - Actual)
    -- If Positive: Early (Bonus)
    -- If Negative: Late (Penalty)
    -- If Zero: On time (No bonus/penalty)
    
    -- Using numeric comparison to handle floats
    IF NEW.actual_hours < task_record.allocated_hours THEN
        -- EARLY: Bonus = (Allocated - Actual) * Rate
        bonus_points := (task_record.allocated_hours - NEW.actual_hours) * points_rate;
        penalty_points := 0;
    ELSIF NEW.actual_hours > task_record.allocated_hours THEN
        -- LATE: Penalty = (Actual - Allocated) * Rate
        penalty_points := (NEW.actual_hours - task_record.allocated_hours) * points_rate;
        bonus_points := 0;
    ELSE
        -- EXACTLY ON TIME
        bonus_points := 0;
        penalty_points := 0;
    END IF;

    -- Final Calculation
    calculated_final_points := base_points + bonus_points - penalty_points;

    -- Update the submission record with calculated values
    NEW.bonus_points := bonus_points;
    NEW.penalty_points := penalty_points;
    NEW.final_points := calculated_final_points;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-create Trigger to ensure it fires
DROP TRIGGER IF EXISTS trg_calculate_points ON task_submissions;

CREATE TRIGGER trg_calculate_points
BEFORE INSERT OR UPDATE OF actual_hours ON task_submissions
FOR EACH ROW
EXECUTE FUNCTION calculate_task_points();

-- 5. Helper Function to Recalculate Task Hours/Points based on Steps
CREATE OR REPLACE FUNCTION update_task_hours_from_steps()
RETURNS TRIGGER AS $$
DECLARE
    parent_task_id UUID;
    duration_setting TEXT;
    step_hours NUMERIC;
    total_steps INTEGER;
    new_allocated_hours NUMERIC;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        parent_task_id := OLD.task_id;
    ELSE
        parent_task_id := NEW.task_id;
    END IF;

    -- Get the task's duration setting (default 2h if not set)
    SELECT step_duration_setting INTO duration_setting FROM tasks WHERE id = parent_task_id;
    IF duration_setting = '4h' THEN
        step_hours := 4;
    ELSE
        step_hours := 2; -- Default
    END IF;

    -- Count steps
    SELECT COUNT(*) INTO total_steps FROM task_steps WHERE task_id = parent_task_id;

    -- Calculate new totals
    new_allocated_hours := total_steps * step_hours;

    -- Update Task
    UPDATE tasks 
    SET 
        allocated_hours = new_allocated_hours,
        total_points = new_allocated_hours * 10 -- rate is 10
    WHERE id = parent_task_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Steps
DROP TRIGGER IF EXISTS trg_update_task_hours ON task_steps;

CREATE TRIGGER trg_update_task_hours
AFTER INSERT OR UPDATE OR DELETE ON task_steps
FOR EACH ROW
EXECUTE FUNCTION update_task_hours_from_steps();
