import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface EditEmployeeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employee: any;
    orgId: string;
}

interface Team {
    id: string;
    team_name: string;
}

interface Project {
    id: string;
    name: string;
}

interface Department {
    id: string;
    department_name: string;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ isOpen, onClose, onSuccess, employee, orgId }) => {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string>('');
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]); // Array of project IDs
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        role: 'employee',
        job_title: '',
        employment_type: 'Full-Time', // Added employment_type
        department_id: '', // Added department_id
        monthly_leave_quota: 3,
        basic_salary: '',
        hra: '',
        allowances: '',
        professional_tax: '',
        change_reason: 'Annual Increment',
        custom_change_reason: '',
        effective_from: new Date().toISOString().split('T')[0],
        joinDate: '',
        total_leaves_balance: 0,
    });
    const [projectRole, setProjectRole] = useState('employee');
    const [originalSalary, setOriginalSalary] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && employee) {
            fetchProjects();
            fetchDepartments();
            fetchCurrentUserRole();
            fetchEmployeeSalary();
            fetchEmployeeProjects(); // Fetch ALL projects
            fetchEmployeeDepartment(); // Fetch current department
            // Populate form with employee data
            setFormData({
                full_name: employee.name || '',
                email: employee.email || '',
                role: employee.role || 'employee',
                job_title: '', // Will be updated by fetchEmployeeDepartment
                employment_type: 'full_time', // Will be updated
                department_id: '', // Will be updated by fetchEmployeeDepartment
                monthly_leave_quota: employee.monthly_leave_quota || 3,
                basic_salary: '',
                hra: '',
                allowances: '',
                professional_tax: '',
                change_reason: 'Annual Increment',
                custom_change_reason: '',
                effective_from: new Date().toISOString().split('T')[0],
                joinDate: '',
                total_leaves_balance: employee.total_leaves_balance || 0,
            });
        }
    }, [isOpen, employee, orgId]);

    const fetchDepartments = async () => {
        console.log('Fetching departments...');
        const { data, error } = await supabase
            .from('departments')
            .select('id, department_name')
            .eq('org_id', orgId)
            .order('department_name');

        if (error) {
            console.error('Error fetching departments:', error);
        } else {
            console.log('Departments fetched:', data);
            setDepartments(data || []);
        }
    };

    const fetchEmployeeDepartment = async () => {
        if (!employee?.id) return;
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('department, team_id, join_date, job_title, employment_type, monthly_leave_quota, total_leaves_balance')
                .eq('id', employee.id)
                .eq('org_id', orgId)
                .single();

            if (profile) {
                setFormData(prev => ({
                    ...prev,
                    department_id: profile.department || '',
                    job_title: profile.job_title || '',
                    employment_type: profile.employment_type || 'full_time',
                    joinDate: profile.join_date || '',
                    monthly_leave_quota: profile.monthly_leave_quota || 3,
                    total_leaves_balance: profile.total_leaves_balance || 0,
                }));
            }
        } catch (err) {
            console.error('Error fetching employee details:', err);
        }
    };

    const fetchProjects = async () => {
        console.log('Fetching projects for edit modal...');
        const { data, error } = await supabase
            .from('projects')
            .select('id, name')
            .eq('org_id', orgId)
            .order('name');

        if (error) {
            console.error('Error fetching projects:', error);
        } else {
            console.log('Projects fetched:', data);
            setProjects(data || []);
        }
    };

    const fetchEmployeeProjects = async () => {
        if (!employee?.id) return;
        try {
            const { data, error } = await supabase
                .from('project_members')
                .select('project_id')
                .eq('user_id', employee.id)
                .eq('org_id', orgId);

            if (data && data.length > 0) {
                const projectIds = data.map(p => p.project_id);
                setSelectedProjects(projectIds);
                console.log('Employee assigned to projects:', projectIds);
            } else {
                setSelectedProjects([]);
            }
        } catch (error) {
            console.error('Error fetching employee projects:', error);
        }
    };

    // New useEffect to match department ID once departments are loaded
    useEffect(() => {
        if (departments.length > 0 && employee?.id) {
            const matchDept = async () => {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('department')
                    .eq('id', employee.id)
                    .eq('org_id', orgId)
                    .single();

                if (profile?.department) {
                    // Try to match by ID first (new behavior)
                    const matchedById = departments.find(d => d.id === profile.department);
                    if (matchedById) {
                        setFormData(prev => ({ ...prev, department_id: matchedById.id }));
                    } else {
                        // Fallback: Try to match by name (old behavior)
                        const matchedByName = departments.find(d => d.department_name === profile.department);
                        if (matchedByName) {
                            setFormData(prev => ({ ...prev, department_id: matchedByName.id }));
                        }
                    }
                }
            };
            matchDept();
        }
    }, [departments, employee?.id]);

    const fetchCurrentUserRole = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .eq('org_id', orgId)
                    .single();
                if (profile) {
                    setCurrentUserRole(profile.role);
                }
            }
        } catch (error) {
            console.error('Error fetching current user role:', error);
        }
    };

    const fetchEmployeeSalary = async () => {
        try {
            const { data, error } = await supabase
                .from('employee_finance')
                .select('*')
                .eq('employee_id', employee.id)
                .eq('is_active', true)
                .eq('org_id', orgId)
                .single();

            if (error) {
                console.log('No active salary record found:', error);
                return;
            }

            if (data) {
                setOriginalSalary(data);
                setFormData(prev => ({
                    ...prev,
                    basic_salary: data.basic_salary?.toString() || '',
                    hra: data.hra?.toString() || '',
                    allowances: data.allowances?.toString() || '',
                    professional_tax: data.professional_tax?.toString() || '',
                }));
            }
        } catch (error) {
            console.error('Error fetching employee salary:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Update employee profile
            console.log('Updating employee with data:', {
                full_name: formData.full_name,
                role: formData.role,
                job_title: formData.job_title,
                employment_type: formData.employment_type,
                department: formData.department_id || null,
                monthly_leave_quota: formData.monthly_leave_quota,
                join_date: formData.joinDate,
            });

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    role: formData.role,
                    job_title: formData.job_title,
                    employment_type: formData.employment_type,
                    department: formData.department_id || null,
                    monthly_leave_quota: formData.monthly_leave_quota,
                    join_date: formData.joinDate,
                    total_leaves_balance: formData.total_leaves_balance,
                    org_id: orgId,
                    team_id: selectedProjects[0] || null,
                })
                .eq('id', employee.id);

            if (updateError) {
                console.error('Update error details:', updateError);
                throw new Error(updateError.message || 'Failed to update employee');
            }

            // Update project assignments - handle multiple projects
            const { data: currentAssignments } = await supabase
                .from('project_members')
                .select('project_id')
                .eq('user_id', employee.id)
                .eq('org_id', orgId);

            const currentProjectIds = currentAssignments?.map(a => a.project_id) || [];

            // Find projects to add and remove
            const projectsToAdd = selectedProjects.filter(id => !currentProjectIds.includes(id));
            const projectsToRemove = currentProjectIds.filter(id => !selectedProjects.includes(id));

            console.log('Projects to add:', projectsToAdd);
            console.log('Projects to remove:', projectsToRemove);

            // Remove from projects
            if (projectsToRemove.length > 0) {
                await supabase
                    .from('project_members')
                    .delete()
                    .eq('user_id', employee.id)
                    .in('project_id', projectsToRemove)
                    .eq('org_id', orgId);
            }

            // Add to new projects
            if (projectsToAdd.length > 0) {
                const newAssignments = projectsToAdd.map(projectId => ({
                    project_id: projectId,
                    user_id: employee.id,
                    role: projectRole,
                    org_id: orgId
                }));
                await supabase
                    .from('project_members')
                    .insert(newAssignments);
            }

            // Update role in all remaining projects
            if (selectedProjects.length > 0) {
                await supabase
                    .from('project_members')
                    .update({ role: projectRole })
                    .eq('user_id', employee.id)
                    .in('project_id', selectedProjects)
                    .eq('org_id', orgId);
            }

            console.log('Employee updated successfully');

            // Handle salary updates (executives only)
            if (currentUserRole === 'executive' && formData.basic_salary && formData.hra) {
                const newBasicSalary = parseFloat(formData.basic_salary);
                const newHra = parseFloat(formData.hra);
                const newAllowances = parseFloat(formData.allowances || '0');
                const newProfessionalTax = parseFloat(formData.professional_tax || '0');

                // Check if salary has changed (or if there's no existing salary)
                const salaryChanged = !originalSalary ||
                    newBasicSalary !== originalSalary.basic_salary ||
                    newHra !== originalSalary.hra ||
                    newAllowances !== (originalSalary.allowances || 0) ||
                    newProfessionalTax !== (originalSalary.professional_tax || 0);

                if (salaryChanged) {
                    console.log('Salary changed or no existing salary, updating employee_finance...');

                    const today = new Date().toISOString().split('T')[0];

                    if (originalSalary) {
                        // Existing salary record - deactivate ALL active records for this employee
                        const effectiveFromDate = new Date(formData.effective_from);
                        const effectiveTo = new Date(effectiveFromDate);
                        effectiveTo.setDate(effectiveTo.getDate() - 1);
                        const effectiveToStr = effectiveTo.toISOString().split('T')[0];

                        // First, get all active record IDs
                        const { data: activeRecords, error: fetchError } = await supabase
                            .from('employee_finance')
                            .select('id')
                            .eq('employee_id', employee.id)
                            .eq('is_active', true)
                            .eq('org_id', orgId);

                        if (fetchError) {
                            console.error('Error fetching active records:', fetchError);
                            throw new Error(`Failed to fetch active records: ${fetchError.message}`);
                        }

                        if (activeRecords && activeRecords.length > 0) {
                            console.log(`Found ${activeRecords.length} active record(s) to deactivate`);

                            // Deactivate each record individually
                            for (const record of activeRecords) {
                                const { error: deactivateError } = await supabase
                                    .from('employee_finance')
                                    .update({
                                        is_active: false,
                                        effective_to: effectiveToStr,
                                    })
                                    .eq('id', record.id)
                                    .eq('org_id', orgId);

                                if (deactivateError) {
                                    console.error(`Error deactivating record ${record.id}:`, deactivateError);
                                    throw new Error(`Failed to deactivate record: ${deactivateError.message}`);
                                }
                            }

                            console.log('All active records deactivated successfully');

                            // Wait for database to commit
                            await new Promise(resolve => setTimeout(resolve, 500));

                            // Verify deactivation worked - check if any active records still exist
                            const { data: stillActive, error: checkError } = await supabase
                                .from('employee_finance')
                                .select('id')
                                .eq('employee_id', employee.id)
                                .eq('is_active', true)
                                .eq('org_id', orgId);

                            if (checkError) {
                                console.error('Error checking active records:', checkError);
                            } else if (stillActive && stillActive.length > 0) {
                                console.error('ERROR: Records still active after deactivation:', stillActive);
                                throw new Error(`Failed to deactivate ${stillActive.length} record(s). Please refresh and try again.`);
                            }
                        }
                    }

                    // Insert new salary record (works for both new and updated salaries)
                    const changeReason = formData.change_reason === 'Other'
                        ? formData.custom_change_reason || 'Salary Update'
                        : formData.change_reason;

                    const { error: insertError } = await supabase
                        .from('employee_finance')
                        .insert([{
                            employee_id: employee.id,
                            basic_salary: newBasicSalary,
                            hra: newHra,
                            allowances: newAllowances,
                            professional_tax: newProfessionalTax,
                            effective_from: formData.effective_from,
                            is_active: true,
                            change_reason: changeReason,
                            org_id: orgId
                        }]);

                    if (insertError) {
                        console.error('Error inserting new salary:', insertError);
                        throw new Error(`Failed to create salary record: ${insertError.message}`);
                    }

                    console.log('New salary record created successfully');
                }
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'An error occurred while updating the employee');
            console.error('Error updating employee:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !employee) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    backgroundColor: 'var(--surface)',
                    borderRadius: '16px',
                    width: '600px',
                    maxWidth: '90%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: 'var(--shadow-lg)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: 'var(--spacing-lg)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Edit Employee</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: 'var(--spacing-lg)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {/* Full Name */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Full Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Email (Read-only)
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                readOnly
                                disabled
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: '#f3f4f6',
                                    color: '#6b7280',
                                    cursor: 'not-allowed',
                                }}
                            />
                        </div>

                        {/* Role */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Role *
                            </label>
                            <select
                                required
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <option value="employee">Employee</option>
                                <option value="manager">Manager</option>
                                <option value="executive">Executive</option>
                            </select>
                        </div>

                        {/* Job Title */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Job Title
                            </label>
                            <input
                                type="text"
                                value={formData.job_title}
                                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                                placeholder="e.g. Senior Software Engineer"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* Department */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Department</label>
                            <select
                                value={formData.department_id}
                                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                            >
                                <option value="">Select Department</option>
                                <option value="">No Department</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Employment Type */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Employment Type
                            </label>
                            <select
                                value={formData.employment_type}
                                onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <option value="full_time">Full Time</option>
                                <option value="part_time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="intern">Intern</option>
                                <option value="trainee">Trainee</option>
                                <option value="freelance">Freelance</option>
                                <option value="probation">Probation</option>
                            </select>
                        </div>

                        {/* Project Role */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Project Role
                            </label>
                            <select
                                value={projectRole}
                                onChange={(e) => setProjectRole(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <option value="employee">Employee</option>
                                <option value="team_lead">Team Lead</option>
                                <option value="manager">Manager</option>
                            </select>
                        </div>

                        {/* Projects - Multi-select */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Projects (Select Multiple)
                            </label>

                            {/* Selected Projects Display */}
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                marginBottom: '12px',
                                minHeight: '40px',
                                padding: '8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--background)',
                            }}>
                                {selectedProjects.length === 0 ? (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        No projects selected
                                    </span>
                                ) : (
                                    selectedProjects.map(projectId => {
                                        const project = projects.find(p => p.id === projectId);
                                        return project ? (
                                            <div
                                                key={projectId}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    backgroundColor: 'var(--primary)',
                                                    color: 'white',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {project.name}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedProjects(selectedProjects.filter(id => id !== projectId))}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        padding: '0',
                                                        fontSize: '1.2rem',
                                                        lineHeight: '1',
                                                        marginLeft: '4px',
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : null;
                                    })
                                )}
                            </div>

                            {/* Available Projects Dropdown */}
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value && !selectedProjects.includes(e.target.value)) {
                                        setSelectedProjects([...selectedProjects, e.target.value]);
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <option value="">+ Add Project</option>
                                {projects
                                    .filter(project => !selectedProjects.includes(project.id))
                                    .map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Join Date */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Join Date
                            </label>
                            <input
                                type="date"
                                value={formData.joinDate || ''}
                                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* Monthly Leave Quota */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Monthly Leave Quota
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={formData.monthly_leave_quota}
                                onChange={(e) => setFormData({ ...formData, monthly_leave_quota: parseInt(e.target.value) })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* Total Leave Balance */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Total Leave Balance (Cumulative)
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={formData.total_leaves_balance}
                                onChange={(e) => setFormData({ ...formData, total_leaves_balance: parseInt(e.target.value) })}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                This is the employee's current accumulated leave balance.
                            </p>
                        </div>

                        {/* Compensation Details Section - Role-based visibility */}
                        {(currentUserRole === 'executive' || currentUserRole === 'manager') && (
                            <div style={{
                                marginTop: 'var(--spacing-lg)',
                                paddingTop: 'var(--spacing-lg)',
                                borderTop: '2px solid var(--border)',
                            }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                                    Compensation Details
                                </h3>

                                {/* Basic Salary */}
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                        Basic Salary *
                                    </label>
                                    <input
                                        type="number"
                                        required={currentUserRole === 'executive'}
                                        min={0}
                                        value={formData.basic_salary}
                                        onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                                        disabled={currentUserRole === 'manager'}
                                        placeholder="Enter basic salary"
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            backgroundColor: currentUserRole === 'manager' ? '#f3f4f6' : 'var(--background)',
                                            color: currentUserRole === 'manager' ? '#6b7280' : 'var(--text-primary)',
                                            cursor: currentUserRole === 'manager' ? 'not-allowed' : 'text',
                                        }}
                                    />
                                </div>

                                {/* HRA */}
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                        HRA (House Rent Allowance) *
                                    </label>
                                    <input
                                        type="number"
                                        required={currentUserRole === 'executive'}
                                        min={0}
                                        value={formData.hra}
                                        onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                                        disabled={currentUserRole === 'manager'}
                                        placeholder="Enter HRA amount"
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            backgroundColor: currentUserRole === 'manager' ? '#f3f4f6' : 'var(--background)',
                                            color: currentUserRole === 'manager' ? '#6b7280' : 'var(--text-primary)',
                                            cursor: currentUserRole === 'manager' ? 'not-allowed' : 'text',
                                        }}
                                    />
                                </div>

                                {/* Allowances */}
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                        Other Allowances
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formData.allowances}
                                        onChange={(e) => setFormData({ ...formData, allowances: e.target.value })}
                                        disabled={currentUserRole === 'manager'}
                                        placeholder="Enter other allowances (optional)"
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            backgroundColor: currentUserRole === 'manager' ? '#f3f4f6' : 'var(--background)',
                                            color: currentUserRole === 'manager' ? '#6b7280' : 'var(--text-primary)',
                                            cursor: currentUserRole === 'manager' ? 'not-allowed' : 'text',
                                        }}
                                    />
                                </div>

                                {/* Professional Tax */}
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                        Professional Tax
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formData.professional_tax}
                                        onChange={(e) => setFormData({ ...formData, professional_tax: e.target.value })}
                                        disabled={currentUserRole === 'manager'}
                                        placeholder="Enter professional tax (optional)"
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border)',
                                            backgroundColor: currentUserRole === 'manager' ? '#f3f4f6' : 'var(--background)',
                                            color: currentUserRole === 'manager' ? '#6b7280' : 'var(--text-primary)',
                                            cursor: currentUserRole === 'manager' ? 'not-allowed' : 'text',
                                        }}
                                    />
                                </div>

                                {/* Change Reason - Only for executives */}
                                {currentUserRole === 'executive' && (
                                    <>
                                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                                Reason for Change *
                                            </label>
                                            <select
                                                value={formData.change_reason}
                                                onChange={(e) => setFormData({ ...formData, change_reason: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border)',
                                                    backgroundColor: 'var(--background)',
                                                    color: 'var(--text-primary)',
                                                }}
                                            >
                                                <option value="Annual Increment">Annual Increment</option>
                                                <option value="Promotion">Promotion</option>
                                                <option value="Performance Bonus">Performance Bonus</option>
                                                <option value="Market Adjustment">Market Adjustment</option>
                                                <option value="Correction">Correction</option>
                                                <option value="Other">Other (Specify below)</option>
                                            </select>
                                        </div>

                                        {/* Custom Reason Input - Show only if "Other" is selected */}
                                        {formData.change_reason === 'Other' && (
                                            <div style={{ marginTop: 'var(--spacing-md)' }}>
                                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                                    Specify Reason *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.custom_change_reason}
                                                    onChange={(e) => setFormData({ ...formData, custom_change_reason: e.target.value })}
                                                    placeholder="Enter reason for salary change"
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--border)',
                                                        backgroundColor: 'var(--background)',
                                                        color: 'var(--text-primary)',
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Effective From Date - Only for executives */}
                                {currentUserRole === 'executive' && (
                                    <div style={{ marginTop: 'var(--spacing-md)' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                            Effective From Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.effective_from}
                                            onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border)',
                                                backgroundColor: 'var(--background)',
                                                color: 'var(--text-primary)',
                                            }}
                                        />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                            The date when this salary change becomes effective
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div style={{
                                padding: '12px',
                                borderRadius: '8px',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                fontSize: '0.875rem',
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    border: '1px solid var(--border)',
                                    backgroundColor: 'var(--background)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    backgroundColor: loading ? 'var(--border)' : 'var(--primary)',
                                    color: 'white',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    border: 'none',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {loading ? 'Updating...' : 'Update Employee'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
