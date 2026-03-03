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
    v_lop_deduction numeric; 
    v_prof_tax numeric; 
    v_other_deductions numeric := 0;
    v_net_salary numeric;
    
    v_present_days int;
    v_leave_days int;
    v_lop_days int;
    
BEGIN
    -- 1. Auth Check
    v_user_id := auth.uid();
    SELECT org_id, role INTO v_org_id, v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_user_role NOT IN ('executive', 'manager', 'admin') THEN
         RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- 2. Idempotency Check
    IF EXISTS (SELECT 1 FROM public.payroll WHERE org_id = v_org_id AND month = p_month_str) THEN
        RETURN json_build_object('success', false, 'error', 'Payroll already generated for this month');
    END IF;

    -- 3. Loop through ALL Active Employees JOINED with Employee Finance
    FOR v_emp IN 
        SELECT 
            pro.id, 
            fin.basic_salary, 
            fin.hra, 
            fin.allowances,
            fin.professional_tax
        FROM public.profiles pro
        LEFT JOIN public.employee_finance fin ON pro.id = fin.employee_id
        WHERE pro.org_id = v_org_id AND pro.status = 'active'
    LOOP
        -- Defaulting (Safe Fallback to 0 if finance record missing)
        v_basic_salary := COALESCE(v_emp.basic_salary, 0); 
        v_hra := COALESCE(v_emp.hra, 0);
        v_allowances := COALESCE(v_emp.allowances, 0);
        v_prof_tax := COALESCE(v_emp.professional_tax, 200); -- Standard PT
        
        v_gross_salary := v_basic_salary + v_hra + v_allowances;

        -- 4. Calculate Attendance (Mock Logic: Perfect Attendance for now)
        v_present_days := p_total_working_days; 
        v_leave_days := 0; 
        v_lop_days := 0;
        
        -- Logic: If lop_days > 0, deduct pro-rata
        IF v_gross_salary > 0 AND p_total_working_days > 0 THEN
            v_daily_rate := v_gross_salary / 30;
            v_lop_deduction := v_daily_rate * v_lop_days;
        ELSE
            v_lop_deduction := 0;
        END IF;

        -- 5. Calculate Final Net Salary
        v_net_salary := v_gross_salary - v_lop_deduction - v_prof_tax - v_other_deductions;
        IF v_net_salary < 0 THEN v_net_salary := 0; END IF;

        -- 6. Insert Record (Only if valid salary exists)
        IF v_gross_salary > 0 THEN
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
                (v_lop_deduction + v_other_deductions),
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
        END IF;
    END LOOP;

    RETURN json_build_object('success', true, 'processed', v_processed_count);
END;
$$;

GRANT EXECUTE ON FUNCTION generate_monthly_payroll(text, int) TO authenticated;
NOTIFY pgrst, 'reload schema';
