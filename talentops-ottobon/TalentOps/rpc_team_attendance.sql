
-- =============================================
-- 6. GET TEAM ATTENDANCE (DASHBOARD)
-- =============================================
-- Logic: returns list of team members and their today's status.

CREATE OR REPLACE FUNCTION get_team_attendance_overview()
RETURNS TABLE (
    employee_id uuid,
    full_name text,
    avatar_url text,
    status text, -- 'present', 'on_leave', 'absent'
    check_in_time timestamptz
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
        p.id,
        p.full_name,
        p.avatar_url,
        COALESCE(a.status, 
            CASE WHEN EXISTS (
                SELECT 1 FROM public.leaves l 
                WHERE l.employee_id = p.id 
                AND CURRENT_DATE BETWEEN l.from_date AND l.to_date
                AND l.status = 'approved'
            ) THEN 'on_leave' ELSE 'absent' END
        ) as status,
        a.check_in
    FROM public.profiles p
    LEFT JOIN public.attendance a ON p.id = a.employee_id AND a.date = CURRENT_DATE
    WHERE p.manager_id = v_manager_id -- OR p.team_id matches manager's team
    ORDER BY status DESC, p.full_name ASC;
END;
$$;
