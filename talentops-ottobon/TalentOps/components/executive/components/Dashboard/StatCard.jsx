import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatCard = ({ title, value, change, trend, icon: Icon, color }) => {
    return (
        <div style={{
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            cursor: 'pointer'
        }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: `${color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: color
                }}>
                    <Icon size={24} />
                </div>
                {change && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: trend === 'up' ? 'var(--success)' : 'var(--danger)',
                        backgroundColor: trend === 'up' ? '#10b98115' : '#ef444415',
                        padding: '4px 8px',
                        borderRadius: '20px'
                    }}>
                        {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {change}
                    </div>
                )}
            </div>

            <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>{title}</p>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '4px' }}>{value}</h3>
            </div>
        </div>
    );
};

export default StatCard;
