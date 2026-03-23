import React, { useState } from 'react';
import {
    LayoutDashboard,
    BarChart2,
    Users,
    ListTodo,
    CalendarOff,
    Receipt,
    DollarSign,
    FileText,
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
    FolderOpen,
    TrendingUp,
    Building2,
    FolderKanban,
    Ticket,
    Trophy,
    ClipboardList
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMessages } from '../../../shared/context/MessageContext';

const Sidebar = ({ isCollapsed, toggleSidebar, onMouseEnter, onMouseLeave }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { unreadCount } = useMessages();

    const [expandedMenus, setExpandedMenus] = useState({
        organization: true,
        project: true
    });

    const toggleMenu = (label) => {
        if (isCollapsed) return;
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    // Organization-level menu items (Org Manager stuff)
    const orgMenuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/executive-dashboard/dashboard' },
        { icon: Users, label: 'Employees', path: '/executive-dashboard/employees' },
        { icon: UserCheck, label: 'Employee Status', path: '/executive-dashboard/employee-status' },
        { icon: ClipboardList, label: 'Attendance Logs', path: '/executive-dashboard/attendance-logs' },
        { icon: CalendarOff, label: 'Leave Requests', path: '/executive-dashboard/leaves' },
        { icon: DollarSign, label: 'Payroll', path: '/executive-dashboard/payroll' },
        { icon: Receipt, label: 'Payslips', path: '/executive-dashboard/payslips' },
        { icon: FileText, label: 'Invoice', path: '/executive-dashboard/invoice' },
        { icon: Briefcase, label: 'Hiring Portal', path: '/executive-dashboard/hiring' },
        { icon: Network, label: 'Org Hierarchy', path: '/executive-dashboard/hierarchy' },
        { icon: Megaphone, label: 'Announcements', path: '/executive-dashboard/announcements' },
        { icon: MessageCircle, label: 'Messages', path: '/executive-dashboard/messages' },
        { icon: FileCheck, label: 'Policies', path: '/executive-dashboard/policies' },
        { icon: TrendingUp, label: 'Review', path: '/executive-dashboard/executive-reviews' },
        { icon: Trophy, label: 'Ranking', path: '/executive-dashboard/rankings' },
        { icon: Ticket, label: 'Raise a Ticket', path: '/executive-dashboard/raise-ticket' },
    ];

    // Project-level menu items (Project Manager stuff)
    const projectMenuItems = [
        { icon: FolderOpen, label: 'Projects', path: '/executive-dashboard/projects' },
        { icon: ListTodo, label: 'Tasks', path: '/executive-dashboard/tasks' },
        { icon: BarChart2, label: 'Analytics', path: '/executive-dashboard/analytics' },
        { icon: TrendingUp, label: 'Project Analytics', path: '/executive-dashboard/project-analytics' },
        { icon: Network, label: 'Project Hierarchy', path: '/executive-dashboard/project-hierarchy' },
        { icon: FileText, label: 'Documents', path: '/executive-dashboard/documents' },
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: isActive ? '#7C3AED' : 'transparent',
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
                backgroundColor: 'var(--sidebar-bg)',
                color: 'var(--sidebar-text)',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                padding: '12px',
                zIndex: 1000,
                transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'width',
                transform: 'translateZ(0)'
            }}>
            <style>
                {`
                    .no-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .no-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}
            </style>
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
                        <h1 style={{ fontSize: '1rem', fontWeight: 'bold' }}>Talent Ops</h1>
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
            }} className="no-scrollbar">
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
                {renderSectionHeader(FolderKanban, 'Project', 'project')}
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
                    onClick={() => navigate('/executive-dashboard/settings')}
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
                        background: location.pathname === '/executive-dashboard/settings' ? '#7C3AED' : 'transparent',
                        color: location.pathname === '/executive-dashboard/settings' ? 'white' : 'rgba(255,255,255,0.7)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        marginBottom: '8px'
                    }}
                    onMouseEnter={(e) => {
                        if (location.pathname !== '/executive-dashboard/settings') {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.color = 'white';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (location.pathname !== '/executive-dashboard/settings') {
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
        </aside >
    );
};

export default Sidebar;
