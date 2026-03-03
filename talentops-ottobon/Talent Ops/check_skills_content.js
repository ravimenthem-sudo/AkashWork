
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSkillsContent() {
    const { data } = await supabase.from('profiles').select('id, full_name, skills').limit(3);
    console.log('Profile Skills Content:', JSON.stringify(data, null, 2));
}

checkSkillsContent();
