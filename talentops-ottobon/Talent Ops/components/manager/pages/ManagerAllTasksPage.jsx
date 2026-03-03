import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Briefcase, ChevronRight, LayoutGrid, List, FolderKanban, Users, CheckCircle2, Clock } from 'lucide-react';
import AllTasksView from '../../shared/AllTasksView';
import { useUser } from '../context/UserContext';

const ManagerAllTasksPage = () => {
    const { userId, orgId } = useUser();
    const [viewMode, setViewMode] = useState('projects'); // 'projects' or 'tasks'
    const [selectedProject, setSelectedProject] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [taskCounts, setTaskCounts] = useState({});

    useEffect(() => {
        fetchProjects();
    }, [userId, orgId]);

    const fetchProjects = async () => {
        try {
            setLoading(true);

            // Fetch all active projects for the Manager view
            const { data: allProjects, error } = await supabase
                .from('projects')
                .select('id, name, status, description')
                .eq('status', 'active')
                .eq('org_id', orgId);

            if (error) throw error;

            setProjects(allProjects || []);

            // Fetch task counts for each project
            if (allProjects && allProjects.length > 0) {
                const counts = {};
                for (const project of allProjects) {
                    const { data: tasks } = await supabase
                        .from('tasks')
                        .select('id, status')
                        .eq('project_id', project.id);

                    counts[project.id] = {
                        total: tasks?.length || 0,
                        completed: tasks?.filter(t => ['completed', 'done'].includes(t.status?.toLowerCase())).length || 0,
                        inProgress: tasks?.filter(t => ['in_progress', 'in progress'].includes(t.status?.toLowerCase())).length || 0
                    };
                }
                setTaskCounts(counts);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProjectClick = (project) => {
        setSelectedProject(project);
        setViewMode('tasks');
    };

    const handleBackToProjects = () => {
        setSelectedProject(null);
        setViewMode('projects');
    };

    // Color palettes for project cards
    const getProjectColors = (index) => {
        const palettes = [
            { bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', iconBg: '#dbeafe', iconColor: '#1e40af' },
            { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', iconBg: '#e0e7ff', iconColor: '#3730a3' },
            { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', iconBg: '#dcfce7', iconColor: '#166534' },
            { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', iconBg: '#fef3c7', iconColor: '#92400e' },
            { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', iconBg: '#fee2e2', iconColor: '#991b1b' },
            { bg: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', iconBg: '#fce7f3', iconColor: '#9d174d' },
            { bg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', iconBg: '#cffafe', iconColor: '#155e75' },
            { bg: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)', iconBg: '#ecfccb', iconColor: '#3f6212' }
        ];
        return palettes[index % palettes.length];
    };

    if (viewMode === 'tasks' && selectedProject) {
        return (
            <AllTasksView
                userRole="manager"
                projectRole="manager"
                userId={userId}
                orgId={orgId}
                projectId={selectedProject.id}
                onBack={handleBackToProjects}
            />
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Premium Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '28px 32px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
            }}>
                {/* SVG Mesh Pattern Overlay */}
                <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none' }}>
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="mesh-tasks-mgr" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#mesh-tasks-mgr)" />
                    </svg>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dashboard</span>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>/</span>
                            <span style={{ color: '#22d3ee', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>All Tasks</span>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FolderKanban size={28} />
                            Project Tasks
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', fontWeight: '400' }}>
                            Select a project to view and manage all associated tasks
                        </p>
                    </div>

                    {/* Stats Cards in Header */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.05)',
                            backdropFilter: 'blur(10px)',
                            padding: '14px 20px',
                            borderRadius: '14px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center'
                        }}>
                            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Projects</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{projects.length}</p>
                        </div>
                        <div style={{
                            background: 'rgba(255,255,255,0.05)',
                            backdropFilter: 'blur(10px)',
                            padding: '14px 20px',
                            borderRadius: '14px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center'
                        }}>
                            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Total Tasks</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{Object.values(taskCounts).reduce((acc, c) => acc + c.total, 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        border: '3px solid #e2e8f0',
                        borderTopColor: '#8b5cf6',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: '600' }}>Loading projects...</p>
                </div>
            ) : projects.length === 0 ? (
                <div style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    backgroundColor: 'white',
                    borderRadius: '24px',
                    border: '1px dashed #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '20px',
                        fontSize: '2rem'
                    }}>
                        📁
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>No Active Projects</h3>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', maxWidth: '300px' }}>You don't have any projects assigned as a manager yet.</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '20px'
                }}>
                    {projects.map((project, index) => {
                        const colors = getProjectColors(index);
                        const counts = taskCounts[project.id] || { total: 0, completed: 0, inProgress: 0 };
                        const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

                        return (
                            <div
                                key={project.id}
                                onClick={() => handleProjectClick(project)}
                                style={{
                                    backgroundColor: 'white',
                                    borderRadius: '20px',
                                    border: '1px solid #e2e8f0',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-6px)';
                                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.08)';
                                    e.currentTarget.style.borderColor = '#8b5cf6';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.03)';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                }}
                            >
                                {/* Top Gradient Accent */}
                                <div style={{
                                    height: '4px',
                                    background: colors.bg
                                }}></div>

                                <div style={{ padding: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div style={{
                                            width: '56px',
                                            height: '56px',
                                            borderRadius: '16px',
                                            background: colors.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.25rem',
                                            fontWeight: 700,
                                            color: 'white',
                                            boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
                                        }}>
                                            {project.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div style={{
                                            padding: '5px 14px',
                                            borderRadius: '20px',
                                            backgroundColor: project.status === 'active' ? '#dcfce7' : '#f1f5f9',
                                            color: project.status === 'active' ? '#166534' : '#64748b',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            {project.status || 'Active'}
                                        </div>
                                    </div>

                                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                        {project.name}
                                    </h3>
                                    <p style={{
                                        color: '#64748b',
                                        fontSize: '0.85rem',
                                        lineHeight: '1.5',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        minHeight: '2.5rem',
                                        marginBottom: '16px'
                                    }}>
                                        {project.description || 'No description available'}
                                    </p>

                                    {/* Task Progress */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>Progress</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#0f172a' }}>{progress}%</span>
                                        </div>
                                        <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${progress}%`,
                                                background: colors.bg,
                                                borderRadius: '3px',
                                                transition: 'width 0.5s ease'
                                            }}></div>
                                        </div>
                                    </div>

                                    {/* Task Stats */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '10px',
                                        marginBottom: '16px'
                                    }}>
                                        <div style={{
                                            padding: '10px',
                                            backgroundColor: '#f8fafc',
                                            borderRadius: '10px',
                                            textAlign: 'center'
                                        }}>
                                            <p style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>{counts.total}</p>
                                            <p style={{ fontSize: '0.65rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Total</p>
                                        </div>
                                        <div style={{
                                            padding: '10px',
                                            backgroundColor: '#f0fdf4',
                                            borderRadius: '10px',
                                            textAlign: 'center'
                                        }}>
                                            <p style={{ fontSize: '1rem', fontWeight: '700', color: '#16a34a' }}>{counts.completed}</p>
                                            <p style={{ fontSize: '0.65rem', fontWeight: '600', color: '#16a34a', textTransform: 'uppercase' }}>Done</p>
                                        </div>
                                        <div style={{
                                            padding: '10px',
                                            backgroundColor: '#eff6ff',
                                            borderRadius: '10px',
                                            textAlign: 'center'
                                        }}>
                                            <p style={{ fontSize: '1rem', fontWeight: '700', color: '#2563eb' }}>{counts.inProgress}</p>
                                            <p style={{ fontSize: '0.65rem', fontWeight: '600', color: '#2563eb', textTransform: 'uppercase' }}>Active</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div style={{
                                    marginTop: 'auto',
                                    padding: '14px 24px',
                                    borderTop: '1px solid #f1f5f9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: '#fafbfc'
                                }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
                                        View Tasks
                                    </span>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '10px',
                                        backgroundColor: '#f1f5f9',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#8b5cf6',
                                        transition: 'all 0.2s'
                                    }}>
                                        <ChevronRight size={18} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ManagerAllTasksPage;

