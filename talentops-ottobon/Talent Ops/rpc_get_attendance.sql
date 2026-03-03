
-- =============================================
-- 3. GET MY ATTENDANCE
-- =============================================
-- Logic: Returns attendance logs for the current user for a specific month/year.

CREATE OR REPLACE FUNCTION get_my_attendance(
    p_month int,
    p_year int
)
RETURNS TABLE (
    attendance_date date,
    check_in_time timestamptz,
    check_out_time timestamptz,
    status text,
    is_late boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();

    RETURN QUERY
    SELECT 
        date as attendance_date,
        check_in as check_in_time,
        check_out as check_out_time,
        status,
        -- Logic determines if 'late' based on e.g. 10:00 AM (hardcoded pending config)
        (EXTRACT(HOUR FROM check_in) > 10) as is_late
    FROM public.attendance
    WHERE employee_id = v_user_id
    AND EXTRACT(MONTH FROM date) = p_month
    AND EXTRACT(YEAR FROM date) = p_year
    ORDER BY date DESC;
END;
$$;
