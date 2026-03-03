-- ==========================================
-- 1. Get MY Payroll History (For Employees)
-- ==========================================
CREATE OR REPLACE FUNCTION get_my_payroll_history()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_results json;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'month', p.month,
            'year', TO_CHAR(p.created_at, 'YYYY'), -- Deriving year from created_at or add column if needed
            'basic_salary', p.basic_salary,
            'hra', p.hra,
            'allowances', p.allowances,
            'deductions', p.deductions,
            'professional_tax', p.professional_tax,
            'lop_days', p.lop_days,
            'net_salary', p.net_salary,
            'status', p.status,
            'created_at', p.created_at,
            'total_working_days', p.total_working_days,
            'present_days', p.present_days,
            'leave_days', p.leave_days
        ) ORDER BY p.created_at DESC
    ) INTO v_results
    FROM public.payroll p
    WHERE p.employee_id = v_user_id;

    RETURN json_build_object('success', true, 'data', COALESCE(v_results, '[]'::json));
END;
$$;


-- ==================================================
-- 2. Get ORGANIZATION Payroll History (For HR/Execs)
-- ==================================================
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


-- ============================================
-- 3. GENERATE MONTHLY PAYROLL (The Heavy Lift)
-- ============================================
CREATE OR REPLACE FUNCTION generate_monthly_payroll(
    p_month_str text, -- e.g. "February 2026"
    p_total_working_days int -- e.g. 20
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
    v_user_role text;
    v_emp RECORD;
    v_processed_count int := 0;
    
    -- Payroll Calculation Variables
    v_basic_salary numeric;
    v_hra numeric;
    v_allowances numeric;
    v_gross_salary numeric;
    
    v_daily_rate numeric;
    v_lop_deduction numeric; -- Loss of Pay
    v_prof_tax numeric := 200; -- Standard PT (can be config)
    v_other_deductions numeric := 0;
    v_net_salary numeric;
    
    v_present_days int; -- In real app, fetch from attendance_logs
    v_leave_days int;   -- In real app, fetch from leave_requests
    v_lop_days int;
    
BEGIN
    -- 1. Auth Check
    v_user_id := auth.uid();
    SELECT org_id, role INTO v_org_id, v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role NOT IN ('executive', 'manager', 'admin') THEN
         RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- 2. Idempotency Check (Don't generate twice for same month)
    IF EXISTS (SELECT 1 FROM public.payroll WHERE org_id = v_org_id AND month = p_month_str) THEN
        RETURN json_build_object('success', false, 'error', 'Payroll already generated for this month');
    END IF;

    -- 3. Loop through ALL Active Employees in Org
    FOR v_emp IN 
        SELECT id, salary_base, salary_hra, salary_allowances 
        FROM public.profiles 
        WHERE org_id = v_org_id AND status = 'active'
    LOOP
        -- Simple defaulting if columns are null
        v_basic_salary := COALESCE(v_emp.salary_base, 50000); 
        v_hra := COALESCE(v_emp.salary_hra, 20000);
        v_allowances := COALESCE(v_emp.salary_allowances, 5000);
        v_gross_salary := v_basic_salary + v_hra + v_allowances;

        -- 4. Calculate Attendance (Mock Logic for Demo - Replace with JOIN attendance_logs)
        -- For now, we assume perfect attendance to get the system working
        v_present_days := p_total_working_days; 
        v_leave_days := 0; 
        v_lop_days := 0;
        
        -- Logic: If lop_days > 0, deduct pro-rata
        IF v_gross_salary > 0 AND p_total_working_days > 0 THEN
            v_daily_rate := v_gross_salary / 30; -- Standard 30-day month calc
            v_lop_deduction := v_daily_rate * v_lop_days;
        ELSE
            v_lop_deduction := 0;
        END IF;

        -- 5. Calculate Final Net Salary
        v_net_salary := v_gross_salary - v_lop_deduction - v_prof_tax - v_other_deductions;
        IF v_net_salary < 0 THEN v_net_salary := 0; END IF;

        -- 6. Insert Record
        INSERT INTO public.payroll (
            org_id,
            employee_id, 
            month, 
            basic_salary, 
            hra, 
            allowances, 
            deductions, 
            professional_tax, 
            lop_days, 
            net_salary, 
            status, 
            created_at,
            total_working_days,
            present_days,
            leave_days,
            generated_by
        ) VALUES (
            v_org_id,
            v_emp.id,
            p_month_str,
            v_basic_salary,
            v_hra,
            v_allowances,
            (v_lop_deduction + v_other_deductions), -- Total deductions except PT
            v_prof_tax,
            v_lop_days,
            ROUND(v_net_salary, 2),
            'generated',
            NOW(),
            p_total_working_days,
            v_present_days,
            v_leave_days,
            v_user_id
        );
        
        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN json_build_object('success', true, 'processed', v_processed_count);
END;
$$;

-- Grant Permissions
GRANT EXECUTE ON FUNCTION get_my_payroll_history() TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_payroll_history() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_monthly_payroll(text, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
