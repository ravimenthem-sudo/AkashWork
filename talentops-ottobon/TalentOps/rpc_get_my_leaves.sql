
-- =============================================
-- RPC: Get My Leaves
-- Purpose: Fetch leave history for the logged-in employee.
-- =============================================

CREATE OR REPLACE FUNCTION get_my_leaves()
RETURNS SETOF public.leaves
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT * 
    FROM public.leaves
    WHERE employee_id = auth.uid()
    ORDER BY created_at DESC;
END;
$$;
