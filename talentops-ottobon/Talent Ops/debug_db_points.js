
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

async function debugPointsState() {
    console.log('--- DEBUGGING POINTS STATE ---');

    // 1. Get 20 most recent tasks for context
    // Use a broad search or just list all for the likely user
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, title, status, total_points, allocated_hours, assigned_to')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) { console.error(error); return; }

    console.log(`Found ${tasks.length} recent tasks.`);

    let totalPotential = 0;
    let totalEarned = 0;

    for (const t of tasks) {
        // Only care about tasks with points
        if (!t.total_points) continue;

        const { data: sub } = await supabase
            .from('task_submissions')
            .select('*')
            .eq('task_id', t.id)
            .maybeSingle();

        console.log(`\n[${t.status}] "${t.title}"`);
        console.log(`  > Pts: ${t.total_points} | Hrs: ${t.allocated_hours}`);

        if (sub) {
            console.log(`  > SUBMISSION FOUND: ID ${sub.id}`);
            console.log(`  > Final Points: ${sub.final_points}`);
            console.log(`  > Actual Hrs: ${sub.actual_hours}`);
            totalEarned += (sub.final_points || 0);
        } else {
            console.log(`  > NO SUBMISSION.`);
        }

        totalPotential += (t.total_points || 0);
    }

    console.log('-----------------------------------');
    console.log(`Calculated from DB: ${totalEarned} / ${totalPotential}`);
}

debugPointsState();
