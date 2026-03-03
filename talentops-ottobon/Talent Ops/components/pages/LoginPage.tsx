import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import CursorGlow from '../newlanding/CursorGlow';

export const LoginPage = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        console.log('=== LOGIN ATTEMPT ===');
        console.log('Email:', username);

        try {
            console.log('Attempting authentication...');
            const { data, error } = await supabase.auth.signInWithPassword({
                email: username,
                password: password,
            });

            if (error) {
                console.error('❌ Authentication failed:', error);
                setError(error.message);
                return;
            }

            console.log('✅ Authentication successful');

            if (data.user) {
                // Check if user profile exists in the database
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (profileError || !profile) {
                    console.error('❌ No profile found for user');
                    await supabase.auth.signOut();
                    setError('Your account is not registered in the system. Please contact your administrator.');
                    return;
                }

                // Get role from profile
                let role = profile.role;

                if (!role) {
                    console.error('❌ No role assigned to profile');
                    await supabase.auth.signOut();
                    setError('Your account does not have a role assigned. Please contact your administrator.');
                    return;
                }

                const normalizedRole = role.toLowerCase().trim();

                switch (normalizedRole) {
                    case 'executive':
                    case 'admin':
                        navigate('/executive-dashboard');
                        break;
                    case 'manager':
                        navigate('/manager-dashboard');
                        break;
                    case 'team_lead':
                        navigate('/teamlead-dashboard');
                        break;
                    case 'employee':
                        navigate('/employee-dashboard');
                        break;
                    default:
                        console.error('❌ Invalid role:', normalizedRole);
                        await supabase.auth.signOut();
                        setError(`Invalid role assigned to your account: "${role}". Please contact your administrator.`);
                }
            }
        } catch (err) {
            console.error('❌ Unexpected error during login:', err);
            setError('An unexpected error occurred');
        }
    };

    return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-violet/5 blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent-cyan/5 blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10 transition-all duration-500 ease-out">
                <div className="bg-white border border-graphite/5 rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300">
                    <div className="text-center mb-10">
                        <span className="font-display text-4xl font-bold text-gradient-violet mb-2 block">
                            T
                        </span>
                        <h2 className="font-display text-3xl font-bold text-ink mb-2">Talent Ops</h2>
                        <p className="font-elegant text-graphite-light text-lg italic">Enter the Zone</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <input
                                type="text"
                                className="w-full bg-paper border border-graphite/10 rounded-lg px-4 py-3 text-ink font-body placeholder:text-graphite-light/50 focus:outline-none focus:border-accent-violet/50 focus:bg-white transition-all duration-300"
                                placeholder="Email"
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full bg-paper border border-graphite/10 rounded-lg px-4 py-3 text-ink font-body placeholder:text-graphite-light/50 focus:outline-none focus:border-accent-violet/50 focus:bg-white transition-all duration-300 pr-12"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-graphite-light/40 hover:text-accent-violet transition-colors duration-300"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <div className="flex justify-end">
                            <Link
                                to="/forgot-password"
                                className="font-accent text-[10px] font-bold text-graphite-light hover:text-accent-violet uppercase tracking-widest transition-colors duration-300"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-500 text-xs text-center font-body">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-ink text-paper font-accent font-bold uppercase tracking-widest text-xs py-4 rounded hover:bg-accent-violet hover:text-white transition-all duration-300 transform hover:-translate-y-1 shadow-lg shadow-ink/10 hover:shadow-accent-violet/20"
                        >
                            Login
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <Link
                            to="/"
                            className="font-accent text-xs font-medium text-graphite-light hover:text-accent-violet uppercase tracking-widest transition-colors duration-300"
                        >
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
