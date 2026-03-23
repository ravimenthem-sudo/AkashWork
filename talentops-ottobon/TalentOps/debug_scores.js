
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkScores() {
    console.log('Checking technical_scores...');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, technical_scores')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Profiles found:', profiles.length);
    profiles.forEach(p => {
        console.log(`User: ${p.full_name}`);
        console.log('Scores:', JSON.stringify(p.technical_scores, null, 2));
        console.log('---');
    });
}

checkScores();
