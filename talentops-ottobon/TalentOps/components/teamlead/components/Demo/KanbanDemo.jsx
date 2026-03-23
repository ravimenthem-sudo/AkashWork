import React, { useState, useEffect } from 'react';
import { Search, Calendar, X, Clock, Eye } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../../../lib/supabaseClient';

const KanbanDemo = () => {
    // Add styles for dropdown options
    React.useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .status-dropdown option {
                background-color: #f3f4f6 !important;
                color: #374151 !important;
                padding: 8px !important;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    const { addToast } = useToast();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);

    useEffect(() => {
        fetchUserTasks();
    }, []);

    const fetchUserTasks = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setLoading(false);
                return;
            }

            const { data: tasksData, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('assigned_to', user.id);

            if (error) throw error;

            if (tasksData) {
                // Fetch profiles for assigned_by
                const assignerIds = [...new Set(tasksData.map(t => t.assigned_by).filter(id => id))];
                const teamIds = [...new Set(tasksData.map(t => t.team_id).filter(id => id))];

                let namesMap = {};
                let teamsMap = {};

                if (assignerIds.length > 0) {
                    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', assignerIds);
                    if (profiles) profiles.forEach(p => namesMap[p.id] = p.full_name || p.email);
                }

                if (teamIds.length > 0) {
                    const { data: teams } = await supabase.from('teams').select('id, team_name').in('id', teamIds);
                    if (teams) teams.forEach(t => teamsMap[t.id] = t.team_name);
                }

                const formatted = tasksData.map(t => ({
                    ...t,
                    assigner_name: namesMap[t.assigned_by] || 'Unknown',
                    team_name: t.team_id ? teamsMap[t.team_id] : 'N/A'
                }));

                setTasks(formatted);
                // Log unique statuses for debugging
                const uniqueStatuses = [...new Set(tasksData.map(t => t.status))];
                console.log('Unique statuses in DB:', uniqueStatuses);
            }
        } catch (error) {
            console.error('Error fetching tasks:', JSON.stringify(error, null, 2));
            addToast('Failed to load tasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateTaskStatus = async (taskId, newStatus) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .update({ status: newStatus })
                .eq('id', taskId);

            if (error) throw error;

            setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
            addToast('Task status updated', 'success');
        } catch (error) {
            console.error('Error updating task:', JSON.stringify(error, null, 2));
            addToast(`Failed to update task status: ${error.message || 'Unknown error'}`, 'error');
        }
    };

    // Filter Logic
    const filteredTasks = tasks.filter(task => {
        const matchesStatus = filterStatus === 'All' ||
            (filterStatus === 'Pending' && (task.status === 'pending' || task.status === 'to_do')) ||
            (filterStatus === 'In Progress' && task.status === 'in_progress') ||
            (filterStatus === 'Completed' && (task.status === 'done' || task.status === 'completed'));
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesStatus && matchesSearch;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Your Tasks</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage and track your assigned tasks</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
                backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '16px',
                border: '1px solid var(--border)'
            }}>
                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search your tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px',
                            border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem'
                        }}
                    />
                </div>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', cursor: 'pointer', backgroundColor: 'var(--background)' }}
                >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                </select>
            </div>

            {/* Tasks Table */}
            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TASK</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DUE DATE</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>PRIORITY</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>STATUS</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading tasks...</td>
                                </tr>
                            ) : filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks found.</td>
                                </tr>
                            ) : (
                                filteredTasks.map((task) => (
                                    <tr
                                        key={task.id}
                                        style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.1s' }}
                                    >
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{task.title}</div>
                                            {task.description && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {task.description}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '0.9rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} color="var(--text-secondary)" />
                                                {new Date(task.due_date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                                                backgroundColor: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#dcfce7',
                                                color: task.priority === 'high' ? '#991b1b' : task.priority === 'medium' ? '#92400e' : '#166534'
                                            }}>
                                                {task.priority?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <select
                                                className="status-dropdown"
                                                value={task.status}
                                                onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                                                disabled={task.status === 'done' || task.status === 'completed'}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500,
                                                    backgroundColor: (task.status === 'done' || task.status === 'completed') ? '#dcfce7' : task.status === 'in_progress' ? '#dbeafe' : '#fef3c7',
                                                    color: (task.status === 'done' || task.status === 'completed') ? '#15803d' : task.status === 'in_progress' ? '#1d4ed8' : '#a16207',
                                                    border: 'none',
                                                    cursor: (task.status === 'done' || task.status === 'completed') ? 'not-allowed' : 'pointer',
                                                    outline: 'none',
                                                    opacity: (task.status === 'done' || task.status === 'completed') ? 0.7 : 1
                                                }}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="done">Completed</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => { setSelectedTask(task); setShowTaskDetailsModal(true); }}
                                                style={{
                                                    padding: '8px 16px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border)',
                                                    backgroundColor: 'var(--background)',
                                                    color: 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 500,
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#7c3aed';
                                                    e.currentTarget.style.color = 'white';
                                                    e.currentTarget.style.borderColor = '#7c3aed';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--background)';
                                                    e.currentTarget.style.color = 'var(--text-primary)';
                                                    e.currentTarget.style.borderColor = 'var(--border)';
                                                }}
                                            >
                                                <Eye size={16} />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Task Details Modal */}
            {showTaskDetailsModal && selectedTask && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '16px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Task Details</h3>
                            <button onClick={() => setShowTaskDetailsModal(false)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>{selectedTask.title}</h4>
                                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    {selectedTask.description || 'No description provided.'}
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Status</span>
                                    <span style={{
                                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-block',
                                        backgroundColor: (selectedTask.status === 'done' || selectedTask.status === 'completed') ? '#dcfce7' : selectedTask.status === 'in_progress' ? '#dbeafe' : '#fef3c7',
                                        color: (selectedTask.status === 'done' || selectedTask.status === 'completed') ? '#15803d' : selectedTask.status === 'in_progress' ? '#1d4ed8' : '#a16207'
                                    }}>
                                        {selectedTask.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Priority</span>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-block',
                                        backgroundColor: selectedTask.priority === 'high' ? '#fee2e2' : selectedTask.priority === 'medium' ? '#fef3c7' : '#dcfce7',
                                        color: selectedTask.priority === 'high' ? '#991b1b' : selectedTask.priority === 'medium' ? '#92400e' : '#166534'
                                    }}>
                                        {selectedTask.priority ? selectedTask.priority.toUpperCase() : 'N/A'}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned To</span>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Me</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned By</span>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedTask.assigner_name}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Team / Project</span>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedTask.team_name}</span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Task ID</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{selectedTask.id.slice(0, 8)}...</span>
                                </div>
                            </div>

                            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Start Date</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                                        <Calendar size={16} />
                                        <span>{selectedTask.start_date ? new Date(selectedTask.start_date).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Due Date</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                                        <Calendar size={16} />
                                        <span>{selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Due Time</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                                        <Clock size={16} />
                                        <span>{selectedTask.due_time || 'All Day'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowTaskDetailsModal(false)}
                                style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600, backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KanbanDemo;
