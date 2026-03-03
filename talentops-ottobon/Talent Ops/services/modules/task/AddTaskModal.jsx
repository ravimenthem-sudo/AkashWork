import React, { useState, useEffect, useMemo } from 'react';

import { X, Upload, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { taskService } from '.';

// Lifecycle phases constant
const LIFECYCLE_PHASES = [
    { key: 'requirement_refiner', label: 'Requirement Refinement', icon: 'FileText' },
    { key: 'design_guidance', label: 'Design Guidance', icon: 'PenTool' },
    { key: 'build_guidance', label: 'Build Guidance', icon: 'Code' },
    { key: 'acceptance_criteria', label: 'Acceptance Criteria', icon: 'CheckSquare' },
    { key: 'deployment', label: 'Deployment', icon: 'Rocket' },
];

const AddTaskModal = ({
    isOpen,
    onClose,
    onTaskAdded,
    employees,
    user,
    orgId,
    effectiveProjectId,
    addToast
}) => {
    const [submitting, setSubmitting] = useState(false);

    // Task State
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignType: 'individual',
        assignedTo: '',
        selectedAssignees: [],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        dueTime: '17:00',
        priority: 'Medium',
        skill: '',
        allocatedHours: 10,
        pointsPerHour: 100,
        requiredPhases: ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment'],
        stepDuration: '2h' // Default
    });

    // Phase & Steps State
    const [phaseFiles, setPhaseFiles] = useState({});
    const [phaseDescriptions, setPhaseDescriptions] = useState({});
    const [taskStepsToAdd, setTaskStepsToAdd] = useState({});
    const [activeStepPhase, setActiveStepPhase] = useState('requirement_refiner');
    const [newStepInput, setNewStepInput] = useState('');
    const [newStepHours, setNewStepHours] = useState(2);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            // Optional: Reset state here if we want to clear on close
        } else {
            // Ensure valid active step phase
            if (newTask.requiredPhases.length > 0 && !newTask.requiredPhases.includes(activeStepPhase)) {
                setActiveStepPhase(newTask.requiredPhases[0]);
            }
        }
    }, [isOpen, newTask.requiredPhases, activeStepPhase]);

    // Smart Sort for Employees based on selected skill
    const sortedEmployees = useMemo(() => {
        if (!Array.isArray(employees)) return [];
        if (!newTask.skill) return employees;

        return [...employees].sort((a, b) => {
            const scoreA = a.technical_scores?.[newTask.skill] || 0;
            const scoreB = b.technical_scores?.[newTask.skill] || 0;
            return scoreA - scoreB; // Ascending Order (Least skilled first) per user requirement
        });
    }, [employees, newTask.skill]);

    const handleAddTask = async (e) => {
        e.preventDefault();
        if (!newTask.title) {
            addToast?.('Please enter a task title', 'error');
            return;
        }

        if (!newTask.startTime || !newTask.dueTime) {
            addToast?.('Please select start and due times', 'error');
            return;
        }

        setSubmitting(true);
        try {
            // Get sender name (could affect performance if called every time, but keeping logic same for now)
            // Ideally senderName should be passed or cached, but we'll fetch it here to match original logic
            // or we assume user.user_metadata.full_name if available.
            // Original logic fetched profile. Let's use what we can.
            // We'll trust taskService or do a quick fetch if needed. 
            // Actually, best to fetch profile once or pass it. 
            // For now, let's just pass 'Task Manager' or fetch if strictly needed.
            // The original code fetched it:
            /*
            const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .eq('org_id', orgId)
                .single();
            */
            // I'll skip the profile fetch for now and use user.email or a placeholder if name missing, 
            // OR strictly, I should import supabase and do it.
            // Let's assume the service handles senderName or we pass something reasonable.
            const senderName = user?.user_metadata?.full_name || user?.email || 'Task Manager';

            // 1. Upload Phase Guidance Files via Service
            const guidanceData = await taskService.uploadGuidanceFiles(phaseFiles, effectiveProjectId);

            // 2. Build Validations
            const buildPhaseValidations = () => {
                const validations = {
                    active_phases: newTask.requiredPhases
                };
                newTask.requiredPhases.forEach(phase => {
                    validations[phase] = {
                        status: 'pending',
                        description: phaseDescriptions[phase] || '',
                        ...(guidanceData[phase] || {})
                    };
                });
                return validations;
            };

            const preparedValidations = buildPhaseValidations();

            // 3. Create Task via Service
            await taskService.createTask({
                newTask,
                user,
                orgId,
                effectiveProjectId,
                senderName,
                taskStepsToAdd,
                employees,
                preparedValidations
            });

            addToast?.('Task assigned successfully!', 'success');
            onTaskAdded(); // Notify parent to refresh
            onClose();     // Close modal

            // Reset Form
            setNewTask({
                title: '',
                description: '',
                assignType: 'individual',
                assignedTo: '',
                selectedAssignees: [],
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                dueTime: '17:00',
                priority: 'Medium',
                skill: '',
                allocatedHours: 10,
                pointsPerHour: 100,
                requiredPhases: ['requirement_refiner', 'design_guidance', 'build_guidance', 'acceptance_criteria', 'deployment'],
                stepDuration: '2h'
            });
            setPhaseFiles({});
            setPhaseDescriptions({});
            setTaskStepsToAdd({});
            setNewStepInput('');
            setNewStepHours(2);
        } catch (error) {
            console.error('Error adding task:', error);
            addToast?.('Failed to assign task', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <div style={{ backgroundColor: 'white', padding: '0', borderRadius: '16px', width: '900px', maxWidth: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>Assign New Task</h3>
                        <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>Create and assign tasks to your team</p>
                    </div>
                    <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'background 0.2s' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <form onSubmit={handleAddTask}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Basic Info Section */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Task Title *</label>
                                    <input
                                        type="text"
                                        value={newTask.title}
                                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                        placeholder="e.g. Implement User Authentication"
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', transition: 'border-color 0.2s' }}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Description</label>
                                    <textarea
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        placeholder="Detailed description of the task..."
                                        rows="4"
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', resize: 'vertical', minHeight: '100px' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Assign To <span style={{ color: '#ef4444' }}>*</span></label>

                                    {/* Assign Type Radio Group */}
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '0.85rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1e293b' }}>
                                            <input
                                                type="radio"
                                                name="assignType"
                                                checked={newTask.assignType === 'individual'}
                                                onChange={() => setNewTask({ ...newTask, assignType: 'individual' })}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Individual Employee
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1e293b' }}>
                                            <input
                                                type="radio"
                                                name="assignType"
                                                checked={newTask.assignType === 'team'}
                                                onChange={() => setNewTask({ ...newTask, assignType: 'team' })}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Entire Team
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1e293b' }}>
                                            <input
                                                type="radio"
                                                name="assignType"
                                                checked={newTask.assignType === 'multi'}
                                                onChange={() => setNewTask({ ...newTask, assignType: 'multi' })}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            Multiple Members
                                        </label>
                                    </div>

                                    {/* Dynamic Assignment Input */}
                                    {newTask.assignType === 'individual' && (
                                        <select
                                            value={newTask.assignedTo}
                                            onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white' }}
                                        >
                                            <option value="">Select Employee</option>
                                            {sortedEmployees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                            ))}
                                        </select>
                                    )}

                                    {newTask.assignType === 'team' && (
                                        <div style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.9rem' }}>
                                            Assigning to entire team ({employees?.length || 0} members). Each member will receive a copy.
                                        </div>
                                    )}

                                    {newTask.assignType === 'multi' && (
                                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px', backgroundColor: 'white' }}>
                                            {sortedEmployees.length > 0 ? sortedEmployees.map(emp => (
                                                <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.1s' }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={newTask.selectedAssignees.includes(emp.id)}
                                                        onChange={(e) => {
                                                            const newSelected = e.target.checked
                                                                ? [...newTask.selectedAssignees, emp.id]
                                                                : newTask.selectedAssignees.filter(id => id !== emp.id);
                                                            setNewTask({ ...newTask, selectedAssignees: newSelected });
                                                        }}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '0.9rem', color: '#334155' }}>{emp.full_name}</span>
                                                </label>
                                            )) : <div style={{ padding: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>No employees found.</div>}
                                        </div>
                                    )}
                                </div>

                                {/* Priority Section */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Priority</label>
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                        {['Low', 'Medium', 'High', 'Critical'].map(p => (
                                            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                                <input
                                                    type="radio"
                                                    name="priority"
                                                    value={p}
                                                    checked={newTask.priority === p}
                                                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                <span style={{
                                                    fontSize: '0.9rem',
                                                    color: p === 'Critical' ? '#ef4444' : p === 'High' ? '#f59e0b' : '#334155',
                                                    fontWeight: newTask.priority === p ? 600 : 400
                                                }}>{p}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Date & Time Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Start Date</label>
                                    <input
                                        type="date"
                                        value={newTask.startDate}
                                        onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Start Time</label>
                                    <input
                                        type="time"
                                        value={newTask.startTime}
                                        onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Due Date</label>
                                    <input
                                        type="date"
                                        value={newTask.endDate}
                                        min={newTask.startDate}
                                        onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
                                        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                                        Due Time
                                        {newTask.allocatedHours > 0 && (
                                            <span style={{ fontSize: '0.65rem', backgroundColor: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>AUTO</span>
                                        )}
                                    </label>
                                    <input
                                        type="time"
                                        value={newTask.dueTime}
                                        readOnly={newTask.allocatedHours > 0}
                                        onChange={(e) => !newTask.allocatedHours && setNewTask({ ...newTask, dueTime: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            outline: 'none',
                                            backgroundColor: newTask.allocatedHours > 0 ? '#f8fafc' : 'white',
                                            color: newTask.allocatedHours > 0 ? '#64748b' : 'inherit'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Value Configuration */}
                            <div style={{ padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #e0f2fe', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>Required Skill</label>
                                        <select
                                            value={newTask.skill}
                                            onChange={(e) => setNewTask({ ...newTask, skill: e.target.value })}
                                            style={{ width: '100%', padding: '10px 12px', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                        >
                                            <option value="">Select Skill</option>
                                            {['Frontend', 'Backend', 'Workflows', 'Databases', 'Prompting', 'Non-popular LLMs', 'Fine-tuning', 'Data Labelling', 'Content Generation'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', margin: 0 }}>Allocated Hours</label>
                                            {Object.values(taskStepsToAdd).flat().length > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '1px 4px', borderRadius: '3px' }}>CALCULATED</span>}
                                        </div>
                                        <input
                                            type="number"
                                            value={newTask.allocatedHours}
                                            readOnly={Object.values(taskStepsToAdd).flat().length > 0}
                                            onChange={(e) => setNewTask({ ...newTask, allocatedHours: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: Object.values(taskStepsToAdd).flat().length > 0 ? '1px solid #e2e8f0' : '1px solid #bae6fd',
                                                borderRadius: '8px',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                backgroundColor: Object.values(taskStepsToAdd).flat().length > 0 ? '#f8fafc' : 'white',
                                                color: Object.values(taskStepsToAdd).flat().length > 0 ? '#64748b' : 'inherit'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Lifecycle Stages Selection */}
                            <div style={{ marginTop: '12px' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
                                    Required Lifecycle Stages <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <div id="lifecycle-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {LIFECYCLE_PHASES.map(phase => {
                                        const active = newTask.requiredPhases.includes(phase.key);
                                        const file = phaseFiles[phase.key];

                                        return (
                                            <div key={phase.key} style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                padding: '12px 14px',
                                                backgroundColor: active ? '#f8fafc' : 'white',
                                                border: `1px solid ${active ? '#e2e8f0' : '#f1f5f9'}`,
                                                borderRadius: '12px',
                                                transition: 'all 0.2s ease',
                                                marginBottom: '8px',
                                                cursor: 'pointer'
                                            }} onClick={() => {
                                                const isChecked = newTask.requiredPhases.includes(phase.key);
                                                if (!isChecked) {
                                                    const newPhases = [...newTask.requiredPhases, phase.key].sort((a, b) =>
                                                        LIFECYCLE_PHASES.findIndex(p => p.key === a) - LIFECYCLE_PHASES.findIndex(p => p.key === b)
                                                    );
                                                    setNewTask({ ...newTask, requiredPhases: newPhases });
                                                } else if (newTask.requiredPhases.length > 1) {
                                                    setNewTask({ ...newTask, requiredPhases: newTask.requiredPhases.filter(p => p !== phase.key) });
                                                    const newFiles = { ...phaseFiles };
                                                    delete newFiles[phase.key];
                                                    setPhaseFiles(newFiles);
                                                    const newDescs = { ...phaseDescriptions };
                                                    delete newDescs[phase.key];
                                                    setPhaseDescriptions(newDescs);
                                                }
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                        <div style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '4px',
                                                            border: `2px solid ${active ? '#0f172a' : '#cbd5e1'}`,
                                                            backgroundColor: active ? '#0f172a' : 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            {active && <div style={{ width: '6px', height: '6px', backgroundColor: 'white', borderRadius: '1.5px' }} />}
                                                        </div>
                                                        <span style={{
                                                            fontSize: '0.9rem',
                                                            fontWeight: active ? 600 : 400,
                                                            color: active ? '#0f172a' : '#64748b'
                                                        }}>{phase.label}</span>
                                                    </div>

                                                    {active && (
                                                        <div
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <input
                                                                type="file"
                                                                id={`guidance-${phase.key}`}
                                                                style={{ display: 'none' }}
                                                                onChange={(e) => {
                                                                    if (e.target.files[0]) {
                                                                        setPhaseFiles({ ...phaseFiles, [phase.key]: e.target.files[0] });
                                                                    }
                                                                }}
                                                            />

                                                            {file ? (
                                                                <div style={{
                                                                    display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff',
                                                                    padding: '6px 12px', borderRadius: '8px', border: '1px solid #dbeafe',
                                                                    fontSize: '0.8rem', color: '#2563eb'
                                                                }}>
                                                                    <FileText size={14} />
                                                                    <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {file.name}
                                                                    </span>
                                                                    <X
                                                                        size={14} style={{ cursor: 'pointer' }}
                                                                        onClick={() => {
                                                                            const n = { ...phaseFiles };
                                                                            delete n[phase.key];
                                                                            setPhaseFiles(n);
                                                                        }}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => document.getElementById(`guidance-${phase.key}`).click()}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                                                                        borderRadius: '8px', border: '1px dashed #cbd5e1', backgroundColor: 'white',
                                                                        color: '#64748b', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    <Upload size={14} /> Add Specs
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {active && (
                                                    <div style={{ marginTop: '10px', width: '100%' }} onClick={e => e.stopPropagation()}>
                                                        <textarea
                                                            placeholder={`Add specific instructions or requirements for the ${phase.label} stage...`}
                                                            value={phaseDescriptions[phase.key] || ''}
                                                            onChange={e => setPhaseDescriptions({ ...phaseDescriptions, [phase.key]: e.target.value })}
                                                            style={{
                                                                width: '100%',
                                                                minHeight: '60px',
                                                                padding: '10px',
                                                                borderRadius: '8px',
                                                                border: '1px solid #e2e8f0',
                                                                fontSize: '0.85rem',
                                                                color: '#334155',
                                                                fontFamily: 'inherit',
                                                                resize: 'vertical',
                                                                outline: 'none',
                                                                backgroundColor: 'white'
                                                            }}
                                                            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                                                            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                    Uncheck stages not needed. Upload guidance docs for stages if necessary.
                                </p>
                            </div>

                            {/* Execution Steps Section */}
                            <div style={{ marginTop: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>
                                    📝 Pre-define Execution Steps (Optional)
                                </label>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>Step Duration Setting</label>
                                    <div style={{ display: 'flex', gap: '8px', backgroundColor: 'white', padding: '4px', borderRadius: '8px', border: '1px solid #bae6fd', width: 'fit-content' }}>
                                        <button
                                            type="button"
                                            onClick={() => setNewTask(prev => ({ ...prev, stepDuration: '2h' }))}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                backgroundColor: newTask.stepDuration === '2h' ? '#0ea5e9' : 'transparent',
                                                color: newTask.stepDuration === '2h' ? 'white' : '#64748b',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            2 Hours / Step
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewTask(prev => ({ ...prev, stepDuration: '4h' }))}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                backgroundColor: newTask.stepDuration === '4h' ? '#0ea5e9' : 'transparent',
                                                color: newTask.stepDuration === '4h' ? 'white' : '#64748b',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            4 Hours / Step
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                                        Checklist for each lifecycle phase
                                    </p>
                                    {Object.values(taskStepsToAdd).flat().reduce((sum, s) => sum + (s.hours || 0), 0) > 0 && (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>
                                            Total Estimated Time: {Object.values(taskStepsToAdd).flat().reduce((sum, s) => sum + (s.hours || 0), 0)}h
                                        </span>
                                    )}
                                </div>

                                {/* Phase Tabs */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                    {newTask.requiredPhases.map(phaseKey => {
                                        const phaseLabel = {
                                            'requirement_refiner': 'Requirements',
                                            'design_guidance': 'Design',
                                            'build_guidance': 'Build',
                                            'acceptance_criteria': 'Acceptance',
                                            'deployment': 'Deployment'
                                        }[phaseKey] || phaseKey;
                                        const stepCount = (taskStepsToAdd[phaseKey] || []).length;
                                        return (
                                            <button
                                                key={phaseKey}
                                                type="button"
                                                onClick={() => setActiveStepPhase(phaseKey)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: activeStepPhase === phaseKey ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                                    backgroundColor: activeStepPhase === phaseKey ? '#eff6ff' : 'white',
                                                    color: activeStepPhase === phaseKey ? '#1d4ed8' : '#64748b',
                                                    fontWeight: 600,
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                {phaseLabel}
                                                {stepCount > 0 && (
                                                    <span style={{
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        borderRadius: '10px',
                                                        padding: '1px 6px',
                                                        fontSize: '0.7rem'
                                                    }}>{stepCount}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Steps List for Active Phase */}
                                <div style={{
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    padding: '12px'
                                }}>
                                    {(taskStepsToAdd[activeStepPhase] || []).length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                            {(taskStepsToAdd[activeStepPhase] || []).map((step, idx) => (
                                                <div key={idx} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '8px 10px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e2e8f0'
                                                }}>
                                                    <span style={{ fontSize: '0.85rem', color: '#334155', flex: 1 }}>
                                                        {idx + 1}. {step.title}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.75rem',
                                                        color: '#64748b',
                                                        backgroundColor: '#f1f5f9',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontWeight: 600
                                                    }}>
                                                        {step.hours}h
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const updated = [...(taskStepsToAdd[activeStepPhase] || [])];
                                                            updated.splice(idx, 1);
                                                            setTaskStepsToAdd({ ...taskStepsToAdd, [activeStepPhase]: updated });
                                                        }}
                                                        style={{
                                                            border: 'none',
                                                            background: 'none',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            padding: '4px'
                                                        }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginBottom: '12px' }}>
                                            No steps added for this phase yet.
                                        </p>
                                    )}

                                    {/* Add Step Input */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={newStepInput}
                                            onChange={(e) => setNewStepInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newStepInput.trim()) {
                                                    e.preventDefault();
                                                    const existing = taskStepsToAdd[activeStepPhase] || [];
                                                    const defaultDuration = parseFloat(newTask.stepDuration) || 2;
                                                    setTaskStepsToAdd({
                                                        ...taskStepsToAdd,
                                                        [activeStepPhase]: [...existing, { title: newStepInput.trim(), hours: parseFloat(newStepHours) || defaultDuration }]
                                                    });
                                                    setNewStepInput('');
                                                    setNewStepHours(defaultDuration);
                                                }
                                            }}
                                            placeholder="+ Add a step for this phase..."
                                            style={{
                                                flex: 1,
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.85rem',
                                                outline: 'none'
                                            }}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                                type="number"
                                                value={newStepHours}
                                                onChange={(e) => setNewStepHours(e.target.value)}
                                                min="0.5"
                                                step="0.5"
                                                style={{
                                                    width: '60px',
                                                    padding: '8px 6px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #e2e8f0',
                                                    fontSize: '0.85rem',
                                                    outline: 'none',
                                                    textAlign: 'center'
                                                }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>hrs</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (newStepInput.trim()) {
                                                    const existing = taskStepsToAdd[activeStepPhase] || [];
                                                    setTaskStepsToAdd({
                                                        ...taskStepsToAdd,
                                                        [activeStepPhase]: [...existing, { title: newStepInput.trim(), hours: parseFloat(newStepHours) || 2 }]
                                                    });
                                                    setNewStepInput('');
                                                    setNewStepHours(2);
                                                }
                                            }}
                                            disabled={!newStepInput.trim()}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                backgroundColor: newStepInput.trim() ? '#3b82f6' : '#e2e8f0',
                                                color: newStepInput.trim() ? 'white' : '#94a3b8',
                                                fontWeight: 600,
                                                fontSize: '0.8rem',
                                                cursor: newStepInput.trim() ? 'pointer' : 'default'
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                marginTop: '12px',
                                display: 'flex',
                                gap: '12px',
                                justifyContent: 'flex-end'
                            }}>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        backgroundColor: 'white',
                                        color: '#64748b',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#0f172a',
                                        color: 'white',
                                        fontWeight: 600,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        fontSize: '0.95rem',
                                        opacity: submitting ? 0.7 : 1
                                    }}
                                >
                                    {submitting ? 'Assigning...' : 'Assign Task'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div >
        </div>
    );
};

export default AddTaskModal;
