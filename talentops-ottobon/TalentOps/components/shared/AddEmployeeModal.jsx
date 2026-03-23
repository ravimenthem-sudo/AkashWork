import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export const AddEmployeeModal = ({ isOpen, onClose, onSuccess, orgId }) => {
    console.log('🔵 AddEmployeeModal rendered, isOpen:', isOpen);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]); // Array of project IDs
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'employee',
        job_title: '',
        employment_type: 'full_time',
        department_id: '',
        monthly_leave_quota: 3,
        basic_salary: '',
        hra: '',
        allowances: '',
        professional_tax: '',
        joinDate: new Date().toISOString().split('T')[0],
    });
    const [projectRole, setProjectRole] = useState('employee');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchProjects();
            fetchDepartments();
        }
    }, [isOpen, orgId]);

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

    const fetchProjects = async () => {
        console.log('Fetching projects...');
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('You must be logged in to add employees');
            }

            // Call the Supabase Edge Function to add employee
            console.log('Sending data to Edge Function:', {
                full_name: formData.full_name,
                email: formData.email,
                role: formData.role,
                project_id: selectedProjects[0] || null,
                monthly_leave_quota: formData.monthly_leave_quota,
            });

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-employee`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        full_name: formData.full_name,
                        email: formData.email,
                        password: formData.password,
                        role: formData.role,
                        monthly_leave_quota: formData.monthly_leave_quota,
                        basic_salary: parseFloat(formData.basic_salary),
                        hra: parseFloat(formData.hra),
                        allowances: parseFloat(formData.allowances) || 0,
                        professional_tax: parseFloat(formData.professional_tax) || 0,
                        join_date: formData.joinDate,
                        employment_type: formData.employment_type,
                        org_id: orgId
                    }),
                }
            );

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            console.log('Edge Function response:', result);

            if (!response.ok) {
                console.error('Edge Function error:', result);
                throw new Error(result.error || result.message || `Server error: ${response.status}`);
            }

            // If a project was selected, add the user to project_members
            if (response.ok) {
                console.log('Adding user to project_members...');

                // Get the user_id - either from the response or by querying
                let userId = result.user_id;

                if (!userId) {
                    // Query for the newly created user by email
                    // IMPORTANT: Don't filter by org_id here as the Edge Function might not have set it yet
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', formData.email)
                        .single();

                    if (profileError) {
                        console.error('Error fetching user profile:', profileError);
                    } else {
                        userId = profileData?.id;
                    }
                }

                if (userId) {
                    // Update profile with department, job_title and join date
                    if (formData.department_id || formData.joinDate || formData.job_title || selectedProjects.length > 0) {
                        const updateData = {};
                        if (formData.department_id) updateData.department = formData.department_id;
                        if (selectedProjects.length > 0) updateData.team_id = selectedProjects[0];
                        if (formData.joinDate) updateData.join_date = formData.joinDate;
                        if (formData.job_title) updateData.job_title = formData.job_title;
                        if (formData.employment_type) updateData.employment_type = formData.employment_type;
                        if (formData.monthly_leave_quota) updateData.total_leaves_balance = formData.monthly_leave_quota;
                        updateData.org_id = orgId; // Explicitly ensure org_id is set

                        console.log('Updating profile for user:', userId, 'with data:', updateData);
                        const { data: updateResult, error: updateError } = await supabase
                            .from('profiles')
                            .update(updateData)
                            .eq('id', userId)
                            .select();

                        if (updateError) {
                            console.error('FAILED to update profile:', updateError);
                            setError(`Failed to update profile details: ${updateError.message}`);
                        } else {
                            console.log('Profile updated successfully:', updateResult);
                        }

                        // Also ensure employee_finance has the org_id
                        console.log('Ensuring employee_finance has org_id for user:', userId);
                        const { error: financeError } = await supabase
                            .from('employee_finance')
                            .update({ org_id: orgId })
                            .eq('employee_id', userId);

                        if (financeError) {
                            console.error('Failed to update employee_finance org_id:', financeError);
                        } else {
                            console.log('employee_finance org_id updated successfully');
                        }
                    }

                    // Add to all selected projects
                    const projectAssignments = selectedProjects.map(projectId => ({
                        project_id: projectId,
                        user_id: userId,
                        role: projectRole,
                        org_id: orgId
                    }));

                    const { error: projectMemberError } = await supabase
                        .from('project_members')
                        .insert(projectAssignments);

                    if (projectMemberError) {
                        console.error('Error adding to project_members:', projectMemberError);
                        // Don't throw, just log - user was created successfully
                    } else {
                        console.log('Successfully added to project_members');
                    }

                } else {
                    console.error('Could not determine user_id for project mapping');
                }
            }

            // Reset form
            setFormData({
                full_name: '',
                email: '',
                password: '',
                role: 'employee',
                job_title: '',
                employment_type: 'full_time',
                department_id: '',
                monthly_leave_quota: 3,
                basic_salary: '',
                hra: '',
                allowances: '',
                professional_tax: '',
                joinDate: new Date().toISOString().split('T')[0],
            });
            setSelectedProjects([]);

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || 'An error occurred while adding the employee');
            console.error('Error adding employee:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

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
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Add New Employee</h2>
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
                                Email *
                            </label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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

                        {/* Password */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Password *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        paddingRight: '40px', // Space for the eye icon
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        backgroundColor: 'var(--background)',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Minimum 6 characters
                            </p>
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

                        {/* Role and Project - Side by Side */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                            {/* Role (moved here for better layout) */}
                            {/* This is handled above, so we'll add Project here */}
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

                        {/* Department */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>Department *</label>
                            <select
                                required
                                value={formData.department_id}
                                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-primary)', outline: 'none' }}
                            >
                                <option value="">Select Department</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.department_name}
                                    </option>
                                ))}
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
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                Join Date *
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.joinDate}
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

                        {/* Compensation Details Section */}
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
                                    required
                                    min={0}
                                    value={formData.basic_salary}
                                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                                    placeholder="Enter basic salary"
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

                            {/* HRA */}
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
                                    HRA (House Rent Allowance) *
                                </label>
                                <input
                                    type="number"
                                    required
                                    min={0}
                                    value={formData.hra}
                                    onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                                    placeholder="Enter HRA amount"
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
                                    placeholder="Enter other allowances (optional)"
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
                                    placeholder="Enter professional tax (optional)"
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
                        </div>

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
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                backgroundColor: loading ? 'var(--border)' : 'var(--primary)',
                                color: 'white',
                                padding: '12px',
                                borderRadius: '8px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                marginTop: '8px',
                            }}
                        >
                            {loading ? 'Adding Employee...' : 'Add Employee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
