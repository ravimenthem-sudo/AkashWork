import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Trophy, Medal, TrendingUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const Leaderboard = () => {
    const [topEmployees, setTopEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRankings = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Simple fetch of top 5 based on total score
                // In a real app with RLS, we might need a specific RPC or View if employees can't see all scores
                // Assuming RLS allows reading 'manager_score_total' or we are an admin/manager.
                // For "visible to everyone", we might need a public view or public policy.
                // Here we fetch simply.

                // Get current user's org
                const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();

                if (!profile) return;

                const { data: reviews, error } = await supabase
                    .from('employee_rankings_view')
                    .select('*')
                    .order('manager_score_total', { ascending: false })
                    .limit(5);

                if (error) throw error;

                setTopEmployees(reviews || []);
            } catch (err) {
                console.error("Error fetching leaderboard:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRankings();
    }, []);

    if (loading) return null; // Or a skeleton
    if (topEmployees.length === 0) return null;

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-violet-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Trophy className="w-32 h-32" />
            </div>

            <div className="relative z-10">
                <h3 className="text-lg font-display font-medium mb-6 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    Top Performers
                </h3>

                <div className="space-y-4">
                    {topEmployees.map((entry, index) => (
                        <motion.div
                            key={entry.user_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-4 bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10"
                        >
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                ${index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                    index === 1 ? 'bg-gray-300 text-gray-900' :
                                        index === 2 ? 'bg-amber-600 text-amber-100' : 'bg-white/20 text-white'}
                            `}>
                                #{index + 1}
                            </div>

                            <img
                                src={entry.avatar_url || `https://ui-avatars.com/api/?name=${entry.full_name}&background=random`}
                                alt={entry.full_name}
                                className="w-10 h-10 rounded-full border-2 border-white/20"
                            />

                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">{entry.full_name}</h4>
                                <div className="text-xs opacity-70 truncate">{entry.job_title}</div>
                            </div>

                            <div className="text-right">
                                <div className="font-bold text-yellow-300">{entry.manager_score_total}</div>
                                <div className="text-xs opacity-60 text-white">Points</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
