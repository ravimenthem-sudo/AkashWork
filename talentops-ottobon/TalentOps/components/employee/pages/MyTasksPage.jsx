import React, { useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle, Upload, FileText, Send, AlertCircle, Paperclip, ClipboardList, AlertTriangle, Eye, Clock, Trash2, X, StickyNote } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useProject } from '../context/ProjectContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import SkillSelectionModal from '../components/UI/SkillSelectionModal';
import TaskNotesModal from '../../shared/TaskNotesModal';
import TaskDetailOverlay from '../components/UI/TaskDetailOverlay';

const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirement Refiner', short: 'Req' },
    { key: 'design_guidance', label: 'Design Guidance', short: 'Des' },
    { key: 'build_guidance', label: 'Build Guidance', short: 'Bld' },
    { key: 'acceptance_criteria', label: 'Acceptance Criteria', short: 'Acc' },
    { key: 'deployment', label: 'Deployment', short: 'Dep' }
];

const MyTasksPage = () => {
    // We don't need projectRole, but we use useProject context for consistency (or future use)
    const { currentProject } = useProject();
    const { userId, orgId } = useUser();
    const { addToast } = useToast();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilters, setStatusFilters] = useState(['in_progress', 'pending']); // Default to In Progress + Pending
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);



    // Proof upload states
    const [showProofModal, setShowProofModal] = useState(false);
    const [taskForProof, setTaskForProof] = useState(null);
    const [proofFile, setProofFile] = useState(null);
    const [proofText, setProofText] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);

    // Issue logging states
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [taskForIssue, setTaskForIssue] = useState(null);
    const [issueText, setIssueText] = useState('');
    const [submittingIssue, setSubmittingIssue] = useState(false);

    // View Task state
    const [showViewModal, setShowViewModal] = useState(false);
    const [taskForView, setTaskForView] = useState(null);

    // Access Request State
    const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);
    const [taskForAccess, setTaskForAccess] = useState(null);
    const [accessReason, setAccessReason] = useState('');
    const [requestingAccess, setRequestingAccess] = useState(false);

    // Skill Selection State
    const [showSkillModal, setShowSkillModal] = useState(false);
    const [taskForSkills, setTaskForSkills] = useState(null);

    // Task Notes State
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [taskForNotes, setTaskForNotes] = useState(null);

    useEffect(() => {
        if (orgId) {
            fetchTasks();
        }
    }, [currentProject?.id, orgId]); // Refetch when project changes or org resolves

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                console.error('No user logged in');
                setTasks([]);
                setLoading(false);
                return;
            }

            // Fetch tasks assigned to the current user (across projects)
            const { data, error } = await supabase
                .from('tasks')
                .select('*, projects(name), task_submissions(final_points)')
                .eq('assigned_to', user.id)
                .eq('org_id', orgId)
                .order('id', { ascending: false });

            if (error) throw error;
            const tasksList = data || [];


            setTasks(tasksList);

            // Sync the currently viewed task in the overlay if it's open
            if (showViewModal && taskForView) {
                const updatedTask = tasksList.find(t => t.id === taskForView.id);
                if (updatedTask) setTaskForView(updatedTask);
            }
        } catch (err) {
            console.error('Error fetching tasks:', err.message, err.details, err.hint);
            addToast?.(`Failed to fetch tasks: ${err.message}`, 'error');
            setTasks([]);
        } finally {
            setLoading(false);
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
        if (!taskForProof) return;

        // CRITICAL LOCK CHECK
        const curTime = new Date();
        let dueDateTime = null;
        if (taskForProof.due_date) {
            let datePart = taskForProof.due_date;
            if (datePart.includes('/')) {
                const parts = datePart.split('/');
                datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
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

        setUploading(true);
        setUploadProgress(10);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            let proofUrl = null;

            // 1. Upload File if present
            if (proofFile) {
                const fileExt = proofFile.name.split('.').pop();
                const fileName = `${taskForProof.id}_${Date.now()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                setUploadProgress(30);

                const { error: uploadError } = await supabase.storage
                    .from('task-proofs')
                    .upload(filePath, proofFile, { cacheControl: '3600', upsert: false });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('task-proofs').getPublicUrl(filePath);
                proofUrl = urlData?.publicUrl;
                setUploadProgress(70);
            }

            // 2. Logic to Advance Phase
            const activePhases = taskForProof.phase_validations?.active_phases || LIFECYCLE_PHASES.map(p => p.key);
            const validActivePhases = activePhases.filter(pk => pk !== 'closed' && LIFECYCLE_PHASES.some(p => p.key === pk));

            let currentPhase = taskForProof.lifecycle_state;
            if (!validActivePhases.includes(currentPhase)) {
                currentPhase = validActivePhases[0] || 'requirement_refiner';
            }

            // We are submitting for 'currentPhase'.
            // Find the NEXT phase to move to.
            let nextPhase = currentPhase;
            const currentActiveIndex = validActivePhases.indexOf(currentPhase);

            if (currentActiveIndex !== -1 && currentActiveIndex < validActivePhases.length - 1) {
                // Scan forward
                for (let i = currentActiveIndex + 1; i < validActivePhases.length; i++) {
                    const pKey = validActivePhases[i];
                    const existingVal = taskForProof.phase_validations?.[pKey];
                    // If this future phase has no proof, we stop here (this is our new target)
                    if (!existingVal?.proof_url && !existingVal?.proof_text) {
                        nextPhase = pKey;
                        break;
                    }
                    // If it HAS proof, we skip it (it's already done/pre-filled), keep looking
                    // If we reach the end, we stay on the last phase
                    if (i === validActivePhases.length - 1) {
                        nextPhase = validActivePhases[validActivePhases.length - 1];
                    }
                }
            }

            // 3. Prepare Updates
            const existingPhaseVal = taskForProof.phase_validations?.[currentPhase] || {};
            let combinedUrls = [];

            // Parse existing URLs
            if (existingPhaseVal.proof_url) {
                try {
                    const parsed = JSON.parse(existingPhaseVal.proof_url);
                    combinedUrls = Array.isArray(parsed) ? parsed : [existingPhaseVal.proof_url];
                } catch (e) {
                    combinedUrls = [existingPhaseVal.proof_url];
                }
            }
            // Add new URL
            if (proofUrl) combinedUrls = [...combinedUrls, proofUrl];
            const combinedUrlsString = combinedUrls.length > 0 ? JSON.stringify(combinedUrls) : null;

            // Append text
            const combinedText = [existingPhaseVal.proof_text, proofText].filter(Boolean).join('\n---\n');

            const currentValidations = taskForProof.phase_validations || {};
            const updatedValidations = {
                ...currentValidations,
                [currentPhase]: {
                    status: 'pending',
                    proof_url: combinedUrlsString,
                    proof_text: combinedText,
                    submitted_at: new Date().toISOString()
                }
            };

            const updates = {
                phase_validations: updatedValidations,
                proof_url: combinedUrlsString, // Legacy compat
                proof_text: combinedText,
                updated_at: new Date().toISOString()
            };

            // Only update lifecycle state if we moved
            if (nextPhase !== currentPhase) {
                updates.lifecycle_state = nextPhase;
                updates.sub_state = 'in_progress';
            } else {
                updates.sub_state = 'pending_validation';
            }

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', taskForProof.id);

            if (error) throw error;

            setUploadProgress(100);
            addToast('Proof submitted successfully!', 'success');

            // Capture task ID before clearing state
            const completedTaskId = taskForProof.id;

            setShowProofModal(false);
            setTaskForProof(null);
            setProofFile(null);
            setProofText('');

            // Fetch latest task state
            await fetchTasks();

            // After fetching, check if we should prompt for skills
            setTimeout(async () => {
                console.log('Checking for skill prompt...', completedTaskId);

                // Re-fetch the updated task
                const { data: updatedTask, error: taskError } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('id', completedTaskId)
                    .single();

                if (taskError) {
                    console.error('Error fetching updated task:', taskError);
                    return;
                }

                if (updatedTask) {
                    console.log('Updated task:', updatedTask);
                    console.log('Phase validations:', updatedTask.phase_validations);

                    // Check if skills already recorded
                    const { data: existingSkills } = await supabase
                        .from('task_skills')
                        .select('id')
                        .eq('task_id', updatedTask.id)
                        .eq('employee_id', user.id);

                    console.log('Existing skills:', existingSkills);

                    // Get the task's active phases
                    const validations = updatedTask.phase_validations || {};
                    const activePhases = validations.active_phases || [
                        'requirement_refiner',
                        'design_guidance',
                        'build_guidance',
                        'acceptance_criteria',
                        'deployment'
                    ];

                    // Filter out 'closed' phase
                    const requiredPhases = activePhases.filter(p => p !== 'closed');

                    console.log('Required active phases:', requiredPhases);

                    // Check if ALL active phases have proof
                    const allPhasesComplete = requiredPhases.every(phaseKey => {
                        const phaseData = validations[phaseKey];
                        const hasProof = phaseData && (phaseData.proof_url || phaseData.proof_text);
                        console.log(`  ${phaseKey}: ${hasProof ? '✅' : '❌'}`);
                        return hasProof;
                    });

                    console.log('All required phases complete?', allPhasesComplete);

                    if (allPhasesComplete && (!existingSkills || existingSkills.length === 0)) {
                        console.log('✅ Should show skill modal!');
                        // Check if late
                        if (!isOverdue || updatedTask.access_status === 'approved') {
                            setTaskForSkills(updatedTask);
                            setShowSkillModal(true);
                        } else {
                            console.log('❌ Task is overdue without approval');
                        }
                    } else {
                        console.log('❌ Not showing modal - conditions not met');
                        if (existingSkills && existingSkills.length > 0) {
                            console.log('   Reason: Skills already recorded');
                        }
                        if (!allPhasesComplete) {
                            console.log('   Reason: Not all phases complete');
                        }
                    }
                }
            }, 500);

        } catch (error) {
            console.error('Error submitting proof:', error);
            addToast('Failed to submit: ' + error.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDeleteProof = async (task, phaseKey) => {
        if (!window.confirm('Are you sure you want to delete this proof?')) return;

        try {
            const currentValidations = task.phase_validations || {};
            const updatedValidations = { ...currentValidations };
            let updates = {};

            if (phaseKey === 'LEGACY_PROOF') {
                updates.proof_url = null;
                updates.lifecycle_state = 'design_guidance'; // Reset to first phase
                updates.sub_state = 'in_progress';
            } else {
                if (updatedValidations[phaseKey]) {
                    delete updatedValidations[phaseKey];
                }

                updates.phase_validations = updatedValidations;

                // Determine if we need to revert the lifecycle state
                const deletedPhaseIndex = LIFECYCLE_PHASES.findIndex(p => p.key === phaseKey);
                const currentPhaseIndex = LIFECYCLE_PHASES.findIndex(p => p.key === task.lifecycle_state);

                if (deletedPhaseIndex !== -1) {
                    if (currentPhaseIndex > deletedPhaseIndex) {
                        // Revert to the phase where proof was deleted
                        updates.lifecycle_state = phaseKey;
                        updates.sub_state = 'in_progress';
                    } else if (currentPhaseIndex === deletedPhaseIndex) {
                        // We are in the same phase, just ensure it's not marked as validation complete/pending if we just deleted the proof
                        updates.sub_state = 'in_progress';
                    }
                }
            }

            // Common updates
            updates.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', task.id);

            if (error) throw error;

            addToast('Proof deleted and status updated', 'success');

            // Update local state if viewing the same task
            if (taskForView && taskForView.id === task.id) {
                setTaskForView({
                    ...taskForView,
                    phase_validations: updatedValidations,
                    proof_url: phaseKey === 'LEGACY_PROOF' ? null : taskForView.proof_url,
                    lifecycle_state: updates.lifecycle_state || taskForView.lifecycle_state,
                    sub_state: updates.sub_state || taskForView.sub_state
                });
            }
            fetchTasks(); // Refresh list

        } catch (error) {
            console.error('Error deleting proof:', error);
            addToast('Failed to delete proof: ' + error.message, 'error');
        }
    };

    const openIssueModal = (task) => {
        setTaskForIssue(task);
        setIssueText('');
        setShowIssueModal(true);
    };

    const submitIssue = async () => {
        if (!issueText.trim() || !taskForIssue) {
            addToast?.('Please enter an issue description', 'error');
            return;
        }

        // CRITICAL LOCK CHECK
        const curTime = new Date();
        let dueDateTime = null;
        if (taskForIssue.due_date) {
            let datePart = taskForIssue.due_date;
            if (datePart.includes('/')) {
                const parts = datePart.split('/');
                datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            const timePart = taskForIssue.due_time ? taskForIssue.due_time : '23:59:00';
            dueDateTime = new Date(`${datePart}T${timePart}`);
        }
        const isOverdue = dueDateTime && curTime > dueDateTime;
        const isLocked = (taskForIssue.is_locked || isOverdue) && taskForIssue.status !== 'completed' && taskForIssue.access_status !== 'approved';

        if (isLocked) {
            addToast('Task is locked (Overdue). Please request access to add issues.', 'error');
            setShowIssueModal(false);
            return;
        }

        setSubmittingIssue(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user profile for name
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', user.id)
                .single();

            const userName = profile?.full_name || profile?.email || 'Unknown User';
            const timestamp = new Date().toISOString();

            // Create issue log entry
            const issueEntry = `[${new Date(timestamp).toLocaleString()}] ${userName}: ${issueText.trim()}`;

            // Append to existing issues or create new
            const currentIssues = taskForIssue.issues || '';
            const updatedIssues = currentIssues
                ? `${currentIssues}\n\n${issueEntry}`
                : issueEntry;

            const { error } = await supabase
                .from('tasks')
                .update({
                    issues: updatedIssues,
                    updated_at: timestamp,
                    has_issues: true // Ensure flag is set
                })
                .eq('id', taskForIssue.id);

            if (error) throw error;

            addToast?.('Issue logged successfully!', 'success');
            setShowIssueModal(false);
            setTaskForIssue(null);
            setIssueText('');
            fetchTasks(); // Refresh tasks to show updated issue status
        } catch (error) {
            console.error('Error logging issue:', error);
            addToast?.('Failed to log issue: ' + error.message, 'error');
        } finally {
            setSubmittingIssue(false);
        }
    };

    const openViewModal = (task) => {
        setTaskForView(task);
        setShowViewModal(true);
    };

    const handleRequestAccess = async () => {
        if (!accessReason.trim()) {
            addToast?.('Please provide a reason for requesting access.', 'error');
            return;
        }

        setRequestingAccess(true);
        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    access_requested: true,
                    access_reason: accessReason,
                    access_status: 'pending',
                    access_requested_at: new Date().toISOString()
                })
                .eq('id', taskForAccess.id);

            if (error) throw error;

            addToast('Access request sent successfully.', 'success');
            setShowAccessRequestModal(false);
            setTaskForAccess(null);
            setAccessReason('');
            fetchTasks();

        } catch (error) {
            console.error('Error requesting access:', error);
            addToast('Failed to request access: ' + error.message, 'error');
        } finally {
            setRequestingAccess(false);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return { bg: '#fee2e2', text: '#991b1b' };
            case 'medium': return { bg: '#fef3c7', text: '#b45309' };
            case 'low': return { bg: '#dcfce7', text: '#166534' };
            default: return { bg: '#f3f4f6', text: '#6b7280' };
        }
    };

    const getSubStateColor = (subState) => {
        switch (subState) {
            case 'in_progress': return { bg: '#dbeafe', text: '#1d4ed8' };
            case 'pending_validation': return { bg: '#fef3c7', text: '#b45309' };
            case 'approved': return { bg: '#dcfce7', text: '#166534' };
            case 'rejected': return { bg: '#fee2e2', text: '#991b1b' };
            case 'on_hold': return { bg: '#fee2e2', text: '#991b1b' };
            default: return { bg: '#f3f4f6', text: '#6b7280' };
        }
    };

    const getStatusColor = (status) => {
        const s = status?.toLowerCase() || '';
        if (s.includes('on_hold') || s.includes('on hold')) return { bg: '#fee2e2', text: '#991b1b' };
        if (s.includes('completed')) return { bg: '#dcfce7', text: '#166534' };
        if (s.includes('in_progress') || s.includes('in progress')) return { bg: '#dbeafe', text: '#1d4ed8' };
        if (s.includes('pending')) return { bg: '#fef3c7', text: '#b45309' };
        return { bg: '#f3f4f6', text: '#6b7280' };
    };

    // Lifecycle phases (copied for visual consistency)
    const LIFECYCLE_PHASES = [
        { key: 'requirement_refiner', label: 'Requirements', short: 'REQ' },
        { key: 'design_guidance', label: 'Design', short: 'DES' },
        { key: 'build_guidance', label: 'Build', short: 'BLD' },
        { key: 'acceptance_criteria', label: 'Acceptance', short: 'ACC' },
        { key: 'deployment', label: 'Deployment', short: 'DEP' },
        { key: 'closed', label: 'Closed', short: 'DONE' }
    ];
    const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);

    const LifecycleProgress = ({ currentPhase, subState, validations, taskStatus }) => {
        let parsedValidations = validations;
        if (typeof validations === 'string') {
            try {
                parsedValidations = JSON.parse(validations);
            } catch (e) {
                console.error("Error parsing validations JSON", e);
            }
        }

        const activePhases = parsedValidations?.active_phases || LIFECYCLE_PHASES.map(p => p.key);
        // Exclude 'closed' from the active phases for display generally, or handle it? 
        // Original logic was LIFECYCLE_PHASES.slice(0, -1). 
        // If activePhases includes 'closed', we should probably filter it out if we don't want to show it as a circle?
        // But usually activePhases are just the 5 Steps.
        // Let's filter LIFECYCLE_PHASES based on p.key being in activePhases.

        const filteredPhases = LIFECYCLE_PHASES.filter(p => activePhases.includes(p.key) && p.key !== 'closed');
        // Note: The original code sliced off 'closed'. We should maintain that behavior.

        const currentPhaseObj = LIFECYCLE_PHASES.find(p => p.key === currentPhase); // find in FULL list to get index logic?
        // No, we need index in the FILTERED list.

        const currentIndex = filteredPhases.findIndex(p => p.key === (currentPhase || filteredPhases[0]?.key));

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {filteredPhases.map((phase, idx) => {
                    const validation = parsedValidations?.[phase.key];
                    const status = validation?.status;
                    let color = '#e5e7eb'; // Default Grey

                    const hasProof = validation?.proof_url || validation?.proof_text;

                    if (taskStatus === 'completed') {
                        color = '#10b981';
                    } else if (idx < currentIndex) {
                        // Past Phase
                        if (status === 'pending') color = '#f59e0b'; // Yellow (Still Pending)
                        else if (status === 'rejected') color = '#fee2e2'; // Red
                        else color = '#10b981'; // Green (Approved/Default)
                    } else if (idx === currentIndex) {
                        // Current Phase
                        if (status === 'pending' || subState === 'pending_validation') color = '#f59e0b'; // Yellow
                        else color = '#3b82f6'; // Blue
                    } else if (hasProof) {
                        // Future Phase but has proof (e.g. reverted state)
                        if (status === 'pending') color = '#f59e0b';
                        else if (status === 'rejected') color = '#fee2e2';
                        else color = '#10b981';
                    }
                    // Future phases stay grey

                    return (
                        <React.Fragment key={phase.key}>
                            <div style={{
                                width: '24px', height: '24px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', fontWeight: 600,
                                backgroundColor: color,
                                color: color === '#e5e7eb' ? '#9ca3af' : color === '#fee2e2' ? '#991b1b' : 'white'
                            }} title={`${phase.label} ${status ? `(${status})` : ''}`}>
                                {color === '#10b981' ? '✓' : phase.short.charAt(0)}
                            </div>
                            {idx < filteredPhases.length - 1 && (
                                <div style={{ width: '12px', height: '2px', backgroundColor: idx < currentIndex ? '#10b981' : '#e5e7eb' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.projects?.name?.toLowerCase().includes(searchQuery.toLowerCase());

        // Date filter
        const matchesDate = !dateFilter || (t.due_date && t.due_date === dateFilter);

        // Status filter - multi-select (empty array = show all)
        const taskStatus = t.status?.toLowerCase() || '';
        const taskSubState = t.sub_state?.toLowerCase() || '';

        // Hide archived tasks unless 'archived' filter is explicitly selected
        if (taskStatus === 'archived' && !statusFilters.includes('archived')) return false;

        const matchesStatus = statusFilters.length === 0 || statusFilters.some(f => {
            // Exact matching for each filter type
            // IMPORTANT: status field takes precedence over sub_state
            switch (f) {
                case 'in_progress':
                    // Only match in_progress if status is NOT completed
                    if (taskStatus === 'completed') return false;
                    return taskStatus === 'in_progress' || taskStatus === 'in progress' ||
                        taskSubState === 'in_progress';
                case 'pending':
                    // Only match pending if status is NOT completed
                    if (taskStatus === 'completed') return false;
                    return taskStatus === 'pending';
                case 'completed':
                    return taskStatus === 'completed';
                case 'on_hold':
                    // Only match on_hold if status is NOT completed
                    if (taskStatus === 'completed') return false;
                    return taskStatus === 'on_hold' || taskStatus === 'on hold' ||
                        taskSubState === 'on_hold';
                case 'archived':
                    return taskStatus === 'archived';
                default:
                    return false;
            }
        });

        return matchesSearch && matchesDate && matchesStatus;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Premium Dark Header */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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

                {/* Badge and Subtitle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                    <span style={{
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        boxShadow: '0 4px 12px rgba(139,92,246,0.4)'
                    }}>
                        MY TASKS
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem' }}>●</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 500 }}>
                        Track Progress
                    </span>
                </div>

                {/* Main Title with Gradient */}
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 50%, #3b82f6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    marginBottom: '8px',
                    position: 'relative',
                    zIndex: 1,
                    letterSpacing: '-0.02em'
                }}>
                    Task <span style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                    }}>Lifecycle</span>
                </h1>

                {/* Description */}
                <p style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: '0.9rem',
                    maxWidth: '500px',
                    lineHeight: 1.5,
                    position: 'relative',
                    zIndex: 1
                }}>
                    Track your assigned tasks through each phase of the development lifecycle.
                </p>


            </div>

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
                {/* Search Field */}
                <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                    <Search size={18} style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8'
                    }} />
                    <input
                        type="text"
                        placeholder="Search tasks..."
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
                            <Calendar size={16} />
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

                    {/* Clear Button - Only show when date is selected */}
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

                {/* Multi-Select Status Filter */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: statusFilters.length > 0 ? '#eff6ff' : '#f8fafc',
                            color: '#334155',
                            fontWeight: 500,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            height: '42px',
                            minWidth: '160px',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>
                            {statusFilters.length === 0
                                ? 'All Statuses'
                                : `${statusFilters.length} Selected`}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showStatusDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                            <path d="M2 4L6 8L10 4" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showStatusDropdown && (
                        <>
                            {/* Backdrop to close on click outside */}
                            <div
                                onClick={() => setShowStatusDropdown(false)}
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 99
                                }}
                            />
                            <div style={{
                                position: 'absolute',
                                top: '48px',
                                right: 0,
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                                padding: '8px 0',
                                minWidth: '200px',
                                zIndex: 100
                            }}>
                                {/* Clear All Option */}
                                {statusFilters.length > 0 && (
                                    <button
                                        onClick={() => { setStatusFilters([]); setShowStatusDropdown(false); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            width: '100%',
                                            padding: '10px 16px',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            color: '#e11d48',
                                            fontWeight: 500,
                                            borderBottom: '1px solid #f1f5f9',
                                            marginBottom: '4px'
                                        }}
                                    >
                                        <X size={14} />
                                        Clear All Filters
                                    </button>
                                )}

                                {/* Status Options */}
                                {[
                                    { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
                                    { value: 'pending', label: 'Pending', color: '#f59e0b' },
                                    { value: 'completed', label: 'Completed', color: '#10b981' },
                                    { value: 'on_hold', label: 'On Hold', color: '#ef4444' },
                                    { value: 'archived', label: 'Archived', color: '#6366f1' }
                                ].map(status => (
                                    <label
                                        key={status.value}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '10px 16px',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                            backgroundColor: statusFilters.includes(status.value) ? '#f8fafc' : 'transparent'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = statusFilters.includes(status.value) ? '#f8fafc' : 'transparent'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={statusFilters.includes(status.value)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setStatusFilters([...statusFilters, status.value]);
                                                } else {
                                                    setStatusFilters(statusFilters.filter(f => f !== status.value));
                                                }
                                            }}
                                            style={{
                                                width: '18px',
                                                height: '18px',
                                                accentColor: status.color,
                                                cursor: 'pointer'
                                            }}
                                        />
                                        <span style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '0.9rem',
                                            fontWeight: 500,
                                            color: '#334155'
                                        }}>
                                            <span style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: status.color
                                            }} />
                                            {status.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>


            {/* Tasks Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>TASK</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>PROJECT</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>PRIORITY</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>LIFECYCLE</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>ALLOCATED HOURS</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>DUE DATE</th>
                            <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', minWidth: '180px' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading tasks...</td></tr>
                        ) : filteredTasks.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '60px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
                                        <CheckCircle size={40} style={{ opacity: 0.5 }} />
                                        <p style={{ fontSize: '1rem', fontWeight: 500 }}>No tasks found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredTasks.map(task => {
                                const priorityColor = getPriorityColor(task.priority);
                                const subStateColor = getSubStateColor(task.sub_state);
                                const reassignedLabel = (task.reassigned_from || task.reassigned_to || task.access_reason === 'Reassigned by manager') ? 'Reassigned' : null;

                                return (
                                    <tr key={task.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                                                    {task.title}
                                                </div>
                                                {reassignedLabel && (
                                                    <div style={{
                                                        marginTop: '6px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        backgroundColor: '#fef3c7',
                                                        color: '#92400e',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 600,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {reassignedLabel}
                                                    </div>
                                                )}
                                                {task.description && (
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                                                        {task.description}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                                {task.projects?.name || 'General'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{
                                                fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px',
                                                backgroundColor: priorityColor.bg, color: priorityColor.text, fontWeight: 600,
                                                textTransform: 'capitalize'
                                            }}>
                                                {task.priority || 'Medium'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <LifecycleProgress
                                                currentPhase={task.lifecycle_state}
                                                subState={task.sub_state}
                                                validations={task.phase_validations}
                                                taskStatus={task.status}
                                            />
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                                                {task.allocated_hours ? `${task.allocated_hours} hrs` : '-'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                                                <Calendar size={14} />
                                                {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            {(() => {
                                                const curTime = new Date();
                                                let dueDateTime = null;
                                                let isInvalidDate = false;

                                                if (task.due_date) {
                                                    let datePart = task.due_date;
                                                    // Handle DD/MM/YYYY format if present
                                                    if (datePart.includes('/')) {
                                                        const parts = datePart.split('/');
                                                        if (parts.length === 3) {
                                                            datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                                        }
                                                    }
                                                    const timePart = task.due_time ? task.due_time : '23:59:00';
                                                    const isoString = `${datePart}T${timePart}`;
                                                    dueDateTime = new Date(isoString);

                                                    if (isNaN(dueDateTime.getTime())) {
                                                        isInvalidDate = true;
                                                    }
                                                }

                                                const isOverdue = isInvalidDate || (dueDateTime && curTime > dueDateTime);
                                                const isLocked = (task.is_locked || isOverdue) &&
                                                    task.status !== 'completed' &&
                                                    task.access_status !== 'approved';

                                                if (task.status === 'completed') {
                                                    // Check if it was reassigned
                                                    if (task.closed_by_manager === true && task.reassigned_to) {
                                                        return (
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                                <span style={{
                                                                    padding: '6px 12px',
                                                                    borderRadius: '20px',
                                                                    backgroundColor: '#f1f5f9',
                                                                    color: '#475569',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 600,
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px'
                                                                }}>
                                                                    <AlertCircle size={14} /> Reassigned
                                                                </span>
                                                                <button
                                                                    onClick={() => openViewModal(task)}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #cbd5e1',
                                                                        backgroundColor: 'white',
                                                                        color: '#334155',
                                                                        cursor: 'pointer',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: 500,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}>
                                                                    <Eye size={14} /> View
                                                                </button>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
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
                                                            <button
                                                                onClick={() => openViewModal(task)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #cbd5e1',
                                                                    backgroundColor: 'white',
                                                                    color: '#334155',
                                                                    cursor: 'pointer',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 500,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px'
                                                                }}>
                                                                <Eye size={14} /> View
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                if (isLocked) {
                                                    if (task.access_requested && task.access_status === 'pending') {
                                                        return (
                                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                                                <button
                                                                    onClick={() => openViewModal(task)}
                                                                    style={{
                                                                        padding: '6px 10px',
                                                                        borderRadius: '6px',
                                                                        backgroundColor: '#eff6ff',
                                                                        color: '#1d4ed8',
                                                                        border: '1px solid #bfdbfe',
                                                                        fontWeight: 500,
                                                                        cursor: 'pointer',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                        fontSize: '0.75rem',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    <Eye size={12} /> View
                                                                </button>
                                                                <span style={{ fontSize: '0.7rem', padding: '6px 10px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 600 }}>
                                                                    Access Pending
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                                            <button
                                                                onClick={() => openViewModal(task)}
                                                                style={{
                                                                    padding: '6px 10px',
                                                                    borderRadius: '6px',
                                                                    backgroundColor: '#eff6ff',
                                                                    color: '#1d4ed8',
                                                                    border: '1px solid #bfdbfe',
                                                                    fontWeight: 500,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    fontSize: '0.75rem',
                                                                    transition: 'background-color 0.2s',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                <Eye size={12} /> View
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setTaskForAccess(task);
                                                                    setShowAccessRequestModal(true);
                                                                }}
                                                                style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
                                                                    backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px',
                                                                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                                                                }}
                                                            >
                                                                Request Access
                                                            </button>
                                                        </div>
                                                    );
                                                }

                                                // Not Locked
                                                return (
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', whiteSpace: 'nowrap' }}>
                                                        <button
                                                            onClick={() => openViewModal(task)}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: '6px',
                                                                backgroundColor: '#eff6ff',
                                                                color: '#1d4ed8',
                                                                border: '1px solid #bfdbfe',
                                                                fontWeight: 500,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                fontSize: '0.75rem',
                                                                transition: 'background-color 0.2s',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                        >
                                                            <Eye size={12} /> View
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div >

            {/* Proof Upload Modal */}
            {
                showProofModal && taskForProof && (
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
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 600, color: '#166534' }}>{proofFile.name}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{(proofFile.size / 1024).toFixed(1)} KB</div>
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
                                                <Upload size={32} color="#9ca3af" style={{ marginBottom: '12px' }} />
                                                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Click to upload</div>
                                                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>PDF, DOC, PNG, JPG, ZIP (max 10MB)</div>
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
                )
            }

            {/* Issue Logging Modal */}
            {
                showIssueModal && taskForIssue && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, backdropFilter: 'blur(4px)' }}>
                        <div style={{ backgroundColor: 'var(--surface)', padding: '32px', borderRadius: '20px', width: '600px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                <div style={{ backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px' }}>
                                    <AlertTriangle size={24} color="#ef4444" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Report Issue</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{taskForIssue.title}</p>
                                </div>
                            </div>

                            {taskForIssue.issues && (
                                <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertCircle size={16} /> Existing Issues
                                    </h4>
                                    <div style={{ fontSize: '0.85rem', color: '#7f1d1d', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', lineHeight: '1.6' }}>
                                        {taskForIssue.issues}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                                    Describe the Issue *
                                </label>
                                <textarea
                                    value={issueText}
                                    onChange={(e) => setIssueText(e.target.value)}
                                    placeholder="Describe the issue you're facing with this task..."
                                    rows="5"
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '2px solid var(--border)',
                                        fontSize: '0.9rem',
                                        resize: 'vertical',
                                        outline: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    onClick={() => { setShowIssueModal(false); setTaskForIssue(null); setIssueText(''); }}
                                    disabled={submittingIssue}
                                    style={{ padding: '12px 24px', borderRadius: '10px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={submitIssue}
                                    disabled={!issueText.trim() || submittingIssue}
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '10px',
                                        background: issueText.trim() ? 'linear-gradient(135deg, #ef4444, #dc2626)' : '#e5e7eb',
                                        color: issueText.trim() ? 'white' : '#9ca3af',
                                        border: 'none',
                                        fontWeight: 600,
                                        cursor: issueText.trim() ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: issueText.trim() ? '0 4px 15px rgba(239, 68, 68, 0.3)' : 'none'
                                    }}
                                >
                                    <Send size={16} />
                                    {submittingIssue ? 'Submitting...' : 'Submit Issue'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Enhanced Task Detail Overlay */}
            <TaskDetailOverlay
                isOpen={showViewModal}
                onClose={() => { setShowViewModal(false); setTaskForView(null); }}
                task={taskForView}
                onRefresh={fetchTasks}
                addToast={addToast}
                userId={userId}
                orgId={orgId}
            />

            {/* Access Request Modal */}
            {showAccessRequestModal && taskForAccess && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    zIndex: 1002,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '500px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Request Submission Access</h2>
                            <button
                                onClick={() => setShowAccessRequestModal(false)}
                                style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#92400e', fontWeight: 500 }}>
                                    This task is overdue. You must request approval from your manager to unlock submission capabilities.
                                </p>
                            </div>

                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                Reason for Delay *
                            </label>
                            <textarea
                                value={accessReason}
                                onChange={(e) => setAccessReason(e.target.value)}
                                placeholder="Please explain why the task was not submitted on time..."
                                rows={4}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    color: '#0f172a',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{
                            padding: '20px 24px',
                            backgroundColor: '#f8fafc',
                            borderTop: '1px solid #f1f5f9',
                            borderRadius: '0 0 16px 16px',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                            <button
                                onClick={() => setShowAccessRequestModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: 'white',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRequestAccess}
                                disabled={requestingAccess || !accessReason.trim()}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#0f172a',
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: requestingAccess || !accessReason.trim() ? 'not-allowed' : 'pointer',
                                    opacity: requestingAccess || !accessReason.trim() ? 0.7 : 1
                                }}
                            >
                                {requestingAccess ? 'Sending...' : 'Send Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
            {/* Skill Selection Modal */}
            <SkillSelectionModal
                isOpen={showSkillModal}
                onClose={() => {
                    setShowSkillModal(false);
                    setTaskForSkills(null);
                }}
                task={taskForSkills}
                onSkillsSaved={() => {
                    fetchTasks(); // Refresh tasks after skills saved
                }}
            />

            {/* Task Notes Modal */}
            <TaskNotesModal
                isOpen={showNotesModal}
                onClose={() => { setShowNotesModal(false); setTaskForNotes(null); }}
                task={taskForNotes}
                userId={taskForNotes?.assigned_to}
                userRole="employee"
                orgId={orgId}
                addToast={addToast}
                canAddNote={true}  // Employee can always add notes to their own task
            />
        </div >
    );
};

export default MyTasksPage;
