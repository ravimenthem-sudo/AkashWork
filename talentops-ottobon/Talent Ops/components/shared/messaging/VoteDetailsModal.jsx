import React from 'react';
import { X } from 'lucide-react';
import UserAvatar from '../UserAvatar';

const VoteDetailsModal = ({ message, votes, onClose }) => {
    if (!message) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h3>Poll Details</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '60vh' }}>
                    {message.poll_options.map((option, idx) => {
                        const optionVoters = votes.filter(v => v.option_index === idx);
                        return (
                            <div key={idx} style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '15px' }}>{option}</div>
                                    <div style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                                        {optionVoters.length} {optionVoters.length === 1 ? 'vote' : 'votes'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {optionVoters.length === 0 ? (
                                        <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No votes yet</div>
                                    ) : (
                                        optionVoters.map(voter => (
                                            <div key={voter.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <UserAvatar user={voter} size={28} />
                                                <div style={{ fontSize: '14px', fontWeight: '500' }}>
                                                    {voter.profiles?.full_name || voter.profiles?.email}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default VoteDetailsModal;
