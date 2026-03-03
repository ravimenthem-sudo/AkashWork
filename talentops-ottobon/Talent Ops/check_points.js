
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPoints() {
    console.log('Checking points data linkage...');

    // Get a task with submission
    const { data: submissions, error } = await supabase
        .from('task_submissions')
        .select(`
            id,
            final_points,
            task_id,
            tasks (
                id,
                title,
                assigned_to
            )
        `)
        .not('final_points', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error fetching submissions:', error);
        return;
    }

    console.log('Sample Submissions with Points:', JSON.stringify(submissions, null, 2));

    // Try a direct sum query? Supabase JS client doesn't do aggregate easily without rpc.
    // We will do it client side in the dashboard for now (assuming not widely paginated) 
    // or better, I should check if there is an RPC or just fetch all completed tasks for the user.
}

checkPoints();
