
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTask111() {
    console.log('Fetching task "111"...');

    // 1. Get Task Details
    const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('title', '111');

    if (taskError) {
        console.error('Error fetching task:', taskError);
        return;
    }

    if (tasks.length === 0) {
        console.log('No task found with title "111"');
        return;
    }

    const task = tasks[0];
    console.log('Task Details:', {
        id: task.id,
        title: task.title,
        allocated_hours: task.allocated_hours,
        total_points: task.total_points,
        points_per_hour: task.points_per_hour
    });

    // 2. Get Task Steps
    const { data: steps, error: stepsError } = await supabase
        .from('task_steps')
        .select('*')
        .eq('task_id', task.id);

    if (stepsError) {
        console.error('Error fetching steps:', stepsError);
        return;
    }

    console.log(`Found ${steps.length} steps.`);

    let totalStepHours = 0;
    steps.forEach(step => {
        console.log(`- Step: ${step.step_title} (${step.status}) -> ${step.estimated_hours}h`);
        totalStepHours += step.estimated_hours || 0;
    });

    console.log('Total Hours from Steps:', totalStepHours);
}

debugTask111();
