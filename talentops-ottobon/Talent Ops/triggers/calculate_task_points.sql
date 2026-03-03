-- triggers/calculate_task_points.sql

-- 1. Create the Function
CREATE OR REPLACE FUNCTION calculate_task_points()
RETURNS TRIGGER AS $$
DECLARE
    v_allocated_hours NUMERIC;
    v_total_points NUMERIC;
    v_points_per_hour NUMERIC;
    v_penalty_rate NUMERIC;
    
    v_actual_hours NUMERIC;
    v_bonus_pts NUMERIC := 0;
    v_penalty_pts NUMERIC := 0;
    v_final_pts NUMERIC;
    
    v_hours_diff NUMERIC;
BEGIN
    -- Only proceed if actual_hours is provided
    IF NEW.actual_hours IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch configuration from parent task
    SELECT 
        allocated_hours, 
        total_points, 
        points_per_hour, 
        penalty_points_per_hour
    INTO 
        v_allocated_hours, 
        v_total_points, 
        v_points_per_hour, 
        v_penalty_rate
    FROM tasks
    WHERE id = NEW.task_id;

    -- Default values if missing
    v_allocated_hours := COALESCE(v_allocated_hours, 0);
    v_total_points := COALESCE(v_total_points, 0);
    v_actual_hours := NEW.actual_hours;
    
    -- Case 1: Early Completion (Bonus)
    IF v_actual_hours < v_allocated_hours THEN
        v_hours_diff := v_allocated_hours - v_actual_hours;
        
        -- Bonus = saved hours * base rate (or could be specific bonus rate if we had one)
        -- Using base rate points_per_hour as per standard model
        v_bonus_pts := v_hours_diff * COALESCE(v_points_per_hour, 0);
        
        NEW.bonus_hours := v_hours_diff;
        NEW.overrun_hours := 0;
        NEW.bonus_points := ROUND(v_bonus_pts, 2);
        NEW.penalty_points := 0;
        
        v_final_pts := v_total_points + v_bonus_pts;

    -- Case 2: Late Completion (Penalty)
    ELSIF v_actual_hours > v_allocated_hours THEN
        v_hours_diff := v_actual_hours - v_allocated_hours;
        
        -- Penalty = overrun hours * penalty rate
        v_penalty_pts := v_hours_diff * COALESCE(v_penalty_rate, 0);
        
        NEW.bonus_hours := 0;
        NEW.overrun_hours := v_hours_diff;
        NEW.bonus_points := 0;
        NEW.penalty_points := ROUND(v_penalty_pts, 2);
        
        -- Floor at 0
        v_final_pts := GREATEST(0, v_total_points - v_penalty_pts);

    -- Case 3: Exact Time
    ELSE
        NEW.bonus_hours := 0;
        NEW.overrun_hours := 0;
        NEW.bonus_points := 0;
        NEW.penalty_points := 0;
        v_final_pts := v_total_points;
    END IF;

    -- Set the final calculated points
    NEW.final_points := ROUND(v_final_pts, 2);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS trg_calculate_points ON task_submissions;

CREATE TRIGGER trg_calculate_points
BEFORE INSERT OR UPDATE OF actual_hours
ON task_submissions
FOR EACH ROW
EXECUTE FUNCTION calculate_task_points();
