-- =====================================================
-- SIMPLIFIED STORAGE POLICIES FOR ALL BUCKETS
-- This removes folder-based restrictions that cause
-- inconsistent upload behavior
-- =====================================================

-- =====================================================
-- 1. TASK-PROOFS BUCKET - SIMPLIFIED POLICIES
-- =====================================================

-- Drop all existing policies for task-proofs
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to task-proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from task-proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public reads from task-proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to delete their own task proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to update their task proofs" ON storage.objects;
    DROP POLICY IF EXISTS "task-proofs upload policy" ON storage.objects;
    DROP POLICY IF EXISTS "task-proofs select policy" ON storage.objects;
    DROP POLICY IF EXISTS "task-proofs update policy" ON storage.objects;
    DROP POLICY IF EXISTS "task-proofs delete policy" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Simple INSERT policy - anyone authenticated can upload
CREATE POLICY "task-proofs: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-proofs');

-- Simple SELECT policy - anyone authenticated can read
CREATE POLICY "task-proofs: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-proofs');

-- Public SELECT policy for public URLs
CREATE POLICY "task-proofs: public select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-proofs');

-- Simple UPDATE policy
CREATE POLICY "task-proofs: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-proofs');

-- Simple DELETE policy
CREATE POLICY "task-proofs: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-proofs');

-- =====================================================
-- 2. PROJECT-DOCS BUCKET - SIMPLIFIED POLICIES
-- =====================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to project-docs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from project-docs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public reads from project-docs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow managers to delete project docs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated updates to project-docs" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated deletes from project-docs" ON storage.objects;
    DROP POLICY IF EXISTS "project-docs upload policy" ON storage.objects;
    DROP POLICY IF EXISTS "project-docs select policy" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "project-docs: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-docs');

CREATE POLICY "project-docs: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-docs');

CREATE POLICY "project-docs: public select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-docs');

CREATE POLICY "project-docs: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-docs');

CREATE POLICY "project-docs: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-docs');

-- =====================================================
-- 3. POLICIES BUCKET - SIMPLIFIED POLICIES
-- =====================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to policies" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from policies" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public reads from policies" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated updates to policies" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated deletes from policies" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "policies: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'policies');

CREATE POLICY "policies: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'policies');

CREATE POLICY "policies: public select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'policies');

CREATE POLICY "policies: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'policies');

CREATE POLICY "policies: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'policies');

-- =====================================================
-- 4. AVATARS BUCKET - SIMPLIFIED POLICIES
-- =====================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public reads from avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to update their avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to delete their avatars" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "avatars: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "avatars: public select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "avatars: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "avatars: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- =====================================================
-- 5. RESUMES BUCKET - SIMPLIFIED POLICIES
-- =====================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to resumes" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from resumes" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated updates to resumes" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated deletes from resumes" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "resumes: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "resumes: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes');

CREATE POLICY "resumes: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resumes');

CREATE POLICY "resumes: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resumes');

-- =====================================================
-- 6. INVOICES BUCKET - SIMPLIFIED POLICIES
-- =====================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated updates to invoices" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated deletes from invoices" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "invoices: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "invoices: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices');

CREATE POLICY "invoices: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoices');

-- =====================================================
-- 7. PAYSLIPS BUCKET - SIMPLIFIED POLICIES
-- =====================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to payslips" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from payslips" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated updates to payslips" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated deletes from payslips" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "payslips: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payslips');

CREATE POLICY "payslips: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payslips');

CREATE POLICY "payslips: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payslips');

CREATE POLICY "payslips: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payslips');

-- =====================================================
-- 8. MESSAGE-ATTACHMENTS BUCKET - SIMPLIFIED POLICIES
-- =====================================================

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to message-attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated reads from message-attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to update message-attachments" ON storage.objects;
    DROP POLICY IF EXISTS "Allow users to delete message-attachments" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "message-attachments: insert for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

CREATE POLICY "message-attachments: select for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');

CREATE POLICY "message-attachments: update for authenticated"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'message-attachments');

CREATE POLICY "message-attachments: delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments');

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Ensure authenticated role has access to storage schema
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- List all storage policies (uncomment to run)
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'storage' 
-- ORDER BY tablename, policyname;

-- Check task-proofs bucket policies specifically
-- SELECT policyname, cmd, roles
-- FROM pg_policies 
-- WHERE schemaname = 'storage' 
--   AND tablename = 'objects'
--   AND policyname LIKE '%task-proofs%';

-- =====================================================
-- NOTES:
-- 1. Removed all folder-based restrictions
-- 2. All authenticated users can now upload to any bucket
-- 3. Public read access for buckets that need it (task-proofs, project-docs, policies, avatars)
-- 4. This should completely fix the upload issues
-- 5. Apply this script to your Supabase database via SQL Editor
-- =====================================================
