import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart2, TrendingUp, Users, DollarSign, ChevronLeft, Award, Briefcase, Star, Clock, Calendar, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../../../lib/supabaseClient';

const AnalyticsDemo = ({ currentProject, projectRole, userId }) => {
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

                if (currentProject?.id) {
                    // --- PROJECT MODE ---
                    console.log('Analytics: Fetching for Project', currentProject.name);

                    // 1. Fetch Project Members
                    let query = supabase
                        .from('project_members')
                        .select('user_id, role')
                        .eq('project_id', currentProject.id);

                    // If not manager/team_lead, show ONLY self
                    if (!['manager', 'team_lead'].includes(projectRole)) {
                        query = query.eq('user_id', userId);
                    }

                    const { data: members, error: membersError } = await query;

                    if (membersError) throw membersError;

                    if (!members || members.length === 0) {
                        setTeams([]);
                        setEmployees({});
                        setTotalHeadcount(0);
                        return;
                    }

                    const memberIds = members.map(m => m.user_id);
                    setTotalHeadcount(memberIds.length);

                    // 2. Fetch Profiles
                    const { data: profiles, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, team_id')
                        .in('id', memberIds);

                    if (profilesError) throw profilesError;

                    // 3. Fetch Tasks (Scoped to Project)
                    const { data: tasksData, error: tasksError } = await supabase
                        .from('tasks')
                        .select('id, status, assigned_to, updated_at')
                        .eq('project_id', currentProject.id);

                    if (tasksError) throw tasksError;

                    // 4. Process Data
                    let projectActiveTasks = 0;
                    let projectCompletedTasks = 0;

                    // Map profiles to analytics format
                    const empList = profiles.map(emp => {
                        // Find this user's project role if available, else profile role
                        const pMember = members.find(m => m.user_id === emp.id);
                        const displayRole = pMember?.role || emp.role;

                        const empTasks = tasksData.filter(t => t.assigned_to === emp.id);
                        const completedTasks = empTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
                        const activeEmpTasks = empTasks.filter(t => !['completed', 'done'].includes(t.status?.toLowerCase())).length;

                        projectActiveTasks += activeEmpTasks;
                        projectCompletedTasks += completedTasks;

                        const totalTasks = empTasks.length;
                        const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                        return {
                            id: emp.id,
                            name: emp.full_name,
                            role: displayRole, // Show their project role
                            performance: performance,
                            tasks: completedTasks,
                            status: performance > 80 ? 'Top Performer' : performance < 50 ? 'Needs Improvement' : 'Steady'
                        };
                    });

                    // Chart Data Calculation for Member View
                    let last6MonthsData = [];
                    if (!['manager', 'team_lead'].includes(projectRole) && empList.length > 0) {
                        const today = new Date();
                        const months = [];
                        for (let i = 5; i >= 0; i--) {
                            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                            months.push(d);
                        }

                        last6MonthsData = months.map(monthDate => {
                            const monthName = monthDate.toLocaleString('default', { month: 'short' });
                            const year = monthDate.getFullYear();
                            const monthIdx = monthDate.getMonth();

                            const count = tasksData.filter(t => {
                                if (t.assigned_to !== userId) return false;
                                if (!['completed', 'done'].includes(t.status?.toLowerCase())) return false;
                                if (!t.updated_at) return false;
                                const tDate = new Date(t.updated_at);
                                return tDate.getMonth() === monthIdx && tDate.getFullYear() === year;
                            }).length;

                            return { name: monthName, value: count };
                        });
                    }


                    const avgPerformance = empList.length > 0
                        ? Math.round(empList.reduce((acc, curr) => acc + curr.performance, 0) / empList.length)
                        : 0;

                    const projectStats = {
                        id: currentProject.id,
                        name: currentProject.name,
                        lead: 'N/A', // Could fetch project lead
                        count: empList.length,
                        activeTasks: projectActiveTasks,
                        completedTasks: projectCompletedTasks, // Store total completed too
                        performance: avgPerformance,
                        color: '#8b5cf6',
                        chartData: last6MonthsData // Attach chart data
                    };

                    setTeams([projectStats]);
                    setEmployees({ [currentProject.id]: empList });
                    setSelectedTeam(projectStats); // Auto-select the project

                } else {
                    // --- ORGANIZATION MODE (Legacy) ---
                    // Fetch Total Headcount
                    const { count, error: countError } = await supabase
                        .from('profiles')
                        .select('*', { count: 'exact', head: true });

                    if (!countError) setTotalHeadcount(count || 0);

                    // Fetch Teams
                    const { data: teamsData, error: teamsError } = await supabase
                        .from('teams')
                        .select('id, team_name');

                    if (teamsError) throw teamsError;

                    // Fetch Employees
                    const { data: employeesData, error: employeesError } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, team_id');

                    if (employeesError) throw employeesError;

                    // Fetch Tasks (Global)
                    const { data: tasksData, error: tasksError } = await supabase
                        .from('tasks')
                        .select('id, status, assigned_to');

                    if (tasksError) throw tasksError;

                    // Process Data
                    const employeesByTeam = {};
                    const teamStats = [];

                    if (teamsData) {
                        teamsData.forEach(team => {
                            const teamEmployees = employeesData.filter(e => e.team_id === team.id);
                            let teamActiveTasks = 0;

                            const empList = teamEmployees.map(emp => {
                                const empTasks = tasksData.filter(t => t.assigned_to === emp.id);
                                const completedTasks = empTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
                                const activeEmpTasks = empTasks.filter(t => !['completed', 'done'].includes(t.status?.toLowerCase())).length;

                                teamActiveTasks += activeEmpTasks;

                                const totalTasks = empTasks.length;
                                const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                                return {
                                    id: emp.id,
                                    name: emp.full_name,
                                    role: emp.role,
                                    performance: performance,
                                    tasks: completedTasks,
                                    status: performance > 80 ? 'Top Performer' : performance < 50 ? 'Needs Improvement' : 'Steady'
                                };
                            });

                            employeesByTeam[team.id] = empList;

                            const avgPerformance = empList.length > 0
                                ? Math.round(empList.reduce((acc, curr) => acc + curr.performance, 0) / empList.length)
                                : 0;

                            teamStats.push({
                                id: team.id,
                                name: team.team_name,
                                lead: 'N/A',
                                count: teamEmployees.length,
                                activeTasks: teamActiveTasks,
                                performance: avgPerformance,
                                color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][Math.floor(Math.random() * 4)]
                            });
                        });
                    }
                    setTeams(teamStats);
                    setEmployees(employeesByTeam);
                }

            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyticsData();
    }, [currentProject?.id]); // Re-run when project changes

    // Auto-select team from router state if not in project mode
    useEffect(() => {
        if (!currentProject && location.state?.teamId && teams.length > 0) {
            const team = teams.find(t => t.id === location.state.teamId);
            if (team) setSelectedTeam(team);
        }
    }, [location.state, teams, currentProject]);

    const currentEmployees = selectedTeam ? (employees[selectedTeam.id] || []) : [];

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading analytics...</div>;

    // Calculate Global Stats
    const allEmployees = Object.values(employees).flat();
    const globalHeadcountVal = totalHeadcount;

    const globalPerformance = allEmployees.length > 0
        ? Math.round(allEmployees.reduce((acc, emp) => acc + emp.performance, 0) / allEmployees.length)
        : 0;

    // --- RENDER LOGIC ---
    const isMemberView = selectedTeam && currentProject && !['manager', 'team_lead'].includes(projectRole);

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
                            <pattern id="mesh-manager-analytics" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-manager-analytics)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        {selectedTeam && !currentProject && (
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
                            {isMemberView ? 'Personal Analytics' : (selectedTeam ? 'Project Insights' : 'Organization Overview')}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '700' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {isMemberView ? 'Your' : (selectedTeam ? selectedTeam.name : 'Team')} <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Performance</span> Data
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                        {isMemberView
                            ? `Track your individual contribution and productivity trends within the current project.`
                            : (selectedTeam
                                ? `Analyzing performance for ${selectedTeam.name}. ${selectedTeam.count} members currently active.`
                                : `Comprehensive overview of all teams and projects under your management.`)}
                    </p>
                </div>

                {/* Right side content removed for sleek design */}
            </div>

            {/* Main Content Grid - Bento Style (Shared Pattern) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>

                {/* Condition: Member View vs Manager View */}
                {isMemberView ? (
                    <>
                        {/* Primary Chart Area (Large) */}
                        <div style={{
                            gridColumn: 'span 8',
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
                            padding: '24px',
                            border: '1px solid #eef2f6',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: '400px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '4px' }}>Performance History</h3>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Task completion trends for the current project</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Last 6 Months</span>
                                </div>
                            </div>

                            <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9', position: 'relative', zIndex: 1, gap: '12px' }}>
                                {selectedTeam.chartData && selectedTeam.chartData.map((data, index) => {
                                    const maxVal = Math.max(...selectedTeam.chartData.map(d => d.value), 5);
                                    const heightPercentage = (data.value / maxVal) * 100;

                                    return (
                                        <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: `${Math.max(heightPercentage * 1.8, 6)}px`,
                                                    maxHeight: '180px',
                                                    background: 'linear-gradient(to top, #0ea5e9, #6366f1)',
                                                    borderRadius: '16px 16px 4px 4px',
                                                    opacity: 0.9,
                                                    transition: 'all 0.3s ease',
                                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                                                    cursor: 'pointer'
                                                }} title={`${data.value} tasks`}>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800 }}>{data.name}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Subtle Background Lines */}
                            <div style={{ position: 'absolute', bottom: '60px', left: '32px', right: '32px', height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', opacity: 0.4 }}>
                                {[1, 2, 3].map(i => <div key={i} style={{ borderTop: '1px dashed #f1f5f9', width: '100%' }}></div>)}
                            </div>
                        </div>

                        {/* Right Column Stats */}
                        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <StatCard
                                label="Completion"
                                value={selectedTeam ? `${selectedTeam.performance}%` : `${globalPerformance}%`}
                                trend="+1.2%"
                                icon={<Award size={24} />}
                                color="#f59e0b"
                                compact
                            />
                            <StatCard
                                label="My Status"
                                value="Active"
                                trend="Online"
                                icon={<Users size={24} />}
                                color="#3b82f6"
                                compact
                            />
                            <StatCard
                                label="Tasks"
                                value={selectedTeam.completedTasks + selectedTeam.activeTasks}
                                trend={`+${selectedTeam.completedTasks}`}
                                icon={<Briefcase size={24} />}
                                color="#8b5cf6"
                                compact
                            />
                        </div>
                    </>
                ) : (
                    // MANAGER VIEW: Stats Row and Detailed List
                    <>
                        {/* Stats Row within Bento Grid */}
                        <div style={{ gridColumn: 'span 3' }}>
                            <StatCard label="Avg Performance" value={`${globalPerformance}%`} trend="+1.2%" icon={<Award size={24} />} color="#f59e0b" />
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                            <StatCard label="Headcount" value={globalHeadcountVal} trend="+4" icon={<Users size={24} />} color="#3b82f6" />
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                            <StatCard label="Active Projects" value={teams.length} trend="Stable" icon={<Briefcase size={24} />} color="#8b5cf6" />
                        </div>
                        <div style={{ gridColumn: 'span 3' }}>
                            <StatCard label="Attendance" value="96%" trend="Stable" icon={<TrendingUp size={24} />} color="#10b981" />
                        </div>

                        {/* Main Detail Area */}
                        <div style={{ gridColumn: 'span 12', marginTop: '8px' }}>
                            {!selectedTeam ? (
                                // Teams Grid
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                                    {teams.map((team) => (
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
                                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Performance</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Team Size</p>
                                                    <p style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{team.count}</p>
                                                </div>
                                                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>Open Tasks</p>
                                                    <p style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{team.activeTasks}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                // Members Table
                                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.02)', border: '1px solid #eef2f6', overflow: 'hidden' }}>
                                    <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Active Project Personnel</h3>
                                        <span style={{ fontSize: '0.8rem', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '100px', fontWeight: 700, color: '#64748b' }}>{currentEmployees.length} Members</span>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc' }}>
                                                <th style={{ padding: '16px 32px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Member</th>
                                                <th style={{ padding: '16px 32px', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', textAlign: 'left' }}>Project Role</th>
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
                    </>
                )}
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
                justifyContent: 'center',
                minWidth: compact ? '0' : '240px'
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
