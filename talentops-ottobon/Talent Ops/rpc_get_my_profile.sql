-- ==============================================================================
-- RPC: get_my_profile_details
-- ==============================================================================
-- Description:
-- Fetches comprehensive profile details for the authenticated user in a single call.
-- Aggregates data from:
--   1. profiles (basic info)
--   2. departments (department name)
--   3. projects (primary project name)
--   4. project_members (all assigned projects & roles)
--   5. employee_finance (salary info)
--
-- Returns:
--   JSON object containing all the fields required by the Settings UI.
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
    -- 1. Get current user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- 2. Fetch Basic Profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    
    IF NOT FOUND THEN
         RETURN json_build_object('success', false, 'error', 'Profile not found');
    END IF;

    -- 3. Fetch Department Name
    SELECT department_name INTO v_dept_name
    FROM public.departments
    WHERE id = v_profile.department;

    -- 4. Fetch Primary Project Name (via team_id)
    SELECT name INTO v_primary_project_name
    FROM public.projects
    WHERE id = v_profile.team_id;

    -- 5. Fetch All Project Assignments (Primary + Secondary)
    -- We construct a JSON array of objects { projectName, role }
    SELECT json_agg(
        json_build_object(
            'projectName', p.name,
            'role', pm.project_role
        )
    ) INTO v_project_assignments
    FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    WHERE pm.employee_id = v_user_id;

    -- 6. Fetch Finance Data
    SELECT json_build_object(
        'basic_salary', basic_salary,
        'hra', hra,
        'allowances', allowances
    ) INTO v_finance
    FROM public.employee_finance
    WHERE employee_id = v_user_id;

    -- 7. Construct Final JSON Response
    RETURN json_build_object(
        'success', true,
        'data', json_build_object(
            'id', v_profile.id,
            'full_name', v_profile.full_name,
            'email', v_profile.email, -- Note: profiles table usually stores email too, or we trust auth.email
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

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_my_profile_details() TO authenticated;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
