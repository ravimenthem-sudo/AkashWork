-- ==============================================================================
-- RPC: update_my_profile (UPDATED v2)
-- Fix: Removed 'updated_at' column update as the column does not exist.
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_my_profile(
    p_phone text,
    p_location text,
    p_avatar_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- 1. Get the current user ID securely
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- 2. Basic Validation
    IF length(p_phone) > 20 THEN
         RETURN json_build_object('success', false, 'error', 'Phone number is too long (max 20 chars)');
    END IF;

    IF length(p_location) > 100 THEN
         RETURN json_build_object('success', false, 'error', 'Location is too long (max 100 chars)');
    END IF;

    -- 3. Perform the Update
    -- Remove updated_at since the column doesn't exist
    UPDATE public.profiles
    SET 
        phone = p_phone,
        location = p_location,
        avatar_url = COALESCE(p_avatar_url, avatar_url)
    WHERE id = v_user_id;

    -- 4. Return Success
    IF FOUND THEN
        RETURN json_build_object('success', true);
    ELSE
        RETURN json_build_object('success', false, 'error', 'Profile not found');
    END IF;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION update_my_profile(text, text, text) TO authenticated;

-- Force schema reload to make it visible
NOTIFY pgrst, 'reload schema';
