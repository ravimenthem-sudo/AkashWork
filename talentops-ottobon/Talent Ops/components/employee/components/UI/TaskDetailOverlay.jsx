import React, { useState, useEffect } from 'react';
import {
    X, Upload, Send, AlertTriangle, CheckCircle2, Clock, Calendar,
    User, FileText, MessageSquare, ChevronRight, ArrowLeft, Star,
    Link as LinkIcon, ExternalLink, Check, Circle, Trash2, Award,
    StickyNote, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import TaskNotesModal from '../../../shared/TaskNotesModal';


const TaskDetailOverlay = ({
    isOpen,
    onClose,
    task,
    onRefresh,
    addToast,
    userId,
    userRole,
    orgId,
    onApprovePhase,
    onRejectPhase,
    onShowAccessRequest,
    onShowAccessReview
}) => {
    const [showNotesModal, setShowNotesModal] = useState(false);

    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [submittingNote, setSubmittingNote] = useState(false);

    // Proof submission state - supports multiple files
    const [proofFiles, setProofFiles] = useState([]);
    const [proofText, setProofText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Issue state
    const [issueText, setIssueText] = useState('');
    const [submittingIssue, setSubmittingIssue] = useState(false);

    // Task Steps state
    const [taskSteps, setTaskSteps] = useState([]);
    const [loadingSteps, setLoadingSteps] = useState(false);
    const [newStepTitle, setNewStepTitle] = useState('');
    const [newStepHours, setNewStepHours] = useState(2);
    const [addingStep, setAddingStep] = useState(false);
    const [editingStepId, setEditingStepId] = useState(null);
    const [editingStepTitle, setEditingStepTitle] = useState('');
    const [skipModalStep, setSkipModalStep] = useState(null);
    const [skipReason, setSkipReason] = useState('');

    useEffect(() => {
        if (isOpen && task?.id) {
            fetchNotes();
            fetchTaskSteps();
        }
    }, [isOpen, task?.id]);

    const fetchNotes = async () => {
        if (!task?.id) return;
        setLoadingNotes(true);
        try {
            const { data, error } = await supabase
                .from('task_notes')
                .select('*, profiles:author_id(full_name, avatar_url)')
                .eq('task_id', task.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setNotes(data || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !task?.id) return;
        setSubmittingNote(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('task_notes').insert({
                task_id: task.id,
                author_id: user.id,
                note_text: newNote.trim(),
                org_id: orgId
            });
            if (error) throw error;
            setNewNote('');
            fetchNotes();
            addToast?.('Note added successfully', 'success');
        } catch (err) {
            addToast?.('Failed to add note', 'error');
        } finally {
            setSubmittingNote(false);
        }
    };

    // ========== TASK STEPS FUNCTIONS ==========
    const fetchTaskSteps = async () => {
        if (!task?.id) return;
        setLoadingSteps(true);
        try {
            const { data, error } = await supabase
                .from('task_steps')
                .select('*')
                .eq('task_id', task.id)
                .order('order_index', { ascending: true });

            if (error) throw error;
            setTaskSteps(data || []);
        } catch (err) {
            console.error('Error fetching task steps:', err);
            setTaskSteps([]);
        } finally {
            setLoadingSteps(false);
        }
    };

    const handleAddStep = async () => {
        if (!newStepTitle.trim() || !task?.id) return;
        setAddingStep(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const currentPhase = task.lifecycle_state || 'requirement_refiner';
            const maxOrder = taskSteps.filter(s => s.stage_id === currentPhase).length;

            const { error } = await supabase.from('task_steps').insert({
                org_id: orgId,
                task_id: task.id,
                stage_id: currentPhase,
                step_title: newStepTitle.trim(),
                order_index: maxOrder,
                status: 'pending',
                created_by: user?.id,
                created_by_role: 'employee',
                estimated_hours: parseFloat(newStepHours) || 2
            });

            if (error) throw error;
            setNewStepTitle('');
            setNewStepHours(2);
            fetchTaskSteps();
            addToast?.('Step added', 'success');
        } catch (err) {
            console.error('Error adding step:', err);
            addToast?.('Failed to add step', 'error');
        } finally {
            setAddingStep(false);
        }
    };

    const handleToggleStepComplete = async (step) => {
        if (step.status === 'skipped') return; // Cannot toggle skipped steps
        const newStatus = step.status === 'completed' ? 'pending' : 'completed';
        try {
            const { error } = await supabase
                .from('task_steps')
                .update({
                    status: newStatus,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', step.id);

            if (error) throw error;
            fetchTaskSteps();
        } catch (err) {
            addToast?.('Failed to update step', 'error');
        }
    };

    const handleSkipStep = async () => {
        if (!skipModalStep || !skipReason.trim()) {
            addToast?.('Please provide a reason for skipping', 'error');
            return;
        }
        try {
            const { error } = await supabase
                .from('task_steps')
                .update({
                    status: 'skipped',
                    skipped_reason: skipReason.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', skipModalStep.id);

            if (error) throw error;
            setSkipModalStep(null);
            setSkipReason('');
            fetchTaskSteps();
            addToast?.('Step skipped', 'success');
        } catch (err) {
            addToast?.('Failed to skip step', 'error');
        }
    };

    const handleUpdateStepTitle = async (stepId) => {
        if (!editingStepTitle.trim()) return;
        try {
            const { error } = await supabase
                .from('task_steps')
                .update({
                    step_title: editingStepTitle.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', stepId);

            if (error) throw error;
            setEditingStepId(null);
            setEditingStepTitle('');
            fetchTaskSteps();
        } catch (err) {
            addToast?.('Failed to update step', 'error');
        }
    };

    const handleDeleteStep = async (stepId) => {
        try {
            const { error } = await supabase
                .from('task_steps')
                .delete()
                .eq('id', stepId);

            if (error) throw error;
            fetchTaskSteps();
            addToast?.('Step deleted', 'success');
        } catch (err) {
            addToast?.('Failed to delete step', 'error');
        }
    };

    // Check if current phase has pending steps (for submission lock)
    // Default to first active phase if lifecycle_state is not set or not in active phases
    const activePhases = task?.phase_validations?.active_phases || ['requirement_refiner'];
    const defaultPhase = activePhases[0] || 'requirement_refiner';
    const currentPhase = (task?.lifecycle_state && activePhases.includes(task.lifecycle_state))
        ? task.lifecycle_state
        : defaultPhase;
    const currentPhaseSteps = taskSteps.filter(s => s.stage_id === currentPhase);
    const hasPendingSteps = currentPhaseSteps.some(s => s.status === 'pending');

    // Calculate hours for current phase
    const totalPhaseHours = currentPhaseSteps.reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);
    const completedPhaseHours = currentPhaseSteps
        .filter(s => s.status === 'completed' || s.status === 'skipped')
        .reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);

    // Calculate total hours for the entire task (all phases)
    const totalTaskHours = taskSteps.reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);
    const totalCompletedHours = taskSteps
        .filter(s => s.status === 'completed' || s.status === 'skipped')
        .reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);

    // Permission helper: Can edit/delete step?
    const canEditStep = (step) => {
        // If created by employee and current user is that employee, they can edit
        if (step.created_by === userId && step.created_by_role === 'employee') return true;
        // Managers can edit any step (we assume if role is not employee, they have higher authority)
        // For now, we allow editing own steps only from employee view
        return step.created_by === userId;
    };

    const handleSubmitProof = async () => {
        if (!proofText.trim() && proofFiles.length === 0) {
            addToast?.('Please provide proof text or upload files', 'error');
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            let fileUrls = [];
            let evidenceRecords = [];

            // 1. Upload all files
            if (proofFiles.length > 0) {
                for (let i = 0; i < proofFiles.length; i++) {
                    const file = proofFiles[i];
                    const fileName = `${task.id}_${Date.now()}_${file.name}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('task-proofs')
                        .upload(fileName, file);
                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage.from('task-proofs').getPublicUrl(fileName);
                    fileUrls.push(publicUrl);
                    evidenceRecords.push({
                        file_url: publicUrl,
                        file_type: file.type || 'application/octet-stream',
                        file_name: file.name
                    });
                    setUploadProgress(Math.round(((i + 1) / proofFiles.length) * 100));
                }
            }

            // 2. Create Submission Record
            // Try to insert into task_submissions if the table exists (it should based on Manager view)
            const { data: submissionData, error: submissionError } = await supabase
                .from('task_submissions')
                .insert({
                    task_id: task.id,
                    employee_id: user.id, // Using employee_id as per schema
                    description: proofText,
                    submission_time: new Date().toISOString(),
                    org_id: orgId
                })
                .select()
                .single();

            if (submissionError) {
                console.warn('Could not insert into task_submissions, falling back to basic task update:', submissionError);
            } else if (evidenceRecords.length > 0) {
                // 3. Insert Evidence linked to submission
                const evidencePayload = evidenceRecords.map(e => ({
                    submission_id: submissionData.id,
                    file_url: e.file_url,
                    file_type: e.file_type,
                    org_id: orgId,
                    uploaded_at: new Date().toISOString()
                }));

                const { error: evidenceError } = await supabase
                    .from('task_evidence')
                    .insert(evidencePayload);

                if (evidenceError) console.error('Error inserting evidence:', evidenceError);
            }

            // 4. Update Task Status (Legacy/Direct columns)
            // Store multiple file URLs as JSON array or comma-separated for legacy compatibility
            const fileUrlsString = fileUrls.length > 0 ? JSON.stringify(fileUrls) : null;

            // 2. Logic to Advance Phase (Sync with MyTasksPage logic)
            const activePhases = task.phase_validations?.active_phases || phases.map(p => p.key);
            const validActivePhases = activePhases.filter(pk => pk !== 'closed' && phases.some(p => p.key === pk));

            let currentPhase = task.lifecycle_state || 'requirement_refiner';
            if (!validActivePhases.includes(currentPhase)) {
                currentPhase = validActivePhases[0] || 'requirement_refiner';
            }

            // CHECK FOR EXISTING PROOFS TO APPEND
            const existingPhaseVal = task.phase_validations?.[currentPhase] || {};
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
            // Add new URLs
            combinedUrls = [...combinedUrls, ...fileUrls];
            const combinedUrlsString = JSON.stringify(combinedUrls);

            // Append text if exists
            const combinedText = [existingPhaseVal.proof_text, proofText].filter(Boolean).join('\n---\n');

            let nextPhase = currentPhase;
            const currentActiveIndex = validActivePhases.indexOf(currentPhase);

            if (currentActiveIndex !== -1 && currentActiveIndex < validActivePhases.length - 1) {
                // Advance to next valid phase
                nextPhase = validActivePhases[currentActiveIndex + 1];
            }

            const updatedValidations = {
                ...(task.phase_validations || {}),
                [currentPhase]: {
                    status: 'pending',
                    proof_url: combinedUrlsString,
                    proof_text: combinedText,
                    submitted_at: new Date().toISOString()
                }
            };

            const updates = {
                proof_text: combinedText || null,
                proof_url: combinedUrlsString,
                sub_state: nextPhase !== currentPhase ? 'in_progress' : 'pending_validation',
                status: 'in_progress',
                lifecycle_state: nextPhase,
                phase_validations: updatedValidations,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('tasks')
                .update(updates)
                .eq('id', task.id);

            if (error) throw error;
            addToast?.(`${proofFiles.length > 0 ? proofFiles.length + ' file(s) uploaded. ' : ''}Proof submitted successfully`, 'success');
            setProofFiles([]); // Clear selected files
            setProofText('');  // Clear text box
            onRefresh?.();
        } catch (err) {
            console.error('Upload error:', err);
            addToast?.('Failed to submit proof: ' + err.message, 'error');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        setProofFiles(prev => [...prev, ...files]);
    };

    const removeFile = (index) => {
        setProofFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Handler to delete a proof file from a phase
    const handleDeleteProof = async (phaseKey, fileUrl) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const phaseVal = task.phase_validations?.[phaseKey];
            if (!phaseVal) return;

            // Parse existing URLs
            let existingUrls = [];
            try {
                const parsed = JSON.parse(phaseVal.proof_url);
                existingUrls = Array.isArray(parsed) ? parsed : [phaseVal.proof_url];
            } catch (e) {
                if (phaseVal.proof_url.includes('http')) {
                    existingUrls = phaseVal.proof_url.split(',').map(u => u.trim());
                } else {
                    existingUrls = [phaseVal.proof_url];
                }
            }

            // Remove the specified URL
            const updatedUrls = existingUrls.filter(url => url !== fileUrl);

            // Extract file path from URL for storage deletion
            try {
                const urlObj = new URL(fileUrl);
                const pathParts = urlObj.pathname.split('/task-proofs/');
                if (pathParts.length > 1) {
                    const filePath = pathParts[1];
                    // Delete from storage
                    await supabase.storage.from('task-proofs').remove([filePath]);
                }
            } catch (err) {
                console.warn('Could not delete from storage:', err);
            }

            // Update phase_validations
            const updatedValidations = {
                ...(task.phase_validations || {}),
                [phaseKey]: {
                    ...phaseVal,
                    proof_url: updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : null,
                    updated_at: new Date().toISOString()
                }
            };

            // If no files left and no text, remove the phase validation
            if (updatedUrls.length === 0 && !phaseVal.proof_text) {
                delete updatedValidations[phaseKey];
            }

            // Update task in database
            const { error } = await supabase
                .from('tasks')
                .update({
                    phase_validations: updatedValidations,
                    updated_at: new Date().toISOString()
                })
                .eq('id', task.id);

            if (error) throw error;

            addToast?.('File deleted successfully', 'success');
            onRefresh?.(); // Refresh the task to show updated data
        } catch (err) {
            console.error('Error deleting proof:', err);
            addToast?.('Failed to delete file', 'error');
        }
    };

    const handleSubmitIssue = async () => {
        if (!issueText.trim()) return;
        setSubmittingIssue(true);
        try {
            const currentIssues = task.issues || '';
            const timestamp = new Date().toLocaleString();
            const newIssue = `[${timestamp}] ${issueText.trim()}`;
            const updatedIssues = currentIssues ? `${currentIssues}\n---\n${newIssue}` : newIssue;

            const { error } = await supabase
                .from('tasks')
                .update({ issues: updatedIssues })
                .eq('id', task.id);

            if (error) throw error;
            addToast?.('Issue reported successfully', 'success');
            setIssueText('');
            onRefresh?.();
        } catch (err) {
            addToast?.('Failed to report issue', 'error');
        } finally {
            setSubmittingIssue(false);
        }
    };

    const handleResolveIssues = async () => {
        setSubmittingIssue(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();

            const userName = profile?.full_name || 'Manager';
            const timestamp = new Date().toLocaleString();
            const resolutionEntry = `\n\n[${timestamp}] RESOLVED by ${userName}`;
            const updatedIssues = (task.issues || '') + resolutionEntry;

            const { error } = await supabase
                .from('tasks')
                .update({
                    issues: updatedIssues,
                    updated_at: new Date().toISOString()
                })
                .eq('id', task.id);

            if (error) throw error;
            addToast?.('Issues marked as resolved', 'success');
            onRefresh?.();
        } catch (err) {
            console.error('Error resolving issues:', err);
            addToast?.('Failed to resolve issues', 'error');
        } finally {
            setSubmittingIssue(false);
        }
    };

    if (!isOpen || !task) return null;

    const getPriorityColor = (priority) => {
        const colors = {
            high: { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
            medium: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
            low: { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' }
        };
        return colors[priority?.toLowerCase()] || colors.medium;
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: { bg: '#fef3c7', text: '#d97706' },
            in_progress: { bg: '#dbeafe', text: '#2563eb' },
            completed: { bg: '#dcfce7', text: '#16a34a' },
            on_hold: { bg: '#f3e8ff', text: '#9333ea' }
        };
        return colors[status?.toLowerCase()] || colors.pending;
    };

    const priorityStyle = getPriorityColor(task.priority);

    // Parse requirements from description or use phase_validations
    const requirements = task.phase_validations ? Object.entries(task.phase_validations).map(([key, val]) => ({
        id: key,
        text: val.specs || key.replace(/_/g, ' '),
        completed: val.validated || false
    })) : [];

    // Phase validations for the progress bar - Using original lifecycle phases
    // Filter to show only the phases that are active for this task
    const allPhases = [
        { key: 'requirement_refiner', label: 'Requirement Refiner' },
        { key: 'design_guidance', label: 'Design Guidance' },
        { key: 'build_guidance', label: 'Build Guidance' },
        { key: 'acceptance_criteria', label: 'Acceptance Criteria' },
        { key: 'deployment', label: 'Deployment' }
    ];

    // Get active phases from task - default to all if not specified
    const activePhaseKeys = task.phase_validations?.active_phases || allPhases.map(p => p.key);
    const phases = allPhases.filter(phase => activePhaseKeys.includes(phase.key));

    const getPhaseStatus = (phaseKey) => {
        const validations = task.phase_validations || {};
        const phaseVal = validations[phaseKey];

        if (phaseVal?.validated) return 'completed';
        // Only return 'pending_validation' if there's actually proof submitted
        if (phaseVal?.status === 'pending' && (phaseVal?.proof_url || phaseVal?.proof_text)) return 'pending_validation';
        if (task.lifecycle_state === phaseKey) return 'in_progress';
        return 'pending';
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#f8fafc',
            zIndex: 1000,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Top Bar */}
            <div style={{
                padding: '12px 24px',
                backgroundColor: 'white',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <input
                        type="text"
                        placeholder="Search"
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            fontSize: '0.9rem',
                            width: '200px'
                        }}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => setShowNotesModal(true)}
                        style={{
                            padding: '6px 16px',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#0ea5e9',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        <StickyNote size={16} /> Task Notes
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '6px 16px',
                            borderRadius: '20px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        Close <X size={14} />
                    </button>
                </div>

            </div>

            {/* Main Content */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 380px',
                gap: '0',
                maxWidth: '1400px',
                width: '100%',
                margin: '0 auto',
                padding: '32px'
            }}>
                {/* Left Column - Task Details */}
                <div style={{ paddingRight: '32px' }}>
                    {/* Task Title & Priority */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                            <h1 style={{
                                fontSize: '1.75rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                margin: 0,
                                lineHeight: 1.3
                            }}>
                                Task: {task.title}
                            </h1>
                            <span style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                backgroundColor: priorityStyle.bg,
                                color: priorityStyle.text,
                                border: `1px solid ${priorityStyle.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap'
                            }}>
                                <Star size={14} fill="currentColor" /> {task.priority || 'Medium'} Priority
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '12px'
                        }}>
                            Description
                        </h3>
                        <p style={{
                            color: '#64748b',
                            lineHeight: 1.7,
                            fontSize: '0.95rem',
                            margin: 0
                        }}>
                            {task.description || 'No description provided for this task.'}
                        </p>
                    </div>

                    {/* Reassignment Info */}
                    {(task.reassigned_from || task.reassigned_to || task.access_reason === 'Reassigned by manager') && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: '#fff7ed',
                            borderRadius: '12px',
                            border: '1px solid #fed7aa',
                            marginBottom: '32px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', marginBottom: '8px' }}>
                                <ArrowLeft size={16} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reassignment Info</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#7c2d12', lineHeight: 1.5 }}>
                                {task.reassigned_from && <div><strong>From:</strong> {task.reassigned_from_name || 'Unknown'}</div>}
                                {task.reassigned_to && <div><strong>To:</strong> {task.reassigned_to_name || 'Unknown'}</div>}
                                {!task.reassigned_from && !task.reassigned_to && task.access_reason === 'Reassigned by manager' && <div><strong>Status:</strong> Reassigned by manager</div>}
                                {task.reassigned_at && <div><strong>On:</strong> {new Date(task.reassigned_at).toLocaleString()}</div>}
                            </div>
                        </div>
                    )}

                    {/* Overdue/Locked Info */}
                    {(() => {
                        const curTime = new Date();
                        let dueDateTime = null;
                        if (task.due_date) {
                            const datePart = task.due_date;
                            const timePart = task.due_time ? task.due_time : '23:59:00';
                            dueDateTime = new Date(`${datePart}T${timePart}`);
                        }
                        const isOverdue = dueDateTime && curTime > dueDateTime;
                        const isLocked = (task.is_locked || isOverdue) && task.status !== 'completed' && task.access_status !== 'approved';

                        if (!isLocked && !task.access_requested) return null;

                        return (
                            <div style={{
                                padding: '16px',
                                backgroundColor: isLocked ? '#fee2e2' : '#f0f9ff',
                                borderRadius: '12px',
                                border: `1px solid ${isLocked ? '#fecaca' : '#bae6fd'}`,
                                marginBottom: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <p style={{ fontWeight: 700, color: isLocked ? '#991b1b' : '#0369a1', margin: 0 }}>
                                        {isLocked ? 'Task Locked - Overdue' : 'Access Request Pending'}
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: isLocked ? '#7f1d1d' : '#075985', margin: '4px 0 0 0' }}>
                                        {isLocked
                                            ? (task.access_requested ? 'Access request is pending approval.' : 'This task is locked because the deadline has passed.')
                                            : `Access requested for: ${task.access_reason || 'N/A'}`
                                        }
                                    </p>
                                </div>
                                {isLocked && !task.access_requested && (
                                    <button
                                        onClick={() => onShowAccessRequest?.(task)}
                                        style={{ padding: '8px 16px', backgroundColor: '#991b1b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        Request Access
                                    </button>
                                )}
                                {task.access_requested && (userRole === 'manager' || userRole === 'team_lead') && task.access_status === 'pending' && (
                                    <button
                                        onClick={() => onShowAccessReview?.(task)}
                                        style={{ padding: '8px 16px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        Review Request
                                    </button>
                                )}
                            </div>
                        );
                    })()}



                    {/* Execution Steps - Replaces old Requirements */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                📝 Execution Steps
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: '#64748b',
                                    backgroundColor: '#f1f5f9',
                                    padding: '2px 8px',
                                    borderRadius: '10px'
                                }}>
                                    Full Task Overview
                                </span>
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {totalTaskHours > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '100px', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${(totalCompletedHours / totalTaskHours) * 100}%`,
                                                height: '100%',
                                                backgroundColor: '#3b82f6',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                                {totalCompletedHours}/{totalTaskHours}h Total
                                            </span>
                                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Overall Progress</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {loadingSteps ? (
                                <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading steps...</p>
                                </div>
                            ) : phases.map((phase) => {
                                const phaseSteps = taskSteps.filter(s => s.stage_id === phase.key);
                                const isCurrentPhase = phase.key === currentPhase;
                                const phaseTotalHours = phaseSteps.reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);
                                const phaseCompletedHours = phaseSteps
                                    .filter(s => s.status === 'completed' || s.status === 'skipped')
                                    .reduce((sum, s) => sum + (parseFloat(s.estimated_hours) || 0), 0);

                                return (
                                    <div key={phase.key} style={{
                                        backgroundColor: isCurrentPhase ? '#ffffff' : '#f8fafc',
                                        borderRadius: '12px',
                                        border: `1px solid ${isCurrentPhase ? '#3b82f6' : '#e2e8f0'}`,
                                        padding: '16px',
                                        boxShadow: isCurrentPhase ? '0 4px 6px -1px rgba(59, 130, 246, 0.1)' : 'none'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: isCurrentPhase ? '#2563eb' : '#475569', margin: 0 }}>
                                                    {phase.label}
                                                </h4>
                                                {isCurrentPhase && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', backgroundColor: '#3b82f6', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Active</span>
                                                )}
                                            </div>
                                            {phaseTotalHours > 0 && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                                    {phaseCompletedHours}/{phaseTotalHours}h
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {phaseSteps.length > 0 ? (
                                                phaseSteps.map((step, idx) => (
                                                    <div key={step.id} style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '10px',
                                                        padding: '8px 10px',
                                                        backgroundColor: step.status === 'completed' ? '#ecfdf5' : step.status === 'skipped' ? '#f1f5f9' : (isCurrentPhase ? '#ffffff' : '#f8fafc'),
                                                        borderRadius: '6px',
                                                        border: `1px solid ${step.status === 'completed' ? '#a7f3d0' : step.status === 'skipped' ? '#cbd5e1' : (isCurrentPhase ? '#e2e8f0' : 'transparent')}`
                                                    }}>
                                                        {/* Status Toggle */}
                                                        <div
                                                            onClick={() => isCurrentPhase && step.status !== 'skipped' && handleToggleStepComplete(step)}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '5px',
                                                                backgroundColor: step.status === 'completed' ? '#10b981' : step.status === 'skipped' ? '#94a3b8' : '#e2e8f0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                                cursor: (isCurrentPhase && step.status !== 'skipped') ? 'pointer' : 'default',
                                                                opacity: isCurrentPhase ? 1 : 0.6
                                                            }}
                                                        >
                                                            {step.status === 'completed' && <Check size={12} color="white" />}
                                                            {step.status === 'skipped' && <X size={12} color="white" />}
                                                        </div>

                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                                                <span style={{
                                                                    color: step.status === 'completed' ? '#64748b' : step.status === 'skipped' ? '#94a3b8' : '#1e293b',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 500,
                                                                    textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
                                                                    opacity: isCurrentPhase ? 1 : 0.8
                                                                }}>
                                                                    {step.step_title}
                                                                </span>
                                                                {step.created_by_role === 'manager' && (
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#8b5cf6', backgroundColor: '#ede9fe', padding: '1px 4px', borderRadius: '3px' }}>M</span>
                                                                )}
                                                                {parseFloat(step.estimated_hours) > 0 && (
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>
                                                                        {step.estimated_hours}h
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {step.status === 'skipped' && step.skipped_reason && (
                                                                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', fontStyle: 'italic', marginBottom: 0 }}>
                                                                    Reason: {step.skipped_reason}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {isCurrentPhase && step.status === 'pending' && canEditStep(step) && editingStepId !== step.id && (
                                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                                <button
                                                                    onClick={() => { setEditingStepId(step.id); setEditingStepTitle(step.step_title); }}
                                                                    style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, color: '#3b82f6', backgroundColor: '#eff6ff', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                                                >Edit</button>
                                                                <button
                                                                    onClick={() => { setSkipModalStep(step); setSkipReason(''); }}
                                                                    style={{ padding: '2px 6px', fontSize: '0.65rem', fontWeight: 600, color: '#f59e0b', backgroundColor: '#fef3c7', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                                                >Skip</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>No steps for this phase.</p>
                                            )}

                                            {isCurrentPhase && (
                                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                                    <input
                                                        type="text"
                                                        value={newStepTitle}
                                                        onChange={(e) => setNewStepTitle(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddStep()}
                                                        placeholder="+ Add step to active phase..."
                                                        style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', outline: 'none' }}
                                                    />
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        <input
                                                            type="number"
                                                            value={newStepHours}
                                                            onChange={(e) => setNewStepHours(e.target.value)}
                                                            min="0.5"
                                                            step="0.5"
                                                            style={{ width: '45px', padding: '6px 4px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', outline: 'none', textAlign: 'center' }}
                                                        />
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>h</span>
                                                    </div>
                                                    <button
                                                        onClick={handleAddStep}
                                                        disabled={addingStep || !newStepTitle.trim()}
                                                        style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}
                                                    >Add</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Phase Validations Progress */}
                    <div style={{ marginBottom: '32px' }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '20px'
                        }}>
                            Phase Validations
                        </h3>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            position: 'relative',
                            paddingBottom: '40px'
                        }}>
                            {/* Progress Line */}
                            <div style={{
                                position: 'absolute',
                                top: '12px',
                                left: '24px',
                                right: '24px',
                                height: '4px',
                                backgroundColor: '#e2e8f0',
                                borderRadius: '2px'
                            }}>
                                <div style={{
                                    height: '100%',
                                    backgroundColor: '#3b82f6',
                                    borderRadius: '2px',
                                    transition: 'width 0.4s ease-in-out',
                                    width: (() => {
                                        // Bar should reach the dot of the current lifecycle state
                                        const activeIndex = phases.findIndex(p => p.key === task.lifecycle_state);
                                        const safeIndex = activeIndex === -1 ? 0 : activeIndex;
                                        return `${(safeIndex / (phases.length - 1)) * 100}%`;
                                    })()
                                }} />
                            </div>

                            {phases.map((phase, idx) => {
                                const status = getPhaseStatus(phase.key);
                                return (
                                    <div key={phase.key} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        zIndex: 1,
                                        flex: 1
                                    }}>
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '50%',
                                            backgroundColor: status === 'completed' ? '#10b981' :
                                                status === 'pending_validation' ? '#f59e0b' :
                                                    status === 'in_progress' ? '#3b82f6' : '#e2e8f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: status === 'in_progress' || status === 'pending_validation' ? '3px solid #bfdbfe' : 'none',
                                            transition: 'all 0.3s ease'
                                        }}>
                                            {status === 'completed' ? (
                                                <Check size={14} color="white" />
                                            ) : (
                                                <Circle size={10} color={(status === 'in_progress' || status === 'pending_validation') ? 'white' : '#94a3b8'} fill={(status === 'in_progress' || status === 'pending_validation') ? 'white' : 'none'} />
                                            )}
                                        </div>
                                        <div style={{
                                            marginTop: '12px',
                                            textAlign: 'center'
                                        }}>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: '#334155',
                                                marginBottom: '4px'
                                            }}>
                                                {idx + 1}. {phase.label}
                                            </div>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                color: status === 'completed' ? '#10b981' :
                                                    status === 'pending_validation' ? '#f59e0b' :
                                                        status === 'in_progress' ? '#3b82f6' : '#94a3b8',
                                                fontWeight: 500
                                            }}>
                                                ({status === 'completed' ? 'Completed' :
                                                    status === 'pending_validation' ? 'Pending Validation' :
                                                        status === 'in_progress' ? 'In Progress' : 'Pending'})
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Validation Proofs Section - MATCHING PIC */}
                    <div style={{
                        marginTop: '32px',
                        padding: '24px',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '16px',
                        border: '1px solid #bbf7d0'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '16px',
                            color: '#15803d'
                        }}>
                            <CheckCircle2 size={20} />
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                margin: 0,
                                textTransform: 'uppercase',
                                letterSpacing: '0.025em'
                            }}>
                                Validation Proofs
                            </h3>
                        </div>

                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '16px',
                            border: '1px solid #dcfce7',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            {phases.map(p => {
                                const val = task.phase_validations?.[p.key];
                                if (!val || (!val.proof_url && !val.proof_text)) return null;

                                let displayFiles = [];
                                try {
                                    if (val.proof_url) {
                                        // Robust parsing to handle both JSON arrays and legacy strings
                                        const parsed = JSON.parse(val.proof_url);
                                        displayFiles = Array.isArray(parsed) ? parsed : [val.proof_url];
                                    }
                                } catch (e) {
                                    // Handle legacy comma-separated values if JSON.parse fails
                                    if (val.proof_url.includes('http')) {
                                        displayFiles = val.proof_url.split(',').map(u => u.trim());
                                    } else {
                                        displayFiles = [val.proof_url];
                                    }
                                }

                                return (
                                    <div key={p.key} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        paddingBottom: '12px',
                                        borderBottom: '1px solid #f0fdf4'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#166534' }}>
                                                {p.label}:
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 500 }}>
                                                {val.status?.toUpperCase() || 'SUBMITTED'} {val.submitted_at ? new Date(val.submitted_at).toLocaleDateString() : ''}
                                            </span>
                                        </div>

                                        {displayFiles.map((url, i) => (
                                            <div key={i} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: '#f8fafc',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #f1f5f9'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                    <FileText size={16} color="#64748b" />
                                                    <span style={{
                                                        fontSize: '0.85rem',
                                                        color: '#334155',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        maxWidth: '220px'
                                                    }}>
                                                        {url.split('/').pop().split('_').pop() || `File ${i + 1}`}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            fontSize: '0.85rem',
                                                            color: '#2563eb',
                                                            fontWeight: 600,
                                                            textDecoration: 'none'
                                                        }}
                                                    >
                                                        View File
                                                    </a>
                                                    <Trash2
                                                        size={14}
                                                        color="#ef4444"
                                                        style={{ cursor: 'pointer', opacity: 0.7 }}
                                                        title="Delete File"
                                                        onClick={() => handleDeleteProof(p.key, url)}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {val.proof_text && (
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: '#4b5563',
                                                backgroundColor: '#f9fafb',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                borderLeft: '4px solid #10b981'
                                            }}>
                                                {val.proof_text}
                                            </div>
                                        )}

                                        {/* Manager Controls: Approve/Reject Phase */}
                                        {(userRole === 'manager' || userRole === 'team_lead' || userRole === 'org_admin') && val.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0fdf4' }}>
                                                <button
                                                    onClick={() => onRejectPhase?.(p.key)}
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        padding: '8px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #fecaca',
                                                        backgroundColor: 'white',
                                                        color: '#ef4444',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <ThumbsDown size={14} /> Reject
                                                </button>
                                                <button
                                                    onClick={() => onApprovePhase?.(p.key)}
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px',
                                                        padding: '8px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        backgroundColor: '#10b981',
                                                        color: 'white',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <ThumbsUp size={14} /> Approve
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {!Object.values(task.phase_validations || {}).some(v => v.proof_url || v.proof_text) && (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>
                                    No proofs submitted for any phase yet.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Actions */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: '1px solid #e2e8f0',
                    height: 'fit-content',
                    position: 'sticky',
                    top: '100px'
                }}>
                    {/* Submit Work Section - Only show for assigned employees, not managers viewing team tasks */}
                    {userId === task.assigned_to && <div style={{ marginBottom: '24px' }}>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <Upload size={18} /> Submit Work
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                            Upload files or link your code repository.
                        </p>

                        {/* File Upload Area */}
                        <div
                            style={{
                                border: '2px dashed #e2e8f0',
                                borderRadius: '12px',
                                padding: '24px',
                                textAlign: 'center',
                                marginBottom: '12px',
                                backgroundColor: '#fafafa',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s'
                            }}
                            onClick={() => document.getElementById('proofFileInput').click()}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                        >
                            <input
                                id="proofFileInput"
                                type="file"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />
                            <Upload size={24} color="#94a3b8" style={{ marginBottom: '8px' }} />
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                                Drag and drop files here or <span style={{ color: '#3b82f6', fontWeight: 500 }}>Browse Files</span>
                            </p>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '8px 0 0 0' }}>
                                You can select multiple files
                            </p>
                        </div>

                        {/* Selected Files List */}
                        {proofFiles.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                                    {proofFiles.length} file(s) selected:
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                                    {proofFiles.map((file, index) => (
                                        <div key={index} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            backgroundColor: '#f0f9ff',
                                            borderRadius: '6px',
                                            border: '1px solid #bfdbfe'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                <FileText size={14} color="#3b82f6" />
                                                <span style={{ fontSize: '0.8rem', color: '#1e40af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {file.name}
                                                </span>
                                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                    ({(file.size / 1024).toFixed(1)} KB)
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    color: '#ef4444',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Upload Progress */}
                        {uploading && (
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Uploading...</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>{uploadProgress}%</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${uploadProgress}%`,
                                        height: '100%',
                                        backgroundColor: '#3b82f6',
                                        borderRadius: '3px',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>
                            </div>
                        )}

                        <textarea
                            value={proofText}
                            onChange={(e) => setProofText(e.target.value)}
                            placeholder="Add comments or notes about your submission..."
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.85rem',
                                resize: 'none',
                                minHeight: '80px',
                                marginBottom: '12px'
                            }}
                        />

                        {/* Pending Steps Warning */}
                        {hasPendingSteps && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 12px',
                                backgroundColor: '#fef3c7',
                                borderRadius: '8px',
                                marginBottom: '12px',
                                border: '1px solid #fcd34d'
                            }}>
                                <AlertTriangle size={16} color="#f59e0b" />
                                <span style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 500 }}>
                                    Complete all execution steps before submitting
                                </span>
                            </div>
                        )}

                        <button
                            onClick={handleSubmitProof}
                            disabled={uploading || hasPendingSteps || (!proofText.trim() && proofFiles.length === 0)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: (!hasPendingSteps && (proofText.trim() || proofFiles.length > 0)) ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#e5e7eb',
                                color: (!hasPendingSteps && (proofText.trim() || proofFiles.length > 0)) ? 'white' : '#9ca3af',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: (!hasPendingSteps && (proofText.trim() || proofFiles.length > 0)) ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {uploading ? 'Submitting...' : hasPendingSteps ? '🔒 Complete Steps First' : 'Submit for Review'}
                        </button>

                        <button
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: 'white',
                                color: '#334155',
                                fontWeight: 500,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                marginTop: '8px'
                            }}
                        >
                            <LinkIcon size={14} /> Connect Repository
                        </button>
                    </div>}

                    {/* Team Notes Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '16px'
                        }}>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                margin: 0
                            }}>
                                <MessageSquare size={18} /> Team Notes
                            </h3>
                            <span style={{ color: '#94a3b8', cursor: 'pointer' }}>•••</span>
                        </div>

                        <div style={{
                            maxHeight: '250px',
                            overflowY: 'auto',
                            marginBottom: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            {loadingNotes ? (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>Loading notes...</p>
                            ) : notes.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>No notes yet. Start the conversation!</p>
                            ) : (
                                notes.map(note => (
                                    <div key={note.id} style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            backgroundColor: '#3b82f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            flexShrink: 0
                                        }}>
                                            {note.profiles?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                marginBottom: '4px'
                                            }}>
                                                <span style={{
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    color: '#334155'
                                                }}>
                                                    {note.profiles?.full_name || 'Unknown'}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    color: '#94a3b8'
                                                }}>
                                                    {new Date(note.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <p style={{
                                                fontSize: '0.85rem',
                                                color: '#64748b',
                                                margin: 0,
                                                lineHeight: 1.5
                                            }}>
                                                {note.note_text}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Type a message to the team..."
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.85rem'
                                }}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                            />
                            <button
                                onClick={handleAddNote}
                                disabled={!newNote.trim() || submittingNote}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: newNote.trim() ? '#3b82f6' : '#e5e7eb',
                                    color: newNote.trim() ? 'white' : '#9ca3af',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: newNote.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Send
                            </button>
                        </div>
                    </div>

                    {/* Issues Section */}
                    <div>
                        <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#334155',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <AlertTriangle size={18} color="#f59e0b" /> Issues
                        </h3>

                        {task.issues ? (
                            <div style={{
                                backgroundColor: '#fef2f2',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '12px',
                                border: '1px solid #fecaca'
                            }}>
                                <pre style={{
                                    fontSize: '0.8rem',
                                    color: '#991b1b',
                                    whiteSpace: 'pre-wrap',
                                    margin: 0,
                                    fontFamily: 'inherit'
                                }}>
                                    {task.issues}
                                </pre>
                                {['manager', 'team_lead', 'executive', 'org_admin'].includes(userRole) && !task.issues.includes('RESOLVED') && (
                                    <button
                                        onClick={handleResolveIssues}
                                        disabled={submittingIssue}
                                        style={{
                                            marginTop: '12px',
                                            padding: '6px 12px',
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <CheckCircle2 size={14} /> Mark as Resolved
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p style={{
                                fontSize: '0.85rem',
                                color: '#94a3b8',
                                fontStyle: 'italic',
                                marginBottom: '12px'
                            }}>
                                No issues reported for this task.
                            </p>
                        )}

                        <textarea
                            value={issueText}
                            onChange={(e) => setIssueText(e.target.value)}
                            placeholder="Describe any issues or blockers..."
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.85rem',
                                resize: 'none',
                                minHeight: '60px',
                                marginBottom: '8px'
                            }}
                        />
                        <button
                            onClick={handleSubmitIssue}
                            disabled={!issueText.trim() || submittingIssue}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '8px',
                                border: 'none',
                                background: issueText.trim() ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#e5e7eb',
                                color: issueText.trim() ? 'white' : '#9ca3af',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: issueText.trim() ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {submittingIssue ? 'Reporting...' : 'Report Issue'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Skip Reason Modal */}
            {
                skipModalStep && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '400px',
                            maxWidth: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                        }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                Skip Step
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
                                Please provide a reason for skipping: <strong>"{skipModalStep.step_title}"</strong>
                            </p>
                            <textarea
                                value={skipReason}
                                onChange={(e) => setSkipReason(e.target.value)}
                                placeholder="e.g., Out of scope for this sprint..."
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.9rem',
                                    resize: 'vertical',
                                    marginBottom: '16px',
                                    outline: 'none'
                                }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setSkipModalStep(null); setSkipReason(''); }}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#f1f5f9',
                                        color: '#64748b',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSkipStep}
                                    disabled={!skipReason.trim()}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: skipReason.trim() ? '#f59e0b' : '#e2e8f0',
                                        color: skipReason.trim() ? 'white' : '#94a3b8',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        border: 'none',
                                        cursor: skipReason.trim() ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Confirm Skip
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Task Notes Modal */}
            <TaskNotesModal
                isOpen={showNotesModal}
                onClose={() => setShowNotesModal(false)}
                task={task}
                userId={userId}
                userRole={userRole}
                orgId={orgId}
                addToast={addToast}
                canAddNote={
                    ['manager', 'team_lead', 'executive', 'org_admin'].includes(userRole) ||
                    task?.assigned_to === userId
                }
            />
        </div >
    );
};


export default TaskDetailOverlay;
