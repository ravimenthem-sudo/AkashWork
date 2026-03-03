
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTimestamps() {
    const { data: task } = await supabase.from('tasks').select('created_at, updated_at').eq('title', '111').single();
    const { data: steps } = await supabase.from('task_steps').select('created_at, step_title').eq('task_id', 'a985a9ac-92d1-4438-add5-0f06dea9ce30'); // Using ID from previous log if possible, but title is safer if ID changed

    // Fetch ID again to be safe
    const { data: taskReal } = await supabase.from('tasks').select('id, created_at').eq('title', '111').single();
    const { data: stepsReal } = await supabase.from('task_steps').select('created_at, step_title').eq('task_id', taskReal.id);

    console.log('Task Created:', taskReal.created_at);
    if (stepsReal) {
        stepsReal.forEach(s => console.log(`Step ${s.step_title}: ${s.created_at}`));
    }
}

checkTimestamps();
