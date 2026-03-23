
import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function inspectLeaves() {
    console.log('--- Inspecting leaves table ---');
    const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching from leaves:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns in leaves:', Object.keys(data[0]));
    } else {
        console.log('Leaves table is empty. Trying to find columns via RPC or assume defaults.');
    }
}

inspectLeaves();
