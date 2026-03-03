
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompletedTasks() {
    console.log('Checking for completed tasks without submissions...');

    // 1. Get completed tasks
    const { data: completedTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'completed');

    console.log(`Found ${completedTasks?.length || 0} completed tasks.`);

    if (completedTasks && completedTasks.length > 0) {
        console.log('Sample Completed Task:', completedTasks[0]);

        // Check if they have submissions
        for (const task of completedTasks) {
            const { data: submission } = await supabase
                .from('task_submissions')
                .select('*')
                .eq('task_id', task.id);

            console.log(`Task "${task.title}" (${task.id}) submissions:`, submission?.length);
        }
    }
}

checkCompletedTasks();
