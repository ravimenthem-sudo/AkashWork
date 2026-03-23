
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTask() {
    // Fix the specific task 'testttttt' to have 12 hours (matching its 120 points)
    const { error } = await supabase
        .from('tasks')
        .update({ allocated_hours: 12 })
        .ilike('title', '%testttttt%');

    if (error) {
        console.error('Error fixing task:', error);
    } else {
        console.log('Successfully corrected task hours to 12.');
    }
}

fixTask();
