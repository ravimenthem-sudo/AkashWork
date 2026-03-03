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
                // Now fetching status via RPC - UI no longer knows about the 'attendance' table
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
            .channel('employee-attendance-changes')
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
                // TRIGGER CONFIRMATION
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
            backgroundColor: '#ffffff',
            borderRadius: '32px',
            padding: '40px',
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
            border: '1px solid #eef2f6',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
        }}>
            {/* Subtle Gradient Glow */}
            <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.05) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: status === 'checked-in' ? '#10b981' : status === 'break' ? '#f59e0b' : '#94a3b8',
                            boxShadow: status === 'checked-in' ? '0 0 15px rgba(16,185,129,0.5)' : 'none',
                            animation: status === 'checked-in' ? 'pulse 2s infinite' : 'none'
                        }}></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {status === 'checked-in' ? 'Active Session' : status === 'break' ? 'On Break' : 'System Ready'}
                        </span>
                    </div>

                    <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', letterSpacing: '-0.04em', lineHeight: 1 }}>Work Session</h2>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8', marginBottom: '40px' }}>{dateString}</p>

                    <div style={{ display: 'flex', gap: '48px' }}>
                        {/* Check In Card */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Started at</p>
                            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>{formatTime(checkInTime)}</p>
                        </div>

                        <div style={{ width: '1px', background: 'linear-gradient(to bottom, transparent, #eef2f6, transparent)' }}></div>

                        {/* Check Out Card */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ending at</p>
                            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: checkOutTime ? '#1e293b' : '#cbd5e1', letterSpacing: '-0.02em' }}>{formatTime(checkOutTime)}</p>
                        </div>
                    </div>
                </div>

                {/* Right Section: Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                    <button
                        onClick={handleMainAction}
                        disabled={status === 'checked-out' && checkOutTime}
                        style={{
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            backgroundColor: '#ffffff',
                            border: '12px solid #f8fafc',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (status === 'checked-out' && checkOutTime) ? 'not-allowed' : 'pointer',
                            opacity: (status === 'checked-out' && checkOutTime) ? 0.7 : 1,
                            boxShadow: '0 20px 50px rgba(0,0,0,0.08), inset 0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            position: 'relative',
                            padding: '0'
                        }}
                        onMouseEnter={(e) => {
                            if (!(status === 'checked-out' && checkOutTime)) {
                                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                                e.currentTarget.style.boxShadow = '0 30px 60px rgba(0,0,0,0.12)';
                                e.currentTarget.style.borderColor = '#ffffff';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 20px 50px rgba(0,0,0,0.08)';
                            e.currentTarget.style.borderColor = '#f8fafc';
                        }}
                    >
                        {(status === 'checked-out' && !checkOutTime) ? (
                            <>
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '14px',
                                    color: '#fff',
                                    boxShadow: '0 10px 20px rgba(14, 165, 233, 0.3)'
                                }}>
                                    <LogIn size={32} />
                                </div>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>Check In</span>
                            </>
                        ) : (status === 'checked-in' || status === 'break') ? (
                            <>
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '14px',
                                    color: '#fff',
                                    boxShadow: '0 10px 20px rgba(239, 68, 68, 0.3)'
                                }}>
                                    <Square size={28} fill="currentColor" />
                                </div>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>Check Out</span>
                            </>
                        ) : (
                            <>
                                <div style={{
                                    width: '72px',
                                    height: '72px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '14px',
                                    color: '#fff',
                                    boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)'
                                }}>
                                    <CheckCircle2 size={36} />
                                </div>
                                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.01em' }}>Verified</span>
                            </>
                        )}

                        {/* Animated Border */}
                        <div style={{
                            position: 'absolute',
                            top: '-8px',
                            left: '-8px',
                            right: '-8px',
                            bottom: '-8px',
                            borderRadius: '50%',
                            border: '3px solid transparent',
                            borderTopColor: status === 'checked-in' ? '#0ea5e9' : 'transparent',
                            borderRightColor: status === 'checked-in' ? '#38bdf8' : 'transparent',
                            animation: status === 'checked-in' ? 'spin 3s cubic-bezier(0.4, 0, 0.2, 1) infinite' : 'none',
                        }}></div>
                    </button>

                    {/* Timer Display */}
                    {(status === 'checked-in' || status === 'break') && (
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.05em', lineHeight: 1, marginBottom: '4px' }}>{formatDuration(elapsedTime)}</p>
                            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Session</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Current Task Input Area */}
            {(status === 'checked-in' || status === 'break') && (
                <div style={{
                    marginTop: '8px',
                    padding: '24px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '24px',
                    border: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '14px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)', color: '#0ea5e9' }}>
                        <Clock size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Current Focus</p>
                        <input
                            type="text"
                            placeholder="What are you tackling right now?"
                            value={currentTask}
                            onChange={(e) => {
                                setCurrentTask(e.target.value);
                                setUserTask(e.target.value);
                            }}
                            style={{
                                width: '100%',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#1e293b',
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                outline: 'none',
                                padding: '0'
                            }}
                        />
                    </div>
                    <button
                        onClick={toggleBreak}
                        style={{
                            padding: '14px 24px',
                            borderRadius: '16px',
                            backgroundColor: status === 'break' ? '#0f172a' : '#ffffff',
                            color: status === 'break' ? '#ffffff' : '#1e293b',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.03)',
                            border: '1px solid #eef2f6',
                            transition: 'all 0.3s'
                        }}
                    >
                        <Coffee size={20} />
                        {status === 'break' ? 'Resume Work' : 'Break Time'}
                    </button>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(8px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '40px',
                        borderRadius: '32px',
                        width: '400px',
                        textAlign: 'center',
                        color: '#1e293b',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fef2f2',
                            color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto'
                        }}>
                            <Square size={32} fill="currentColor" />
                        </div>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.02em' }}>Finish your shift?</h3>
                        <p style={{ color: '#64748b', marginBottom: '32px', lineHeight: '1.6', fontSize: '1.05rem' }}>
                            You're about to clock out. Please ensure all your tasks for this session are logged.
                        </p>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                style={{
                                    padding: '16px 24px',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: 'white',
                                    color: '#64748b',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    flex: 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                Back to Work
                            </button>
                            <button
                                onClick={performCheckOut}
                                style={{
                                    padding: '16px 24px',
                                    borderRadius: '16px',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    flex: 1,
                                    boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                            >
                                End Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default AttendanceTracker;
