import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    BarChart2,
    Users,
    ListTodo,
    CalendarOff,
    Receipt,
    FileText,
    Network,
    ClipboardList,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    LogOut,
    UserCheck,
    Megaphone,
    MessageCircle,
    Building2,
    FolderKanban,
    ChevronsUpDown,
    Check,
    Ticket,
    TrendingUp,
    Trophy
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import { supabase } from '../../../../lib/supabaseClient';
import { useMessages } from '../../../shared/context/MessageContext';

const Sidebar = ({ isCollapsed, toggleSidebar, onMouseEnter, onMouseLeave }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { teamId, setTeamId, userId } = useUser();
    const { unreadCount } = useMessages();
    const [projectName, setProjectName] = useState('Talent Ops');
    const [userProjects, setUserProjects] = useState([]);
    const [showProjectSelect, setShowProjectSelect] = useState(false);

    const [expandedMenus, setExpandedMenus] = useState({
        organization: true,
        project: true
    });

    // Fetch User's Projects
    useEffect(() => {
        const fetchProjects = async () => {
            if (!userId) return;
            try {
                // 1. Get Project IDs
                const { data: members } = await supabase
                    .from('project_members')
                    .select('project_id')
                    .eq('user_id', userId);

                if (members && members.length > 0) {
                    const ids = members.map(m => m.project_id);
                    // 2. Get Project Details
                    const { data: projectsData } = await supabase
                        .from('projects')
                        .select('id, name')
                        .in('id', ids);

                    if (projectsData) {
                        setUserProjects(projectsData);
                        // Update current project name logic
                        const current = projectsData.find(p => p.id === teamId);
                        if (current) setProjectName(current.name);
                        else if (projectsData.length > 0 && !teamId) {
                            // Auto-select first if none selected
                            setTeamId(projectsData[0].id);
                            setProjectName(projectsData[0].name);
                        }
                    }
                } else {
                    // Fallback to profile check if project_members is empty
                    const { data: profile } = await supabase.from('profiles').select('team_id').eq('id', userId).single();
                    if (profile && profile.team_id) {
                        const { data: pData } = await supabase.from('projects').select('id, name').eq('id', profile.team_id).single();
                        if (pData) {
                            setUserProjects([pData]);
                            setProjectName(pData.name);
                            if (!teamId) setTeamId(pData.id);
                        }
                    }
                }
            } catch (e) { console.error('Error fetching projects', e); }
        };
        fetchProjects();
    }, [userId, teamId, setTeamId]);

    const handleProjectSwitch = (newProjectId, newProjectName) => {
        setTeamId(newProjectId);
        setProjectName(newProjectName);
        setShowProjectSelect(false);
        navigate('/teamlead-dashboard/dashboard');
    };

    const toggleMenu = (label) => {
        if (isCollapsed) return;
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    // Organization-level menu items
    const orgMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/teamlead-dashboard/dashboard' },
        { icon: UserCheck, label: 'Team Status', path: '/teamlead-dashboard/team-status' },
        { icon: CalendarOff, label: 'Leave Requests', path: '/teamlead-dashboard/leaves' },
        { icon: Receipt, label: 'Payslips', path: '/teamlead-dashboard/payslips' },
        { icon: FileText, label: 'Policies', path: '/teamlead-dashboard/policies' },
        { icon: Network, label: 'Org Hierarchy', path: '/teamlead-dashboard/hierarchy' },
        { icon: Megaphone, label: 'Announcements', path: '/teamlead-dashboard/announcements' },
        { icon: MessageCircle, label: 'Messages', path: '/teamlead-dashboard/messages' },
        { icon: TrendingUp, label: 'Review', path: '/teamlead-dashboard/team-reviews' },
        { icon: Trophy, label: 'Ranking', path: '/teamlead-dashboard/rankings' },
        { icon: Ticket, label: 'Raise a Ticket', path: '/teamlead-dashboard/raise-ticket' },
    ];

    // Project-level menu items
    const projectMenuItems = [
        { icon: Users, label: 'Team Members', path: '/teamlead-dashboard/employees' },
        { icon: ListTodo, label: 'Tasks', path: '/teamlead-dashboard/tasks' },
        { icon: ClipboardList, label: 'Team Tasks', path: '/teamlead-dashboard/team-tasks' },
        { icon: BarChart2, label: 'Analytics', path: '/teamlead-dashboard/analytics' },
        { icon: Network, label: 'Project Hierarchy', path: '/teamlead-dashboard/project-hierarchy' },
        { icon: FileText, label: 'Documents', path: '/teamlead-dashboard/documents' },
    ];

    // Menu item renderer
    const renderMenuItem = (item, index, keyPrefix) => {
        const isActive = location.pathname === item.path;
        return (
            <button
                key={`${keyPrefix}-${index}`}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : ''}
                style={{
                    position: 'relative', // Required for absolute positioned dot
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.color = 'white';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                    }
                }}
            >
                <item.icon size={18} style={{ flexShrink: 0 }} />
                {!isCollapsed && <span>{item.label}</span>}
                {/* Expanded: Show badge with count */}
                {!isCollapsed && item.label === 'Messages' && unreadCount > 0 && (
                    <div style={{
                        marginLeft: 'auto',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '9999px',
                        minWidth: '18px',
                        textAlign: 'center'
                    }}>
                        {unreadCount}
                    </div>
                )}
                {/* Collapsed: Show small red dot */}
                {isCollapsed && item.label === 'Messages' && unreadCount > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        backgroundColor: '#ef4444',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%'
                    }} />
                )}
            </button>
        );
    };

    // Section header (collapsible) - Emojis Removed
    const renderSectionHeader = (icon, label, sectionKey) => (
        <button
            onClick={() => toggleMenu(sectionKey)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                width: '100%',
                padding: '8px 12px',
                marginBottom: '8px',
                background: sectionKey === 'project'
                    ? 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.1) 100%)'
                    : 'rgba(255,255,255,0.05)',
                border: sectionKey === 'project'
                    ? '1px solid rgba(139,92,246,0.3)'
                    : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: sectionKey === 'project' ? '#a78bfa' : 'rgba(255,255,255,0.9)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: sectionKey === 'project' ? '0 4px 12px rgba(139,92,246,0.1)' : 'none'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {React.createElement(icon, { size: 15 })}
                {!isCollapsed && <span>{label}</span>}
            </div>
            {!isCollapsed && (
                <ChevronDown
                    size={14}
                    style={{
                        transform: expandedMenus[sectionKey] ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                />
            )}
        </button>
    );

    return (
        <aside
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{
                width: isCollapsed ? '70px' : '240px',
                backgroundColor: '#1a1a2e',
                color: 'white',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '12px',
                zIndex: 1000,
                transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                borderRadius: '0 24px 24px 0',
                willChange: 'width',
                transform: 'translateZ(0)'
            }}>
            {/* Logo */}
            <div style={{
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                height: '40px'
            }}>
                {!isCollapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Talent Ops</h1>
                    </div>
                )}
                <button
                    onClick={toggleSidebar}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'flex'
                    }}
                >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Scrollable Nav */}
            <nav style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: '4px'
            }}>
                {/* Organization Section */}
                {renderSectionHeader(Building2, 'Organization', 'organization')}
                {expandedMenus.organization && !isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                        {orgMenuItems.map((item, idx) => renderMenuItem(item, idx, 'org'))}
                    </div>
                )}
                {isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
                        {orgMenuItems.map((item, idx) => renderMenuItem(item, idx, 'org'))}
                    </div>
                )}

                {/* CURRENT PROJECT SECTION - Functional */}
                {!isCollapsed && (
                    <div style={{ padding: '0 4px', marginTop: '16px', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8b5cf6', marginBottom: '10px', paddingLeft: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CURRENT PROJECT</h3>
                        <div
                            onClick={() => setShowProjectSelect(!showProjectSelect)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.1) 100%)',
                                border: '1px solid rgba(139,92,246,0.3)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                marginBottom: '8px',
                                position: 'relative',
                                boxShadow: '0 4px 12px rgba(139,92,246,0.15)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }}></div>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{projectName}</span>
                            </div>
                            <ChevronDown size={16} color="rgba(255,255,255,0.5)" style={{ transition: 'transform 0.3s', transform: showProjectSelect ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                        </div>

                        {/* Dropdown Menu */}
                        {showProjectSelect && userProjects.length > 0 && (
                            <div style={{
                                background: 'linear-gradient(180deg, #2a2a4a 0%, #1e1e38 100%)',
                                border: '1px solid rgba(139,92,246,0.2)',
                                borderRadius: '12px',
                                padding: '6px',
                                marginBottom: '8px',
                                overflow: 'hidden',
                                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                                animation: 'fadeIn 0.2s ease'
                            }}>
                                {userProjects.map(proj => (
                                    <div
                                        key={proj.id}
                                        onClick={() => handleProjectSwitch(proj.id, proj.name)}
                                        style={{
                                            padding: '10px 14px',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: teamId === proj.id ? 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(124,58,237,0.2) 100%)' : 'transparent',
                                            background: teamId === proj.id ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                                            color: teamId === proj.id ? 'white' : 'rgba(255,255,255,0.7)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (teamId !== proj.id) {
                                                e.currentTarget.style.background = 'rgba(139,92,246,0.15)';
                                                e.currentTarget.style.paddingLeft = '18px';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (teamId !== proj.id) {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.paddingLeft = '14px';
                                            }
                                        }}
                                    >
                                        <span style={{ fontWeight: teamId === proj.id ? '600' : '400' }}>{proj.name}</span>
                                        {teamId === proj.id && <Check size={14} style={{ color: '#a78bfa' }} />}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Project Section */}
                {renderSectionHeader(FolderKanban, projectName.toUpperCase() || 'PROJECT', 'project')}

                {expandedMenus.project && !isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {projectMenuItems.map((item, idx) => renderMenuItem(item, idx, 'proj'))}
                    </div>
                )}
                {isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {projectMenuItems.map((item, idx) => renderMenuItem(item, idx, 'proj'))}
                    </div>
                )}
            </nav>

            {/* Logout */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', marginTop: '12px' }}>
                <button
                    onClick={() => navigate('/teamlead-dashboard/settings')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '8px',
                        width: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        background: location.pathname === '/teamlead-dashboard/settings' ? 'var(--accent)' : 'transparent',
                        color: location.pathname === '/teamlead-dashboard/settings' ? 'white' : 'rgba(255,255,255,0.7)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        marginBottom: '8px'
                    }}
                    onMouseEnter={(e) => {
                        if (location.pathname !== '/teamlead-dashboard/settings') {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.color = 'white';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (location.pathname !== '/teamlead-dashboard/settings') {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                        }
                    }}
                >
                    <Settings size={18} />
                    {!isCollapsed && <span>Profile</span>}
                </button>

                <button
                    onClick={() => navigate('/login')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: '10px',
                        padding: '12px',
                        borderRadius: '8px',
                        width: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#f87171'; }}
                >
                    <LogOut size={18} />
                    {!isCollapsed && <span>Logout</span>}
                </button>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </aside>
    );
};

export default Sidebar;
