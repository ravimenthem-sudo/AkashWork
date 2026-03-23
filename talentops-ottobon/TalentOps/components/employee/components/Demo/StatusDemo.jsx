import React, { useState, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../../../lib/supabaseClient';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatusDemo = () => {
    const { userName, userStatus, userTask, lastActive, userId } = useUser();

    // Mock Status Data for the List
    const statusData = [
        { name: userName, dept: 'Engineering', availability: userStatus, task: userTask || 'No active task', lastActive: lastActive }
    ];

    const getSunday = (d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        const day = date.getDay();
        const diff = date.getDate() - day;
        return new Date(date.setDate(diff));
    };

    const [currentWeekStart, setCurrentWeekStart] = useState(getSunday(new Date()));
    const [stats, setStats] = useState({
        avgHours: '0h',
        peakDay: '—',
        arrival: '—',
        streak: '0 Days'
    });
    const [weeklyData, setWeeklyData] = useState([]);
    const [joinDate, setJoinDate] = useState(null);
    const [loading, setLoading] = useState(false);

    const handlePrevWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(currentWeekStart.getDate() - 7);
        setCurrentWeekStart(newDate);
    };

    const handleNextWeek = () => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(currentWeekStart.getDate() + 7);
        setCurrentWeekStart(newDate);
    };

    // Helper: Get all dates in a range
    const getDatesInRange = (startDate, endDate) => {
        const date = new Date(startDate.getTime());
        const dates = [];
        while (date <= endDate) {
            dates.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return dates;
    };

    useEffect(() => {
        const fetchJoinDate = async () => {
            if (!userId) return;
            const { data } = await supabase.from('profiles').select('join_date').eq('id', userId).single();
            if (data?.join_date) setJoinDate(new Date(data.join_date));
        };
        fetchJoinDate();
    }, [userId]);

    useEffect(() => {
        const fetchData = async () => {
            if (!userId) return;
            setLoading(true);

            // Define Time Range: Weekly (Sun - Sat)
            const weekStart = new Date(currentWeekStart);
            const weekEnd = new Date(currentWeekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const fetchStart = weekStart.toISOString().split('T')[0];
            const fetchEnd = weekEnd.toISOString().split('T')[0];

            try {
                // Fetch Data
                let { data: attendance } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', userId)
                    .gte('date', fetchStart)
                    .lte('date', fetchEnd);

                const { data: leaves } = await supabase
                    .from('leaves')
                    .select('*')
                    .eq('employee_id', userId)
                    .eq('status', 'Approved')
                    .or(`from_date.lte.${fetchEnd},to_date.gte.${fetchStart}`);

                // --- DATE HELPERS ---
                const getLocalDateStr = (date) => {
                    const offset = date.getTimezoneOffset() * 60000;
                    return new Date(date.getTime() - offset).toISOString().split('T')[0];
                };
                const todayLocalStr = getLocalDateStr(new Date());

                // --- SELF-HEALING LOGIC ---
                // Fix stale records strictly from BEFORE today (Local Time)
                const staleRecords = attendance?.filter(a => a.date < todayLocalStr && !a.clock_out) || [];

                if (staleRecords.length > 0) {
                    await Promise.all(staleRecords.map(async (record) => {
                        const clockOutTime = '23:59:00';
                        const start = new Date(`${record.date}T${record.clock_in}`);
                        const end = new Date(`${record.date}T${clockOutTime}`);
                        const diffMs = end - start;
                        const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

                        await supabase
                            .from('attendance')
                            .update({
                                clock_out: clockOutTime,
                                total_hours: totalHours,
                                status: 'present'
                            })
                            .eq('id', record.id);
                    }));

                    // Re-fetch attendance after healing to ensure local data is fresh
                    const { data: refreshedAttendance } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('employee_id', userId)
                        .gte('date', fetchStart)
                        .lte('date', fetchEnd);

                    if (refreshedAttendance) {
                        // Update the local attendance variable used for calculation
                        attendance = refreshedAttendance;
                    }
                }

                // Process Day Logic (Aggregate Multiple Sessions)
                const processDay = (date) => {
                    const dateStr = getLocalDateStr(date);

                    // Find ALL records for this day
                    const dayRecords = attendance?.filter(a => a.date === dateStr) || [];
                    const leave = leaves?.find(l => dateStr >= l.from_date && dateStr <= l.to_date);

                    let totalHours = 0;
                    let isAnyActive = false;
                    let firstClockIn = null;

                    dayRecords.forEach(att => {
                        if (att.clock_in && (!firstClockIn || att.clock_in < firstClockIn)) {
                            firstClockIn = att.clock_in;
                        }
                        if (att.clock_out && att.total_hours) {
                            totalHours += parseFloat(att.total_hours);
                        } else if (att.clock_in && !att.clock_out) {
                            // Active Session
                            const isToday = dateStr === todayLocalStr;
                            const start = new Date(`${dateStr}T${att.clock_in}`);

                            if (isToday) {
                                isAnyActive = true;
                                const now = new Date();
                                const diff = (now - start) / (1000 * 60 * 60);
                                if (diff > 0) totalHours += diff;
                            } else {
                                // Stale session visual fallback (Auto-closing...)
                                const end = new Date(`${dateStr}T23:59:00`);
                                const diff = (end - start) / (1000 * 60 * 60);
                                if (diff > 0) totalHours += diff;
                            }
                        }
                    });

                    let tooltipStatus = 'Absent';
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // Status Determination
                    if (date > today) {
                        tooltipStatus = 'Upcoming';
                    } else if (joinDate && date < joinDate) {
                        tooltipStatus = 'Not Joined';
                    } else if (dayRecords.length > 0) {
                        if (isAnyActive) {
                            tooltipStatus = 'Active Now';
                        } else {
                            const hasStale = dayRecords.some(r => !r.clock_out && dateStr !== todayLocalStr);
                            tooltipStatus = hasStale ? 'Auto-closing...' : 'Present';
                        }
                    } else if (leave) {
                        tooltipStatus = 'On Leave';
                    }

                    return {
                        dateStr,
                        hours: Number(totalHours.toFixed(2)),
                        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                        tooltipStatus,
                        firstClockIn
                    };
                };

                // --- WEEKLY DATA ---
                const wDates = getDatesInRange(weekStart, weekEnd);
                const wData = wDates
                    .filter(d => d.getDay() !== 0 && d.getDay() !== 6)
                    .map(d => processDay(d));

                setWeeklyData(wData);

                // --- CALCULATE DYNAMIC METRICS ---
                const activeDays = wData.filter(d => d.hours > 0);
                const avgHoursValue = activeDays.length > 0
                    ? (activeDays.reduce((acc, curr) => acc + curr.hours, 0) / activeDays.length).toFixed(1)
                    : '0';

                const peakDayItem = [...wData].sort((a, b) => b.hours - a.hours)[0];

                // Arrival Logic: Average of first clock-ins
                let avgArrival = '—';
                if (activeDays.length > 0) {
                    const arrivals = activeDays
                        .filter(d => d.firstClockIn)
                        .map(d => {
                            const [h, m] = d.firstClockIn.split(':').map(Number);
                            return h * 60 + m;
                        });
                    if (arrivals.length > 0) {
                        const avgMinutes = arrivals.reduce((a, b) => a + b, 0) / arrivals.length;
                        const h = Math.floor(avgMinutes / 60);
                        const m = Math.floor(avgMinutes % 60);
                        avgArrival = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    }
                }

                // Streak Logic: Find consecutive present days (today or yesterday backwards)
                let streakCount = 0;
                // Fetch all recent attendance for streak (last 30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const { data: streakData } = await supabase
                    .from('attendance')
                    .select('date')
                    .eq('employee_id', userId)
                    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
                    .order('date', { ascending: false });

                if (streakData) {
                    const uniqueDates = Array.from(new Set(streakData.map(d => d.date)));
                    const checkDate = new Date();
                    // If not clocked in today, check from yesterday
                    const todayStr = getLocalDateStr(checkDate);
                    let startIdx = 0;

                    if (uniqueDates[0] !== todayStr) {
                        checkDate.setDate(checkDate.getDate() - 1);
                    }

                    for (let i = 0; i < 30; i++) {
                        const dStr = getLocalDateStr(checkDate);
                        // Skip weekends
                        if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
                            checkDate.setDate(checkDate.getDate() - 1);
                            continue;
                        }
                        if (uniqueDates.includes(dStr)) {
                            streakCount++;
                            checkDate.setDate(checkDate.getDate() - 1);
                        } else {
                            break;
                        }
                    }
                }

                setStats({
                    avgHours: `${avgHoursValue}h`,
                    peakDay: peakDayItem?.hours > 0 ? peakDayItem.dayName : '—',
                    arrival: avgArrival,
                    streak: `${streakCount} Days`
                });

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Realtime Subscription
        const channel = supabase
            .channel('status-demo-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'attendance',
                    filter: `employee_id=eq.${userId}`
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, currentWeekStart, joinDate]);

    // Format Week Range Display
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const dateRangeStr = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>{label}</p>
                    <p style={{ fontSize: '0.9rem', color: '#6366f1' }}>Hours: {data.hours}h</p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Status: {data.tooltipStatus}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            paddingBottom: '24px',
            position: 'relative',
            zIndex: 1
        }}>
            {/* Compact Header - Matching Leave Requests Style */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '20px 28px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>/</span>
                            <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Activity Hub</span>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                            Your Activity Hub
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '400' }}>
                            Real-time monitoring of your presence, task engagement, and weekly attendance footprint.
                        </p>
                    </div>

                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(12px)',
                        padding: '14px 20px',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: 'white',
                                boxShadow: '0 6px 12px rgba(56, 189, 248, 0.2)'
                            }}>
                                {userName?.charAt(0) || 'U'}
                            </div>
                            <div style={{
                                position: 'absolute',
                                bottom: '-3px',
                                right: '-3px',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: userStatus === 'Online' ? '#10b981' : '#f59e0b',
                                border: '2px solid #1e293b',
                            }}></div>
                        </div>
                        <div>
                            <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '2px', color: 'white' }}>{userName}</p>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Engineering</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Unique Representation Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>

                {/* Status Identity Card */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px', letterSpacing: '-0.02em' }}>Work Identity</h3>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500' }}>Your current engagement profile</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { label: 'Live Availability', value: userStatus, color: userStatus === 'Online' ? '#10b981' : '#f59e0b', bg: userStatus === 'Online' ? '#f0fdf4' : '#fffbeb' },
                            { label: 'Active Engagement', value: userTask || 'No active task', color: '#6366f1', bg: '#f5f3ff' },
                            { label: 'Last Signal', value: lastActive, color: '#64748b', bg: '#f8fafc' }
                        ].map((item, idx) => (
                            <div key={idx} style={{
                                padding: '16px',
                                borderRadius: '12px',
                                backgroundColor: item.bg,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>{item.label}</span>
                                <span style={{
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: item.color,
                                    padding: '4px 12px',
                                    backgroundColor: 'white',
                                    borderRadius: '10px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}>{item.value}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{
                        marginTop: 'auto',
                        padding: '20px',
                        background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                        borderRadius: '14px',
                        color: 'white',
                        textAlign: 'center'
                    }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Active Streak</p>
                        <h4 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0 }}>{stats.streak}</h4>
                        <p style={{ fontSize: '0.8rem', fontWeight: '600', marginTop: '2px' }}>Keep the momentum going!</p>
                    </div>
                </div>

                {/* Performance Footprint (Weekly Log) */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px', letterSpacing: '-0.02em' }}>Activity Footprint</h3>
                            <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500' }}>{dateRangeStr}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handlePrevWeek} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                <ChevronLeft size={18} color="#64748b" />
                            </button>
                            <button onClick={handleNextWeek} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                <ChevronRight size={18} color="#64748b" />
                            </button>
                        </div>
                    </div>

                    <div style={{ height: '260px', width: '100%', position: 'relative' }}>
                        {loading ? (
                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: '700' }}>
                                Mapping your signals...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="presenceGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="dayName"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: '700' }}
                                        dy={15}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: '700' }}
                                        unit="h"
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="hours"
                                        stroke="#0ea5e9"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#presenceGradient)"
                                        activeDot={{ r: 8, strokeWidth: 3, stroke: '#fff', fill: '#0ea5e9' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div style={{
                        marginTop: '24px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        padding: '16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Avg Hours</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{stats.avgHours}</p>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Peak Day</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{stats.peakDay}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Arrival</p>
                            <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>{stats.arrival}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Signal Log - Compact Version */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 2px 12px rgba(0,0,0,0.02)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '4px', letterSpacing: '-0.02em' }}>Signal Stream</h3>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500' }}>Your historical presence records for the week</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                    {weeklyData.map((day, idx) => (
                        <div key={idx} style={{
                            padding: '16px',
                            borderRadius: '12px',
                            backgroundColor: day.hours > 0 ? '#f0f9ff' : '#f8fafc',
                            border: `1px solid ${day.hours > 0 ? '#bae6fd' : '#e2e8f0'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s ease'
                        }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{day.dayName}</span>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                backgroundColor: day.hours > 0 ? '#0ea5e9' : '#e2e8f0',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem',
                                fontWeight: '700'
                            }}>
                                {day.hours > 0 ? <Clock size={20} /> : '—'}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>{day.hours}h</p>
                                <p style={{ fontSize: '0.7rem', fontWeight: '600', color: day.hours > 0 ? '#0369a1' : '#94a3b8', margin: 0 }}>{day.tooltipStatus}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StatusDemo;
