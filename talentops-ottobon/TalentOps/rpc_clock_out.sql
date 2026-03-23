
-- =============================================
-- 2. CLOCK OUT
-- =============================================
-- Logic: Finds the active session (check_out IS NULL) for today.
-- Updates check_out to NOW() and calculates duration.

CREATE OR REPLACE FUNCTION clock_out()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
    v_check_in_time timestamptz;
    v_duration interval;
BEGIN
    v_user_id := auth.uid();

    -- Find open session
    SELECT id, check_in INTO v_session_id, v_check_in_time
    FROM public.attendance
    WHERE employee_id = v_user_id 
    AND check_out IS NULL
    AND date = CURRENT_DATE;

    IF v_session_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No active check-in found.');
    END IF;

    -- Calculate duration
    v_duration := NOW() - v_check_in_time;

    -- Update record
    UPDATE public.attendance
    SET 
        check_out = NOW(),
        -- total_hours column might need to be added if not exists
        -- total_hours = v_duration, 
        status = CASE 
            WHEN EXTRACT(EPOCH FROM v_duration)/3600 < 4 THEN 'half_day'
            ELSE 'present'
        END
    WHERE id = v_session_id;

    RETURN json_build_object('success', true, 'message', 'Clocked out successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
