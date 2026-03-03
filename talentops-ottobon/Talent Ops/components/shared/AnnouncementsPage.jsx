import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Calendar, MapPin, Clock, Users, User, X, Plus, CheckCircle2, Archive, AlertCircle, Trash2 } from 'lucide-react';

const AnnouncementsPage = ({ userRole, userId, orgId }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [filteredAnnouncements, setFilteredAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [eventParticipants, setEventParticipants] = useState({ loading: false, names: [], type: '' });

    // Status Tab State
    const [activeTab, setActiveTab] = useState('active'); // 'active', 'upcoming', 'completed'

    // Add Event State
    const [showAddModal, setShowAddModal] = useState(false);
    const [eventScope, setEventScope] = useState('all'); // 'all', 'team', 'employee'
    const [selectedTeams, setSelectedTeams] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [allEmployees, setAllEmployees] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [userTeamId, setUserTeamId] = useState(null);
    const [senderName, setSenderName] = useState('');

    // Form Data
    const [newEvent, setNewEvent] = useState({
        title: '',
        date: '',
        time: '',
        location: '',
        message: ''
    });

    // View Mode State
    const [viewMode, setViewMode] = useState('announcements'); // 'events' | 'announcements'
    const [createType, setCreateType] = useState('event'); // 'event' | 'announcement'

    const isAuthorized = ['executive', 'manager', 'team_lead', 'employee'].includes(userRole);
    const canManageEvents = ['executive', 'manager'].includes(userRole); // Only them can edit status
    const canMarkCompleted = isAuthorized; // All roles can mark as completed

    useEffect(() => {
        fetchData(true); // Initial load with spinner
    }, [userRole, userId, orgId]);

    const fetchData = async (showLoader = false) => {
        try {
            if (showLoader || announcements.length === 0) setLoading(true);

            // 1. Fetch User Profile to get team_id (still useful for UI context if needed, but RPC handles data)
            const { data: profile } = await supabase
                .from('profiles')
                .select('team_id, full_name')
                .eq('id', userId)
                .single();
            if (profile) {
                setUserTeamId(profile.team_id);
                setSenderName(profile.full_name || 'System Announcement');
            }

            // 2. Fetch Announcements via RPC
            // The RPC handles:
            // - Filtering by Org ID
            // - Filtering by Visibility (Team/Employee/All)
            // - Calculating Status (Future/Active/Completed)
            // - Sorting
            const { data, error } = await supabase.rpc('get_my_announcements');

            if (error) throw error;

            if (data) {
                // RPC returns 'status' calculated dynamically. 
                // We no longer need the client-side auto-update logic here.
                setAnnouncements(data);
            }
        } catch (err) {
            console.error('Error loading announcements:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic based on View Mode & Active Tab
    useEffect(() => {
        if (!announcements) return;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        let filtered = [];

        if (viewMode === 'announcements') {
            // ANNOUNCEMENTS MODE
            filtered = announcements.filter(item => {
                // Check if it's an announcement (location 'Broadcast' or specific marker)
                // We'll use location='Broadcast' or event_time='--:--' as convention for now
                if (item.event_for === 'all' && item.location === 'Broadcast') {
                    // It fits announcement profile
                } else if (item.location === 'Broadcast') {
                    // It fits
                } else {
                    // If user explicitly created as announcement, we store location 'Broadcast'
                    // If it's an old event, it likely has location.
                    // Filter STRICTLY by our convention: Location must be 'Broadcast' to be in this list.
                    // If user wants to see "All" events, they go to Events tab.
                    if (item.location !== 'Broadcast') return false;
                }

                // 24 Hour Expiration
                let createdTime = new Date(item.created_at || item.event_date); // Fallback if created_at needs to be fetched
                // If created_at is missing from select, we rely on event_date.
                // But for announcements, event_date is set to 'today' at creation.
                // So (now - event_date) should be small.

                // Better: Use `event_date` as the creation date for announcements.
                const eventDate = new Date(item.event_date);
                // Check if it's "today" or "yesterday"
                // Actually simply: Is it within 24h?
                // But `event_date` is just YYYY-MM-DD. It doesn't have time.
                // `event_time` has time.

                const dateTimeStr = `${item.event_date}T${item.event_time}`;
                const itemTime = new Date(dateTimeStr);

                if (isNaN(itemTime.getTime())) return false; // Invalid time

                const diffHours = (now - itemTime) / (1000 * 60 * 60);
                return diffHours <= 24 && diffHours >= 0; // Within last 24 hours
            });

            // Sort by newest
            filtered.sort((a, b) => {
                const dateA = new Date(`${a.event_date}T${a.event_time}`);
                const dateB = new Date(`${b.event_date}T${b.event_time}`);
                return dateB - dateA;
            });

        } else {
            // EVENTS MODE
            filtered = announcements.filter(event => {
                // Must NOT be an announcement (Location != Broadcast)
                if (event.location === 'Broadcast') return false;

                const eventDateStr = event.event_date;

                // Client-side status recalculation removed. We trust the RPC.
                const effectiveStatus = event.status;

                if (activeTab === 'upcoming') return effectiveStatus === 'future';
                if (activeTab === 'active') return effectiveStatus === 'active';
                if (activeTab === 'completed') return effectiveStatus === 'completed';
                return false;
            });

            filtered.sort((a, b) => {
                const dateA = new Date(`${a.event_date}T${a.event_time}`);
                const dateB = new Date(`${b.event_date}T${b.event_time}`);
                return activeTab === 'completed' ? dateB - dateA : dateA - dateB;
            });
        }

        setFilteredAnnouncements(filtered);
    }, [announcements, activeTab, viewMode]);


    // Fetch Participants for Selected Event
    useEffect(() => {
        const fetchParticipants = async () => {
            if (!selectedEvent) return;

            setEventParticipants({ loading: true, names: [], type: selectedEvent.event_for });

            try {
                if (selectedEvent.event_for === 'all') {
                    setEventParticipants({ loading: false, names: ['All Employees'], type: 'all' });
                    return;
                }

                if (selectedEvent.event_for === 'team') {
                    let teamIds = [];
                    try {
                        teamIds = typeof selectedEvent.teams === 'string' ? JSON.parse(selectedEvent.teams) : (selectedEvent.teams || []);
                    } catch (e) { console.error("Error parsing teams", e); }

                    if (teamIds.length > 0) {
                        const { data: teams } = await supabase
                            .from('projects')
                            .select('name')
                            .in('id', teamIds)
                            .eq('org_id', orgId);

                        if (teams) {
                            setEventParticipants({
                                loading: false,
                                names: teams.map(t => t.name),
                                type: 'team'
                            });
                        }
                    } else {
                        setEventParticipants({ loading: false, names: [], type: 'team' });
                    }
                } else if (selectedEvent.event_for === 'employee' || selectedEvent.event_for === 'specific') {
                    let empIds = [];
                    try {
                        empIds = typeof selectedEvent.employees === 'string' ? JSON.parse(selectedEvent.employees) : (selectedEvent.employees || []);
                    } catch (e) { console.error("Error parsing employees", e); }

                    if (empIds.length > 0) {
                        const { data: profiles } = await supabase
                            .from('profiles')
                            .select('full_name')
                            .in('id', empIds)
                            .eq('org_id', orgId);

                        if (profiles) {
                            setEventParticipants({
                                loading: false,
                                names: profiles.map(p => p.full_name),
                                type: 'employee'
                            });
                        }
                    } else {
                        setEventParticipants({ loading: false, names: [], type: 'employee' });
                    }
                }

            } catch (err) {
                console.error("Error fetching participants", err);
                setEventParticipants({ loading: false, names: ['Error loading participants'], type: 'error' });
            }
        };

        fetchParticipants();
    }, [selectedEvent]);


    // Fetch Options (Teams/Employees) for Add Modal
    useEffect(() => {
        const fetchOptions = async () => {
            if (!isAuthorized) return;
            setLoadingOptions(true);
            try {
                // Fetch Projects (instead of teams)
                const { data: teams } = await supabase.from('projects').select('id, name').eq('org_id', orgId);
                if (teams) setAllTeams(teams.map(t => ({ id: t.id, name: t.name })));

                // Fetch Employees
                const { data: emps } = await supabase.from('profiles').select('id, full_name, team_id').eq('org_id', orgId);
                if (emps) setAllEmployees(emps.map(e => ({ id: e.id, name: e.full_name, teamId: e.team_id })));

            } catch (e) {
                console.error("Error fetching options", e);
            } finally {
                setLoadingOptions(false);
            }
        };

        if (showAddModal) {
            fetchOptions();
        }
    }, [showAddModal, isAuthorized]);


    const handleAddEvent = async (e) => {
        e.preventDefault();
        try {
            // Apply defaults for Announcement
            let finalDate = newEvent.date;
            let finalTime = newEvent.time;
            let finalLocation = newEvent.location;

            if (createType === 'announcement') {
                const today = new Date();
                finalDate = today.toISOString().split('T')[0];
                finalTime = today.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                finalLocation = 'Broadcast';;
            }

            // Call RPC: create_announcement_event
            const payload = {
                p_title: newEvent.title,
                p_date: finalDate,
                p_time: finalTime,
                p_location: finalLocation,
                p_message: newEvent.message,
                p_event_for: eventScope === 'my_team' ? 'employee' : eventScope,
                p_target_teams: eventScope === 'team' ? selectedTeams : [], // JSON array
                p_target_employees: (eventScope === 'employee' || eventScope === 'my_team') ? selectedEmployees : [] // JSON array
            };

            const { data, error } = await supabase.rpc('create_announcement_event', payload);

            if (error) throw error;

            alert(createType === 'announcement' ? 'Announcement posted!' : 'Event added successfully!');
            setShowAddModal(false);
            setNewEvent({ title: '', date: '', time: '', location: '', message: '' });
            setEventScope('all');
            setSelectedTeams([]);
            setSelectedEmployees([]);
            fetchData(); // Refresh list via RPC

        } catch (err) {
            console.error("Error adding event:", err);
            alert("Failed to add event: " + err.message);
        }
    };

    const handleUpdateStatus = async (e, eventId, newStatus) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to mark this event as ${newStatus}?`)) return;

        try {
            // Call RPC: update_announcement_status
            const { error } = await supabase.rpc('update_announcement_status', {
                p_announcement_id: eventId,
                p_status: newStatus
            });

            if (error) throw error;

            // Update local state immediately for better UX
            setAnnouncements(prev => prev.map(ev =>
                ev.id === eventId ? { ...ev, status: newStatus } : ev
            ));

            if (selectedEvent && selectedEvent.id === eventId) {
                setSelectedEvent(prev => ({ ...prev, status: newStatus }));
            }

            // Close modal and switch to completed tab when marking as completed
            if (newStatus === 'completed') {
                setSelectedEvent(null);
                setActiveTab('completed');
            }

        } catch (err) {
            console.error("Error updating status:", err);
            alert("Failed to update status: " + err.message);
        }
    };

    const handleDeleteEvent = async (e, eventId) => {
        if (e) e.stopPropagation();
        if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;

        try {
            // Call RPC: delete_announcement
            const { error } = await supabase.rpc('delete_announcement', { p_announcement_id: eventId });

            if (error) throw error;

            // Update local state
            setAnnouncements(prev => prev.filter(ev => ev.id !== eventId));

            // If the deleted event was open in modal, close it
            if (selectedEvent && selectedEvent.id === eventId) {
                setSelectedEvent(null);
            }

            alert('Event deleted successfully');
        } catch (err) {
            console.error("Error deleting event:", err);
            alert("Failed to delete event: " + err.message);
        }
    };

    if (loading && announcements.length === 0) {
        return (
            <div style={{
                height: '60vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '24px',
                color: '#64748b'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #f1f5f9',
                    borderTop: '3px solid #0f172a',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ fontWeight: '600', fontSize: '1rem', letterSpacing: '0.02em' }}>Fetching the latest updates...</p>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes modalSlideUp {
                        from { transform: translateY(20px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative' }}>
            {/* Compact Header - Matching Leave Requests Style */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '20px 28px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                marginBottom: '20px'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>/</span>
                            <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Announcements</span>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                            Announcements & Events
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '400' }}>
                            Stay informed with the latest organizational news, upcoming events, and important broadcasts.
                        </p>
                    </div>

                    {isAuthorized && (
                        <button
                            onClick={() => {
                                setCreateType(viewMode === 'announcements' ? 'announcement' : 'event');
                                setShowAddModal(true);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
                            }}
                        >
                            <Plus size={16} />
                            {viewMode === 'announcements' ? 'Post Announcement' : 'Add Event'}
                        </button>
                    )}
                </div>
            </div>

            {/* Toggles and Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
                {/* View Mode Toggle */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'white', padding: '6px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                    <button
                        onClick={() => setViewMode('events')}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: viewMode === 'events' ? '#0f172a' : 'transparent',
                            color: viewMode === 'events' ? 'white' : '#64748b',
                            fontWeight: '800',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Events / Calendar
                    </button>
                    <button
                        onClick={() => setViewMode('announcements')}
                        style={{
                            padding: '8px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: viewMode === 'announcements' ? '#0f172a' : 'transparent',
                            color: viewMode === 'announcements' ? 'white' : '#64748b',
                            fontWeight: '800',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Announcements
                    </button>
                </div>

                {/* Vertical Divider */}
                {viewMode === 'events' && <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>}

                {/* Sub-Tabs (Only visible for Events) */}
                {viewMode === 'events' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                            { id: 'active', label: 'Active Now', icon: CheckCircle2, color: '#10b981' },
                            { id: 'upcoming', label: 'Future', icon: Calendar, color: '#3b82f6' },
                            { id: 'completed', label: 'Completed', icon: Archive, color: '#64748b' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    border: activeTab === tab.id ? `1px solid ${tab.color}30` : '1px solid transparent',
                                    backgroundColor: activeTab === tab.id ? `${tab.color}08` : 'transparent',
                                    color: activeTab === tab.id ? tab.color : '#64748b',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: tab.color }}></div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {filteredAnnouncements.length === 0 ? (
                    <div style={{
                        gridColumn: '1 / -1',
                        padding: '80px 40px',
                        textAlign: 'center',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px',
                        minHeight: '350px'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '8px'
                        }}>
                            <AlertCircle size={32} color="#94a3b8" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                                No {activeTab} {viewMode}
                            </h3>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                                {activeTab === 'active' ? 'Everything is quiet today. No events are currently happening.' :
                                    activeTab === 'upcoming' ? 'Your calendar is clear. Check back later for new scheduled events.' : 'No completed events found in the history.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    filteredAnnouncements.map(event => (
                        <div
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '24px',
                                padding: '32px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.02), 0 4px 6px -2px rgba(0, 0, 0, 0.01)',
                                border: '1px solid #f1f5f9',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px',
                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.boxShadow = '0 25px 30px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.02), 0 4px 6px -2px rgba(0, 0, 0, 0.01)';
                                e.currentTarget.style.borderColor = '#f1f5f9';
                            }}
                        >
                            {/* Accent Bar */}
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                top: '32px',
                                bottom: '32px',
                                width: '4px',
                                borderRadius: '0 4px 4px 0',
                                backgroundColor: viewMode === 'announcements'
                                    ? '#f59e0b'
                                    : activeTab === 'active' ? '#10b981' : activeTab === 'upcoming' ? '#3b82f6' : '#cbd5e1'
                            }}></div>

                            {/* Header: Title and Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.65rem',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            backgroundColor: viewMode === 'announcements'
                                                ? '#f59e0b15'
                                                : activeTab === 'active' ? '#10b98115' : activeTab === 'upcoming' ? '#3b82f615' : '#f1f5f9',
                                            color: viewMode === 'announcements'
                                                ? '#f59e0b'
                                                : activeTab === 'active' ? '#10b981' : activeTab === 'upcoming' ? '#3b82f6' : '#64748b',
                                        }}>
                                            {viewMode === 'announcements' ? 'Broadcast' : activeTab === 'active' ? 'Active now' : activeTab === 'upcoming' ? 'Scheduled' : 'Past Event'}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{event.title}</h3>
                                </div>
                                {canManageEvents && (
                                    <button
                                        onClick={(e) => handleDeleteEvent(e, event.id)}
                                        style={{
                                            background: '#f8fafc',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#94a3b8',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '10px',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Content Info */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#3b82f610', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Calendar size={14} color="#3b82f6" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Date</span>
                                        <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>
                                            {new Date(event.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f59e0b10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Clock size={14} color="#f59e0b" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Time</span>
                                        <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>{event.event_time}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ef444410', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <MapPin size={14} color="#ef4444" />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Location</span>
                                        <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>{event.location}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Audience */}
                            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px dashed #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px' }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {event.event_for === 'all' ? <Users size={12} color="#94a3b8" /> : <User size={12} color="#94a3b8" />}
                                </div>
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600' }}>
                                    {event.event_for === 'all' ? 'All employees' : (event.event_for === 'team' ? 'Select departments' : 'Private audience')}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedEvent && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                    padding: '24px'
                }} onClick={() => setSelectedEvent(null)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '32px',
                            width: '560px',
                            maxWidth: '100%',
                            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.25)',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        {/* Status Brand Bar */}
                        <div style={{
                            height: '8px',
                            background: viewMode === 'announcements'
                                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                : activeTab === 'active' ? 'linear-gradient(90deg, #10b981, #34d399)' : activeTab === 'upcoming' ? 'linear-gradient(90deg, #3b82f6, #60a5fa)' : '#cbd5e1',
                            width: '100%'
                        }}></div>

                        <div style={{ padding: '40px', overflowY: 'auto', maxHeight: '85vh' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '8px',
                                            fontSize: '0.7rem',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            backgroundColor: '#f8fafc',
                                            color: '#64748b',
                                            border: '1px solid #e2e8f0'
                                        }}>
                                            {selectedEvent.location === 'Broadcast' ? 'Official Announcement' : 'Company Event'}
                                        </span>
                                    </div>
                                    <h2 style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>{selectedEvent.title}</h2>
                                </div>
                                <button
                                    onClick={() => setSelectedEvent(null)}
                                    style={{
                                        background: '#f1f5f9', border: 'none', borderRadius: '12px',
                                        width: '40px', height: '40px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', color: '#64748b', transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e1e7ef'; e.currentTarget.style.color = '#0f172a'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '20px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#3b82f610', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Calendar size={18} color="#3b82f6" />
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Date</span>
                                        <span style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.95rem' }}>
                                            {new Date(selectedEvent.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '20px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f59e0b10', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Clock size={18} color="#f59e0b" />
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Time</span>
                                        <span style={{ color: '#1e293b', fontWeight: '700', fontSize: '0.95rem' }}>{selectedEvent.event_time}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#ef444410', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                        <MapPin size={14} color="#ef4444" />
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Location</span>
                                        <span style={{ color: '#334155', fontWeight: '600' }}>{selectedEvent.location}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#64748b10', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                        <Users size={14} color="#64748b" />
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Intended For</span>
                                        <span style={{ color: '#334155', fontWeight: '600' }}>
                                            {selectedEvent.event_for === 'all'
                                                ? 'All Organization Members'
                                                : (selectedEvent.event_for === 'team' ? 'Selected Departments' : 'Specific Target Audience')}
                                        </span>
                                        {eventParticipants.loading ? (
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>Updating attendee list...</p>
                                        ) : (
                                            eventParticipants.names.length > 0 && selectedEvent.event_for !== 'all' && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                                    {eventParticipants.names.map((name, idx) => (
                                                        <span key={idx} style={{
                                                            fontSize: '0.75rem',
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#475569',
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            fontWeight: '600'
                                                        }}>
                                                            {name}
                                                        </span>
                                                    ))}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                {selectedEvent.message && (
                                    <div style={{ marginTop: '12px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Message</span>
                                        <div style={{
                                            color: '#475569',
                                            lineHeight: 1.7,
                                            whiteSpace: 'pre-wrap',
                                            fontSize: '1.05rem',
                                            backgroundColor: '#f8fafc',
                                            padding: '24px',
                                            borderRadius: '20px',
                                            border: '1px solid #f1f5f9'
                                        }}>
                                            {selectedEvent.message}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {canManageEvents && (
                                        <button
                                            onClick={(e) => handleDeleteEvent(e, selectedEvent.id)}
                                            style={{
                                                padding: '12px 20px', borderRadius: '14px', border: '1px solid #fee2e2',
                                                backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: '700', fontSize: '0.85rem',
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                        >
                                            <Trash2 size={16} /> Delete Event
                                        </button>
                                    )}
                                    {canMarkCompleted && (activeTab === 'active' || activeTab === 'upcoming') && selectedEvent.status !== 'completed' && (
                                        <button
                                            onClick={(e) => handleUpdateStatus(e, selectedEvent.id, 'completed')}
                                            style={{
                                                padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0',
                                                backgroundColor: 'white', color: '#64748b', fontWeight: '700', fontSize: '0.85rem',
                                                cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
                                        >
                                            Complete Event
                                        </button>
                                    )}
                                </div>

                                <button
                                    onClick={() => setSelectedEvent(null)}
                                    style={{
                                        padding: '14px 32px',
                                        backgroundColor: '#0f172a',
                                        color: 'white',
                                        fontWeight: '800',
                                        borderRadius: '16px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.2)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = '#1e293b'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = '#0f172a'; }}
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Event Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                    padding: '24px'
                }} onClick={() => setShowAddModal(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '32px',
                            width: '520px',
                            maxWidth: '100%',
                            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.25)',
                            animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ padding: '40px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>{createType === 'announcement' ? 'New Announcement' : 'Add Event'}</h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', marginTop: '8px' }}>Share important updates with the team.</p>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    style={{
                                        background: '#f1f5f9', border: 'none', borderRadius: '12px',
                                        width: '40px', height: '40px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', color: '#64748b'
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {/* Type Selector */}
                                <div style={{ backgroundColor: '#f8fafc', padding: '6px', borderRadius: '16px', display: 'flex', gap: '4px', border: '1px solid #e2e8f0' }}>
                                    <button
                                        type="button"
                                        onClick={() => setCreateType('event')}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                                            backgroundColor: createType === 'event' ? '#0f172a' : 'transparent',
                                            color: createType === 'event' ? 'white' : '#64748b',
                                            fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        Event Invitation
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCreateType('announcement')}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                                            backgroundColor: createType === 'announcement' ? '#0f172a' : 'transparent',
                                            color: createType === 'announcement' ? 'white' : '#64748b',
                                            fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        Direct Announcement
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>
                                        {createType === 'announcement' ? 'Headline' : 'Event Title'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={createType === 'announcement' ? "e.g. Quarterly Review Meeting" : "e.g. Team Building Workshop"}
                                        value={newEvent.title}
                                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                        required
                                        style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', width: "100%", background: '#f8fafc', fontWeight: '600', color: '#1e293b' }}
                                    />
                                </div>

                                {/* Scope Selection */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Target Audience</label>

                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                        {['executive', 'manager'].includes(userRole) ? (
                                            /* Executive / Manager Options */
                                            <>
                                                {[
                                                    { id: 'all', label: 'All Employees', icon: Users },
                                                    { id: 'team', label: 'Specific Projects', icon: User },
                                                    { id: 'employee', label: 'Specific People', icon: User }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setEventScope(opt.id);
                                                            setSelectedTeams([]);
                                                            setSelectedEmployees([]);
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', border: eventScope === opt.id ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                                            backgroundColor: eventScope === opt.id ? '#3b82f608' : 'white',
                                                            color: eventScope === opt.id ? '#3b82f6' : '#64748b',
                                                            fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <opt.icon size={16} />
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </>
                                        ) : (
                                            /* Team Lead / Employee Options */
                                            <>
                                                {[
                                                    { id: 'my_team', label: 'My Project', icon: Users },
                                                    { id: 'employee', label: 'All Employees', icon: User }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setEventScope(opt.id);
                                                            setSelectedEmployees([]);
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', border: eventScope === opt.id ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                                            backgroundColor: eventScope === opt.id ? '#3b82f608' : 'white',
                                                            color: eventScope === opt.id ? '#3b82f6' : '#64748b',
                                                            fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <opt.icon size={16} />
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    {/* Exec/Manager Specific Content */}
                                    {['executive', 'manager'].includes(userRole) && (
                                        <>
                                            {eventScope === 'team' && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '120px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px', background: '#f8fafc' }}>
                                                    {allTeams.length > 0 ? allTeams.map(team => (
                                                        <label key={team.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedTeams.includes(team.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedTeams([...selectedTeams, team.id]);
                                                                    else setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                                                                }}
                                                                style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                                                            />
                                                            {team.name}
                                                        </label>
                                                    )) : <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No projects found</p>}
                                                </div>
                                            )}
                                            {eventScope === 'employee' && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '120px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px', background: '#f8fafc' }}>
                                                    {allEmployees.length > 0 ? allEmployees.map(emp => (
                                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedEmployees.includes(emp.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                                                                    else setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                                                                }}
                                                                style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                                                            />
                                                            {emp.name}
                                                        </label>
                                                    )) : <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No employees found</p>}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Team Lead / Employee Specific Content */}
                                    {!['executive', 'manager'].includes(userRole) && (
                                        <>
                                            {eventScope === 'my_team' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px', background: '#f8fafc' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', color: '#0f172a' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                allEmployees.filter(e => e.teamId === userTeamId).length > 0 &&
                                                                selectedEmployees.length === allEmployees.filter(e => e.teamId === userTeamId).length
                                                            }
                                                            onChange={(e) => {
                                                                const myMembers = allEmployees.filter(e => e.teamId === userTeamId);
                                                                if (e.target.checked) setSelectedEmployees(myMembers.map(m => m.id));
                                                                else setSelectedEmployees([]);
                                                            }}
                                                            style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                                                        />
                                                        Select All
                                                    </label>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', marginTop: '4px' }}>
                                                        {allEmployees.filter(e => e.teamId === userTeamId).map(emp => (
                                                            <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedEmployees.includes(emp.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                                                                        else setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                                                                    }}
                                                                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                                                                />
                                                                {emp.name}
                                                            </label>
                                                        ))}
                                                    </div>
                                                    {allEmployees.filter(e => e.teamId === userTeamId).length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No team members found</p>}
                                                </div>
                                            )}

                                            {eventScope === 'employee' && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', maxHeight: '120px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '16px', background: '#f8fafc' }}>
                                                    {allEmployees.length > 0 ? allEmployees.map(emp => (
                                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedEmployees.includes(emp.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.id]);
                                                                    else setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                                                                }}
                                                                style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                                                            />
                                                            {emp.name}
                                                        </label>
                                                    )) : <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No employees found</p>}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {createType === 'event' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Date</label>
                                            <input
                                                type="date"
                                                required={createType === 'event'}
                                                value={newEvent.date}
                                                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                                                style={{ padding: '14px 18px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc', width: "100%", fontWeight: '600' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Time</label>
                                            <input
                                                type="time"
                                                required={createType === 'event'}
                                                value={newEvent.time}
                                                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                                                style={{ padding: '14px 18px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc', width: "100%", fontWeight: '600' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {createType === 'event' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Location / Meeting Link</label>
                                        <input
                                            type="text"
                                            placeholder="Physical location or digital workspace"
                                            required={createType === 'event'}
                                            value={newEvent.location}
                                            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                                            style={{ padding: '14px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc', width: "100%", fontWeight: '600' }}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Additional Context</label>
                                    <textarea
                                        placeholder="Add any specific details or instructions here..."
                                        rows="3"
                                        value={newEvent.message}
                                        onChange={(e) => setNewEvent({ ...newEvent, message: e.target.value })}
                                        style={{ padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '1rem', background: '#f8fafc', width: "100%", resize: 'none', fontWeight: '600', fontFamily: 'inherit' }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    style={{
                                        backgroundColor: '#0f172a',
                                        color: '#fff',
                                        padding: '16px',
                                        borderRadius: '16px',
                                        fontWeight: '900',
                                        fontSize: '1rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        border: 'none',
                                        cursor: 'pointer',
                                        marginTop: '12px',
                                        boxShadow: '0 15px 30px -5px rgba(15, 23, 42, 0.25)',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(15, 23, 42, 0.35)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    Publish {createType === 'announcement' ? 'Broadcast' : 'Event'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnnouncementsPage;
