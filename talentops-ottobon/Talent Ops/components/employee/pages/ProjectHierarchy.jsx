import React, { useState, useEffect } from 'react';
import { Users, User, ChevronDown, ChevronRight, Loader2, Bot, Briefcase } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useProject } from '../context/ProjectContext';
import { useUser } from '../context/UserContext';

const ProjectHierarchy = () => {
    const { currentProject, projectRole } = useProject();
    const { orgId } = useUser();
    const [hierarchy, setHierarchy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState({});

    useEffect(() => {
        if (currentProject?.id && orgId) {
            fetchProjectHierarchy();
        }
    }, [currentProject?.id, orgId]);

    const fetchProjectHierarchy = async () => {
        setLoading(true);
        try {
            // Fetch project members for this project
            const { data: members, error } = await supabase
                .from('project_members')
                .select(`
                    id,
                    role,
                    user_id,
                    profiles:user_id (
                        id,
                        full_name,
                        email,
                        avatar_url,
                        role,
                        org_id
                    )
                `)
                .eq('project_id', currentProject.id);

            if (error) throw error;

            // Filter members to only include those from the same organization
            const filteredMembers = members?.filter(m => m.profiles?.org_id === orgId) || [];

            // Build project hierarchy
            const projectStructure = {
                name: currentProject.name || 'Current Project',
                type: 'project',
                children: []
            };

            // Add Client/Executive (external stakeholder)
            projectStructure.children.push({
                name: 'Client (Executive)',
                type: 'role',
                emoji: '👔',
                description: 'External stakeholder / Project sponsor',
                children: filteredMembers.filter(m => m.role === 'pm' || m.profiles?.role === 'executive').map(m => ({
                    name: m.profiles?.full_name || m.profiles?.email || 'Unknown',
                    type: 'person',
                    role: 'Client Executive',
                    avatar: m.profiles?.avatar_url,
                    id: m.user_id
                }))
            });

            // Add AI Manager
            projectStructure.children.push({
                name: 'AI Manager',
                type: 'role',
                emoji: '🤖',
                description: 'AI-powered project management assistant',
                children: [{
                    name: 'TalentOps AI Assistant',
                    type: 'ai',
                    role: 'Project Manager (AI)',
                    isAI: true
                }]
            });

            // Add Team Leads
            const teamLeads = filteredMembers.filter(m => m.role === 'team_lead');
            if (teamLeads.length > 0) {
                projectStructure.children.push({
                    name: 'Team Leads',
                    type: 'role',
                    emoji: '🟡',
                    children: teamLeads.map(tl => ({
                        name: tl.profiles?.full_name || tl.profiles?.email || 'Unknown',
                        type: 'person',
                        role: 'Team Lead',
                        avatar: tl.profiles?.avatar_url,
                        id: tl.user_id
                    }))
                });
            }

            // Add Consultants (developers, designers, etc.)
            const consultants = filteredMembers.filter(m =>
                !['pm', 'team_lead'].includes(m.role) &&
                m.profiles?.role !== 'executive'
            );

            // Group by role
            const roleGroups = {};
            consultants.forEach(c => {
                const role = c.role || 'other';
                if (!roleGroups[role]) roleGroups[role] = [];
                roleGroups[role].push(c);
            });

            Object.entries(roleGroups).forEach(([role, members]) => {
                const roleLabels = {
                    'frontend': '💻 Frontend',
                    'backend': '⚙️ Backend',
                    'fullstack': '🔧 Fullstack',
                    'devops': '🚀 DevOps',
                    'qa': '🧪 QA',
                    'design': '🎨 Design',
                    'other': '👤 Other'
                };

                projectStructure.children.push({
                    name: roleLabels[role] || role.charAt(0).toUpperCase() + role.slice(1),
                    type: 'role',
                    emoji: '',
                    children: members.map(m => ({
                        name: m.profiles?.full_name || m.profiles?.email || 'Unknown',
                        type: 'person',
                        role: role.charAt(0).toUpperCase() + role.slice(1),
                        avatar: m.profiles?.avatar_url,
                        id: m.user_id
                    }))
                });
            });

            setExpandedNodes({ [projectStructure.name]: true });
            setHierarchy(projectStructure);
        } catch (err) {
            console.error('Error fetching project hierarchy:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleNode = (nodeName) => {
        setExpandedNodes(prev => ({
            ...prev,
            [nodeName]: !prev[nodeName]
        }));
    };

    const renderNode = (node, level = 0) => {
        const isExpanded = expandedNodes[node.name];
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.name + level} style={{ marginLeft: level * 24 }}>
                <div
                    onClick={() => hasChildren && toggleNode(node.name)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        marginBottom: '4px',
                        borderRadius: '12px',
                        backgroundColor: node.type === 'project' ? '#3b82f620' : node.type === 'role' ? '#f1f5f9' : node.isAI ? '#10b98120' : 'white',
                        border: node.type === 'person' || node.isAI ? '1px solid #e2e8f0' : 'none',
                        cursor: hasChildren ? 'pointer' : 'default',
                        transition: 'all 0.2s'
                    }}
                >
                    {hasChildren && (
                        isExpanded ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />
                    )}

                    {node.type === 'project' && <Briefcase size={20} color="#3b82f6" />}
                    {node.type === 'role' && node.emoji && <span style={{ fontSize: '1.2rem' }}>{node.emoji}</span>}
                    {node.isAI && <Bot size={20} color="#10b981" />}
                    {node.type === 'person' && !node.isAI && (
                        node.avatar ? (
                            <img src={node.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={14} color="#64748b" />
                            </div>
                        )
                    )}

                    <div>
                        <span style={{ fontWeight: node.type !== 'person' ? 600 : 500, color: node.isAI ? '#10b981' : '#1e293b', fontSize: node.type === 'project' ? '1.1rem' : '0.95rem' }}>
                            {node.name}
                        </span>
                        {node.role && (
                            <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: node.isAI ? '#10b981' : '#64748b', backgroundColor: node.isAI ? '#10b98120' : '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                                {node.role}
                            </span>
                        )}
                        {node.description && (
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{node.description}</p>
                        )}
                        {node.children && node.type !== 'person' && (
                            <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                                ({node.children.length})
                            </span>
                        )}
                    </div>
                </div>

                {isExpanded && hasChildren && (
                    <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '20px', paddingLeft: '8px' }}>
                        {node.children.map((child, idx) => renderNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#64748b' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ marginLeft: '12px' }}>Loading project hierarchy...</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1e293b' }}>
                    📂 Project Hierarchy
                </h1>
                <p style={{ color: '#64748b', marginTop: '4px' }}>
                    {currentProject?.name || 'Current Project'} - Team structure and roles
                </p>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {hierarchy ? renderNode(hierarchy) : (
                    <p style={{ color: '#64748b', textAlign: 'center' }}>No project selected or no team members found</p>
                )}
            </div>
        </div>
    );
};

export default ProjectHierarchy;
