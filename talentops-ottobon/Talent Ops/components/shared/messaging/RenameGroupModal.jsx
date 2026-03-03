import React from 'react';
import { X } from 'lucide-react';

const RenameGroupModal = ({
    newGroupName,
    setNewGroupName,
    errorMessage,
    setErrorMessage,
    onClose,
    onRename
}) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', maxWidth: '500px' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1f2937' }}>Rename Group</h3>
                    <button onClick={() => { onClose(); setErrorMessage(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                </div>
                <div className="modal-body">
                    {errorMessage && (
                        <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', fontSize: '14px' }}>{errorMessage}</div>
                    )}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', fontSize: '14px' }}>Group Name</label>
                        <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                            onKeyPress={(e) => { if (e.key === 'Enter' && newGroupName.trim()) onRename(); }}
                            placeholder="Enter new group name"
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                            autoFocus />
                        <p style={{ marginTop: '0.5rem', fontSize: '12px', color: '#6b7280' }}>Press Enter to save</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { onClose(); setErrorMessage(null); }}
                            style={{ flex: 1, padding: '0.75rem', background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>Cancel</button>
                        <button onClick={onRename} disabled={!newGroupName.trim()}
                            style={{ flex: 1, padding: '0.75rem', background: !newGroupName.trim() ? '#d1d5db' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: !newGroupName.trim() ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '14px' }}>Rename Group</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RenameGroupModal;
