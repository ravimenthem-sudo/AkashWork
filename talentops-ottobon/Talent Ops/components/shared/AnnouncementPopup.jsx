import React, { useState, useEffect } from 'react';
import { X, Megaphone, Clock, Calendar, MapPin, User, ChevronRight, ChevronLeft, Building2, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const AnnouncementPopup = ({ isOpen, onClose, userId }) => {
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && userId) {
            fetchItems();
        }
    }, [isOpen, userId]);

    // Effect to check if broadcast has been seen today
    useEffect(() => {
        if (isOpen && items.length > 0) {
            const currentItem = items[currentIndex];
            const isBroadcastItem = currentItem?.location === 'Broadcast';

            if (isBroadcastItem) {
                const lastSeen = localStorage.getItem('last_broadcast_seen');
                const today = new Date().toISOString().split('T')[0];

                if (lastSeen === today) {
                    onClose(); // Auto-close if already seen today
                }
            }
        }
    }, [isOpen, items, currentIndex, onClose]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            // Fetch announcements (safe query without joins)
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                const now = new Date();
                const filtered = data.filter(item => {
                    const isBroadcast = item.location === 'Broadcast';
                    const createdAt = new Date(item.created_at);

                    // Show ONLY broadcasts from last 24h
                    if (isBroadcast) {
                        return (now - createdAt) < 24 * 60 * 60 * 1000;
                    }
                    return false;
                });
                setItems(filtered);
            } else if (error) {
                console.error('Announcements fetch error:', error);
                if (isOpen) onClose();
            }
        } catch (err) {
            console.error('Error fetching popup items:', err);
            if (isOpen) onClose();
        } finally {
            setLoading(false);
        }
    };

    // Effect to auto-close if nothing to show
    useEffect(() => {
        if (!loading && items.length === 0 && isOpen) {
            onClose();
        }
    }, [loading, items.length, isOpen, onClose]);

    if (!isOpen || loading || items.length === 0) {
        return null;
    }

    const current = items[currentIndex];
    const isBroadcast = current?.location === 'Broadcast';

    // Effect to check if broadcast has been seen today


    const handleClose = () => {
        if (isBroadcast) {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('last_broadcast_seen', today);
        }
        onClose();
    };

    const nextItem = () => {
        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            handleClose();
        }
    };

    const prevItem = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.container}>
                {/* Progress Indicators */}
                <div style={styles.progressContainer}>
                    {items.map((_, idx) => (
                        <div key={idx} style={{
                            ...styles.progressLine,
                            backgroundColor: idx <= currentIndex ? 'var(--primary)' : 'rgba(255, 255, 255, 0.2)',
                        }} />
                    ))}
                </div>

                {/* Hero Section */}
                <div style={{
                    ...styles.hero,
                    background: isBroadcast
                        ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                        : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
                }}>
                    <div style={styles.heroContent}>
                        <div style={styles.typeBadge}>
                            <Megaphone size={14} />
                            <span>OFFICIAL BROADCAST</span>
                        </div>
                        <h1 style={styles.title}>{current.title}</h1>
                        <div style={styles.authorSection}>
                            <div style={styles.avatar}>
                                <User size={16} />
                            </div>
                            <span style={styles.authorName}>
                                {current.author?.full_name || 'System Admin'}
                            </span>
                            <span style={styles.dot}>•</span>
                            <span style={styles.timestamp}>
                                {new Date(current.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleClose} style={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body Section */}
                <div style={styles.body}>


                    <div style={styles.contentArea}>
                        <h3 style={styles.sectionTitle}>{isBroadcast ? 'Broadcast Details' : 'Event Description'}</h3>
                        <div style={styles.description}>
                            {current.message || current.description || 'No additional details provided for this ' + (isBroadcast ? 'broadcast.' : 'event.')}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div style={styles.footer}>
                    <div style={styles.navButtons}>
                        {currentIndex > 0 && (
                            <button onClick={prevItem} style={styles.secondaryBtn}>
                                <ChevronLeft size={18} />
                                Previous
                            </button>
                        )}
                    </div>

                    <button onClick={nextItem} style={styles.primaryBtn}>
                        <span>{currentIndex === items.length - 1 ? 'Got it, Resume' : 'Next Item'}</span>
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000,
        padding: '24px',
        animation: 'fadeIn 0.3s ease-out'
    },
    container: {
        backgroundColor: '#ffffff',
        borderRadius: '32px',
        maxWidth: '700px',
        width: '100%',
        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.5), 0 18px 36px -18px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
    },
    progressContainer: {
        position: 'absolute',
        top: '12px',
        left: '24px',
        right: '24px',
        height: '4px',
        display: 'flex',
        gap: '6px',
        zIndex: 10
    },
    progressLine: {
        flex: 1,
        borderRadius: '2px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    hero: {
        padding: '64px 40px 40px',
        color: 'white',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
    },
    heroContent: {
        animation: 'slideUp 0.5s ease-out'
    },
    typeBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '20px',
        fontSize: '0.7rem',
        fontWeight: '800',
        letterSpacing: '0.05em',
        marginBottom: '16px',
        backdropFilter: 'blur(4px)'
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: '900',
        lineHeight: '1.1',
        margin: '0 0 24px 0',
        letterSpacing: '-0.02em'
    },
    authorSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.9rem',
        opacity: 0.9
    },
    avatar: {
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    authorName: {
        fontWeight: '700'
    },
    dot: {
        opacity: 0.5
    },
    timestamp: {
        opacity: 0.7
    },
    closeButton: {
        position: 'absolute',
        top: '32px',
        right: '32px',
        background: 'rgba(255, 255, 255, 0.15)',
        border: 'none',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        cursor: 'pointer',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s'
    },
    body: {
        padding: '40px',
        flex: 1,
        overflowY: 'auto'
    },
    statsRow: {
        display: 'flex',
        gap: '40px',
        marginBottom: '32px',
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: '20px',
        border: '1px solid #f1f5f9'
    },
    statItem: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
    },
    statIcon: {
        color: 'var(--primary)',
        marginTop: '2px'
    },
    statLabel: {
        fontSize: '0.75rem',
        color: '#64748b',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        margin: '0 0 2px 0'
    },
    statValue: {
        fontSize: '0.95rem',
        color: '#1e293b',
        fontWeight: '700',
        margin: 0
    },
    contentArea: {
        animation: 'fadeIn 0.8s ease-out'
    },
    sectionTitle: {
        fontSize: '0.85rem',
        color: '#64748b',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '16px'
    },
    description: {
        fontSize: '1.15rem',
        color: '#334155',
        lineHeight: '1.7',
        whiteSpace: 'pre-wrap'
    },
    footer: {
        padding: '24px 40px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #f1f5f9'
    },
    navButtons: {
        display: 'flex',
        gap: '12px'
    },
    primaryBtn: {
        padding: '16px 32px',
        borderRadius: '16px',
        border: 'none',
        backgroundColor: '#0f172a',
        color: 'white',
        fontWeight: '700',
        fontSize: '1rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.3)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    },
    secondaryBtn: {
        padding: '16px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white',
        color: '#475569',
        fontWeight: '700',
        fontSize: '0.9rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.2s'
    }
};

// Add global keyframes for animations if not already present
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(styleSheet);
}

export default AnnouncementPopup;
