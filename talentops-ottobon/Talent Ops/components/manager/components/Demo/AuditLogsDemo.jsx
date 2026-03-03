import React from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const AuditLogsDemo = () => {
    const logs = [];

    const getIcon = (status) => {
        if (status === 'success') return <CheckCircle size={18} color="var(--success)" />;
        if (status === 'warning') return <AlertTriangle size={18} color="var(--warning)" />;
        if (status === 'danger') return <Shield size={18} color="var(--danger)" />;
        return <Clock size={18} color="var(--text-secondary)" />;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                <input
                    type="text"
                    placeholder="Search logs..."
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}
                />
                <select style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                    <option>All Events</option>
                    <option>Security</option>
                    <option>System</option>
                </select>
            </div>

            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                {logs.map((log, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)',
                        padding: 'var(--spacing-lg)',
                        borderBottom: i !== logs.length - 1 ? '1px solid var(--border)' : 'none',
                        transition: 'background-color 0.2s'
                    }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            backgroundColor: log.status === 'success' ? '#dcfce7' : log.status === 'warning' ? '#fef3c7' : '#fee2e2',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {getIcon(log.status)}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>{log.action}</h4>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.time}</span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{log.user}</span> • {log.ip}
                                {log.details && <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>— {log.details}</span>}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AuditLogsDemo;
