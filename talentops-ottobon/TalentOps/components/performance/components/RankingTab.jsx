import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Trophy, Medal, AlertTriangle, TrendingUp, Sparkles, Target } from 'lucide-react';
import { motion } from 'framer-motion';
// @ts-ignore
import Leaderboard from './Leaderboard';

const RankingTab = ({ currentUserProfile }) => {
    const [rankings, setRankings] = useState([]);
    const [myRankData, setMyRankData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRankings = async () => {
            try {
                // Fetch all reviews with scores from the public view
                const { data: reviews, error } = await supabase
                    .from('employee_rankings_view')
                    .select('*')
                    .order('manager_score_total', { ascending: false });

                if (error) throw error;

                setRankings(reviews);

                // Find my rank
                const myIndex = reviews.findIndex(r => r.user_id === currentUserProfile?.id);
                if (myIndex !== -1) {
                    setMyRankData({
                        rank: myIndex + 1,
                        total: reviews.length,
                        data: reviews[myIndex]
                    });
                }

            } catch (err) {
                console.error("Error fetching ranking data:", err);
            } finally {
                setLoading(false);
            }
        };

        if (currentUserProfile) {
            fetchRankings();
        }
    }, [currentUserProfile]);

    if (loading) {
        return <div className="p-8 text-center text-graphite-light">Loading rankings...</div>;
    }

    const top5 = rankings.slice(0, 5);
    const isBottom5 = myRankData && (myRankData.total - myRankData.rank) < 5 && myRankData.total > 5;

    return (
        <div className="space-y-8">
            {/* My Ranking Card */}
            {myRankData ? (
                <div className={`
                    rounded-2xl p-6 border shadow-sm relative overflow-hidden
                    ${isBottom5 ? 'bg-amber-50 border-amber-200' : 'bg-white border-mist'}
                `}>
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-ink mb-1">Your Ranking</h3>
                            <div className="text-4xl font-bold font-display text-accent-violet">
                                #{myRankData.rank} <span className="text-lg text-graphite-light font-normal">/ {myRankData.total}</span>
                            </div>
                            <p className="text-sm text-graphite-light mt-2">
                                Based on your total performance score of {myRankData.data.manager_score_total}.
                            </p>
                        </div>

                        {/* Status Icon */}
                        {myRankData.rank <= 5 ? (
                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                                <Trophy className="w-8 h-8" />
                            </div>
                        ) : isBottom5 ? (
                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                        ) : (
                            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center text-accent-violet">
                                <TrendingUp className="w-8 h-8" />
                            </div>
                        )}
                    </div>

                    {/* Improvement Message for Bottom 5 */}
                    {isBottom5 && (
                        <div className="mt-6 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-amber-200 flex items-start gap-3">
                            <Target className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-sm font-semibold text-amber-800">Focus on Improvement</h4>
                                <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                                    Your ranking indicates there is significant room for growth. We recommend scheduling a 1:1 with your manager to discuss a personalized development plan to help you improve your skills and performance scores.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-6 rounded-2xl border border-mist shadow-sm text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <h3 className="text-ink font-medium">Rank not available</h3>
                    <p className="text-sm text-graphite-light">Your ranking will appear once your manager submits your review.</p>
                </div>
            )}

            {/* Top 5 Leaderboard */}
            <div className="bg-white rounded-2xl border border-mist shadow-sm overflow-hidden">
                <div className="p-6 border-b border-mist bg-paper-warm flex items-center gap-3">
                    <div className="p-2 bg-yellow-100/50 text-yellow-700 rounded-lg">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-ink">Organization Top 5</h3>
                        <p className="text-xs text-graphite-light">Leading performers across the company</p>
                    </div>
                </div>

                <div className="divide-y divide-mist">
                    {top5.map((entry, index) => (
                        <div key={entry.user_id} className="p-4 flex items-center gap-4 hover:bg-paper transition-colors group">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                                ${index === 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                    index === 1 ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                                        index === 2 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                            'bg-paper text-graphite border border-mist'}
                            `}>
                                #{index + 1}
                            </div>

                            <img
                                src={entry.avatar_url || `https://ui-avatars.com/api/?name=${entry.full_name}&background=random`}
                                alt={entry.full_name}
                                className="w-10 h-10 rounded-full object-cover border border-mist"
                            />

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-ink truncate">{entry.full_name}</h4>
                                    {entry.user_id === currentUserProfile?.id && (
                                        <span className="px-2 py-0.5 bg-violet-100 text-accent-violet text-[10px] uppercase font-bold tracking-wider rounded-full">
                                            You
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-graphite-light truncate">
                                    {entry.job_title} • {entry.department || 'General'}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="font-bold text-ink">{entry.manager_score_total}</div>
                                <div className="text-[10px] text-graphite-light">Points</div>
                            </div>
                        </div>
                    ))}

                    {top5.length === 0 && (
                        <div className="p-8 text-center text-sm text-graphite-light italic">
                            No rankings available yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RankingTab;
