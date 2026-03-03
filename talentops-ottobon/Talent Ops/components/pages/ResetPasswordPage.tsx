import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Supabase sends the recovery token in the URL hash
        // The hash looks like: #access_token=...&type=recovery&...
        const handleRecoveryToken = async () => {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const type = hashParams.get('type');

            console.log('Recovery URL params:', { accessToken: accessToken ? 'present' : 'missing', type });

            if (type === 'recovery' && accessToken) {
                // The Supabase client should automatically handle this, but let's verify
                const { data, error } = await supabase.auth.getSession();
                console.log('Session after recovery:', data.session ? 'Active' : 'Missing', error || '');

                if (!data.session) {
                    setError('Invalid or expired recovery link. Please request a new password reset.');
                }
            } else {
                // Check if we already have a session
                const { data, error } = await supabase.auth.getSession();
                if (!data.session) {
                    setError('Invalid or expired recovery link. Please request a new password reset.');
                }
            }
        };

        handleRecoveryToken();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) {
                setError(updateError.message);
            } else {
                setSuccess(true);
                // Log out the user as requested to force re-login
                await supabase.auth.signOut();

                // Automatically redirect after 3 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-violet/5 blur-[100px]" />
                </div>
                <div className="w-full max-w-md relative z-10">
                    <div className="bg-white border border-graphite/5 rounded-2xl p-8 shadow-lg text-center">
                        <div className="mb-6 flex justify-center">
                            <CheckCircle2 size={64} className="text-accent-violet" />
                        </div>
                        <h2 className="font-display text-3xl font-bold text-ink mb-4">Password Reset!</h2>
                        <p className="font-body text-graphite-light mb-8">
                            Your password has been updated successfully. You will be redirected to the login page in a few seconds.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-ink text-paper font-accent font-bold uppercase tracking-widest text-xs py-4 rounded hover:bg-accent-violet transition-all"
                        >
                            Back to Login Now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-violet/5 blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent-cyan/5 blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10 transition-all duration-500 ease-out">
                <div className="bg-white border border-graphite/5 rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="text-center mb-10">
                        <span className="font-display text-4xl font-bold text-gradient-violet mb-2 block">
                            T
                        </span>
                        <h2 className="font-display text-3xl font-bold text-ink mb-2">Reset Password</h2>
                        <p className="font-body text-graphite-light">Enter your new secure password below.</p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-6">
                        <div className="space-y-2 relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-graphite-light/40">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full bg-paper border border-graphite/10 rounded-lg pl-12 pr-12 py-3 text-ink font-body placeholder:text-graphite-light/50 focus:outline-none focus:border-accent-violet/50 focus:bg-white transition-all duration-300"
                                placeholder="New Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-graphite-light/40 hover:text-accent-violet transition-colors"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <div className="space-y-2 relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-graphite-light/40">
                                <Lock size={18} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full bg-paper border border-graphite/10 rounded-lg pl-12 pr-4 py-3 text-ink font-body placeholder:text-graphite-light/50 focus:outline-none focus:border-accent-violet/50 focus:bg-white transition-all duration-300"
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-500 text-xs text-center font-body">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-ink text-paper font-accent font-bold uppercase tracking-widest text-xs py-4 rounded hover:bg-accent-violet hover:text-white transition-all duration-300 transform hover:-translate-y-1 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
