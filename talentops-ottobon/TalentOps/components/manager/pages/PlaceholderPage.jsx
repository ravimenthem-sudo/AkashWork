import React from 'react';
import { Construction } from 'lucide-react';

const PlaceholderPage = ({ title }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            textAlign: 'center',
            color: 'var(--text-secondary)'
        }}>
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'var(--background)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'var(--spacing-lg)'
            }}>
                <Construction size={40} color="var(--accent)" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: 'var(--spacing-sm)' }}>{title}</h2>
            <p>This module is currently under development.</p>
        </div>
    );
};

export default PlaceholderPage;
