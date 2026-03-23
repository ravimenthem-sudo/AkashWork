
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('Checking columns in "tasks" table...');

    // We can't query information_schema directly with supabase-js usually, 
    // but we can try to select a single row and see the keys returned, 
    // OR try to insert a dummy row (rollback) or just inspecting the error more closely.
    // Better: let's try to update a non-existent task with the column and see the error,
    // or select the specific column from a valid task.

    const { data, error } = await supabase
        .from('tasks')
        .select('penalty_points_per_hour')
        .limit(1);

    if (error) {
        console.error('Error selecting column:', error);
    } else {
        console.log('Success! Column exists. Data from 1 row:', data);
    }
}

checkColumns();
