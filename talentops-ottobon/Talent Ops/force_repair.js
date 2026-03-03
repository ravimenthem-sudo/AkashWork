
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function forceUpdatePoints() {
    console.log('Attemping to FORCE update using manual update...');
    // If the trigger isn't working or the insert fails, let's try to manually set the points
    // This assumes the user has permissions, which they should in this env

    // 1. Get Task
    const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('total_points', 20)
        .single();

    if (!task) {
        console.log('Task not found');
        return;
    }

    console.log(`Task Found: ${task.id}`);

    // 2. Try to Insert Submission WITHOUT expecting return (to bypass PGRST204 if that's the issue)
    // AND manually calculating points if the trigger fails
    const payload = {
        task_id: task.id,
        user_id: task.assigned_to,
        actual_hours: task.allocated_hours,
        submitted_at: new Date().toISOString(),
        status: 'approved',
        final_points: 20, // Manually setting it
        bonus_points: 0,
        penalty_points: 0
    };

    // Check if exists first
    const { data: sub } = await supabase.from('task_submissions').select('id').eq('task_id', task.id).maybeSingle();

    if (sub) {
        console.log('Updating existing...');
        const { error } = await supabase.from('task_submissions').update({ final_points: 20 }).eq('id', sub.id);
        console.log('Update result:', error || 'Success');
    } else {
        console.log('Inserting new...');
        const { error } = await supabase.from('task_submissions').insert(payload);
        console.log('Insert result:', error || 'Success');
    }
}

forceUpdatePoints();
