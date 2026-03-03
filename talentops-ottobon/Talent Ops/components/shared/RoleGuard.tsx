import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface RoleGuardProps {
    allowedRoles: string[];
    children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        const checkRole = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    // Not logged in, redirect to login
                    navigate('/login');
                    return;
                }

                // Get user's role from profile
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (error || !profile?.role) {
                    console.error('Error fetching role:', error);
                    navigate('/login');
                    return;
                }

                const normalizedRole = profile.role.toLowerCase().trim();
                const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());

                if (normalizedAllowed.includes(normalizedRole)) {
                    setIsAuthorized(true);
                } else {
                    // User is on wrong dashboard, redirect to correct one
                    console.warn(`Role "${normalizedRole}" not allowed for this dashboard. Redirecting...`);

                    switch (normalizedRole) {
                        case 'executive':
                        case 'admin':
                            navigate('/executive-dashboard');
                            break;
                        case 'manager':
                            navigate('/manager-dashboard');
                            break;
                        case 'team_lead':
                            navigate('/teamlead-dashboard');
                            break;
                        case 'employee':
                            navigate('/employee-dashboard');
                            break;
                        default:
                            navigate('/login');
                    }
                }
            } catch (err) {
                console.error('Error in role check:', err);
                navigate('/login');
            }
        };

        checkRole();
    }, [allowedRoles, navigate]);

    // Show loading while checking
    if (isAuthorized === null) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: 'var(--background, #f5f5f5)'
            }}>
                <div style={{
                    textAlign: 'center',
                    color: 'var(--text-secondary, #666)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid #e5e7eb',
                        borderTopColor: '#3b82f6',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
                    Verifying access...
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default RoleGuard;
