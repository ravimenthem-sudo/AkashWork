
-- Fix RLS Policies for task_submissions

-- 1. Enable RLS
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- 2. Policy: View own submissions
DROP POLICY IF EXISTS "Users can view own submissions" ON task_submissions;
CREATE POLICY "Users can view own submissions"
ON task_submissions FOR SELECT
USING (auth.uid() = user_id);

-- 3. Policy: Insert own submissions
DROP POLICY IF EXISTS "Users can insert own submissions" ON task_submissions;
CREATE POLICY "Users can insert own submissions"
ON task_submissions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Policy: Update own submissions
DROP POLICY IF EXISTS "Users can update own submissions" ON task_submissions;
CREATE POLICY "Users can update own submissions"
ON task_submissions FOR UPDATE
USING (auth.uid() = user_id);

-- 5. Policy: Service Role / Admins (Optional but good practice)
-- Usually service role bypasses RLS, but if we need specific admin access:
-- (Skipping specific admin policy for now, assuming role-based access is handled or service role is used)

-- 6. Grant permissions
GRANT ALL ON task_submissions TO authenticated;
