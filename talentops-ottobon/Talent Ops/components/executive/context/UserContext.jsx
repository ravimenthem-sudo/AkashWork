import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
    const [userName, setUserName] = useState('Loading...');
    const [userRole, setUserRole] = useState('User');
    const [userStatus, setUserStatus] = useState('Offline');
    const [userTask, setUserTask] = useState('');
    const [lastActive, setLastActive] = useState('Now');
    const [userId, setUserId] = useState(null);
    const [orgId, setOrgId] = useState(null);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Get current user from Supabase auth
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    setUserId(user.id);

                    // Fetch user's profile to get full_name, role, and org_id
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('full_name, email, role, org_id')
                        .eq('id', user.id)
                        .single();

                    if (error) {
                        console.error('Error fetching user profile:', error);
                        setUserName(user.email || 'User');
                        setUserRole('User');
                        return;
                    }

                    if (profile) {
                        setUserName(profile.full_name || profile.email || 'User');
                        setUserRole(profile.role || 'User');
                        setOrgId(profile.org_id);
                    }
                } else {
                    setUserName('Guest');
                    setUserRole('Guest');
                    setUserId(null);
                    setOrgId(null);
                }
            } catch (err) {
                console.error('Error in fetchUserData:', err);
                setUserName('User');
                setUserRole('User');
                setUserId(null);
                setOrgId(null);
            }
        };

        fetchUserData();
    }, []);

    return (
        <UserContext.Provider value={{
            userName, setUserName,
            userRole, setUserRole,
            userId,
            orgId,
            userStatus, setUserStatus,
            userTask, setUserTask,
            lastActive, setLastActive
        }}>
            {children}
        </UserContext.Provider>
    );
};
