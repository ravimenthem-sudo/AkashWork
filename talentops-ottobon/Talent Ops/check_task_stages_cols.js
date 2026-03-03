
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    // Try to get one row or use a clever way to see columns
    // We can use an insert that fails or just select * where false
    const { data, error } = await supabase.from('task_stages').select('*').limit(0);
    let result = '';
    if (error) {
        result = `❌ Table task_stages error: ${error.message}\n`;
    } else {
        // Unfortunately Supabase JS client doesn't return column names on empty select 0
        // We might need to use RPC or just guess common names.
        // Actually, let's try to fetch a dummy insert with an empty object and see the error.
        const { error: insError } = await supabase.from('task_stages').insert({}).select();
        if (insError) {
            result = `✅ Table task_stages exists. Columns from error: ${insError.message}\n`;
        }
    }
    fs.writeFileSync('task_stages_columns.txt', result);
}

checkColumns();
