import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart2, TrendingUp, Users, DollarSign, ChevronLeft, Award, Briefcase, Star, Clock, Calendar, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../../../lib/supabaseClient';

const AnalyticsDemo = () => {
    const { addToast } = useToast();
    const [selectedTeam, setSelectedTeam] = useState(null);
    const location = useLocation();

    const [teams, setTeams] = useState([]);
    const [employees, setEmployees] = useState({});
    const [totalHeadcount, setTotalHeadcount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalyticsData = async () => {
            try {
                setLoading(true);

                // Fetch Total Headcount (All Profiles)
                const { count, error: countError } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });

                if (!countError) {
                    setTotalHeadcount(count || 0);
                }

                // Fetch Projects (replacing teams)
                const { data: teamsData, error: teamsError } = await supabase
                    .from('projects')
                    .select('id, name');

                if (teamsError) throw teamsError;

                // Fetch Employees with Project assignments from project_members
                const { data: teamMembersData, error: teamMembersError } = await supabase
                    .from('project_members')
                    .select('user_id, project_id');

                if (teamMembersError) console.error('Error fetching project members:', teamMembersError);

                const { data: employeesData, error: employeesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, role');

                if (employeesError) throw employeesError;

                // Fetch Tasks for performance calculation
                const { data: tasksData, error: tasksError } = await supabase
                    .from('tasks')
                    .select('id, status, assigned_to');

                if (tasksError) throw tasksError;

                // Process Data
                const employeesByTeam = {};
                const teamStats = [];

                if (teamsData) {
                    teamsData.forEach(team => {
                        // Get employees for this project from project_members
                        const projectMemberIds = teamMembersData
                            ?.filter(tm => tm.project_id === team.id)
                            .map(tm => tm.user_id) || [];

                        const teamEmployees = employeesData.filter(e => projectMemberIds.includes(e.id));
                        let teamActiveTasks = 0;

                        const empList = teamEmployees.map(emp => {
                            const empTasks = tasksData.filter(t => t.assigned_to === emp.id);
                            const completedTasks = empTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
                            const activeEmpTasks = empTasks.filter(t => !['completed', 'done'].includes(t.status?.toLowerCase())).length;

                            teamActiveTasks += activeEmpTasks;

                            const totalTasks = empTasks.length;
                            const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                            return {
                                name: emp.full_name,
                                role: emp.role,
                                performance: performance,
                                tasks: completedTasks,
                                status: performance > 80 ? 'Top Performer' : performance < 50 ? 'Needs Improvement' : 'Steady'
                            };
                        });

                        employeesByTeam[team.id] = empList;

                        // Calculate Team Averages
                        const avgPerformance = empList.length > 0
                            ? Math.round(empList.reduce((acc, curr) => acc + curr.performance, 0) / empList.length)
                            : 0;

                        teamStats.push({
                            id: team.id,
                            name: team.name,
                            lead: 'N/A', // You might want to fetch team lead specifically if you have that data
                            count: teamEmployees.length,
                            activeTasks: teamActiveTasks,
                            performance: avgPerformance,
                            color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 4)] // Random color for UI
                        });
                    });
                }

                setTeams(teamStats);
                setEmployees(employeesByTeam);

            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyticsData();
    }, []);

    useEffect(() => {
        if (location.state?.teamId && teams.length > 0) {
            const team = teams.find(t => t.id === location.state.teamId);
            if (team) setSelectedTeam(team);
        }
    }, [location.state, teams]);

    const currentEmployees = selectedTeam ? (employees[selectedTeam.id] || []) : [];

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading analytics...</div>;

    // Calculate Global Stats
    const allEmployees = Object.values(employees).flat();
    const globalHeadcountVal = totalHeadcount; // Use fetched total count

    const globalPerformance = allEmployees.length > 0
        ? Math.round(allEmployees.reduce((acc, emp) => acc + emp.performance, 0) / allEmployees.length)
        : 0;

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>

            {/* Background Decorative Elements */}
            <div style={{ position: 'fixed', top: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: -1 }}></div>

            {/* Premium Header / Hero Section (THE BLACK BLUE BANNER) */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '24px',
                color: '#ffffff',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                {/* Defensive Mesh Grid */}
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-exec-analytics" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-exec-analytics)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        {selectedTeam && (
                            <button
                                onClick={() => setSelectedTeam(null)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    color: 'rgba(255,255,255,0.6)', fontWeight: '700',
                                    padding: '6px 12px', borderRadius: '12px',
                                    backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            >
                                <ChevronLeft size={16} /> Back to Overview
                            </button>
                        )}
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {selectedTeam ? 'Project Analytics' : 'Organization Overview'}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '700' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {selectedTeam ? selectedTeam.name : 'Organization'} <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Performance</span>
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                        {selectedTeam
                            ? `Detailed performance metrics for ${selectedTeam.name}. Currently tracking ${selectedTeam.count} employees.`
                            : `Executive overview of organizational productivity and project delivery milestones.`}
                    </p>
                </div>

                {/* Right side content removed for sleek design */}
            </div>

            {/* Main Content Grid - Bento Style */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>

                {/* Stats Row within Bento Grid */}
                <div style={{ gridColumn: 'span 3' }}>
                    <StatCard label="Avg Performance" value={selectedTeam ? `${selectedTeam.performance}%` : `${globalPerformance}%`} trend="+2.1%" icon={<Award size={24} />} color="#f59e0b" />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                    <StatCard label="Total Headcount" value={selectedTeam ? selectedTeam.count : globalHeadcountVal} trend={selectedTeam ? "Active" : "+12"} icon={<Users size={24} />} color="#3b82f6" />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                    <StatCard label={selectedTeam ? 'Active Tasks' : 'Active Projects'} value={selectedTeam ? selectedTeam.activeTasks : teams.length} trend={selectedTeam ? "-2" : "+1"} icon={<Briefcase size={24} />} color="#8b5cf6" />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                    <StatCard label="Retention Rate" value="98%" trend="Stable" icon={<TrendingUp size={24} />} color="#10b981" />
                </div>

                {/* Main Content Area */}
                <div style={{ gridColumn: 'span 12', marginTop: '8px' }}>
                    {!selectedTeam ? (
                        // Teams Grid View
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                            {teams.length > 0 ? teams.map((team) => (
                                <div
                                    key={team.id}
                                    onClick={() => setSelectedTeam(team)}
                                    style={{
                                        backgroundColor: '#ffffff', padding: '16px', borderRadius: '16px',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.01)', cursor: 'pointer', border: '1px solid #eef2f6',
                                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = team.color + '40'; e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.06)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#eef2f6'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.01)'; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', backgroundColor: team.color + '15', color: team.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Briefcase size={28} />
                                            </div>
                                            <div>
                                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{team.name}</h3>
                                                <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>Project Leads: {team.lead}</p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{team.performance}%</p>
                                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Avg Score</p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Personnel</p>
                                            <p style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{team.count}</p>
                                        </div>
                                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Open Tasks</p>
                                            <p style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{team.activeTasks}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', padding: '80px', background: '#f8fafc', borderRadius: '32px', color: '#94a3b8' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No active projects found.</h3>
                                    <p>Start a new initiative to begin tracking analytics.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Employee List View
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.02)', border: '1px solid #eef2f6', overflow: 'hidden' }}>
                            <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Project Personnel Overview</h3>
                                <span style={{ fontSize: '0.8rem', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '100px', fontWeight: 700, color: '#64748b' }}>{currentEmployees.length} Members</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '16px 32px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Member</th>
                                        <th style={{ padding: '16px 32px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Role</th>
                                        <th style={{ padding: '16px 32px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Performance Index</th>
                                        <th style={{ padding: '16px 32px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Output</th>
                                        <th style={{ padding: '16px 32px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Classification</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentEmployees.map((emp, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '20px 32px', fontWeight: 700, color: '#0f172a' }}>{emp.name}</td>
                                            <td style={{ padding: '20px 32px' }}><span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.9rem' }}>{emp.role}</span></td>
                                            <td style={{ padding: '20px 32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ flex: 1, height: '8px', width: '100px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${emp.performance}%`,
                                                            height: '100%',
                                                            backgroundColor: emp.performance > 90 ? '#10b981' : emp.performance > 70 ? '#3b82f6' : '#f59e0b',
                                                            borderRadius: '4px',
                                                            transition: 'width 1s ease-out'
                                                        }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>{emp.performance}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 32px', fontWeight: 700, color: '#64748b' }}>{emp.tasks} units</td>
                                            <td style={{ padding: '20px 32px' }}>
                                                <span style={{
                                                    padding: '6px 14px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 800,
                                                    backgroundColor: emp.status === 'Top Performer' ? '#f0fdf4' : emp.status === 'Needs Improvement' ? '#fef2f2' : '#f0f9ff',
                                                    color: emp.status === 'Top Performer' ? '#10b981' : emp.status === 'Needs Improvement' ? '#ef4444' : '#0ea5e9',
                                                    border: `1px solid ${emp.status === 'Top Performer' ? '#dcfce7' : emp.status === 'Needs Improvement' ? '#fee2e2' : '#e0f2fe'}`
                                                }}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

// Internal StatCard component to match the premium theme
const StatCard = ({ label, value, trend, icon, color, compact, subLabel }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                backgroundColor: '#ffffff',
                padding: compact ? '16px' : '16px',
                borderRadius: '16px',
                border: '1px solid #eef2f6',
                boxShadow: isHovered ? '0 20px 40px -10px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.01)',
                display: 'flex',
                flexDirection: 'column',
                gap: compact ? '8px' : '16px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isHovered ? 'translateY(-5px)' : 'translateY(0)',
                flex: 1,
                justifyContent: 'center'
            }}
        >
            <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '100px', height: '100px', background: color, opacity: isHovered ? 0.08 : 0, filter: 'blur(30px)', transition: 'opacity 0.4s ease', borderRadius: '50%' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                    padding: compact ? '10px' : '12px',
                    borderRadius: compact ? '14px' : '16px',
                    backgroundColor: `${color}15`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)'
                }}>
                    {React.cloneElement(icon, { size: compact ? 20 : 24 })}
                </div>
                {trend && (
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        color: trend.startsWith('+') ? '#10b981' : trend.startsWith('-') ? '#ef4444' : '#64748b',
                        backgroundColor: trend.startsWith('+') ? '#f0fdf4' : trend.startsWith('-') ? '#fef2f2' : '#f8fafc',
                        padding: '4px 10px',
                        borderRadius: '100px',
                        border: `1px solid ${trend.startsWith('+') ? '#dcfce7' : trend.startsWith('-') ? '#fee2e2' : '#f1f5f9'}`
                    }}>
                        {trend}
                    </div>
                )}
            </div>
            <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: compact ? '2px' : '4px' }}>{label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <h3 style={{ fontSize: compact ? '1.5rem' : '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em' }}>{value || 0}</h3>
                    {subLabel && <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>{subLabel}</span>}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDemo;
