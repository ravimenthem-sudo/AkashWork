
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSkillsData() {
    console.log('Checking profiles and skills...');

    // Check profiles structure
    const { data: profile } = await supabase.from('profiles').select('*').limit(1);
    console.log('Profile Sample:', profile);

    // Check if there is a skills table
    const { data: skills, error } = await supabase.from('skills').select('*').limit(1);
    if (error) console.log('Skills table error (might not exist):', error.message);
    else console.log('Skills table:', skills);

    // Check if there is a user_skills or similar
    const { data: userSkills, error: usError } = await supabase.from('user_skills').select('*').limit(1);
    if (usError) console.log('user_skills table error:', usError.message);
    else console.log('user_skills:', userSkills);
}

checkSkillsData();
