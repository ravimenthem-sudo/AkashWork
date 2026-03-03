
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

async function checkSpecificTask() {
    const { data, error } = await supabase
        .from('tasks')
        .select('title, total_points, allocated_hours')
        .ilike('title', '%Development skills%');

    console.log('--- SPECIFIC TASK CHECK ---');
    if (data) {
        data.forEach(t => {
            console.log(`Title: ${t.title}`);
            console.log(`Points: ${t.total_points}`);
            console.log(`Hours: ${t.allocated_hours}`);
        });
    }
}

checkSpecificTask();
