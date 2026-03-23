import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar, ChevronRight, MoreHorizontal,
    CheckCircle2, AlertCircle, Timer, Plus, Star, X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../../../lib/supabaseClient';
import NotesTile from '../../shared/NotesTile';

import { useProject } from '../../employee/context/ProjectContext';
import AttendanceTracker from '../components/AttendanceTracker';


const DashboardHome = () => {
    const { addToast } = useToast();
    const { userName } = useUser();
    const { currentProject } = useProject();
    const navigate = useNavigate();

    // Helper to format date as YYYY-MM-DD for comparison (Local Time)
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // State
    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Active Employees Modal State
    const [showActiveListModal, setShowActiveListModal] = useState(false);
    const [activeEmployeesList, setActiveEmployeesList] = useState([]);

    // Update time every minute
    React.useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    // Mock Data
    const [employeeStats, setEmployeeStats] = useState({ active: 0, away: 0, offline: 0, total: 0 });
    const [teamAnalytics, setTeamAnalytics] = useState([]);
    const [taskStats, setTaskStats] = useState({ pending: 0, inProgress: 0, completed: 0 });

    const [timeline, setTimeline] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Data for Modal
    const [allEmployees, setAllEmployees] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [eventScope, setEventScope] = useState('team'); // 'team' or 'employee'
    const [selectedTeams, setSelectedTeams] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);

    // Fetch data from Supabase
    React.useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const todayStr = new Date().toISOString().split('T')[0];

                let employees = [];
                let tasks = [];
                let eventsData = [];

                // 1. Fetch Data Based on Context
                if (currentProject) {
                    // Fetch Project Members
                    const { data: members } = await supabase
                        .from('project_members')
                        .select('user_id')
                        .eq('project_id', currentProject.id);

                    const memberIds = members?.map(m => m.user_id) || [];

                    if (memberIds.length > 0) {
                        const { data: empData } = await supabase
                            .from('profiles')
                            .select('id, full_name, role, team_id')
                            .in('id', memberIds);
                        employees = empData || [];
                    }

                    // Fetch Project Tasks
                    const { data: taskData } = await supabase
                        .from('tasks')
                        .select('id, status, assigned_to, title, due_date, priority, project_id')
                        .eq('project_id', currentProject.id);
                    tasks = taskData || [];

                    // Fetch Announcements (Keeping global for now, filtering can be added if needed)
                    // Ideally check if announcement is for 'all' or specific team/project
                    const { data: annData } = await supabase
                        .from('announcements')
                        .select('*')
                        .order('event_time', { ascending: true });
                    eventsData = annData || [];

                } else {
                    // Global View assignment
                    const { data: empData } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, team_id');
                    employees = empData || [];

                    const { data: taskData } = await supabase
                        .from('tasks')
                        .select('id, status, assigned_to, title, due_date, priority, project_id');
                    tasks = taskData || [];

                    const { data: annData } = await supabase
                        .from('announcements')
                        .select('*')
                        .order('event_time', { ascending: true });
                    eventsData = annData || [];
                }

                // 2. Fetch Attendance & Leaves for Stats Calculation
                // Filter attendance/leaves by gathered employee IDs
                const employeeIds = employees.map(e => e.id);
                let activeCount = 0;
                let absentCount = 0;
                let activeList = [];

                if (employeeIds.length > 0) {
                    const { data: attendanceData } = await supabase
                        .from('attendance')
                        .select('employee_id, clock_in, clock_out')
                        .eq('date', todayStr)
                        .in('employee_id', employeeIds);

                    const { data: leavesData } = await supabase
                        .from('leaves')
                        .select('id')
                        .eq('status', 'approved')
                        .lte('from_date', todayStr)
                        .gte('to_date', todayStr)
                        .in('employee_id', employeeIds);

                    if (attendanceData) {
                        const activeRecords = attendanceData.filter(a => a.clock_in && !a.clock_out);
                        activeCount = activeRecords.length;

                        // Map active records to employee details
                        const activeIds = activeRecords.map(a => a.employee_id);
                        activeList = employees.filter(e => activeIds.includes(e.id));
                    }
                    absentCount = leavesData ? leavesData.length : 0;
                }

                setAllEmployees(employees); // For modal usage

                // --- GLOBAL STATS CALCULATION (Organization-wide data for Employees Card) ---

                // 1. Fetch Global Total Employees
                const { count: globalTotalCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true });

                // 2. Fetch Global Active (Clocked In)
                const { data: globalActiveAttendance } = await supabase
                    .from('attendance')
                    .select('employee_id')
                    .eq('date', todayStr)
                    .not('clock_in', 'is', null)
                    .is('clock_out', null);

                // 3. Fetch Global Absent (On Leave)
                const { count: globalAbsentCount } = await supabase
                    .from('leaves')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'approved')
                    .lte('from_date', todayStr)
                    .gte('to_date', todayStr);

                let globalActiveList = [];
                const globalActiveIds = globalActiveAttendance?.map(a => a.employee_id) || [];

                // Get Profiles for Active List
                if (globalActiveIds.length > 0) {
                    const { data: globalActiveProfiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, role, team_id')
                        .in('id', globalActiveIds);
                    globalActiveList = globalActiveProfiles || [];
                }

                setActiveEmployeesList(globalActiveList);

                // Calculate Global Stats
                const gTotal = globalTotalCount || 0;
                const gActive = globalActiveIds.length;
                const gAbsent = globalAbsentCount || 0;
                const gOffline = Math.max(0, gTotal - gActive - gAbsent);

                // Update Stats with GLOBAL values
                setEmployeeStats({
                    total: gTotal,
                    active: gActive,
                    absent: gAbsent,
                    away: 0,
                    offline: gOffline
                });

                if (tasks) {
                    setTaskStats({
                        pending: tasks.filter(t => ['pending', 'to_do', 'to do'].includes(t.status?.toLowerCase())).length,
                        inProgress: tasks.filter(t => ['in_progress', 'in progress'].includes(t.status?.toLowerCase())).length,
                        completed: tasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length
                    });
                }

                // Process Events
                let combinedEvents = [];
                if (eventsData) {
                    const formattedEvents = eventsData.map(event => ({
                        id: event.id,
                        date: event.event_date,
                        time: event.event_time ? event.event_time.slice(0, 5) : '', // HH:MM
                        title: event.title,
                        location: event.location,
                        color: '#e0f2fe', // Default color for announcements
                        scope: event.event_for,
                        participants: [],
                        status: event.status,
                        type: 'announcement'
                    }));
                    combinedEvents = [...combinedEvents, ...formattedEvents];
                }

                if (tasks) {
                    const taskEvents = tasks
                        .filter(t => t.due_date)
                        .map(t => ({
                            id: `task-${t.id}`,
                            date: t.due_date,
                            time: '09:00',
                            title: `Task: ${t.title}`,
                            location: `${t.priority} Priority`,
                            color: '#fef3c7', // Yellow for tasks
                            scope: 'task',
                            type: 'task',
                            participants: []
                        }));
                    combinedEvents = [...combinedEvents, ...taskEvents];
                }

                // Sort Events
                combinedEvents.sort((a, b) => {
                    const getStatusPriority = (event) => {
                        if (event.type !== 'announcement') return 0;
                        const status = event.status || ((event.date === formatDate(new Date())) ? 'active' : (new Date(event.date) < new Date().setHours(0, 0, 0, 0) ? 'completed' : 'future'));
                        if (status === 'active') return 1;
                        if (status === 'future') return 2;
                        return 3;
                    };
                    const priorityA = getStatusPriority(a);
                    const priorityB = getStatusPriority(b);
                    if (priorityA !== priorityB) return priorityA - priorityB;
                    return a.time.localeCompare(b.time);
                });

                setTimeline(combinedEvents);

                // Fetch Project List & Analytics
                // Fetch Project List & Analytics
                const { data: projectsData } = await supabase
                    .from('projects')
                    .select('id, name');

                let projects = projectsData ? projectsData.map(p => ({ id: p.id, name: p.name })) : [];

                // User Request: "I want to see all the statues of all projects"
                // REMOVED filtering by currentProject so all projects are listed in the status card.
                // if (currentProject) {
                //     projects = projects.filter(p => p.id === currentProject.id);
                // }

                if (projects.length > 0) setAllTeams(projects);

                // Fetch Global Tasks for Status Calculation (for ALL projects)
                const { data: globalTasks } = await supabase
                    .from('tasks')
                    .select('id, status, project_id');
                const allTasks = globalTasks || [];

                if (projects) {
                    const analytics = projects.map(project => {
                        // Calculate status based on Global Tasks
                        const projectTasks = allTasks.filter(t => t.project_id === project.id);

                        const completedT = projectTasks.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length;
                        const pendingT = projectTasks.filter(t => ['pending', 'to_do', 'to do'].includes(t.status?.toLowerCase())).length;
                        const inProgressT = projectTasks.filter(t => ['in_progress', 'in progress'].includes(t.status?.toLowerCase())).length;

                        const totalT = projectTasks.length;
                        const performance = totalT > 0 ? Math.round((completedT / totalT) * 100) : 0;

                        let status = 'Steady';
                        let color = '#3b82f6'; // blue
                        if (performance >= 80) { status = 'Excellent'; color = '#15803d'; }
                        else if (performance >= 50) { status = 'Good'; color = '#0ea5e9'; }
                        else if (performance > 0 && performance < 50) { status = 'Needs Improvement'; color = '#dc2626'; }
                        else { status = 'No Activity'; color = '#94a3b8'; }

                        return {
                            id: project.id,
                            name: project.name,
                            count: 0,
                            performance: performance,
                            projects: 0,
                            status: status,
                            color: color,
                            completedCount: completedT,
                            inProgressCount: inProgressT,
                            pendingCount: pendingT
                        };
                    });
                    setTeamAnalytics(analytics);
                }

            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchDashboardData();
    }, [refreshTrigger, currentProject]);

    // Real-time Subscription
    React.useEffect(() => {
        const sub = supabase
            .channel('dashboard_home_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, []);

    // Handlers
    const handleMonthChange = (direction) => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(currentMonth.getMonth() + direction);
        setCurrentMonth(newDate);
    };

    const handleDateClick = (day) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        setSelectedDate(newDate);
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const title = formData.get('title');
        const date = formData.get('date');
        const time = formData.get('time');
        const location = formData.get('location');

        try {
            const { error } = await supabase
                .from('announcements')
                .insert({
                    title: title,
                    event_date: date,
                    event_time: time,
                    location: location,
                    event_for: eventScope,
                    teams: selectedTeams,
                    employees: selectedEmployees,
                    // message: '' // Optional if you have a message field
                });

            if (error) throw error;

            addToast('Event added successfully', 'success');
            setShowAddEventModal(false);

            // Reset form state
            setEventScope('team');
            setSelectedTeams([]);
            setSelectedEmployees([]);

            // Trigger refresh to update timeline
            setRefreshTrigger(prev => prev + 1);

        } catch (error) {
            console.error('Error adding event:', error);
            addToast('Failed to add event: ' + error.message, 'error');
        }
    };

    const handleAddEmployee = (e) => {
        e.preventDefault();
        setShowAddEmployeeModal(false);
        addToast('Employee added successfully', 'success');
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const filteredTimeline = timeline.filter(event => event.date === formatDate(selectedDate));

    // Helper Component for Stat Cards
    const StatCard = ({ title, value, subtext, icon: Icon, color, trend, onClick }) => (
        <div
            onClick={onClick}
            style={{
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                border: '1px solid #f1f5f9',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = color;
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)';
                e.currentTarget.style.borderColor = '#f1f5f9';
            }}
        >
            <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '100px',
                height: '100px',
                background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
                borderRadius: '50%',
                pointerEvents: 'none'
            }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                    backgroundColor: `${color}10`,
                    padding: '12px',
                    borderRadius: '16px',
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease'
                }}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <div style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        backgroundColor: trend > 0 ? '#f0fdf4' : '#fef2f2',
                        color: trend > 0 ? '#166534' : '#991b1b',
                        fontSize: '0.75rem',
                        fontWeight: '800'
                    }}>
                        {trend > 0 ? `+${trend}%` : `${trend}%`}
                    </div>
                )}
            </div>

            <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{title}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>{value}</h3>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>{subtext}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            paddingBottom: '24px',
            position: 'relative',
            minHeight: '100vh',
            padding: '16px'
        }}>
            {/* Background Decorative Elements */}
            <div style={{ position: 'fixed', top: '15%', right: '-5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}></div>
            <div style={{ position: 'fixed', bottom: '15%', left: '-5%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }}></div>

            {/* Header / Hero Section */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '32px 40px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-mgr" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-mgr)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)' }}>Manager Overview</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: '700' }}>{currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                            Welcome back, <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{userName}!</span>
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                            {employeeStats.active} team members are currently online. You have {filteredTimeline.length} events on your schedule for today.
                        </p>
                    </div>

                    <div style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        padding: '16px 24px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        textAlign: 'right',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                    }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>LOCAL TIME</p>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '0.05em', lineHeight: 1 }}>
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </h2>

                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px', position: 'relative', zIndex: 1 }}>

                {/* Left Side: Stats & Tracker */}
                <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Attendance Tracker */}
                    <AttendanceTracker />

                    {/* Modern Stat Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <StatCard
                            title="Workforce Presence"
                            value={employeeStats.active}
                            subtext={`/ ${employeeStats.total} total`}
                            icon={Users}
                            color="#10b981"
                            onClick={() => navigate('/manager-dashboard/employee-status')}
                        />
                        <StatCard
                            title="Absence Management"
                            value={employeeStats.absent}
                            subtext="on leave today"
                            icon={AlertCircle}
                            color="#ef4444"
                        />
                        <StatCard
                            title="Pipeline Load"
                            value={taskStats.pending + taskStats.inProgress}
                            subtext="active work items"
                            icon={Timer}
                            color="#f59e0b"
                        />
                        <StatCard
                            title="Task Velocity"
                            value={taskStats.completed}
                            subtext="completed tasks"
                            icon={CheckCircle2}
                            color="#38bdf8"
                        />
                    </div>

                    {/* Detailed Project Analytics List */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '32px',
                        padding: '32px',
                        border: '1px solid #f1f5f9',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>Project Wise Status</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>Overview of productivity across all active projects</p>
                            </div>
                            <button
                                onClick={() => navigate('/manager-dashboard/analytics')}
                                style={{ color: '#0ea5e9', fontWeight: '800', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                View full analytics <ChevronRight size={18} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {teamAnalytics.map((team) => (
                                <div
                                    key={team.id}
                                    onClick={() => navigate('/manager-dashboard/analytics', { state: { teamId: team.id } })}
                                    style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '16px',
                                        padding: '24px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '24px',
                                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                        border: '1px solid transparent'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#ffffff';
                                        e.currentTarget.style.borderColor = '#eef2f6';
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.04)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                        e.currentTarget.style.borderColor = 'transparent';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: team.color, boxShadow: `0 0 12px ${team.color}40` }}></div>
                                            <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '1.1rem' }}>{team.name}</span>
                                        </div>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: '800',
                                            color: team.color,
                                            backgroundColor: '#ffffff',
                                            padding: '8px 16px',
                                            borderRadius: '16px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            {team.status}
                                        </span>
                                    </div>

                                    {/* Progress Metrics Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                                        <div style={{ padding: '12px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #f1f5f9' }}>
                                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>COMPLETED</p>
                                            <p style={{ fontSize: '1.25rem', fontWeight: '800', color: '#22c55e' }}>{team.completedCount || 0}</p>
                                        </div>
                                        <div style={{ padding: '12px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #f1f5f9' }}>
                                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>IN PROGRESS</p>
                                            <p style={{ fontSize: '1.25rem', fontWeight: '800', color: '#3b82f6' }}>{team.inProgressCount || 0}</p>
                                        </div>
                                        <div style={{ padding: '12px', borderRadius: '16px', backgroundColor: '#ffffff', border: '1px solid #f1f5f9' }}>
                                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>PENDING</p>
                                            <p style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f59e0b' }}>{team.pendingCount || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <NotesTile />
                </div>

                {/* Right Side: Calendar & Timeline */}
                <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Premium Calendar Widget */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '32px',
                        padding: '32px',
                        border: '1px solid #f1f5f9',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => handleMonthChange(-1)}
                                    style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s', color: '#64748b' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0f172a'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                                >
                                    &lt;
                                </button>
                                <button
                                    onClick={() => handleMonthChange(1)}
                                    style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s', color: '#64748b' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0f172a'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', marginBottom: '16px' }}>
                            <span>MO</span><span>TU</span><span>WE</span><span>TH</span><span>FR</span><span style={{ color: '#ef4444' }}>SA</span><span style={{ color: '#ef4444' }}>SU</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                            {Array.from({ length: startDayOffset }).map((_, i) => (
                                <div key={`empty-${i}`} style={{ height: '44px' }}></div>
                            ))}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === currentMonth.getMonth() && selectedDate.getFullYear() === currentMonth.getFullYear();
                                const isToday = today.getDate() === d && today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();

                                return (
                                    <div
                                        key={d}
                                        onClick={() => handleDateClick(d)}
                                        style={{
                                            height: '44px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '14px',
                                            backgroundColor: isSelected ? '#0f172a' : isToday ? '#e2e8f0' : 'transparent',
                                            color: isSelected ? '#fff' : isToday ? '#1e293b' : '#475569',
                                            cursor: 'pointer',
                                            fontWeight: isSelected || isToday ? '800' : '600',
                                            fontSize: '0.9rem',
                                            transition: 'all 0.2s',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                        onMouseLeave={(e) => { if (!isSelected && !isToday) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        {d}
                                        {timeline.some(e => e.date === formatDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d))) && (
                                            <div style={{ position: 'absolute', bottom: '8px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isSelected ? '#38bdf8' : '#0ea5e9' }}></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timeline Activity Feed */}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>Schedule</h3>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', background: '#f8fafc', padding: '6px 14px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '10px', width: '2px', background: 'linear-gradient(to bottom, #f1f5f9, #e2e8f0, #f1f5f9)' }}></div>

                            {filteredTimeline.length > 0 ? (
                                filteredTimeline.map((event) => (
                                    <div key={event.id} style={{ display: 'flex', gap: '20px', position: 'relative', zIndex: 1 }}>
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            backgroundColor: '#ffffff',
                                            border: '2px solid #0ea5e9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 0 0 5px #ffffff',
                                            flexShrink: 0
                                        }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ea5e9' }}></div>
                                        </div>

                                        <div
                                            onClick={() => {
                                                if (event.type === 'task') navigate('/manager-dashboard/tasks');
                                                else if (event.type === 'announcement') navigate('/manager-dashboard/announcements');
                                            }}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                padding: '20px',
                                                borderRadius: '24px',
                                                border: '1px solid #f1f5f9',
                                                cursor: 'pointer',
                                                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                                flex: 1,
                                                boxShadow: '0 2px 10px rgba(0,0,0,0.01)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-6px)';
                                                e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.05)';
                                                e.currentTarget.style.borderColor = '#e0f2fe';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.01)';
                                                e.currentTarget.style.borderColor = '#f1f5f9';
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <p style={{ fontSize: '1rem', fontWeight: '800', color: '#1e293b', lineHeight: 1.4 }}>{event.title}</p>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>{event.time}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>
                                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#0ea5e9' }}></span>
                                                {event.location}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ backgroundColor: '#f8fafc', width: '56px', height: '56px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                        <Calendar size={24} color="#cbd5e1" />
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: '700', fontStyle: 'italic' }}>Open availability today</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Styled Modals */}
            {showAddEventModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '48px',
                        borderRadius: '40px',
                        width: '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.4)',
                        animation: 'modalEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>Schedule Event</h3>
                                <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>Broadcast to your team or specific members</p>
                            </div>
                            <button
                                onClick={() => setShowAddEventModal(false)}
                                style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '12px', borderRadius: '16px', color: '#64748b', transition: 'all 0.2s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>EVENT TITLE</label>
                                <input name="title" type="text" placeholder="e.g., Progress Update" required style={{ padding: '16px 20px', borderRadius: '18px', border: '1px solid #eef2f6', backgroundColor: '#f8fafc', fontSize: '1rem', outline: 'none', fontWeight: '600', transition: 'all 0.3s' }} onFocus={(e) => { e.target.style.borderColor = '#0ea5e9'; e.target.style.backgroundColor = '#fff'; }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RECIPIENTS</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {['team', 'employee'].map(scope => (
                                        <label key={scope} style={{
                                            flex: 1,
                                            padding: '16px',
                                            borderRadius: '20px',
                                            border: `2px solid ${eventScope === scope ? '#0ea5e9' : '#eef2f6'}`,
                                            backgroundColor: eventScope === scope ? '#f0f9ff' : '#f8fafc',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            fontSize: '0.9rem',
                                            fontWeight: '800',
                                            color: eventScope === scope ? '#0ea5e9' : '#64748b',
                                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }}>
                                            <input type="radio" value={scope} checked={eventScope === scope} onChange={() => setEventScope(scope)} style={{ display: 'none' }} />
                                            {scope === 'team' ? 'Entire Project' : 'Specific Members'}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>DATE</label>
                                    <input name="date" type="date" required defaultValue={formatDate(selectedDate)} style={{ padding: '16px', borderRadius: '18px', border: '1px solid #eef2f6', backgroundColor: '#f8fafc', outline: 'none', fontWeight: '600' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TIME</label>
                                    <input name="time" type="time" required style={{ padding: '16px', borderRadius: '18px', border: '1px solid #eef2f6', backgroundColor: '#f8fafc', outline: 'none', fontWeight: '600' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>LOCATION</label>
                                <input name="location" type="text" placeholder="Digital HQ or Room Name" required style={{ padding: '16px 20px', borderRadius: '18px', border: '1px solid #eef2f6', backgroundColor: '#f8fafc', fontSize: '1rem', outline: 'none', fontWeight: '600' }} />
                            </div>

                            <button type="submit" style={{ backgroundColor: '#0f172a', color: '#fff', padding: '20px', borderRadius: '20px', fontWeight: '800', border: 'none', cursor: 'pointer', marginTop: '16px', fontSize: '1.1rem', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 15px 30px rgba(15, 23, 42, 0.2)' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(15, 23, 42, 0.3)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(15, 23, 42, 0.2)'; }}>Publish Event</button>
                        </form>
                    </div>
                </div>
            )}

            {showActiveListModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '40px',
                        borderRadius: '40px',
                        width: '500px',
                        maxHeight: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.4)',
                        animation: 'modalEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 15px #10b98180' }}></div>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>Workforce Online</h3>
                            </div>
                            <button
                                onClick={() => setShowActiveListModal(false)}
                                style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '12px', borderRadius: '16px', color: '#64748b' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '8px' }}>
                            {activeEmployeesList.length > 0 ? (
                                activeEmployeesList.map(emp => (
                                    <div key={emp.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '20px',
                                        padding: '20px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '24px',
                                        border: '1px solid #e2e8f0',
                                        transition: 'all 0.3s ease'
                                    }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'scale(1)'; }}
                                    >
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '16px',
                                            backgroundColor: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: '800',
                                            fontSize: '1.2rem',
                                            boxShadow: '0 10px 15px -3px rgba(14, 165, 233, 0.3)'
                                        }}>
                                            {emp.full_name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: '800', color: '#1e293b', margin: 0, fontSize: '1.1rem' }}>{emp.full_name}</p>
                                            <p style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', margin: 0 }}>{emp.role ? emp.role.replace('_', ' ') : 'Specialist'}</p>
                                        </div>
                                        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: '800', color: '#15803d', backgroundColor: '#dcfce7', padding: '6px 14px', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                                            Active Now
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                                    <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                    <p style={{ fontWeight: '700' }}>Quiet at the moment.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes modalEntrance {
                    from { opacity: 0; transform: scale(0.9) translateY(40px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #e2e8f0; borderRadius: 20px; border: 2px solid transparent; background-clip: content-box; }
                ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; background-clip: content-box; }
            `}</style>
        </div>
    );
};

export default DashboardHome;
