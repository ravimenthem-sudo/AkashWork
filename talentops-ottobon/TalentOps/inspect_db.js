
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('--- Inspecting skills_master ---');
    const { data: skills, error: skillError } = await supabase.from('skills_master').select('*').limit(1);
    if (skillError) {
        console.error('Error reading skills_master:', skillError);
    } else if (skills.length > 0) {
        console.log('skills_master columns:', Object.keys(skills[0]));
        console.log('Sample skill:', skills[0]);
    } else {
        console.log('skills_master is empty (but readable).');
    }

    console.log('\n--- Inspecting task_submissions ---');
    // Check if we can read it first
    const { data: subs, error: subReadError } = await supabase.from('task_submissions').select('*').limit(1);
    if (subReadError) {
        console.error('Error reading task_submissions:', subReadError);
    } else if (subs.length > 0) {
        console.log('task_submissions columns:', Object.keys(subs[0]));
    } else {
        console.log('task_submissions is empty (but readable).');
    }

    console.log('\n--- Testing Insert Permissions ---');
    // Need a task ID and User ID. We can't easily get a user ID without login.
    // But we can try to insert with a random UUID if we don't have FK constraints or if we just want to test RLS "permission denied" vs "constraint violation".
    // If RLS is strictly "auth.uid() = employee_id", we can't test it easily from a script without a signed-in session token.
    // But we can check if the basic structure is compatible.

    // If the user says they already had the tables, the columns might be mismatched.
    // My code expects: task_id, employee_id, org_id.

    if (subs && subs.length > 0) {
        const keys = Object.keys(subs[0]);
        if (!keys.includes('org_id')) console.warn('WARNING: org_id column missing in task_submissions');
        if (!keys.includes('employee_id')) console.warn('WARNING: employee_id column missing in task_submissions');
        if (!keys.includes('task_id')) console.warn('WARNING: task_id column missing in task_submissions');
    } else {
        console.log('Cannot verify columns of task_submissions because table is empty or unreadable.');
    }

    console.log('\n--- Inspecting leave_ai_analysis details ---');
    // Get the definition by inserting a row and then reading it back?
    // Or just select * limit 1 (even if empty, it gives structure? No, Supabase/PostgREST returns [] if empty).
    // Better: Query the information_schema via SQL? No, can't run SQL from JS easily without RPC.

    // Workaround: We inserted a dummy row in the previous step (if it wasn't rolled back).
    // Actually, inspect_db.js logic: insert error was checked.
    // Let's try to SELECT the dummy row we just inserted (if it persisted) or just insert another one and return it.

    const payload = {
        risk_score: 99,
        primary_warning: 'Schema Check',
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('leave_ai_analysis').insert(payload).select();

    if (error) {
        console.error('Insert Error:', error);
    } else if (data && data.length > 0) {
        console.log('Successfully inserted and retrieved row. Columns found:');
        console.log(Object.keys(data[0]).join(', '));

        // Clean up
        await supabase.from('leave_ai_analysis').delete().eq('id', data[0].id);
    }
}

inspect();
