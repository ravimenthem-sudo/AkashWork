
-- =============================================
-- 5. APPROVE / REJECT LEAVE
-- =============================================
-- Logic:
-- 1. Manager Action.
-- 2. If Approve -> Deduct from Profile Balance.
-- 3. If Reject -> Just update status.

CREATE OR REPLACE FUNCTION manage_leave_request(
    p_request_id uuid,
    p_action text, -- 'approve' or 'reject'
    p_manager_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_leave RECORD;
BEGIN
    -- Get Leave Record
    SELECT * INTO v_leave FROM public.leaves WHERE id = p_request_id;
    
    IF NOT FOUND THEN
         RETURN json_build_object('success', false, 'error', 'Request not found');
    END IF;

    -- Logic Switch
    IF p_action = 'approve' THEN
        -- Deduct Balance
        UPDATE public.profiles
        SET 
            leaves_remaining_this_month = leaves_remaining_this_month - v_leave.duration_weekdays,
            leaves_taken_this_month = leaves_taken_this_month + v_leave.duration_weekdays
        WHERE id = v_leave.employee_id;

        -- Update Status
        UPDATE public.leaves 
        SET status = 'approved', updated_at = NOW() 
        WHERE id = p_request_id;
        
        RETURN json_build_object('success', true, 'message', 'Leave Approved');

    ELSIF p_action = 'reject' THEN
        -- Update Status Only
        UPDATE public.leaves 
        SET status = 'rejected', reason = reason || ' | Rejection: ' || p_manager_note 
        WHERE id = p_request_id;
        
        RETURN json_build_object('success', true, 'message', 'Leave Rejected');
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid Action');
    END IF;
END;
$$;
