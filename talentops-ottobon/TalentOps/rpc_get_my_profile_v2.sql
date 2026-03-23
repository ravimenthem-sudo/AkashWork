-- ==============================================================================
-- RPC: get_my_profile_details (UPDATED v2)
-- Fix: Handles explicit casting for tables that might store UUIDs as TEXT.
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_my_profile_details()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_profile record;
    v_dept_name text;
    v_primary_project_name text;
    v_project_assignments json;
    v_finance json;
BEGIN
    -- 1. Get current user ID (UUID)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- 2. Fetch Basic Profile
    -- profiles.id is almost certainly UUID, but let's be safe
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

    IF NOT FOUND THEN
         RETURN json_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- 3. Fetch Department Name
    -- v_profile.department is likely UUID or TEXT. Casting to TEXT is safer for comparison if needed
    IF v_profile.department IS NOT NULL THEN
        SELECT department_name INTO v_dept_name
        FROM public.departments
        WHERE id::text = v_profile.department::text;
    END IF;

    -- 4. Fetch Primary Project Name
    IF v_profile.team_id IS NOT NULL THEN
        SELECT name INTO v_primary_project_name
        FROM public.projects
        WHERE id::text = v_profile.team_id::text;
    END IF;

    -- 5. Fetch All Project Assignments
    -- project_members.employee_id is the likely culprit for the error "operator does not exist: uuid = text"
    SELECT json_agg(
        json_build_object(
            'projectName', p.name,
            'role', pm.project_role
        )
    ) INTO v_project_assignments
    FROM public.project_members pm
    JOIN public.projects p ON p.id::text = pm.project_id::text
    WHERE pm.employee_id::text = v_user_id::text; -- FORCE TEXT COMPARISON

    -- 6. Fetch Finance Data
    SELECT json_build_object(
        'basic_salary', basic_salary,
        'hra', hra,
        'allowances', allowances
    ) INTO v_finance
    FROM public.employee_finance
    WHERE employee_id::text = v_user_id::text; -- FORCE TEXT COMPARISON

    -- 7. Construct Final JSON Response
    RETURN json_build_object(
        'success', true,
        'data', json_build_object(
            'id', v_profile.id,
            'full_name', v_profile.full_name,
            'email', v_profile.email,
            'phone', v_profile.phone,
            'location', v_profile.location,
            'avatar_url', v_profile.avatar_url,
            'role', v_profile.role,
            'job_title', v_profile.job_title,
            'employment_type', v_profile.employment_type,
            'department_name', COALESCE(v_dept_name, ''),
            'primary_project', v_primary_project_name,
            'project_assignments', COALESCE(v_project_assignments, '[]'::json),
            'compensation', v_finance
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_profile_details() TO authenticated;
NOTIFY pgrst, 'reload schema';
