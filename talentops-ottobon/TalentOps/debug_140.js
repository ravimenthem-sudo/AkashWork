
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

async function inspectTasks() {
    console.log('--- INSPECTING TASKS ---');

    // Search for the tasks seen in the screenshot
    const currTitles = [
        'Development skills - Frontend, Content Generation',
        'Task Module Changes',
        'Soft skills - English, Second-Order thinking'
    ];

    for (const title of currTitles) {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('title', title);

        if (data && data.length > 0) {
            console.log(`\nFound "${title}":`);
            data.forEach(t => {
                console.log(`  ID: ${t.id}`);
                console.log(`  User: ${t.assigned_to}`);
                console.log(`  Allocated Hrs: ${t.allocated_hours}`);
                console.log(`  Total Points: ${t.total_points}`);
                console.log(`  Status: ${t.status}`);
            });
        } else {
            console.log(`\nTask not found: "${title}"`);
        }
    }

    console.log('\n--- CHECKING FOR 140 POINTS ---');
    // Check if any single task has 140 points or sum matches
    const { data: allTasks } = await supabase.from('tasks').select('id, title, total_points, assigned_to');

    const userPoints = {};
    allTasks.forEach(t => {
        const p = parseFloat(t.total_points) || 0;
        if (!userPoints[t.assigned_to]) userPoints[t.assigned_to] = { sum: 0, tasks: [] };
        userPoints[t.assigned_to].sum += p;
        if (p > 0) userPoints[t.assigned_to].tasks.push({ title: t.title, points: p });
    });

    Object.entries(userPoints).forEach(([uid, data]) => {
        if (data.sum === 140) {
            console.log(`\nUser ${uid} has exactly 140 potential points!`);
            console.log('Contributing tasks:');
            data.tasks.forEach(t => console.log(` - ${t.title}: ${t.points}`));
        }
    });
}

inspectTasks();
