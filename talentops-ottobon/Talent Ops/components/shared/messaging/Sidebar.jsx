import React, { useState } from 'react';
import {
    MessageCircle, Users, Building2, Search, X, Plus
} from 'lucide-react';
import UserAvatar from '../UserAvatar';

const categories = [
    { id: 'myself', label: 'Myself', icon: MessageCircle, description: 'Direct messages' },
    { id: 'team', label: 'Team', icon: Users, description: 'Team conversations' },
    { id: 'organization', label: 'Organization', icon: Building2, description: 'Company-wide chat' }
];

const Sidebar = ({
    // Auth / loading
    authLoading,
    currentUserId,
    // Category
    activeCategory,
    setActiveCategory,
    // Conversations
    conversations,
    selectedConversation,
    loading,
    // Callbacks
    onSelectConversation,
    onJoinOrganizationChat,
    onStartChatWithUser,
    onCreateTeamChat,
    // Context data
    orgUsers,
    lastReadTimes,
    // Error
    errorMessage,
    setErrorMessage,
}) => {
    // ── Local state (owned by Sidebar) ──
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewDMModal, setShowNewDMModal] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
    const [teamName, setTeamName] = useState('');

    // ── Derived ──
    const filteredConversations = conversations.filter(conv => {
        if (!searchQuery) return true;
        const lastMsg = conv.conversation_indexes?.[0]?.last_message || '';
        return lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // ── Handlers that wrap parent callbacks ──
    const toggleTeamMember = (userId) => {
        setSelectedTeamMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleCreateTeamChat = async () => {
        if (!teamName.trim() || selectedTeamMembers.length === 0) {
            setErrorMessage('Please enter a team name and select at least one member');
            return;
        }
        await onCreateTeamChat(teamName, selectedTeamMembers);
        setShowTeamModal(false);
        setTeamName('');
        setSelectedTeamMembers([]);
    };

    const handleStartChatWithUser = (user) => {
        onStartChatWithUser(user);
        setShowNewDMModal(false);
        setUserSearchQuery('');
    };

    return (
        <>
            {/* ════════════ Category Sidebar ════════════ */}
            {authLoading ? (
                <div className="loading-auth" style={{ padding: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--accent, #6366f1)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : !currentUserId ? (
                <div className="login-prompt" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p>Please log in to view your messages.</p>
                    <button onClick={() => { window.location.href = '/login'; }} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Go to Login
                    </button>
                </div>
            ) : (
                <div className="category-sidebar">
                    <div className="category-header">
                        <h2>Messages</h2>
                    </div>
                    <div className="category-list">
                        {categories.map(category => {
                            const Icon = category.icon;
                            return (
                                <button
                                    key={category.id}
                                    className={`category-item ${activeCategory === category.id ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(category.id)}
                                >
                                    <Icon size={20} />
                                    <div className="category-info">
                                        <span className="category-label">{category.label}</span>
                                        <span className="category-description">{category.description}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ════════════ Conversation List ════════════ */}
            <div className="conversation-sidebar">
                <div className="conversation-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>Communications</h2>
                        {activeCategory === 'myself' && (
                            <button
                                className="new-dm-button"
                                onClick={() => setShowNewDMModal(true)}
                                title="New conversation"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                        {activeCategory === 'team' && (
                            <button
                                className="new-dm-button"
                                onClick={() => setShowTeamModal(true)}
                                title="Create team chat"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="conversation-list">
                    {loading && !selectedConversation ? (
                        <div className="loading-state">Loading conversations...</div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="empty-state">
                            <MessageCircle size={48} />
                            <p>No conversations yet</p>
                            {activeCategory === 'myself' && (
                                <button
                                    onClick={() => setShowNewDMModal(true)}
                                    className="empty-state-action-btn"
                                    style={{
                                        background: 'white',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        margin: '0 auto',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#cbd5e1';
                                        e.currentTarget.style.color = '#0f172a';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.color = '#64748b';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <Plus size={16} /> Start a conversation
                                </button>
                            )}
                            {activeCategory === 'team' && (
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1rem' }}>
                                        Create a team chat to collaborate with your colleagues
                                    </p>
                                    <button
                                        onClick={() => setShowTeamModal(true)}
                                        className="empty-state-action-btn"
                                        style={{
                                            background: 'white',
                                            color: '#64748b',
                                            border: '1px solid #e2e8f0',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            margin: '0 auto',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#cbd5e1';
                                            e.currentTarget.style.color = '#0f172a';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#e2e8f0';
                                            e.currentTarget.style.color = '#64748b';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                        }}
                                    >
                                        <Plus size={16} />
                                        Create Team Chat
                                    </button>
                                </div>
                            )}
                            {activeCategory === 'organization' && (
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '1rem' }}>
                                        Join the company-wide chat to connect with everyone
                                    </p>
                                    <button
                                        onClick={onJoinOrganizationChat}
                                        className="empty-state-action-btn"
                                        style={{
                                            background: 'white',
                                            color: '#64748b',
                                            border: '1px solid #e2e8f0',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            margin: '0 auto',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            transition: 'all 0.2s ease',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!loading) {
                                                e.currentTarget.style.borderColor = '#cbd5e1';
                                                e.currentTarget.style.color = '#0f172a';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!loading) {
                                                e.currentTarget.style.borderColor = '#e2e8f0';
                                                e.currentTarget.style.color = '#64748b';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                            }
                                        }}
                                        disabled={loading}
                                    >
                                        <Building2 size={16} />
                                        {loading ? 'Joining...' : 'Join Company Chat'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        filteredConversations.map(conv => {
                            const lastMsgTime = conv.conversation_indexes?.[0]?.last_message_at ? new Date(conv.conversation_indexes[0].last_message_at).getTime() : 0;
                            const lastReadTime = lastReadTimes[conv.id] || 0;
                            const isUnread = lastMsgTime > lastReadTime;

                            return (
                                <div
                                    key={conv.id}
                                    className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''} ${isUnread ? 'unread' : ''}`}
                                    onClick={() => onSelectConversation(conv)}
                                >
                                    <div className="conversation-avatar">
                                        {conv.type === 'dm' ? (
                                            <UserAvatar
                                                user={{
                                                    full_name: conv.name,
                                                    avatar_url: conv.avatar_url
                                                }}
                                                size={40}
                                            />
                                        ) : conv.type === 'team' ? (
                                            <Users size={20} />
                                        ) : (
                                            <Building2 size={20} />
                                        )}
                                    </div>
                                    <div className="conversation-info">
                                        <div className="conversation-name">
                                            {conv.name || 'Conversation'}
                                        </div>
                                        <div className="conversation-preview">
                                            {conv.conversation_indexes?.[0]?.last_message
                                                || (conv.conversation_indexes?.[0]?.last_message_at ? '📎 Attachment' : 'No messages yet')}
                                        </div>
                                    </div>
                                    <div className="conversation-time">
                                        {conv.conversation_indexes?.[0]?.last_message_at ? (
                                            new Date(conv.conversation_indexes[0].last_message_at).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                        ) : ''}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ════════════ New DM Modal ════════════ */}
            {showNewDMModal && (
                <div className="modal-overlay" onClick={() => { setShowNewDMModal(false); setUserSearchQuery(''); setErrorMessage(null); }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px' }}>
                        <div className="modal-header">
                            <h3>Start a new conversation</h3>
                            <button onClick={() => { setShowNewDMModal(false); setUserSearchQuery(''); setErrorMessage(null); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Error Message Display */}
                            {errorMessage && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    marginBottom: '1rem',
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '8px',
                                    color: '#b91c1c',
                                    fontSize: '14px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span>{errorMessage}</span>
                                    <button
                                        onClick={() => setErrorMessage(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            <div className="user-search" style={{ marginBottom: '1rem' }}>
                                <div className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#f5f5f5', borderRadius: '8px' }}>
                                    <Search size={18} style={{ color: '#888' }} />
                                    <input
                                        type="text"
                                        placeholder="Search employees by name or role..."
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }}
                                        autoFocus
                                    />
                                    {userSearchQuery && (
                                        <button
                                            onClick={() => setUserSearchQuery('')}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <X size={16} style={{ color: '#888' }} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {loading && (
                                <div style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
                                    <div className="spinner" style={{
                                        width: '24px',
                                        height: '24px',
                                        border: '3px solid #f3f3f3',
                                        borderTop: '3px solid var(--accent, #6366f1)',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                        margin: '0 auto 0.5rem'
                                    }} />
                                    <p>Starting conversation...</p>
                                </div>
                            )}

                            <div className="user-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {orgUsers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                        <Users size={48} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                        <p>No employees found</p>
                                    </div>
                                ) : (
                                    orgUsers
                                        .filter(user => user.id !== currentUserId)
                                        .filter(user => {
                                            if (!userSearchQuery) return true;
                                            const query = userSearchQuery.toLowerCase();
                                            return (
                                                (user.full_name?.toLowerCase() || '').includes(query) ||
                                                (user.email?.toLowerCase() || '').includes(query) ||
                                                (user.role?.toLowerCase() || '').includes(query)
                                            );
                                        })
                                        .map(user => (
                                            <div
                                                key={user.id}
                                                className="user-item"
                                                onClick={() => handleStartChatWithUser(user)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    borderRadius: '8px',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <UserAvatar user={user} size={40} />
                                                <div className="user-info" style={{ flex: 1 }}>
                                                    <div className="user-name" style={{ fontWeight: '500', color: '#1f2937' }}>
                                                        {user.full_name || user.email}
                                                    </div>
                                                    <div className="user-role" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                                        {user.role}
                                                    </div>
                                                </div>
                                                <MessageCircle size={18} style={{ color: '#9ca3af' }} />
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════ Team Chat Modal ════════════ */}
            {showTeamModal && (
                <div className="modal-overlay" onClick={() => { setShowTeamModal(false); setTeamName(''); setSelectedTeamMembers([]); setErrorMessage(null); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', maxHeight: '80vh', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Create Team Chat</h2>
                            <button onClick={() => { setShowTeamModal(false); setTeamName(''); setSelectedTeamMembers([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Error Message */}
                        {errorMessage && (
                            <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', fontSize: '14px' }}>
                                {errorMessage}
                            </div>
                        )}

                        {/* Team Name Input */}
                        <div style={{ marginBottom: '1rem', position: 'relative' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Team Name</label>
                            <input
                                type="text"
                                placeholder="Enter team name..."
                                value={teamName}
                                onChange={(e) => { setTeamName(e.target.value); setErrorMessage(null); }}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: selectedTeamMembers.length > 0 && !teamName.trim()
                                        ? '2px solid #fbbf24'
                                        : '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    outline: 'none',
                                    transition: 'all 0.3s ease',
                                    boxShadow: selectedTeamMembers.length > 0 && !teamName.trim()
                                        ? '0 0 0 3px rgba(251, 191, 36, 0.1)'
                                        : 'none'
                                }}
                                autoFocus
                            />
                            {/* Animated indicator when members selected but no name */}
                            {selectedTeamMembers.length > 0 && !teamName.trim() && (
                                <div style={{
                                    marginTop: '8px',
                                    padding: '10px 14px',
                                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                    border: '1px solid #fbbf24',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    animation: 'pulseGlow 2s ease-in-out infinite',
                                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)'
                                }}>
                                    <div style={{
                                        fontSize: '18px',
                                        animation: 'bounce 1s ease-in-out infinite'
                                    }}>
                                        ✏️
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#92400e'
                                    }}>
                                        Don't forget to give your team a name!
                                    </div>
                                </div>
                            )}
                            <style>{`
                                @keyframes pulseGlow {
                                    0%, 100% {
                                        transform: scale(1);
                                        opacity: 1;
                                    }
                                    50% {
                                        transform: scale(1.02);
                                        opacity: 0.95;
                                    }
                                }
                                @keyframes bounce {
                                    0%, 100% {
                                        transform: translateY(0);
                                    }
                                    50% {
                                        transform: translateY(-3px);
                                    }
                                }
                            `}</style>
                        </div>

                        {/* Member Selection */}
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>
                                Select Members ({selectedTeamMembers.length} selected)
                            </label>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                {orgUsers.filter(u => u.id !== currentUserId).length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                        No team members available
                                    </div>
                                ) : (
                                    orgUsers
                                        .filter(u => u.id !== currentUserId)
                                        .map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleTeamMember(user.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #f3f4f6',
                                                    background: selectedTeamMembers.includes(user.id) ? '#eef2ff' : 'transparent'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTeamMembers.includes(user.id)}
                                                    onChange={() => { }}
                                                    style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                                                />
                                                <UserAvatar user={user} size={36} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '500', color: '#1f2937' }}>
                                                        {user.full_name || user.email}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>
                                                        {user.role}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        </div>

                        {/* Create Button */}
                        <button
                            onClick={handleCreateTeamChat}
                            disabled={loading || !teamName.trim() || selectedTeamMembers.length === 0}
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                background: loading || !teamName.trim() || selectedTeamMembers.length === 0 ? '#d1d5db' : 'var(--accent, #6366f1)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: loading || !teamName.trim() || selectedTeamMembers.length === 0 ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                fontSize: '15px'
                            }}
                        >
                            {loading ? 'Creating...' : 'Create Team Chat'}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
