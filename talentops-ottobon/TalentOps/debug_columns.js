
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

async function inspectColumns() {
    console.log('--- INSPECTING COLUMNS ---');

    // Create a dummy RPC call or try to guess.
    // Actually, I can't run arbitrary SQL from here unless I have a function exposed.
    // BUT, I can try to select only the ID from task_submissions to confirm table exists

    const { data, error } = await supabase.from('task_submissions').select('id').limit(1);
    if (error) {
        console.log('Table fetch error:', error);
    } else {
        console.log('Table exists. Sample ID:', data[0]?.id);
    }

    // Bruteforce check common column names by selecting them
    const potentialCols = ['user_id', 'employee_id', 'submitted_by', 'assignee_id', 'profile_id', 'member_id'];

    for (const col of potentialCols) {
        const { error: colError } = await supabase.from('task_submissions').select(col).limit(1);
        if (!colError) {
            console.log(`✅ Column FOUND: ${col}`);
        } else {
            console.log(`❌ Column NOT found: ${col} (${colError.message})`);
        }
    }
}

inspectColumns();
