import React, { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, XCircle, Clock, User, ChevronRight, Eye, History, X, Send, AlertTriangle, Inbox, Users, ArrowRight, BarChart3, Paperclip, FileText, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import EmployeeRecognitionBoard from './EmployeeRecognitionBoard';

// Lifecycle phases
const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirements', short: 'REQ', color: '#8b5cf6' },
    { key: 'design_guidance', label: 'Design', short: 'DES', color: '#06b6d4' },
    { key: 'build_guidance', label: 'Build', short: 'BLD', color: '#f59e0b' },
    { key: 'acceptance_criteria', label: 'Acceptance', short: 'ACC', color: '#10b981' },
    { key: 'deployment', label: 'Deployment', short: 'DEP', color: '#3b82f6' },
    { key: 'closed', label: 'Closed', short: 'DONE', color: '#095b1ced' }
];

const getPhaseInfo = (phase) => LIFECYCLE_PHASES.find(p => p.key === phase) || LIFECYCLE_PHASES[0];
const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);

// Helper to get next lifecycle phase
const getNextPhase = (currentPhase) => {
    const phases = ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment', 'closed'];
    const idx = phases.indexOf(currentPhase);
    return idx >= 0 && idx < phases.length - 1 ? phases[idx + 1] : 'closed';
};

const ManagerTaskDashboard = ({ userRole = 'manager', userId, addToast }) => {
    const [activeTab, setActiveTab] = useState('validation');
    const [validationQueue, setValidationQueue] = useState([]);
    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [filterPhase, setFilterPhase] = useState('all');
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskHistory, setTaskHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [taskToReject, setTaskToReject] = useState(null);
    const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0, byPhase: {} });
    const [teamAnalytics, setTeamAnalytics] = useState({ myStats: null, teamMembers: [] });

    // Proof preview modal state
    const [showProofPreview, setShowProofPreview] = useState(false);
    const [proofPreviewUrl, setProofPreviewUrl] = useState('');

    // Issue resolution state
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [taskWithIssue, setTaskWithIssue] = useState(null);
    const [resolvingIssue, setResolvingIssue] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, [userId]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchValidationQueue(), fetchAllTasks()]);
        } finally {
            setLoading(false);
        }
    };

    const fetchValidationQueue = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Try RPC first
            const { data, error } = await supabase.rpc('get_validation_queue', { p_manager_id: user.id });

            if (!error && data && data.length > 0) {
                setValidationQueue(data);
                return;
            }

            // Fallback: Direct query for pending validation tasks
            console.log('RPC returned empty or errored, using fallback query');

            // 1. Get org_id from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('org_id')
                .eq('id', user.id)
                .single();

            if (!profile?.org_id) {
                console.error('No org_id found for user');
                return;
            }

            const { data: tasksData, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('sub_state', 'pending_validation')
                .eq('org_id', profile.org_id); // STRICT FILTER BY ORG_ID

            if (tasksError) throw tasksError;

            if (tasksData && tasksData.length > 0) {
                // Fetch assignee names
                const assigneeIds = [...new Set(tasksData.map(t => t.assigned_to).filter(Boolean))];
                let namesMap = {};
                if (assigneeIds.length > 0) {
                    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', assigneeIds);
                    if (profiles) profiles.forEach(p => namesMap[p.id] = p.full_name);
                }

                const formatted = tasksData.map(t => ({
                    task_id: t.id,
                    title: t.title,
                    lifecycle_state: t.lifecycle_state || 'requirement_refiner',
                    requested_next_state: getNextPhase(t.lifecycle_state || 'requirement_refiner'),
                    assigned_to_name: namesMap[t.assigned_to] || 'Unknown',
                    sub_state: t.sub_state,
                    proof_url: t.proof_url
                }));

                setValidationQueue(formatted);
            }
        } catch (error) {
            console.error('Error fetching validation queue:', error);
        }
    };

    const fetchAllTasks = async () => {
        try {
            const { data: tasksData, error } = await supabase
                .from('tasks')
                .select('*')
                .neq('lifecycle_state', 'closed');

            if (error) throw error;

            if (tasksData) {
                // Fetch names
                const assigneeIds = [...new Set(tasksData.map(t => t.assigned_to).filter(Boolean))];
                let namesMap = {};
                if (assigneeIds.length > 0) {
                    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', assigneeIds);
                    if (profiles) profiles.forEach(p => namesMap[p.id] = p.full_name);
                }

                const formatted = tasksData.map(t => ({
                    ...t,
                    assignee_name: namesMap[t.assigned_to] || 'Unknown',
                    lifecycle_state: t.lifecycle_state || 'requirement_refiner',
                    sub_state: t.sub_state || 'in_progress'
                }));

                setAllTasks(formatted);

                // Calculate stats
                const pending = formatted.filter(t => t.sub_state === 'pending_validation').length;
                const approved = formatted.filter(t => t.sub_state === 'approved').length;
                const byPhase = {};
                LIFECYCLE_PHASES.forEach(p => {
                    byPhase[p.key] = formatted.filter(t => t.lifecycle_state === p.key).length;
                });
                setStats({ pending, approved, total: formatted.length, byPhase });
            }

            // Fetch Team Analytics (Time & Effort)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // 1. Fetch My Data (Manager) & Team Members
                // First get my team_id
                const { data: myProfile } = await supabase.from('profiles').select('team_id').eq('id', user.id).single();

                let teamMembers = [];
                if (myProfile && myProfile.team_id) {
                    const { data: members } = await supabase.from('profiles').select('id, full_name, role').eq('team_id', myProfile.team_id);
                    teamMembers = members || [];
                }

                // Add myself if not in list (though usually managers are part of team or separate)
                if (!teamMembers.find(m => m.id === user.id)) {
                    // Fetch my details if needed, but for now assume logic handles it
                }

                const allMemberIds = teamMembers.map(m => m.id);
                if (!allMemberIds.includes(user.id)) allMemberIds.push(user.id);

                // 2. Fetch Tasks for all these users
                const { data: analyticsTasks } = await supabase
                    .from('tasks')
                    .select('id, project_id, assigned_to')
                    .in('assigned_to', allMemberIds);

                // 3. Fetch Attendance
                const { data: analyticsAttendance } = await supabase
                    .from('attendance')
                    .select('employee_id, total_hours')
                    .in('employee_id', allMemberIds);

                // 4. Fetch Projects
                const { data: projectsData } = await supabase.from('projects').select('id, name');
                const projectsMap = {};
                if (projectsData) projectsData.forEach(p => projectsMap[p.id] = p.name);

                // Calculate Logic
                const calculateMemberStats = (memberId) => {
                    const memberTasks = analyticsTasks ? analyticsTasks.filter(t => t.assigned_to === memberId) : [];
                    const memberAttendance = analyticsAttendance ? analyticsAttendance.filter(a => a.employee_id === memberId) : [];
                    const totalHours = memberAttendance.reduce((acc, curr) => acc + (parseFloat(curr.total_hours) || 0), 0);

                    const dist = {};
                    memberTasks.forEach(task => {
                        if (task.project_id && projectsMap[task.project_id]) {
                            if (!dist[task.project_id]) dist[task.project_id] = { name: projectsMap[task.project_id], count: 0 };
                            dist[task.project_id].count++;
                        }
                    });

                    return Object.values(dist).map(p => ({
                        name: p.name,
                        hours: memberTasks.length > 0 ? (totalHours * (p.count / memberTasks.length)) : 0
                    })).sort((a, b) => b.hours - a.hours);
                };

                // My Stats
                const myBreakdown = calculateMemberStats(user.id);

                // Team Stats
                const teamStats = teamMembers.filter(m => m.id !== user.id).map(m => ({
                    id: m.id,
                    name: m.full_name,
                    role: m.role,
                    breakdown: calculateMemberStats(m.id)
                }));

                setTeamAnalytics({
                    myStats: myBreakdown,
                    teamMembers: teamStats
                });
            }

        } catch (error) {
            console.error('Error fetching tasks:', error);
        }
    };

    const fetchTaskHistory = async (taskId) => {
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_task_history', { p_task_id: taskId });
            if (error) throw error;
            setTaskHistory(data || []);
        } catch (error) {
            setTaskHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const approveTask = async (task) => {
        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.rpc('approve_task', {
                p_task_id: task.task_id || task.id,
                p_manager_id: user.id,
                p_comment: null
            });

            if (error) throw error;
            if (data?.success) {
                addToast?.(`Task approved! Advanced to ${data.new_lifecycle_state?.replace('_', ' ')}`, 'success');
                fetchAllData();
            } else {
                addToast?.(data?.message || 'Failed to approve task', 'error');
            }
        } catch (error) {
            addToast?.('Failed to approve task', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const rejectTask = async () => {
        if (!rejectReason.trim()) {
            addToast?.('Please provide a reason for rejection', 'error');
            return;
        }

        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase.rpc('reject_task', {
                p_task_id: taskToReject.task_id || taskToReject.id,
                p_manager_id: user.id,
                p_reason: rejectReason
            });

            if (error) throw error;
            if (data?.success) {
                addToast?.('Task rejected with feedback', 'success');
                setShowRejectModal(false);
                setRejectReason('');
                setTaskToReject(null);
                fetchAllData();
            }
        } catch (error) {
            addToast?.('Failed to reject task', 'error');
        } finally {
            setActionLoading(false);
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

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', user.id)
                .single();

            const userName = profile?.full_name || profile?.email || 'Manager';
            const timestamp = new Date().toISOString();

            const resolutionEntry = `\n\n[${new Date(timestamp).toLocaleString()}] RESOLVED by ${userName}`;
            const updatedIssues = (taskWithIssue.issues || '') + resolutionEntry;

            const { error } = await supabase
                .from('tasks')
                .update({
                    issues: updatedIssues,
                    updated_at: timestamp
                })
                .eq('id', taskWithIssue.task_id || taskWithIssue.id);

            if (error) throw error;

            addToast?.('Issue marked as resolved!', 'success');
            setShowIssueModal(false);
            setTaskWithIssue(null);
            fetchAllData();
        } catch (error) {
            console.error('Error resolving issue:', error);
            addToast?.('Failed to resolve issue: ' + error.message, 'error');
        } finally {
            setResolvingIssue(false);
        }
    };

    const openRejectModal = (task) => {
        setTaskToReject(task);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const getSubStateStyle = (subState) => {
        const styles = {
            'in_progress': { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', text: '#fff' },
            'pending_validation': { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', text: '#fff' },
            'approved': { bg: 'linear-gradient(135deg, #10b981, #059669)', text: '#fff' },
            'rejected': { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', text: '#fff' }
        };
        return styles[subState] || styles['in_progress'];
    };

    // Filter tasks
    const filteredTasks = allTasks.filter(task => {
        const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.assignee_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPhase = filterPhase === 'all' || task.lifecycle_state === filterPhase;

        // Date filter
        const matchesDate = !dateFilter || (task.due_date && task.due_date === dateFilter);

        // Status filter
        const matchesStatus = statusFilter === 'all' ||
            (task.status?.toLowerCase() === statusFilter.toLowerCase()) ||
            (task.sub_state?.replace('_', ' ').toLowerCase() === statusFilter.toLowerCase());

        return matchesSearch && matchesPhase && matchesDate && matchesStatus;
    });

    // Group tasks by employee
    const tasksByEmployee = filteredTasks.reduce((acc, task) => {
        const name = task.assignee_name || 'Unassigned';
        if (!acc[name]) acc[name] = [];
        acc[name].push(task);
        return acc;
    }, {});

    const LifecycleProgressMini = ({ phase }) => {
        const currentIndex = getPhaseIndex(phase);
        return (
            <div style={{ display: 'flex', gap: '2px' }}>
                {LIFECYCLE_PHASES.slice(0, -1).map((p, idx) => (
                    <div key={p.key} style={{
                        width: '20px',
                        height: '4px',
                        borderRadius: '2px',
                        backgroundColor: idx <= currentIndex ? p.color : '#e5e7eb',
                        transition: 'all 0.3s'
                    }} title={p.label} />
                ))}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '0' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Task Lifecycle Management
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Review, approve, and track task progression across your team
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    borderRadius: '16px',
                    padding: '20px',
                    color: 'white',
                    boxShadow: '0 10px 40px rgba(245, 158, 11, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '10px' }}>
                            <Inbox size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{validationQueue.length}</div>
                            <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Pending Validation</div>
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    borderRadius: '16px',
                    padding: '20px',
                    color: 'white',
                    boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '10px' }}>
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total}</div>
                            <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Active Tasks</div>
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '16px',
                    padding: '20px',
                    color: 'white',
                    boxShadow: '0 10px 40px rgba(16, 185, 129, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '10px' }}>
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.approved}</div>
                            <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Approved Today</div>
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    borderRadius: '16px',
                    padding: '20px',
                    color: 'white',
                    boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', padding: '10px' }}>
                            <Users size={24} />
                        </div>
                        <div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{Object.keys(tasksByEmployee).length}</div>
                            <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Team Members</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: 'var(--surface)',
                padding: '6px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                width: 'fit-content'
            }}>
                {[
                    { id: 'validation', label: 'Validation Queue', icon: Inbox, count: validationQueue.length },
                    { id: 'all', label: 'All Tasks', icon: BarChart3, count: stats.total },
                    { id: 'byEmployee', label: 'By Employee', icon: Users, count: Object.keys(tasksByEmployee).length },
                    { id: 'time_effort', label: 'Time & Effort', icon: Clock, count: 0 }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: activeTab === tab.id ? 'var(--text-primary)' : 'transparent',
                            color: activeTab === tab.id ? 'var(--surface)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                        {tab.count > 0 && (
                            <span style={{
                                backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--border)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem'
                            }}>{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Validation Queue Tab */}
            {activeTab === 'validation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {validationQueue.length === 0 ? (
                        <div style={{
                            backgroundColor: 'var(--surface)',
                            borderRadius: '16px',
                            padding: '48px',
                            textAlign: 'center',
                            border: '1px solid var(--border)'
                        }}>
                            <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>All Caught Up!</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>No tasks are pending your validation right now.</p>
                        </div>
                    ) : (
                        validationQueue.map((task, idx) => (
                            <div key={task.task_id || idx} style={{
                                backgroundColor: 'var(--surface)',
                                borderRadius: '16px',
                                padding: '20px',
                                border: '2px solid #f59e0b',
                                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.1)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '20px',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                        <span style={{
                                            background: getSubStateStyle('pending_validation').bg,
                                            color: '#fff',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>Awaiting Approval</span>
                                    </div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {task.title}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <User size={14} /> {task.assigned_to_name || 'Unknown'}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <ArrowRight size={14} /> {getPhaseInfo(task.lifecycle_state).label} → {getPhaseInfo(task.requested_next_state).label}
                                        </span>
                                        {task.proof_url && (
                                            <button onClick={() => { setProofPreviewUrl(task.proof_url); setShowProofPreview(true); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600, backgroundColor: '#f0fdf4', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                                                <FileText size={14} /> View Proof <Eye size={12} />
                                            </button>
                                        )}
                                        {task.issues && !task.issues.includes('RESOLVED') && (
                                            <button onClick={(e) => { e.stopPropagation(); openIssueModal(task); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontWeight: 600, backgroundColor: '#fef2f2', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                                                <AlertTriangle size={14} /> View Issues
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => approveTask(task)}
                                        disabled={actionLoading}
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
                                            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                                            transition: 'transform 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <CheckCircle size={18} /> Approve
                                    </button>
                                    <button
                                        onClick={() => openRejectModal(task)}
                                        disabled={actionLoading}
                                        style={{
                                            padding: '12px 24px',
                                            borderRadius: '10px',
                                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                            color: 'white',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                                            transition: 'transform 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <XCircle size={18} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* All Tasks Tab */}
            {activeTab === 'all' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Filters */}
                    {/* Premium Toolbar */}
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        backgroundColor: 'white',
                        padding: '12px 16px',
                        borderRadius: '16px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                        border: '1px solid rgba(226, 232, 240, 0.8)'
                    }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                            <Search size={18} style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#94a3b8'
                            }} />
                            <input
                                type="text"
                                placeholder="Search tasks or employees..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '12px 16px 12px 42px',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    backgroundColor: '#f8fafc',
                                    transition: 'all 0.2s',
                                    color: '#334155'
                                }}
                                onFocus={(e) => {
                                    e.target.style.backgroundColor = 'white';
                                    e.target.style.borderColor = '#3b82f6';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.backgroundColor = '#f8fafc';
                                    e.target.style.borderColor = '#e2e8f0';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Filters Group */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Date Picker */}
                            <div style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '4px',
                                transition: 'all 0.2s'
                            }}>
                                <div style={{
                                    padding: '8px 12px',
                                    color: '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRight: '1px solid #e2e8f0'
                                }}>
                                    <Clock size={16} />
                                </div>
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        border: 'none',
                                        outline: 'none',
                                        backgroundColor: 'transparent',
                                        color: '#334155',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        height: '24px',
                                        fontFamily: 'inherit',
                                        fontWeight: 500
                                    }}
                                />
                            </div>

                            {/* Today Button */}
                            <button
                                onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 18px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                                    transition: 'all 0.2s'
                                }}
                                title="Show Today's Tasks"
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Clock size={16} />
                                <span>Today</span>
                            </button>

                            {dateFilter && (
                                <button
                                    onClick={() => setDateFilter('')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '42px',
                                        height: '42px',
                                        borderRadius: '12px',
                                        border: '1px solid #fee2e2',
                                        backgroundColor: '#fff1f2',
                                        color: '#e11d48',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 8px rgba(225, 29, 72, 0.05)'
                                    }}
                                    title="Clear Date Filter"
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#ffe4e6';
                                        e.currentTarget.style.transform = 'rotate(90deg)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#fff1f2';
                                        e.currentTarget.style.transform = 'rotate(0deg)';
                                    }}
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                padding: '10px 16px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#f8fafc',
                                color: '#334155',
                                fontWeight: 500,
                                fontSize: '0.9rem',
                                outline: 'none',
                                cursor: 'pointer',
                                height: '42px',
                                minWidth: '140px'
                            }}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="in progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="on hold">On Hold</option>
                        </select>

                        {/* Phase Filter */}
                        <select
                            value={filterPhase}
                            onChange={(e) => setFilterPhase(e.target.value)}
                            style={{
                                padding: '10px 16px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                outline: 'none',
                                cursor: 'pointer',
                                backgroundColor: '#f8fafc',
                                fontWeight: 500,
                                height: '42px',
                                color: '#334155',
                                minWidth: '140px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="all">All Phases</option>
                            {LIFECYCLE_PHASES.slice(0, -1).map(p => (
                                <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tasks Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {filteredTasks.map(task => {
                            const phaseInfo = getPhaseInfo(task.lifecycle_state);
                            const subStateStyle = getSubStateStyle(task.sub_state);
                            return (
                                <div key={task.id} style={{
                                    backgroundColor: 'var(--surface)',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    border: '1px solid var(--border)',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}
                                    onClick={() => { setSelectedTask(task); setShowTaskModal(true); fetchTaskHistory(task.id); }}
                                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <span style={{
                                                    background: subStateStyle.bg,
                                                    color: subStateStyle.text,
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {task.sub_state?.replace('_', ' ') || 'In Progress'}
                                                </span>
                                                <span style={{
                                                    color: '#64748b',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 500
                                                }}>
                                                    Prior: {task.priority}
                                                </span>
                                            </div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: 1.4 }}>
                                                {task.title}
                                            </h3>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <User size={14} /> {task.assignee_name}
                                                </span>
                                                {task.due_date && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Clock size={14} /> {new Date(task.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <LifecycleProgressMini phase={task.lifecycle_state} />
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                                                {phaseInfo.short}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Time & Effort Tab */}
            {activeTab === 'time_effort' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <EmployeeRecognitionBoard />
                    {/* My Stats */}
                    <div style={{
                        backgroundColor: 'var(--surface)',
                        borderRadius: '24px',
                        padding: '24px',
                        border: '1px solid var(--border)'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={20} /> My Work Distribution
                                <div
                                    onClick={() => setShowInfo(!showInfo)}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: showInfo ? '#3b82f6' : '#94a3b8', transition: 'color 0.2s' }}
                                >
                                    <AlertCircle size={16} />
                                </div>
                            </div>
                            {showInfo && (
                                <div style={{
                                    width: '100%',
                                    marginTop: '8px',
                                    padding: '12px 16px',
                                    backgroundColor: '#f1f5f9',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    color: '#334155',
                                    border: '1px solid #e2e8f0',
                                    fontWeight: 500
                                }}>
                                    <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#0f172a' }}>Calculation Formula:</p>
                                    <p style={{ margin: 0, lineHeight: 1.5 }}>Estimated Hours = Total Attendance Hours × (Project Tasks / Total Assigned Tasks)</p>
                                </div>
                            )}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                            {teamAnalytics.myStats && teamAnalytics.myStats.length > 0 ? (
                                teamAnalytics.myStats.map((proj, idx) => (
                                    <div key={idx} style={{
                                        border: '1px solid var(--border)',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        backgroundColor: '#f8fafc'
                                    }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>{proj.name}</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0ea5e9' }}>
                                            {Math.round(proj.hours)}h
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Estimated Effort</div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No project data available.</div>
                            )}
                        </div>
                    </div>

                    {/* Team Stats */}
                    <div style={{
                        backgroundColor: 'var(--surface)',
                        borderRadius: '24px',
                        padding: '24px',
                        border: '1px solid var(--border)'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={20} /> Team Breakdown
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Employee</th>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Project Hours (Weighted)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamAnalytics.teamMembers.length > 0 ? (
                                        teamAnalytics.teamMembers.map(member => (
                                            <tr key={member.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{member.name}</td>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                        {member.breakdown.length > 0 ? (
                                                            member.breakdown.map((proj, idx) => (
                                                                <div key={idx} style={{
                                                                    backgroundColor: '#f1f5f9',
                                                                    padding: '4px 10px',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.8rem',
                                                                    border: '1px solid #e2e8f0'
                                                                }}>
                                                                    <span style={{ color: '#64748b' }}>{proj.name}: </span>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{Math.round(proj.hours)}h</span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No active projects</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No team members found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}



            {/* By Employee Tab */}
            {
                activeTab === 'byEmployee' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {Object.entries(tasksByEmployee).map(([employee, tasks]) => (
                            <div key={employee} style={{
                                backgroundColor: 'var(--surface)',
                                borderRadius: '16px',
                                border: '1px solid var(--border)',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    padding: '16px 20px',
                                    backgroundColor: 'var(--background)',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontWeight: 600,
                                            fontSize: '1rem'
                                        }}>
                                            {employee.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{employee}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{tasks.length} active task{tasks.length !== 1 ? 's' : ''}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {tasks.filter(t => t.sub_state === 'pending_validation').length > 0 && (
                                            <span style={{
                                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                                color: 'white',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                {tasks.filter(t => t.sub_state === 'pending_validation').length} pending
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {tasks.map(task => {
                                        const phaseInfo = getPhaseInfo(task.lifecycle_state);
                                        return (
                                            <div key={task.id} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '12px 16px',
                                                backgroundColor: 'var(--background)',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                                onClick={() => { setSelectedTask(task); setShowTaskModal(true); fetchTaskHistory(task.id); }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--border)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--background)'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '8px',
                                                        height: '8px',
                                                        borderRadius: '50%',
                                                        backgroundColor: phaseInfo.color
                                                    }} />
                                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{task.title}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <LifecycleProgressMini phase={task.lifecycle_state} />
                                                    <ChevronRight size={16} color="var(--text-secondary)" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Task Details Modal */}
            {
                showTaskModal && selectedTask && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px',
                            width: '600px', maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Task Details</h3>
                                <button onClick={() => setShowTaskModal(false)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: 'var(--background)', borderRadius: '16px' }}>
                                <h4 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>{selectedTask.title}</h4>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selectedTask.description || 'No description'}</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Assigned To</div>
                                    <div style={{ fontWeight: 600 }}>{selectedTask.assignee_name}</div>
                                </div>
                                <div style={{ padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Current Phase</div>
                                    <div style={{ fontWeight: 600 }}>{getPhaseInfo(selectedTask.lifecycle_state).label}</div>
                                </div>
                            </div>

                            {/* History */}
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <History size={16} /> State History
                                </h4>
                                {historyLoading ? (
                                    <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                                ) : taskHistory.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No transitions yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                        {taskHistory.map((entry, idx) => (
                                            <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--background)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <span style={{ fontWeight: 600 }}>
                                                        {entry.action === 'approve' && '✅ Approved'}
                                                        {entry.action === 'reject' && '❌ Rejected'}
                                                        {entry.action === 'request_validation' && '📤 Requested'}
                                                    </span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ''}</span>
                                                </div>
                                                <div style={{ color: 'var(--text-secondary)' }}>by {entry.actor_name}</div>
                                                {entry.comment && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>"{entry.comment}"</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowTaskModal(false)} style={{
                                    padding: '12px 24px', borderRadius: '10px', fontWeight: 600,
                                    backgroundColor: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer'
                                }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Reject Modal */}
            {
                showRejectModal && taskToReject && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px', width: '480px', maxWidth: '90%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px' }}>
                                    <AlertTriangle size={24} color="#ef4444" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b' }}>Reject Task</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{taskToReject.title}</p>
                                </div>
                            </div>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Provide feedback for the employee (required)..."
                                style={{
                                    width: '100%', minHeight: '120px', padding: '14px', borderRadius: '12px',
                                    border: '2px solid var(--border)', marginBottom: '20px', resize: 'vertical',
                                    fontSize: '0.95rem', outline: 'none'
                                }}
                                onFocus={e => e.target.style.borderColor = '#ef4444'}
                                onBlur={e => e.target.style.borderColor = 'var(--border)'}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button onClick={() => { setShowRejectModal(false); setTaskToReject(null); }} style={{
                                    padding: '12px 24px', borderRadius: '10px', backgroundColor: 'var(--background)',
                                    border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600
                                }}>Cancel</button>
                                <button onClick={rejectTask} disabled={actionLoading || !rejectReason.trim()} style={{
                                    padding: '12px 24px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer',
                                    opacity: !rejectReason.trim() ? 0.5 : 1,
                                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)'
                                }}>Reject with Feedback</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Proof Preview Modal */}
            {
                showProofPreview && proofPreviewUrl && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002,
                        backdropFilter: 'blur(4px)'
                    }}>
                        <div style={{
                            backgroundColor: 'var(--surface)', borderRadius: '20px',
                            width: '90%', height: '90%', maxWidth: '1200px',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}>
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <FileText size={24} color="#16a34a" />
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Proof Document</h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Submitted by employee</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <a href={proofPreviewUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
                                        Download
                                    </a>
                                    <button onClick={() => { setShowProofPreview(false); setProofPreviewUrl(''); }}
                                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', cursor: 'pointer' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
                                {proofPreviewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                    <img src={proofPreviewUrl} alt="Proof" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : proofPreviewUrl.match(/\.pdf$/i) ? (
                                    <iframe src={proofPreviewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                                ) : (
                                    <iframe
                                        src={`https://docs.google.com/viewer?url=${encodeURIComponent(proofPreviewUrl)}&embedded=true`}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                        title="Document Preview"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Issue Resolution Modal */}
            {
                showIssueModal && taskWithIssue && (
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
                                    <CheckCircle size={16} />
                                    {resolvingIssue ? 'Resolving...' : 'Mark as Resolved'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ManagerTaskDashboard;
