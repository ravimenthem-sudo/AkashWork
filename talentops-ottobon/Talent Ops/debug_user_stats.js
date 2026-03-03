
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUserStats() {
    console.log('--- Debugging User Stats & Points ---');

    // 1. List all users (profiles) to identify our user
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').limit(5);
    console.log('Profiles:', profiles);

    // 2. List recent tasks and their point values
    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, assigned_to, allocated_hours, total_points')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log('Recent Tasks:', tasks);

    // 3. List entries in task_submissions
    const { data: submissions } = await supabase
        .from('task_submissions')
        .select('id, task_id, actual_hours, final_points, submitted_at')
        .limit(10);
    console.log('Submissions:', submissions);
}

debugUserStats();
