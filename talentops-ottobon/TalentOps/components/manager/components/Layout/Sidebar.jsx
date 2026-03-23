import React, { useState } from 'react';
import {
    LayoutDashboard,
    BarChart2,
    Users,
    User,
    ListTodo,
    CalendarOff,
    Receipt,
    DollarSign,
    FileCheck,
    Briefcase,
    Network,
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
    FileText,
    Check,
    Ticket,
    TrendingUp,
    Trophy,
    ClipboardList,
    Target
} from 'lucide-react';
import { useProject } from '../../../employee/context/ProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMessages } from '../../../shared/context/MessageContext';

const Sidebar = ({ isCollapsed, toggleSidebar, onMouseEnter, onMouseLeave }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [expandedMenus, setExpandedMenus] = useState({
        organization: true,
        project: true
    });

    const { currentProject, setCurrentProject, userProjects, projectRole } = useProject();
    const { unreadCount } = useMessages();
    const [showProjectPicker, setShowProjectPicker] = useState(false);

    const getRoleBadge = (role) => {
        switch (role) {
            case 'manager': return { color: '#ef4444', label: 'Manager' };
            case 'team_lead': return { color: '#eab308', label: 'Team Lead' };
            default: return { color: '#22c55e', label: 'Consultant' };
        }
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
        { icon: LayoutDashboard, label: 'Dashboard', path: '/manager-dashboard/dashboard' },
        { icon: ListTodo, label: 'All Tasks', path: '/manager-dashboard/global-tasks' },
        { icon: Users, label: 'Employees', path: '/manager-dashboard/employees' },
        { icon: ClipboardList, label: 'Attendance Logs', path: '/manager-dashboard/attendance-logs' },
        { icon: CalendarOff, label: 'Leave Requests', path: '/manager-dashboard/leaves' },
        { icon: CalendarOff, label: 'My Leaves', path: '/manager-dashboard/my-leaves' },
        { icon: DollarSign, label: 'Payroll', path: '/manager-dashboard/payroll' },
        { icon: Receipt, label: 'Payslips', path: '/manager-dashboard/payslips' },
        { icon: Network, label: 'Org Hierarchy', path: '/manager-dashboard/hierarchy' },
        { icon: Megaphone, label: 'Announcements', path: '/manager-dashboard/announcements' },
        { icon: MessageCircle, label: 'Messages', path: '/manager-dashboard/messages' },
        { icon: FileCheck, label: 'Policies', path: '/manager-dashboard/policies' },
        { icon: TrendingUp, label: 'Review', path: '/manager-dashboard/team-reviews' },
        { icon: Trophy, label: 'Ranking', path: '/manager-dashboard/rankings' },
        { icon: Ticket, label: 'Raise a Ticket', path: '/manager-dashboard/raise-ticket' },
    ];

    // Role-based project menu configurations
    const projectMenusByRole = {
        consultant: [
            { icon: Users, label: 'Team Members', path: '/manager-dashboard/project-members' },
            { icon: FileText, label: 'Project Documents', path: '/manager-dashboard/documents' },
            { icon: User, label: 'My Tasks', path: '/manager-dashboard/personal-tasks' },

            { icon: BarChart2, label: 'Analytics', path: '/manager-dashboard/analytics' },
            { icon: Network, label: 'Hierarchy', path: '/manager-dashboard/project-hierarchy' },
        ],
        employee: [
            { icon: Users, label: 'Team Members', path: '/manager-dashboard/project-members' },
            { icon: FileText, label: 'Project Documents', path: '/manager-dashboard/documents' },
            { icon: User, label: 'My Tasks', path: '/manager-dashboard/personal-tasks' },

            { icon: BarChart2, label: 'Analytics', path: '/manager-dashboard/analytics' },
            { icon: Network, label: 'Hierarchy', path: '/manager-dashboard/project-hierarchy' },
        ],
        team_lead: [
            { icon: Users, label: 'Team Members', path: '/manager-dashboard/project-members' },
            { icon: ListTodo, label: 'All Project Tasks', path: '/manager-dashboard/tasks' },
            { icon: User, label: 'My Tasks', path: '/manager-dashboard/personal-tasks' },

            { icon: BarChart2, label: 'Analytics', path: '/manager-dashboard/analytics' },
            { icon: Network, label: 'Hierarchy', path: '/manager-dashboard/project-hierarchy' },
            { icon: FileText, label: 'Documents', path: '/manager-dashboard/documents' },
        ],
        manager: [
            { icon: Users, label: 'Team Members', path: '/manager-dashboard/project-members' },
            { icon: ListTodo, label: 'All Project Tasks', path: '/manager-dashboard/tasks' },
            { icon: User, label: 'My Tasks', path: '/manager-dashboard/personal-tasks' },

            { icon: BarChart2, label: 'Analytics', path: '/manager-dashboard/analytics' },
            { icon: Network, label: 'Project Hierarchy', path: '/manager-dashboard/project-hierarchy' },
            { icon: FileText, label: 'Documents', path: '/manager-dashboard/documents' },
        ]
    };

    // Get menu items based on current project role
    const projectMenuItems = projectMenusByRole[projectRole] || projectMenusByRole.consultant;

    // Menu item renderer
    const renderMenuItem = (item, index, keyPrefix) => {
        const isActive = location.pathname === item.path;
        return (
            <button
                key={`${keyPrefix}-${index}`}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : ''}
                style={{
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
                {item.label === 'Messages' && unreadCount > 0 && (
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

    // Section header (collapsible)
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
                marginBottom: '16px',
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

            {/* Hide scrollbar styles */}
            <style>
                {`
                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .no-scrollbar {
                        -ms-overflow-style: none;  /* IE and Edge */
                        scrollbar-width: none;  /* Firefox */
                    }
                `}
            </style>

            {/* Scrollable Nav */}
            <nav className="no-scrollbar" style={{
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

                {/* Project Section */}
                {userProjects.length > 0 && (
                    <>
                        {/* Project Switcher Card */}
                        {!isCollapsed && (
                            <div style={{
                                marginBottom: '16px',
                                position: 'relative'
                            }}>
                                <div style={{
                                    fontSize: '0.65rem',
                                    color: '#8b5cf6',
                                    marginBottom: '10px',
                                    fontWeight: 700,
                                    paddingLeft: '4px',
                                    letterSpacing: '0.1em',
                                    textTransform: 'uppercase'
                                }}>
                                    CURRENT PROJECT
                                </div>
                                <button
                                    onClick={() => setShowProjectPicker(!showProjectPicker)}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.1) 100%)',
                                        border: '1px solid rgba(139,92,246,0.3)',
                                        borderRadius: '12px',
                                        padding: '12px 14px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: '0 4px 12px rgba(139,92,246,0.15)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(124,58,237,0.2) 100%)';
                                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(139,92,246,0.25)';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(124,58,237,0.1) 100%)';
                                        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.15)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            background: getRoleBadge(projectRole).color,
                                            boxShadow: `0 0 8px ${getRoleBadge(projectRole).color}`
                                        }} />
                                        <span>{currentProject?.name || 'Select...'}</span>
                                    </div>
                                    <ChevronDown size={16} style={{ transform: showProjectPicker ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                </button>

                                {/* Dropdown */}
                                {showProjectPicker && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        background: '#2a2a4a',
                                        borderRadius: '8px',
                                        marginTop: '4px',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                                        zIndex: 100,
                                        overflow: 'hidden'
                                    }}>
                                        {userProjects.map((project) => (
                                            <button
                                                key={project.id}
                                                onClick={() => {
                                                    setCurrentProject(project.id);
                                                    setShowProjectPicker(false);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 14px',
                                                    border: 'none',
                                                    background: currentProject?.id === project.id ? 'rgba(139,92,246,0.3)' : 'transparent',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    borderBottom: '1px solid rgba(255,255,255,0.1)'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = currentProject?.id === project.id ? 'rgba(139,92,246,0.3)' : 'transparent'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        background: getRoleBadge(project.role).color,
                                                        flexShrink: 0
                                                    }} />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{project.name}</div>
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{getRoleBadge(project.role).label}</div>
                                                    </div>
                                                </div>
                                                {currentProject?.id === project.id && <Check size={16} style={{ color: '#8b5cf6' }} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {renderSectionHeader(FolderKanban, currentProject?.name || 'Project', 'project')}
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
                    </>
                )}
            </nav>

            {/* Logout */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', marginTop: '12px' }}>
                <button
                    onClick={() => navigate('/manager-dashboard/settings')}
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
                        background: location.pathname === '/manager-dashboard/settings' ? 'var(--accent)' : 'transparent',
                        color: location.pathname === '/manager-dashboard/settings' ? 'white' : 'rgba(255,255,255,0.7)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        marginBottom: '8px'
                    }}
                    onMouseEnter={(e) => {
                        if (location.pathname !== '/manager-dashboard/settings') {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.color = 'white';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (location.pathname !== '/manager-dashboard/settings') {
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
        </aside>
    );
};

export default Sidebar;
