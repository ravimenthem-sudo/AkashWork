
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

async function checkTaskStages() {
    console.log("Checking for task_stages table...");
    const { data, error } = await supabase.from('task_stages').select('*').limit(5);
    let result = '';
    if (error) {
        result = `❌ Table task_stages error: ${error.message}\n`;
    } else {
        result = `✅ Table task_stages exists.\n`;
        result += `   Sample data: ${JSON.stringify(data, null, 2)}\n`;
    }
    fs.writeFileSync('task_stages_check.txt', result);
}

checkTaskStages();
