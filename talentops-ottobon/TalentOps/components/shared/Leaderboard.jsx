import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

const Leaderboard = ({ orgId }) => {
    const [period, setPeriod] = useState('week'); // 'week' | 'month'
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (orgId) {
            fetchRankings();
        }
    }, [orgId, period]);

    const fetchRankings = async () => {
        setLoading(true);
        try {
            // 1. Get the latest snapshot for this period
            const { data: snapshots, error } = await supabase
                .from('employee_performance_snapshots')
                .select(`
                    rank,
                    total_points,
                    percentile,
                    employee_id,
                    period_end
                `)
                .eq('org_id', orgId)
                .eq('period_type', period)
                .order('period_end', { ascending: false }) // Get latest date
                .limit(50); // Just fetch somewhat recent distinct set if needed

            if (error) throw error;

            if (!snapshots || snapshots.length === 0) {
                setRankings([]);
                return;
            }

            // Filter to only the most recent calculated date
            const latestDate = snapshots[0].period_end;
            const currentSnapshots = snapshots.filter(s => s.period_end === latestDate);

            // 2. Fetch User Profiles for names
            const userIds = currentSnapshots.map(s => s.employee_id);
            const { data: users, error: userError } = await supabase
                .from('profiles') // Assuming 'profiles' table has names
                .select('id, full_name, avatar_url')
                .in('id', userIds);

            if (userError) throw userError;

            // Merge Data
            const merged = currentSnapshots.map(snap => {
                const user = users?.find(u => u.id === snap.employee_id);
                return {
                    ...snap,
                    name: user?.full_name || 'Unknown User',
                    avatar: user?.avatar_url
                };
            }).sort((a, b) => a.rank - b.rank);

            setRankings(merged);

        } catch (err) {
            console.error("Error fetching leaderboard:", err);
        } finally {
            setLoading(false);
        }
    };

    const periodLabel = period === 'week' ? 'This Week' : 'This Month';

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Trophy size={20} color="#f59e0b" fill="#fef3c7" />
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Leaderboard</h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>Based on calculated points</p>
                    </div>
                </div>

                {/* Period Selector */}
                <div style={{ display: 'flex', backgroundColor: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <button
                        onClick={() => setPeriod('week')}
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: period === 'week' ? 'white' : 'transparent',
                            color: period === 'week' ? '#0f172a' : '#64748b',
                            boxShadow: period === 'week' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Weekly
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: period === 'month' ? 'white' : 'transparent',
                            color: period === 'month' ? '#0f172a' : '#64748b',
                            boxShadow: period === 'month' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        Monthly
                    </button>
                </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading rankings...</div>
                ) : rankings.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <Users size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                        <p>No rankings available for {periodLabel}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {rankings.map((user) => (
                            <div key={user.employee_id} style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 1fr auto auto',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '16px 20px',
                                borderBottom: '1px solid #f8fafc',
                                transition: 'background-color 0.2s'
                            }}>
                                {/* Rank */}
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: user.rank === 1 ? '#fef3c7' : user.rank === 2 ? '#f1f5f9' : user.rank === 3 ? '#ffedd5' : 'transparent',
                                    color: user.rank === 1 ? '#d97706' : user.rank === 2 ? '#64748b' : user.rank === 3 ? '#c2410c' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.9rem'
                                }}>
                                    {user.rank}
                                </div>

                                {/* User Info */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {user.avatar ?
                                        <img src={user.avatar} style={{ width: '32px', height: '32px', borderRadius: '50%' }} /> :
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{user.name.charAt(0)}</span>
                                        </div>
                                    }
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{user.name}</span>
                                </div>

                                {/* Points */}
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{user.total_points}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>pts</span>
                                </div>

                                {/* Percentile */}
                                <div style={{ textAlign: 'right', minWidth: '60px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        <TrendingUp size={14} color="#10b981" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981' }}>{user.percentile}%</span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Top {100 - user.percentile}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
