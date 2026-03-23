
-- =============================================
-- RPC: Reject Leave
-- Purpose: Manager action to reject a leave.
-- Does NOT affect balance. Just updates status.
-- =============================================

CREATE OR REPLACE FUNCTION reject_leave(
    p_request_id uuid,
    p_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.leaves 
    SET 
        status = 'rejected', 
        reason = reason || ' | Rejection: ' || p_reason, -- Append rejection note to reason
        updated_at = NOW() 
    WHERE id = p_request_id;
    
    RETURN json_build_object('success', true, 'message', 'Leave Rejected');
END;
$$;
