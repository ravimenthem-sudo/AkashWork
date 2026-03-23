
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
    const { error: insError } = await supabase.from('task_steps').insert({}).select();
    let result = '';
    if (insError) {
        result = `✅ Table task_steps exists. Columns from error: ${insError.message}\n`;
    } else {
        result = `✅ Table task_steps exists. Insert worked? Data: ${JSON.stringify(data)}\n`;
    }
    fs.writeFileSync('task_steps_columns.txt', result);
}

checkColumns();
