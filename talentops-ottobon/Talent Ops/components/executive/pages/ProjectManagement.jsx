import React, { useState, useEffect } from 'react';
import { Plus, Users, FolderOpen, UserPlus, X, Trash2, Search, Building2, ChevronDown, Check, CheckCircle, XCircle, AlertTriangle, MoreVertical } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useUser } from '../context/UserContext';
import ProjectWizard from '../components/ProjectWizard';

const ProjectManagement = ({ addToast = () => { } }) => {
    const { orgId } = useUser();
    const [projects, setProjects] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectMembers, setProjectMembers] = useState([]);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [searchUser, setSearchUser] = useState('');
    const [selectedRole, setSelectedRole] = useState('consultant');
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [selectedMemberForHandover, setSelectedMemberForHandover] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    // Determine my role in the currently selected project (for permission check)
    // Note: 'projectMembers' contains EVERYONE. We need to find OURSELVES in it.
    const { userId } = useUser();
    const myProjectMemberRecord = projectMembers.find(m => m.user_id === userId);
    const projectRole = myProjectMemberRecord?.role;

    const initiatHandover = (member) => {
        setSelectedMemberForHandover(member);
        setShowHandoverModal(true);
    };

    const confirmHandover = async () => {
        if (!selectedProject || !selectedMemberForHandover) return;

        try {
            const { error } = await supabase.rpc('handover_project_role', {
                project_id_input: selectedProject.id,
                target_user_id_input: selectedMemberForHandover.user_id
            });

            if (error) throw error;

            addToast?.('Role handover successful! You are now an employee.', 'success');
            setShowHandoverModal(false);
            setSelectedMemberForHandover(null);

            // Refresh to reflect changes (which might kick us out of this view if we lose access)
            fetchProjectMembers(selectedProject.id);
            // Ideally navigate away or refresh full app context if privileges are lost
        } catch (error) {
            console.error('Handover failed:', error);
            addToast?.(error.message || 'Handover failed', 'error');
        }
    };

    useEffect(() => {
        if (orgId) {
            fetchProjects();
            fetchAllUsers();
        }
    }, [orgId]);

    const fetchProjects = async () => {
        if (!orgId) return;
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setProjects(data || []);
            if (data?.length > 0 && !selectedProject) {
                setSelectedProject(data[0]);
                fetchProjectMembers(data[0].id);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        if (!orgId) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .eq('org_id', orgId)
                .order('full_name');
            if (error) throw error;
            setAllUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchProjectMembers = async (projectId) => {
        try {
            const { data, error } = await supabase
                .from('project_members')
                .select('*, profiles:user_id(id, full_name, email)')
                .eq('project_id', projectId)
                .eq('org_id', orgId);
            if (error) throw error;
            setProjectMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    };

    const createProject = async () => {
        if (!newProjectName.trim() || !orgId) return;
        try {
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    name: newProjectName.trim(),
                    org_id: orgId
                })
                .select()
                .single();
            if (error) throw error;

            // Auto-add the creator as project_manager
            if (data && userId) {
                const { error: pmError } = await supabase.from('project_members').insert({
                    project_id: data.id,
                    user_id: userId,
                    role: 'project_manager',
                    org_id: orgId
                });
                if (pmError) console.warn('Could not auto-add to project_members:', pmError);

                // Sync with team_members (best effort)
                const { error: tmError } = await supabase.from('team_members').insert({
                    team_id: data.id,
                    profile_id: userId,
                    role_in_project: 'project_manager',
                    org_id: orgId
                });
                if (tmError) console.warn('Could not auto-add to team_members:', tmError);
            }

            setProjects([data, ...projects]);
            setNewProjectName('');
            setShowAddProject(false);
            setSelectedProject(data);
            fetchProjectMembers(data.id);
            addToast?.('Project created!', 'success');
        } catch (error) {
            addToast?.('Failed to create project', 'error');
        }
    };

    const addMember = async (userId) => {
        if (!selectedProject) return;

        // Map 'consultant' to 'employee' for database compatibility
        const dbRole = selectedRole === 'consultant' ? 'employee' : selectedRole;

        const insertData = {
            project_id: selectedProject.id,
            user_id: userId,
            role: dbRole,
            org_id: orgId
        };
        console.log('🔍 Adding member with data:', insertData);

        try {
            // 1. Insert into project_members
            const { data, error } = await supabase.from('project_members').insert(insertData).select();

            if (error) {
                console.error('Project member insert failed:', error);
                throw error;
            }

            console.log('📝 Project member added:', data);

            // 2. Sync with team_members (best effort)
            const teamMemberData = {
                team_id: selectedProject.id,
                profile_id: userId,
                role_in_project: dbRole,
                org_id: orgId
            };

            const { error: teamError } = await supabase.from('team_members').insert(teamMemberData);
            if (teamError) {
                console.warn('Team member sync warning (might already exist):', teamError);
            } else {
                console.log('Team member synced');
            }

            fetchProjectMembers(selectedProject.id);
            setShowAddMember(false);
            setSearchUser('');
            addToast?.('Member added successfully!', 'success');
        } catch (error) {
            console.error('❌ Full error object:', error);
            if (error.code === '23505') {
                addToast?.('User already in this project', 'error');
            } else {
                addToast?.('Failed to add member: ' + (error.message || 'Unknown error'), 'error');
            }
        }
    };

    const removeMember = async (memberId) => {
        try {
            const { error } = await supabase.from('project_members').delete().eq('id', memberId);
            if (error) throw error;
            setProjectMembers(projectMembers.filter(m => m.id !== memberId));
            addToast?.('Member removed', 'success');
        } catch (error) {
            addToast?.('Failed to remove member', 'error');
        }
    };

    const updateMemberRole = async (member, newRole) => {
        try {
            // Map 'consultant' to 'employee' for database compatibility if needed
            // Assuming DB constraints allow 'employee', 'team_lead', 'manager'
            const dbRole = newRole === 'consultant' ? 'employee' : newRole;

            console.log(`Updating member ${member.id} role. UI Role: ${newRole}, DB Role: ${dbRole}`);

            // Update project_members
            const { error: errorProject } = await supabase
                .from('project_members')
                .update({ role: dbRole })
                .eq('id', member.id);

            if (errorProject) {
                console.error('Project member update failed:', errorProject);
                throw errorProject;
            }

            // Sync with team_members (best effort)
            // project_id maps to team_id, user_id maps to profile_id
            if (member.project_id && member.user_id) {
                const { error: errorTeam } = await supabase
                    .from('team_members')
                    .update({ role_in_project: dbRole })
                    .eq('team_id', member.project_id)
                    .eq('profile_id', member.user_id);

                if (errorTeam) console.warn('Team member sync warning:', errorTeam);
            }

            console.log('Role update successful');

            // Update state locally
            setProjectMembers(prev => prev.map(m =>
                m.id === member.id ? { ...m, role: newRole } : m
            ));

            addToast?.('Role updated successfully', 'success');
        } catch (error) {
            console.error('Failed to update role:', error);
            addToast?.(`Update Failed: ${error.message || 'Unknown error'}`, 'error');
            // Re-fetch to ensure UI is in sync
            if (selectedProject?.id) fetchProjectMembers(selectedProject.id);
        }
    };

    const updateProjectStatus = async (projectId, newStatus) => {
        try {
            const { error } = await supabase
                .from('projects')
                .update({ status: newStatus })
                .eq('id', projectId);
            if (error) throw error;

            setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
            if (selectedProject?.id === projectId) {
                setSelectedProject({ ...selectedProject, status: newStatus });
            }
            addToast?.(`Project marked as ${newStatus}`, 'success');
        } catch (error) {
            addToast?.('Failed to update project status', 'error');
        }
    };

    const getRoleBadge = (role) => {
        // Map 'employee' from DB to 'consultant' for UI display
        const displayRole = role === 'employee' ? 'consultant' : role;
        const styles = {
            manager: { bg: '#fef3c7', color: '#b45309' },
            team_lead: { bg: '#dbeafe', color: '#1d4ed8' },
            consultant: { bg: '#f3f4f6', color: '#374151' }
        };
        return styles[displayRole] || styles.consultant;
    };

    const getStatusBadge = (status) => {
        const styles = {
            active: { bg: '#dcfce7', color: '#166534', icon: CheckCircle },
            completed: { bg: '#dbeafe', color: '#1e40af', icon: CheckCircle },
            deactivated: { bg: '#f3f4f6', color: '#6b7280', icon: XCircle }
        };
        return styles[status?.toLowerCase()] || styles.active;
    };

    const filteredUsers = allUsers.filter(u =>
        !projectMembers.find(m => m.user_id === u.id) &&
        (u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchUser.toLowerCase()))
    );

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Loading projects...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Premium Dark Header */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                borderRadius: '20px',
                padding: '32px 36px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                    <div>
                        {/* Badge and Subtitle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <span style={{
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                color: 'white',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                boxShadow: '0 4px 12px rgba(139,92,246,0.4)'
                            }}>
                                EXECUTIVE
                            </span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.5rem' }}>●</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 500 }}>
                                Organization Management
                            </span>
                        </div>

                        {/* Main Title with Gradient */}
                        <h1 style={{
                            fontSize: '2rem',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 50%, #8b5cf6 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            marginBottom: '8px',
                            letterSpacing: '-0.02em'
                        }}>
                            Project <span style={{
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}>Management</span>
                        </h1>

                        {/* Description */}
                        <p style={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.95rem',
                            maxWidth: '500px',
                            lineHeight: 1.5
                        }}>
                            Create projects, manage team members, and oversee organizational workflow.
                        </p>
                    </div>

                    {/* Stats Cards */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: '14px',
                            padding: '16px 24px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#8b5cf6' }}>{projects.length}</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Projects</div>
                        </div>
                        <div style={{
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: '14px',
                            padding: '16px 24px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>{projectMembers.length}</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>Members</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div style={{ display: 'flex', gap: '24px', minHeight: '500px' }}>
                {/* Projects List - Left Sidebar */}
                <div style={{
                    width: '320px',
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
                }}>
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                    }}>
                        <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', color: '#0f172a' }}>
                            <FolderOpen size={20} color="#8b5cf6" /> Projects
                        </h3>
                        <button onClick={() => setShowAddProject(true)} style={{
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px',
                            cursor: 'pointer',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Plus size={18} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                        {projects.map(project => {
                            const isSelected = selectedProject?.id === project.id;
                            const status = getStatusBadge(project.status);
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => { setSelectedProject(project); fetchProjectMembers(project.id); }}
                                    style={{
                                        padding: '16px 18px',
                                        cursor: 'pointer',
                                        borderRadius: '14px',
                                        backgroundColor: isSelected ? '#f5f3ff' : 'white',
                                        border: isSelected ? '2px solid #8b5cf6' : '2px solid transparent',
                                        transition: 'all 0.2s ease',
                                        marginBottom: '8px',
                                        boxShadow: isSelected ? '0 4px 16px rgba(139,92,246,0.15)' : 'none'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px', fontSize: '0.95rem' }}>{project.name}</div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        backgroundColor: status.bg,
                                        color: status.color,
                                        fontWeight: 600,
                                        textTransform: 'capitalize',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <status.icon size={12} />
                                        {project.status || 'active'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Project Members - Right Panel */}
                <div style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
                }}>
                    {selectedProject ? (
                        <>
                            <div style={{
                                padding: '24px 28px',
                                borderBottom: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'linear-gradient(135deg, #fafafa 0%, #f8fafc 100%)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(139,92,246,0.3)'
                                    }}>
                                        <Users size={24} color="white" />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em' }}>{selectedProject.name}</h2>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>{projectMembers.length} team members</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <select
                                        value={selectedProject.status || 'active'}
                                        onChange={(e) => updateProjectStatus(selectedProject.id, e.target.value)}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: '10px',
                                            border: '2px solid var(--border)',
                                            backgroundColor: getStatusBadge(selectedProject.status).bg,
                                            color: getStatusBadge(selectedProject.status).color,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            textTransform: 'capitalize'
                                        }}
                                    >
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                        <option value="deactivated">Deactivated</option>
                                    </select>
                                    <button onClick={() => setShowAddMember(true)} style={{
                                        padding: '12px 24px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        boxShadow: '0 4px 14px rgba(139,92,246,0.35)',
                                        transition: 'all 0.2s ease',
                                        fontSize: '0.9rem'
                                    }}>
                                        <UserPlus size={18} /> Add Member
                                    </button>
                                </div>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                                {projectMembers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            backgroundColor: '#f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 16px'
                                        }}>
                                            <Users size={36} style={{ color: '#94a3b8' }} />
                                        </div>
                                        <p style={{ fontSize: '1rem', fontWeight: 500 }}>No members yet</p>
                                        <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Add project members to get started.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {projectMembers.map((member, index) => {
                                            const badge = getRoleBadge(member.role);
                                            const avatarColors = [
                                                'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                                                'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                                                'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                                            ];
                                            const avatarBg = avatarColors[index % avatarColors.length];

                                            return (
                                                <div key={member.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '16px 20px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '16px',
                                                    border: '1px solid #e2e8f0',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                        <div style={{
                                                            width: '46px',
                                                            height: '46px',
                                                            borderRadius: '50%',
                                                            background: avatarBg,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontWeight: 700,
                                                            fontSize: '1rem',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                                        }}>
                                                            {member.profiles?.full_name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{member.profiles?.full_name || 'Unknown'}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{member.profiles?.email}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <select
                                                            value={member.role === 'employee' ? 'consultant' : (member.role?.toLowerCase() || 'consultant')}
                                                            onChange={(e) => updateMemberRole(member, e.target.value)}
                                                            style={{
                                                                padding: '8px 14px',
                                                                borderRadius: '10px',
                                                                border: '1px solid #e2e8f0',
                                                                backgroundColor: badge.bg,
                                                                color: badge.color,
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                fontSize: '0.8rem'
                                                            }}
                                                        >
                                                            <option value="consultant">Consultant</option>
                                                            <option value="team_lead">Team Lead</option>
                                                            <option value="manager">Manager</option>
                                                        </select>

                                                        {/* Delete Button */}
                                                        <button onClick={() => removeMember(member.id)} style={{
                                                            padding: '10px',
                                                            borderRadius: '10px',
                                                            border: '1px solid #fee2e2',
                                                            backgroundColor: '#fef2f2',
                                                            cursor: 'pointer',
                                                            color: '#ef4444',
                                                            transition: 'all 0.2s ease',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Trash2 size={16} />
                                                        </button>

                                                        {/* More Actions Menu (Kebab) - Only for PM/TL */}
                                                        {((projectRole === 'project_manager' || projectRole === 'team_lead') && member.user_id !== userId) && (
                                                            <div style={{ position: 'relative' }}>
                                                                <button
                                                                    onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                                                                    style={{
                                                                        padding: '10px',
                                                                        borderRadius: '10px',
                                                                        border: '1px solid #e2e8f0',
                                                                        backgroundColor: 'white',
                                                                        cursor: 'pointer',
                                                                        color: '#64748b',
                                                                        transition: 'all 0.2s ease',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                >
                                                                    <MoreVertical size={16} />
                                                                </button>

                                                                {/* Dropdown Menu */}
                                                                {activeMenuId === member.id && (
                                                                    <div style={{
                                                                        position: 'absolute',
                                                                        top: '120%',
                                                                        right: 0,
                                                                        backgroundColor: 'white',
                                                                        borderRadius: '12px',
                                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                                                        border: '1px solid #f3f4f6',
                                                                        width: '180px',
                                                                        zIndex: 50,
                                                                        overflow: 'hidden',
                                                                        padding: '4px'
                                                                    }}>
                                                                        <button
                                                                            onClick={() => { initiatHandover(member); setActiveMenuId(null); }}
                                                                            style={{
                                                                                width: '100%',
                                                                                textAlign: 'left',
                                                                                padding: '10px 12px',
                                                                                fontSize: '0.85rem',
                                                                                color: '#d97706',
                                                                                backgroundColor: 'white',
                                                                                border: 'none',
                                                                                cursor: 'pointer',
                                                                                fontWeight: 600,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '8px',
                                                                                borderRadius: '8px',
                                                                                transition: 'background 0.2s'
                                                                            }}
                                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fffbeb'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                                                        >
                                                                            <Users size={16} /> Handover Role
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                            Select a project to manage members
                        </div>
                    )}
                </div>

                {/* Handover Confirmation Modal */}
                {showHandoverModal && selectedMemberForHandover && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1100
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            padding: '32px',
                            borderRadius: '24px',
                            width: '480px',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#b91c1c' }}>
                                <div style={{ padding: '12px', borderRadius: '50%', backgroundColor: '#fef2f2' }}>
                                    <AlertTriangle size={32} />
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Confirm Role Handover</h3>
                            </div>

                            <p style={{ color: '#4b5563', lineHeight: 1.6, marginTop: '8px' }}>
                                You are about to transfer your <strong>{projectRole === 'project_manager' ? 'Project Manager' : 'Team Lead'}</strong> role to <strong>{selectedMemberForHandover.profiles?.full_name}</strong>.
                            </p>

                            <div style={{ backgroundColor: '#fffba0', padding: '12px 16px', borderRadius: '12px', border: '1px solid #fde047', fontSize: '0.9rem', color: '#854d0e', display: 'flex', gap: '10px' }}>
                                <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                                <div>
                                    <strong>Warning:</strong> You will lose your current administrative privileges for this project immediately after this action.
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button
                                    onClick={() => { setShowHandoverModal(false); setSelectedMemberForHandover(null); }}
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: 'white',
                                        color: '#374151',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmHandover}
                                    style={{
                                        padding: '12px 24px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        color: 'white',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                                    }}
                                >
                                    Confirm Handover
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Project Wizard */}
                {showAddProject && (
                    <ProjectWizard
                        isOpen={showAddProject}
                        onClose={() => setShowAddProject(false)}
                        onComplete={fetchProjects}
                        addToast={addToast}
                    />
                )}

                {/* Add Member Modal */}
                {showAddMember && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: 'var(--surface)', padding: '24px', borderRadius: '16px', width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontWeight: 700 }}>Add Member to {selectedProject?.name}</h3>
                                <button onClick={() => setShowAddMember(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                    <input type="text" value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="Search users..."
                                        style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                                </div>
                                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
                                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <option value="consultant">Consultant</option>
                                    <option value="team_lead">Team Lead</option>
                                    <option value="manager">Manager</option>
                                </select>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                                {filteredUsers.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No users found</div>
                                ) : (
                                    filteredUsers.map(user => (
                                        <div key={user.id} onClick={() => addMember(user.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px' }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                                {user.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500 }}>{user.full_name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                                            </div>
                                            <Plus size={18} color="#8b5cf6" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectManagement;
