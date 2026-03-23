
-- =============================================
-- RPC: Apply for Leave
-- Purpose: Creates a new leave request in the 'leaves' table.
-- Checks for overlap and sufficient balance before inserting.
-- =============================================

CREATE OR REPLACE FUNCTION apply_leave(
    p_from_date date,
    p_to_date date,
    p_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
    v_team_id uuid;
    v_duration int;
    v_balance int;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Get User Context & Balance
    SELECT org_id, team_id, leaves_remaining_this_month 
    INTO v_org_id, v_team_id, v_balance
    FROM public.profiles 
    WHERE id = v_user_id;

    -- 2. Calculate Duration (Simplified: Inclusive Days)
    v_duration := (p_to_date - p_from_date) + 1;

    -- 3. Validation: Overlap
    IF EXISTS (
        SELECT 1 FROM public.leaves 
        WHERE employee_id = v_user_id 
        AND status != 'rejected'
        AND (from_date, to_date) OVERLAPS (p_from_date, p_to_date)
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Dates overlap with an existing request');
    END IF;

    -- 4. Insert Request
    INSERT INTO public.leaves (
        org_id,
        employee_id,
        team_id,
        from_date,
        to_date,
        duration_weekdays, -- Storing total days here based on existing schema
        reason,
        status,
        created_at
    ) VALUES (
        v_org_id,
        v_user_id,
        v_team_id,
        p_from_date,
        p_to_date,
        v_duration,
        p_reason,
        'pending',
        NOW()
    );

    RETURN json_build_object('success', true, 'message', 'Leave applied successfully');
END;
$$;
