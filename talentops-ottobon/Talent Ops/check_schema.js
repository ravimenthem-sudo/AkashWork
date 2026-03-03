
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

async function checkSchema() {
    console.log('--- CHECKING SCHEMA ---');

    // Try to select one row and see keys
    const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No data found, cannot infer columns easily via select *.');
        // Try to insert with user_id and see error
        const { error: insError } = await supabase.from('task_submissions').insert({
            task_id: '00000000-0000-0000-0000-000000000000', // Dummy
            user_id: '00000000-0000-0000-0000-000000000000'
        });
        console.log('Insert Test Error:', insError);
    }
}

checkSchema();
