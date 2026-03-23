import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, Info, AlertCircle } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: 2000
            }}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        style={{
                            backgroundColor: '#ffffff',
                            color: '#1e293b',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            minWidth: '300px',
                            borderLeft: `4px solid ${toast.type === 'success' ? 'var(--success)' :
                                toast.type === 'error' ? 'var(--danger)' :
                                    'var(--accent)'
                                }`,
                            animation: 'slideIn 0.3s ease'
                        }}
                    >
                        {toast.type === 'success' && <CheckCircle size={20} color="var(--success)" />}
                        {toast.type === 'error' && <AlertCircle size={20} color="var(--danger)" />}
                        {toast.type === 'info' && <Info size={20} color="var(--accent)" />}

                        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>{toast.message}</span>

                        <button onClick={() => removeToast(toast.id)} style={{ color: '#64748b', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' }}>
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
            <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
        </ToastContext.Provider>
    );
};
