import React, { useState, useEffect } from 'react';
import { Clock, Coffee, LogIn, Square, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../../../lib/supabaseClient';

const AttendanceTracker = () => {
    const { addToast } = useToast();
    const { setUserStatus, setUserTask, setLastActive, userId, orgId } = useUser();
    const [status, setStatus] = useState('checked-out'); // 'checked-out', 'checked-in', 'break'
    const [checkInTime, setCheckInTime] = useState(null);
    const [checkOutTime, setCheckOutTime] = useState(null);
    const [currentTask, setCurrentTask] = useState('');
    const [elapsedTime, setElapsedTime] = useState(0);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch Today's Attendance on Mount
    useEffect(() => {
        const fetchAttendance = async () => {
            if (!userId || !orgId) return;

            try {
                const { data, error } = await supabase.rpc('get_my_attendance_status');

                if (error) {
                    console.error('Error fetching attendance status:', error);
                    return;
                }

                if (data) {
                    setCurrentTask(data.current_task || '');

                    if (data.clock_in) {
                        const [h, m, s] = data.clock_in.split(':');
                        const inTime = new Date();
                        inTime.setHours(h, m, s || 0);
                        setCheckInTime(inTime);

                        if (!data.clock_out) {
                            setStatus('checked-in');
                            setUserStatus('Online');
                            setLastActive('Now');

                            const now = new Date();
                            const diff = Math.floor((now - inTime) / 1000);
                            setElapsedTime(diff > 0 ? diff : 0);
                        } else {
                            const [oh, om, os] = data.clock_out.split(':');
                            const outTime = new Date();
                            outTime.setHours(oh, om, os || 0);
                            setCheckOutTime(outTime);
                            setStatus('checked-out');
                            setUserStatus('Offline');
                            setLastActive(formatTime(outTime));
                        }
                    }
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();

        // ========== REALTIME SUBSCRIPTION ==========
        const channel = supabase
            .channel('manager-attendance-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'attendance',
                    filter: `employee_id=eq.${userId},org_id=eq.${orgId}`
                },
                (payload) => {
                    console.log('[REALTIME] Attendance changed:', payload);
                    fetchAttendance();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // ========== END REALTIME ==========
    }, [userId]);

    // Timer logic
    useEffect(() => {
        let interval;
        if (status === 'checked-in' && checkInTime) {
            const calculateTime = () => {
                const now = new Date();
                const diff = Math.floor((now - checkInTime) / 1000);
                setElapsedTime(diff > 0 ? diff : 0);
            };
            calculateTime();
            interval = setInterval(calculateTime, 1000);
        }
        return () => clearInterval(interval);
    }, [status, checkInTime]);

    const formatTime = (date) => {
        if (!date) return '--:--';
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleMainAction = async () => {
        try {
            if (status === 'checked-out') {
                // CHECK IN via RPC
                const { data, error } = await supabase.rpc('check_in');

                if (error) {
                    addToast(error.message || 'Check-in failed', 'error');
                    return;
                }

                if (data && data.error) {
                    addToast(data.error, 'error');
                    return;
                }

                if (data && data.success) {
                    setStatus('checked-in');
                    setCheckInTime(new Date());
                    setCheckOutTime(null);
                    setElapsedTime(0);
                    setUserStatus('Online');
                    setLastActive('Now');
                    addToast('Checked in successfully', 'success');
                }
            } else if (status === 'checked-in' || status === 'break') {
                setShowConfirmModal(true);
            }
        } catch (error) {
            console.error('Error updating attendance:', error);
            addToast('Unexpected error occurred', 'error');
        }
    };

    const performCheckOut = async () => {
        try {
            // CHECK OUT via RPC
            const { data, error } = await supabase.rpc('check_out');

            if (error) {
                addToast(error.message || 'Check-out failed', 'error');
                return;
            }

            if (data && data.error) {
                addToast(data.error, 'error');
                return;
            }

            if (data && data.success) {
                const now = new Date();
                setStatus('checked-out');
                setCheckOutTime(now);
                setUserStatus('Offline');
                setLastActive(formatTime(now));
                addToast('Checked out successfully', 'success');
            }
        } catch (error) {
            console.error('Error updating attendance:', error);
            addToast('Unexpected error occurred', 'error');
        } finally {
            setShowConfirmModal(false);
        }
    };


    const toggleBreak = () => {
        if (status === 'checked-in') {
            setStatus('break');
            setUserStatus('Away');
            addToast('Break started', 'info');
        } else if (status === 'break') {
            setStatus('checked-in');
            setUserStatus('Online');
            addToast('Break ended', 'success');
        }
    };

    const today = new Date();
    const dateString = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
        <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: '24px',
            padding: '24px',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Decoration */}
            <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
            <div style={{ position: 'absolute', bottom: '-30px', left: '100px', width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>

            {/* Left Section: Info & Times */}
            <div style={{ flex: 1, zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: status === 'checked-in' ? '#4ade80' : status === 'break' ? '#facc15' : '#94a3b8' }}></div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.9 }}>
                        {status === 'checked-in' ? 'Online' : status === 'break' ? 'On Break' : 'Offline'}
                    </span>
                </div>

                <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '4px' }}>Today's Attendance</h2>
                <p style={{ fontSize: '1.1rem', opacity: 0.8, marginBottom: '32px' }}>{dateString}</p>

                <div style={{ display: 'flex', gap: '24px' }}>
                    {/* Check In Card */}
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        padding: '16px 24px',
                        borderRadius: '16px',
                        minWidth: '140px'
                    }}>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '4px' }}>Check In</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatTime(checkInTime)}</p>
                    </div>

                    {/* Check Out Card */}
                    <div style={{
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        padding: '16px 24px',
                        borderRadius: '16px',
                        minWidth: '140px'
                    }}>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '4px' }}>Check Out</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatTime(checkOutTime)}</p>
                    </div>
                </div>

                {/* Current Task Input */}
                {(status === 'checked-in' || status === 'break') && (
                    <div style={{ marginTop: '24px', maxWidth: '400px' }}>
                        <input
                            type="text"
                            placeholder="What are you working on?"
                            value={currentTask}
                            onChange={(e) => {
                                setCurrentTask(e.target.value);
                                setUserTask(e.target.value);
                            }}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                fontSize: '1rem',
                                outline: 'none',
                                placeholderColor: 'rgba(255,255,255,0.6)'
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Right Section: Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 1 }}>

                {/* Main Action Button */}
                <button
                    onClick={handleMainAction}
                    disabled={status === 'checked-out' && checkOutTime} // Disable if already checked out for the day
                    style={{
                        width: '160px',
                        height: '160px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        border: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: (status === 'checked-out' && checkOutTime) ? 'not-allowed' : 'pointer',
                        opacity: (status === 'checked-out' && checkOutTime) ? 0.7 : 1,
                        boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                        transition: 'transform 0.2s',
                        color: status === 'checked-in' || status === 'break' ? '#ef4444' : '#6366f1'
                    }}
                    onMouseEnter={(e) => {
                        if (!(status === 'checked-out' && checkOutTime)) {
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {(status === 'checked-out' && !checkOutTime) ? (
                        <>
                            <Clock size={40} strokeWidth={1.5} />
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '8px' }}>Check In</span>
                        </>
                    ) : (status === 'checked-in' || status === 'break') ? (
                        <>
                            <Square size={40} strokeWidth={1.5} fill="currentColor" />
                            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', marginTop: '8px' }}>Check Out</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={40} strokeWidth={1.5} className="text-green-500" />
                            <span style={{ fontSize: '1.0rem', fontWeight: 'bold', marginTop: '8px' }}>Completed</span>
                        </>
                    )}
                </button>

                {/* Timer Display */}
                {(status === 'checked-in' || status === 'break') && (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatDuration(elapsedTime)}</p>
                        <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>Working Time</p>
                    </div>
                )}


            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '32px',
                        borderRadius: '24px',
                        width: '360px',
                        textAlign: 'center',
                        color: '#1e293b',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#fee2e2',
                            color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto'
                        }}>
                            <Square size={32} fill="currentColor" />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>Confirm Check Out</h3>
                        <p style={{ color: '#64748b', marginBottom: '32px', lineHeight: '1.5' }}>
                            Are you sure you want to clock out for today? This action will mark your attendance as completed.
                        </p>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: 'white',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    flex: 1,
                                    fontSize: '1rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={performCheckOut}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    flex: 1,
                                    fontSize: '1rem',
                                    boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.3)'
                                }}
                            >
                                Check Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceTracker;
