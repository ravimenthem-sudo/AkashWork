import React from 'react';
import { X, UserPlus } from 'lucide-react';
import UserAvatar from '../UserAvatar';

const AddMemberModal = ({
    orgUsers,
    currentMembers,
    errorMessage,
    onClose,
    onAdd
}) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', maxWidth: '500px' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>Add Member to Group</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {errorMessage && (
                        <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', fontSize: '14px' }}>
                            {errorMessage}
                        </div>
                    )}
                    <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '14px' }}>Select a user to add to this group</p>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                        {orgUsers.filter(u => !currentMembers.some(m => (m.id || m.user_id) === u.id)).length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>All organization members are already in this group</div>
                        ) : (
                            orgUsers.filter(u => !currentMembers.some(m => (m.id || m.user_id) === u.id)).map(user => (
                                <div key={user.id} onClick={() => { onAdd(user.id); onClose(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', transition: 'background 0.2s', background: 'white' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                                    <UserAvatar user={user} size={40} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '500', color: '#1f2937' }}>{user.full_name || user.email}</div>
                                        <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize' }}>{user.role}</div>
                                    </div>
                                    <UserPlus size={18} style={{ color: '#3b82f6' }} />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddMemberModal;
