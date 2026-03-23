
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('--- ACTION REQUIRED ---');
console.log('I have generated the SQL file: triggers/chunk4_analytics.sql');
console.log('Please execute the contents of this file in your Supabase Dashboard SQL Editor.');
console.log('This will create the "get_user_performance_stats" function needed for the Dashboard.');
console.log('-----------------------');
