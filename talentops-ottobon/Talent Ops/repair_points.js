
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

async function repairTaskPoints() {
    console.log('--- RESTARTING REPAIR ---');

    // 1. Get the 20-point task
    const { data: tasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('total_points', 20)
        .single();

    if (fetchError) {
        console.error('Error fetching task:', fetchError);
        return;
    }

    console.log(`Found Task: "${tasks.title}" (${tasks.id})`);
    console.log(`Allocated: ${tasks.allocated_hours}, AssignedTo: ${tasks.assigned_to}`);

    // 2. Check for existing submission
    const { data: sub, error: subCheckError } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', tasks.id)
        .maybeSingle();

    if (sub) {
        console.log('Submission ALREADY exists:', sub);
        console.log(`Points in submission: ${sub.final_points}`);

        // If points are 0 or null, maybe update it to trigger calculation?
        if (!sub.final_points) {
            console.log('Updating submission to trigger check...');
            const { data: updated, error: upError } = await supabase
                .from('task_submissions')
                .update({ actual_hours: tasks.allocated_hours }) // Retrigger trigger
                .eq('id', sub.id)
                .select();

            if (upError) console.error('Update Error:', upError);
            else console.log('Updated:', updated);
        }
    } else {
        console.log('No submission found. Creating one...');

        const payload = {
            task_id: tasks.id,
            user_id: tasks.assigned_to,
            actual_hours: tasks.allocated_hours || 2, // Default to 2 if 0 to avoid div by zero logic if any
            submitted_at: new Date().toISOString(),
            status: 'approved'
        };

        const { data: inserted, error: insertError } = await supabase
            .from('task_submissions')
            .insert(payload)
            .select();

        if (insertError) {
            console.error('Insert Error Detail:', JSON.stringify(insertError, null, 2));
        } else {
            console.log('Success! Created submission:', inserted);
        }
    }
}

repairTaskPoints();
