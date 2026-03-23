import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env file.')
    console.error('VITE_SUPABASE_URL:', supabaseUrl)
    console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'Missing')
}

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'supabase.auth.token',
    },
    global: {
        headers: {
            'x-client-info': 'talentops-web',
        },
    },
    db: {
        schema: 'public',
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
})

// Test connection on initialization
supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
        console.error('⚠️ Supabase connection error:', error.message)
        console.error('Please check:')
        console.error('1. Your Supabase project is active (not paused)')
        console.error('2. The URL and API key are correct')
        console.error('3. Your internet connection is working')
    } else {
        console.log('✅ Supabase client initialized successfully')
        if (data.session) {
            console.log('✅ Active session found for user:', data.session.user.email)
        }
    }
}).catch((err) => {
    console.error('❌ Failed to initialize Supabase:', err)
})

