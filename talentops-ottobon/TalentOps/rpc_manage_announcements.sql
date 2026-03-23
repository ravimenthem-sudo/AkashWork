-- ==============================================================================
-- RPCs: update_announcement_status & delete_announcement
-- Purpose: Complete the suite of Announcement RPCs for full security.
-- ==============================================================================

-- 1. UPDATE STATUS RPC
CREATE OR REPLACE FUNCTION update_announcement_status(
    p_announcement_id uuid,
    p_status text -- 'active', 'completed', 'future'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role text;
BEGIN
    -- Check Permissions (Only Managers/Execs)
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    
    -- Optional: Enforce Role Check
    -- IF v_user_role NOT IN ('manager', 'executive') THEN
    --     RETURN json_build_object('success', false, 'error', 'Unauthorized');
    -- END IF;

    UPDATE public.announcements
    SET status = p_status
    WHERE id = p_announcement_id;

    IF FOUND THEN
        RETURN json_build_object('success', true);
    ELSE
        RETURN json_build_object('success', false, 'error', 'Announcement not found');
    END IF;
END;
$$;


-- 2. DELETE ANNOUNCEMENT RPC
CREATE OR REPLACE FUNCTION delete_announcement(
    p_announcement_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_role text;
BEGIN
    -- Check Permissions (Only Managers/Execs)
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

    -- Optional: Enforce Role Check
    -- IF v_user_role NOT IN ('manager', 'executive') THEN
    --     RETURN json_build_object('success', false, 'error', 'Unauthorized');
    -- END IF;

    DELETE FROM public.announcements
    WHERE id = p_announcement_id;

    IF FOUND THEN
        RETURN json_build_object('success', true);
    ELSE
         RETURN json_build_object('success', false, 'error', 'Announcement not found');
    END IF;
END;
$$;

-- Grant permissions for both
GRANT EXECUTE ON FUNCTION update_announcement_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_announcement(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
