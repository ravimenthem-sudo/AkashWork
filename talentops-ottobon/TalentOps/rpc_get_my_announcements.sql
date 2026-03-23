-- ==============================================================================
-- RPC: get_my_announcements
-- Purpose: Fetches both Announcements and Events visible to the current user.
--          Dynamically calculates 'status' to avoid database writes.
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_my_announcements()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
    v_team_id uuid; -- We assume team_id is UUID based on recent context
    v_results json;
    v_today date;
BEGIN
    -- 1. Get current user context
    v_user_id := auth.uid();
    v_today := CURRENT_DATE;

    -- 2. Get User's Org and Team
    SELECT org_id, team_id::uuid 
    INTO v_org_id, v_team_id
    FROM public.profiles 
    WHERE id = v_user_id;

    IF v_org_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User profile not found');
    END IF;

    -- 3. Fetch Events & Announcements
    -- Logic: 
    --   - Must belong to same Org
    --   - Must be visible to user (event_for = 'all' OR 'team' (matches) OR 'employee' (matches))
    --   - Dynamically calculate Status
    
    SELECT json_agg(
        json_build_object(
            'id', a.id,
            'title', a.title,
            'event_date', a.event_date,
            'event_time', a.event_time,
            'location', a.location,
            'message', a.message,
            'event_for', a.event_for,
            'teams', a.teams, -- Return raw JSON for frontend debugging if needed
            'created_at', a.created_at,
            -- DYNAMIC STATUS CALCULATION
            'status', CASE 
                WHEN a.event_date > v_today THEN 'future'
                WHEN a.event_date = v_today THEN 'active'
                ELSE 'completed'
            END
        ) ORDER BY a.event_date ASC, a.event_time ASC
    ) INTO v_results
    FROM public.announcements a
    WHERE a.org_id = v_org_id
    AND (
        -- Vision Condition 1: Public Events
        a.event_for = 'all'
        
        -- Vision Condition 2: Team Events
        OR (
            a.event_for = 'team' 
            AND v_team_id IS NOT NULL 
            -- Check if v_team_id is present in the JSON array 'teams'
            -- We cast to text to be safe with JSONB vs JSON containment
            AND a.teams::text LIKE '%' || v_team_id::text || '%'
        )
        
        -- Vision Condition 3: Specific Employee Events
        OR (
            (a.event_for = 'employee' OR a.event_for = 'specific' OR a.event_for = 'my_team')
            AND a.employees::text LIKE '%' || v_user_id::text || '%'
        )
    );

    -- 4. Return results
    RETURN json_build_object(
        'success', true,
        'data', COALESCE(v_results, '[]'::json)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_my_announcements() TO authenticated;
NOTIFY pgrst, 'reload schema';
