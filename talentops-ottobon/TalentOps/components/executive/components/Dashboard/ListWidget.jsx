import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ListWidget = ({ title, items, type }) => {
    const { addToast } = useToast();

    return (
        <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-sm)',
            padding: 'var(--spacing-lg)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{title}</h3>
                <button
                    onClick={() => addToast(`Viewing all ${title}...`, 'info')}
                    style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                    View All <ChevronRight size={16} />
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {items.map((item, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', paddingBottom: index !== items.length - 1 ? 'var(--spacing-md)' : 0, borderBottom: index !== items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        {type === 'birthday' && (
                            <>
                                <img src={item.avatar} alt={item.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.date} • {item.role}</p>
                                </div>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                    🎂
                                </div>
                            </>
                        )}
                        {type === 'approval' && (
                            <>
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: item.color + '15', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <item.icon size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.requester} • {item.time}</p>
                                </div>
                                <button
                                    onClick={() => addToast(`Reviewing ${item.title}...`, 'success')}
                                    style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: 'white', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                    Review
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ListWidget;
