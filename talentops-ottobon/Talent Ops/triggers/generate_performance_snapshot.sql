-- triggers/generate_performance_snapshot.sql

-- 1. Create the Snapshot Generation Function
CREATE OR REPLACE FUNCTION generate_performance_snapshot(
    p_period_type TEXT, -- 'week' or 'month'
    p_period_start DATE,
    p_period_end DATE,
    p_org_id UUID DEFAULT NULL
)
RETURNS TABLE (
    employee_id UUID,
    total_points NUMERIC,
    rank INT,
    percentile NUMERIC
) AS $$
DECLARE
    v_snapshot_id UUID;
BEGIN
    -- Validate period type
    IF p_period_type NOT IN ('week', 'month') THEN
        RAISE EXCEPTION 'Invalid period_type. Must be "week" or "month".';
    END IF;

    -- Delete existing snapshot for this period/org to allow regeneration
    -- (Optional: depends on if you want to overwrite or keep history based on calculated_at)
    -- For now, we'll just insert new records.
    
    RETURN QUERY
    WITH UserPoints AS (
        SELECT 
            ts.task_id, -- joined just for validation if needed
            t.assigned_to as user_id,
            SUM(ts.final_points) as points
        FROM task_submissions ts
        JOIN tasks t ON t.id = ts.task_id
        WHERE 
            ts.submitted_at >= p_period_start::TIMESTAMP
            AND ts.submitted_at <= p_period_end::TIMESTAMP + INTERVAL '1 day' -- Include full end day
            AND (p_org_id IS NULL OR t.org_id = p_org_id)
            AND ts.final_points IS NOT NULL
        GROUP BY t.assigned_to
    ),
    RankedStats AS (
        SELECT
            up.user_id,
            up.points,
            RANK() OVER (ORDER BY up.points DESC) as rk,
            PERCENT_RANK() OVER (ORDER BY up.points) as pct
        FROM UserPoints up
    ),
    InsertedSnapshots AS (
        INSERT INTO employee_performance_snapshots (
            employee_id,
            org_id,
            period_type,
            period_start,
            period_end,
            total_points,
            rank,
            percentile,
            calculated_at
        )
        SELECT
            rs.user_id,
            p_org_id,
            p_period_type,
            p_period_start,
            p_period_end,
            rs.points,
            rs.rk,
            ROUND((rs.pct * 100)::numeric, 2), -- Convert 0.5 to 50.00
            NOW()
        FROM RankedStats rs
        RETURNING 
            employee_performance_snapshots.employee_id,
            employee_performance_snapshots.total_points,
            employee_performance_snapshots.rank,
            employee_performance_snapshots.percentile
    )
    SELECT * FROM InsertedSnapshots;
END;
$$ LANGUAGE plpgsql;

-- Example Usage (Admin would run this via RPC or Cron):
-- SELECT * FROM generate_performance_snapshot('week', '2023-10-01', '2023-10-07', 'org_uuid_here');
