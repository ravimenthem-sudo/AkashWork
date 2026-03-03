import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Trophy, Search, TrendingUp, Medal, Download, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

const FullRankingPage = () => {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('All');

    useEffect(() => {
        fetchRankings();
    }, []);

    const fetchRankings = async () => {
        try {
            setLoading(true);

            // 1. Fetch all reviews first
            const { data: reviews, error: reviewsError } = await supabase
                .from('employee_reviews')
                .select('*')
                .order('manager_score_total', { ascending: false });

            if (reviewsError) throw reviewsError;

            if (!reviews || reviews.length === 0) {
                setRankings([]);
                return;
            }

            // 2. Fetch profiles for these reviews
            const userIds = reviews.map(r => r.user_id);
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, job_title, department, avatar_url')
                .in('id', userIds);

            if (profilesError) throw profilesError;

            // 3. Fetch departments for mapping
            const { data: departmentsData, error: deptError } = await supabase
                .from('departments')
                .select('id, department_name');

            if (deptError) console.error('Error fetching departments:', deptError); // Log but continue

            const deptMap = {};
            if (departmentsData) {
                departmentsData.forEach(d => {
                    deptMap[d.id] = d.department_name;
                });
            }

            // 4. Merge data
            const formattedData = reviews.map(review => {
                const profile = profiles?.find(p => p.id === review.user_id);
                const deptId = profile?.department;
                const deptName = deptId ? (deptMap[deptId] || deptId) : '-'; // Fallback to ID if not found, or '-' if null

                return {
                    ...review,
                    full_name: profile?.full_name || 'Unknown',
                    job_title: profile?.job_title,
                    department: deptName,
                    avatar_url: profile?.avatar_url
                };
            });

            setRankings(formattedData);
        } catch (error) {
            console.error('Error fetching rankings:', error);
        } finally {
            setLoading(false);
        }
    };

    const getRankStyle = (index) => {
        if (index === 0) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        if (index === 1) return 'bg-gray-100 text-gray-700 border-gray-200';
        if (index === 2) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-paper text-graphite border-mist';
    };

    const filteredRankings = rankings.filter(emp => {
        const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.job_title?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDept = departmentFilter === 'All' || emp.department === departmentFilter;
        return matchesSearch && matchesDept;
    });

    const departments = ['All', ...new Set(rankings.map(r => r.department).filter(Boolean))];

    return (
        <div className="min-h-screen bg-paper font-body p-6 pb-20">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-accent-violet mb-2">
                            <Trophy className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Organization Leaderboard</span>
                        </div>
                        <h1 className="text-3xl font-display font-medium text-ink">Employee Rankings</h1>
                        <p className="text-graphite-light mt-1">
                            Comprehensive performance ranking based on manager evaluations.
                        </p>
                    </div>

                    {/* Stats Cards */}
                    <div className="flex gap-4">
                        <div className="bg-white p-4 rounded-xl border border-mist shadow-sm flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold font-display text-ink">
                                    {rankings.length > 0 ? (rankings.reduce((acc, curr) => acc + curr.manager_score_total, 0) / rankings.length).toFixed(1) : 0}
                                </div>
                                <div className="text-xs text-graphite-light">Avg Score</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-mist shadow-sm flex items-center gap-3">
                            <div className="p-2 bg-violet-50 text-accent-violet rounded-lg">
                                <Medal className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold font-display text-ink">{rankings.length}</div>
                                <div className="text-xs text-graphite-light">Ranked Employees</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl border border-mist shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-graphite-light" />
                        <input
                            type="text"
                            placeholder="Search by name or role..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-paper border border-mist rounded-lg text-sm focus:outline-none focus:border-accent-violet transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Filter className="w-4 h-4 text-graphite-light" />
                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className="bg-paper border border-mist rounded-lg text-sm px-3 py-2 outline-none focus:border-accent-violet"
                        >
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-mist text-graphite hover:bg-paper rounded-lg text-sm font-medium transition-colors ml-auto">
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Ranking List */}
                <div className="bg-white rounded-2xl border border-mist shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-paper-warm border-b border-mist text-xs uppercase tracking-wider text-graphite-light">
                                    <th className="p-4 font-semibold w-20 text-center">Rank</th>
                                    <th className="p-4 font-semibold">Employee</th>
                                    <th className="p-4 font-semibold hidden md:table-cell">Department</th>
                                    <th className="p-4 font-semibold text-right">Dev Score</th>
                                    <th className="p-4 font-semibold text-right">Soft Skill Score</th>
                                    <th className="p-4 font-semibold text-right">Total Score</th>
                                    <th className="p-4 font-semibold text-right">Percentage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-mist">
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-graphite-light">Loading rankings...</td>
                                    </tr>
                                ) : filteredRankings.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-graphite-light">No rankings found.</td>
                                    </tr>
                                ) : (
                                    filteredRankings.map((entry, index) => (
                                        <motion.tr
                                            key={entry.user_id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="hover:bg-paper transition-colors group"
                                        >
                                            <td className="p-4 text-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto border ${getRankStyle(index)}`}>
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={entry.avatar_url || `https://ui-avatars.com/api/?name=${entry.full_name}&background=random`}
                                                        alt={entry.full_name}
                                                        className="w-10 h-10 rounded-full object-cover border border-mist"
                                                    />
                                                    <div>
                                                        <div className="font-medium text-ink">{entry.full_name}</div>
                                                        <div className="text-xs text-graphite-light">{entry.job_title}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-graphite hidden md:table-cell">
                                                {entry.department || '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="font-bold text-ink">{entry.manager_score_dev || 0}</span>
                                                <span className="text-xs text-graphite-light ml-1">/ 90</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="font-bold text-ink">{entry.manager_score_soft || 0}</span>
                                                <span className="text-xs text-graphite-light ml-1">/ 100</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="font-bold text-ink">{entry.manager_score_total || 0}</span>
                                                <span className="text-xs text-graphite-light ml-1">/ 190</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-mist rounded-full overflow-hidden hidden sm:block">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full"
                                                            style={{ width: `${Math.min(100, entry.manager_score_percentage || 0)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium text-ink">{entry.manager_score_percentage}%</span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default FullRankingPage;
