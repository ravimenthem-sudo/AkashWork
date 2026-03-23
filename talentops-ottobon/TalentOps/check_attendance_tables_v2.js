
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

const tablesToCheck = [
    'attendance_logs',
    'attendance',
    'leave_requests',
    'leaves',
    'leave_balances',
    'user_leaves',
    'profiles'
];

async function checkTables() {
    let output = '--- Checking Attendance & Leave Tables ---\n';

    for (const table of tablesToCheck) {
        output += `\nChecking table: ${table}\n`;
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            output += `  ❌ Error/Missing: ${error.message} (${error.code})\n`;
        } else {
            output += `  ✅ Table exists.\n`;
            if (data.length > 0) {
                output += `  Columns: ${Object.keys(data[0]).join(', ')}\n`;
            } else {
                output += `  Table is empty but exists.\n`;
            }
        }
    }

    fs.writeFileSync('tables_check_v2.txt', output, 'utf8');
    console.log("Check complete. Output written to tables_check_v2.txt");
}

checkTables();
