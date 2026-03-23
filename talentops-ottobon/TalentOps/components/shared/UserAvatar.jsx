import React from 'react';

const UserAvatar = ({ user, size = 40, showStatus = false, isTyping = false }) => {
    // Handle cases where user object might have different shapes (e.g. from profiles join vs flat object)
    const avatarUrl = user?.avatar_url || user?.profiles?.avatar_url;
    const fullName = user?.full_name || user?.profiles?.full_name || user?.email || user?.profiles?.email || '?';

    // Safely get initials
    const initials = (fullName[0] || '?').toUpperCase();

    // Generate a consistent background color based on the name if no avatar
    // Simple hash function for color stability
    const getColor = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    };

    // Use a default gray/slate if we don't want random colors, or use the gradient from the original designs
    // The original design often used explicit colors or gray. Let's stick to the gray/slate default 
    // found in most of the app for now, or allow a prop.
    // Found in ChatWindow: background: '#e2e8f0' (slate-200) or 'linear-gradient...' for admins

    return (
        <div
            className="user-avatar"
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                borderRadius: '50%',
                background: user?.is_admin ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(10, Math.floor(size * 0.4)) + 'px',
                fontWeight: '600',
                color: user?.is_admin ? 'white' : '#64748b',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0
            }}
        >
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt={fullName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                initials
            )}

            {showStatus && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: Math.max(8, Math.floor(size * 0.25)) + 'px',
                    height: Math.max(8, Math.floor(size * 0.25)) + 'px',
                    borderRadius: '50%',
                    background: user?.status === 'online' ? '#22c55e' : '#9ca3af',
                    border: '2px solid white'
                }} />
            )}
        </div>
    );
};

export default UserAvatar;
