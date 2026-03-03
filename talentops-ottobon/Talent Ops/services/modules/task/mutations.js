import { supabase } from '../../../lib/supabaseClient';
import { calculateDueDateTime } from '../../../lib/businessHoursUtils';

/**
 * Task Mutations
 * Handles create, update, delete operations.
 */

// ... existing imports

export const requestTaskAccess = async (taskId, orgId, reason, currentUserId, assignedByUserId, taskTitle) => {
    const { error } = await supabase
        .from('tasks')
        .update({
            access_requested: true,
            access_reason: reason,
            access_requested_at: new Date().toISOString(),
            access_status: 'pending'
        })
        .eq('id', taskId)
        .eq('org_id', orgId);

    if (error) throw error;

    // Notify Manager
    if (assignedByUserId) {
        await supabase.from('notifications').insert({
            receiver_id: assignedByUserId,
            sender_id: currentUserId,
            message: `Access requested for task: ${taskTitle}`,
            type: 'access_requested',
            is_read: false,
            created_at: new Date().toISOString(),
            org_id: orgId
        });
    }
    return true;
};

export const resolveTaskIssue = async (task, user, orgId) => {
    // Get user profile for name (Self-contained fetch to avoid passing extra params if possible, or pass userName)
    // For efficiency, better to pass userName, but following existing pattern for safety
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .eq('org_id', orgId)
        .single();

    const userName = profile?.full_name || profile?.email || 'Manager';
    const timestamp = new Date().toISOString();

    const resolutionEntry = `\n\n[${new Date(timestamp).toLocaleString()}] RESOLVED by ${userName}`;
    const updatedIssues = (task.issues || '') + resolutionEntry;

    const { error } = await supabase
        .from('tasks')
        .update({
            issues: updatedIssues,
            updated_at: timestamp
        })
        .eq('id', task.id)
        .eq('org_id', orgId);

    if (error) throw error;
    return true;
};

export const updateTask = async (taskId, updates) => {
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
    if (error) throw error;
    return true;
};

export const deleteTask = async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
    return true;
};

export const archiveTask = async (taskId) => {
    const { error } = await supabase.from('tasks').update({ status: 'archived' }).eq('id', taskId);
    if (error) throw error;
    return true;
};

/**
 * Upload phase guidance files.
 * @param {object} phaseFiles - Map of phaseKey -> File object
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} Map of phaseKey -> { guidance_doc_url, guidance_doc_name }
 */
export const uploadGuidanceFiles = async (phaseFiles, projectId) => {
    const guidanceData = {};
    const uploadPromises = Object.entries(phaseFiles).map(async ([phaseKey, file]) => {
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `guidance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `guidance/${projectId || 'general'}/${phaseKey}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('project-docs')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
            console.error(`Failed to upload guidance for ${phaseKey}`, uploadError);
            return;
        }

        const { data: urlData } = supabase.storage.from('project-docs').getPublicUrl(filePath);

        guidanceData[phaseKey] = {
            guidance_doc_url: urlData.publicUrl,
            guidance_doc_name: file.name
        };
    });

    await Promise.all(uploadPromises);
    return guidanceData;
};

/**
 * Create a new Task (or multiple tasks)
 * Encapsulates logic for: 
 * - Single/Multi assignment
 * - File uploads (guidance) - handled via passed filtered params
 * - Task insertion
 * - Step insertion
 * - Notification insertion
 * 
 * @param {object} params
 * @param {object} params.newTask - Task form data
 * @param {object} params.user - Current user object
 * @param {string} params.orgId
 * @param {string} params.effectiveProjectId
 * @param {string} params.senderName
 * @param {object} params.taskStepsToAdd - Steps map
 * @param {Array} params.employees - Employee list (for multi-assign notifications)
 * @param {object} params.preparedValidations - Validations object with guidance links
 */
export const createTask = async ({
    newTask,
    user,
    orgId,
    effectiveProjectId,
    senderName,
    taskStepsToAdd,
    employees,
    preparedValidations
}) => {
    try {
        if (newTask.assignType === 'multi') {
            if (newTask.selectedAssignees.length === 0) {
                throw new Error('Please select at least one employee');
            }

            // Calculate due date/time based on allocated hours and business hours
            const allocatedHrs = parseFloat(newTask.allocatedHours) || 0;
            const startDateStr = `${newTask.startDate}T${newTask.startTime}`;
            const { dueDate, dueTime } = calculateDueDateTime(new Date(startDateStr), allocatedHrs);

            const tasksToInsert = newTask.selectedAssignees.map(empId => ({
                title: newTask.title,
                description: newTask.description,
                assigned_to: empId,
                assigned_by: user.id,
                assigned_by_name: senderName,
                project_id: effectiveProjectId,
                start_date: newTask.startDate,
                start_time: newTask.startTime,
                due_date: dueDate,
                due_time: dueTime,
                priority: newTask.priority.toLowerCase(),
                status: 'pending',
                phase_validations: preparedValidations,
                org_id: orgId,
                allocated_hours: allocatedHrs,
                risk_tag: newTask.riskTag
            }));

            const { data: createdMultiTasks, error: multiTaskError } = await supabase.from('tasks').insert(tasksToInsert).select('id');
            if (multiTaskError) throw multiTaskError;

            // Insert manager-defined steps for all created tasks
            if (createdMultiTasks && createdMultiTasks.length > 0) {
                const allStepsToInsert = [];

                createdMultiTasks.forEach(createdTask => {
                    Object.entries(taskStepsToAdd).forEach(([phaseKey, steps]) => {
                        steps.forEach((step, idx) => {
                            if (step.title.trim()) {
                                allStepsToInsert.push({
                                    org_id: orgId,
                                    task_id: createdTask.id,
                                    stage_id: phaseKey,
                                    step_title: step.title.trim(),
                                    order_index: idx,
                                    status: 'pending',
                                    created_by: user.id,
                                    created_by_role: 'manager',
                                    estimated_hours: step.hours || 2
                                });
                            }
                        });
                    });
                });

                if (allStepsToInsert.length > 0) {
                    const { error: stepsError } = await supabase.from('task_steps').insert(allStepsToInsert);
                    if (stepsError) console.error('Error inserting steps for multi-assign:', stepsError);
                }
            }

            // Notifications for multi
            const notifications = tasksToInsert.map(task => ({
                receiver_id: task.assigned_to,
                sender_id: user.id,
                sender_name: senderName,
                message: `New task assigned: ${task.title}`,
                type: 'task_assigned',
                is_read: false,
                created_at: new Date().toISOString(),
                org_id: orgId
            }));
            await supabase.from('notifications').insert(notifications);

            return createdMultiTasks;

        } else {
            // SINGLE ASSIGNMENT
            const allocatedHrs = parseFloat(newTask.allocatedHours) || 0;
            const startDateStr = `${newTask.startDate}T${newTask.startTime}`;
            const { dueDate, dueTime } = calculateDueDateTime(new Date(startDateStr), allocatedHrs);

            const taskToInsert = {
                title: newTask.title,
                description: newTask.description,
                assigned_to: newTask.assignType === 'individual' ? newTask.assignedTo : null,
                assigned_by: user.id,
                assigned_by_name: senderName,
                project_id: effectiveProjectId,
                start_date: newTask.startDate,
                start_time: newTask.startTime,
                due_date: dueDate,
                due_time: dueTime,
                priority: newTask.priority.toLowerCase(),
                status: 'pending',
                phase_validations: preparedValidations,
                org_id: orgId,
                allocated_hours: allocatedHrs,
                risk_tag: newTask.riskTag
            };

            const { data: createdTasks, error: taskError } = await supabase.from('tasks').insert([taskToInsert]).select('id');
            if (taskError) throw taskError;

            // Insert manager-defined steps for this task
            if (createdTasks && createdTasks.length > 0) {
                const taskId = createdTasks[0].id;
                const stepsToInsert = [];

                Object.entries(taskStepsToAdd).forEach(([phaseKey, steps]) => {
                    steps.forEach((step, idx) => {
                        if (step.title.trim()) {
                            stepsToInsert.push({
                                org_id: orgId,
                                task_id: taskId,
                                stage_id: phaseKey,
                                step_title: step.title.trim(),
                                order_index: idx,
                                status: 'pending',
                                created_by: user.id,
                                created_by_role: 'manager',
                                estimated_hours: step.hours || 2
                            });
                        }
                    });
                });

                if (stepsToInsert.length > 0) {
                    const { error: stepsError } = await supabase.from('task_steps').insert(stepsToInsert);
                    if (stepsError) console.error('Error inserting steps:', stepsError);
                }
            }

            // Send Notifications
            try {
                if (newTask.assignType === 'individual' && newTask.assignedTo) {
                    await supabase.from('notifications').insert({
                        receiver_id: newTask.assignedTo,
                        sender_id: user.id,
                        sender_name: senderName,
                        message: `New task assigned: ${newTask.title}`,
                        type: 'task_assigned',
                        is_read: false,
                        created_at: new Date().toISOString(),
                        org_id: orgId
                    });
                } else if (newTask.assignType === 'team' && employees.length > 0) {
                    // Filter logic for notifications should ideally be here or passed in
                    const notifications = employees.map(emp => ({
                        receiver_id: emp.id,
                        sender_id: user.id,
                        sender_name: senderName,
                        message: `New team task created: ${newTask.title}`,
                        type: 'task_assigned',
                        is_read: false,
                        created_at: new Date().toISOString(),
                        org_id: orgId
                    }));
                    await supabase.from('notifications').insert(notifications);
                }
            } catch (notifyError) {
                console.error('Error sending notification:', notifyError);
            }

            return createdTasks;
        }
    } catch (error) {
        console.error('Service: Error creating task:', error);
        throw error;
    }
};
