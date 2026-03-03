import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Clock, Calendar, ChevronRight, MoreHorizontal,
    CheckCircle2, AlertCircle, Timer, Plus, Star, X, TrendingUp
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import AttendanceTracker from '../components/Dashboard/AttendanceTracker';
import NotesTile from '../../shared/NotesTile';
import { supabase } from '../../../lib/supabaseClient';

const DashboardHome = () => {
    const { addToast } = useToast();
    const { userName, currentTeam } = useUser();
    const navigate = useNavigate();

    // Helper to format date as YYYY-MM-DD for comparison (Local Time)
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Live Clock State
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // State
    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);

    const [timeline, setTimeline] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(true);

    // State for leave balance from profile
    const [leaveBalance, setLeaveBalance] = useState(0);


    // Add Event State
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [eventScope, setEventScope] = useState('team');
    const [selectedEventMembers, setSelectedEventMembers] = useState([]);
    const [allOrgEmployees, setAllOrgEmployees] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch Data from Supabase
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // 1. Fetch Attendance (count present/absent days)
                    const { data: attendance } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('employee_id', user.id);

                    if (attendance) setAttendanceData(attendance);

                    // 3. Fetch Leave Balance from profiles table
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('total_leaves_balance, monthly_leave_quota, team_id')
                        .eq('id', user.id)
                        .single();

                    if (profileData) {
                        // Use total_leaves_balance
                        setLeaveBalance(profileData.total_leaves_balance ?? (profileData.monthly_leave_quota || 0));
                    }

                    // 4. Fetch All Employees & Team Members
                    const { data: allEmps, error: empError } = await supabase.from('profiles').select('id, full_name, team_id');

                    if (empError) console.error("Error fetching employees:", empError);

                    if (allEmps) {
                        setAllOrgEmployees(allEmps);
                        if (profileData && profileData.team_id) {
                            setTeamMembers(allEmps.filter(e => e.team_id === profileData.team_id));
                        }
                    }


                    // 5. Fetch Timeline/Events via RPC
                    let combinedEvents = [];

                    const { data: userAnnouncements, error: rpcError } = await supabase.rpc('get_my_announcements');

                    if (userAnnouncements) {
                        const announcementEvents = userAnnouncements.map(a => ({
                            id: a.id,
                            time: a.event_time ? a.event_time.slice(0, 5) : '',
                            title: a.title,
                            location: a.location,
                            color: '#e0f2fe',
                            date: a.event_date,
                            status: a.status,
                            type: 'announcement'
                        }));
                        combinedEvents = [...combinedEvents, ...announcementEvents];
                    }

                    // Sort by priority: Active > Future > Completed, then by time within each group
                    combinedEvents.sort((a, b) => {
                        // Determine status priority (Active=1, Future=2, Completed=3)
                        const getStatusPriority = (event) => {
                            if (event.type !== 'announcement') return 0; // Non-announcements first
                            const status = event.status || ((event.date === formatDate(new Date())) ? 'active' : (new Date(event.date) < new Date().setHours(0, 0, 0, 0) ? 'completed' : 'future'));
                            if (status === 'active') return 1;
                            if (status === 'future') return 2;
                            return 3; // completed
                        };

                        const priorityA = getStatusPriority(a);
                        const priorityB = getStatusPriority(b);

                        if (priorityA !== priorityB) return priorityA - priorityB;
                        return (a.time || '').localeCompare(b.time || '');
                    });
                    setTimeline(combinedEvents);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshTrigger]);

    // REAL-TIME SUBSCRIPTION
    useEffect(() => {
        const channel = supabase
            .channel('employee-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
                console.log('Realtime Attendance Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
                console.log('Realtime Announcement:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, (payload) => {
                console.log('Realtime Leave Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, (payload) => {
                console.log('Realtime Timesheet Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, (payload) => {
                console.log('Realtime Payroll Update:', payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Calculate attendance stats from actual data
    const attendanceStats = {
        present: attendanceData.filter(a => {
            // Count records where clock_in exists (employee came to work)
            return a.clock_in !== null;
        }).length,
        absent: attendanceData.filter(a => {
            // You might want to calculate absent days differently
            // For now, counting records explicitly marked as absent
            return a.clock_in === null && a.date;
        }).length,
        leaveBalance: leaveBalance // From profiles table
    };

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
        const time = formData.get('time');
        const location = formData.get('location');
        const dateStr = formatDate(selectedDate);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Use RPC to create event
            // Defaulting to "Personal Event" (employee scope, target = self) since this modal doesn't have audience selection
            const payload = {
                p_title: title,
                p_date: dateStr,
                p_time: time,
                p_location: location,
                p_message: '',
                p_event_for: 'employee',
                p_target_teams: [],
                p_target_employees: [user.id] // Target self so it appears on my calendar
            };

            const { error } = await supabase.rpc('create_announcement_event', payload);

            if (error) throw error;

            // Optimistic Update
            const newEvent = {
                id: `temp-${Date.now()}`,
                time: time,
                title: title,
                location: location,
                color: '#e0f2fe',
                date: dateStr
            };

            setTimeline([...timeline, newEvent].sort((a, b) => (a.time || '').localeCompare(b.time || '')));
            setShowAddEventModal(false);
            addToast('Event added successfully', 'success');
            setEventScope('team');
            setSelectedEventMembers([]);

        } catch (err) {
            console.error("Error adding event:", err);
            addToast('Failed to add event', 'error');
        }
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

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>

            {/* Background Decorative Elements */}
            <div style={{ position: 'fixed', top: '-100px', right: '-100px', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)', filter: 'blur(60px)', zIndex: -1 }}></div>
            <div style={{ position: 'fixed', bottom: '100px', left: '-50px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)', filter: 'blur(40px)', zIndex: -1 }}></div>

            {/* Premium Header / Hero Section */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '32px 40px',
                color: '#ffffff',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                {/* Defensive Mesh Grid */}
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-emp" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-emp)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)' }}>Employee Overview</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: '700' }}>{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                        Welcome back, <span style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{userName}!</span>
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                        You're having a productive month! You've clocked in <span style={{ color: '#fff', fontWeight: '800' }}>{attendanceStats.present || 0} days</span> so far.
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
                    zIndex: 1
                }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>LOCAL TIME</p>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', letterSpacing: '0.05em', lineHeight: 1 }}>
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </h2>
                </div>
            </div>

            {/* Stats Grid with dynamic accents */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px'
            }}>

                <StatCard
                    label="Days Present"
                    value={attendanceStats.present}
                    trend="+2.4%"
                    icon={<CheckCircle2 size={24} />}
                    color="#10b981"
                    bg="rgba(16, 185, 129, 0.03)"
                />
                <StatCard
                    label="Active Absences"
                    value={attendanceStats.absent}
                    trend="-12%"
                    icon={<AlertCircle size={24} />}
                    color="#ef4444"
                    bg="rgba(239, 68, 68, 0.03)"
                />
                <StatCard
                    label="Leave Balance"
                    value={attendanceStats.leaveBalance}
                    subLabel="days"
                    icon={<Calendar size={24} />}
                    color="#f59e0b"
                    bg="rgba(245, 158, 11, 0.03)"
                />
                <StatCard
                    label="Today's Load"
                    value={filteredTimeline.length}
                    subLabel="Tasks"
                    icon={<Timer size={24} />}
                    color="#6366f1"
                    bg="rgba(99, 102, 241, 0.03)"
                />
            </div>

            {/* Main Content Sections */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: '16px' }}>

                {/* Left Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Integrated Attendance Tracker */}
                    <AttendanceTracker />

                    {/* Secondary Workspace Area */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '32px',
                        border: '1px solid #eef2f6',
                        padding: '32px',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Quick Workspace</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>Notes & immediate tasks for today</p>
                            </div>
                            <div style={{ padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '14px', color: '#0ea5e9' }}>
                                <Star size={20} fill="currentColor" />
                            </div>
                        </div>
                        <NotesTile />
                    </div>
                </div>

                {/* Right Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Modern Calendar */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '32px',
                        padding: '32px',
                        border: '1px solid #eef2f6',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => handleMonthChange(-1)} style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '12px', color: '#64748b', border: '1px solid #f1f5f9' }}>
                                    <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                                </button>
                                <button onClick={() => handleMonthChange(1)} style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '12px', color: '#64748b', border: '1px solid #f1f5f9' }}>
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
                            {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(day => (
                                <span key={day} style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', padding: '10px 0', letterSpacing: '0.1em' }}>{day}</span>
                            ))}

                            {Array.from({ length: startDayOffset }).map((_, i) => (
                                <span key={`empty-${i}`} style={{ padding: '12px' }}></span>
                            ))}

                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === currentMonth.getMonth() && selectedDate.getFullYear() === currentMonth.getFullYear();
                                const isToday = today.getDate() === d && today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear();

                                return (
                                    <div
                                        key={d}
                                        onClick={() => handleDateClick(d)}
                                        style={{
                                            aspectRatio: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '14px',
                                            backgroundColor: isSelected ? '#38bdf8' : isToday ? '#f0f9ff' : 'transparent',
                                            color: isSelected ? '#fff' : isToday ? '#38bdf8' : '#334155',
                                            cursor: 'pointer',
                                            fontWeight: isSelected || isToday ? 800 : 600,
                                            fontSize: '0.95rem',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            border: isToday && !isSelected ? '1px solid #bae6fd' : '1px solid transparent'
                                        }}
                                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                        onMouseLeave={(e) => { if (!isSelected && !isToday) e.currentTarget.style.backgroundColor = 'transparent'; else if (isToday && !isSelected) e.currentTarget.style.backgroundColor = '#f0f9ff'; }}
                                    >
                                        {d}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Rich Timeline Section */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '32px',
                        padding: '32px',
                        border: '1px solid #eef2f6',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
                        flex: 1
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Schedule</h3>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#6366f1', backgroundColor: '#eef2ff', padding: '6px 14px', borderRadius: '100px', letterSpacing: '0.05em' }}>
                                {filteredTimeline.length} ACTIVE
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredTimeline.length > 0 ? (
                                filteredTimeline.map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={() => {
                                            if (event.title?.startsWith('Task:')) navigate('/employee-dashboard/my-tasks');
                                            else navigate('/employee-dashboard/announcements');
                                        }}
                                        style={{
                                            display: 'flex',
                                            gap: '16px',
                                            cursor: 'pointer',
                                            alignItems: 'center',
                                            padding: '16px',
                                            borderRadius: '20px',
                                            backgroundColor: '#f8fafc',
                                            border: '1px solid #f1f5f9',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateX(6px)';
                                            e.currentTarget.style.borderColor = '#cbd5e1';
                                            e.currentTarget.style.backgroundColor = '#ffffff';
                                            e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.03)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateX(0)';
                                            e.currentTarget.style.borderColor = '#f1f5f9';
                                            e.currentTarget.style.backgroundColor = '#f8fafc';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div style={{
                                            padding: '12px',
                                            borderRadius: '16px',
                                            backgroundColor: '#ffffff',
                                            boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
                                            textAlign: 'center',
                                            minWidth: '64px'
                                        }}>
                                            <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>{event.time}</p>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', marginBottom: '2px' }}>{event.title}</p>
                                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MoreHorizontal size={14} /> {event.location}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '48px 0', opacity: 0.5 }}>
                                    <div style={{ display: 'inline-flex', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '50%', marginBottom: '16px' }}>
                                        <Calendar size={32} color="#cbd5e1" />
                                    </div>
                                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#94a3b8' }}>Clear path for today!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Modal Styling */}
            {showAddEventModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '40px', width: '480px', boxShadow: '0 50px 100px -20px rgba(15, 23, 42, 0.25)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>Create Event</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>Schedule something spectacular</p>
                            </div>
                            <button onClick={() => setShowAddEventModal(false)} style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '14px', color: '#64748b', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event Details</label>
                                <input name="title" type="text" placeholder="What's happening?" required style={{ padding: '16px 20px', borderRadius: '20px', border: '1px solid #eef2f6', fontSize: '1rem', outline: 'none', backgroundColor: '#f8fafc', fontWeight: 500 }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start Time</label>
                                    <input name="time" type="time" required style={{ padding: '16px 20px', borderRadius: '20px', border: '1px solid #eef2f6', fontSize: '1rem', outline: 'none', backgroundColor: '#f8fafc', fontWeight: 600 }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tag</label>
                                    <select style={{ padding: '16px 20px', borderRadius: '20px', border: '1px solid #eef2f6', fontSize: '1rem', outline: 'none', backgroundColor: '#f8fafc', fontWeight: 600 }}>
                                        <option>🚀 Sprint</option>
                                        <option>🤝 Meeting</option>
                                        <option>🎨 Design</option>
                                        <option>☕ Catch-up</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location / Link</label>
                                <input name="location" type="text" placeholder="Where is it?" required style={{ padding: '16px 20px', borderRadius: '20px', border: '1px solid #eef2f6', fontSize: '1rem', outline: 'none', backgroundColor: '#f8fafc', fontWeight: 500 }} />
                            </div>

                            <button type="submit" style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)', color: '#fff', padding: '18px', borderRadius: '20px', fontWeight: 800, fontSize: '1.05rem', border: 'none', cursor: 'pointer', marginTop: '12px', boxShadow: '0 20px 40px -10px rgba(14, 165, 233, 0.4)' }}>
                                Save Event
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            `}</style>
        </div>
    );
};

// Enhanced StatCard Component
const StatCard = ({ label, value, trend, icon, color, subLabel, bg }) => {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid #eef2f6',
                boxShadow: isHovered ? '0 20px 40px -10px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.01)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isHovered ? 'translateY(-5px)' : 'translateY(0)'
            }}
        >
            {/* Soft background glow */}
            <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '100px', height: '100px', background: color, opacity: isHovered ? 0.08 : 0, filter: 'blur(30px)', transition: 'opacity 0.4s ease', borderRadius: '50%' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                    padding: '12px',
                    borderRadius: '16px',
                    backgroundColor: `${color}15`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)'
                }}>
                    {icon}
                </div>
                {trend && (
                    <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: trend.startsWith('+') ? '#10b981' : '#ef4444',
                        backgroundColor: trend.startsWith('+') ? '#f0fdf4' : '#fef2f2',
                        padding: '6px 12px',
                        borderRadius: '100px',
                        border: `1px solid ${trend.startsWith('+') ? '#dcfce7' : '#fee2e2'}`
                    }}>
                        {trend}
                    </div >
                )}
            </div>
            <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em' }}>{value || 0}</h3>
                    {subLabel && <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8' }}>{subLabel}</span>}
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
