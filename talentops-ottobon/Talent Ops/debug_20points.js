
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

async function investigate20Points() {
    console.log('--- INVESTIGATING 20 POINT TASKS ---');

    // Find task with total_points = 20
    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, total_points, allocated_hours, assigned_to')
        .eq('total_points', 20);

    if (!tasks || tasks.length === 0) {
        console.log('No tasks found with exactly 20 points.');
        return;
    }

    for (const t of tasks) {
        console.log(`\nTASK: "${t.title}" (ID: ${t.id})`);
        console.log(`  Status: ${t.status}`);
        console.log(`  Assigned To: ${t.assigned_to}`);

        const { data: subs } = await supabase
            .from('task_submissions')
            .select('*')
            .eq('task_id', t.id);

        if (!subs || subs.length === 0) {
            console.log('  -> NO SUBMISSIONS FOUND.');
        } else {
            subs.forEach(s => {
                console.log('  -> Submission:');
                console.log(`     ID: ${s.id}`);
                console.log(`     Actual Hours: ${s.actual_hours}`);
                console.log(`     Final Points: ${s.final_points}`);
            });
        }
    }
}

investigate20Points();
