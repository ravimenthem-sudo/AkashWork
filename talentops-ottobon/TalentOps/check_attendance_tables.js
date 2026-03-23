
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
    console.log('--- Checking Attendance & Leave Tables ---');

    for (const table of tablesToCheck) {
        console.log(`\nChecking table: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.log(`  ❌ Error or Table does not exist: ${error.message} (${error.code})`);
        } else {
            console.log(`  ✅ Table exists.`);
            if (data.length > 0) {
                console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
            } else {
                console.log(`  Table is empty but exists.`);
            }
        }
    }
}

checkTables();
