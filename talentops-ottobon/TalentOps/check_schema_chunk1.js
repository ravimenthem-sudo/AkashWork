
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking "tasks" table schema...');

    // We can't directly describe tables with JS client easily, but we can try to select 'step_duration_setting'
    // or inspect a row.
    const { data, error } = await supabase
        .from('tasks')
        .select('id, step_duration_setting, allocated_hours, total_points')
        .limit(1);

    if (error) {
        console.log('Error or column missing:', error.message);
    } else {
        console.log('Columns exist. Sample Data:', data);
    }
}

checkSchema();
