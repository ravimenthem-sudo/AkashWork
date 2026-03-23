import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            // Use Magic Link OTP instead of password reset
            const { error: otpError } = await supabase.auth.signInWithOtp({
                email: email,
                options: {
                    emailRedirectTo: `${window.location.origin}/reset-password`,
                }
            });

            if (otpError) {
                setError(otpError.message);
            } else {
                setMessage('Check your email for the magic link to reset your password. The link will expire in 1 hour.');
            }
        } catch (err) {
            setError('An unexpected error occurred');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (message) {
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
                        <h2 className="font-display text-3xl font-bold text-ink mb-4">Email Sent</h2>
                        <p className="font-body text-graphite-light mb-8">{message}</p>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 font-accent text-xs font-bold uppercase tracking-widest text-accent-violet hover:text-ink transition-colors"
                        >
                            <ArrowLeft size={16} /> Back to Login
                        </Link>
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
                        <h2 className="font-display text-3xl font-bold text-ink mb-2">Forgot Password?</h2>
                        <p className="font-body text-graphite-light">Enter your email and we'll send you a magic link to reset your password.</p>
                    </div>

                    <form onSubmit={handleResetRequest} className="space-y-6">
                        <div className="space-y-2 relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-graphite-light/40">
                                <Mail size={18} />
                            </div>
                            <input
                                type="email"
                                required
                                className="w-full bg-paper border border-graphite/10 rounded-lg pl-12 pr-4 py-3 text-ink font-body placeholder:text-graphite-light/50 focus:outline-none focus:border-accent-violet/50 focus:bg-white transition-all duration-300"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                            {loading ? 'Sending...' : 'Send Magic Link'}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-graphite/5 pt-6">
                        <Link
                            to="/login"
                            className="font-accent text-xs font-medium text-graphite-light hover:text-accent-violet uppercase tracking-widest transition-colors duration-300 inline-flex items-center gap-2"
                        >
                            <ArrowLeft size={14} /> Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
