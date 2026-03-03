import React from 'react';
import { Calendar, Clock, ChevronDown, Eye, Edit2, Archive, AlertTriangle } from 'lucide-react';

const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirements', short: 'R' },
    { key: 'design_guidance', label: 'Design', short: 'Ds' },
    { key: 'build_guidance', label: 'Build', short: 'B' },
    { key: 'acceptance_criteria', label: 'Acceptance', short: 'A' },
    { key: 'deployment', label: 'Deployment', short: 'D' }
];

const getPriorityStyle = (priority) => {
    const styles = {
        high: { bg: '#fee2e2', text: '#991b1b', label: 'HIGH' },
        medium: { bg: '#fef3c7', text: '#92400e', label: 'MEDIUM' },
        low: { bg: '#dbeafe', text: '#1e40af', label: 'LOW' }
    };
    return styles[priority?.toLowerCase()] || styles.medium;
};

const getStatusStyle = (status) => {
    const styles = {
        pending: { bg: '#fef3c7', text: '#92400e' },
        'in progress': { bg: '#dbeafe', text: '#1e40af' },
        completed: { bg: '#d1fae5', text: '#065f46' },
        'on hold': { bg: '#fee2e2', text: '#991b1b' }
    };
    return styles[status?.toLowerCase()] || styles.pending;
};

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
    // Filter phases like the Employee View (excluding 'closed' if present, though LIFECYCLE_PHASES here doesn't have it)
    const filteredPhases = LIFECYCLE_PHASES.filter(p => activePhases.includes(p.key));

    const currentIndex = filteredPhases.findIndex(p => p.key === (currentPhase || filteredPhases[0]?.key));

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            {filteredPhases.map((phase, idx) => {
                const validation = parsedValidations?.[phase.key];
                const status = validation?.status;
                let color = '#e5e7eb'; // Default Grey

                const hasProof = validation?.proof_url || validation?.proof_text;

                if (taskStatus?.toLowerCase() === 'completed') {
                    color = '#10b981';
                } else if (idx < currentIndex) {
                    if (status === 'pending') { color = '#f59e0b'; }
                    else if (status === 'rejected') color = '#fee2e2';
                    else color = '#10b981';
                } else if (idx === currentIndex) {
                    if (status === 'approved') color = '#10b981';
                    else if (status === 'pending' || subState === 'pending_validation') { color = '#f59e0b'; }
                    else color = '#3b82f6';
                } else if (hasProof) {
                    if (status === 'pending') { color = '#f59e0b'; }
                    else if (status === 'rejected') color = '#fee2e2';
                    else color = '#10b981';
                }

                return (
                    <React.Fragment key={phase.key}>
                        <div title={`${phase.label}: ${status || 'Pending'}`} style={{
                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: (color === '#e5e7eb') ? '#9ca3af' : (color === '#f59e0b' ? 'white' : 'white'),
                            fontSize: '0.65rem', fontWeight: 700, cursor: 'help'
                        }}>
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

const TaskTable = ({
    loading,
    tasks,
    viewMode,
    userRole,
    userId,
    handleUpdateTask,
    handleArchiveTask,
    handleEditTask,
    setSelectedTask,
    setTaskForAccess,
    setShowAccessRequestModal,
    setAccessReviewTask,
    setReviewAction,
    setShowAccessReviewModal,
    openIssueModal
}) => {

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#6b7280' }}>
                <img src="https://cdni.iconscout.com/illustration/premium/thumb/empty-state-2130362-1800926.png" alt="No Tasks" style={{ width: '200px', marginBottom: '16px', opacity: 0.8 }} />
                <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No tasks found</p>
                <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Try adjusting your filters or search query</p>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            overflow: 'hidden'
        }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task</th>
                            {userRole !== 'manager' && (
                                <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                            )}
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignee</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {userRole === 'manager' ? 'Lifecycle' : 'Progress'}
                            </th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hours</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</th>
                            <th style={{ padding: '16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map(task => {
                            const priorityStyle = getPriorityStyle(task.priority);
                            const statusStyle = getStatusStyle(task.status);

                            // Determine Reassignment Label
                            let reassignmentLabel = null;
                            if (task.reassigned_from_name) {
                                reassignmentLabel = `From: ${task.reassigned_from_name}`;
                            } else if (task.reassigned_to_name) {
                                reassignmentLabel = `To: ${task.reassigned_to_name}`;
                            }

                            return (
                                <tr key={task.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                                    <td style={{ padding: '16px', maxWidth: '300px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{task.title}</span>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {task.project_name} • {task.assignee_name}
                                            </span>
                                        </div>
                                    </td>
                                    {userRole !== 'manager' && (
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    backgroundColor: statusStyle.bg,
                                                    color: statusStyle.text,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.02em',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {task.status?.replace('_', ' ') || 'PENDING'}
                                                </span>

                                                {reassignmentLabel && (
                                                    <div style={{
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
                                                        {reassignmentLabel}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                backgroundColor: '#e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                                color: '#64748b'
                                            }}>
                                                {task.assignee_avatar ? (
                                                    <img src={task.assignee_avatar} alt={task.assignee_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    task.assignee_name.charAt(0)
                                                )}
                                            </div>
                                            <span style={{ fontWeight: 500, color: '#0f172a', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{task.assignee_name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                        <LifecycleProgress currentPhase={task.lifecycle_state} subState={task.sub_state} validations={task.phase_validations} taskStatus={task.status} />
                                    </td>
                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                            <Calendar size={12} />
                                            <span style={{ fontSize: '0.75rem' }}>
                                                {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                            <Clock size={12} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                                {task.allocated_hours ? `${task.allocated_hours}h` : '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                            <select
                                                value={task.priority || 'medium'}
                                                onChange={(e) => handleUpdateTask(task.id, { priority: e.target.value.toLowerCase() })}
                                                style={{
                                                    padding: '4px 24px 4px 10px',
                                                    backgroundColor: priorityStyle.bg,
                                                    color: priorityStyle.text,
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    appearance: 'none',
                                                    minWidth: '80px'
                                                }}
                                            >
                                                <option value="high">HIGH</option>
                                                <option value="medium">MEDIUM</option>
                                                <option value="low">LOW</option>
                                            </select>
                                            <ChevronDown size={10} style={{
                                                position: 'absolute',
                                                right: '6px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                pointerEvents: 'none',
                                                color: priorityStyle.text
                                            }} />
                                        </div>
                                    </td>

                                    <td style={{ padding: '12px', verticalAlign: 'middle', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                            <button
                                                onClick={() => setSelectedTask(task)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '6px 10px',
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#0f172a',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                            >
                                                <Eye size={12} />
                                                View
                                            </button>

                                            {/* Edit Button */}
                                            {(userRole === 'manager' || userRole === 'team_lead') && task.status !== 'completed' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditTask(task);
                                                    }}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '6px 10px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Edit2 size={12} />
                                                    Edit
                                                </button>
                                            )}

                                            {/* Archive Button - Available for ALL tasks */}
                                            {task.status !== 'archived' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveTask(task.id);
                                                    }}
                                                    title="Archive this task"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '6px 10px',
                                                        backgroundColor: '#6366f1',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4f46e5'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#6366f1'}
                                                >
                                                    <Archive size={12} />
                                                    Archive
                                                </button>
                                            )}

                                            {/* Employee Actions: Show for My Tasks OR if I am the assignee */}
                                            {(viewMode === 'my_tasks' || (task.assigned_to === userId)) && (
                                                <>
                                                    {/* Check Locking Logic */}
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

                                                        if (isLocked) {
                                                            if (task.access_requested && task.access_status === 'pending') {
                                                                return (
                                                                    <span style={{ fontSize: '0.7rem', padding: '6px 10px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 600 }}>
                                                                        Access Pending
                                                                    </span>
                                                                );
                                                            }
                                                            return (
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
                                                            );
                                                        }

                                                        // Not Locked
                                                        return null;
                                                    })()}
                                                </>
                                            )}

                                            {/* Manager: Access Requests */}
                                            {(userRole === 'manager' || userRole === 'team_lead') && task.access_requested && task.access_status === 'pending' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAccessReviewTask(task);
                                                        setReviewAction('approve');
                                                        setShowAccessReviewModal(true);
                                                    }}
                                                    title={`Reason: ${task.access_reason}`}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px',
                                                        backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px',
                                                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                                                    }}
                                                >
                                                    Review Access
                                                </button>
                                            )}

                                            {(userRole === 'manager' || userRole === 'team_lead') && task.issues && !task.issues.includes('RESOLVED') && (
                                                <button
                                                    onClick={() => openIssueModal(task)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 12px',
                                                        backgroundColor: '#f59e0b',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <AlertTriangle size={14} />
                                                    Resolve
                                                </button>
                                            )}


                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default TaskTable;
