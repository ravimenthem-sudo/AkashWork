
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

async function checkTaskPoints() {
    const { data: triggerTasks } = await supabase
        .from('tasks')
        .select('assigned_to')
        .ilike('title', '%Development skills%')
        .limit(1);

    const userId = triggerTasks?.[0]?.assigned_to;

    if (userId) {
        const { data: allUserTasks } = await supabase
            .from('tasks')
            .select('title, total_points')
            .eq('assigned_to', userId);

        console.log('--- START OUTPUT ---');
        let total = 0;
        allUserTasks.forEach(t => {
            if (t.total_points > 0) {
                console.log(`TASK: ${t.title} = ${t.total_points}`);
                total += t.total_points;
            }
        });
        console.log(`TOTAL POINTS: ${total}`);
        console.log('--- END OUTPUT ---');
    }
}

checkTaskPoints();
