
-- =============================================
-- 1. CLOCK IN
-- =============================================
-- Logic: Checks if user already has an open session (check_out IS NULL).
-- If yes, prevents double clock-in.
-- If no, creates a new record with check_in = NOW().

CREATE OR REPLACE FUNCTION clock_in()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_open_session_id uuid;
BEGIN
    v_user_id := auth.uid();

    -- Check for existing open session
    SELECT id INTO v_open_session_id
    FROM public.attendance
    WHERE employee_id = v_user_id 
    AND check_out IS NULL
    AND date = CURRENT_DATE;

    IF v_open_session_id IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'You are already clocked in.');
    END IF;

    -- Insert new record
    INSERT INTO public.attendance (
        employee_id,
        date,
        check_in,
        status,
        created_at
    ) VALUES (
        v_user_id,
        CURRENT_DATE,
        NOW(),
        'present',
        NOW()
    );

    RETURN json_build_object('success', true, 'message', 'Clocked in successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
