import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Plus, X, User, Users, Filter, Search, Calendar, CheckCircle2, Circle, Clock, AlertCircle, ChevronLeft, ChevronRight, Eye, Shield, FileText, ExternalLink, XCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../../../lib/supabaseClient';


const TeamTasks = ({ orgId }) => {
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
    const [isRejecting, setIsRejecting] = useState(false);

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
            const { data: progress } = await supabase.from('task_progress').select('*').eq('task_id', taskId).eq('org_id', orgId).single();

            // 2. Get Confirm Submission
            const { data: submission } = await supabase.from('task_submissions').select('*').eq('task_id', taskId).eq('org_id', orgId).order('submission_time', { ascending: false }).limit(1).single();

            // 3. Get Evidence
            let evidence = [];
            if (submission) {
                const { data: evidenceData } = await supabase.from('task_evidence').select('*').eq('submission_id', submission.id).eq('org_id', orgId);
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
                org_id: orgId,
                approved: true,
                comment: 'Certification Approved via Dashboard',
                reviewed_at: new Date()
            });
            // 1.5 Ensure Submission Exists & Calculate Points
            const { data: existingSub } = await supabase
                .from('task_submissions')
                .select('id')
                .eq('task_id', selectedTask.id)
                .maybeSingle();

            if (!existingSub) {
                // Auto-create submission on approval if missing (Employee didn't submit proof)
                // Defaulting actual_hours to allocated_hours for now (Standard Completion)
                await supabase.from('task_submissions').insert({
                    task_id: selectedTask.id,
                    user_id: selectedTask.assigned_to,
                    actual_hours: selectedTask.allocated_hours || 0,
                    submitted_at: new Date().toISOString(),
                    status: 'approved'
                });
            } else {
                // Ensure status is approved
                await supabase.from('task_submissions')
                    .update({ status: 'approved' })
                    .eq('id', existingSub.id);
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
                org_id: orgId,
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
        business_impact_type: 'efficiency'
    });

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
            .from('teams')
            .select('team_name')
            .eq('id', teamId)
            .eq('org_id', orgId)
            .single();

        if (error) {
            console.error('Error fetching team details:', error);
        } else if (data) {
            setMyTeamName(data.team_name);
        }
    };

    const fetchTasks = async () => {
        if (!teamId) return;
        try {
            // First, get all team member IDs
            const { data: teamMembers, error: membersError } = await supabase
                .from('profiles')
                .select('id')
                .eq('team_id', teamId)
                .eq('org_id', orgId);

            if (membersError) throw membersError;

            if (!teamMembers || teamMembers.length === 0) {
                setTasks([]);
                return;
            }

            const memberIds = teamMembers.map(m => m.id);

            // Fetch all tasks assigned to these team members, ordered by latest first
            const { data: tasksData, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .in('assigned_to', memberIds)
                .eq('org_id', orgId)
                .order('id', { ascending: false }); // Show latest tasks first

            if (tasksError) throw tasksError;

            // Fetch profiles for names
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('org_id', orgId);

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
                    const { data: assigners } = await supabase.from('profiles').select('id, full_name, email').in('id', assignerIds).eq('org_id', orgId);
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
            .eq('team_id', teamId)
            .eq('org_id', orgId);

        if (data) setEmployeesList(data);
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

            if (newTask.assign_type === 'team') {
                // Assign to all filtered employees
                tasksToInsert = employeesList.map(member => ({
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: member.id,
                    assigned_by: user.id,
                    team_id: teamId, // Force context teamId
                    start_date: newTask.start_date,
                    due_date: newTask.due_date,
                    due_time: newTask.due_time || null,
                    priority: newTask.priority.toLowerCase(),
                    status: statusDb,
                    org_id: orgId
                }));
            } else {
                tasksToInsert = [{
                    title: newTask.title,
                    description: newTask.description,
                    assigned_to: newTask.assigned_to,
                    assigned_by: user.id,
                    team_id: teamId, // Force context teamId
                    start_date: newTask.start_date,
                    due_date: newTask.due_date,
                    priority: newTask.priority.toLowerCase(),
                    status: statusDb,
                    org_id: orgId
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
                .eq('id', taskId)
                .eq('org_id', orgId);

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
                    <p style={{ color: 'var(--text-secondary)' }}>View and track tasks assigned by your manager</p>
                </div>
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
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '18%' }}>DUE DATE</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '16%' }}>PRIORITY</th>
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '16%' }}>STATUS</th>
                                <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', width: '8%' }}>ACTIONS</th>
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
                                                            onClick={handleApproveTask}
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
        </div>
    );
};

export default TeamTasks;
