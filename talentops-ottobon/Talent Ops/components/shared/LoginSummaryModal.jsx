import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCircle, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const LoginSummaryModal = ({ isOpen, onClose, userId }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categorizedNotifications, setCategorizedNotifications] = useState({
        tasks: [],
        leaves: [],
        messages: [],
        other: []
    });

    useEffect(() => {
        if (isOpen && userId) {
            fetchUnreadNotifications();
        }
    }, [isOpen, userId]);

    const fetchUnreadNotifications = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('receiver_id', userId)
                .eq('is_read', false)
                .order('created_at', { ascending: false });

            if (!error && data) {
                // Filter out 'announcement' type immediately
                const nonAnnouncementData = data.filter(n => n.type !== 'announcement');

                // Filter based on last seen time from localStorage
                const lastSeenTime = localStorage.getItem('last_login_summary_seen');
                let filteredData = nonAnnouncementData;

                if (lastSeenTime) {
                    const lastSeenDate = new Date(lastSeenTime);
                    filteredData = nonAnnouncementData.filter(n => new Date(n.created_at) > lastSeenDate);
                }

                // Only update state if there are new notifications
                if (filteredData.length > 0) {
                    setNotifications(filteredData);
                    categorizeNotifications(filteredData);
                } else {
                    // If no new notifications, ensure we don't show empty modal
                    setNotifications([]);
                }
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    const categorizeNotifications = (notifs) => {
        const categorized = {
            tasks: notifs.filter(n => n.type === 'task_assigned'),
            leaves: notifs.filter(n => n.type === 'leave_approved' || n.type === 'leave_rejected' || n.type === 'leave_request'),
            messages: notifs.filter(n => n.type === 'message'),
            other: notifs.filter(n => !['task_assigned', 'leave_approved', 'leave_rejected', 'leave_request', 'message', 'announcement'].includes(n.type))
        };
        setCategorizedNotifications(categorized);
    };

    const handleDismiss = () => {
        // Save current time as last seen
        localStorage.setItem('last_login_summary_seen', new Date().toISOString());
        onClose();
    };

    if (!isOpen) return null;

    const totalUnread = notifications.length;

    if (totalUnread === 0 && !loading) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    padding: '32px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            padding: '12px',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Bell size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, letterSpacing: '-0.01em' }}>
                                While you were away
                            </h2>
                            <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0', opacity: 0.7, fontWeight: 500 }}>
                                You have {totalUnread} update{totalUnread !== 1 ? 's' : ''} to review
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '50%',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'white',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: '32px',
                    overflowY: 'auto',
                    flex: 1,
                    backgroundColor: '#f8fafc'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                            <div className="spinner" style={{ marginBottom: '16px' }}></div>
                            <p style={{ fontWeight: 600 }}>Syncing updates...</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Tasks */}
                            {categorizedNotifications.tasks.length > 0 && (
                                <NotificationCategory
                                    icon={<CheckCircle size={20} color="#10b981" />}
                                    title="Task Assignments"
                                    count={categorizedNotifications.tasks.length}
                                    notifications={categorizedNotifications.tasks}
                                    color="#10b981"
                                />
                            )}

                            {/* Leaves */}
                            {categorizedNotifications.leaves.length > 0 && (
                                <NotificationCategory
                                    icon={<Calendar size={20} color="#f59e0b" />}
                                    title="Leave Requests"
                                    count={categorizedNotifications.leaves.length}
                                    notifications={categorizedNotifications.leaves}
                                    color="#f59e0b"
                                />
                            )}

                            {/* Messages */}
                            {categorizedNotifications.messages.length > 0 && (
                                <NotificationCategory
                                    icon={<MessageSquare size={20} color="#3b82f6" />}
                                    title="New Messages"
                                    count={categorizedNotifications.messages.length}
                                    notifications={categorizedNotifications.messages}
                                    color="#3b82f6"
                                />
                            )}

                            {/* Other */}
                            {categorizedNotifications.other.length > 0 && (
                                <NotificationCategory
                                    icon={<AlertCircle size={20} color="#64748b" />}
                                    title="General Updates"
                                    count={categorizedNotifications.other.length}
                                    notifications={categorizedNotifications.other}
                                    color="#64748b"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px 32px 32px',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={handleDismiss}
                        style={{
                            padding: '14px 40px',
                            borderRadius: '16px',
                            border: 'none',
                            backgroundColor: '#0f172a',
                            color: 'white',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.2)',
                            transition: 'transform 0.2s, background 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.backgroundColor = '#1e293b';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.backgroundColor = '#0f172a';
                        }}
                    >
                        Mark as Seen
                    </button>
                </div>
            </div>
        </div>
    );
};

const NotificationCategory = ({ icon, title, count, notifications, color }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    padding: '20px 24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: expanded ? '#ffffff' : '#ffffff'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        padding: '10px',
                        backgroundColor: `${color}15`,
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {icon}
                    </div>
                    <div>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>{title}</h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                            {count} new item{count !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <div style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    backgroundColor: `${color}15`,
                    color: color
                }}>
                    {count}
                </div>
            </div>

            {expanded && (
                <div style={{
                    padding: '0 24px 24px',
                    backgroundColor: 'white',
                    animation: 'slideDown 0.3s ease-out'
                }}>
                    {notifications.slice(0, 5).map((notif, index) => (
                        <div
                            key={notif.id}
                            style={{
                                padding: '12px',
                                borderLeft: `3px solid ${color}40`,
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                marginTop: '10px'
                            }}
                        >
                            <p style={{ fontSize: '0.85rem', margin: 0, color: '#334155', lineHeight: 1.5 }}>
                                {notif.message}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                {notif.sender_name && (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                                        {notif.sender_name}
                                    </span>
                                )}
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LoginSummaryModal;
