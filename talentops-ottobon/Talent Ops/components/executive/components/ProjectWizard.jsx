import React, { useState, useEffect } from 'react';
import {
    Plus, Users, FolderOpen, UserPlus, X, Trash2, Search, Building2,
    ChevronRight, ChevronLeft, Check, CheckCircle, XCircle, FileText,
    ListTodo, Shield, Briefcase, Layout, Filter, ArrowRight, Loader2,
    Upload, Sparkles, Target, Zap, Clock, ShieldCheck, Mail, Database, Terminal,
    Palette, Microscope, Globe, Cpu, Cloud, FileCode, CheckSquare
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useUser } from '../context/UserContext';

const ProjectWizard = ({ isOpen, onClose, onComplete, addToast }) => {
    const { orgId, userId } = useUser();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [allEmployees, setAllEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [filesToUpload, setFilesToUpload] = useState([]);
    const [customTasks, setCustomTasks] = useState({});
    const [taskInputs, setTaskInputs] = useState({});

    // Lifecycle phases - same as in AllTasksView
    const LIFECYCLE_PHASES = [
        { key: 'requirement_refiner', label: 'Requirements', short: 'R' },
        { key: 'design_guidance', label: 'Design', short: 'A' },
        { key: 'build_guidance', label: 'Build', short: 'D' },
        { key: 'acceptance_criteria', label: 'Acceptance', short: 'A' },
        { key: 'deployment', label: 'Deployment', short: 'D' }
    ];
    const fileInputRef = React.useRef(null);

    // Wizard State
    const [projectData, setProjectData] = useState({
        name: '',
        description: '',
        type: 'Internal', // Internal, Client, Hiring
        status: 'Draft'
    });

    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [employeeDetails, setEmployeeDetails] = useState({});

    const totalSteps = 7;

    // Updated Roles
    const functionalRoles = [
        { value: 'Developer', icon: FileCode, docs: ['Tech Specs'], tasks: ['Implementation'] },
        { value: 'Analyst', icon: Microscope, docs: ['Requirements'], tasks: ['Analysis'] },
        { value: 'Tester', icon: CheckSquare, docs: ['Test Cases'], tasks: ['Testing'] },
        { value: 'QA Engineer', icon: ShieldCheck, docs: ['QA Report'], tasks: ['Quality Assurance'] }
    ];

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
            const savedState = localStorage.getItem('talent_ops_project_wizard_state');
            if (savedState) {
                try {
                    const parsed = JSON.parse(savedState);
                    setProjectData(parsed.projectData || projectData);
                    setSelectedEmployees(parsed.selectedEmployees || []);
                    setEmployeeDetails(parsed.employeeDetails || {});
                    setCurrentStep(parsed.currentStep || 1);
                } catch (e) {
                    console.error('Failed to parse saved wizard state', e);
                }
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            localStorage.setItem('talent_ops_project_wizard_state', JSON.stringify({
                projectData,
                selectedEmployees,
                employeeDetails,
                currentStep
            }));
        }
    }, [projectData, selectedEmployees, employeeDetails, currentStep, isOpen]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, department, job_title')
                .order('full_name');
            if (error) throw error;
            setAllEmployees(data || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
            addToast?.('Failed to fetch employees', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                setCurrentStep(currentStep + 1);
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const validateStep = (step) => {
        switch (step) {
            case 1:
                if (!projectData.name.trim()) {
                    addToast?.('Project name is required', 'error');
                    return false;
                }
                return true;
            case 2:
                if (selectedEmployees.length === 0) {
                    addToast?.('Please allocate at least one employee', 'error');
                    return false;
                }
                return true;
            case 3:
                const missingDesignation = selectedEmployees.some(id => !employeeDetails[id]?.designation);
                if (missingDesignation) {
                    addToast?.('Assign designation for all employees', 'error');
                    return false;
                }
                return true;
            case 4:
                const needsFunctionalRole = selectedEmployees.filter(id =>
                    employeeDetails[id]?.designation === 'Consultant / Employee' ||
                    employeeDetails[id]?.designation === 'Team Lead'
                );
                const missingRole = needsFunctionalRole.some(id => !employeeDetails[id]?.functionalRole);
                if (missingRole) {
                    addToast?.('Assign functional role for all consultants and team leads', 'error');
                    return false;
                }
                return true;
            default:
                return true;
        }
    };

    const toggleEmployee = (empInput) => {
        const emp = (empInput.full_name) ? empInput : allEmployees.find(e => String(e.id) === String(empInput.id));
        if (!emp) return;

        const sid = String(emp.id);
        setSelectedEmployees(prev => {
            const stringSelected = prev.map(String);
            const isSelected = stringSelected.includes(sid);

            if (isSelected) {
                // Remove
                const filtered = prev.filter(id => String(id) !== sid);

                // Clean up details and tasks
                setEmployeeDetails(details => {
                    const next = { ...details };
                    delete next[sid];
                    return next;
                });
                setCustomTasks(tasks => {
                    const next = { ...tasks };
                    delete next[sid];
                    return next;
                });

                return filtered;
            } else {
                // Add
                setEmployeeDetails(details => ({
                    ...details,
                    [sid]: {
                        designation: '',
                        functionalRole: '',
                        full_name: emp.full_name || 'Unknown Employee',
                        email: emp.email,
                        job_title: emp.job_title,
                        department: emp.department
                    }
                }));
                return [...prev, sid];
            }
        });
    };

    const handleAddTask = (userId) => {
        const text = taskInputs[userId]?.title?.trim();
        if (!text) return;

        const currentT = customTasks[userId] || [];
        const newTask = {
            title: text,
            hours: taskInputs[userId]?.hours || 8,
            priority: taskInputs[userId]?.priority || 'medium',
            dueDate: taskInputs[userId]?.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        setCustomTasks({ ...customTasks, [userId]: [...currentT, newTask] });
        setTaskInputs({ ...taskInputs, [userId]: { title: '', hours: 8, priority: 'medium', dueDate: '' } });
    };

    const removeTask = (userId, taskIdx) => {
        const currentT = customTasks[userId] || [];
        setCustomTasks({ ...customTasks, [userId]: currentT.filter((_, i) => i !== taskIdx) });
    };

    const handleFileSelect = (e) => {
        const newFiles = Array.from(e.target.files);
        setFilesToUpload([...filesToUpload, ...newFiles]);
    };

    const removeFile = (index) => {
        setFilesToUpload(filesToUpload.filter((_, i) => i !== index));
    };

    const uploadProjectDocuments = async (projectId) => {
        const uploadPromises = filesToUpload.map(async (file) => {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${projectId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                console.log(`Uploading file: ${file.name} as ${fileName}`);
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('project-docs')
                    .upload(fileName, file);

                if (uploadError) {
                    console.error(`Storage upload error for ${file.name}:`, uploadError);
                    throw uploadError;
                }

                const { data: urlData } = supabase.storage
                    .from('project-docs')
                    .getPublicUrl(fileName);

                console.log(`File uploaded. Public URL: ${urlData?.publicUrl}`);

                const { error: dbError } = await supabase.from('project_documents').insert({
                    project_id: projectId,
                    title: file.name,
                    file_url: urlData.publicUrl,
                    doc_type: 'requirements',
                    created_by: userId,
                    content: 'Uploaded via Project Wizard'
                });

                if (dbError) {
                    console.error(`DB Insert error for ${file.name}:`, dbError);
                    throw dbError;
                }

                return true;
            } catch (err) {
                console.error(`Failed to process file ${file.name}:`, err);
                throw err; // Propagate to Promise.all
            }
        });

        await Promise.all(uploadPromises);
    };

    const updateEmployeeDetail = (userId, key, value) => {
        setEmployeeDetails(prev => ({
            ...prev,
            [userId]: { ...prev[userId], [key]: value }
        }));
    };

    // Helper to calculate next available role number
    const getNextRoleNumber = (roleBase) => {
        const assigned = Object.values(employeeDetails)
            .map(d => d.functionalRole)
            .filter(r => r && r.startsWith(roleBase));

        let nextNum = 1;
        while (assigned.includes(`${roleBase} ${nextNum}`)) {
            nextNum++;
        }
        return nextNum;
    };

    const handleRoleSelect = (userId, baseRole) => {
        const currentRole = employeeDetails[userId]?.functionalRole || '';
        if (currentRole.startsWith(baseRole)) return;

        // Find next number for this role type across ALL employees
        const allOtherRoles = Object.keys(employeeDetails)
            .filter(id => id !== userId)
            .map(id => employeeDetails[id].functionalRole)
            .filter(r => r && r.startsWith(baseRole));

        let nextNum = 1;
        while (allOtherRoles.includes(`${baseRole} ${nextNum}`)) {
            nextNum++;
        }

        updateEmployeeDetail(userId, 'functionalRole', `${baseRole} ${nextNum}`);
    };

    const handleFinalize = async () => {
        setSaving(true);
        try {
            // 1. Create Project
            const { data: pData, error: pError } = await supabase
                .from('projects')
                .insert({
                    name: projectData.name,
                    description: projectData.description || '',
                    status: 'active',
                    org_id: orgId
                })
                .select();

            if (pError || !pData || pData.length === 0) {
                console.error('Project creation failed:', pError, pData);
                throw new Error(`Project creation failed: ${pError?.message || 'No data returned'}`);
            }

            const project = pData[0];

            // 2. Add Members
            if (selectedEmployees.length > 0) {
                const memberInserts = selectedEmployees.map(id => {
                    const details = employeeDetails[id] || {};
                    // Determine role string for DB - using names that are most likely to pass constraints
                    let dbRole = 'employee';
                    const desig = (details.designation || '').toLowerCase();
                    if (desig.includes('team lead') || desig.includes('team_lead')) dbRole = 'team_lead';
                    else if (desig.includes('manager')) dbRole = 'manager';
                    else if (desig.includes('consultant')) dbRole = 'employee';

                    return {
                        project_id: project.id,
                        user_id: id,
                        role: dbRole
                    };
                });

                const { error: mError } = await supabase.from('project_members').insert(memberInserts);
                if (mError) {
                    console.error('Member insertion failed:', mError);
                    // Don't throw yet, try to proceed? No, better to fail and inform
                    throw new Error(`Member assignment failed: ${mError.message}`);
                }
            }

            // 3. Create Tasks with full lifecycle support
            const taskInserts = [];
            selectedEmployees.forEach(empId => {
                const userTasks = customTasks[empId];
                if (userTasks && userTasks.length > 0) {
                    userTasks.forEach(taskObj => {
                        // Support both legacy string format and new object format
                        const taskTitle = typeof taskObj === 'string' ? taskObj : taskObj.title;
                        const taskHours = typeof taskObj === 'object' ? (taskObj.hours || 8) : 8;
                        const taskPriority = typeof taskObj === 'object' ? (taskObj.priority || 'medium') : 'medium';
                        const taskDueDate = typeof taskObj === 'object' && taskObj.dueDate
                            ? taskObj.dueDate
                            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                        taskInserts.push({
                            project_id: project.id,
                            org_id: orgId,
                            title: taskTitle,
                            description: `Task for ${project.name}`,
                            assigned_to: empId,
                            assigned_by: userId,
                            status: 'in_progress', // Default to in_progress so they show up actively
                            priority: taskPriority,
                            allocated_hours: parseFloat(taskHours) || 8,
                            start_date: new Date().toISOString(),
                            due_date: taskDueDate,
                            // Lifecycle fields for proper display in Tasks module
                            lifecycle_state: 'requirement_refiner', // Start at first phase
                            sub_state: 'in_progress',
                            phase_validations: {
                                active_phases: LIFECYCLE_PHASES.map(p => p.key)
                            }
                        });
                    });
                }
            });

            if (taskInserts.length > 0) {
                console.log('Inserting custom tasks with lifecycle:', taskInserts);
                const { error: tError } = await supabase.from('tasks').insert(taskInserts);
                if (tError) {
                    console.error('Task insertion failed:', tError);
                    addToast?.('Project created but tasks failed to save', 'warning');
                }
            }

            // 3. Upload Documents
            if (filesToUpload.length > 0) {
                console.log('Uploading documents...');
                try {
                    await uploadProjectDocuments(project.id);
                } catch (docError) {
                    console.error('Document upload failed but project was created:', docError);
                    addToast?.('Project created, but some documents failed to upload', 'warning');
                }
            }

            addToast?.('Project activated successfully!', 'success');
            localStorage.removeItem('talent_ops_project_wizard_state');

            // Delay slightly to ensure toast is seen and state is updated
            setTimeout(() => {
                onComplete?.();
                onClose();
            }, 500);

        } catch (error) {
            console.error('Finalization Error:', error);
            addToast?.(error.message || 'Failed to activate project', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const filteredEmployees = allEmployees.filter(e =>
        e.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(e.department)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(e.job_title)?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStepIcon = (step) => {
        switch (step) {
            case 1: return <Briefcase size={20} />;
            case 2: return <UserPlus size={20} />;
            case 3: return <ShieldCheck size={20} />;
            case 4: return <Zap size={20} />;
            case 5: return <FileText size={20} />;
            case 6: return <ListTodo size={20} />;
            case 7: return <CheckCircle size={20} />;
            default: return <Plus size={20} />;
        }
    };

    return (
        <div className="wizard-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px'
        }}>
            <div className="wizard-container" style={{
                backgroundColor: '#ffffff', width: '100%', maxWidth: '650px',
                maxHeight: '85vh', borderRadius: '24px', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                animation: 'wizardSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                border: '1px solid #e2e8f0'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 32px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                            {currentStep === 1 ? 'Create New Project' :
                                `Step ${currentStep}: ${currentStep === 2 ? 'Allocate Team' :
                                    currentStep === 3 ? 'Assign Positions' :
                                        currentStep === 4 ? 'Functional Roles' :
                                            currentStep === 5 ? 'Project Assets' :
                                                currentStep === 6 ? 'Project Tasks' : 'Review & Launch'}`}
                        </h2>
                    </div>
                    <button onClick={onClose} style={{
                        padding: '8px', borderRadius: '12px', color: '#94a3b8', transition: 'all 0.2s'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper Progress */}
                <div style={{ padding: '0 32px', marginTop: '16px' }}>
                    <div style={{ height: '4px', backgroundColor: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
                        {[1, 2, 3, 4, 5, 6, 7].map(s => (
                            <div key={s} style={{
                                flex: 1,
                                backgroundColor: currentStep >= s ? '#7c3aed' : 'transparent',
                                borderRight: '1px solid #fff',
                                transition: 'all 0.3s ease'
                            }} />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                    {currentStep === 1 && (
                        <div className="fadeIn">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div className="input-group">
                                    <label className="label-lite">Project Name</label>
                                    <input
                                        type="text" value={projectData.name}
                                        onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                                        placeholder="e.g. Website Redesign"
                                        className="wizard-input-lite"
                                    />
                                </div>



                                <div className="input-group">
                                    <label className="label-lite">Project Description (Optional)</label>
                                    <textarea
                                        value={projectData.description}
                                        onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                                        placeholder="Add context for your team..."
                                        className="wizard-input-lite" style={{ minHeight: '80px', resize: 'none' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="fadeIn" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', gap: '32px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                        <input
                                            type="text" placeholder="Search employees..."
                                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                            className="wizard-search-input"
                                        />
                                    </div>
                                    <div className="employee-list custom-scroll" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                        {loading ? <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={32} /></div> :
                                            filteredEmployees.map(emp => (
                                                <div
                                                    key={emp.id}
                                                    onClick={() => toggleEmployee(emp)}
                                                    className={`emp-card-lite ${selectedEmployees.map(String).includes(String(emp.id)) ? 'selected' : ''}`}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div className="avatar-xs">{emp.full_name?.charAt(0) || '?'}</div>
                                                        <div>
                                                            <div className="emp-name-lite">{emp.full_name || 'Unknown Employee'}</div>
                                                            <div className="emp-meta-lite">{emp.job_title || 'Expert'}</div>
                                                        </div>
                                                    </div>
                                                    {selectedEmployees.map(String).includes(String(emp.id)) ? <Check size={18} color="#7c3aed" /> : <Plus size={18} color="#cbd5e1" />}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                                <div className="allocation-sidebar-lite">
                                    <div className="sidebar-header-lite">
                                        <h4>Team <span className="count-badge">{selectedEmployees.length}</span></h4>
                                    </div>
                                    <div className="sidebar-list custom-scroll">
                                        {selectedEmployees.map(id => {
                                            const emp = employeeDetails[id];
                                            return (
                                                <div key={id} className="allocated-item-lite">
                                                    <span>{emp?.full_name || 'Unknown Employee'}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); toggleEmployee({ id }); }}><Trash2 size={14} /></button>
                                                </div>
                                            );
                                        })}
                                        {selectedEmployees.length === 0 && <div className="empty-state-lite">Staff not yet selected</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {selectedEmployees.map(id => {
                                const emp = employeeDetails[id];
                                return (
                                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700 }}>
                                                {emp?.full_name?.charAt(0) || '?'}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{emp?.full_name || 'Unknown'}</span>
                                        </div>
                                        <select
                                            value={emp?.designation || ''}
                                            onChange={(e) => updateEmployeeDetail(id, 'designation', e.target.value)}
                                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600 }}
                                        >
                                            <option value="">Choose Role...</option>
                                            <option value="Consultant / Employee">Consultant / Employee</option>
                                            <option value="Team Lead">Team Lead</option>
                                            <option value="Manager">Manager</option>
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {selectedEmployees.filter(id =>
                                employeeDetails[id].designation === 'Consultant / Employee' ||
                                employeeDetails[id].designation === 'Team Lead'
                            ).map(id => {
                                const emp = employeeDetails[id];
                                return (
                                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: '#fdf4ff', borderRadius: '16px', border: '1px solid #f5d0fe' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#d946ef', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700 }}>
                                                {emp?.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: 600, fontSize: '0.95rem', display: 'block' }}>{emp?.full_name || 'Unknown'}</span>
                                                <span style={{ fontSize: '0.7rem', color: '#a21caf', fontWeight: 700 }}>{emp.designation}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {/* Role Display */}
                                            {emp.functionalRole && (
                                                <span style={{
                                                    padding: '4px 10px', background: '#d946ef', color: 'white',
                                                    borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700
                                                }}>
                                                    {emp.functionalRole}
                                                </span>
                                            )}

                                            {/* Role Selector */}
                                            <select
                                                value=""
                                                onChange={(e) => handleRoleSelect(id, e.target.value)}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '8px', border: '1px solid #f0abfc',
                                                    background: '#fff', fontSize: '0.85rem', fontWeight: 600, outline: 'none',
                                                    width: '180px', cursor: 'pointer'
                                                }}
                                            >
                                                <option value="" disabled>Assign Role...</option>
                                                {functionalRoles.map(r => (
                                                    <option key={r.value} value={r.value}>{r.value}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div className="fadeIn" style={{ maxWidth: '850px', margin: '0 auto' }}>
                            <div className="doc-section">
                                {filesToUpload.length > 0 && (
                                    <div style={{ marginBottom: '32px' }}>
                                        <label className="label-lite" style={{ color: '#7c3aed', fontSize: '0.9rem' }}>Ready for Upload ({filesToUpload.length})</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                            {filesToUpload.map((file, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderRadius: '14px', border: '1.5px solid #ede9fe', boxShadow: '0 2px 4px rgba(124, 58, 237, 0.05)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <FileText size={20} color="#7c3aed" />
                                                        </div>
                                                        <div>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'block' }}>{file.name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{(file.size / 1024).toFixed(1)} KB</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                                        style={{ width: '32px', height: '32px', borderRadius: '8px', color: '#94a3b8', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                                        onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ borderTop: filesToUpload.length > 0 ? '1px solid #f1f5f9' : 'none', paddingTop: filesToUpload.length > 0 ? '32px' : '0' }}>
                                    <label className="label-lite" style={{ marginBottom: '16px', display: 'block' }}>Upload Project Assets</label>
                                    <div className="upload-box" onClick={() => fileInputRef.current?.click()}>
                                        <input
                                            type="file"
                                            multiple
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                        />
                                        <Upload size={32} />
                                        <h5>Drop Documents Here</h5>
                                        <p>Click or drag files to add them to your project</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 6 && (
                        <div className="fadeIn" style={{ maxWidth: '850px', margin: '0 auto' }}>
                            <div className="task-automation-view">
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '24px', fontWeight: 600 }}>
                                    Assign tasks with hours, priority and due dates. These will appear in the Tasks module.
                                </p>
                                {selectedEmployees.map(id => {
                                    const emp = employeeDetails[id];
                                    const tasks = customTasks[id] || [];
                                    const currentInput = taskInputs[id] || { title: '', hours: 8, priority: 'medium', dueDate: '' };

                                    return (
                                        <div key={id} style={{ padding: '24px', background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                                                <div className="m-avatar" style={{ width: '40px', height: '40px', borderRadius: '12px', fontSize: '1rem', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                    {emp.full_name?.charAt(0)}
                                                </div>
                                                <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>{emp.full_name}</strong>
                                            </div>

                                            {/* Task Input Form */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'flex-end' }}>
                                                <div style={{ flex: '2', minWidth: '180px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Task Name</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Enter task name..."
                                                        value={currentInput.title}
                                                        onChange={(e) => setTaskInputs({ ...taskInputs, [id]: { ...currentInput, title: e.target.value } })}
                                                        onKeyPress={(e) => e.key === 'Enter' && handleAddTask(id)}
                                                        className="wizard-input-lite"
                                                        style={{ padding: '10px 14px' }}
                                                    />
                                                </div>
                                                <div style={{ width: '80px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Hours</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        placeholder="8"
                                                        value={currentInput.hours}
                                                        onChange={(e) => setTaskInputs({ ...taskInputs, [id]: { ...currentInput, hours: e.target.value } })}
                                                        className="wizard-input-lite"
                                                        style={{ padding: '10px 14px' }}
                                                    />
                                                </div>
                                                <div style={{ width: '110px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Priority</label>
                                                    <select
                                                        value={currentInput.priority}
                                                        onChange={(e) => setTaskInputs({ ...taskInputs, [id]: { ...currentInput, priority: e.target.value } })}
                                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#fff', cursor: 'pointer' }}
                                                    >
                                                        <option value="high">High</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="low">Low</option>
                                                    </select>
                                                </div>
                                                <div style={{ width: '140px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>Due Date</label>
                                                    <input
                                                        type="date"
                                                        value={currentInput.dueDate}
                                                        onChange={(e) => setTaskInputs({ ...taskInputs, [id]: { ...currentInput, dueDate: e.target.value } })}
                                                        className="wizard-input-lite"
                                                        style={{ padding: '10px 14px' }}
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleAddTask(id)}
                                                    style={{ padding: '10px 24px', borderRadius: '12px', background: '#7c3aed', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', height: '44px' }}
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>

                                            {/* Tasks Table */}
                                            {tasks.length > 0 ? (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
                                                        <thead>
                                                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Task</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '100px' }}>Lifecycle</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '80px' }}>Due</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '60px' }}>Hrs</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '90px' }}>Priority</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '60px' }}>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {tasks.map((t, i) => {
                                                                const taskTitle = typeof t === 'string' ? t : t.title;
                                                                const taskHours = typeof t === 'object' ? t.hours : 8;
                                                                const taskPriority = typeof t === 'object' ? t.priority : 'medium';
                                                                const taskDueDate = typeof t === 'object' ? t.dueDate : '';

                                                                const priorityColors = {
                                                                    high: { bg: '#fee2e2', text: '#991b1b' },
                                                                    medium: { bg: '#fef3c7', text: '#92400e' },
                                                                    low: { bg: '#dbeafe', text: '#1e40af' }
                                                                };
                                                                const pStyle = priorityColors[taskPriority] || priorityColors.medium;

                                                                return (
                                                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{taskTitle}</td>
                                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                            {/* Lifecycle indicators - R, A, D, etc */}
                                                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                                                {LIFECYCLE_PHASES.map((phase, idx) => (
                                                                                    <div key={phase.key} style={{
                                                                                        width: '22px', height: '22px', borderRadius: '6px',
                                                                                        backgroundColor: idx === 0 ? '#22c55e' : '#e2e8f0',
                                                                                        color: idx === 0 ? '#fff' : '#94a3b8',
                                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                        fontSize: '0.65rem', fontWeight: 700
                                                                                    }}>
                                                                                        {phase.short}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                                                                            {taskDueDate ? new Date(taskDueDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                                                                            {taskHours}h
                                                                        </td>
                                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                            <span style={{
                                                                                padding: '4px 10px', borderRadius: '4px',
                                                                                backgroundColor: pStyle.bg, color: pStyle.text,
                                                                                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase'
                                                                            }}>
                                                                                {taskPriority}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                            <button
                                                                                onClick={() => removeTask(id, i)}
                                                                                style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', borderRadius: '6px' }}
                                                                                onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                                                                onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', background: '#f8fafc', borderRadius: '12px' }}>
                                                    No tasks added yet. Add tasks above to assign to this employee.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {currentStep === 7 && (
                        <div className="fadeIn" style={{ maxWidth: '900px', margin: '0 auto' }}>
                            <div className="summary-card">
                                <div className="summary-header">
                                    <div className="success-icon"><Zap size={40} /></div>
                                    <h2>Review & Launch</h2>
                                    <p>Everything looks perfect. Project summary below:</p>
                                </div>
                                <div className="summary-stats">
                                    <div className="stat">
                                        <label>Project Name</label>
                                        <span>{projectData.name}</span>
                                    </div>
                                    <div className="stat">
                                        <label>Personnel</label>
                                        <div style={{ marginTop: '8px' }}>
                                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#7c3aed' }}>{selectedEmployees.length} Members Allocated</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                                {selectedEmployees.map(id => (
                                                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                                                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                                                            {employeeDetails[id]?.full_name?.charAt(0)}
                                                        </div>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>{employeeDetails[id]?.full_name}</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto', fontWeight: 600 }}>{employeeDetails[id]?.designation}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="stat">
                                        <label>Files</label>
                                        <div style={{ marginTop: '8px' }}>
                                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#7c3aed' }}>{filesToUpload.length} Assets</span>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                                                {filesToUpload.map((file, idx) => (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                                                        <FileText size={14} color="#94a3b8" />
                                                        <span style={{ fontWeight: 600 }}>{file.name}</span>
                                                    </div>
                                                ))}
                                                {filesToUpload.length === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No manual uploads</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="stat">
                                        <label>Status</label>
                                        <span className="live-status" style={{ fontSize: '1.1rem', marginTop: '8px', display: 'block' }}>Ready to Activate</span>
                                    </div>
                                </div>

                                {/* Tasks Summary Table */}
                                {(() => {
                                    // Collect all tasks from all employees
                                    const allTasks = [];
                                    selectedEmployees.forEach(empId => {
                                        const empName = employeeDetails[empId]?.full_name || 'Unknown';
                                        const empTasks = customTasks[empId] || [];
                                        empTasks.forEach(t => {
                                            allTasks.push({
                                                employeeName: empName,
                                                empInitial: empName.charAt(0),
                                                title: typeof t === 'string' ? t : t.title,
                                                hours: typeof t === 'object' ? t.hours : 8,
                                                priority: typeof t === 'object' ? t.priority : 'medium',
                                                dueDate: typeof t === 'object' ? t.dueDate : ''
                                            });
                                        });
                                    });

                                    if (allTasks.length === 0) return null;

                                    const priorityColors = {
                                        high: { bg: '#fee2e2', text: '#991b1b' },
                                        medium: { bg: '#fef3c7', text: '#92400e' },
                                        low: { bg: '#dbeafe', text: '#1e40af' }
                                    };

                                    return (
                                        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                                                Tasks Preview ({allTasks.length} tasks)
                                            </label>
                                            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Employee</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Task</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '100px' }}>Lifecycle</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '80px' }}>Due</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '60px' }}>Hrs</th>
                                                                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', width: '90px' }}>Priority</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {allTasks.map((task, idx) => {
                                                                const pStyle = priorityColors[task.priority] || priorityColors.medium;
                                                                return (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                        <td style={{ padding: '12px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                                                    {task.empInitial}
                                                                                </div>
                                                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{task.employeeName}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '12px', fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{task.title}</td>
                                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                                                                                {LIFECYCLE_PHASES.map((phase, phaseIdx) => (
                                                                                    <div key={phase.key} style={{
                                                                                        width: '18px', height: '18px', borderRadius: '4px',
                                                                                        backgroundColor: phaseIdx === 0 ? '#22c55e' : '#e2e8f0',
                                                                                        color: phaseIdx === 0 ? '#fff' : '#94a3b8',
                                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                        fontSize: '0.55rem', fontWeight: 700
                                                                                    }}>
                                                                                        {phase.short}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                                                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : '-'}
                                                                        </td>
                                                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                                                            {task.hours}h
                                                                        </td>
                                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                            <span style={{
                                                                                padding: '3px 8px', borderRadius: '4px',
                                                                                backgroundColor: pStyle.bg, color: pStyle.text,
                                                                                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase'
                                                                            }}>
                                                                                {task.priority}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="summary-footer">
                                    <ShieldCheck size={20} />
                                    <p>Project is ready for activation. All assignments and documents have been verified.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px 32px', borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px',
                    background: '#fff'
                }}>
                    {currentStep > 1 && (
                        <button onClick={handleBack} className="btn-lite-secondary">
                            Back
                        </button>
                    )}
                    <button onClick={onClose} className="btn-lite-ghost">Cancel</button>
                    {currentStep < totalSteps ? (
                        <button onClick={handleNext} className="btn-lite-primary">
                            Continue
                        </button>
                    ) : (
                        <button
                            onClick={handleFinalize} disabled={saving}
                            className="btn-lite-launch"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Create Project'}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes wizardSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .fadeIn { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .label-lite { display: block; font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 8px; }
        .wizard-input-lite { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 0.95rem; outline: none; transition: all 0.2s; background: #fff; }
        .wizard-input-lite:focus { border-color: #7c3aed; box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1); }

        .wizard-search-input { width: 100%; padding: 12px 16px 12px 44px; border-radius: 12px; border: 1.5px solid #e2e8f0; font-size: 0.9rem; outline: none; transition: all 0.2s; background: #f8fafc; }
        .wizard-search-input:focus { border-color: #7c3aed; background: #fff; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.05); }

        .type-pill { padding: 12px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #fff; color: #64748b; font-weight: 700; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; }
        .type-pill.active { background: #f5f3ff; border-color: #7c3aed; color: #7c3aed; }

        .emp-card-lite { padding: 12px; border-radius: 14px; background: #fff; border: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s; margin-bottom: 4px; }
        .emp-card-lite:hover { background: #f8fafc; border-color: #f1f5f9; }
        .emp-card-lite.selected { background: #f5f3ff; border-color: #ddd6fe; }
        .avatar-xs { width: 36px; height: 36px; border-radius: 10px; background: #ede9fe; color: #7c3aed; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; }
        .emp-name-lite { font-weight: 700; font-size: 0.95rem; color: #1e293b; }
        .emp-meta-lite { font-size: 0.75rem; color: #64748b; }

        .allocation-sidebar-lite { width: 240px; background: #f8fafc; border-radius: 20px; border: 1px solid #e2e8f0; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .sidebar-header-lite h4 { font-weight: 800; font-size: 0.9rem; color: #1e293b; display: flex; align-items: center; gap: 8px; }
        .count-badge { background: #7c3aed; color: #fff; padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; }
        .allocated-item-lite { padding: 10px 14px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .allocated-item-lite span { font-weight: 700; font-size: 0.85rem; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
        .allocated-item-lite button { color: #cbd5e1; transition: color 0.2s; padding: 4px; }
        .allocated-item-lite button:hover { color: #ef4444; background: #fef2f2; border-radius: 6px; }

        .btn-lite-primary { padding: 12px 32px; border-radius: 12px; background: #7c3aed; color: #fff; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2); }
        .btn-lite-primary:hover { background: #6d28d9; transform: translateY(-1px); }
        .btn-lite-launch { padding: 12px 32px; border-radius: 12px; background: #7c3aed; color: #fff; font-weight: 800; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2); }
        .btn-lite-launch:hover { background: #6d28d9; transform: scale(1.02); }
        .btn-lite-secondary { padding: 12px 24px; border-radius: 12px; background: #ffffff; color: #475569; font-weight: 700; border: 1.5px solid #e2e8f0; cursor: pointer; transition: all 0.2s; }
        .btn-lite-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
        .btn-lite-ghost { padding: 12px 24px; border-radius: 12px; background: #f8fafc; color: #64748b; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; }
        .btn-lite-ghost:hover { background: #f1f5f9; color: #1e293b; }
        
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        
        .empty-state-lite { font-size: 0.8rem; color: #94a3b8; text-align: center; padding: 40px 0; font-style: 'italic'; }

        .summary-card { padding: 40px; background: #fff; borderRadius: 32px; text-align: center; }
        .success-icon { width: 80px; height: 80px; borderRadius: 24px; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #fff; display: flex; alignItems: center; justifyContent: center; margin: 0 auto 24px auto; box-shadow: 0 20px 40px rgba(124, 58, 237, 0.2); }
        .summary-header h2 { fontWeight: 900; fontSize: 1.8rem; color: #0f172a; letterSpacing: -0.02em; }
        .summary-header p { color: #64748b; marginTop: 4px; }
        .summary-stats { display: grid; gridTemplateColumns: 1fr 1fr; gap: 24px; margin: 40px 0; text-align: left; }
        .stat { padding: 20px; background: #f8fafc; borderRadius: 20px; border: 1px solid #f1f5f9; }
        .stat label { display: block; fontSize: 0.75rem; fontWeight: 800; color: #94a3b8; textTransform: uppercase; letterSpacing: 0.1em; marginBottom: 6px; }
        .stat span { fontWeight: 800; fontSize: 1rem; color: #1e293b; }
        .live-status { color: #10b981 !important; }
        .summary-footer { display: flex; gap: 12px; align-items: center; padding: 20px; background: #f0fdf4; borderRadius: 16px; border: 1px solid #dcfce7; text-align: left; }
        .summary-footer p { fontSize: 0.85rem; color: #166534; fontWeight: 600; line-height: 1.5; }

        .suggestion-banner { padding: 20px; borderRadius: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #dcfce7; display: flex; gap: 16px; align-items: center; margin-bottom: 24px; }
        .banner-icon { width: 44px; height: 44px; borderRadius: 12px; background: #fff; color: #10b981; display: flex; alignItems: center; justifyContent: center; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.1); }
        .banner-text h4 { fontWeight: 800; color: #065f46; margin: 0; font-size: 1rem; }
        .banner-text p { fontSize: 0.8rem; color: #065f46; margin: 2px 0 0 0; opacity: 0.8; }

        .doc-item { padding: 16px 20px; borderRadius: 16px; border: 1.5px solid #e2e8f0; background: #fff; display: flex; alignItems: center; gap: 14px; transition: all 0.2s; cursor: default; }
        .doc-item:hover { border-color: #7c3aed; background: #fdfaff; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(124, 58, 237, 0.05); }
        .doc-icon { width: 40px; height: 40px; borderRadius: 10px; background: #f8fafc; color: #7c3aed; display: flex; alignItems: center; justifyContent: center; flex-shrink: 0; }
        .doc-label { flex: 1; }
        .doc-label h6 { fontWeight: 700; fontSize: 0.9rem; color: #1e293b; margin: 0; }
        .doc-label span { fontSize: 0.75rem; color: #64748b; display: block; margin-top: 2px; }

        .upload-box { margin-top: 32px; padding: 48px; borderRadius: 24px; border: 2px dashed #cbd5e1; background: #f8fafc; textAlign: center; color: #64748b; cursor: pointer; transition: all 0.2s; }
        .upload-box:hover { border-color: #7c3aed; background: #f5f3ff; color: #7c3aed; }
        .upload-box h5 { fontWeight: 800; marginTop: 16px; margin-bottom: 4px; color: #1e293b; }
        .upload-box p { font-size: 0.85rem; }
      `}</style>
        </div>
    );
};

export default ProjectWizard;
