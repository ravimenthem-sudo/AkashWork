/*
CREATE OR REPLACE FUNCTION get_user_performance_stats(
    p_user_id UUID,
    p_org_id UUID,
    p_period TEXT -- 'week' or 'month'
)
RETURNS JSONB AS $$
DECLARE
    start_date TIMESTAMPTZ;
    user_earned_points NUMERIC := 0;
    user_potential_points NUMERIC := 0;
    
    -- Variables for Percentile Calc (Org Wide)
    org_percentile NUMERIC := 0;
    rank_val INT;
    total_users INT;
    
    -- Variables for Percentile Calc (Team/Project Wide) -- Note: Complex if user is in multiple projects, skipping strict project scope for now unless specified
    
    result JSONB;
BEGIN
    -- 1. Determine Time Range
    IF p_period = 'week' THEN
        start_date := date_trunc('week', NOW()); -- Start of current week (Monday)
    ELSIF p_period = 'month' THEN
        start_date := date_trunc('month', NOW()); -- Start of current month
    ELSE
        start_date := '1970-01-01'; -- All time or handled incorrectly
    END IF;

    -- 2. Calculate User's Stats (Numerator vs Denominator)
    -- Earned: Sum of final_points
    SELECT COALESCE(SUM(final_points), 0)
    INTO user_earned_points
    FROM task_submissions ts
    JOIN tasks t ON ts.task_id = t.id
    WHERE ts.user_id = p_user_id
      AND ts.submitted_at >= start_date
      AND t.org_id = p_org_id;

    -- Potential: Sum of task.total_points for submitted tasks
    SELECT COALESCE(SUM(t.total_points), 0)
    INTO user_potential_points
    FROM task_submissions ts
    JOIN tasks t ON ts.task_id = t.id
    WHERE ts.user_id = p_user_id
      AND ts.submitted_at >= start_date
      AND t.org_id = p_org_id;

    -- 3. Calculate Percentile (Org Wide)
    -- Rank = Count of users with LESS points than current user
    
    -- First, build a leaderboardCTE
    WITH Leaderboard AS (
        SELECT 
            ts.user_id,
            COALESCE(SUM(ts.final_points), 0) as total_score
        FROM task_submissions ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE ts.submitted_at >= start_date 
          AND t.org_id = p_org_id
        GROUP BY ts.user_id
    )
    SELECT 
        COUNT(*), -- Total participants
        COUNT(*) FILTER (WHERE total_score < user_earned_points) -- Users below current
    INTO total_users, rank_val
    FROM Leaderboard;

    -- Handle edge case: if user has 0 points and leaderboard is empty or just them
    IF total_users <= 1 THEN
        org_percentile := 100; -- Top of class of 1
    ELSE
        org_percentile := (rank_val::NUMERIC / (total_users - 1)::NUMERIC) * 100;
    END IF;

    result := jsonb_build_object(
        'period', p_period,
        'earned_points', user_earned_points,
        'potential_points', user_potential_points,
        'org_percentile', ROUND(org_percentile, 1)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;
*/
