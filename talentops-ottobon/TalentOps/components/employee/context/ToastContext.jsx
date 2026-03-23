import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, Info, AlertCircle, Send, User } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

const ToastItem = ({ toast, removeToast }) => {
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Local auto-dismiss for message_reply type (pauses when focused)
    useEffect(() => {
        if (toast.type !== 'message_reply') return;
        if (isFocused || replyText.trim()) return; // Don't auto-dismiss if focused or has text

        const timer = setTimeout(() => {
            removeToast(toast.id);
        }, 10000); // 10 seconds

        return () => clearTimeout(timer);
    }, [toast.id, toast.type, isFocused, replyText, removeToast]);

    const handleReply = async () => {
        if (!replyText.trim() || !toast.action?.onReply) return;

        setSending(true);
        try {
            await toast.action.onReply(replyText);
            removeToast(toast.id);
        } catch (error) {
            console.error("Reply failed", error);
            setSending(false);
        }
    };

    if (toast.type === 'message_reply') {
        return (
            <div
                style={{
                    backgroundColor: '#272740', // Slightly lighter than sidebar
                    color: 'white',
                    padding: '16px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    minWidth: '350px',
                    maxWidth: '400px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderLeft: '4px solid #8b5cf6', // Indigo/Purple accent
                    animation: 'slideIn 0.3s ease',
                    pointerEvents: 'auto'
                }}
            >
                {/* Header: Avatar + Name + Close */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#8b5cf6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                    }}>
                        {toast.sender?.avatar_url ? (
                            <img src={toast.sender.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                {toast.sender?.name?.[0]?.toUpperCase() || <User size={16} />}
                            </span>
                        )}
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {toast.sender?.name || 'New Message'}
                        </div>
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.7)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            whiteSpace: 'normal',
                            lineHeight: '1.2'
                        }}>
                            {toast.message}
                        </div>
                    </div>

                    <button
                        onClick={() => removeToast(toast.id)}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Inline Reply Input */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type a reply..."
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleReply();
                            }
                        }}
                        style={{
                            flex: 1,
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '20px',
                            padding: '8px 12px',
                            color: 'white',
                            fontSize: '0.85rem',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={handleReply}
                        disabled={sending || !replyText.trim()}
                        style={{
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: (!replyText.trim() || sending) ? 0.5 : 1
                        }}
                    >
                        {sending ? (
                            <div style={{ width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <Send size={14} />
                        )}
                    </button>
                    <style>{`@keyframes spin { 0 % { transform: rotate(0deg); } 100 % { transform: rotate(360deg); } } `}</style>
                </div>
            </div>
        );
    }

    // Default Toast Style
    return (
        <div
            style={{
                backgroundColor: '#ffffff',
                color: '#1e293b',
                padding: '16px',
                borderRadius: '12px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '320px',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${toast.type === 'success' ? '#22c55e' :
                    toast.type === 'error' ? '#ef4444' :
                        '#8b5cf6'
                    } `,
                animation: 'slideIn 0.3s ease',
                pointerEvents: 'auto'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {toast.type === 'success' && <CheckCircle size={20} color="#22c55e" />}
                {toast.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
                {toast.type === 'info' && <Info size={20} color="#8b5cf6" />}

                <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500 }}>{toast.message}</span>

                <button
                    onClick={() => removeToast(toast.id)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer'
                    }}>
                    <X size={16} />
                </button>
            </div>

            {toast.action && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                        onClick={() => {
                            toast.action.onClick();
                            removeToast(toast.id);
                        }}
                        style={{
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#7c3aed'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#8b5cf6'}
                    >
                        {toast.action.label || 'View'}
                    </button>
                </div>
            )}
        </div>
    );
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', options = {}) => {
        console.log('[ToastContext] addToast called:', { message, type });
        // Options supports: action, sender (for message_reply), duration
        const id = Date.now();
        const { action, sender, duration } = options || {};

        setToasts((prev) => [...prev, { id, message, type, action, sender }]);

        // For message_reply, the ToastItem handles its own timeout with pause-on-focus logic
        // For other types, set a timeout here
        if (type !== 'message_reply') {
            const timeToLive = duration || 5000;
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, timeToLive);
        }
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
                zIndex: 2000,
                pointerEvents: 'none' // Allow clicking through the container area
            }}>
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
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
