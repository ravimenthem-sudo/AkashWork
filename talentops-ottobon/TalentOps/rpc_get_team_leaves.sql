
-- =============================================
-- RPC: Get Team Leaves
-- Purpose: Fetches pending and past leaves for the Manager's team.
-- =============================================

CREATE OR REPLACE FUNCTION get_team_leaves()
RETURNS TABLE (
    id uuid,
    employee_id uuid,
    full_name text,
    avatar_url text,
    from_date date,
    to_date date,
    days int,
    reason text,
    status text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_manager_id uuid;
BEGIN
    v_manager_id := auth.uid();

    RETURN QUERY
    SELECT 
        l.id,
        l.employee_id,
        p.full_name,
        p.avatar_url,
        l.from_date,
        l.to_date,
        l.duration_weekdays as days,
        l.reason,
        l.status,
        l.created_at
    FROM public.leaves l
    JOIN public.profiles p ON l.employee_id = p.id
    WHERE p.manager_id = v_manager_id -- Filter by Direct Reports
    ORDER BY 
        CASE WHEN l.status = 'pending' THEN 0 ELSE 1 END, -- Pending on top
        l.created_at DESC;
END;
$$;
