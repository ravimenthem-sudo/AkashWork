
-- =============================================
-- RPC: Approve Leave
-- Purpose: Manager action to approve a leave.
-- CRITICAL: Deducts the leave duration from the user's profile balance.
-- =============================================

CREATE OR REPLACE FUNCTION approve_leave(
    p_request_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_leave RECORD;
BEGIN
    -- 1. Fetch Leave Record
    SELECT * INTO v_leave FROM public.leaves WHERE id = p_request_id;
    
    IF NOT FOUND THEN
         RETURN json_build_object('success', false, 'error', 'Request not found');
    END IF;

    IF v_leave.status != 'pending' THEN
        RETURN json_build_object('success', false, 'error', 'Request is not pending');
    END IF;

    -- 2. Deduct Balance from User Profile
    -- We assume duration_weekdays holds the number of days to deduct
    UPDATE public.profiles
    SET 
        leaves_remaining_this_month = leaves_remaining_this_month - v_leave.duration_weekdays,
        leaves_taken_this_month = leaves_taken_this_month + v_leave.duration_weekdays
    WHERE id = v_leave.employee_id;

    -- 3. Update Status to Approved
    UPDATE public.leaves 
    SET 
        status = 'approved', 
        -- approver_id = auth.uid(), -- Uncomment if column exists
        updated_at = NOW() 
    WHERE id = p_request_id;
    
    RETURN json_build_object('success', true, 'message', 'Leave Approved & Balance Deducted');
END;
$$;
