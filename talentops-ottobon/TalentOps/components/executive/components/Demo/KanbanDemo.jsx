import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Plus, X, User, Users, Filter, Search, Calendar, CheckCircle2, Circle, Clock, AlertCircle, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
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
    const [showModal, setShowModal] = useState(false);
    const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedTeam, setSelectedTeam] = useState('All');
    const [selectedEmployee, setSelectedEmployee] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Dropdown Data
    const [teamsList, setTeamsList] = useState([]);
    const [employeesList, setEmployeesList] = useState([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const tasksPerPage = 10;

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assigned_to: '',
        assign_type: 'individual',
        team_id: '',
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        due_time: '',
        priority: 'Medium',
        status: 'To Do'
    });

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await Promise.all([fetchTasks(), fetchEmployees(), fetchTeams()]);
            setLoading(false);
        };
        fetchData();
    }, []);

    const fetchTasks = async () => {
        try {
            const { data: tasksData, error: tasksError } = await supabase
                .from('tasks')
                .select('*');

            if (tasksError) throw tasksError;

            // Fetch profiles for names
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email, team_id');

            if (profilesError) throw profilesError;

            const userMap = {};
            const teamMap = {}; // Map user ID to Team ID if needed, or just use profiles

            if (profiles) {
                profiles.forEach(p => {
                    userMap[p.id] = p.full_name || p.email;
                    teamMap[p.id] = p.team_id;
                });
            }

            // Fetch team names
            const { data: teamsData } = await supabase.from('teams').select('id, team_name');
            const teamNameMap = {};
            if (teamsData) {
                teamsData.forEach(t => {
                    teamNameMap[t.id] = t.team_name;
                });
            }

            if (tasksData) {
                const formatted = tasksData.map(t => ({
                    ...t,
                    assignee_name: userMap[t.assigned_to] || 'Unassigned',
                    assigner_name: userMap[t.assigned_by] || 'Unknown',
                    team_name: t.team_id ? teamNameMap[t.team_id] : (teamNameMap[teamMap[t.assigned_to]] || 'N/A')
                }));
                setTasks(formatted);
            }
        } catch (error) {
            console.error('Error fetching tasks:', JSON.stringify(error, null, 2));
            addToast('Failed to load tasks', 'error');
        }
    };

    const fetchEmployees = async () => {
        const { data } = await supabase.from('profiles').select('id, full_name, email, role, team_id');
        if (data) setEmployeesList(data);
    };

    const fetchTeams = async () => {
        try {
            const { data, error } = await supabase.from('teams').select('id, team_name');
            if (error) throw error;
            if (data) setTeamsList(data.map(t => ({ id: t.id, name: t.team_name }))); // Map back to name for internal use if needed, or update state usage
        } catch (error) {
            console.error('Error fetching teams:', JSON.stringify(error, null, 2));
        }
    };

    const handleAddTask = async () => {
        if (!newTask.title) {
            addToast('Please enter a task title', 'error');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let tasksToInsert = [];

            // Map display status to database status
            let statusDb = newTask.status.toLowerCase().replace(/ /g, '_');
            if (statusDb === 'to_do') statusDb = 'pending';

            if (newTask.assign_type === 'team' && newTask.team_id) {
                const teamMembers = employeesList.filter(e => e.team_id === newTask.team_id);
                tasksToInsert = teamMembers.map(member => ({
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: member.id,
                    assigned_by: user.id,
                    team_id: newTask.team_id,
                    start_date: newTask.start_date,
                    due_date: newTask.due_date,
                    due_time: newTask.due_time || null,
                    priority: newTask.priority.toLowerCase(),
                    status: statusDb
                }));
            } else {
                tasksToInsert = [{
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: newTask.assigned_to,
                    assigned_by: user.id,
                    start_date: newTask.start_date,
                    due_date: newTask.due_date,
                    due_time: newTask.due_time || null,
                    priority: newTask.priority.toLowerCase(),
                    status: statusDb
                }];
            }

            const { error } = await supabase.from('tasks').insert(tasksToInsert);

            if (error) throw error;

            addToast('Task created successfully', 'success');
            setShowModal(false);
            setNewTask({ ...newTask, title: '', description: '' });
            fetchTasks(); // Refresh
        } catch (error) {
            console.error('Error creating task:', JSON.stringify(error, null, 2));
            addToast(`Failed to create task: ${error.message || 'Unknown error'}`, 'error');
        }
    };

    // Filter Logic
    const filteredTasks = tasks.filter(task => {
        const matchesTeam = selectedTeam === 'All' || task.team_name === selectedTeam;
        const matchesEmployee = selectedEmployee === 'All' || task.assignee_name === selectedEmployee;
        const matchesStatus = filterStatus === 'All' ||
            (filterStatus === 'Pending' && ['pending', 'to_do', 'to do'].includes(task.status?.toLowerCase())) ||
            (filterStatus === 'In Progress' && ['in_progress', 'in progress'].includes(task.status?.toLowerCase())) ||
            (filterStatus === 'Completed' && ['completed', 'done'].includes(task.status?.toLowerCase()));
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesTeam && matchesEmployee && matchesStatus && matchesSearch;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-gray-100 text-gray-600';
            case 'in_progress': return 'bg-blue-100 text-blue-600';
            case 'completed': return 'bg-green-100 text-green-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusLabel = (status) => {
        return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const getPriorityColor = (priority) => {
        switch (priority?.toLowerCase()) {
            case 'high': return 'text-red-600 bg-red-50';
            case 'medium': return 'text-amber-600 bg-amber-50';
            case 'low': return 'text-green-600 bg-green-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const handleUpdateTask = async (taskId, field, value) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .update({ [field]: value })
                .eq('id', taskId);

            if (error) throw error;

            setTasks(prevTasks => prevTasks.map(t =>
                t.id === taskId ? { ...t, [field]: value } : t
            ));

            addToast(`Task ${field} updated`, 'success');
        } catch (error) {
            console.error(`Error updating task ${field}:`, error);
            addToast(`Failed to update task ${field}`, 'error');
        }
    };

    // Pagination calculations
    const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
    const startIndex = (currentPage - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTeam, selectedEmployee, filterStatus, searchQuery]);

    // ... (keep existing helper functions)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>All Tasks</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage and track all team tasks in one place</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        backgroundColor: 'var(--primary)', color: 'white',
                        padding: '10px 20px', borderRadius: '8px', fontWeight: 600,
                        border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)'
                    }}
                >
                    <Plus size={18} /> New Task
                </button>
            </div>

            {/* Filters Bar */}
            <div style={{
                display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
                backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '16px',
                border: '1px solid var(--border)'
            }}>
                {/* Search */}
                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px',
                            border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem'
                        }}
                    />
                </div>

                {/* Team Filter */}
                <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', cursor: 'pointer', backgroundColor: 'var(--background)' }}
                >
                    <option value="All">All Teams</option>
                    {teamsList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>

                {/* Status Filter */}
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
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '25%' }}>TASK</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '15%' }}>ASSIGNEE</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '15%' }}>TEAM</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '13%' }}>DUE DATE</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '12%' }}>PRIORITY</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '12%' }}>STATUS</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '8%' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading tasks...</td>
                                </tr>
                            ) : paginatedTasks.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks found matching your filters.</td>
                                </tr>
                            ) : (
                                paginatedTasks.map((task) => (
                                    <tr
                                        key={task.id}
                                        style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.1s' }}
                                    >
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{task.title}</div>
                                            {task.description && (
                                                <div style={{
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-secondary)',
                                                    marginTop: '4px',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {task.description}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--primary)' }}>
                                                    {task.assignee_name.charAt(0)}
                                                </div>
                                                <span style={{ fontSize: '0.9rem' }}>{task.assignee_name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                            {task.team_name}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '0.9rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} color="var(--text-secondary)" />
                                                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Date'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <select
                                                value={task.priority}
                                                onChange={(e) => handleUpdateTask(task.id, 'priority', e.target.value)}
                                                style={{
                                                    padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                                                    backgroundColor: task.priority === 'high' ? '#fee2e2' : task.priority === 'medium' ? '#fef3c7' : '#dcfce7',
                                                    color: task.priority === 'high' ? '#991b1b' : task.priority === 'medium' ? '#92400e' : '#166534',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    outline: 'none'
                                                }}
                                            >
                                                <option value="low">LOW</option>
                                                <option value="medium">MEDIUM</option>
                                                <option value="high">HIGH</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <select
                                                className="status-dropdown"
                                                value={task.status}
                                                onChange={(e) => handleUpdateTask(task.id, 'status', e.target.value)}
                                                style={{
                                                    padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500,
                                                    backgroundColor: ['completed', 'done'].includes(task.status?.toLowerCase()) ? '#dcfce7' : ['in_progress', 'in progress'].includes(task.status?.toLowerCase()) ? '#dbeafe' : '#fef3c7',
                                                    color: ['completed', 'done'].includes(task.status?.toLowerCase()) ? '#15803d' : ['in_progress', 'in progress'].includes(task.status?.toLowerCase()) ? '#1d4ed8' : '#a16207',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    outline: 'none'
                                                }}
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setShowTaskDetailsModal(true); }}
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

            {/* Pagination Controls */}
            {filteredTasks.length > tasksPerPage && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-sm)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <span>
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredTasks.length)} of {filteredTasks.length} results
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                backgroundColor: currentPage === 1 ? 'var(--background)' : 'var(--surface)',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                opacity: currentPage === 1 ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>

                        <span style={{ padding: '0 8px' }}>
                            Page {currentPage} of {totalPages || 1}
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                backgroundColor: (currentPage === totalPages || totalPages === 0) ? 'var(--background)' : 'var(--surface)',
                                cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                                opacity: (currentPage === totalPages || totalPages === 0) ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal - Reused from previous version */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: 'var(--spacing-xl)', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Assign New Task</h3>
                            <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Task Title *</label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    placeholder="Enter task title"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Description</label>
                                <textarea
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    placeholder="Enter task description"
                                    rows="3"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem', resize: 'vertical' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Assign To *</label>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="assign_type"
                                            value="individual"
                                            checked={newTask.assign_type === 'individual'}
                                            onChange={(e) => setNewTask({ ...newTask, assign_type: e.target.value, team_id: '' })}
                                        />
                                        <span>Individual Employee</span>
                                    </label>
                                    {teamsList.length > 0 && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="assign_type"
                                                value="team"
                                                checked={newTask.assign_type === 'team'}
                                                onChange={(e) => setNewTask({ ...newTask, assign_type: e.target.value, assigned_to: '' })}
                                            />
                                            <span>Entire Team</span>
                                        </label>
                                    )}
                                </div>
                                {newTask.assign_type === 'individual' ? (
                                    <select
                                        value={newTask.assigned_to}
                                        onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                    >
                                        <option value="">Select Employee</option>
                                        {employeesList.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.full_name} ({emp.role})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <select
                                        value={newTask.team_id}
                                        onChange={(e) => setNewTask({ ...newTask, team_id: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                    >
                                        <option value="">Select Team</option>
                                        {teamsList.map(team => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date</label>
                                    <input
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={newTask.start_date}
                                        onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Due Date</label>
                                    <input
                                        type="date"
                                        value={newTask.due_date}
                                        onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                        min={newTask.start_date}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Due Time</label>
                                <input
                                    type="time"
                                    value={newTask.due_time}
                                    onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Priority</label>
                                <select
                                    value={newTask.priority}
                                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    onClick={() => setShowModal(false)}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--border)', backgroundColor: 'var(--background)', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddTask}
                                    style={{ flex: 1, backgroundColor: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                                >
                                    Assign Task
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                        backgroundColor: getStatusColor(selectedTask.status.toLowerCase().replace(' ', '_')).split(' ')[0],
                                        color: getStatusColor(selectedTask.status.toLowerCase().replace(' ', '_')).split(' ')[1]
                                    }}>
                                        {getStatusLabel(selectedTask.status)}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Priority</span>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-block',
                                        backgroundColor: selectedTask.priority.toLowerCase() === 'high' ? '#fee2e2' : selectedTask.priority.toLowerCase() === 'medium' ? '#fef3c7' : '#dcfce7',
                                        color: selectedTask.priority.toLowerCase() === 'high' ? '#991b1b' : selectedTask.priority.toLowerCase() === 'medium' ? '#92400e' : '#166534'
                                    }}>
                                        {selectedTask.priority.toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned To</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>
                                            {selectedTask.assignee_name.charAt(0)}
                                        </div>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{selectedTask.assignee_name}</span>
                                    </div>
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
