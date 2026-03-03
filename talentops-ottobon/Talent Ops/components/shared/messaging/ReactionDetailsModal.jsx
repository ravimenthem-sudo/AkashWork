import React, { useState } from 'react';
import { X } from 'lucide-react';
import UserAvatar from '../UserAvatar';

const ReactionDetailsModal = ({ reactions, onClose, currentUserId }) => {
    const [activeTab, setActiveTab] = useState('All');
    if (!reactions || Object.keys(reactions).length === 0) return null;

    const allReactions = Object.entries(reactions).flatMap(([emoji, data]) =>
        data.users.map(u => ({ ...u, emoji }))
    );
    const tabs = ['All', ...Object.keys(reactions)];
    const displayedUsers = activeTab === 'All'
        ? allReactions
        : reactions[activeTab]?.users.map(u => ({ ...u, emoji: activeTab })) || [];

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }} onClick={onClose}>
            <div style={{ background: 'white', borderRadius: '12px', width: '400px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Message Reactions</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                </div>
                <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
                    {tabs.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: activeTab === tab ? '#eff6ff' : 'transparent', color: activeTab === tab ? '#2563eb' : '#64748b', fontWeight: 500, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {tab === 'All' ? `All ${allReactions.length}` : `${tab} ${reactions[tab].count}`}
                        </button>
                    ))}
                </div>
                <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                    {displayedUsers.map((user, idx) => (
                        <div key={`${user.user_id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: idx < displayedUsers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <UserAvatar
                                user={{
                                    ...user,
                                    full_name: user.name
                                }}
                                size={32}
                            />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>
                                    {user.user_id === currentUserId ? 'You' : user.name}
                                </div>
                            </div>
                            <div style={{ fontSize: '20px' }}>{user.emoji}</div>
                        </div>
                    ))}
                    {displayedUsers.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>No reactions yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReactionDetailsModal;
