import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { TrendingUp, Award, Briefcase, Star, Clock, Calendar, Download, AlertCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import EmployeeRecognitionBoard from '../../../shared/EmployeeRecognitionBoard';

const AnalyticsDemo = () => {
    const { userName } = useUser();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);

    const [myStats, setMyStats] = useState({
        performance: 0,
        tasksCompleted: 0,
        activeTasks: 0,
        attendance: '0%'
    });
    const [showInfo, setShowInfo] = useState(false);

    const [performanceHistory, setPerformanceHistory] = useState([]);

    const [projectStats, setProjectStats] = useState([]);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Fetch Tasks
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', user.id);

            if (tasksError) throw tasksError;

            // 2. Fetch Attendance
            const { data: attendance, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', user.id);

            if (attendanceError) throw attendanceError;

            // 3. Fetch Projects (for Work Distribution)
            const projectIds = [...new Set(tasks.map(t => t.project_id).filter(Boolean))];
            let projects = [];
            if (projectIds.length > 0) {
                const { data: projs } = await supabase
                    .from('projects')
                    .select('id, name')
                    .in('id', projectIds);
                projects = projs || [];
            }


            // --- Calculate Stats ---

            // Tasks Stats
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'completed').length;
            const activeTasks = tasks.filter(t => t.status === 'in progress' || t.status === 'pending').length;

            const performanceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Attendance Stats
            const totalAttendanceDays = attendance.length;
            const totalAttendanceHours = attendance.reduce((acc, curr) => acc + (parseFloat(curr.total_hours) || 0), 0);
            const presentDays = attendance.filter(a => a.status === 'Present').length;
            const attendanceRate = totalAttendanceDays > 0 ? Math.round((presentDays / totalAttendanceDays) * 100) : 0;

            setMyStats({
                performance: performanceRate,
                tasksCompleted: completedTasks,
                activeTasks: activeTasks,
                attendance: `${attendanceRate}%`,
                totalAttendanceHours: totalAttendanceHours
            });

            // --- Calculate Project Distribution (Weighted Hours) ---
            // Formula: Total Attendance Hours * (Project Tasks / Total Tasks)
            const calculatedProjectStats = projects.map(proj => {
                const projTasks = tasks.filter(t => t.project_id === proj.id).length;
                const weight = totalTasks > 0 ? (projTasks / totalTasks) : 0;
                const estimatedHours = totalAttendanceHours * weight;

                return {
                    id: proj.id,
                    name: proj.name,
                    taskCount: projTasks,
                    weight: Math.round(weight * 100),
                    hours: estimatedHours
                };
            }).sort((a, b) => b.hours - a.hours); // Sort by hours descending

            setProjectStats(calculatedProjectStats);


            // --- Calculate History (Last 6 Months) ---
            const last6Months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const monthNum = d.getMonth();
                const year = d.getFullYear();

                const count = tasks.filter(t => {
                    const tDate = new Date(t.created_at || t.due_date);
                    return t.status === 'completed' &&
                        tDate.getMonth() === monthNum &&
                        tDate.getFullYear() === year;
                }).length;

                last6Months.push({ month: monthName, score: count });
            }
            setPerformanceHistory(last6Months);

        } catch (error) {
            console.error('Error fetching analytics:', error);
            addToast('Failed to load analytics', 'error');
        } finally {
            setLoading(false);
        }
    };

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
                            <pattern id="mesh-analytics" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-analytics)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Performance Analytics</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: '700' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        Your <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Performance</span> Data
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                        Analyze your productivity trends and track your milestones. You've completed <span style={{ color: '#fff', fontWeight: '800' }}>{myStats.tasksCompleted} tasks</span> this month.
                    </p>
                </div>

                {/* Right side content removed for sleek design */}
            </div>

            {/* Main Content Grid - Bento Style */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>

                {/* Project Work Distribution (New Card) */}
                <div style={{
                    gridColumn: 'span 4',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
                    padding: '24px',
                    border: '1px solid #eef2f6',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '400px',
                    overflowY: 'auto'
                }}>
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '4px' }}>Work Distribution</h3>
                            <div
                                onClick={() => setShowInfo(!showInfo)}
                                style={{ cursor: 'pointer', color: showInfo ? '#3b82f6' : '#94a3b8' }}
                            >
                                <AlertCircle size={16} />
                            </div>
                        </div>
                        {showInfo && (
                            <div style={{
                                marginTop: '8px',
                                marginBottom: '12px',
                                padding: '12px 16px',
                                backgroundColor: '#f1f5f9',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                color: '#334155',
                                border: '1px solid #e2e8f0',
                                fontWeight: 500
                            }}>
                                <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#0f172a' }}>Calculation Formula:</p>
                                <p style={{ margin: 0, lineHeight: 1.5 }}>Estimated Hours = Total Attendance Hours × (Project Tasks / Total Assigned Tasks)</p>
                            </div>
                        )}
                        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Estimated hours per project</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {projectStats.length > 0 ? (
                            projectStats.map((proj) => (
                                <div key={proj.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{proj.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{proj.taskCount} Tasks ({proj.weight}%)</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#3b82f6' }}>{proj.hours.toFixed(1)}h</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '20px' }}>
                                No project data available
                            </div>
                        )}
                    </div>
                </div>


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
                            <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Overview of completed tasks per month</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Last 6 Months</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9', position: 'relative', zIndex: 1 }}>
                        {performanceHistory.map((item, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flex: 1 }}>
                                <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <div
                                        title={`${item.score} tasks`}
                                        style={{
                                            width: '40px',
                                            height: `${Math.max(item.score * 15, 6)}px`,
                                            maxHeight: '180px',
                                            background: 'linear-gradient(to top, #0ea5e9, #6366f1)',
                                            borderRadius: '20px 20px 8px 8px',
                                            opacity: 0.9,
                                            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.15)',
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                            e.currentTarget.style.transform = 'translateY(-6px) scaleX(1.1)';
                                            e.currentTarget.style.boxShadow = '0 12px 24px rgba(99, 102, 241, 0.25)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.opacity = '0.9';
                                            e.currentTarget.style.transform = 'translateY(0) scaleX(1)';
                                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(99, 102, 241, 0.15)';
                                        }}
                                    ></div>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.month}</span>
                            </div>
                        ))}
                    </div>

                    {/* Subtle Background Pattern for Chart */}
                    <div style={{ position: 'absolute', bottom: '60px', left: '32px', right: '32px', height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none', opacity: 0.4 }}>
                        {[1, 2, 3, 4].map(i => <div key={i} style={{ borderTop: '1px dashed #f1f5f9', width: '100%' }}></div>)}
                    </div>
                </div>

                {/* Right Column Metrics (2 Vertical Cards) */}
                <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <StatCard
                        label="Avg. Output"
                        value={`${myStats.performance}%`}
                        trend="+2.5%"
                        icon={<Award size={24} />}
                        color="#f59e0b"
                        compact
                    />
                    <StatCard
                        label="Attendance"
                        value={myStats.attendance}
                        trend="Stable"
                        icon={<TrendingUp size={24} />}
                        color="#10b981"
                        compact
                    />
                </div>

                {/* Bottom Stats Row (Remaining) */}
                <div style={{ gridColumn: 'span 4' }}>
                    <StatCard
                        label="Tasks Completed"
                        value={myStats.tasksCompleted}
                        trend="+5"
                        icon={<Briefcase size={24} />}
                        color="#3b82f6"
                    />
                </div>
                <div style={{ gridColumn: 'span 4' }}>
                    {/* Placeholder or another stat */}
                    <StatCard
                        label="Total Hours"
                        value={myStats.totalAttendanceHours ? myStats.totalAttendanceHours.toFixed(1) : '0'}

                        icon={<Clock size={24} />}
                        color="#6366f1"
                    />
                </div>
                <div style={{ gridColumn: 'span 4' }}>
                    <StatCard
                        label="Active Pipeline"
                        value={myStats.activeTasks}
                        trend="-1"
                        icon={<Star size={24} />}
                        color="#8b5cf6"
                    />
                </div>

                {/* Employee Recognition Board */}
                <div style={{ gridColumn: 'span 12' }}>
                    <EmployeeRecognitionBoard />
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
