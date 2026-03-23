
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    console.log('--- Checking for user akash@janmasethu.com in profiles ---');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'akash@janmasethu.com');

    if (error) {
        console.error('Error fetching profiles:', error);
    } else {
        console.log('Profiles found:', profiles);
    }

    console.log('\n--- Listing all profiles ---');
    const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .limit(10);

    if (allProfilesError) {
        console.error('Error fetching all profiles:', allProfilesError);
    } else {
        console.log('Sample profiles:', allProfiles);
    }
}

checkUser();
