import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Plus, X, User, Users, Filter, Search, Calendar, CheckCircle2, Circle, Clock, AlertCircle, ChevronLeft, ChevronRight, Eye, Shield, FileText, ExternalLink, XCircle, AlertTriangle, Trash2, Edit2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../../../lib/supabaseClient';
import { calculateDueDateTime } from '../../../../lib/businessHoursUtils';


const ManagerTasks = () => {
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
    const { teamId, userRole } = useUser(); // Get teamId from context
    const [showModal, setShowModal] = useState(false);
    const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters (Removed Team Filter)
    const [selectedEmployee, setSelectedEmployee] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Dropdown Data
    const [employeesList, setEmployeesList] = useState([]);
    const [myTeamName, setMyTeamName] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const tasksPerPage = 10;

    // Review State
    const [taskReview, setTaskReview] = useState(null);
    const [loadingReview, setLoadingReview] = useState(false);
    const [rejectionRemark, setRejectionRemark] = useState('');

    // Issue Resolution State
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [taskWithIssue, setTaskWithIssue] = useState(null);
    const [resolvingIssue, setResolvingIssue] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    // Edit Task State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    useEffect(() => {
        if (showTaskDetailsModal && selectedTask) {
            fetchTaskReviewData(selectedTask.id);
        } else {
            setTaskReview(null);
            setIsRejecting(false);
            setRejectionRemark('');
        }
    }, [showTaskDetailsModal, selectedTask]);

    const fetchTaskReviewData = async (taskId) => {
        setLoadingReview(true);
        try {
            // 1. Get Progress
            const { data: progress } = await supabase.from('task_progress').select('*').eq('task_id', taskId).single();

            // 2. Get Confirm Submission
            const { data: submission } = await supabase.from('task_submissions').select('*').eq('task_id', taskId).order('submission_time', { ascending: false }).limit(1).single();

            // 3. Get Evidence
            let evidence = [];
            if (submission) {
                const { data: evidenceData } = await supabase.from('task_evidence').select('*').eq('submission_id', submission.id);
                evidence = evidenceData || [];
            }

            setTaskReview({ progress, submission, evidence });
        } catch (error) {
            console.error('Error fetching review data:', error);
        } finally {
            setLoadingReview(false);
        }
    };

    const handleApproveTask = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Create Review Record
            await supabase.from('task_reviews').insert({
                task_id: selectedTask.id,
                reviewer_id: user.id,
                approved: true,
                comment: 'Certification Approved via Dashboard',
                reviewed_at: new Date()
            });

            // 1.5. Check for Overage and Save Justification
            if (selectedTask.actual_hours > selectedTask.allocated_hours) {
                if (!managerJustification.trim()) {
                    addToast('Justification required for time overage', 'error');
                    return;
                }
                await supabase.from('tasks').update({ manager_justification: managerJustification }).eq('id', selectedTask.id);
            }

            // 2. Update Task Status
            await handleUpdateTask(selectedTask.id, 'status', 'completed');

            addToast('Task Certified & Locked!', 'success');
            setShowTaskDetailsModal(false);
        } catch (error) {
            console.error('Approval Error:', error);
            addToast('Failed to approve task', 'error');
        }
    };

    const handleRejectTask = async () => {
        if (!rejectionRemark.trim()) {
            addToast('Please enter a rejection remark.', 'error');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // 1. Create Review Record
            await supabase.from('task_reviews').insert({
                task_id: selectedTask.id,
                reviewer_id: user.id,
                approved: false,
                comment: rejectionRemark,
                reviewed_at: new Date()
            });

            // 2. Update Task Status (Return to In Progress)
            await handleUpdateTask(selectedTask.id, 'status', 'in_progress');

            addToast('Task Rejected & Returned.', 'info');
            setShowTaskDetailsModal(false);
        } catch (error) {
            console.error('Rejection Error:', error);
            addToast('Failed to reject task', 'error');
        }
    };

    const openIssueModal = (task) => {
        setTaskWithIssue(task);
        setShowIssueModal(true);
    };

    const resolveIssue = async () => {
        if (!taskWithIssue) return;

        setResolvingIssue(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user profile for name
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', user.id)
                .single();

            const userName = profile?.full_name || profile?.email || 'Manager';
            const timestamp = new Date().toISOString();

            // Add resolution note to issues
            const resolutionEntry = `\n\n[${new Date(timestamp).toLocaleString()}] RESOLVED by ${userName}`;
            const updatedIssues = (taskWithIssue.issues || '') + resolutionEntry;

            const { error } = await supabase
                .from('tasks')
                .update({
                    issues: updatedIssues,
                    updated_at: timestamp
                })
                .eq('id', taskWithIssue.id);

            if (error) throw error;

            addToast('Issue marked as resolved!', 'success');
            setShowIssueModal(false);
            setTaskWithIssue(null);
            fetchTasks(); // Refresh tasks
        } catch (error) {
            console.error('Error resolving issue:', error);
            addToast('Failed to resolve issue: ' + error.message, 'error');
        } finally {
            setResolvingIssue(false);
        }
    };

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assigned_to: '',
        assign_type: 'individual',
        team_id: '', // Will be set to context teamId
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        due_time: '',
        priority: 'Medium',
        status: 'To Do',
        // Blueprint Fields
        expected_deliverables: '',
        expected_screenshots: 0,
        min_files: 1,
        estimated_hours: 0,
        weight_rule: 'standard',
        auto_approval_allowed: false,
        delay_penalty_percent: 0,
        business_impact_type: 'efficiency',
        allocated_hours: 0 // New Mandatory Field
    });

    // Justification State
    const [showJustificationModal, setShowJustificationModal] = useState(false);
    const [managerJustification, setManagerJustification] = useState('');

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            if (!teamId) {
                setLoading(false); // Stop loading if no team ID
                return;
            }
            setLoading(true);
            await Promise.all([fetchTasks(), fetchEmployees(), fetchTeamDetails()]);
            setLoading(false);
        };
        fetchData();
    }, [teamId]); // Re-fetch if teamId changes

    const fetchTeamDetails = async () => {
        if (!teamId) return;
        const { data, error } = await supabase
            .from('projects')  // Changed from 'teams' to 'projects'
            .select('name')     // Changed from 'team_name' to 'name'
            .eq('id', teamId)
            .single();

        if (error) {
            console.error('Error fetching project details:', error);
        } else if (data) {
            setMyTeamName(data.name);  // Project name is used as "team" name
        }
    };

    const fetchTasks = async () => {
        if (!teamId) return;
        try {
            // Fetch all tasks for this team (Strict Branch Access)
            const { data: tasksData, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('team_id', teamId)
                .order('id', { ascending: false });

            if (tasksError) throw tasksError;



            // Fetch profiles for names
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email');

            if (profilesError) throw profilesError;

            const userMap = {};
            if (profiles) {
                profiles.forEach(p => {
                    userMap[p.id] = p.full_name || p.email;
                });
            }

            if (tasksData) {
                // Fetch assigner names
                const assignerIds = [...new Set(tasksData.map(t => t.assigned_by).filter(id => id))];
                let assignerMap = {};

                if (assignerIds.length > 0) {
                    const { data: assigners } = await supabase.from('profiles').select('id, full_name, email').in('id', assignerIds);
                    if (assigners) assigners.forEach(a => assignerMap[a.id] = a.full_name || a.email);
                }

                const formatted = tasksData.map(t => ({
                    ...t,
                    assignee_name: userMap[t.assigned_to] || 'Unassigned',
                    assigner_name: assignerMap[t.assigned_by] || 'Unknown',
                    team_name: myTeamName
                }));
                setTasks(formatted);
            }
        } catch (error) {
            console.error('Error fetching tasks:', JSON.stringify(error, null, 2));
            addToast('Failed to load tasks', 'error');
        }
    };

    const fetchEmployees = async () => {
        if (!teamId) return;
        // Only fetch employees of this team
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, role, team_id')
            .eq('team_id', teamId);

        if (data) setEmployeesList(data);
    };

    const handleAddTask = async () => {
        if (!newTask.title) {
            addToast('Please enter a task title', 'error');
            return;
        }
        if (newTask.assign_type === 'individual' && !newTask.assigned_to) {
            addToast('Please select an assignee', 'error');
            return;
        }
        if (!newTask.allocated_hours || newTask.allocated_hours <= 0) {
            addToast('Allocated Hours is mandatory and must be greater than 0', 'error');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let tasksToInsert = [];

            // Map display status to database status
            let statusDb = newTask.status.toLowerCase().replace(/ /g, '_');
            if (statusDb === 'to_do') statusDb = 'pending';

            // Calculate due date/time based on allocated hours and business hours
            const allocatedHrs = parseFloat(newTask.allocated_hours) || 0;
            const { dueDate, dueTime } = calculateDueDateTime(new Date(), allocatedHrs);

            if (newTask.assign_type === 'team') {
                // Assign to all filtered employees
                tasksToInsert = employeesList.map(member => ({
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: member.id,
                    assigned_by: user.id,
                    team_id: teamId, // Force context teamId
                    start_date: newTask.start_date,
                    due_date: dueDate, // Calculated based on business hours
                    due_time: dueTime, // Calculated based on business hours
                    priority: newTask.priority.toLowerCase(),
                    status: statusDb,
                    allocated_hours: allocatedHrs
                }));
            } else {
                tasksToInsert = [{
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: newTask.assigned_to,
                    assigned_by: user.id,
                    team_id: teamId, // Force context teamId
                    start_date: newTask.start_date,
                    due_date: dueDate, // Calculated based on business hours
                    due_time: dueTime, // Calculated based on business hours
                    priority: newTask.priority.toLowerCase(),
                    status: statusDb,
                    allocated_hours: allocatedHrs
                }];
            }

            const { data: taskData, error } = await supabase.from('tasks').insert(tasksToInsert).select();

            if (error) throw error;

            if (taskData) {
                const blueprints = taskData.map(t => ({
                    task_id: t.id,
                    expected_deliverables: newTask.expected_deliverables,
                    expected_screenshots: parseInt(newTask.expected_screenshots) || 0,
                    min_files: parseInt(newTask.min_files) || 0,
                    estimated_hours: parseFloat(newTask.estimated_hours) || 0,
                    weight_rule: newTask.weight_rule,
                    auto_approval_allowed: newTask.auto_approval_allowed,
                    delay_penalty_percent: parseFloat(newTask.delay_penalty_percent) || 0,
                    business_impact_type: newTask.business_impact_type
                }));

                const { error: blueprintError } = await supabase.from('task_blueprint').insert(blueprints);
                if (blueprintError) console.error('Error creating blueprint:', blueprintError);
            }



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
        // Team filter removed as it's implicit
        const matchesEmployee = selectedEmployee === 'All' || task.assignee_name === selectedEmployee;
        const matchesStatus = filterStatus === 'All' ||
            (filterStatus === 'Pending' && ['pending', 'to_do', 'to do'].includes(task.status?.toLowerCase())) ||
            (filterStatus === 'In Progress' && ['in_progress', 'in progress'].includes(task.status?.toLowerCase())) ||
            (filterStatus === 'Completed' && ['completed', 'done'].includes(task.status?.toLowerCase()));
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesEmployee && matchesStatus && matchesSearch;
    });

    // Pagination calculations
    const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);
    const startIndex = (currentPage - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedEmployee, filterStatus, searchQuery]);

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

    const handleDeleteTask = async (taskId) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            // Remove from local state
            setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));

            addToast('Task deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting task:', error);
            addToast('Failed to delete task', 'error');
        }
    };

    const handleEditTask = (task) => {
        setEditingTask({
            id: task.id,
            title: task.title,
            description: task.description,
            assigned_to: task.assigned_to,
            due_date: task.due_date,
            priority: task.priority,
            allocated_hours: task.allocated_hours || 0
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTask.title) {
            addToast('Please enter a task title', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    title: editingTask.title,
                    description: editingTask.description,
                    assigned_to: editingTask.assigned_to,
                    due_date: editingTask.due_date,
                    priority: editingTask.priority.toLowerCase(),
                    allocated_hours: parseFloat(editingTask.allocated_hours)
                })
                .eq('id', editingTask.id);

            if (error) throw error;

            // Update local state
            setTasks(prevTasks => prevTasks.map(t =>
                t.id === editingTask.id ? { ...t, ...editingTask } : t
            ));

            addToast('Task updated successfully', 'success');
            setShowEditModal(false);
            setEditingTask(null);
            fetchTasks(); // Refresh to get updated data
        } catch (error) {
            console.error('Error updating task:', error);
            addToast('Failed to update task', 'error');
        }
    };

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{myTeamName ? `${myTeamName} Tasks` : 'Team Tasks'}</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage and track tasks for your team</p>
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

                {/* Employee Filter */}
                <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', cursor: 'pointer', backgroundColor: 'var(--background)' }}
                >
                    <option value="All">All Team Members</option>
                    {employeesList.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
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
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '30%' }}>TASK</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '20%' }}>ASSIGNEE</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '15%' }}>TIME (Act/All)</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '15%' }}>DUE DATE</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '10%' }}>PRIORITY</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '160px' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading team tasks...</td>
                                </tr>
                            ) : paginatedTasks.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks found for your team.</td>
                                </tr>
                            ) : (
                                paginatedTasks.map((task) => (
                                    <tr
                                        key={task.id}
                                        style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.1s' }}
                                    >
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {task.title}
                                            </div>
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
                                        <td style={{ padding: '16px' }}>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                color: (task.actual_hours > task.allocated_hours) ? '#ef4444' : '#1e293b'
                                            }}>
                                                {task.actual_hours || 0} / {task.allocated_hours || 0} hrs
                                                {(task.actual_hours > task.allocated_hours) && (
                                                    <span style={{ display: 'block', fontSize: '0.7rem', color: '#ef4444' }}>Overage!</span>
                                                )}
                                            </div>
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
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setShowTaskDetailsModal(true); }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border)',
                                                        backgroundColor: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        transition: 'all 0.2s',
                                                        whiteSpace: 'nowrap'
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
                                                    <Eye size={14} />
                                                    View
                                                </button>

                                                {/* Edit Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditTask(task);
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border)',
                                                        backgroundColor: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        transition: 'all 0.2s',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#3b82f6';
                                                        e.currentTarget.style.color = 'white';
                                                        e.currentTarget.style.borderColor = '#3b82f6';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'var(--background)';
                                                        e.currentTarget.style.color = 'var(--text-primary)';
                                                        e.currentTarget.style.borderColor = 'var(--border)';
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                    Edit
                                                </button>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Are you sure you want to delete task "${task.title}"?`)) {
                                                            handleDeleteTask(task.id);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        backgroundColor: '#ef4444',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        transition: 'all 0.2s',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>

                                                {task.issues && !task.issues.includes('RESOLVED') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openIssueModal(task); }}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            backgroundColor: '#f59e0b',
                                                            color: 'white',
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 500,
                                                            transition: 'all 0.2s',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d97706'}
                                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f59e0b'}
                                                    >
                                                        <AlertTriangle size={14} />
                                                        Resolve
                                                    </button>
                                                )}
                                            </div>
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

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: 'var(--spacing-xl)', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Assign New {myTeamName} Task</h3>
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
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Allocated Hours *</label>
                                <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={newTask.allocated_hours}
                                    onChange={(e) => setNewTask({ ...newTask, allocated_hours: e.target.value })}
                                    placeholder="e.g. 8.0"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
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
                                            onChange={(e) => setNewTask({ ...newTask, assign_type: e.target.value })}
                                        />
                                        <span>Individual Employee</span>
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="assign_type"
                                            value="team"
                                            checked={newTask.assign_type === 'team'}
                                            onChange={(e) => setNewTask({ ...newTask, assign_type: e.target.value })}
                                        />
                                        <span>Entire Team</span>
                                    </label>
                                </div>
                                {newTask.assign_type === 'individual' && (
                                    <select
                                        value={newTask.assigned_to}
                                        onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                    >
                                        <option value="">Select Team Member</option>
                                        {employeesList.map(emp => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.full_name} ({emp.role})
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

                            {/* Task Completion Rules Section */}
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                <h4 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Task Completion Rules & Blueprint</h4>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Execution Weight</label>
                                        <select
                                            value={newTask.weight_rule}
                                            onChange={(e) => setNewTask({ ...newTask, weight_rule: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                        >
                                            <option value="standard">Standard Impact</option>
                                            <option value="high">High Revenue Impact</option>
                                            <option value="critical">Critical Compliance</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Business Impact Type</label>
                                        <select
                                            value={newTask.business_impact_type}
                                            onChange={(e) => setNewTask({ ...newTask, business_impact_type: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                        >
                                            <option value="efficiency">Efficiency</option>
                                            <option value="revenue">Revenue Generation</option>
                                            <option value="compliance">Compliance / Security</option>
                                            <option value="learning">Learning & Growth</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Min. Proof Files</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newTask.min_files}
                                            onChange={(e) => setNewTask({ ...newTask, min_files: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Est. Hours</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={newTask.estimated_hours}
                                            onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: '12px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Expected Deliverables (Checklist)</label>
                                    <textarea
                                        value={newTask.expected_deliverables}
                                        onChange={(e) => setNewTask({ ...newTask, expected_deliverables: e.target.value })}
                                        placeholder="- Functional Module&#10;- Unit Tests&#10;- Documentation"
                                        rows="3"
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem', resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={newTask.auto_approval_allowed}
                                            onChange={(e) => setNewTask({ ...newTask, auto_approval_allowed: e.target.checked })}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Allow Auto-Approval</span>
                                    </label>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Delay Penalty:</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={newTask.delay_penalty_percent}
                                            onChange={(e) => setNewTask({ ...newTask, delay_penalty_percent: e.target.value })}
                                            style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                                        />
                                        <span style={{ fontSize: '0.9rem' }}>%</span>
                                    </div>
                                </div>
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
                                        backgroundColor: ['completed', 'done'].includes(selectedTask.status?.toLowerCase()) ? '#dcfce7' : ['in_progress', 'in progress'].includes(selectedTask.status?.toLowerCase()) ? '#dbeafe' : '#fef3c7',
                                        color: ['completed', 'done'].includes(selectedTask.status?.toLowerCase()) ? '#15803d' : ['in_progress', 'in progress'].includes(selectedTask.status?.toLowerCase()) ? '#1d4ed8' : '#a16207'
                                    }}>
                                        {getStatusLabel(selectedTask.status)}
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
                            {/* Work Certification Review Section */}
                            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px dashed var(--border)' }}>
                                <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Shield size={20} /> Work Certification & Review
                                </h4>

                                {loadingReview ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading certification data...</div>
                                ) : taskReview ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {/* Scores Panel */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '0.75rem', color: '#64748b', mb: '4px' }}>CONFIDENCE</p>
                                                <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155' }}>{Math.round(taskReview.progress?.confidence_score || 0)}%</p>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '0.75rem', color: '#64748b', mb: '4px' }}>AUTHENTICITY</p>
                                                <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb' }}>{Math.round(taskReview.progress?.authenticity_score || 0)}/100</p>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '0.75rem', color: '#64748b', mb: '4px' }}>RISK LEVEL</p>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '1rem', fontWeight: 'bold', color: taskReview.progress?.risk_flag ? '#dc2626' : '#16a34a' }}>
                                                    {taskReview.progress?.risk_flag ? <><AlertCircle size={16} /> HIGH</> : <><CheckCircle2 size={16} /> LOW</>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Submission Content */}
                                        {taskReview.submission ? (
                                            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                                                <h5 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: '#475569' }}>Employee Submission</h5>
                                                <p style={{ fontSize: '0.9rem', color: '#334155', marginBottom: '12px', whiteSpace: 'pre-wrap', backgroundColor: '#f9fafb', padding: '8px', borderRadius: '6px' }}>
                                                    {taskReview.submission.description || 'No description provided.'}
                                                </p>

                                                <h5 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: '#475569' }}>Proof Files ({taskReview.evidence?.length || 0})</h5>
                                                {taskReview.evidence && taskReview.evidence.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {taskReview.evidence.map((file, i) => (
                                                            <a
                                                                key={i}
                                                                href={file.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                    padding: '8px 12px', backgroundColor: '#f1f5f9', borderRadius: '6px',
                                                                    textDecoration: 'none', color: '#334155', fontSize: '0.85rem',
                                                                    border: '1px solid #e2e8f0', transition: 'background 0.2s'
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                            >
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <FileText size={16} /> File {i + 1} ({file.file_type || 'Unknown'})
                                                                </span>
                                                                <ExternalLink size={14} />
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>No files uploaded.</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.9rem' }}>
                                                No submission found. Employee has not submitted work yet.
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        {taskReview.submission && selectedTask.status !== 'completed' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                                                {isRejecting ? (
                                                    <div style={{ animation: 'fadeIn 0.2s' }}>
                                                        <textarea
                                                            value={rejectionRemark}
                                                            onChange={(e) => setRejectionRemark(e.target.value)}
                                                            placeholder="Enter reason for rejection and feedback..."
                                                            rows="3"
                                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '8px', fontSize: '0.9rem', outline: 'none' }}
                                                            autoFocus
                                                        />
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                onClick={() => setIsRejecting(false)}
                                                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={handleRejectTask}
                                                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: '#dc2626', color: 'white', fontWeight: '600', cursor: 'pointer' }}
                                                            >
                                                                Confirm Rejection
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        <button
                                                            onClick={() => setIsRejecting(true)}
                                                            style={{
                                                                flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #fca5a5',
                                                                backgroundColor: '#fef2f2', color: '#b91c1c', fontWeight: '600',
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                                            }}
                                                        >
                                                            <XCircle size={18} /> Reject & Return
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (selectedTask.actual_hours > selectedTask.allocated_hours) {
                                                                    setShowJustificationModal(true);
                                                                } else {
                                                                    handleApproveTask();
                                                                }
                                                            }}
                                                            style={{
                                                                flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                                                                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                                                color: 'white', fontWeight: '600', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)'
                                                            }}
                                                        >
                                                            <CheckCircle2 size={18} /> Approve & Lock Certification
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {selectedTask.status === 'completed' && (
                                            <div style={{ padding: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', textAlign: 'center', fontWeight: '600', display: 'flex', alignItems: 'center', justifySelf: 'center', gap: '8px' }}>
                                                <CheckCircle2 size={20} /> This task is Certified & Locked.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No review data available.</div>
                                )}
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
                </div>
            )}

            {/* Issue Resolution Modal */}
            {showIssueModal && taskWithIssue && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px', width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px' }}>
                                <AlertTriangle size={24} color="#f59e0b" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Task Issue Details</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{taskWithIssue.title}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '2px solid #fecaca' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertCircle size={18} /> Issue Log
                            </h4>
                            <div style={{ fontSize: '0.9rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', lineHeight: '1.8', maxHeight: '300px', overflowY: 'auto' }}>
                                {taskWithIssue.issues || 'No issues reported'}
                            </div>
                        </div>

                        <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '12px', marginBottom: '24px', border: '1px solid #fde047' }}>
                            <p style={{ fontSize: '0.9rem', color: '#92400e', lineHeight: '1.6' }}>
                                <strong>Note:</strong> Clicking "Mark as Resolved" will add a resolution timestamp to this issue log.
                                The employee will be able to see that the issue has been acknowledged and resolved.
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => { setShowIssueModal(false); setTaskWithIssue(null); }}
                                disabled={resolvingIssue}
                                style={{ padding: '12px 24px', borderRadius: '10px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Close
                            </button>
                            <button
                                onClick={resolveIssue}
                                disabled={resolvingIssue}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <CheckCircle2 size={16} />
                                {resolvingIssue ? 'Resolving...' : 'Mark as Resolved'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Justification Modal for Approval */}
            {showJustificationModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
                }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '16px', color: '#b45309' }}>⏱️ Overage Justification Required</h3>
                        <p style={{ color: '#4b5563', marginBottom: '16px', fontSize: '0.9rem' }}>
                            This task has exceeded its allocated time ({selectedTask?.actual_hours} / {selectedTask?.allocated_hours} hrs).
                            Please provide a justification for this overage to proceed with approval.
                        </p>

                        {selectedTask?.employee_justification && (
                            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#6b7280' }}>EMPLOYEE REASON:</div>
                                <div style={{ fontStyle: 'italic', color: '#1f2937' }}>"{selectedTask.employee_justification}"</div>
                            </div>
                        )}

                        <textarea
                            value={managerJustification}
                            onChange={(e) => setManagerJustification(e.target.value)}
                            placeholder="Enter manager justification..."
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '16px', minHeight: '80px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setShowJustificationModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white' }}>Cancel</button>
                            <button onClick={handleApproveTask} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#b45309', color: 'white', fontWeight: 600 }}>Confirm & Approve</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Task Modal */}
            {showEditModal && editingTask && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: 'var(--spacing-xl)', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Edit Task</h3>
                            <button onClick={() => { setShowEditModal(false); setEditingTask(null); }} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Task Title *</label>
                                <input
                                    type="text"
                                    value={editingTask.title}
                                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                    placeholder="Enter task title"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Description</label>
                                <textarea
                                    value={editingTask.description}
                                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                    placeholder="Enter task description"
                                    rows="3"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem', resize: 'vertical' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Allocated Hours *</label>
                                <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={editingTask.allocated_hours}
                                    onChange={(e) => setEditingTask({ ...editingTask, allocated_hours: e.target.value })}
                                    placeholder="e.g. 8.0"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Assigned To *</label>
                                <select
                                    value={editingTask.assigned_to}
                                    onChange={(e) => setEditingTask({ ...editingTask, assigned_to: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                >
                                    <option value="">Select Employee</option>
                                    {employeesList.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name} ({emp.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Due Date</label>
                                <input
                                    type="date"
                                    value={editingTask.due_date}
                                    onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Priority</label>
                                <select
                                    value={editingTask.priority}
                                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button
                                    onClick={() => { setShowEditModal(false); setEditingTask(null); }}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--border)', backgroundColor: 'var(--background)', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    style={{ flex: 1, backgroundColor: 'var(--primary)', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerTasks;
