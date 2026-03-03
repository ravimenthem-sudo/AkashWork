import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, MessageSquare, User, FileText, ClipboardList, Receipt, File, Moon, Sun } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import NotificationDropdown from '../../../shared/NotificationDropdown';
import { supabase } from '../../../../lib/supabaseClient';
import { useTheme } from '../../../shared/context/ThemeContext';
// TimerWidget removed per requirement

import { useBrowserNotification } from '../../../../hooks/useBrowserNotification';

const Header = () => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const { userRole, userId, orgId } = useUser();

    // Enable browser notifications - moved down
    // useBrowserNotification(userId);

    const { theme, toggleTheme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const searchRef = useRef(null);
    const notificationRef = useRef(null);

    // Search Functionality
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim().length > 0) {
                performSearch();
            } else {
                setSearchResults([]);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const performSearch = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const query = searchQuery.toLowerCase();
            const results = [];

            // 1. Search Employees (Profiles)
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, role, email')
                .ilike('full_name', `%${query}%`)
                .limit(5);

            if (profiles) {
                profiles.forEach(p => {
                    results.push({
                        id: `emp-${p.id}`,
                        type: 'Employee',
                        title: p.full_name,
                        subtitle: p.role || 'Staff',
                        path: '/executive-dashboard/employees',
                        icon: User
                    });
                });
            }

            // 2. Search All Tasks
            const { data: tasks } = await supabase
                .from('tasks')
                .select('id, title, status')
                .ilike('title', `%${query}%`)
                .limit(5);

            if (tasks) {
                tasks.forEach(t => {
                    results.push({
                        id: `task-${t.id}`,
                        type: 'Task',
                        title: t.title,
                        subtitle: t.status,
                        path: '/executive-dashboard/tasks',
                        icon: FileText
                    });
                });
            }

            // 3. Search Project Documents
            const { data: documents } = await supabase
                .from('project_documents')
                .select('id, title, doc_type, created_at')
                .ilike('title', `%${query}%`)
                .limit(5);

            if (documents) {
                documents.forEach(d => {
                    results.push({
                        id: `doc-${d.id}`,
                        type: 'Document',
                        title: d.title,
                        subtitle: d.doc_type || 'Project Document',
                        path: '/executive-dashboard/projects', // Executives view on projects page
                        icon: File
                    });
                });
            }

            // 4. Search Announcements
            const { data: announcements } = await supabase
                .from('announcements')
                .select('id, title, created_at')
                .ilike('title', `%${query}%`)
                .limit(5);

            if (announcements) {
                announcements.forEach(a => {
                    results.push({
                        id: `ann-${a.id}`,
                        type: 'Announcement',
                        title: a.title,
                        subtitle: new Date(a.created_at).toLocaleDateString(),
                        path: '/executive-dashboard/announcements',
                        icon: MessageSquare
                    });
                });
            }

            setSearchResults(results);
            setShowResults(true);

        } catch (error) {
            console.error('Search error:', error);
        }
    };

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleResultClick = (path) => {
        navigate(path);
        setSearchQuery('');
        setShowResults(false);
    };

    // Handle new notification (update count + show toast)
    const handleNotificationUpdate = async (newNotification) => {
        // Update unread count
        fetchUnreadCount();

        // Show toast if notification data is present
        if (newNotification) {
            addToast(newNotification.message, 'info');
        }
    };

    // Fetch unread notification count
    const fetchUnreadCount = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', user.id)
                .eq('is_read', false);

            setUnreadCount(count || 0);
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        // Refresh count every 30 seconds
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    // Enable browser notifications with wrapper callback
    useBrowserNotification(userId, handleNotificationUpdate);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowResults(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <header style={{
            height: '80px',
            backgroundColor: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--spacing-xl)',
            position: 'sticky',
            top: 0,
            zIndex: 900
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{userRole ? userRole.toUpperCase() : 'DASHBOARD'}</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                <div style={{ position: 'relative' }} ref={searchRef}>
                    <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search employees, tasks, logs..."
                        value={searchQuery}
                        onChange={handleSearch}
                        onFocus={() => searchQuery && setShowResults(true)}
                        style={{
                            padding: '0.5rem 1rem 0.5rem 2.5rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--background)',
                            width: '350px',
                            fontFamily: 'inherit'
                        }}
                    />

                    {/* Search Results Dropdown */}
                    {showResults && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '8px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            border: '1px solid var(--border)',
                            maxHeight: '400px',
                            overflowY: 'auto',
                            zIndex: 1000
                        }}>
                            {searchResults.length > 0 ? (
                                searchResults.map((result) => (
                                    <div
                                        key={result.id}
                                        onClick={() => handleResultClick(result.path)}
                                        style={{
                                            padding: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--border)',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--primary-light)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--primary)'
                                        }}>
                                            <result.icon size={16} />
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{result.title}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{result.type} • {result.subtitle}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    No results found for "{searchQuery}"
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    {/* TimerWidget removed */}
                    <button
                        onClick={toggleTheme}
                        style={{ position: 'relative', padding: '8px', borderRadius: '8px', backgroundColor: 'var(--background)', cursor: 'pointer', border: 'none' }}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? <Sun size={20} color="var(--text-secondary)" /> : <Moon size={20} color="var(--text-secondary)" />}
                    </button>

                    <button
                        onClick={() => navigate('/executive-dashboard/settings')}
                        style={{ position: 'relative', padding: '8px', borderRadius: '8px', backgroundColor: 'var(--background)', cursor: 'pointer', border: 'none' }}
                    >
                        <User size={20} color="var(--text-secondary)" />
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{ position: 'relative', padding: '8px', borderRadius: '8px', backgroundColor: 'var(--background)', cursor: 'pointer' }}
                        >
                            <Bell size={20} color="var(--text-secondary)" />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '6px',
                                    right: '6px',
                                    minWidth: '16px',
                                    height: '16px',
                                    backgroundColor: 'var(--danger)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    color: 'white',
                                    padding: '0 4px'
                                }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                        <NotificationDropdown
                            isOpen={showNotifications}
                            onClose={() => setShowNotifications(false)}
                            dropdownRef={notificationRef}
                            onNotificationUpdate={fetchUnreadCount}
                        />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
