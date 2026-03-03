import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Filter, Search } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const NotificationsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread, read
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        if (currentUserId) {
            fetchNotifications();
        }
    }, [currentUserId, filter]);

    const fetchCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
        }
    };

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('notifications')
                .select('*')
                .eq('receiver_id', currentUserId)
                .order('created_at', { ascending: false });

            if (filter === 'unread') {
                query = query.eq('is_read', false);
            } else if (filter === 'read') {
                query = query.eq('is_read', true);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching notifications:', error);
            } else {
                setNotifications(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (!error) {
                setNotifications(prev =>
                    prev.map(notif =>
                        notif.id === notificationId
                            ? { ...notif, is_read: true }
                            : notif
                    )
                );
            }
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('receiver_id', currentUserId)
                .eq('is_read', false);

            if (!error) {
                fetchNotifications();
            }
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (!error) {
                setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
            }
        } catch (err) {
            console.error('Error deleting notification:', err);
        }
    };

    const getNotificationIcon = (type) => {
        const iconStyle = {
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
        };

        switch (type) {
            case 'leave_approved':
                return <div style={{ ...iconStyle, backgroundColor: '#dcfce7', color: '#166534' }}>✓</div>;
            case 'leave_rejected':
                return <div style={{ ...iconStyle, backgroundColor: '#fee2e2', color: '#991b1b' }}>✗</div>;
            case 'leave_request':
                return <div style={{ ...iconStyle, backgroundColor: '#dbeafe', color: '#1e40af' }}>📅</div>;
            case 'task_assigned':
                return <div style={{ ...iconStyle, backgroundColor: '#fef3c7', color: '#b45309' }}>📋</div>;
            case 'announcement':
                return <div style={{ ...iconStyle, backgroundColor: '#e0e7ff', color: '#4338ca' }}>📢</div>;
            default:
                return <div style={{ ...iconStyle, backgroundColor: '#f3f4f6', color: '#6b7280' }}>🔔</div>;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        const timeString = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        if (isToday) {
            return timeString;
        }

        // For older notifications
        return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeString}`;
    };

    const filteredNotifications = notifications.filter(notif =>
        notif.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notif.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '4px' }}>
                        <span>Dashboard</span>
                        <span>/</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Notifications</span>
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Bell size={28} />
                        Notifications
                        {unreadCount > 0 && (
                            <span style={{
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.875rem',
                                fontWeight: 600
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </h2>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        style={{
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            padding: '10px 16px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-md)'
                        }}
                    >
                        <Check size={18} />
                        Mark All as Read
                    </button>
                )}
            </div>

            {/* Filters and Search */}
            <div style={{
                backgroundColor: 'var(--surface)',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                {/* Filter Buttons */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Filter size={18} color="var(--text-secondary)" />
                    {['all', 'unread', 'read'].map(filterType => (
                        <button
                            key={filterType}
                            onClick={() => setFilter(filterType)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                backgroundColor: filter === filterType ? 'var(--primary)' : 'var(--background)',
                                color: filter === filterType ? 'white' : 'var(--text-primary)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                transition: 'all 0.2s'
                            }}
                        >
                            {filterType}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 10px 10px 40px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--background)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>
            </div>

            {/* Notifications List */}
            <div style={{
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border)',
                overflow: 'hidden'
            }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Loading notifications...
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <Bell size={48} color="var(--text-secondary)" style={{ opacity: 0.5, marginBottom: '16px' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                            {searchTerm ? 'No notifications found' : 'No notifications yet'}
                        </p>
                    </div>
                ) : (
                    <div>
                        {filteredNotifications.map((notification, index) => (
                            <div
                                key={notification.id}
                                style={{
                                    padding: '20px',
                                    borderBottom: index < filteredNotifications.length - 1 ? '1px solid var(--border)' : 'none',
                                    backgroundColor: notification.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.05)',
                                    display: 'flex',
                                    gap: '16px',
                                    alignItems: 'flex-start',
                                    transition: 'background-color 0.2s'
                                }}
                            >
                                {/* Icon */}
                                {getNotificationIcon(notification.type)}

                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        <div>
                                            {notification.sender_name && (
                                                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                    {notification.sender_name}
                                                </p>
                                            )}
                                            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                                {notification.message}
                                            </p>
                                        </div>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                                            {formatDate(notification.created_at)}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                        {!notification.is_read && (
                                            <button
                                                onClick={() => markAsRead(notification.id)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--border)',
                                                    backgroundColor: 'var(--background)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <Check size={14} />
                                                Mark as Read
                                            </button>
                                        )}

                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
};

export default NotificationsPage;
