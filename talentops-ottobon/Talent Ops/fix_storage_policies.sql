-- =====================================================
-- FIX SUPABASE STORAGE BUCKET POLICIES
-- This script ensures all users can upload documents
-- to the necessary storage buckets
-- =====================================================

-- =====================================================
-- 1. TASK-PROOFS BUCKET
-- For employee task submission proofs
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to task-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from task-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from task-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own task proofs" ON storage.objects;

-- Policy: Allow all authenticated users to upload to task-proofs
CREATE POLICY "Allow authenticated uploads to task-proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-proofs');

-- Policy: Allow all authenticated users to read from task-proofs
CREATE POLICY "Allow authenticated reads from task-proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-proofs');

-- Policy: Allow public reads (for proof URLs)
CREATE POLICY "Allow public reads from task-proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-proofs');

-- Policy: Allow users to update their own files
CREATE POLICY "Allow users to update their task proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'task-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Allow users to delete their own files
CREATE POLICY "Allow users to delete their own task proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- 2. PROJECT-DOCS BUCKET
-- For project documentation and guidance files
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to project-docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from project-docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from project-docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow managers to delete project docs" ON storage.objects;

-- Policy: Allow all authenticated users to upload to project-docs
CREATE POLICY "Allow authenticated uploads to project-docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-docs');

-- Policy: Allow all authenticated users to read from project-docs
CREATE POLICY "Allow authenticated reads from project-docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-docs');

-- Policy: Allow public reads (for document URLs)
CREATE POLICY "Allow public reads from project-docs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-docs');

-- Policy: Allow all authenticated users to update project docs
CREATE POLICY "Allow authenticated updates to project-docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-docs');

-- Policy: Allow all authenticated users to delete project docs
CREATE POLICY "Allow authenticated deletes from project-docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-docs');

-- =====================================================
-- 3. POLICIES BUCKET
-- For company policy documents
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to policies" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from policies" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from policies" ON storage.objects;

-- Policy: Allow all authenticated users to upload to policies
CREATE POLICY "Allow authenticated uploads to policies"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'policies');

-- Policy: Allow all authenticated users to read from policies
CREATE POLICY "Allow authenticated reads from policies"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'policies');

-- Policy: Allow public reads (for policy document URLs)
CREATE POLICY "Allow public reads from policies"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'policies');

-- Policy: Allow authenticated users to update policies
CREATE POLICY "Allow authenticated updates to policies"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'policies');

-- Policy: Allow authenticated users to delete policies
CREATE POLICY "Allow authenticated deletes from policies"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'policies');

-- =====================================================
-- 4. AVATARS BUCKET
-- For user profile pictures
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their avatars" ON storage.objects;

-- Policy: Allow all authenticated users to upload to avatars
CREATE POLICY "Allow authenticated uploads to avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Policy: Allow all authenticated users to read from avatars
CREATE POLICY "Allow authenticated reads from avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Policy: Allow public reads (for avatar URLs)
CREATE POLICY "Allow public reads from avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy: Allow users to update their own avatars
CREATE POLICY "Allow users to update their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Policy: Allow users to delete their own avatars
CREATE POLICY "Allow users to delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- =====================================================
-- 5. RESUMES BUCKET
-- For candidate resumes in ATS
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to resumes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from resumes" ON storage.objects;

-- Policy: Allow all authenticated users to upload to resumes
CREATE POLICY "Allow authenticated uploads to resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resumes');

-- Policy: Allow all authenticated users to read from resumes
CREATE POLICY "Allow authenticated reads from resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes');

-- Policy: Allow authenticated users to update resumes
CREATE POLICY "Allow authenticated updates to resumes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resumes');

-- Policy: Allow authenticated users to delete resumes
CREATE POLICY "Allow authenticated deletes from resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resumes');

-- =====================================================
-- 6. INVOICES BUCKET
-- For invoice PDFs
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from invoices" ON storage.objects;

-- Policy: Allow all authenticated users to upload to invoices
CREATE POLICY "Allow authenticated uploads to invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Policy: Allow all authenticated users to read from invoices
CREATE POLICY "Allow authenticated reads from invoices"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');

-- Policy: Allow authenticated users to update invoices
CREATE POLICY "Allow authenticated updates to invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices');

-- Policy: Allow authenticated users to delete invoices
CREATE POLICY "Allow authenticated deletes from invoices"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invoices');

-- =====================================================
-- 7. PAYSLIPS BUCKET
-- For employee payslip PDFs
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to payslips" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from payslips" ON storage.objects;

-- Policy: Allow all authenticated users to upload to payslips
CREATE POLICY "Allow authenticated uploads to payslips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payslips');

-- Policy: Allow all authenticated users to read from payslips
CREATE POLICY "Allow authenticated reads from payslips"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payslips');

-- Policy: Allow authenticated users to update payslips
CREATE POLICY "Allow authenticated updates to payslips"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payslips');

-- Policy: Allow authenticated users to delete payslips
CREATE POLICY "Allow authenticated deletes from payslips"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payslips');

-- =====================================================
-- 8. MESSAGE-ATTACHMENTS BUCKET
-- For message attachments
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to message-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from message-attachments" ON storage.objects;

-- Policy: Allow all authenticated users to upload to message-attachments
CREATE POLICY "Allow authenticated uploads to message-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- Policy: Allow all authenticated users to read from message-attachments
CREATE POLICY "Allow authenticated reads from message-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');

-- Policy: Allow users to update their message attachments
CREATE POLICY "Allow users to update message-attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'message-attachments');

-- Policy: Allow users to delete their message attachments
CREATE POLICY "Allow users to delete message-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments');

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to check if policies are applied correctly
-- =====================================================

-- Check all storage policies
-- SELECT * FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname;

-- Check specific bucket policies
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE schemaname = 'storage' AND tablename = 'objects'
-- AND policyname LIKE '%task-proofs%';

-- =====================================================
-- NOTES:
-- 1. All buckets now allow authenticated users to upload
-- 2. Public read access is enabled for buckets that need it
-- 3. Users can manage (update/delete) files they created
-- 4. This should fix the inconsistent upload behavior
-- =====================================================
