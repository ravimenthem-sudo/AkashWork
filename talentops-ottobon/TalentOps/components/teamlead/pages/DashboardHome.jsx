import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar, ChevronRight, MoreHorizontal,
    CheckCircle2, AlertCircle, Timer, Plus, Star, X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../../../lib/supabaseClient';
import NotesTile from '../../shared/NotesTile';

import AttendanceTracker from '../components/Dashboard/AttendanceTracker';


const DashboardHome = () => {
    const { addToast } = useToast();
    const { userName, currentTeam, teamId } = useUser();
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
    const [eventScope, setEventScope] = useState('team'); // 'team' or 'specific'
    const [selectedEventMembers, setSelectedEventMembers] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);

    // State for real data
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [teamLeadProfile, setTeamLeadProfile] = useState(null);

    const [employeeStats, setEmployeeStats] = useState({
        active: 0,
        away: 0,
        offline: 0,
        total: 0
    });

    const [attendanceStats, setAttendanceStats] = useState({
        present: 0,
        absent: 0,
        leaveBalance: 0
    });

    const [taskStats, setTaskStats] = useState({
        inProgress: 0,
        inReview: 0,
        completed: 0
    });

    const [timeline, setTimeline] = useState([]);
    const [error, setError] = useState(null);

    const [allOrgEmployees, setAllOrgEmployees] = useState([]);

    // Fetch team lead's profile and team members
    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                setLoading(true);
                console.log('=== Fetching Team Lead Data ===');

                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    console.error('No authenticated user');
                    return;
                }

                console.log('Current user ID:', user.id);

                // Get team lead's profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.error('Error fetching profile:', profileError);
                    return;
                }

                setTeamLeadProfile(profile);

                // Fetch All Employees for Event Selection
                const { data: allEmps } = await supabase
                    .from('profiles')
                    .select('id, full_name, team_id');

                if (allEmps) {
                    setAllOrgEmployees(allEmps);
                }

                // Get team members (employees with the same team_id)
                if (profile && teamId) profile.team_id = teamId; // Override with selected project

                if (profile?.team_id) {
                    console.log('Fetching team members for team_id:', profile.team_id);

                    const { data: members, error: membersError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('team_id', profile.team_id)
                        .neq('id', user.id); // Exclude the team lead themselves

                    if (membersError) {
                        console.error('Error fetching team members:', membersError);
                    } else {
                        console.log('Team Members:', members);

                        // Get today's date for attendance/leave checks
                        const today = new Date().toISOString().split('T')[0];

                        // Fetch attendance for today
                        const { data: attendance } = await supabase
                            .from('attendance')
                            .select('*')
                            .eq('date', today);

                        const attendanceMap = {};
                        if (attendance) {
                            attendance.forEach(a => {
                                attendanceMap[a.employee_id] = a;
                            });
                        }

                        // Fetch approved leaves for today
                        const { data: leaves } = await supabase
                            .from('leaves')
                            .select('employee_id')
                            .eq('status', 'approved')
                            .lte('from_date', today)
                            .gte('to_date', today);

                        const leaveSet = new Set(leaves?.map(l => l.employee_id));

                        // Fetch tasks and availability for each team member
                        const membersWithStatus = await Promise.all(
                            members.map(async (member) => {
                                const { data: tasks } = await supabase
                                    .from('tasks')
                                    .select('*')
                                    .eq('assigned_to', member.id)
                                    .eq('status', 'in_progress')
                                    .limit(1);

                                const latestTask = tasks && tasks.length > 0 ? tasks[0] : null;

                                // Determine availability
                                let availability = 'Offline';
                                const att = attendanceMap[member.id];

                                if (leaveSet.has(member.id)) {
                                    availability = 'On Leave';
                                } else if (att && att.clock_in && !att.clock_out) {
                                    availability = 'Online';
                                }

                                return {
                                    id: member.id,
                                    name: member.full_name || member.email,
                                    team: currentTeam,
                                    task: latestTask ? latestTask.title : 'No active task',
                                    status: availability
                                };
                            })
                        );

                        setTeamMembers(membersWithStatus);
                        setEmployeeStats({
                            total: membersWithStatus.length,
                            active: membersWithStatus.filter(m => m.status === 'Online').length,
                            away: membersWithStatus.filter(m => m.status === 'On Leave').length,
                            offline: membersWithStatus.filter(m => m.status === 'Offline').length
                        });

                        // Calculate task stats
                        const allTasks = await Promise.all(
                            members.map(async (member) => {
                                const { data: tasks } = await supabase
                                    .from('tasks')
                                    .select('*')
                                    .eq('assigned_to', member.id);
                                return tasks || [];
                            })
                        );

                        const flatTasks = allTasks.flat();
                        setTaskStats({
                            inProgress: flatTasks.filter(t => t.status === 'in_progress').length,
                            inReview: flatTasks.filter(t => t.status === 'pending').length,
                            completed: flatTasks.filter(t => t.status === 'done' || t.status === 'completed').length
                        });

                        // Fetch Announcements & Update Timeline
                        const { data: eventsData } = await supabase
                            .from('announcements')
                            .select('*')
                            .order('event_time', { ascending: true });

                        let combinedEvents = [];

                        if (flatTasks) {
                            const taskEvents = flatTasks
                                .filter(t => t.due_date)
                                .map(t => ({
                                    id: `task-${t.id}`,
                                    date: t.due_date,
                                    time: '09:00',
                                    title: `Task: ${t.title}`,
                                    location: `${t.priority} Priority`,
                                    color: '#fef3c7',
                                    scope: 'task',
                                    participants: []
                                }));
                            combinedEvents = [...combinedEvents, ...taskEvents];
                        }

                        if (eventsData) {
                            const filteredEvents = eventsData.filter(e => {
                                let targetTeams = [];
                                let targetEmployees = [];
                                try {
                                    targetTeams = typeof e.teams === 'string' ? JSON.parse(e.teams) : (e.teams || []);
                                    targetEmployees = typeof e.employees === 'string' ? JSON.parse(e.employees) : (e.employees || []);
                                } catch (err) {
                                    console.error("Error parsing event targets", err);
                                }

                                if (e.event_for === 'team') {
                                    // Team Lead sees events for their team
                                    return targetTeams.includes(profile.team_id);
                                } else if (e.event_for === 'specific' || e.event_for === 'employee') {
                                    // Team Lead sees events for themselves
                                    return targetEmployees.includes(user.id);
                                }
                                return false;
                            });

                            const formattedEvents = filteredEvents.map(event => ({
                                id: event.id,
                                date: event.event_date,
                                time: event.event_time ? event.event_time.slice(0, 5) : '',
                                title: event.title,
                                location: event.location,
                                color: '#e0f2fe',
                                scope: event.event_for,
                                participants: [],
                                status: event.status,
                                type: 'announcement'
                            }));
                            combinedEvents = [...combinedEvents, ...formattedEvents];
                        }

                        // Sort by priority: Active > Future > Completed, then by time within each group
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
                    }
                }

                // Fetch team lead's own attendance stats
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();

                // Get attendance records for current month
                const { data: attendanceData } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', user.id)
                    .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
                    .lte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-31`);

                const presentDays = attendanceData ? attendanceData.filter(a => a.clock_in).length : 0;

                // Calculate total working days in current month (excluding weekends)
                const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
                const today = new Date().getDate();
                let workingDays = 0;
                for (let day = 1; day <= Math.min(today, daysInMonth); day++) {
                    const date = new Date(currentYear, currentMonth - 1, day);
                    const dayOfWeek = date.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
                        workingDays++;
                    }
                }

                const absentDays = Math.max(0, workingDays - presentDays);

                // Get leave balance
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('total_leaves_balance')
                    .eq('id', user.id)
                    .single();

                setAttendanceStats({
                    present: presentDays,
                    absent: absentDays,
                    leaveBalance: profileData?.total_leaves_balance || 0
                });

            } catch (error) {
                console.error('Error fetching team data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeamData();
    }, [currentTeam, teamId]);

    const filteredTeamMembers = currentTeam === 'All'
        ? teamMembers
        : teamMembers.filter(m => m.team === currentTeam);

    const teamAnalytics = [];
    const filteredTeamAnalytics = currentTeam === 'All'
        ? teamAnalytics
        : teamAnalytics.filter(t => t.name === currentTeam);

    const activeTeamStats = filteredTeamAnalytics.length === 1 ? filteredTeamAnalytics[0] : null;

    const displayStats = activeTeamStats ? {
        total: activeTeamStats.count,
        active: Math.floor(activeTeamStats.count * 0.7),
        away: Math.floor(activeTeamStats.count * 0.2),
        offline: Math.ceil(activeTeamStats.count * 0.1)
    } : employeeStats;

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

    const handleAddEvent = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newEvent = {
            id: Date.now(),
            date: formatDate(selectedDate), // Add to currently selected date
            time: formData.get('time'),
            title: formData.get('title'),
            location: formData.get('location'),
            color: '#e0f2fe',
            scope: eventScope,
            members: eventScope === 'specific' ? selectedEventMembers : 'All'
        };
        setTimeline([...timeline, newEvent].sort((a, b) => a.time.localeCompare(b.time)));
        setShowAddEventModal(false);
        setEventScope('team');
        setSelectedEventMembers([]);
        addToast('Event added successfully', 'success');
    };

    const handleAddEmployee = (e) => {
        e.preventDefault();
        setShowAddEmployeeModal(false);
        addToast('Team Member added successfully', 'success');
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const startDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const filteredTimeline = timeline.filter(event => event.date === formatDate(selectedDate));

    // StatCard Helper Component
    const StatCard = ({ title, value, subtext, icon: Icon, color, onClick }) => (
        <div
            onClick={onClick}
            style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
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
                    e.currentTarget.style.borderColor = color + '40';
                }
            }}
            onMouseLeave={(e) => {
                if (onClick) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)';
                    e.currentTarget.style.borderColor = '#f1f5f9';
                }
            }}
        >
            <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '20px',
                backgroundColor: color + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: color,
                transition: 'all 0.3s ease'
            }}>
                <Icon size={28} />
            </div>
            <div>
                <p style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{title}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>{value}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8' }}>{subtext}</span>
                </div>
            </div>
            <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '100px',
                height: '100px',
                background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
                borderRadius: '50%'
            }}></div>
        </div>
    );

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            position: 'relative',
            padding: '24px',
            overflow: 'hidden'
        }}>
            {/* Fixed Background Blobs */}
            <div style={{ position: 'fixed', top: '-10%', right: '-5%', width: '40%', height: '40%', background: 'radial-gradient(circle, #e0f2fe 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }}></div>
            <div style={{ position: 'fixed', bottom: '-10%', left: '-5%', width: '40%', height: '40%', background: 'radial-gradient(circle, #f0f9ff 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }}></div>

            {/* Premium Multi-layered Header */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '24px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-tl" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-tl)" />
                    </svg>
                </div>
                <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)', filter: 'blur(40px)' }}></div>

                <div style={{ position: 'relative', zIndex: 2, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Team Lead Overview</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: '700' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.04em', lineHeight: 1 }}>
                        Welcome back, <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{userName}!</span>
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                        Building excellence with your team today. You have {employeeStats.active} members active and {filteredTimeline.length} events scheduled.
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
                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                    position: 'relative',
                    zIndex: 2
                }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>LOCAL TIME</p>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '0.05em', lineHeight: 1 }}>
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </h2>
                    <button
                        onClick={() => setShowAddEventModal(true)}
                        style={{
                            marginTop: '20px',
                            padding: '12px 24px',
                            borderRadius: '16px',
                            background: 'linear-gradient(to right, #0ea5e9, #6366f1)',
                            color: 'white',
                            border: 'none',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 25px rgba(99, 102, 241, 0.3)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(99, 102, 241, 0.2)'; }}
                    >
                        <Plus size={20} /> Plan New Event
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px', position: 'relative', zIndex: 1 }}>

                {/* Left Side: Stats & Tracker */}
                <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Modern Stat Cards Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        <StatCard
                            title="Team Availability"
                            value={employeeStats.active}
                            subtext={`/ ${employeeStats.total} members`}
                            icon={Users}
                            color="#10b981"
                            onClick={() => navigate('/teamlead-dashboard/employee-status')}
                        />
                        <StatCard
                            title="Active Operations"
                            value={taskStats.inProgress}
                            subtext="tasks in progress"
                            icon={Timer}
                            color="#f59e0b"
                            onClick={() => navigate('/teamlead-dashboard/tasks')}
                        />
                        <StatCard
                            title="Review Queue"
                            value={taskStats.inReview}
                            subtext="pending reviews"
                            icon={AlertCircle}
                            color="#ef4444"
                            onClick={() => navigate('/teamlead-dashboard/tasks')}
                        />
                        <StatCard
                            title="Milestones Reached"
                            value={taskStats.completed}
                            subtext="completed items"
                            icon={CheckCircle2}
                            color="#38bdf8"
                        />
                    </div>

                    <AttendanceTracker />

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
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>Daily Timeline</h3>
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
                                                if (event.scope === 'task') navigate('/teamlead-dashboard/team-tasks');
                                                else if (event.type === 'announcement') navigate('/teamlead-dashboard/announcements');
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

            {/* Premium Modals */}
            {showAddEmployeeModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '48px',
                        borderRadius: '40px',
                        width: '100%',
                        maxWidth: '500px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        position: 'relative',
                        animation: 'modalEntrance 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <button
                            onClick={() => setShowAddEmployeeModal(false)}
                            style={{ position: 'absolute', top: '24px', right: '24px', background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={20} />
                        </button>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Add Team Member</h3>
                        <p style={{ color: '#64748b', marginBottom: '32px', fontWeight: '500' }}>Expand your team with new talent.</p>

                        <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Full Name</label>
                                <input type="text" placeholder="e.g. John Doe" required style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#f8fafc', transition: 'all 0.2s' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Role</label>
                                <input type="text" placeholder="e.g. Senior Developer" required style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#f8fafc', transition: 'all 0.2s' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Department</label>
                                <select style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#f8fafc', appearance: 'none' }}>
                                    <option>Engineering</option>
                                    <option>Design</option>
                                    <option>Product</option>
                                </select>
                            </div>
                            <button type="submit" style={{ backgroundColor: '#0f172a', color: '#fff', padding: '18px', borderRadius: '100px', fontWeight: '800', border: 'none', cursor: 'pointer', marginTop: '12px', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.2)', transition: 'all 0.3s' }}>
                                Confirm Addition
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showAddEventModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '48px',
                        borderRadius: '40px',
                        width: '100%',
                        maxWidth: '500px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        position: 'relative',
                        animation: 'modalEntrance 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <button
                            onClick={() => setShowAddEventModal(false)}
                            style={{ position: 'absolute', top: '24px', right: '24px', background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={20} />
                        </button>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Create Event</h3>
                        <p style={{ color: '#64748b', marginBottom: '32px', fontWeight: '500' }}>Schedule a new activity for the team.</p>

                        <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Event Title</label>
                                <input name="title" type="text" placeholder="e.g. Design Sync" required style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#f8fafc' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Visibility Scope</label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {['team', 'specific'].map((scope) => (
                                        <label key={scope} style={{
                                            flex: 1,
                                            padding: '14px',
                                            borderRadius: '16px',
                                            border: `2px solid ${eventScope === scope ? '#0ea5e9' : '#f1f5f9'}`,
                                            backgroundColor: eventScope === scope ? '#f0f9ff' : '#ffffff',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: 'all 0.2s'
                                        }}>
                                            <input
                                                type="radio"
                                                name="scope"
                                                value={scope}
                                                checked={eventScope === scope}
                                                onChange={() => { setEventScope(scope); setSelectedEventMembers([]); }}
                                                style={{ accentColor: '#0ea5e9' }}
                                            />
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: eventScope === scope ? '#0369a1' : '#64748b', textTransform: 'capitalize' }}>
                                                {scope === 'team' ? 'My Team' : 'Organization'}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Member Selection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Recipients</label>
                                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '20px', padding: '12px', backgroundColor: '#f8fafc' }}>
                                    {(() => {
                                        const currentList = eventScope === 'team' ? teamMembers : allOrgEmployees;
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {eventScope === 'team' && (
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #f1f5f9', marginBottom: '8px' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEventMembers.length === currentList.length && currentList.length > 0}
                                                            onChange={(e) => setSelectedEventMembers(e.target.checked ? currentList.map(m => m.id) : [])}
                                                            style={{ width: '18px', height: '18px', accentColor: '#0ea5e9' }}
                                                        />
                                                        <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.9rem' }}>Select All Members</span>
                                                    </label>
                                                )}
                                                {currentList.map(member => (
                                                    <label key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEventMembers.includes(member.id)}
                                                            onChange={(e) => setSelectedEventMembers(prev => e.target.checked ? [...prev, member.id] : prev.filter(id => id !== member.id))}
                                                            style={{ width: '18px', height: '18px', accentColor: '#0ea5e9' }}
                                                        />
                                                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>{member.full_name || member.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Time</label>
                                    <input name="time" type="time" required style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#f8fafc' }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginLeft: '4px' }}>Location</label>
                                    <input name="location" type="text" placeholder="Room/Link" required style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', backgroundColor: '#f8fafc' }} />
                                </div>
                            </div>
                            <button type="submit" style={{ backgroundColor: '#0ea5e9', color: '#fff', padding: '18px', borderRadius: '100px', fontWeight: '800', border: 'none', cursor: 'pointer', marginTop: '12px', boxShadow: '0 10px 20px rgba(14, 165, 233, 0.2)', transition: 'all 0.3s' }}>
                                Publish Event
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>
                {`
                    @keyframes modalEntrance {
                        from { opacity: 0; transform: scale(0.95) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    ::-webkit-scrollbar { width: 8px; }
                    ::-webkit-scrollbar-track { background: #f1f5f9; }
                    ::-webkit-scrollbar-thumb { background: #cbd5e1; borderRadius: 10px; }
                    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                `}
            </style>
        </div>
    );
};

export default DashboardHome;
