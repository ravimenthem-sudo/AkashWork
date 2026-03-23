import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
    const [userName, setUserName] = useState('Loading...');
    const [userRole, setUserRole] = useState('User');
    const [currentTeam, setCurrentTeam] = useState('All');
    const [userStatus, setUserStatus] = useState('Offline');
    const [userTask, setUserTask] = useState('');
    const [lastActive, setLastActive] = useState('Now');
    const [userId, setUserId] = useState(null);
    const [teamId, setTeamId] = useState(null);
    const [orgId, setOrgId] = useState(null);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Get current user from Supabase auth
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    // Fetch user's profile to get full_name, role, team_id, org_id
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('full_name, email, role, team_id, org_id')
                        .eq('id', user.id)
                        .single();

                    if (error) {
                        console.error('Error fetching user profile:', error);
                        setUserName(user.email || 'User');
                        setUserRole('User');
                        return;
                    }

                    if (profile) {
                        setUserId(user.id);
                        setUserName(profile.full_name || profile.email || 'User');
                        setUserRole(profile.role || 'User');
                        setTeamId(profile.team_id);
                        setOrgId(profile.org_id);
                    }


                    // --- CHECK ATTENDANCE STATUS & AUTO-CHECKOUT ---
                    const today = new Date().toISOString().split('T')[0];

                    // Fetch ALL open sessions (clock_out is NULL)
                    const { data: openSessions } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('employee_id', user.id)
                        .is('clock_out', null);

                    let activeSessionFound = false;

                    if (openSessions && openSessions.length > 0) {
                        for (const session of openSessions) {
                            if (session.date === today) {
                                // Valid ongoing session for today
                                setUserStatus(session.status === 'break' ? 'Away' : 'Online');
                                if (session.current_task) {
                                    setUserTask(session.current_task);
                                }
                                activeSessionFound = true;
                            } else if (session.date < today) {
                                // Stale session from a past date -> Auto Checkout at 11:59 PM
                                try {
                                    const clockOutTime = '23:59:00';
                                    const start = new Date(`${session.date}T${session.clock_in}`);
                                    const end = new Date(`${session.date}T${clockOutTime}`);
                                    const diffMs = end - start;
                                    const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

                                    const { error: updateError } = await supabase
                                        .from('attendance')
                                        .update({
                                            clock_out: clockOutTime,
                                            total_hours: totalHours,
                                            status: 'present' // Reset status to present (e.g. if they were stuck on break)
                                        })
                                        .eq('id', session.id);

                                    if (!updateError) {
                                        console.log(`Auto-checked out user for previous date: ${session.date}`);
                                    } else {
                                        console.error('Failed to auto-checkout:', updateError);
                                    }
                                } catch (e) {
                                    console.error('Error calculating auto-checkout:', e);
                                }
                            }
                        }
                    }

                    if (!activeSessionFound) {
                        setUserStatus('Offline');
                    }
                    // -----------------------------------------------

                } else {
                    setUserName('Guest');
                    setUserRole('Guest');
                }
            } catch (err) {
                console.error('Error in fetchUserData:', err);
                setUserName('User');
                setUserRole('User');
            }
        };

        fetchUserData();
    }, []);

    return (
        <UserContext.Provider value={{
            userName, setUserName,
            userRole, setUserRole,
            currentTeam, setCurrentTeam,
            userStatus, setUserStatus,
            userTask, setUserTask,
            lastActive, setLastActive,
            userId,      // Expose userId
            teamId,      // Expose teamId or userTeamId (to avoid conflict with currentTeam which seems to be a filter)
            orgId        // Expose orgId
        }}>
            {children}
        </UserContext.Provider>
    );
};
