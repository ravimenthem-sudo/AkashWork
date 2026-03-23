CREATE OR REPLACE FUNCTION get_org_payroll_history()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
    v_user_role text;
    v_results json;
BEGIN
    v_user_id := auth.uid();
    
    SELECT org_id, role INTO v_org_id, v_user_role
    FROM public.profiles 
    WHERE id = v_user_id;

    -- Strict Permission Check
    IF v_user_role NOT IN ('executive', 'manager', 'admin') THEN
         RETURN json_build_object('success', false, 'error', 'Unauthorized: Executives/Managers only');
    END IF;

    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'employee_id', p.employee_id,
            'name', pro.full_name,
            'email', pro.email,
            'month', p.month,
            'basic_salary', p.basic_salary,
            'hra', p.hra,
            'allowances', p.allowances,
            'deductions', p.deductions,
            'professional_tax', p.professional_tax,
            'lop_days', p.lop_days,
            'net_salary', p.net_salary,
            'status', p.status,
            'created_at', p.created_at,
            'present_days', p.present_days,
            'leave_days', p.leave_days
        ) ORDER BY p.created_at DESC
    ) INTO v_results
    FROM public.payroll p
    JOIN public.profiles pro ON p.employee_id = pro.id
    WHERE p.org_id = v_org_id;

    RETURN json_build_object('success', true, 'data', COALESCE(v_results, '[]'::json));
END;
$$;

GRANT EXECUTE ON FUNCTION get_org_payroll_history() TO authenticated;
NOTIFY pgrst, 'reload schema';
