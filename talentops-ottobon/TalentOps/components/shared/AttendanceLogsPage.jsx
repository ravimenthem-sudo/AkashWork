import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    Clock,
    Users,
    Search,
    ChevronLeft,
    ChevronRight,
    Download,
    Filter,
    User,
    X,
    ArrowUpDown,
    CheckCircle,
    XCircle,
    AlertCircle,
    BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const AttendanceLogsPage = () => {
    // State
    const [employees, setEmployees] = useState([]);
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'monthly', 'report'
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [orgId, setOrgId] = useState(null);
    const [expandedEmployee, setExpandedEmployee] = useState(null); // For calendar accordion
    const [showDetailedLogs, setShowDetailedLogs] = useState({}); // { [employeeId]: boolean } - Toggle for detailed logs view

    const [leaveData, setLeaveData] = useState([]);

    // Get current user's org
    useEffect(() => {
        const fetchUserOrg = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('org_id')
                    .eq('id', user.id)
                    .single();
                if (profile) {
                    setOrgId(profile.org_id);
                }
            }
        };
        fetchUserOrg();
    }, []);

    // Fetch employees, attendance, and leave data
    useEffect(() => {
        if (!orgId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Get first and last day of selected month
                const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
                const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

                // Fetch employees
                const { data: employeesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role, avatar_url')
                    .eq('org_id', orgId)
                    .neq('role', 'executive')
                    .neq('role', 'admin');

                // Fetch attendance for the month
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('org_id', orgId)
                    .gte('date', startDate)
                    .lte('date', endDate)
                    .order('date', { ascending: false });

                // Fetch approved leaves overlapping with the month
                const { data: leaves } = await supabase
                    .from('leaves')
                    .select('*')
                    .eq('org_id', orgId)
                    .eq('status', 'Approved')
                    .or(`from_date.lte.${endDate},to_date.gte.${startDate}`);

                setEmployees(employeesData || []);
                setAttendanceData(attendance || []);
                setLeaveData(leaves || []);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [orgId, selectedMonth, selectedYear]);

    // Month navigation
    const navigateMonth = (direction) => {
        if (direction === 'prev') {
            if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
            } else {
                setSelectedMonth(selectedMonth - 1);
            }
        } else {
            if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
            } else {
                setSelectedMonth(selectedMonth + 1);
            }
        }
    };

    // Format time
    const formatTime = (timeString) => {
        if (!timeString) return '--:--';
        const [hours, minutes] = timeString.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    // Calculate hours worked
    const calculateHours = (clockIn, clockOut) => {
        if (!clockIn || !clockOut) return '--';
        const [inH, inM] = clockIn.split(':').map(Number);
        const [outH, outM] = clockOut.split(':').map(Number);
        const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    };

    // Get employee name
    const getEmployeeName = (employeeId) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return 'Unknown';
        return emp.full_name || emp.email || 'Unknown';
    };

    // Get employee initials
    const getEmployeeInitials = (emp) => {
        if (!emp) return '?';
        if (emp.full_name) {
            const parts = emp.full_name.split(' ');
            return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : emp.full_name[0];
        }
        return emp.email ? emp.email[0].toUpperCase() : '?';
    };

    // Filter and sort data
    const filteredData = useMemo(() => {
        let data = [...attendanceData];

        // Search filter - by name, email, or role
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            data = data.filter(record => {
                const emp = employees.find(e => e.id === record.employee_id);
                if (!emp) return false;
                const name = (emp.full_name || '').toLowerCase();
                const email = (emp.email || '').toLowerCase();
                const role = (emp.role || '').toLowerCase();
                return name.includes(query) || email.includes(query) || role.includes(query);
            });
        }

        // Sort
        data.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (sortConfig.key === 'employee') {
                aVal = getEmployeeName(a.employee_id);
                bVal = getEmployeeName(b.employee_id);
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [attendanceData, searchQuery, sortConfig, employees]);

    // Employee attendance summary
    const getEmployeeSummary = (employeeId) => {
        const records = attendanceData.filter(r => r.employee_id === employeeId);
        const presentDays = records.filter(r => r.clock_in).length;
        const totalHours = records.reduce((sum, r) => {
            if (r.total_hours) return sum + parseFloat(r.total_hours);
            if (r.clock_in && r.clock_out) {
                const [inH, inM] = r.clock_in.split(':').map(Number);
                const [outH, outM] = r.clock_out.split(':').map(Number);
                return sum + ((outH * 60 + outM) - (inH * 60 + inM)) / 60;
            }
            return sum;
        }, 0);
        return { presentDays, totalHours: totalHours.toFixed(1) };
    };

    // Calculate working days (Mon-Fri) in a month up to today
    const getWorkingDays = (year, month) => {
        const today = new Date();
        const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const lastDay = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

        let workingDays = 0;
        for (let day = 1; day <= lastDay; day++) {
            const dayOfWeek = new Date(year, month, day).getDay();
            // 0 = Sunday, 6 = Saturday - skip weekends
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
        }
        return workingDays;
    };

    // Monthly summary per employee
    const monthlySummary = useMemo(() => {
        const workingDays = getWorkingDays(selectedYear, selectedMonth);

        return employees.map(emp => {
            const summary = getEmployeeSummary(emp.id);
            // Calculate attendance rate based on working days only
            const attendanceRate = workingDays > 0
                ? ((summary.presentDays / workingDays) * 100).toFixed(1)
                : '0.0';
            return {
                ...emp,
                ...summary,
                attendanceRate,
                workingDays
            };
        }).sort((a, b) => b.presentDays - a.presentDays);
    }, [employees, attendanceData, selectedMonth, selectedYear]);

    // Overall stats
    const overallStats = useMemo(() => {
        const totalEmployees = employees.length;
        const totalPresent = monthlySummary.reduce((sum, e) => sum + e.presentDays, 0);
        const avgHours = monthlySummary.length > 0
            ? (monthlySummary.reduce((sum, e) => sum + parseFloat(e.totalHours || 0), 0) / monthlySummary.length).toFixed(1)
            : 0;
        const avgAttendance = monthlySummary.length > 0
            ? (monthlySummary.reduce((sum, e) => sum + parseFloat(e.attendanceRate || 0), 0) / monthlySummary.length).toFixed(1)
            : 0;
        return { totalEmployees, totalPresent, avgHours, avgAttendance };
    }, [monthlySummary]);

    // Export to CSV
    const exportToCSV = () => {
        const monthName = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' });
        const headers = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Total Hours'];
        const rows = filteredData.map(r => [
            getEmployeeName(r.employee_id),
            r.date,
            r.clock_in || '-',
            r.clock_out || '-',
            r.total_hours || '-'
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${monthName}_${selectedYear}.csv`;
        a.click();
    };

    // Get employee calendar for the month
    const getEmployeeCalendar = (employeeId) => {
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const empAttendance = attendanceData.filter(a => a.employee_id === employeeId);

        // Get employee leaves
        const empLeaves = leaveData.filter(l => l.employee_id === employeeId);

        const calendar = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = new Date(selectedYear, selectedMonth, day).getDay();
            const record = empAttendance.find(a => a.date === dateStr);
            const currentDate = new Date(selectedYear, selectedMonth, day);
            const today = new Date();

            // Check if date is within any leave range
            const onLeave = empLeaves.find(leave => {
                const start = new Date(leave.from_date);
                const end = new Date(leave.to_date);
                // Reset times for accurate date comparison
                start.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);
                const check = new Date(currentDate);
                check.setHours(0, 0, 0, 0);
                return check >= start && check <= end;
            });

            let status = 'weekend';
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                if (record && record.clock_in) {
                    if (record.clock_out) {
                        status = 'present';
                    } else {
                        // Check if it's today
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        status = isToday ? 'ongoing' : 'present';
                    }
                } else if (onLeave) {
                    status = 'leave';
                } else {
                    status = currentDate > today ? 'future' : 'absent';
                }
            } else {
                // If weekend but logged in, show present
                if (record && record.clock_in) {
                    if (record.clock_out) {
                        status = 'present';
                    } else {
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        status = isToday ? 'ongoing' : 'present';
                    }
                }
            }

            calendar.push({
                day,
                date: dateStr,
                dayOfWeek,
                status,
                clockIn: record?.clock_in,
                clockOut: record?.clock_out,
                totalHours: record?.total_hours,
                leaveType: onLeave ? onLeave.reason : null // Optionally store leave reason/type
            });
        }
        return calendar;
    };

    // Filter employees for Daily view based on search
    const filteredEmployees = useMemo(() => {
        if (!searchQuery.trim()) return employees;
        const query = searchQuery.toLowerCase().trim();
        return employees.filter(emp => {
            const name = (emp.full_name || '').toLowerCase();
            const email = (emp.email || '').toLowerCase();
            const role = (emp.role || '').toLowerCase();
            return name.includes(query) || email.includes(query) || role.includes(query);
        });
    }, [employees, searchQuery]);

    // Filter monthly summary based on search (for Monthly Summary and Report tabs)
    const filteredMonthlySummary = useMemo(() => {
        if (!searchQuery.trim()) return monthlySummary;
        const query = searchQuery.toLowerCase().trim();
        return monthlySummary.filter(emp => {
            const name = (emp.full_name || '').toLowerCase();
            const email = (emp.email || '').toLowerCase();
            const role = (emp.role || '').toLowerCase();
            return name.includes(query) || email.includes(query) || role.includes(query);
        });
    }, [monthlySummary, searchQuery]);

    // View employee details
    const viewEmployeeDetails = (emp) => {
        setSelectedEmployee(emp);
        setShowEmployeeModal(true);
    };

    // Get employee's attendance for the month
    const getEmployeeAttendance = (employeeId) => {
        return attendanceData
            .filter(r => r.employee_id === employeeId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    // Month names
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    // Styles
    const containerStyle = {
        padding: '24px',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        fontFamily: "'Inter', sans-serif"
    };

    const cardStyle = {
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
    };

    const tabStyle = (active) => ({
        padding: '12px 24px',
        borderRadius: '12px',
        border: 'none',
        backgroundColor: active ? '#7c3aed' : 'transparent',
        color: active ? '#fff' : '#64748b',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s'
    });

    const tableHeaderStyle = {
        padding: '14px 16px',
        textAlign: 'left',
        fontWeight: 600,
        color: '#64748b',
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid #e2e8f0'
    };

    const tableCellStyle = {
        padding: '16px',
        borderBottom: '1px solid #f1f5f9',
        color: '#1e293b',
        fontSize: '0.95rem'
    };

    if (loading && !orgId) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading...</div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                        Attendance Logs
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                        Track employee attendance, working hours, and monthly reports
                    </p>
                </div>
                <button
                    onClick={exportToCSV}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: '#7c3aed',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ ...cardStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={24} style={{ color: '#22c55e' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Total Employees</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{overallStats.totalEmployees}</p>
                    </div>
                </div>
                <div style={{ ...cardStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle size={24} style={{ color: '#0ea5e9' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Total Check-ins</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{overallStats.totalPresent}</p>
                    </div>
                </div>
                <div style={{ ...cardStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={24} style={{ color: '#a855f7' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Avg. Hours/Employee</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{overallStats.avgHours}h</p>
                    </div>
                </div>
                <div style={{ ...cardStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fefce8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BarChart3 size={24} style={{ color: '#eab308' }} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Avg. Attendance Rate</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>{overallStats.avgAttendance}%</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Month Navigator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={() => navigateMonth('prev')}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div style={{ minWidth: '180px', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                            {monthNames[selectedMonth]} {selectedYear}
                        </h2>
                    </div>
                    <button
                        onClick={() => navigateMonth('next')}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '14px' }}>
                    <button style={tabStyle(activeTab === 'daily')} onClick={() => setActiveTab('daily')}>
                        <Clock size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        Daily Logs
                    </button>
                    <button style={tabStyle(activeTab === 'monthly')} onClick={() => setActiveTab('monthly')}>
                        <Calendar size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                        Monthly Summary
                    </button>
                </div>

                {/* Search */}
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Search by name, email, role..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '10px 36px 10px 40px',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.9rem',
                            width: '260px',
                            outline: 'none',
                            backgroundColor: '#fff',
                            color: '#0f172a'
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X size={16} style={{ color: '#94a3b8' }} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'daily' && (
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
                        Employee Attendance Calendar - {monthNames[selectedMonth]} {selectedYear}
                    </h3>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading...</div>
                    ) : filteredEmployees.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            No employees found
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredEmployees.map((emp) => {
                                const summary = getEmployeeSummary(emp.id);
                                const calendar = getEmployeeCalendar(emp.id);
                                const isExpanded = expandedEmployee === emp.id;
                                const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                                // Group calendar by weeks (starting from Monday)
                                const weeks = [];
                                let currentWeek = [];
                                const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();

                                // Add empty cells for days before the 1st
                                for (let i = 0; i < firstDay; i++) {
                                    currentWeek.push(null);
                                }

                                calendar.forEach((day) => {
                                    currentWeek.push(day);
                                    if (currentWeek.length === 7) {
                                        weeks.push(currentWeek);
                                        currentWeek = [];
                                    }
                                });
                                if (currentWeek.length > 0) {
                                    while (currentWeek.length < 7) currentWeek.push(null);
                                    weeks.push(currentWeek);
                                }

                                const getStatusColor = (status) => {
                                    const colors = {
                                        present: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
                                        ongoing: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
                                        leave: { bg: '#ffedd5', border: '#f97316', text: '#c2410c' },
                                        absent: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
                                        weekend: { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b' },
                                        future: { bg: '#fff', border: '#e2e8f0', text: '#94a3b8' }
                                    };
                                    return colors[status] || colors.future;
                                };

                                const getStatusLabel = (status) => {
                                    const labels = { present: 'Present', ongoing: 'Ongoing', leave: 'Leave', absent: 'Absent', weekend: 'Weekend', future: '-' };
                                    return labels[status] || '-';
                                };

                                return (
                                    <div key={emp.id} style={{
                                        background: '#fff',
                                        borderRadius: '12px',
                                        border: '1px solid #e2e8f0',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        {/* Employee Header - Click to expand */}
                                        <div
                                            onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                                            style={{
                                                padding: '16px 20px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                background: isExpanded ? '#f8fafc' : '#fff',
                                                transition: 'background 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{
                                                    width: '54px',
                                                    height: '54px',
                                                    borderRadius: '50%',
                                                    padding: '3px',
                                                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                                                }}>
                                                    <div style={{
                                                        width: '46px',
                                                        height: '46px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#fff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#22c55e',
                                                        fontWeight: 700,
                                                        fontSize: '1rem',
                                                        backgroundImage: emp.avatar_url ? `url(${emp.avatar_url})` : 'none',
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center'
                                                    }}>
                                                        {!emp.avatar_url && getEmployeeInitials(emp)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a' }}>
                                                        {emp.full_name || emp.email}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                        {emp.role || 'Employee'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                                {/* Quick Stats */}
                                                <div style={{ display: 'flex', gap: '20px' }}>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e' }}>
                                                            {summary.presentDays}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Present</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4f46e5' }}>
                                                            {summary.totalHours}h
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Hours</div>
                                                    </div>
                                                </div>

                                                {/* Expand/Collapse Icon */}
                                                <ChevronRight
                                                    size={20}
                                                    style={{
                                                        color: '#64748b',
                                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.3s ease'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Expanded Calendar View */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '20px',
                                                borderTop: '1px solid #e2e8f0',
                                                background: '#fafbfc'
                                            }}>
                                                {/* Calendar Grid */}
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(7, 1fr)',
                                                    gap: '8px',
                                                    marginBottom: '20px'
                                                }}>
                                                    {/* Weekday Headers */}
                                                    {weekdays.map((day, i) => (
                                                        <div key={i} style={{
                                                            textAlign: 'center',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            color: i === 0 || i === 6 ? '#94a3b8' : '#64748b',
                                                            padding: '8px'
                                                        }}>
                                                            {day}
                                                        </div>
                                                    ))}

                                                    {/* Calendar Days */}
                                                    {weeks.flat().map((dayData, idx) => {
                                                        if (!dayData) {
                                                            return <div key={idx} style={{ minHeight: '60px' }} />;
                                                        }

                                                        const colors = getStatusColor(dayData.status);
                                                        const isToday = new Date().toISOString().split('T')[0] === dayData.date;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                style={{
                                                                    background: colors.bg,
                                                                    borderRadius: '8px',
                                                                    padding: '8px',
                                                                    minHeight: '60px',
                                                                    borderLeft: `3px solid ${colors.border}`,
                                                                    position: 'relative',
                                                                    boxShadow: isToday ? '0 0 0 2px #4f46e5' : 'none'
                                                                }}
                                                                title={dayData.leaveType ? `Leave Reason: ${dayData.leaveType}` : ''}
                                                            >
                                                                <div style={{
                                                                    fontSize: '1.1rem',
                                                                    fontWeight: 600,
                                                                    color: '#0f172a',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    {dayData.day}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 500,
                                                                    color: colors.text
                                                                }}>
                                                                    {getStatusLabel(dayData.status)}
                                                                </div>
                                                                {dayData.totalHours && (
                                                                    <div style={{
                                                                        fontSize: '0.65rem',
                                                                        color: '#64748b',
                                                                        marginTop: '2px'
                                                                    }}>
                                                                        {parseFloat(dayData.totalHours).toFixed(1)}h
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Summary Stats */}
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '16px',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    <div style={{
                                                        flex: '1',
                                                        minWidth: '200px',
                                                        padding: '16px',
                                                        background: '#fff',
                                                        borderRadius: '10px',
                                                        border: '1px solid #e2e8f0'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                                            <div style={{
                                                                width: '6px',
                                                                height: '40px',
                                                                background: '#22c55e',
                                                                borderRadius: '3px'
                                                            }} />
                                                            <div>
                                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Hours</div>
                                                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#22c55e' }}>
                                                                    {summary.totalHours}h
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{
                                                        flex: '1',
                                                        minWidth: '200px',
                                                        padding: '16px',
                                                        background: '#fff',
                                                        borderRadius: '10px',
                                                        border: '1px solid #e2e8f0'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                                            <div style={{
                                                                width: '6px',
                                                                height: '40px',
                                                                background: '#4f46e5',
                                                                borderRadius: '3px'
                                                            }} />
                                                            <div>
                                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Days Present</div>
                                                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4f46e5' }}>
                                                                    {summary.presentDays} days
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{
                                                        flex: '1',
                                                        minWidth: '200px',
                                                        padding: '16px',
                                                        background: '#fff',
                                                        borderRadius: '10px',
                                                        border: '1px solid #e2e8f0'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                                            <div style={{
                                                                width: '6px',
                                                                height: '40px',
                                                                background: '#f59e0b',
                                                                borderRadius: '3px'
                                                            }} />
                                                            <div>
                                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Avg Hours/Day</div>
                                                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                                                                    {summary.presentDays > 0
                                                                        ? (parseFloat(summary.totalHours) / summary.presentDays).toFixed(1)
                                                                        : '0'}h
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Legend */}
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '20px',
                                                    marginTop: '16px',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    {[
                                                        { status: 'present', label: 'Present' },
                                                        { status: 'ongoing', label: 'Ongoing' },
                                                        { status: 'leave', label: 'Leave' },
                                                        { status: 'absent', label: 'Absent' },
                                                        { status: 'weekend', label: 'Weekend' }
                                                    ].map(({ status, label }) => (
                                                        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{
                                                                width: '16px',
                                                                height: '16px',
                                                                borderRadius: '4px',
                                                                background: getStatusColor(status).bg,
                                                                borderLeft: `3px solid ${getStatusColor(status).border}`
                                                            }} />
                                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* View Detailed Logs Toggle */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    marginTop: '20px',
                                                    borderTop: '1px solid #e2e8f0',
                                                    paddingTop: '20px'
                                                }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowDetailedLogs(prev => ({
                                                                ...prev,
                                                                [emp.id]: !prev[emp.id]
                                                            }));
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            padding: '12px 24px',
                                                            borderRadius: '12px',
                                                            border: 'none',
                                                            backgroundColor: showDetailedLogs[emp.id] ? '#7c3aed' : '#f1f5f9',
                                                            color: showDetailedLogs[emp.id] ? '#fff' : '#64748b',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            boxShadow: showDetailedLogs[emp.id] ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
                                                        }}
                                                    >
                                                        <Clock size={18} />
                                                        {showDetailedLogs[emp.id] ? 'Hide Detailed Logs' : 'View Detailed Logs'}
                                                    </button>
                                                </div>

                                                {/* Detailed Logs Table */}
                                                {showDetailedLogs[emp.id] && (
                                                    <div style={{
                                                        marginTop: '20px',
                                                        padding: '20px',
                                                        backgroundColor: '#fff',
                                                        borderRadius: '12px',
                                                        border: '1px solid #e2e8f0',
                                                        animation: 'fadeIn 0.3s ease'
                                                    }}>
                                                        <h4 style={{
                                                            fontSize: '1rem',
                                                            fontWeight: 600,
                                                            color: '#0f172a',
                                                            marginBottom: '16px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}>
                                                            <Clock size={18} style={{ color: '#7c3aed' }} />
                                                            Attendance History - {monthNames[selectedMonth]} {selectedYear}
                                                        </h4>
                                                        <div style={{ overflowX: 'auto' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                                                        <th style={tableHeaderStyle}>Date</th>
                                                                        <th style={tableHeaderStyle}>Clock In</th>
                                                                        <th style={tableHeaderStyle}>Clock Out</th>
                                                                        <th style={tableHeaderStyle}>Total Hours</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {getEmployeeAttendance(emp.id).map((record, idx) => (
                                                                        <tr key={idx}
                                                                            style={{
                                                                                transition: 'background 0.15s'
                                                                            }}
                                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                                                        >
                                                                            <td style={tableCellStyle}>
                                                                                <div style={{ fontWeight: 500 }}>
                                                                                    {new Date(record.date).toLocaleDateString('en-US', {
                                                                                        weekday: 'short',
                                                                                        month: 'short',
                                                                                        day: 'numeric'
                                                                                    })}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ ...tableCellStyle }}>
                                                                                <span style={{
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '6px',
                                                                                    color: '#22c55e',
                                                                                    fontWeight: 500
                                                                                }}>
                                                                                    <CheckCircle size={14} />
                                                                                    {formatTime(record.clock_in)}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ ...tableCellStyle }}>
                                                                                <span style={{
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '6px',
                                                                                    color: record.clock_out ? '#ef4444' : '#94a3b8',
                                                                                    fontWeight: 500
                                                                                }}>
                                                                                    {record.clock_out ? <XCircle size={14} /> : <AlertCircle size={14} />}
                                                                                    {formatTime(record.clock_out)}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ ...tableCellStyle }}>
                                                                                <span style={{
                                                                                    display: 'inline-block',
                                                                                    padding: '4px 10px',
                                                                                    backgroundColor: '#f0fdf4',
                                                                                    color: '#166534',
                                                                                    borderRadius: '6px',
                                                                                    fontWeight: 600,
                                                                                    fontSize: '0.85rem'
                                                                                }}>
                                                                                    {record.total_hours
                                                                                        ? `${parseFloat(record.total_hours).toFixed(1)}h`
                                                                                        : calculateHours(record.clock_in, record.clock_out)}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                    {getEmployeeAttendance(emp.id).length === 0 && (
                                                                        <tr>
                                                                            <td colSpan="4" style={{
                                                                                ...tableCellStyle,
                                                                                textAlign: 'center',
                                                                                color: '#94a3b8',
                                                                                padding: '32px'
                                                                            }}>
                                                                                <AlertCircle size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                                                                <div>No attendance records found for this month</div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'monthly' && (
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
                        Monthly Employee Summary - {monthNames[selectedMonth]} {selectedYear}
                    </h3>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading...</div>
                    ) : filteredMonthlySummary.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No employees found matching your search</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                            {filteredMonthlySummary.map((emp) => {
                                const attendancePercent = parseFloat(emp.attendanceRate) || 0;
                                // Calculate punctuality (example: based on late arrivals - you can adjust logic)
                                const punctuality = Math.min(100, Math.max(0, attendancePercent + Math.random() * 10 - 5)).toFixed(0);

                                // Determine ring color based on attendance rate
                                const ringColor = attendancePercent >= 90 ? '#22c55e' :
                                    attendancePercent >= 70 ? '#eab308' : '#ef4444';

                                return (
                                    <div
                                        key={emp.id}
                                        onClick={() => viewEmployeeDetails(emp)}
                                        style={{
                                            padding: '24px 20px',
                                            borderRadius: '16px',
                                            border: '1px solid #e2e8f0',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            backgroundColor: '#fff',
                                            textAlign: 'center'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#22c55e';
                                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(34,197,94,0.15)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        {/* Avatar with Green Ring Border */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            marginBottom: '16px'
                                        }}>
                                            <div style={{
                                                width: '80px',
                                                height: '80px',
                                                borderRadius: '50%',
                                                padding: '4px',
                                                background: `conic-gradient(${ringColor} ${attendancePercent}%, #e2e8f0 ${attendancePercent}%)`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <div style={{
                                                    width: '68px',
                                                    height: '68px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#f8fafc',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.4rem',
                                                    fontWeight: 700,
                                                    color: '#4f46e5',
                                                    backgroundImage: emp.avatar_url ? `url(${emp.avatar_url})` : 'none',
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center'
                                                }}>
                                                    {!emp.avatar_url && getEmployeeInitials(emp)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Employee Name */}
                                        <div style={{
                                            fontWeight: 700,
                                            fontSize: '1rem',
                                            color: '#0f172a',
                                            marginBottom: '4px'
                                        }}>
                                            {emp.full_name || emp.email}
                                        </div>

                                        {/* Role */}
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: '#64748b',
                                            marginBottom: '4px',
                                            textTransform: 'capitalize'
                                        }}>
                                            {(emp.role || 'Employee').replace(/_/g, ' ')}
                                        </div>

                                        {/* Department/Email */}
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: '#94a3b8',
                                            marginBottom: '16px'
                                        }}>
                                            {emp.email?.split('@')[0] || '-'}
                                        </div>

                                        {/* Attendance & Punctuality Stats */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-around',
                                            alignItems: 'center',
                                            paddingTop: '12px',
                                            borderTop: '1px solid #f1f5f9'
                                        }}>
                                            {/* Attendance */}
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>Attendance</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        fontSize: '1.1rem',
                                                        fontWeight: 700,
                                                        color: '#0f172a'
                                                    }}>
                                                        {emp.attendanceRate}%
                                                    </div>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '50%',
                                                        background: `conic-gradient(#22c55e ${attendancePercent}%, #e2e8f0 ${attendancePercent}%)`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <div style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#fff',
                                                            fontSize: '0.6rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#22c55e',
                                                            fontWeight: 600
                                                        }}>
                                                            ✓
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                                                    {emp.presentDays} Days
                                                </div>
                                            </div>

                                            {/* Punctuality */}
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '8px' }}>Hours</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        fontSize: '1.1rem',
                                                        fontWeight: 700,
                                                        color: '#0f172a'
                                                    }}>
                                                        {emp.totalHours}h
                                                    </div>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '50%',
                                                        background: `conic-gradient(#4f46e5 ${Math.min(100, (parseFloat(emp.totalHours) / (emp.presentDays * 9)) * 100)}%, #e2e8f0 ${Math.min(100, (parseFloat(emp.totalHours) / (emp.presentDays * 9)) * 100)}%)`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <div style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#fff',
                                                            fontSize: '0.6rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#4f46e5',
                                                            fontWeight: 600
                                                        }}>
                                                            ⏱
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px' }}>
                                                    Avg {emp.presentDays > 0 ? (parseFloat(emp.totalHours) / emp.presentDays).toFixed(1) : '0'}h/day
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Report tab removed - functionality now available via 'View Detailed Logs' toggle in Daily Logs */}

            {/* Employee Detail Modal */}
            {
                showEmployeeModal && selectedEmployee && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}
                        onClick={() => setShowEmployeeModal(false)}
                    >
                        <div
                            style={{
                                backgroundColor: '#fff',
                                borderRadius: '20px',
                                padding: '24px',
                                width: '700px',
                                maxHeight: '80vh',
                                overflow: 'auto'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        backgroundColor: '#e0e7ff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#4f46e5',
                                        fontWeight: 600,
                                        fontSize: '1.1rem'
                                    }}>
                                        {getEmployeeInitials(selectedEmployee)}
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>
                                            {selectedEmployee.full_name || selectedEmployee.email}
                                        </h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                            {selectedEmployee.role || 'Employee'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowEmployeeModal(false)}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        backgroundColor: '#f1f5f9',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Summary Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{selectedEmployee.presentDays}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Present Days</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#faf5ff', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a855f7' }}>{selectedEmployee.totalHours}h</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Hours</div>
                                </div>
                                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0ea5e9' }}>{selectedEmployee.attendanceRate}%</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Attendance Rate</div>
                                </div>
                            </div>

                            {/* Detailed Logs */}
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '12px' }}>
                                Attendance History - {monthNames[selectedMonth]} {selectedYear}
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                        <th style={{ ...tableHeaderStyle, fontSize: '0.75rem' }}>Date</th>
                                        <th style={{ ...tableHeaderStyle, fontSize: '0.75rem' }}>Clock In</th>
                                        <th style={{ ...tableHeaderStyle, fontSize: '0.75rem' }}>Clock Out</th>
                                        <th style={{ ...tableHeaderStyle, fontSize: '0.75rem' }}>Hours</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getEmployeeAttendance(selectedEmployee.id).map((record, idx) => (
                                        <tr key={idx}>
                                            <td style={{ ...tableCellStyle, fontSize: '0.9rem' }}>
                                                {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td style={{ ...tableCellStyle, fontSize: '0.9rem', color: '#22c55e' }}>{formatTime(record.clock_in)}</td>
                                            <td style={{ ...tableCellStyle, fontSize: '0.9rem', color: '#ef4444' }}>{formatTime(record.clock_out)}</td>
                                            <td style={{ ...tableCellStyle, fontSize: '0.9rem', fontWeight: 600 }}>
                                                {record.total_hours ? `${parseFloat(record.total_hours).toFixed(1)}h` : calculateHours(record.clock_in, record.clock_out)}
                                            </td>
                                        </tr>
                                    ))}
                                    {getEmployeeAttendance(selectedEmployee.id).length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ ...tableCellStyle, textAlign: 'center', color: '#94a3b8' }}>
                                                No attendance records found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default AttendanceLogsPage;
