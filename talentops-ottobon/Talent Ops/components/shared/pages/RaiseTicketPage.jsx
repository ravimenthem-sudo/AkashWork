import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
    Ticket,
    Send,
    AlertCircle,
    CheckCircle2,
    Paperclip,
    X,
    Loader2,
    Lightbulb,
    Bug,
    Clock,
    MessageSquare,
    HelpCircle,
    Zap,
    Shield,
    ChevronRight,
    Eye
} from 'lucide-react';

const RaiseTicketPage = () => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [files, setFiles] = useState([]);
    const [ticketType, setTicketType] = useState('issue');
    const [recentTickets, setRecentTickets] = useState([]);
    const [allTickets, setAllTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [reviewTab, setReviewTab] = useState('open_issues'); // 'open_issues', 'enhancements', 'closed'
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [userProfile, setUserProfile] = useState(null);

    const [formData, setFormData] = useState({
        subject: '',
        category: 'it_support',
        priority: 'medium',
        description: ''
    });

    const issueCategories = [
        { value: 'it_support', label: 'IT Support', icon: '💻' },
        { value: 'hr_support', label: 'HR Support', icon: '👥' },
        { value: 'operations', label: 'Operations', icon: '⚙️' },
        { value: 'finance', label: 'Finance', icon: '💰' },
        { value: 'facilities', label: 'Facilities', icon: '🏢' },
        { value: 'other', label: 'Other', icon: '📋' }
    ];

    const enhancementCategories = [
        { value: 'feature_request', label: 'New Feature', icon: '✨' },
        { value: 'ux_improvement', label: 'UX/UI Improvement', icon: '🎨' },
        { value: 'process_opt', label: 'Process Optimization', icon: '🔄' },
        { value: 'new_tool', label: 'New Tool Request', icon: '🔧' },
        { value: 'other', label: 'Other', icon: '💡' }
    ];

    const priorities = [
        { value: 'low', label: 'Low', color: '#10b981', bg: '#ecfdf5' },
        { value: 'medium', label: 'Medium', color: '#f59e0b', bg: '#fffbeb' },
        { value: 'high', label: 'High', color: '#ef4444', bg: '#fef2f2' }
    ];

    // Fetch user profile for role and org_id
    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('role, org_id')
                .eq('id', user.id)
                .single();

            if (data) setUserProfile(data);
        };
        fetchProfile();
    }, []);

    // Fetch recent tickets
    useEffect(() => {
        const fetchRecentTickets = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (data) setRecentTickets(data);
        };

        fetchRecentTickets();
    }, [success, refreshTrigger]);

    // Fetch all tickets for review tab
    useEffect(() => {
        const fetchAllTickets = async () => {
            if (ticketType !== 'review' || !userProfile) return;
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                let query = supabase
                    .from('tickets')
                    .select('*')
                    .order('created_at', { ascending: false });

                // If executive or manager, show all tickets for the org
                if (['executive', 'manager'].includes(userProfile.role?.toLowerCase())) {
                    if (userProfile.org_id) {
                        query = query.eq('org_id', userProfile.org_id);
                    } else {
                        query = query.eq('user_id', user.id);
                    }
                } else {
                    query = query.eq('user_id', user.id);
                }

                const { data, error } = await query;

                if (error) throw error;
                if (data) setAllTickets(data);
            } catch (error) {
                console.error('Error fetching all tickets:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllTickets();
    }, [ticketType, refreshTrigger, userProfile]);

    const handleCloseTicket = async (ticketId) => {
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status: 'resolved' }) // Using 'resolved' as the 'closed' equivalent based on getStatusColor
                .eq('id', ticketId);

            if (error) throw error;

            setRefreshTrigger(prev => prev + 1);
            if (selectedTicket && selectedTicket.id === ticketId) {
                setSelectedTicket(prev => ({ ...prev, status: 'resolved' }));
            }
            alert('Ticket closed successfully');
        } catch (error) {
            console.error('Error closing ticket:', error);
            alert('Failed to close ticket');
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            setFiles([...files, ...Array.from(e.target.files)]);
        }
    };

    const removeFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('You must be logged in to submit a ticket.');
                setLoading(false);
                return;
            }

            // 1. Fetch user profile for org_id
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', user.id)
                .single();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
            }

            // 2. Upload files to storage
            const uploadedUrls = [];
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('ticket-attachments') // Corrected bucket name
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    continue;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('ticket-attachments') // Corrected bucket name
                    .getPublicUrl(filePath);

                if (publicUrl) uploadedUrls.push(publicUrl);
            }

            // 3. Prepare payload and insert
            const payload = {
                user_id: user.id,
                org_id: profile?.org_id,
                type: ticketType,
                category: formData.category,
                priority: formData.priority,
                subject: formData.subject,
                description: formData.description,
                status: ticketType === 'issue' ? 'open' : 'proposed',
                attachments: uploadedUrls
            };

            const { error } = await supabase
                .from('tickets')
                .insert([payload]);

            if (error) throw error;

            setSuccess(true);
            setFormData({
                subject: '',
                category: ticketType === 'issue' ? 'it_support' : 'feature_request',
                priority: 'medium',
                description: ''
            });
            setFiles([]);

            setTimeout(() => setSuccess(false), 4000);

        } catch (error) {
            console.error('Error submitting ticket:', error);
            alert(`Failed to submit ticket: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleTicketType = (type) => {
        setTicketType(type);
        setFormData(prev => ({
            ...prev,
            category: type === 'issue' ? 'it_support' : 'feature_request'
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return { bg: '#fef3c7', color: '#d97706' };
            case 'in_progress': return { bg: '#dbeafe', color: '#2563eb' };
            case 'resolved': return { bg: '#dcfce7', color: '#16a34a' };
            case 'proposed': return { bg: '#f3e8ff', color: '#9333ea' };
            default: return { bg: '#f1f5f9', color: '#64748b' };
        }
    };

    const quickActions = [
        { icon: HelpCircle, label: 'FAQs', desc: 'Find quick answers', color: '#3b82f6' },
        { icon: MessageSquare, label: 'Live Chat', desc: 'Talk to support', color: '#10b981' },
        { icon: Clock, label: 'Status', desc: 'Track tickets', color: '#f59e0b' }
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            {/* Compact Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '16px',
                padding: '20px 28px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                marginBottom: '24px'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>/</span>
                            <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>Support Center</span>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.3 }}>
                            {ticketType === 'issue' ? 'Report an Issue' : 'Propose Enhancement'}
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: '400' }}>
                            {ticketType === 'issue'
                                ? 'Submit a support request for bugs, errors, or operational issues.'
                                : 'Have an idea? Suggest improvements or new features for the platform.'}
                        </p>
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(12px)',
                        padding: '10px 14px',
                        borderRadius: '14px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        {quickActions.map((action, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backgroundColor: 'rgba(255,255,255,0.05)'
                            }}>
                                <action.icon size={18} color={action.color} />
                                <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'white' }}>{action.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
                {/* Left Column - Form */}
                <div>
                    {/* Ticket Type Toggle */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'white', padding: '6px', borderRadius: '14px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
                        <button
                            onClick={() => toggleTicketType('issue')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: ticketType === 'issue' ? '#0f172a' : 'transparent',
                                color: ticketType === 'issue' ? 'white' : '#64748b',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Bug size={16} />
                            Raise Issue
                        </button>
                        <button
                            onClick={() => toggleTicketType('enhancement')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: ticketType === 'enhancement' ? '#0f172a' : 'transparent',
                                color: ticketType === 'enhancement' ? 'white' : '#64748b',
                                fontWeight: '600',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Lightbulb size={16} />
                            Enhancement
                        </button>
                        {['executive', 'manager'].includes(userProfile?.role?.toLowerCase()) && (
                            <button
                                onClick={() => toggleTicketType('review')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    backgroundColor: ticketType === 'review' ? '#0f172a' : 'transparent',
                                    color: ticketType === 'review' ? 'white' : '#64748b',
                                    fontWeight: '600',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Clock size={16} />
                                Review Tickets
                            </button>
                        )}
                    </div>

                    {/* Form Card */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '28px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
                    }}>
                        {success ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                                <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)' }}>
                                    <CheckCircle2 size={36} color="white" />
                                </div>
                                <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                                    {ticketType === 'issue' ? 'Issue Reported Successfully!' : ticketType === 'enhancement' ? 'Enhancement Proposed!' : 'Action Completed!'}
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' }}>
                                    Your {ticketType} has been recorded. Our team will review it shortly.
                                </p>
                                <button
                                    onClick={() => setSuccess(false)}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#0f172a',
                                        color: 'white',
                                        borderRadius: '10px',
                                        border: 'none',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Submit Another
                                </button>
                            </div>
                        ) : ticketType === 'review' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Review Sub-tabs */}
                                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px', width: 'fit-content' }}>
                                    {[
                                        { id: 'open_issues', label: 'Open Issues' },
                                        { id: 'enhancements', label: 'Enhancements' },
                                        { id: 'closed', label: 'Closed' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setReviewTab(tab.id)}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: reviewTab === tab.id ? 'white' : 'transparent',
                                                color: reviewTab === tab.id ? '#0f172a' : '#64748b',
                                                fontWeight: '600',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                boxShadow: reviewTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                                        {reviewTab === 'open_issues' ? 'Active Issues' : reviewTab === 'enhancements' ? 'Feature Requests' : 'Ticket History'}
                                    </h3>
                                    <button
                                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                                        style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
                                    >
                                        Refresh
                                    </button>
                                </div>

                                {loading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} color="#3b82f6" />
                                    </div>
                                ) : (
                                    (() => {
                                        const filteredTickets = allTickets.filter(ticket => {
                                            if (reviewTab === 'open_issues') return ticket.type === 'issue' && !['resolved', 'closed'].includes(ticket.status);
                                            if (reviewTab === 'enhancements') return ticket.type === 'enhancement' && !['resolved', 'closed'].includes(ticket.status);
                                            if (reviewTab === 'closed') return ['resolved', 'closed'].includes(ticket.status);
                                            return true;
                                        });

                                        return filteredTickets.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', overflowY: 'auto' }}>
                                                {filteredTickets.map((ticket) => {
                                                    const statusStyle = getStatusColor(ticket.status);
                                                    return (
                                                        <div key={ticket.id} style={{
                                                            padding: '20px',
                                                            borderRadius: '16px',
                                                            border: '1px solid #e2e8f0',
                                                            backgroundColor: '#f8fafc',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            transition: 'all 0.2s'
                                                        }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <span style={{
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: '700',
                                                                        padding: '4px 8px',
                                                                        borderRadius: '6px',
                                                                        backgroundColor: statusStyle.bg,
                                                                        color: statusStyle.color,
                                                                        textTransform: 'uppercase'
                                                                    }}>{ticket.status?.replace('_', ' ')}</span>
                                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>#{ticket.id.slice(0, 8)}</span>
                                                                    {/* Show type badge if in closed tab to differentiate */}
                                                                    {reviewTab === 'closed' && (
                                                                        <span style={{
                                                                            fontSize: '0.65rem',
                                                                            fontWeight: '600',
                                                                            padding: '2px 6px',
                                                                            borderRadius: '4px',
                                                                            backgroundColor: '#e2e8f0',
                                                                            color: '#64748b',
                                                                            textTransform: 'capitalize'
                                                                        }}>
                                                                            {ticket.type}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>{ticket.subject}</h4>
                                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Submitted on {new Date(ticket.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => { setSelectedTicket(ticket); setShowTicketModal(true); }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    padding: '10px 18px',
                                                                    borderRadius: '10px',
                                                                    border: '1px solid #e2e8f0',
                                                                    backgroundColor: 'white',
                                                                    color: '#0f172a',
                                                                    fontWeight: '600',
                                                                    fontSize: '0.85rem',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                            >
                                                                <Eye size={16} />
                                                                View Details
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                                                <div style={{ width: '56px', height: '56px', backgroundColor: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                                    <Ticket size={24} color="#94a3b8" />
                                                </div>
                                                <p style={{ color: '#0f172a', fontWeight: '700', marginBottom: '4px' }}>No tickets found</p>
                                                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                                    {reviewTab === 'open_issues' ? 'No active issues at the moment.' :
                                                        reviewTab === 'enhancements' ? 'No feature requests pending.' :
                                                            'No closed tickets history.'}
                                                </p>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                {/* Category Selection */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>Category</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                        {(ticketType === 'issue' ? issueCategories : enhancementCategories).map(cat => (
                                            <button
                                                key={cat.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, category: cat.value })}
                                                style={{
                                                    padding: '14px',
                                                    borderRadius: '12px',
                                                    border: formData.category === cat.value ? '2px solid #0f172a' : '1px solid #e2e8f0',
                                                    backgroundColor: formData.category === cat.value ? '#f8fafc' : 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: formData.category === cat.value ? '#0f172a' : '#64748b' }}>{cat.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Priority (only for issues) */}
                                {ticketType === 'issue' && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>Priority</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {priorities.map(p => (
                                                <button
                                                    key={p.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, priority: p.value })}
                                                    style={{
                                                        flex: 1,
                                                        padding: '12px',
                                                        borderRadius: '10px',
                                                        border: formData.priority === p.value ? `2px solid ${p.color}` : '1px solid #e2e8f0',
                                                        backgroundColor: formData.priority === p.value ? p.bg : 'white',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.color }}></div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: formData.priority === p.value ? p.color : '#64748b' }}>{p.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Subject */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Subject</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        placeholder={ticketType === 'issue' ? 'Brief summary of the issue' : 'Title of your enhancement idea'}
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: '10px',
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: '#f8fafc',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    />
                                </div>

                                {/* Description */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Description</label>
                                    <textarea
                                        required
                                        rows="5"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder={ticketType === 'issue' ? 'Please describe the issue in detail...' : 'Describe the enhancement and its benefits...'}
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            borderRadius: '10px',
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: '#f8fafc',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            resize: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    />
                                </div>

                                {/* Attachments */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Attachments (Optional)</label>
                                    <div style={{
                                        border: '2px dashed #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '24px',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                            id="file-upload"
                                        />
                                        <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                                            <div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                                <Paperclip size={22} color="#64748b" />
                                            </div>
                                            <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Click to upload files</p>
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Images, PDF, or Documents (Max 10MB)</p>
                                        </label>
                                    </div>

                                    {files.length > 0 && (
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                                            {files.map((file, index) => (
                                                <div key={index} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '8px 12px',
                                                    backgroundColor: '#f1f5f9',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                    color: '#374151'
                                                }}>
                                                    <span>{file.name}</span>
                                                    <button type="button" onClick={() => removeFile(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                                                        <X size={14} color="#94a3b8" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ subject: '', category: ticketType === 'issue' ? 'it_support' : 'feature_request', priority: 'medium', description: '' })}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            border: '1px solid #e2e8f0',
                                            backgroundColor: 'white',
                                            color: '#64748b',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        Reset
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '12px 28px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: ticketType === 'issue' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                            color: 'white',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            boxShadow: ticketType === 'issue' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : '0 4px 12px rgba(139, 92, 246, 0.3)',
                                            transition: 'all 0.2s',
                                            opacity: loading ? 0.7 : 1
                                        }}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                Submit {ticketType === 'issue' ? 'Ticket' : 'Proposal'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Right Column - Info & Recent Tickets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Quick Stats */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '20px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
                    }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={18} color="#3b82f6" />
                            Support Overview
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Avg. Response Time</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>~2 hours</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Resolution Rate</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#10b981' }}>96%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Active Tickets</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f59e0b' }}>{recentTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Tickets */}
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '20px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
                    }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={18} color="#f59e0b" />
                            Recent Tickets
                        </h3>
                        {recentTickets.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {recentTickets.map((ticket, idx) => {
                                    const statusStyle = getStatusColor(ticket.status);
                                    return (
                                        <div key={idx} style={{
                                            padding: '14px',
                                            backgroundColor: '#f8fafc',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', flex: 1, lineHeight: 1.4 }}>{ticket.subject || 'No subject'}</p>
                                                <ChevronRight size={16} color="#94a3b8" />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: '600',
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: statusStyle.bg,
                                                    color: statusStyle.color,
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {ticket.status?.replace('_', ' ')}
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    {new Date(ticket.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '24px' }}>
                                <div style={{ width: '48px', height: '48px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                    <Ticket size={22} color="#94a3b8" />
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No tickets yet</p>
                            </div>
                        )}
                    </div>

                    {/* Tips Card */}
                    <div style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                        borderRadius: '16px',
                        padding: '20px',
                        color: 'white'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <Zap size={18} color="#fbbf24" />
                            <h3 style={{ fontSize: '0.95rem', fontWeight: '700' }}>Pro Tips</h3>
                        </div>
                        <ul style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, paddingLeft: '16px' }}>
                            <li>Be specific about the issue</li>
                            <li>Include steps to reproduce</li>
                            <li>Attach relevant screenshots</li>
                            <li>Mention urgency level</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Ticket Detail Modal */}
            {showTicketModal && selectedTicket && (
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
                        borderRadius: '24px',
                        width: '90%',
                        maxWidth: '600px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '32px',
                        position: 'relative',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
                    }}>
                        <button
                            onClick={() => setShowTicketModal(false)}
                            style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    padding: '4px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: getStatusColor(selectedTicket.status).bg,
                                    color: getStatusColor(selectedTicket.status).color,
                                    textTransform: 'uppercase'
                                }}>{selectedTicket.status?.replace('_', ' ')}</span>
                                <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Ticket #{selectedTicket.id.slice(0, 8)}</span>
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.3 }}>{selectedTicket.subject}</h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '16px' }}>
                            <div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Category</p>
                                <p style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' }}>{selectedTicket.category?.replace('_', ' ')}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Priority</p>
                                <p style={{ fontSize: '0.95rem', fontWeight: '700', color: selectedTicket.priority === 'high' ? '#ef4444' : '#0f172a', textTransform: 'capitalize' }}>{selectedTicket.priority}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Submitted</p>
                                <p style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>{new Date(selectedTicket.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>Type</p>
                                <p style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' }}>{selectedTicket.type}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase' }}>Description</p>
                            <div style={{ backgroundColor: '#f1f5f9', padding: '20px', borderRadius: '16px', fontSize: '0.95rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {selectedTicket.description}
                            </div>
                        </div>

                        {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                            <div style={{ marginBottom: '32px' }}>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase' }}>Attachments</p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {selectedTicket.attachments.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', borderRadius: '8px', fontSize: '0.85rem', color: '#3b82f6', textDecoration: 'none', fontWeight: '600' }}>
                                            View Attachment {i + 1}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                            <button
                                onClick={() => setShowTicketModal(false)}
                                style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Close View
                            </button>
                            {selectedTicket.status !== 'resolved' && (
                                <button
                                    onClick={() => handleCloseTicket(selectedTicket.id)}
                                    style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: '600', cursor: 'pointer' }}
                                >
                                    Close Ticket
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RaiseTicketPage;
