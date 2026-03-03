import React, { useState, useEffect } from 'react';
import { useProject } from '../employee/context/ProjectContext';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../employee/context/ToastContext';
import { TrendingUp, Award, Briefcase, Users, CheckCircle, Clock } from 'lucide-react';

const TeamPerformance = () => {
    const { currentProject } = useProject();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [teamStats, setTeamStats] = useState({
        completionRate: 0,
        totalTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        pendingValidation: 0,
        teamMembers: 0
    });
    const [lifecycleDistribution, setLifecycleDistribution] = useState([]);
    const [monthlyProgress, setMonthlyProgress] = useState([]);
    const [memberPerformance, setMemberPerformance] = useState([]);

    useEffect(() => {
        if (currentProject?.id) {
            fetchTeamPerformance();
        }
    }, [currentProject?.id]);

    const fetchTeamPerformance = async () => {
        setLoading(true);
        try {
            // Fetch all tasks for the current project
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', currentProject.id);

            if (tasksError) throw tasksError;

            // Fetch team members count
            const { data: members, error: membersError } = await supabase
                .from('project_members')
                .select('user_id')
                .eq('project_id', currentProject.id);

            if (membersError) throw membersError;

            // Calculate statistics
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'completed' || t.lifecycle_state === 'closed').length;
            const activeTasks = tasks.filter(t => t.sub_state === 'in_progress').length;
            const pendingValidation = tasks.filter(t => t.sub_state === 'pending_validation').length;
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            setTeamStats({
                completionRate,
                totalTasks,
                completedTasks,
                activeTasks,
                pendingValidation,
                teamMembers: members?.length || 0
            });

            // Calculate lifecycle distribution
            const lifecyclePhases = ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment', 'closed'];
            const distribution = lifecyclePhases.map(phase => {
                const count = tasks.filter(t => t.lifecycle_state === phase).length;
                return {
                    phase: phase.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    count,
                    percentage: totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
                };
            });
            setLifecycleDistribution(distribution);

            // Calculate monthly progress (last 6 months)
            const last6Months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const monthNum = d.getMonth();
                const year = d.getFullYear();

                const count = tasks.filter(t => {
                    if (!t.created_at) return false;
                    const tDate = new Date(t.created_at);
                    return (t.status === 'completed' || t.lifecycle_state === 'closed') &&
                        tDate.getMonth() === monthNum &&
                        tDate.getFullYear() === year;
                }).length;

                last6Months.push({ month: monthName, count });
            }
            setMonthlyProgress(last6Months);

            // Calculate individual member performance
            const { data: memberProfiles, error: profilesError } = await supabase
                .from('project_members')
                .select(`
                    user_id,
                    profiles:user_id (
                        full_name,
                        email
                    )
                `)
                .eq('project_id', currentProject.id);

            if (profilesError) throw profilesError;

            const memberStats = memberProfiles.map(member => {
                const memberTasks = tasks.filter(t => t.assigned_to === member.user_id);
                const memberCompleted = memberTasks.filter(t => t.status === 'completed' || t.lifecycle_state === 'closed').length;
                const memberActive = memberTasks.filter(t => t.sub_state === 'in_progress').length;
                const memberPending = memberTasks.filter(t => t.sub_state === 'pending_validation').length;
                const memberTotal = memberTasks.length;
                const completionRate = memberTotal > 0 ? Math.round((memberCompleted / memberTotal) * 100) : 0;

                return {
                    userId: member.user_id,
                    name: member.profiles?.full_name || member.profiles?.email || 'Unknown',
                    email: member.profiles?.email || '',
                    totalTasks: memberTotal,
                    completedTasks: memberCompleted,
                    activeTasks: memberActive,
                    pendingValidation: memberPending,
                    completionRate
                };
            });

            // Sort by completion rate descending
            memberStats.sort((a, b) => b.completionRate - a.completionRate);
            setMemberPerformance(memberStats);

        } catch (error) {
            console.error('Error fetching team performance:', error);
            addToast?.('Failed to load team performance data', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Loading team performance...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Premium Dark Header */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                {/* Subtle Grid Pattern */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '32px 32px',
                    pointerEvents: 'none'
                }} />

                {/* Badge and Subtitle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                    <span style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.4)'
                    }}>
                        ANALYTICS
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem' }}>●</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 500 }}>
                        Performance Insights
                    </span>
                </div>

                {/* Main Title with Gradient */}
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 50%, #10b981 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    marginBottom: '8px',
                    position: 'relative',
                    zIndex: 1,
                    letterSpacing: '-0.02em'
                }}>
                    Team <span style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>Performance</span>
                </h1>

                {/* Description */}
                <p style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.9rem',
                    maxWidth: '500px',
                    lineHeight: 1.5,
                    position: 'relative',
                    zIndex: 1
                }}>
                    {currentProject?.name} - Performance metrics and productivity insights
                </p>
            </div>

            {/* Top Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                {[
                    { label: 'Task Completion Rate', value: `${teamStats.completionRate}%`, icon: Award, color: '#f59e0b', bgColor: '#fef3c7' },
                    { label: 'Total Tasks', value: teamStats.totalTasks, icon: Briefcase, color: '#3b82f6', bgColor: '#dbeafe' },
                    { label: 'Active Tasks', value: teamStats.activeTasks, icon: Clock, color: '#8b5cf6', bgColor: '#ede9fe' },
                    { label: 'Completed Tasks', value: teamStats.completedTasks, icon: CheckCircle, color: '#10b981', bgColor: '#d1fae5' },
                    { label: 'Team Members', value: teamStats.teamMembers, icon: Users, color: '#06b6d4', bgColor: '#cffafe' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        backgroundColor: 'white',
                        padding: '16px',
                        borderRadius: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        border: '1px solid #e2e8f0',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                            <div style={{
                                padding: '12px',
                                borderRadius: '12px',
                                backgroundColor: stat.bgColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <stat.icon size={24} color={stat.color} />
                            </div>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 500, marginBottom: '4px' }}>{stat.label}</p>
                        <h3 style={{
                            fontSize: '1.75rem',
                            fontWeight: '700',
                            color: '#0f172a',
                            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            letterSpacing: '-0.02em'
                        }}>
                            {stat.value}
                        </h3>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                {/* Tasks Completed Chart */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    padding: '16px',
                    border: '1px solid #e2e8f0'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '24px', color: '#0f172a' }}>
                        Tasks Completed (Last 6 Months)
                    </h3>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        height: '200px',
                        paddingBottom: '20px',
                        borderBottom: '1px solid #e2e8f0'
                    }}>
                        {monthlyProgress.map((item, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                flex: 1
                            }}>
                                <div
                                    title={`${item.count} tasks`}
                                    style={{
                                        width: '40px',
                                        height: `${Math.max(item.count * 15, 4)}px`,
                                        maxHeight: '150px',
                                        backgroundColor: '#3b82f6',
                                        borderRadius: '8px 8px 0 0',
                                        opacity: 0.9,
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.opacity = '1';
                                        e.currentTarget.style.backgroundColor = '#2563eb';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.opacity = '0.9';
                                        e.currentTarget.style.backgroundColor = '#3b82f6';
                                    }}
                                ></div>
                                <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>{item.month}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lifecycle Distribution */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    padding: '16px',
                    border: '1px solid #e2e8f0'
                }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '24px', color: '#0f172a' }}>
                        Lifecycle Distribution
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {lifecycleDistribution.map((item, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#0f172a' }}>{item.phase}</span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
                                        {item.count} ({item.percentage}%)
                                    </span>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '8px',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${item.percentage}%`,
                                        height: '100%',
                                        backgroundColor: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : i === 2 ? '#3b82f6' : i === 3 ? '#8b5cf6' : i === 4 ? '#06b6d4' : '#10b981',
                                        borderRadius: '4px',
                                        transition: 'width 0.5s ease'
                                    }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Team Member Performance Table */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
                        Individual Member Performance
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Task completion metrics for each team member
                    </p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '16px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Member</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completion Rate</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Tasks</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberPerformance.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                                        No team members found
                                    </td>
                                </tr>
                            ) : (
                                memberPerformance.map((member, index) => (
                                    <tr key={member.userId} style={{
                                        borderBottom: index < memberPerformance.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        transition: 'background-color 0.15s'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>{member.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{member.email}</div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.875rem',
                                                fontWeight: 700,
                                                backgroundColor: member.completionRate >= 80 ? '#d1fae5' : member.completionRate >= 50 ? '#fef3c7' : '#fee2e2',
                                                color: member.completionRate >= 80 ? '#065f46' : member.completionRate >= 50 ? '#92400e' : '#991b1b'
                                            }}>
                                                {member.completionRate}%
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                                            {member.totalTasks}
                                        </td>
                                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                backgroundColor: '#d1fae5',
                                                color: '#065f46',
                                                fontSize: '0.875rem',
                                                fontWeight: 600
                                            }}>
                                                <CheckCircle size={14} />
                                                {member.completedTasks}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                backgroundColor: '#dbeafe',
                                                color: '#1e40af',
                                                fontSize: '0.875rem',
                                                fontWeight: 600
                                            }}>
                                                <Clock size={14} />
                                                {member.activeTasks}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeamPerformance;
