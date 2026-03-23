import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Eye, Calendar, ChevronDown, X, Clock, ExternalLink, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2, AlertCircle, Edit2, Trash2, Upload, FileText, Send, ListTodo, Award, StickyNote, Archive } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { supabaseRequest } from '../../lib/supabaseRequest';
import { useProject } from '../employee/context/ProjectContext';
import SkillBadgeIndicator from './SkillBadgeIndicator';
import TaskSkillsSection from './TaskSkillsSection';
import { calculateDueDateTime } from '../../lib/businessHoursUtils';
import TaskNotesModal from './TaskNotesModal';
import TaskDetailOverlay from '../employee/components/UI/TaskDetailOverlay';
import { taskService } from '../../services/modules/task';
import TaskFilters from '../../services/modules/task/TaskFilters';
import TaskTable from '../../services/modules/task/TaskTable';
import AddTaskModal from '../../services/modules/task/AddTaskModal';


const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirement Refinement', short: 'Req' },
    { key: 'design_guidance', label: 'Design Guidance', short: 'Des' },
    { key: 'build_guidance', label: 'Build Guidance', short: 'Bld' },
    { key: 'acceptance_criteria', label: 'Acceptance Criteria', short: 'AC' },
    { key: 'deployment', label: 'Deployment', short: 'Dep' }
];

const AllTasksView = ({ userRole = 'employee', projectRole = 'employee', userId, orgId, addToast, viewMode = 'default', projectId, onBack }) => {
    const { currentProject, projectRole: contextProjectRole } = useProject();

    // Determine which project ID to use: Prop takes precedence over context
    const effectiveProjectId = projectId || currentProject?.id;

    // Use context role if available AND we are using context project, otherwise prop
    const effectiveProjectRole = (currentProject && !projectId) ? contextProjectRole : projectRole;

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilters, setStatusFilters] = useState(['pending', 'in_progress', 'on_hold']); // Default active statuses
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [dateFilter, setDateFilter] = useState('');

    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [processingApproval, setProcessingApproval] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
        };
        getUser();
    }, []);

    // Issue Resolution State
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [taskWithIssue, setTaskWithIssue] = useState(null);
    const [resolvingIssue, setResolvingIssue] = useState(false);
    const [allocatedHoursError, setAllocatedHoursError] = useState('');

    // Edit Task State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    // Proof Submission State
    const [showProofModal, setShowProofModal] = useState(false);
    const [taskForProof, setTaskForProof] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofText, setProofText] = useState('');
    const [proofHours, setProofHours] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Access Request State
    const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);
    const [accessReason, setAccessReason] = useState('');
    const [taskForAccess, setTaskForAccess] = useState(null);
    const [requestingAccess, setRequestingAccess] = useState(false);

    // Task Notes State
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [taskForNotes, setTaskForNotes] = useState(null);

    const handleRequestAccess = async () => {
        if (!accessReason.trim()) {
            addToast?.('Please provide a reason', 'error');
            return;
        }
        setRequestingAccess(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            await taskService.requestTaskAccess(
                taskForAccess.id,
                orgId,
                accessReason,
                user.id,
                taskForAccess.assigned_by,
                taskForAccess.title
            );

            addToast?.('Access requested successfully', 'success');
            setShowAccessRequestModal(false);
            setAccessReason('');
            setTaskForAccess(null);
            fetchData();
        } catch (error) {
            console.error('Access Request Error:', error);
            addToast?.('Failed to request access', 'error');
        } finally {
            setRequestingAccess(false);
        }
    };



    // Access Review Logic
    const [accessReviewTask, setAccessReviewTask] = useState(null);
    const [showAccessReviewModal, setShowAccessReviewModal] = useState(false);
    const [reviewAction, setReviewAction] = useState('approve'); // 'approve', 'reassign', 'close'
    const [closureReason, setClosureReason] = useState('');
    const [reassignTarget, setReassignTarget] = useState('');
    const [processingReview, setProcessingReview] = useState(false);

    const processAccessReview = async () => {
        if (!accessReviewTask) return;
        setProcessingReview(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (reviewAction === 'close' && !closureReason.trim()) {
                addToast('Please provide a reason for closing.', 'error');
                setProcessingReview(false);
                return;
            }
            if (reviewAction === 'reassign' && !reassignTarget) {
                addToast('Please select a new assignee.', 'error');
                setProcessingReview(false);
                return;
            }

            await taskService.processAccessReview({
                task: accessReviewTask,
                action: reviewAction,
                user,
                orgId,
                reason: closureReason,
                reassignTarget
            });

            addToast('Review processed successfully', 'success');
            setShowAccessReviewModal(false);
            setAccessReviewTask(null);
            setClosureReason('');
            setReassignTarget('');
            fetchData();
        } catch (error) {
            console.error('Review Error:', error);
            addToast('Failed to process review: ' + error.message, 'error');
        } finally {
            setProcessingReview(false);
        }
    };






    const fetchEmployees = async () => {
        try {
            const teamMembers = await taskService.getTaskAssignees(orgId, effectiveProjectId);
            setEmployees(teamMembers);
        } catch (error) {
            console.error('Error fetching employees:', error);
            setEmployees([]);
        }
    };

    const fetchData = async () => {
        if (!orgId) return;

        setLoading(true);
        try {
            const enhanced = await taskService.getTasks(orgId, effectiveProjectId, viewMode, userId, userRole);

            // Fix project_name if available in context
            const finalTasks = enhanced.map(t => ({
                ...t,
                project_name: currentProject?.name || t.project_name
            }));

            setTasks(finalTasks);
        } catch (error) {
            addToast?.('Failed to load tasks', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchEmployees();

        const channel = supabase.channel('tasks_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                fetchData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [orgId, effectiveProjectId, viewMode, userRole, userId]);

    const handleUpdateTask = async (taskId, updates) => {
        try {
            await taskService.updateTask(taskId, updates);
            fetchData();
        } catch (error) {
            addToast?.('Update failed', 'error');
            throw error;
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            await taskService.deleteTask(taskId);
            addToast?.('Task deleted', 'success');
            fetchData();
        } catch (error) {
            addToast?.('Failed to delete task', 'error');
        }
    };

    const handleArchiveTask = async (taskId) => {
        try {
            await taskService.archiveTask(taskId);
            addToast?.('Task archived', 'success');
            fetchData();
        } catch (error) {
            addToast?.('Failed to archive task', 'error');
        }
    };



    const handleEditTask = (task) => {
        setEditingTask(task);
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTask) return;
        try {
            const updates = {
                title: editingTask.title,
                description: editingTask.description,
                start_date: editingTask.start_date,
                start_time: editingTask.start_time,
                due_date: editingTask.due_date,
                due_time: editingTask.due_time,
                priority: editingTask.priority
            };
            await handleUpdateTask(editingTask.id, updates);
            setShowEditModal(false);
            setEditingTask(null);
            addToast?.('Task updated', 'success');
        } catch (error) {
            addToast?.('Failed to save changes', 'error');
        }
    };

    const downloadCSV = () => {
        if (!tasks.length) return;
        const headers = ['ID', 'Title', 'Assignee', 'Project', 'Status', 'Priority', 'Allocated Hours', 'Due Date'];
        const csvContent = [
            headers.join(','),
            ...tasks.map(t => [
                t.id,
                `"${t.title.replace(/"/g, '""')}"`,
                `"${t.assignee_name}"`,
                `"${t.project_name}"`,
                t.status,
                t.priority,
                t.allocated_hours || 0,
                t.due_date
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };



    const handleApprovePhase = async (phaseKey) => {
        if (!selectedTask) return;
        if (processingApproval) return;

        setProcessingApproval(true);
        try {
            const { updatedValidations, newSubState, isCompleted } = await taskService.approveTaskPhase(selectedTask, phaseKey, orgId);

            addToast?.('Phase approved successfully', 'success');

            const finalStatus = isCompleted ? 'completed' : selectedTask.status;

            const updatedTask = {
                ...selectedTask,
                phase_validations: updatedValidations,
                sub_state: newSubState,
                status: finalStatus
            };
            setSelectedTask(updatedTask);
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));

        } catch (error) {
            console.error('Error approving phase:', error);
            addToast?.('Failed to approve phase: ' + error.message, 'error');
        } finally {
            setProcessingApproval(false);
        }
    };

    const handleRejectPhase = async (phaseKey) => {
        if (!selectedTask) return;
        if (processingApproval) return;

        setProcessingApproval(true);
        try {
            const updatedValidations = await taskService.rejectTaskPhase(selectedTask, phaseKey, orgId);

            addToast?.('Phase rejected', 'info');

            const updatedTask = {
                ...selectedTask,
                phase_validations: updatedValidations,
                sub_state: 'in_progress'
            };
            setSelectedTask(updatedTask);
            setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t));

        } catch (error) {
            console.error('Error rejecting phase:', error);
            addToast?.('Failed to reject phase: ' + error.message, 'error');
        } finally {
            setProcessingApproval(false);
        }
    };

    const openIssueModal = (task) => {
        // Validation: Check if locked
        const curTime = new Date();
        let dueDateTime = null;
        if (task.due_date) {
            const datePart = task.due_date;
            const timePart = task.due_time ? task.due_time : '23:59:00';
            dueDateTime = new Date(`${datePart}T${timePart}`);
        }
        const isOverdue = dueDateTime && curTime > dueDateTime;
        const isLocked = (task.is_locked || isOverdue) && task.status !== 'completed' && task.access_status !== 'approved';

        if (isLocked) {
            addToast('Task is locked (Overdue). Please request access.', 'error');
            return;
        }

        setTaskWithIssue(task);
        setShowIssueModal(true);
    };

    const resolveIssue = async () => {
        if (!taskWithIssue) return;

        setResolvingIssue(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            await taskService.resolveTaskIssue(taskWithIssue, user, orgId);

            addToast?.('Issue marked as resolved!', 'success');
            setShowIssueModal(false);
            setTaskWithIssue(null);
            fetchData();
        } catch (error) {
            console.error('Error resolving issue:', error);
            addToast?.('Failed to resolve issue: ' + error.message, 'error');
        } finally {
            setResolvingIssue(false);
        }
    };

    const openProofModal = (task) => {
        // Validation: Check if locked
        const curTime = new Date();
        let dueDateTime = null;
        if (task.due_date) {
            const datePart = task.due_date;
            const timePart = task.due_time ? task.due_time : '23:59:00';
            dueDateTime = new Date(`${datePart}T${timePart}`);
        }
        const isOverdue = dueDateTime && curTime > dueDateTime;
        const isLocked = (task.is_locked || isOverdue) && task.status !== 'completed' && task.access_status !== 'approved';

        if (isLocked) {
            addToast('Task is locked (Overdue). Please request access.', 'error');
            return;
        }

        setTaskForProof(task);
        setProofFile(null);
        setProofText('');
        setUploadProgress(0);
        setShowProofModal(true);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                addToast?.('File size must be less than 10MB', 'error');
                return;
            }
            setProofFile(file);
        }
    };

    const handleSubmitProof = async (e) => {
        e.preventDefault();
        if (!taskForProof) return;

        const curTime = new Date();
        let dueDateTime = null;
        if (taskForProof.due_date) {
            const datePart = taskForProof.due_date;
            const timePart = taskForProof.due_time ? taskForProof.due_time : '23:59:00';
            dueDateTime = new Date(`${datePart}T${timePart}`);
        }
        const isOverdue = dueDateTime && curTime > dueDateTime;
        const isLocked = (taskForProof.is_locked || isOverdue) && taskForProof.status !== 'completed' && taskForProof.access_status !== 'approved';

        if (isLocked) {
            addToast('Time exceeded! Submission locked. Please request access.', 'error');
            setShowProofModal(false);
            return;
        }

        if (!proofFile && !proofText.trim()) {
            addToast?.('Please upload a document OR enter a text message', 'error');
            return;
        }

        if (!proofHours) {
            addToast?.('Please enter actual hours spent.', 'error');
            return;
        }

        setUploading(true);
        setUploadProgress(10);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const pointData = await taskService.submitTaskProof({
                task: taskForProof,
                user,
                proofFile,
                proofText,
                proofHours,
                onProgress: setUploadProgress
            });

            if (pointData) {
                addToast?.(`Submitted! Earned: ${pointData.final_points} Points (Bonus: ${pointData.bonus_points || 0}, Penalty: ${pointData.penalty_points || 0})`, 'success');
            } else {
                addToast?.('Proof submitted successfully!', 'success');
            }

            setShowProofModal(false);
            setTaskForProof(null);
            setProofFile(null);
            setProofText('');
            setProofHours('');
            fetchData();

        } catch (error) {
            console.error('Submit proof error:', error);
            addToast?.('Failed to submit proof: ' + error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };



    const normalizeDate = (value) => {
        if (!value) return null;
        let datePart = value;
        if (typeof datePart === 'string' && datePart.includes('/')) {
            const parts = datePart.split('/');
            if (parts.length === 3 && parts[2].length === 4) {
                datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        const parsed = new Date(datePart);
        if (Number.isNaN(parsed.getTime())) return null;
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    };

    const isWithinDateRange = (target, start, end) => {
        if (!target) return false;
        if (!start && !end) return true;
        if (!start) return target <= end;
        if (!end) return target >= start;
        return target >= start && target <= end;
    };

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = (task.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (task.assignee_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        // Hide archived tasks unless 'archived' filter is explicitly selected
        if (task.status?.toLowerCase() === 'archived' && !statusFilters.includes('archived')) return false;
        const matchesStatus = statusFilters.includes('all') || statusFilters.includes(task.status?.toLowerCase());

        // Date filter: show tasks active on selected date (start_date..due_date)
        let matchesDate = true;
        if (dateFilter) {
            const selectedDate = normalizeDate(dateFilter);
            const startDate = normalizeDate(task.start_date || task.due_date);
            const endDate = normalizeDate(task.due_date || task.start_date);
            matchesDate = isWithinDateRange(selectedDate, startDate, endDate);
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</div>;
    }

    if (!tasks) return <div className="p-8 text-red-500">Error: Tasks state is null</div>;
    // Debug info
    // return <div className="p-4 bg-gray-100">DEBUG: Loading: {String(loading)}, Tasks: {tasks.length}, Project: {currentProject?.name}</div>;

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Premium Dark Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                    borderRadius: '20px',
                    padding: '32px 36px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
                }}>
                    {/* Subtle Grid Pattern */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                        backgroundSize: '32px 32px',
                        pointerEvents: 'none'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            {/* Back Button + Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                {onBack && (
                                    <button
                                        onClick={onBack}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: 'rgba(255,255,255,0.7)',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
                                    </button>
                                )}
                                <span style={{
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    color: 'white',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase',
                                    boxShadow: '0 4px 12px rgba(245,158,11,0.4)'
                                }}>
                                    TASK MANAGEMENT
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem' }}>●</span>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 500 }}>
                                    {viewMode === 'my_tasks' ? 'Personal Tasks' : 'Team Collaboration'}
                                </span>
                            </div>

                            {/* Main Title with Gradient */}
                            <h1 style={{
                                fontSize: '2rem',
                                fontWeight: 800,
                                background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 50%, #f59e0b 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                marginBottom: '8px',
                                letterSpacing: '-0.02em'
                            }}>
                                {viewMode === 'my_tasks' ? 'My ' : 'Team '}<span style={{
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #06b6d4 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}>Tasks</span>
                            </h1>

                            {/* Description */}
                            <p style={{
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '0.95rem',
                                maxWidth: '500px',
                                lineHeight: 1.5
                            }}>
                                {viewMode === 'my_tasks' ? 'Track your personal tasks through the lifecycle' : 'Manage and track all team tasks in one place'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                            {(userRole === 'manager' || userRole === 'executive') && (!effectiveProjectRole || effectiveProjectRole === 'manager' || effectiveProjectRole === 'team_lead') && (
                                <button
                                    onClick={() => setShowAddTaskModal(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 20px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <Plus size={18} />
                                    New Task
                                </button>
                            )}
                            <button
                                onClick={downloadCSV}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 16px',
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '10px',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <ExternalLink size={16} /> Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                <TaskFilters
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    dateFilter={dateFilter}
                    setDateFilter={setDateFilter}
                    statusFilters={statusFilters}
                    setStatusFilters={setStatusFilters}
                    showStatusDropdown={showStatusDropdown}
                    setShowStatusDropdown={setShowStatusDropdown}
                />

                {/* Task List */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : tasks.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#6b7280' }}>
                        <ListTodo size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>No tasks found</p>
                        <p style={{ fontSize: '0.875rem' }}>You're all caught up!</p>
                    </div>
                ) : (
                    <TaskTable
                        loading={loading}
                        tasks={filteredTasks}
                        viewMode={viewMode}
                        userRole={userRole}
                        userId={userId}
                        handleUpdateTask={handleUpdateTask}
                        handleArchiveTask={handleArchiveTask}
                        handleEditTask={handleEditTask}
                        setSelectedTask={setSelectedTask}
                        setTaskForAccess={setTaskForAccess}
                        setShowAccessRequestModal={setShowAccessRequestModal}
                        setAccessReviewTask={setAccessReviewTask}
                        setReviewAction={setReviewAction}
                        setShowAccessReviewModal={setShowAccessReviewModal}
                        openIssueModal={openIssueModal}
                        openProofModal={openProofModal}
                        addToast={addToast}
                        orgId={orgId}
                        onApprovePhase={handleApprovePhase}
                        onRejectPhase={handleRejectPhase}
                        onShowAccessRequest={(t) => {
                            setTaskForAccess(t);
                            setShowAccessRequestModal(true);
                        }}
                        onShowAccessReview={(t) => {
                            setAccessReviewTask(t);
                            setShowAccessReviewModal(true);
                        }}
                    />
                )}

                <AddTaskModal
                    isOpen={showAddTaskModal}
                    onClose={() => setShowAddTaskModal(false)}
                    onTaskAdded={() => {
                        fetchData();
                        setShowAddTaskModal(false);
                        addToast('Task created successfully', 'success');
                    }}
                    employees={employees}
                    user={currentUser}
                    orgId={orgId}
                    effectiveProjectId={effectiveProjectId}
                    addToast={addToast}
                />


                {/* Issue Resolution Modal */}
                {
                    showIssueModal && taskWithIssue && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, backdropFilter: 'blur(4px)' }}>
                            <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '20px', width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px' }}>
                                        <AlertTriangle size={24} color="#f59e0b" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Task Issue Details</h3>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{taskWithIssue.title}</p>
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
                                        style={{ padding: '12px 24px', borderRadius: '10px', backgroundColor: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600, color: '#64748b' }}
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
                    )
                }

                {/* Edit Task Modal */}
                {
                    showEditModal && editingTask && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Edit Task</h3>
                                    <button onClick={() => { setShowEditModal(false); setEditingTask(null); }} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Task Title *</label>
                                        <input
                                            type="text"
                                            value={editingTask.title}
                                            onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                                            placeholder="Enter task title"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' }}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Description</label>
                                        <textarea
                                            value={editingTask.description}
                                            onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                            placeholder="Enter task description (use new lines for points)"
                                            rows="3"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', resize: 'vertical' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Allocated Hours *</label>
                                        <input
                                            type="number"
                                            min="0.5"
                                            step="0.5"
                                            value={editingTask.allocated_hours}
                                            onChange={(e) => setEditingTask({ ...editingTask, allocated_hours: e.target.value })}
                                            placeholder="e.g. 8.0"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Assigned To *</label>
                                        <select
                                            value={editingTask.assigned_to}
                                            onChange={(e) => setEditingTask({ ...editingTask, assigned_to: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white' }}
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>
                                                    {emp.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Due Date</label>
                                        <input
                                            type="date"
                                            value={editingTask.due_date}
                                            onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Priority</label>
                                        <select
                                            value={editingTask.priority}
                                            onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white' }}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Status</label>
                                        <select
                                            value={editingTask.status}
                                            onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white' }}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="on hold">On Hold</option>
                                        </select>
                                    </div>

                                    {/* Lifecycle Stages Selection for Edit - Managers/Team Leads */}
                                    {(userRole === 'manager' || userRole === 'team_lead') && (
                                        <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                                Required Lifecycle Stages <span style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                {LIFECYCLE_PHASES.map(phase => (
                                                    <label key={phase.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={editingTask.requiredPhases ? editingTask.requiredPhases.includes(phase.key) : false}
                                                            onChange={(e) => {
                                                                const currentPhases = editingTask.requiredPhases || [];
                                                                if (e.target.checked) {
                                                                    const newPhases = [...currentPhases, phase.key];
                                                                    // Sort to keep order
                                                                    newPhases.sort((a, b) => {
                                                                        const idxA = LIFECYCLE_PHASES.findIndex(p => p.key === a);
                                                                        const idxB = LIFECYCLE_PHASES.findIndex(p => p.key === b);
                                                                        return idxA - idxB;
                                                                    });
                                                                    setEditingTask({ ...editingTask, requiredPhases: newPhases });
                                                                } else {
                                                                    if (currentPhases.length > 1) {
                                                                        setEditingTask({ ...editingTask, requiredPhases: currentPhases.filter(p => p !== phase.key) });
                                                                    }
                                                                }
                                                            }}
                                                            disabled={editingTask.status === 'completed' || editingTask.status === 'cancelled'}
                                                            style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                                                        />
                                                        {phase.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                        <button
                                            onClick={() => { setShowEditModal(false); setEditingTask(null); }}
                                            style={{ flex: 1, padding: '12px', borderRadius: '8px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', color: '#64748b' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Are you sure you want to delete task "${editingTask.title}"?`)) {
                                                    handleDeleteTask(editingTask.id);
                                                    setShowEditModal(false);
                                                    setEditingTask(null);
                                                }
                                            }}
                                            style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        >
                                            <Trash2 size={16} />
                                            Delete
                                        </button>
                                        <button
                                            onClick={handleSaveEdit}
                                            style={{ flex: 1, backgroundColor: '#0f172a', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Proof Submission Modal */}
                {
                    showProofModal && taskForProof && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '20px', width: '550px', maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                    <div style={{ backgroundColor: '#ede9fe', borderRadius: '12px', padding: '12px' }}>
                                        <Upload size={24} color="#8b5cf6" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>Submit Proof for Validation</h3>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>{taskForProof.title}</p>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ flexShrink: 0, marginTop: '2px' }}><AlertTriangle size={18} color="#b45309" /></div>
                                    <div style={{ fontSize: '0.9rem', color: '#92400e', lineHeight: '1.5' }}>
                                        <strong>Submission Required:</strong> Please upload a document OR enter a text description as proof of completion to proceed to the next phase.
                                    </div>
                                </div>

                                {/* File Upload Section */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                                        Upload Document (Optional)
                                    </label>
                                    <div style={{
                                        border: '2px dashed #e2e8f0',
                                        borderRadius: '12px',
                                        padding: '24px',
                                        textAlign: 'center',
                                        backgroundColor: proofFile ? '#f0fdf4' : '#f8fafc',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        borderColor: proofFile ? '#86efac' : '#e2e8f0'
                                    }}
                                        onClick={() => document.getElementById('proof-file-input').click()}
                                    >
                                        <input id="proof-file-input" type="file" onChange={handleFileChange} style={{ display: 'none' }}
                                            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.zip,.txt" />
                                        {proofFile ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                <FileText size={32} color="#10b981" />
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.95rem' }}>{proofFile.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{(proofFile.size / 1024).toFixed(1)} KB</div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setProofFile(null); }}
                                                    style={{
                                                        marginLeft: 'auto',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: '#ef4444',
                                                        padding: '4px'
                                                    }}
                                                    title="Remove file"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={32} color="#94a3b8" style={{ marginBottom: '12px' }} />
                                                <div style={{ color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Click to upload file</div>
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>PDF, DOC, Images, ZIP (max 10MB)</div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div style={{ width: '100%', height: '1px', backgroundColor: '#e2e8f0', margin: '24px 0' }}></div>

                                {/* Actual Hours Input */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                                        Actual Hours Spent <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            value={proofHours}
                                            onChange={(e) => setProofHours(e.target.value)}
                                            placeholder="e.g., 4.5"
                                            step="0.5"
                                            style={{
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.95rem',
                                                outline: 'none',
                                                width: '120px'
                                            }}
                                        />
                                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            Allocated: <span style={{ fontWeight: 700 }}>{taskForProof?.allocated_hours || 0}h</span>
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                        Enter total hours spent on this task. Used for points calculation.
                                    </p>
                                </div>

                                {/* Text Input Section */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
                                        Text Submission / Notes (Optional)
                                    </label>
                                    <textarea
                                        value={proofText}
                                        onChange={(e) => setProofText(e.target.value)}
                                        placeholder="Enter details, links, or notes about your submission..."
                                        rows="4"
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.95rem',
                                            resize: 'vertical',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                            minHeight: '100px'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                    />
                                </div>

                                {uploading && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                                            <span>Processing Submission...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#8b5cf6', transition: 'width 0.3s', borderRadius: '3px' }} />
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                    <button
                                        onClick={() => { setShowProofModal(false); setTaskForProof(null); setProofFile(null); setProofText(''); }}
                                        disabled={uploading}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            backgroundColor: 'white',
                                            border: '1px solid #e2e8f0',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            color: '#64748b',
                                            fontSize: '0.95rem'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitProof}
                                        disabled={(!proofFile && !proofText.trim()) || uploading}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            background: (!proofFile && !proofText.trim()) ? '#e2e8f0' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                            color: (!proofFile && !proofText.trim()) ? '#94a3b8' : 'white',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: (!proofFile && !proofText.trim()) ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '0.95rem',
                                            boxShadow: (!proofFile && !proofText.trim()) ? 'none' : '0 4px 15px rgba(139, 92, 246, 0.3)'
                                        }}
                                    >
                                        <Send size={16} />
                                        {uploading ? 'Submitting...' : 'Submit Proof'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Access Request Modal */}
                {
                    showAccessRequestModal && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '450px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                                <h3 style={{ marginTop: 0, fontSize: '1.25rem', color: '#111827' }}>Request Task Access</h3>
                                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '16px' }}>
                                    The deadline for this task has passed. Please provide a reason to request renewed access.
                                </p>

                                <textarea
                                    value={accessReason}
                                    onChange={(e) => setAccessReason(e.target.value)}
                                    placeholder="Reason for late submission or access request..."
                                    style={{
                                        width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', marginBottom: '16px', outline: 'none'
                                    }}
                                />

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button
                                        onClick={() => setShowAccessRequestModal(false)}
                                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRequestAccess}
                                        disabled={requestingAccess}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', border: 'none',
                                            backgroundColor: '#ea580c', color: 'white', cursor: requestingAccess ? 'wait' : 'pointer', fontWeight: 600
                                        }}
                                    >
                                        {requestingAccess ? 'Sending Request...' : 'Submit Request'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
                {/* Access Review Modal (Manager) */}
                {
                    showAccessReviewModal && accessReviewTask && (
                        <div style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)'
                        }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                                <h3 style={{ marginTop: 0, marginBottom: '4px', fontSize: '1.25rem', color: '#111827' }}>Review Access Request</h3>
                                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>Task: <span style={{ fontWeight: 600, color: '#374151' }}>{accessReviewTask.title}</span></p>

                                <div style={{ backgroundColor: '#fff7ed', padding: '12px', borderRadius: '8px', border: '1px solid #ffedd5', marginBottom: '20px' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#c2410c', fontWeight: 600 }}>Request Reason:</p>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#9a3412' }}>{accessReviewTask.access_reason}</p>
                                </div>

                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Action</label>
                                <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#f3f4f6', borderRadius: '8px', marginBottom: '20px' }}>
                                    {['approve', 'reassign', 'close'].map(action => (
                                        <button
                                            key={action}
                                            onClick={() => setReviewAction(action)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: reviewAction === action ? 'white' : 'transparent',
                                                color: reviewAction === action ? '#0f172a' : '#6b7280',
                                                fontWeight: reviewAction === action ? 700 : 500,
                                                boxShadow: reviewAction === action ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                textTransform: 'capitalize',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {action}
                                        </button>
                                    ))}
                                </div>

                                {reviewAction === 'reassign' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Reassign To</label>
                                        <select
                                            value={reassignTarget}
                                            onChange={(e) => setReassignTarget(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }}
                                        >
                                            <option value="">Select Employee</option>
                                            {employees.filter(e => e.id !== accessReviewTask.assigned_to).map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {reviewAction === 'close' && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Closure Reason *</label>
                                        <textarea
                                            value={closureReason}
                                            onChange={(e) => setClosureReason(e.target.value)}
                                            placeholder="Explain why the task is being closed..."
                                            style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.9rem' }}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '20px' }}>
                                    <button
                                        onClick={() => { setShowAccessReviewModal(false); setAccessReviewTask(null); }}
                                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={processAccessReview}
                                        disabled={processingReview}
                                        style={{
                                            padding: '10px 20px', borderRadius: '8px', border: 'none',
                                            backgroundColor: reviewAction === 'close' ? '#ef4444' : '#0f172a',
                                            color: 'white', cursor: processingReview ? 'wait' : 'pointer', fontWeight: 600
                                        }}
                                    >
                                        {processingReview ? 'Processing...' : 'Confirm Action'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >

            {/* Task Detail Overlay */}
            {selectedTask && (
                <TaskDetailOverlay
                    isOpen={true}
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onRefresh={fetchData}
                    addToast={addToast}
                    userId={userId}
                    userRole={userRole}
                    orgId={orgId}
                    onApprovePhase={handleApprovePhase}
                    onRejectPhase={handleRejectPhase}
                    onShowAccessRequest={(t) => {
                        setTaskForAccess(t);
                        setShowAccessRequestModal(true);
                    }}
                    onShowAccessReview={(t) => {
                        setAccessReviewTask(t);
                        setShowAccessReviewModal(true);
                    }}
                />
            )}

            {/* Task Notes Modal */}
            <TaskNotesModal
                isOpen={showNotesModal}
                onClose={() => { setShowNotesModal(false); setTaskForNotes(null); }}
                task={taskForNotes}
                userId={userId}
                userRole={userRole}
                orgId={orgId}
                addToast={addToast}
                canAddNote={
                    // Managers/executives can add notes to any task
                    ['manager', 'team_lead', 'executive', 'org_admin'].includes(userRole) ||
                    // Assigned employee can add notes to their own task
                    (taskForNotes?.assigned_to === userId)
                }
            />
        </>
    );
};

export default AllTasksView;
