import { supabase } from '../../../lib/supabaseClient';

/**
 * Task Workflow
 * Handles complex state transitions: Approvals, Rejections, Proofs, Reviews.
 */

// Lifecycle Definitions
const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirements', short: 'R' },
    { key: 'design_guidance', label: 'Design', short: 'Ds' },
    { key: 'build_guidance', label: 'Build', short: 'B' },
    { key: 'acceptance_criteria', label: 'Acceptance', short: 'A' },
    { key: 'deployment', label: 'Deployment', short: 'D' }
];

const getPhaseIndex = (phase) => LIFECYCLE_PHASES.findIndex(p => p.key === phase);

/**
 * Submit Proof for a task phase.
 * Handles file upload, phase advancement logic, and submission recording.
 */
export const submitTaskProof = async ({
    task,
    user,
    proofFile,
    proofText,
    proofHours,
    onProgress
}) => {
    try {
        let proofUrl = null;

        // 1. Upload File if present
        if (proofFile) {
            onProgress?.(30);
            const fileExt = proofFile.name.split('.').pop();
            const fileName = `${task.id}_${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('task-proofs')
                .upload(filePath, proofFile, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('task-proofs').getPublicUrl(filePath);
            proofUrl = urlData?.publicUrl;
            onProgress?.(70);
        }

        // 2. Update Task State
        const currentPhase = task.lifecycle_state;
        const currentIndex = getPhaseIndex(currentPhase);

        // Auto-Advance Logic
        let nextPhase = currentPhase;
        let foundNext = false;

        if (currentIndex < LIFECYCLE_PHASES.length - 2) {
            let probeIndex = currentIndex + 1;
            while (probeIndex < LIFECYCLE_PHASES.length - 1) {
                const probePhaseKey = LIFECYCLE_PHASES[probeIndex].key;
                const hasProof = task.phase_validations &&
                    task.phase_validations[probePhaseKey] &&
                    (task.phase_validations[probePhaseKey].proof_url || task.phase_validations[probePhaseKey].proof_text);

                if (hasProof) {
                    probeIndex++;
                } else {
                    nextPhase = probePhaseKey;
                    foundNext = true;
                    break;
                }
            }
            if (!foundNext && probeIndex >= LIFECYCLE_PHASES.length - 1) {
                nextPhase = LIFECYCLE_PHASES[LIFECYCLE_PHASES.length - 1].key;
            }
        } else {
            nextPhase = currentPhase;
        }

        const currentValidations = task.phase_validations || {};
        const updatedPhaseData = {
            ...(currentValidations[currentPhase] || {}),
            status: 'pending',
            submitted_at: new Date().toISOString()
        };

        if (proofUrl) updatedPhaseData.proof_url = proofUrl;
        if (proofText) updatedPhaseData.proof_text = proofText;

        const updatedValidations = {
            ...currentValidations,
            [currentPhase]: updatedPhaseData
        };

        const updates = {
            phase_validations: updatedValidations,
            updated_at: new Date().toISOString()
        };

        // Legacy column support
        if (proofUrl) updates.proof_url = proofUrl;

        // Advance Phase
        if (nextPhase !== currentPhase) {
            updates.lifecycle_state = nextPhase;
            updates.sub_state = 'in_progress';
        }

        const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
        if (error) throw error;

        // 3. Record Submission
        const { data: existingSub } = await supabase
            .from('task_submissions')
            .select('id')
            .eq('task_id', task.id)
            .eq('user_id', user.id)
            .single();

        if (existingSub) {
            const { error: upError } = await supabase
                .from('task_submissions')
                .update({
                    actual_hours: parseFloat(proofHours),
                    submitted_at: new Date().toISOString()
                })
                .eq('id', existingSub.id);
            if (upError) throw upError;
        } else {
            const { error: inError } = await supabase
                .from('task_submissions')
                .insert({
                    task_id: task.id,
                    user_id: user.id,
                    actual_hours: parseFloat(proofHours),
                    submitted_at: new Date().toISOString()
                });
            if (inError) throw inError;
        }

        onProgress?.(100);

        // Fetch Feedback
        const { data: pointData } = await supabase
            .from('task_submissions')
            .select('final_points, bonus_points, penalty_points')
            .eq('task_id', task.id)
            .eq('user_id', user.id)
            .single();

        return pointData;

    } catch (error) {
        console.error('Service: Submit Proof Error:', error);
        throw error;
    }
};

export const processAccessReview = async ({
    task,
    action, // 'approve', 'close', 'reassign'
    user,
    orgId,
    reason, // for close
    reassignTarget // id
}) => {
    try {
        if (action === 'approve') {
            await supabase.from('tasks').update({
                access_status: 'approved',
                is_locked: false
            }).eq('id', task.id).eq('org_id', orgId);

            await supabase.from('notifications').insert({
                receiver_id: task.assigned_to,
                sender_id: user.id,
                message: `Access approved for task: ${task.title}`,
                type: 'access_approved',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });

        } else if (action === 'close') {
            await supabase.from('tasks').update({
                status: 'completed',
                closed_by_manager: true,
                closed_reason: reason,
                access_status: 'rejected',
                is_locked: true
            }).eq('id', task.id).eq('org_id', orgId);

            await supabase.from('notifications').insert({
                receiver_id: task.assigned_to,
                sender_id: user.id,
                message: `Task closed by manager: ${task.title}. Reason: ${reason}`,
                type: 'task_closed',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });

        } else if (action === 'reassign') {
            // 1. Ensure new assignee is in project
            if (task.project_id) {
                const { data: existingMembers } = await supabase
                    .from('project_members')
                    .select('id')
                    .eq('project_id', task.project_id)
                    .eq('user_id', reassignTarget)
                    .eq('org_id', orgId);

                if (!existingMembers || existingMembers.length === 0) {
                    await supabase.from('project_members').insert({
                        project_id: task.project_id,
                        user_id: reassignTarget,
                        role: 'employee',
                        org_id: orgId
                    });
                }
            }

            // 2. Close OLD task
            await supabase.from('tasks').update({
                status: 'completed',
                closed_by_manager: true,
                closed_reason: `Reassigned`,
                reassigned_to: reassignTarget,
                reassigned_at: new Date().toISOString(),
                access_status: 'rejected',
                is_locked: true
            }).eq('id', task.id).eq('org_id', orgId);

            // 3. Create NEW task
            const {
                id, created_at, updated_at,
                assignee_name, assignee_avatar, assigned_by_name, project_name,
                reassigned_from_name, reassigned_to_name,
                ...taskData
            } = task;

            const newTaskPayload = {
                ...taskData,
                assigned_to: reassignTarget,
                org_id: orgId,
                status: 'pending',
                lifecycle_state: 'requirement_refiner',
                sub_state: 'pending_validation',
                phase_validations: {
                    active_phases: taskData.phase_validations?.active_phases || ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment']
                },
                proof_url: null,
                proof_text: null,
                reassigned_to: null,
                reassigned_at: new Date().toISOString(),
                access_requested: false,
                access_status: 'approved',
                access_reason: 'Reassigned by manager',
                access_requested_at: null,
                closed_by_manager: false,
                closed_reason: null,
                is_locked: false
            };

            await supabase.from('tasks').insert(newTaskPayload);

            // 4. Notify NEW assignee
            await supabase.from('notifications').insert({
                receiver_id: reassignTarget,
                sender_id: user.id,
                message: `You have been reassigned task: ${task.title}`,
                type: 'task_assigned',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });

            // 5. Notify OLD assignee
            await supabase.from('notifications').insert({
                receiver_id: task.assigned_to,
                sender_id: user.id,
                message: `Task "${task.title}" has been reassigned to another team member.`,
                type: 'task_closed',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            });
        }
    } catch (error) {
        console.error('Service: Process Access Review Error:', error);
        throw error;
    }
};

export const approveTaskPhase = async (task, phaseKey, orgId) => {
    const currentValidations = task.phase_validations || {};
    const phaseData = currentValidations[phaseKey];
    if (!phaseData) throw new Error('Phase data not found');

    const updatedValidations = {
        ...currentValidations,
        [phaseKey]: {
            ...phaseData,
            status: 'approved',
            approved_at: new Date().toISOString()
        }
    };

    const hasOtherPending = Object.entries(updatedValidations).some(([key, val]) => key !== phaseKey && val.status === 'pending');
    const newSubState = hasOtherPending ? 'pending_validation' : 'in_progress';

    const updates = {
        phase_validations: updatedValidations,
        sub_state: newSubState,
        updated_at: new Date().toISOString()
    };

    await supabase.from('tasks').update(updates).eq('id', task.id).eq('org_id', orgId);

    // Check completion
    const phasesToCheck = updatedValidations.active_phases || LIFECYCLE_PHASES.map(p => p.key);
    const lastPhaseKey = phasesToCheck[phasesToCheck.length - 1];
    const isLastPhaseApproved = updatedValidations[lastPhaseKey]?.status === 'approved';

    if (isLastPhaseApproved && task.status !== 'completed') {
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id).eq('org_id', orgId);
    }

    return { updatedValidations, newSubState, isCompleted: isLastPhaseApproved };
};

export const rejectTaskPhase = async (task, phaseKey, orgId) => {
    const currentValidations = task.phase_validations || {};
    const phaseData = currentValidations[phaseKey];
    if (!phaseData) throw new Error('Phase data not found');

    const updatedValidations = {
        ...currentValidations,
        [phaseKey]: {
            ...phaseData,
            status: 'rejected',
            rejected_at: new Date().toISOString()
        }
    };

    const updates = {
        phase_validations: updatedValidations,
        sub_state: 'in_progress',
        updated_at: new Date().toISOString()
    };

    await supabase.from('tasks').update(updates).eq('id', task.id).eq('org_id', orgId);
    return updatedValidations;
};

export const approveTaskLegacy = async (task, orgId) => {
    // Approve all pending phases
    const validations = task.phase_validations || {};
    const pendingPhases = Object.keys(validations).filter(key => validations[key].status === 'pending');

    const updatedValidations = { ...validations };
    pendingPhases.forEach(key => {
        updatedValidations[key] = { ...updatedValidations[key], status: 'approved', approved_at: new Date().toISOString() };
    });

    const updates = {
        phase_validations: updatedValidations,
        updated_at: new Date().toISOString(),
        sub_state: 'in_progress'
    };

    await supabase.from('tasks').update(updates).eq('id', task.id).eq('org_id', orgId);

    // Check completion
    const phasesToCheck = updatedValidations.active_phases || LIFECYCLE_PHASES.map(p => p.key);
    const lastPhaseKey = phasesToCheck[phasesToCheck.length - 1];
    const isLastPhaseApproved = updatedValidations[lastPhaseKey]?.status === 'approved';

    if (isLastPhaseApproved && task.status !== 'completed') {
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task.id).eq('org_id', orgId);
    }

    return { updatedValidations, isCompleted: isLastPhaseApproved };
};

export const rejectTaskLegacy = async (task, orgId) => {
    await supabase
        .from('tasks')
        .update({
            sub_state: 'in_progress',
            updated_at: new Date().toISOString()
        })
        .eq('id', task.id)
        .eq('org_id', orgId);
    return true;
};
