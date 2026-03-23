import React, { useState, useEffect } from 'react';
import { Search, Calendar, Clock, Eye, X, CheckCircle, XCircle, Send, History, ChevronRight, AlertCircle, Upload, FileText, Paperclip, Plus, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { calculateDueDateTime } from '../../lib/businessHoursUtils';


// Lifecycle phases in order
const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirements', short: 'REQ' },
    { key: 'design_guidance', label: 'Design', short: 'DES' },
    { key: 'build_guidance', label: 'Build', short: 'BLD' },
    { key: 'acceptance_criteria', label: 'Acceptance', short: 'ACC' },
    { key: 'deployment', label: 'Deployment', short: 'DEP' },
    { key: 'closed', label: 'Closed', short: 'DONE' }
];

const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);
const getPhaseLabel = (phase) => LIFECYCLE_PHASES.find(p => p.key === phase)?.label || phase;

const TaskLifecyclePage = ({ userRole = 'employee', userId, orgId, addToast, projectRole = null, currentProjectId = null, teamId = null }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskHistory, setTaskHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Proof upload states
    const [showProofModal, setShowProofModal] = useState(false);
    const [taskForProof, setTaskForProof] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofText, setProofText] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);

    // Add Task states (for managers/team leads)
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [teamMembers, setTeamMembers] = useState([]);

    const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium', allocated_hours: '' });

    // Justification State for Employee
    const [actualHours, setActualHours] = useState('');
    const [employeeJustification, setEmployeeJustification] = useState('');

    // Check if user can add tasks - only for org managers or project managers
    const isManager = userRole === 'manager' || projectRole === 'manager';

    useEffect(() => {
        fetchTasks();
        if (isManager && currentProjectId) fetchTeamMembers();
    }, [userId, orgId, userRole, projectRole, currentProjectId]);

    const fetchTeamMembers = async () => {
        console.log('🔍 fetchTeamMembers called, currentProjectId:', currentProjectId);
        try {
            // First try to fetch project members from the current project
            const { data, error } = await supabase
                .from('project_members')
                .select(`
                    user_id,
                    role,
                    profiles:user_id (id, full_name, email, role)
                `)
                .eq('project_id', currentProjectId)
                .eq('org_id', orgId);

            console.log('📋 project_members query result:', { data, error, count: data?.length });

            if (!error && data && data.length > 0) {
                // Transform to flat structure for dropdown
                const members = data.filter(m => m.profiles).map(m => ({
                    id: m.profiles.id,
                    full_name: m.profiles.full_name,
                    email: m.profiles.email,
                    role: m.role || m.profiles.role
                }));
                setTeamMembers(members);
            } else {
                // Fallback: if no project_members, fetch all profiles (for projects without member setup)
                console.log('⚠️ No project_members found, falling back to all profiles');
                const { data: profiles, error: profError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .eq('org_id', orgId);
                if (!profError && profiles) setTeamMembers(profiles);
            }
        } catch (err) { console.error('Error fetching team members:', err); }
    };

    const handleAddTask = async () => {
        if (!newTask.title.trim()) { addToast?.('Please enter a task title', 'error'); return; }
        if (!newTask.assigned_to) { addToast?.('Please select a team member', 'error'); return; }
        if (!newTask.allocated_hours || Number(newTask.allocated_hours) <= 0) { addToast?.('Allocated Hours is mandatory', 'error'); return; }

        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Calculate due date/time based on allocated hours and business hours
            const allocatedHrs = parseFloat(newTask.allocated_hours) || 0;
            const { dueDate, dueTime } = calculateDueDateTime(new Date(), allocatedHrs);

            const { error } = await supabase.from('tasks').insert({
                title: newTask.title, description: newTask.description, assigned_to: newTask.assigned_to,
                due_date: dueDate, due_time: dueTime, priority: newTask.priority, created_by: user.id,
                project_id: currentProjectId,
                team_id: teamId, // Ensure task is linked to the creator's team for visibility in ManagerTasks
                status: 'pending', lifecycle_state: 'requirement_refiner', sub_state: 'in_progress',
                allocated_hours: allocatedHrs,
                org_id: orgId
            });
            if (error) throw error;
            addToast?.('Task created successfully!', 'success');
            setShowAddTaskModal(false);

            setNewTask({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium', allocated_hours: '' });
            fetchTasks();
        } catch (err) { addToast?.('Failed to create task: ' + err.message, 'error'); }
    };

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;


            let query = supabase.from('tasks').select('*').eq('assigned_to', user.id).eq('org_id', orgId);
            const { data: tasksData, error } = await query;
            if (error) throw error;

            if (tasksData) {
                const formatted = tasksData.map(t => ({
                    ...t,
                    lifecycle_state: t.lifecycle_state || 'requirement_refiner',
                    sub_state: t.sub_state || 'in_progress'
                }));
                setTasks(formatted);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            addToast?.('Failed to load tasks', 'error');
        } finally {
            setLoading(false);
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

    const openProofModal = (task) => {
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

    const uploadProofAndRequestValidation = async () => {
        if ((!proofFile && !proofText.trim()) || !taskForProof) {
            addToast?.('Please upload a file OR enter text/notes', 'error');
            return;
        }


        if (!actualHours || Number(actualHours) <= 0) {
            addToast?.('Please enter actual hours spent', 'error');
            return;
        }

        const isOverage = Number(actualHours) > (taskForProof.allocated_hours || 0);
        if (isOverage && !employeeJustification.trim()) {
            addToast?.('Justification is required for time overage', 'error');
            return;
        }

        setUploading(true);
        setUploadProgress(10);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const fileExt = proofFile.name.split('.').pop();
            const fileName = `${taskForProof.id}_${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;



            setUploadProgress(20);

            // Update Task with Actual Hours & Justification
            const { error: updateError } = await supabase
                .from('tasks')
                .update({
                    actual_hours: parseFloat(actualHours),
                    employee_justification: isOverage ? employeeJustification : null
                })
                .eq('id', taskForProof.id)
                .eq('org_id', orgId);

            if (updateError) throw updateError;

            setUploadProgress(40);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('task-proofs')
                .upload(filePath, proofFile, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            setUploadProgress(70);

            const { data: urlData } = supabase.storage.from('task-proofs').getPublicUrl(filePath);
            const proofUrl = urlData?.publicUrl || filePath;

            setUploadProgress(85);

            const { data, error } = await supabase.rpc('request_task_validation', {
                p_task_id: taskForProof.id,
                p_user_id: user.id,
                p_proof_url: proofUrl,
                p_proof_text: proofText // Pass the text message
            });

            if (error) throw error;

            setUploadProgress(100);

            if (data?.success) {
                addToast?.('Validation requested with proof!', 'success');
                setShowProofModal(false);
                setTaskForProof(null);
                setProofFile(null);
                fetchTasks();
            } else {
                addToast?.(data?.message || 'Failed to request validation', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            addToast?.('Failed to upload proof: ' + error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const getSubStateColor = (subState) => {
        switch (subState) {
            case 'in_progress': return { bg: '#dbeafe', text: '#1d4ed8' };
            case 'pending_validation': return { bg: '#fef3c7', text: '#b45309' };
            case 'approved': return { bg: '#dcfce7', text: '#166534' };
            case 'rejected': return { bg: '#fee2e2', text: '#991b1b' };
            default: return { bg: '#f3f4f6', text: '#6b7280' };
        }
    };

    const filteredTasks = tasks.filter(task => {
        const matchesStatus = filterStatus === 'All' ||
            (filterStatus === 'In Progress' && task.sub_state === 'in_progress') ||
            (filterStatus === 'Pending' && task.sub_state === 'pending_validation');

        const matchesSearch = task.title?.toLowerCase().includes(searchQuery.toLowerCase());

        // Date filter: check if task's due_date matches the selected date
        const matchesDate = !dateFilter || (task.due_date && task.due_date === dateFilter);

        return matchesStatus && matchesSearch && matchesDate;
    });

    const LifecycleProgress = ({ currentPhase, subState, taskStatus }) => {
        const currentIndex = getPhaseIndex(currentPhase);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {LIFECYCLE_PHASES.slice(0, -1).map((phase, idx) => (
                    <React.Fragment key={phase.key}>
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: 600,
                            backgroundColor: taskStatus === 'completed' ? '#10b981' : (idx < currentIndex ? '#10b981' : idx === currentIndex ? (subState === 'pending_validation' ? '#f59e0b' : '#3b82f6') : '#e5e7eb'),
                            color: (taskStatus === 'completed' || idx <= currentIndex) ? 'white' : '#9ca3af'
                        }} title={phase.label}>
                            {idx < currentIndex ? '✓' : phase.short.charAt(0)}
                        </div>
                        {idx < LIFECYCLE_PHASES.length - 2 && (
                            <div style={{ width: '16px', height: '3px', backgroundColor: idx < currentIndex ? '#10b981' : '#e5e7eb' }} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Premium Header - Reusing the Dashboard Aesthetic */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '32px 40px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                marginBottom: '8px'
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-tasks" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-tasks)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)' }}>Project Management</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '800' }}>•</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', fontWeight: '600' }}>Workflow Tracking</span>
                        </div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                            Task <span style={{ background: 'linear-gradient(to right, #10b981, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lifecycle</span>
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', maxWidth: '600px', fontWeight: '500', lineHeight: 1.6 }}>
                            Track, validate, and complete your assigned tasks through every stage of development.
                        </p>
                    </div>

                    {isManager && (
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(12px)',
                            padding: '16px 24px',
                            borderRadius: '20px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            <button
                                onClick={() => setShowAddTaskModal(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '12px 24px', borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white', border: 'none', cursor: 'pointer',
                                    fontWeight: '800', fontSize: '0.9rem',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                                }}
                            >
                                <Plus size={18} strokeWidth={3} /> Add Task
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', minWidth: '200px', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                    <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', fontSize: '0.9rem' }} />
                </div>

                {/* Date Filter Components */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                outline: 'none',
                                backgroundColor: 'var(--background)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                height: '38px',
                                fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    <button
                        onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--background)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            height: '38px',
                            fontWeight: 500,
                            whiteSpace: 'nowrap'
                        }}
                        title="Show Today's Tasks"
                    >
                        <Calendar size={16} />
                        Today
                    </button>

                    {dateFilter && (
                        <button
                            onClick={() => setDateFilter('')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #fee2e2',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                height: '38px',
                                fontWeight: 500
                            }}
                        >
                            <X size={16} />
                            Clear
                        </button>
                    )}
                </div>

                <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }}></div>

                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none', cursor: 'pointer', backgroundColor: 'var(--background)', height: '38px' }}>
                    <option value="All">All</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending Validation</option>
                </select>
            </div>

            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                    <thead>
                        <tr style={{ backgroundColor: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}>TASK</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}>LIFECYCLE</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}>STATUS</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}>DUE</th>
                            <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center' }}>Loading...</td></tr>
                        ) : filteredTasks.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '32px', textAlign: 'center' }}>No tasks found.</td></tr>
                        ) : (
                            filteredTasks.map((task) => {
                                const subStateColor = getSubStateColor(task.sub_state);
                                return (
                                    <tr key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '16px', fontWeight: 500 }}>
                                            {task.title}
                                            {task.proof_url && (
                                                <span style={{ marginLeft: '8px', color: '#10b981' }} title="Proof submitted">
                                                    <Paperclip size={14} />
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px' }}><LifecycleProgress currentPhase={task.lifecycle_state} subState={task.sub_state} taskStatus={task.status} /></td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: subStateColor.bg, color: subStateColor.text }}>
                                                {task.sub_state?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '0.9rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} /> {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            {task.status === 'completed' ? (
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <span style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '20px',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#166534',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}>
                                                        <CheckCircle size={14} /> Completed
                                                    </span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                    {task.sub_state === 'in_progress' && (
                                                        <button onClick={() => openProofModal(task)} disabled={actionLoading}
                                                            style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                                            <Upload size={14} /> Submit for Validation
                                                        </button>
                                                    )}
                                                    <button onClick={() => { setSelectedTask(task); setShowTaskModal(true); fetchTaskHistory(task.id); }}
                                                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                                                        <Eye size={14} /> View
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Proof Upload Modal */}
            {showProofModal && taskForProof && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px', width: '500px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ backgroundColor: '#ede9fe', borderRadius: '12px', padding: '12px' }}>
                                <Upload size={24} color="#8b5cf6" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Submit Proof for Validation</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{taskForProof.title}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <AlertCircle size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ fontSize: '0.9rem', color: '#92400e' }}>
                                <strong>Proof Required:</strong> Upload documentation showing your completed work before requesting validation.
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                    Upload Proof Document (Optional)
                                </label>
                                <div style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: '12px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    backgroundColor: proofFile ? '#f0fdf4' : 'var(--background)',
                                    cursor: 'pointer'
                                }}
                                    onClick={() => document.getElementById('proof-file-input').click()}
                                >
                                    <input id="proof-file-input" type="file" onChange={handleFileChange} style={{ display: 'none' }}
                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.zip,.txt" />
                                    {proofFile ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                            <FileText size={32} color="#10b981" />
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#166534' }}>{proofFile.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{(proofFile.size / 1024).toFixed(1)} KB</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload size={32} color="#9ca3af" style={{ marginBottom: '12px' }} />
                                            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Click to upload</div>
                                            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>PDF, DOC, PNG, ZIP (max 10MB)</div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                    Text Message / Notes (Optional)
                                </label>
                                <textarea
                                    value={proofText}
                                    onChange={(e) => setProofText(e.target.value)}
                                    placeholder="Enter any notes, links, or description..."
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border)',
                                        backgroundColor: 'var(--background)',
                                        fontSize: '0.9rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                        Allocated Hours
                                    </label>
                                    <div style={{ padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '10px', fontSize: '0.9rem', color: '#6b7280' }}>
                                        {taskForProof.allocated_hours || 0} hrs
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                        Actual Hours *
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={actualHours}
                                        onChange={(e) => setActualHours(e.target.value)}
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                        placeholder="0.0"
                                    />
                                </div>
                            </div>

                            {/* Justification Field (Only show if overage) */}
                            {Number(actualHours) > (taskForProof.allocated_hours || 0) && (
                                <div style={{ marginTop: '16px', animation: 'fadeIn 0.3s' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem', color: '#b45309' }}>
                                        Time Overage Justification *
                                    </label>
                                    <textarea
                                        value={employeeJustification}
                                        onChange={(e) => setEmployeeJustification(e.target.value)}
                                        placeholder="Please explain why the task took longer than allocated..."
                                        rows={3}
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #fcd34d', backgroundColor: '#fffbeb', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                    />
                                </div>
                            )}
                        </div>

                        {uploading && (
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                                    <span>Uploading...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div style={{ height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#8b5cf6', transition: 'width 0.3s', borderRadius: '4px' }} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => { setShowProofModal(false); setTaskForProof(null); setProofFile(null); setProofText(''); }} disabled={uploading}
                                style={{ padding: '12px 24px', borderRadius: '10px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}>
                                Cancel
                            </button>
                            <button onClick={uploadProofAndRequestValidation} disabled={(!proofFile && !proofText.trim()) || uploading}
                                style={{
                                    padding: '12px 24px', borderRadius: '10px',
                                    background: (proofFile || proofText.trim()) ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : '#e5e7eb',
                                    color: (proofFile || proofText.trim()) ? 'white' : '#9ca3af', border: 'none', fontWeight: 600,
                                    cursor: (proofFile || proofText.trim()) ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    boxShadow: (proofFile || proofText.trim()) ? '0 4px 15px rgba(139, 92, 246, 0.3)' : 'none'
                                }}>
                                <Send size={16} />
                                {uploading ? 'Uploading...' : 'Submit for Validation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Task Details Modal */}
            {showTaskModal && selectedTask && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '16px', width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Task Details</h3>
                            <button onClick={() => setShowTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'var(--background)', borderRadius: '12px' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>{selectedTask.title}</h4>
                            <p style={{ color: 'var(--text-secondary)' }}>{selectedTask.description || 'No description'}</p>
                        </div>

                        {selectedTask.proof_url && (
                            <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <FileText size={24} color="#16a34a" />
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#166534' }}>Proof Submitted</div>
                                        <a href={selectedTask.proof_url} target="_blank" rel="noopener noreferrer" style={{ color: '#15803d', fontSize: '0.9rem' }}>
                                            View uploaded proof →
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>LIFECYCLE PROGRESS</h4>
                            <LifecycleProgress currentPhase={selectedTask.lifecycle_state} subState={selectedTask.sub_state} />
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><History size={16} /> STATE HISTORY</h4>
                            {historyLoading ? <p>Loading...</p> : taskHistory.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No transitions yet.</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {taskHistory.map((entry, idx) => (
                                        <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--background)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 600 }}>{entry.action === 'approve' ? '✅ Approved' : entry.action === 'reject' ? '❌ Rejected' : '📤 Requested'}</span>
                                                <span style={{ color: 'var(--text-secondary)' }}>{entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}</span>
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)' }}>by {entry.actor_name}</div>
                                            {entry.comment && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>"{entry.comment}"</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            {selectedTask.sub_state === 'in_progress' && (
                                <button onClick={() => { setShowTaskModal(false); openProofModal(selectedTask); }} disabled={actionLoading}
                                    style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Upload size={16} /> Submit for Validation
                                </button>
                            )}
                            <button onClick={() => setShowTaskModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Task Modal for Managers/Team Leads */}
            {showAddTaskModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1002
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '20px', padding: '28px',
                        width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>➕ Add New Task</h2>
                            <button onClick={() => setShowAddTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={24} color="#64748b" />
                            </button>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Task Title *</label>
                            <input
                                type="text"
                                value={newTask.title}
                                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                placeholder="Enter task title"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.95rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Allocated Hours *</label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={newTask.allocated_hours}
                                onChange={(e) => setNewTask({ ...newTask, allocated_hours: e.target.value })}
                                placeholder="e.g. 8.0"
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.95rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Description</label>
                            <textarea
                                value={newTask.description}
                                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                placeholder="Task description..."
                                rows={3}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Assign To *</label>
                            <select
                                value={newTask.assigned_to}
                                onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.95rem', boxSizing: 'border-box' }}
                            >
                                <option value="">Select team member</option>
                                {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.full_name || m.email} ({m.role || 'employee'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Due Date</label>
                                <input
                                    type="date"
                                    value={newTask.due_date}
                                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>Priority</label>
                                <select
                                    value={newTask.priority}
                                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowAddTaskModal(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: 600 }}>
                                Cancel
                            </button>
                            <button onClick={handleAddTask} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                                Create Task
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskLifecyclePage;
