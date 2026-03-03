import React from 'react';
import { X, Shield, UserMinus } from 'lucide-react';
import UserAvatar from '../UserAvatar';

const MembersModal = ({
    members,
    currentUserId,
    isCurrentUserAdmin,
    isTeamChat,
    onClose,
    onPromote,
    onDemote,
    onRemove,
    onLeave
}) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', maxHeight: '80vh', background: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Group Members ({members.length})</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                </div>
                <div className="user-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {members.map(user => (
                        <div key={user.id || user.user_id}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid #f3f4f6', background: user.is_admin ? '#eff6ff' : 'transparent' }}>
                            <UserAvatar user={user} size={40} showStatus={false} />
                            <div className="user-info" style={{ flex: 1 }}>
                                <div className="user-name" style={{ fontWeight: '500', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{user.full_name || user.email}</span>
                                    {(user.id === currentUserId || user.user_id === currentUserId) && <span style={{ fontSize: '11px', color: '#6b7280' }}>(You)</span>}
                                    {user.is_admin && (
                                        <span style={{ fontSize: '10px', padding: '2px 6px', background: '#3b82f6', color: 'white', borderRadius: '4px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <Shield size={10} /> ADMIN
                                        </span>
                                    )}
                                </div>
                                <div className="user-role" style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>{user.role}</div>
                            </div>
                            {/* Admin Controls */}
                            {isCurrentUserAdmin && isTeamChat && (user.id !== currentUserId && user.user_id !== currentUserId) && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {user.is_admin ? (
                                        <button onClick={() => onDemote(user.id || user.user_id, user.full_name || user.email)} title="Remove admin"
                                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #f59e0b', background: 'white', cursor: 'pointer', fontSize: '11px', color: '#f59e0b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <UserMinus size={12} /> Demote
                                        </button>
                                    ) : (
                                        <button onClick={() => onPromote(user.id || user.user_id, user.full_name || user.email)} title="Make admin"
                                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'white', cursor: 'pointer', fontSize: '11px', color: '#3b82f6', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Shield size={12} /> Admin
                                        </button>
                                    )}
                                    <button onClick={() => onRemove(user.id || user.user_id, user.full_name || user.email)} title="Remove from group"
                                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #dc2626', background: 'white', cursor: 'pointer', fontSize: '11px', color: '#dc2626', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <UserMinus size={12} /> Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {/* Leave Group Button */}
                {isTeamChat && !isCurrentUserAdmin && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                        <button onClick={onLeave}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dc2626', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                            Leave Group
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MembersModal;
