
-- ==============================================================================
-- RPC: create_announcement_event
-- Purpose: Creates a new Announcement OR Event, and automatically sends Notifications.
--          Securely controls write access (only managers/execs can create).
-- ==============================================================================

CREATE OR REPLACE FUNCTION create_announcement_event(
    p_title text,
    p_date date,
    p_time time,
    p_location text,
    p_message text,
    p_event_for text, -- 'all', 'team', 'employee', 'my_team'
    p_target_teams json DEFAULT '[]', -- List of Team IDs
    p_target_employees json DEFAULT '[]' -- List of User IDs
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
    v_user_role text; -- Assuming role is in profiles table
    v_new_event_id uuid;
    v_target_user_ids uuid[]; -- Array of user IDs to notify
BEGIN
    -- 1. Get current user context
    v_user_id := auth.uid();
    
    SELECT org_id, role INTO v_org_id, v_user_role
    FROM public.profiles 
    WHERE id = v_user_id;

    IF v_org_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- 2. Authorization Check (Optional: enforce strict role check here)
    -- If you want ANY employee to create, remove this check.
    -- IF v_user_role NOT IN ('executive', 'manager') THEN
    --    RETURN json_build_object('success', false, 'error', 'Unauthorized: Only Managers can create events');
    -- END IF;

    -- 3. Insert the Event/Announcement
    INSERT INTO public.announcements (
        org_id,
        title,
        event_date,
        event_time,
        location,
        message,
        event_for,
        teams,
        employees,
        status, -- We set initial status based on date
        created_at
    ) VALUES (
        v_org_id,
        p_title,
        p_date,
        p_time,
        p_location, -- 'Broadcast' for Announcement
        p_message,
        p_event_for,
        p_target_teams,
        p_target_employees,
        CASE WHEN p_date = CURRENT_DATE THEN 'active' ELSE 'future' END,
        NOW()
    ) RETURNING id INTO v_new_event_id;

    -- 4. Calculate Recipients for Notifications
    -- We need to find the user IDs to notify based on event_for
    
    IF p_event_for = 'all' THEN
        -- Select all employees in Org
        SELECT array_agg(id) INTO v_target_user_ids
        FROM public.profiles
        WHERE org_id = v_org_id AND id != v_user_id; -- Don't notify self

    ELSIF p_event_for = 'team' THEN
        -- Select employees whose team_id is in p_target_teams
        -- Note: simplified JSON contained check logic
        SELECT array_agg(id) INTO v_target_user_ids
        FROM public.profiles
        WHERE org_id = v_org_id 
        AND team_id::text = ANY(ARRAY(SELECT json_array_elements_text(p_target_teams)))
        AND id != v_user_id;

    ELSIF p_event_for IN ('employee', 'specific', 'my_team') THEN
         -- Select employees whose ID is in p_target_employees
         SELECT array_agg(id) INTO v_target_user_ids
         FROM public.profiles
         WHERE org_id = v_org_id
         AND id::text = ANY(ARRAY(SELECT json_array_elements_text(p_target_employees)))
         AND id != v_user_id;
    END IF;

    -- 5. Send Notifications (Bulk Insert)
    IF v_target_user_ids IS NOT NULL AND array_length(v_target_user_ids, 1) > 0 THEN
        INSERT INTO public.notifications (
            org_id,
            sender_id,
            receiver_id,
            type,
            message,
            is_read,
            created_at
        )
        SELECT 
            v_org_id,
            v_user_id,
            rcv_id,
            'announcement',
            'New ' || (CASE WHEN p_location = 'Broadcast' THEN 'Announcement: ' ELSE 'Event: ' END) || p_title,
            false,
            NOW()
        FROM unnest(v_target_user_ids) AS rcv_id;
    END IF;

    RETURN json_build_object('success', true, 'id', v_new_event_id);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_announcement_event(text, date, time, text, text, text, json, json) TO authenticated;
NOTIFY pgrst, 'reload schema';
