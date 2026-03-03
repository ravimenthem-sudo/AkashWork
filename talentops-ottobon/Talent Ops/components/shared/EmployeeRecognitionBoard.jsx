import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Trophy, Medal, Award, Star, TrendingUp } from 'lucide-react';

const EmployeeRecognitionBoard = ({ compact = false }) => {
    const [topEmployees, setTopEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTopPerformers();
    }, []);

    const fetchTopPerformers = async () => {
        try {
            // 1. Get Current Month Range
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

            // 2. Fetch Tasks due in this month
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('id, assigned_to, status, due_date, updated_at, project_id')
                .gte('due_date', startOfMonth)
                .lte('due_date', endOfMonth);

            if (tasksError) throw tasksError;

            // 3. Fetch Profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, role');

            if (profilesError) throw profilesError;

            const profilesMap = {};
            profiles.forEach(p => profilesMap[p.id] = p);

            // 4. Calculate Scores
            const employeeStats = {};

            tasks.forEach(task => {
                const empId = task.assigned_to;
                if (!empId) return;

                // Check completion status
                const isCompleted = ['completed', 'done', 'approved'].includes(task.status?.toLowerCase());

                const dueDate = new Date(task.due_date);
                dueDate.setHours(23, 59, 59, 999);

                // Initialize stats if not exists
                if (!employeeStats[empId]) {
                    employeeStats[empId] = { total: 0, onTime: 0, projectIds: new Set() };
                }

                // Increment total tasks (Denominator) - Counts ALL tasks due this month
                employeeStats[empId].total += 1;

                if (task.project_id) {
                    employeeStats[empId].projectIds.add(task.project_id);
                }

                if (isCompleted) {
                    // Count as completed (ignoring strict timestamp due to updated_at drift)
                    employeeStats[empId].onTime += 1;
                }
            });

            // 5. Rank Employees
            const ranked = Object.keys(employeeStats).map(empId => {
                const stats = employeeStats[empId];
                // Rate = OnTime / Total
                const rate = stats.total > 0 ? (stats.onTime / stats.total) * 100 : 0;

                return {
                    id: empId,
                    name: profilesMap[empId]?.full_name || 'Unknown',
                    role: profilesMap[empId]?.role || 'Employee',
                    rate: rate,
                    totalTasks: stats.total,
                    onTimeTasks: stats.onTime,
                    projectCount: stats.projectIds.size
                };
            })
                .filter(e => e.totalTasks > 0) // Only those with tasks due this month
                .sort((a, b) => {
                    // Sort by Rate Descending, then by Total Completed Descending
                    if (b.rate !== a.rate) return b.rate - a.rate;
                    return b.onTimeTasks - a.onTimeTasks;
                })
                .slice(0, 5); // Top 5

            setTopEmployees(ranked);

        } catch (error) {
            console.error('Error calculating top performers:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading top performers...</div>
    );

    if (topEmployees.length === 0) return null;

    const getRankStyle = (index) => {
        switch (index) {
            case 0: return {
                bg: 'linear-gradient(135deg, #FFD700 0%, #FDB931 100%)', // Gold
                shadow: '0 10px 20px rgba(253, 185, 49, 0.3)',
                icon: <Trophy size={24} color="white" />,
                border: '2px solid #FFF3B0'
            };
            case 1: return {
                bg: 'linear-gradient(135deg, #E0E0E0 0%, #BDBDBD 100%)', // Silver
                shadow: '0 10px 20px rgba(189, 189, 189, 0.3)',
                icon: <Medal size={24} color="white" />,
                border: '2px solid #F5F5F5'
            };
            case 2: return {
                bg: 'linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)', // Bronze
                shadow: '0 10px 20px rgba(160, 82, 45, 0.3)',
                icon: <Award size={24} color="white" />,
                border: '2px solid #E6C2AA'
            };
            default: return {
                bg: '#f8fafc',
                shadow: '0 2px 4px rgba(0,0,0,0.05)',
                icon: <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#64748b' }}>#{index + 1}</span>,
                border: '1px solid #e2e8f0'
            };
        }
    };

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            border: '1px solid #f1f5f9',
            marginBottom: '24px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#fff7ed', borderRadius: '12px' }}>
                        <Star size={24} color="#ea580c" fill="#ea580c" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Top Performers</h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, fontWeight: 500 }}>Highest task completion rates across all projects</p>
                    </div>
                </div>
                <div style={{ padding: '6px 12px', borderRadius: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                    {new Date().toLocaleString('default', { month: 'long' })}
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px'
            }}>
                {topEmployees.map((emp, index) => {
                    const style = getRankStyle(index);
                    return (
                        <div key={emp.id} style={{
                            position: 'relative',
                            padding: '20px',
                            borderRadius: '20px',
                            background: index === 0 && !compact ? 'linear-gradient(to bottom right, #fff, #fffbeb)' : 'white',
                            border: index === 0 ? '2px solid #fcd34d' : '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            transition: 'transform 0.2s',
                            cursor: 'default',
                            overflow: 'hidden'
                        }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            {/* Rank Badge */}
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: style.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: style.shadow,
                                border: style.border,
                                flexShrink: 0
                            }}>
                                {style.icon}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    margin: '0 0 4px 0',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }} title={emp.name}>
                                    {emp.name}
                                </h4>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px' }}>
                                    {emp.role}
                                </div>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: '#f8fafc',
                                    padding: '4px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.75rem',
                                    color: '#475569',
                                    fontWeight: 600
                                }}>
                                    <span>{emp.projectCount} Proj</span>
                                    <span style={{ width: '1px', height: '10px', background: '#cbd5e1' }}></span>
                                    <span>{emp.onTimeTasks}/{emp.totalTasks} Tasks</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: index === 0 ? '#d97706' : '#334155' }}>
                                    {Math.round(emp.rate)}%
                                </span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: index === 0 ? '#d97706' : '#94a3b8', textTransform: 'uppercase' }}>
                                    Completion Rate
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default EmployeeRecognitionBoard;
