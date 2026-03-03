
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseRequest } from '../../lib/supabaseRequest';
import { BarChart, Users, AlertCircle } from 'lucide-react';

const CapacityDashboard = ({ projectId, addToast }) => {
    const [capacityData, setCapacityData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (projectId) fetchCapacity();
    }, [projectId]);

    const fetchCapacity = async () => {
        setLoading(true);
        try {
            // Fetch tasks with allocated hours for the project
            // Assuming tasks have allocated_hours and assigned_to
            const tasks = await supabaseRequest(
                supabase.from('tasks')
                    .select('allocated_hours, assigned_to, profiles(full_name)')
                    .eq('project_id', projectId)
                    .neq('status', 'completed') // Only active tasks?,
                , addToast
            );

            // Group by User
            const userMap = {};
            tasks?.forEach(task => {
                const userId = task.assigned_to;
                if (!userId) return;

                if (!userMap[userId]) {
                    userMap[userId] = {
                        name: task.profiles?.full_name || 'Unknown',
                        totalAllocated: 0,
                        taskCount: 0
                    };
                }
                userMap[userId].totalAllocated += (task.allocated_hours || 0);
                userMap[userId].taskCount += 1;
            });

            setCapacityData(Object.values(userMap));
        } catch (error) {
            console.error('Error fetching capacity:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading capacity data...</div>;

    // Determine max for bar scaling
    const maxHours = Math.max(...capacityData.map(d => d.totalAllocated), 40); // Baseline 40

    return (
        <div style={{ padding: '24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
                <BarChart size={24} /> Team Capacity Overview
            </h3>

            {capacityData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    <Users size={48} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p>No active workload data found for this project.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {capacityData.map((user, index) => {
                        const usagePercent = Math.min((user.totalAllocated / 40) * 100, 100); // Assuming 40hr week
                        const isOverloaded = user.totalAllocated > 40;

                        return (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '150px', fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                                    {user.name}
                                </div>
                                <div style={{ flex: 1, height: '24px', backgroundColor: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                                    <div style={{
                                        width: `${(user.totalAllocated / maxHours) * 100}%`,
                                        height: '100%',
                                        backgroundColor: isOverloaded ? '#ef4444' : '#3b82f6',
                                        transition: 'width 0.5s ease'
                                    }} />
                                </div>
                                <div style={{ width: '80px', textAlign: 'right', fontWeight: 600, color: isOverloaded ? '#ef4444' : '#64748b', fontSize: '0.9rem' }}>
                                    {user.totalAllocated.toFixed(1)} hrs
                                </div>
                                {isOverloaded && <AlertCircle size={16} color="#ef4444" />}
                            </div>
                        );
                    })}
                </div>
            )}
            <p style={{ marginTop: '20px', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'right' }}>
                * Based on allocated hours for non-completed tasks. Baseline: 40hrs/week.
            </p>
        </div>
    );
};

export default CapacityDashboard;
