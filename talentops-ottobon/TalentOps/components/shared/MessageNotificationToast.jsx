import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, User } from 'lucide-react';
import './MessageNotificationToast.css';

const MessageNotificationToast = ({
    message,
    index = 0,
    onReply,
    onDismiss,
    onNavigate,
    autoHideDuration = 5000
}) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(100);
    const inputRef = useRef(null);
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const remainingTimeRef = useRef(autoHideDuration);

    // Auto-dismiss timer with pause support
    useEffect(() => {
        if (isPaused || showReplyInput) return;

        startTimeRef.current = Date.now();

        const tick = () => {
            const elapsed = Date.now() - startTimeRef.current;
            const remaining = remainingTimeRef.current - elapsed;

            if (remaining <= 0) {
                onDismiss();
            } else {
                setProgress((remaining / autoHideDuration) * 100);
                timerRef.current = requestAnimationFrame(tick);
            }
        };

        timerRef.current = requestAnimationFrame(tick);

        return () => {
            if (timerRef.current) cancelAnimationFrame(timerRef.current);
            remainingTimeRef.current = remainingTimeRef.current - (Date.now() - startTimeRef.current);
        };
    }, [isPaused, showReplyInput, onDismiss, autoHideDuration]);

    // Focus input when reply mode opens
    useEffect(() => {
        if (showReplyInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showReplyInput]);

    const handleReply = () => {
        if (replyText.trim()) {
            onReply(replyText.trim());
            setReplyText('');
            setShowReplyInput(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleReply();
        }
        if (e.key === 'Escape') {
            setShowReplyInput(false);
        }
    };

    const truncateMessage = (text, maxLength = 100) => {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    return (
        <div
            className="message-toast"
            style={{
                animationDelay: `${index * 100}ms`,
                transform: `translateY(-${index * 8}px)`
            }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Progress bar */}
            <div className="toast-progress-bar">
                <div
                    className="toast-progress-fill"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Header */}
            <div className="toast-header">
                <div className="toast-sender">
                    {message.avatar_url ? (
                        <img
                            src={message.avatar_url}
                            alt={message.sender_name}
                            className="toast-avatar"
                        />
                    ) : (
                        <div className="toast-avatar-placeholder">
                            <User size={16} />
                        </div>
                    )}
                    <div className="toast-sender-info">
                        <span className="toast-sender-name">{message.sender_name || 'Unknown'}</span>
                        <span className="toast-time">Just now</span>
                    </div>
                </div>
                <button
                    className="toast-dismiss"
                    onClick={onDismiss}
                    title="Dismiss"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Message content */}
            <div
                className="toast-content"
                onClick={onNavigate}
            >
                <p>{truncateMessage(message.content)}</p>
            </div>

            {/* Reply section */}
            {showReplyInput ? (
                <div className="toast-reply-input">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyPress}
                    />
                    <button
                        className="toast-send-btn"
                        onClick={handleReply}
                        disabled={!replyText.trim()}
                    >
                        <Send size={16} />
                    </button>
                </div>
            ) : (
                <div className="toast-actions">
                    <button
                        className="toast-reply-btn"
                        onClick={() => setShowReplyInput(true)}
                    >
                        <MessageCircle size={14} />
                        Reply
                    </button>
                    <button
                        className="toast-view-btn"
                        onClick={onNavigate}
                    >
                        View Chat
                    </button>
                </div>
            )}
        </div>
    );
};

export default MessageNotificationToast;
