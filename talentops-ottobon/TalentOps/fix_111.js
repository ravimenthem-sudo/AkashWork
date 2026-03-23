
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTask111() {
    console.log('Fixing task "111" to 15 hours...');

    const { error } = await supabase
        .from('tasks')
        .update({
            allocated_hours: 15,
            total_points: 150
        })
        .eq('title', '111');

    if (error) {
        console.error('Error updating task:', error);
    } else {
        console.log('Successfully updated task "111".');
    }
}

fixTask111();
